const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

require("dotenv").config();

// ─── Database ─────────────────────────────────────────────────
const db = new Database(path.join(__dirname, "nexus.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    claude_response TEXT,
    deepseek_response TEXT,
    qwen_response TEXT,
    winner TEXT,
    score_claude INTEGER,
    score_deepseek INTEGER,
    score_qwen INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id)
  );
`);

// Migrations for existing databases
const migrations = [
  "ALTER TABLE messages ADD COLUMN deepseek_response TEXT",
  "ALTER TABLE messages ADD COLUMN qwen_response TEXT",
  "ALTER TABLE messages ADD COLUMN score_deepseek INTEGER",
  "ALTER TABLE messages ADD COLUMN score_qwen INTEGER",
];
for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (_) {}
}

// Default admin
const adminExists = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get("admin@nexus.com");
if (!adminExists) {
  const hashed = bcrypt.hashSync("admin123", 10);
  db.prepare(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
  ).run("Admin", "admin@nexus.com", hashed, "admin");
  console.log("✦  Default admin created: admin@nexus.com / admin123");
}

// ─── App ──────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ─── Middleware ───────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admins only" });
  next();
}

// ─── OpenRouter Helper (for 3 AI models) ─────────────────────
async function openRouterCall(model, prompt) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "NEXUS AI Aggregator",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "API error");
  return data.choices?.[0]?.message?.content || "No response.";
}

// ─── AUTH ─────────────────────────────────────────────────────
app.post("/api/auth/signup", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "All fields required" });
  try {
    const hashed = bcrypt.hashSync(password, 10);
    const result = db
      .prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)")
      .run(name, email, hashed);
    const token = jwt.sign(
      { id: result.lastInsertRowid, name, email, role: "user" },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.json({
      token,
      user: { id: result.lastInsertRowid, name, email, role: "user" },
    });
  } catch (err) {
    if (err.message.includes("UNIQUE"))
      return res.status(400).json({ error: "Email already registered" });
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "Invalid email or password" });
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// ─── CHATS ────────────────────────────────────────────────────
app.get("/api/chats", authMiddleware, (req, res) => {
  res.json(
    db
      .prepare("SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC")
      .all(req.user.id),
  );
});

app.post("/api/chats", authMiddleware, (req, res) => {
  const { title } = req.body;
  const result = db
    .prepare("INSERT INTO chats (user_id, title) VALUES (?, ?)")
    .run(req.user.id, title || "New Chat");
  res.json({ id: result.lastInsertRowid, title: title || "New Chat" });
});

app.delete("/api/chats/:id", authMiddleware, (req, res) => {
  db.prepare("DELETE FROM messages WHERE chat_id = ?").run(req.params.id);
  db.prepare("DELETE FROM chats WHERE id = ? AND user_id = ?").run(
    req.params.id,
    req.user.id,
  );
  res.json({ success: true });
});

app.get("/api/chats/:id/messages", authMiddleware, (req, res) => {
  res.json(
    db
      .prepare(
        "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
      )
      .all(req.params.id),
  );
});

app.post("/api/chats/:id/messages", authMiddleware, (req, res) => {
  const {
    role,
    content,
    claude_response,
    deepseek_response,
    qwen_response,
    winner,
    score_claude,
    score_deepseek,
    score_qwen,
    reason,
  } = req.body;
  const result = db
    .prepare(
      `
    INSERT INTO messages (chat_id, role, content, claude_response, deepseek_response, qwen_response, winner, score_claude, score_deepseek, score_qwen, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      req.params.id,
      role,
      content,
      claude_response,
      deepseek_response,
      qwen_response,
      winner,
      score_claude,
      score_deepseek,
      score_qwen,
      reason,
    );
  res.json({ id: result.lastInsertRowid });
});

// ─── ADMIN ────────────────────────────────────────────────────
app.get("/api/admin/stats", authMiddleware, adminMiddleware, (req, res) => {
  const totalUsers = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'")
    .get().count;
  const totalChats = db
    .prepare("SELECT COUNT(*) as count FROM chats")
    .get().count;
  const totalMessages = db
    .prepare("SELECT COUNT(*) as count FROM messages WHERE role = 'user'")
    .get().count;
  const claudeWins = db
    .prepare(
      "SELECT COUNT(*) as count FROM messages WHERE winner = 'Claude Sonnet'",
    )
    .get().count;
  const deepseekWins = db
    .prepare(
      "SELECT COUNT(*) as count FROM messages WHERE winner = 'DeepSeek R1'",
    )
    .get().count;
  const qwenWins = db
    .prepare(
      "SELECT COUNT(*) as count FROM messages WHERE winner = 'Qwen Coder'",
    )
    .get().count;
  const topUsers = db
    .prepare(
      `
    SELECT u.name, u.email, u.created_at, COUNT(m.id) as query_count
    FROM users u
    LEFT JOIN chats c ON c.user_id = u.id
    LEFT JOIN messages m ON m.chat_id = c.id AND m.role = 'user'
    WHERE u.role = 'user'
    GROUP BY u.id ORDER BY query_count DESC LIMIT 10
  `,
    )
    .all();
  const recentActivity = db
    .prepare(
      `
    SELECT u.name, c.title, m.content, m.winner, m.created_at
    FROM messages m
    JOIN chats c ON c.id = m.chat_id
    JOIN users u ON u.id = c.user_id
    WHERE m.role = 'user' ORDER BY m.created_at DESC LIMIT 20
  `,
    )
    .all();
  res.json({
    totalUsers,
    totalChats,
    totalMessages,
    claudeWins,
    deepseekWins,
    qwenWins,
    topUsers,
    recentActivity,
  });
});

// ─── AI MODELS (via OpenRouter) ───────────────────────────────
app.post("/api/claude", authMiddleware, async (req, res) => {
  try {
    const response = await openRouterCall(
      "anthropic/claude-sonnet-4.5",
      req.body.prompt,
    );
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: "Claude Sonnet failed: " + err.message });
  }
});

app.post("/api/deepseek", authMiddleware, async (req, res) => {
  try {
    const response = await openRouterCall(
      "deepseek/deepseek-r1",
      req.body.prompt,
    );
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: "DeepSeek R1 failed: " + err.message });
  }
});

app.post("/api/qwen", authMiddleware, async (req, res) => {
  try {
    const response = await openRouterCall(
      "qwen/qwen-2.5-coder-32b-instruct",
      req.body.prompt,
    );
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: "Qwen Coder failed: " + err.message });
  }
});

// ─── JUDGE (via Groq — free, reliable JSON output) ────────────
app.post("/api/judge", authMiddleware, async (req, res) => {
  const { prompt, claudeResponse, deepseekResponse, qwenResponse } = req.body;
  try {
    const judgePrompt = `You are evaluating three AI responses for a software development question.

Question: "${prompt}"

Response A (Claude Sonnet): ${claudeResponse?.slice(0, 300)}

Response B (DeepSeek R1): ${deepseekResponse?.slice(0, 300)}

Response C (Qwen Coder): ${qwenResponse?.slice(0, 300)}

Evaluate based on accuracy, clarity, completeness, and usefulness for software development.
Pick the best response and give each a score from 1 to 10.
The winner must be exactly one of: "Claude Sonnet", "DeepSeek R1", "Qwen Coder".
Provide a 1-2 sentence reason.`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: judgePrompt }],
          max_tokens: 256,
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      },
    );

    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message || "Groq judge error");

    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    console.log("JUDGE PARSED:", parsed);

    res.json({
      winner: parsed.winner || "Claude Sonnet",
      score_claude: Number(parsed.score_claude) || 7,
      score_deepseek: Number(parsed.score_deepseek) || 7,
      score_qwen: Number(parsed.score_qwen) || 7,
      reason: parsed.reason || "All models provided valid responses.",
    });
  } catch (err) {
    res.status(500).json({ error: "Judge failed: " + err.message });
  }
});

// ─── Health ───────────────────────────────────────────────────
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

const PORT = 5001;
app.listen(PORT, () =>
  console.log(`✦  NEXUS server running on http://localhost:${PORT}`),
);
