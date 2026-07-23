import { useState, useRef, useEffect } from "react";
import "./App.css";

const MODELS = [
  {
    id: "claude",
    name: "Claude Sonnet",
    provider: "Anthropic via OpenRouter",
    color: "#D4A574",
    icon: "◆",
  },
  {
    id: "deepseek",
    name: "DeepSeek R1",
    provider: "DeepSeek via OpenRouter",
    color: "#7BA7E8",
    icon: "◈",
  },
  {
    id: "qwen",
    name: "Qwen Coder",
    provider: "Alibaba via OpenRouter",
    color: "#A67BE8",
    icon: "⬡",
  },
];

function api(path, options = {}) {
  const token = localStorage.getItem("nexus_token");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then((r) => r.json());
}

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      localStorage.setItem("nexus_token", data.token);
      onLogin(data.user);
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon">⬡</span>
          <span className="logo-text">NEXUS</span>
        </div>
        <p className="auth-sub">
          Multi-Model AI Aggregator for Software Development
        </p>
        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Login
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Sign Up
          </button>
        </div>
        {mode === "signup" && (
          <input
            className="auth-input"
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        )}
        <input
          className="auth-input"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <input
          className="auth-input"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-btn" onClick={submit} disabled={loading}>
          {loading
            ? "Please wait…"
            : mode === "login"
              ? "Login"
              : "Create Account"}
        </button>
        {mode === "login" && (
          <p className="auth-hint">Admin: admin@nexus.com / admin123</p>
        )}
      </div>
    </div>
  );
}

function AdminPanel({ onBack }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api("/api/admin/stats").then(setStats);
  }, []);
  if (!stats) return <div className="admin-loading">Loading stats…</div>;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⬡</span>
            <span className="logo-text">NEXUS</span>
          </div>
          <span className="admin-badge">Admin Panel</span>
        </div>
        <button className="admin-back-btn" onClick={onBack}>
          ← Back to Chat
        </button>
      </header>
      <div className="admin-body">
        <h2 className="admin-title">Usage Statistics</h2>
        <div className="stat-grid">
          {[
            { label: "Total Users", value: stats.totalUsers, icon: "👤" },
            { label: "Total Chats", value: stats.totalChats, icon: "💬" },
            { label: "Total Queries", value: stats.totalMessages, icon: "📨" },
            { label: "Claude Wins", value: stats.claudeWins, icon: "◆" },
            { label: "DeepSeek Wins", value: stats.deepseekWins, icon: "◈" },
            { label: "Qwen Wins", value: stats.qwenWins, icon: "⬡" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
        <h3 className="admin-section-title">Most Active Users</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Queries</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {stats.topUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ textAlign: "center", color: "var(--text-3)" }}
                >
                  No users yet
                </td>
              </tr>
            ) : (
              stats.topUsers.map((u, i) => (
                <tr key={i}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="query-badge">{u.query_count}</span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <h3 className="admin-section-title">Recent Activity</h3>
        <div className="activity-list">
          {stats.recentActivity.length === 0 ? (
            <p style={{ color: "var(--text-3)", textAlign: "center" }}>
              No activity yet
            </p>
          ) : (
            stats.recentActivity.map((a, i) => (
              <div key={i} className="activity-item">
                <div className="activity-left">
                  <span className="activity-user">{a.name}</span>
                  <span className="activity-query">
                    {a.content?.slice(0, 80)}
                    {a.content?.length > 80 ? "…" : ""}
                  </span>
                </div>
                <div className="activity-right">
                  {a.winner && (
                    <span className="activity-winner">👑 {a.winner}</span>
                  )}
                  <span className="activity-time">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  user,
  onLogout,
  onAdmin,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo">
          <span className="logo-icon">⬡</span>
          <span className="logo-text">NEXUS</span>
        </div>
        <button className="new-chat-btn" onClick={onNewChat}>
          + New Chat
        </button>
      </div>
      <div className="sidebar-chats">
        <p className="sidebar-label">Chat History</p>
        {chats.length === 0 && <p className="sidebar-empty">No chats yet</p>}
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`sidebar-chat-item ${activeChatId === chat.id ? "active" : ""}`}
            onClick={() => onSelectChat(chat.id)}
          >
            <span className="sidebar-chat-title">{chat.title}</span>
            <button
              className="sidebar-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(chat.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="sidebar-bottom">
        {user.role === "admin" && (
          <button className="admin-panel-btn" onClick={onAdmin}>
            ⚙ Admin Panel
          </button>
        )}
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user.name[0].toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.name}</span>
            <span className="sidebar-user-email">{user.email}</span>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">
            ↩
          </button>
        </div>
      </div>
    </aside>
  );
}

function ModelCard({ model, message, isLoading, isWinner, score }) {
  const contentRef = useRef(null);
  useEffect(() => {
    if (contentRef.current)
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [message]);
  return (
    <div
      className={`model-card ${isWinner ? "winner" : ""}`}
      style={{ "--model-color": model.color }}
    >
      <div className="model-card-header">
        <span className="model-icon">{model.icon}</span>
        <div className="model-info">
          <span className="model-name">{model.name}</span>
          <span className="model-provider">{model.provider}</span>
        </div>
        <div className="model-card-header-right">
          {score !== undefined && (
            <span className="model-score">{score}/10</span>
          )}
          {isWinner && <span className="winner-badge">👑 Best</span>}
          <div
            className={`model-status ${isLoading ? "loading" : message ? "done" : "idle"}`}
          >
            {isLoading ? "Thinking…" : message ? "Done" : "Ready"}
          </div>
        </div>
      </div>
      <div className="model-card-body" ref={contentRef}>
        {isLoading && !message && (
          <div className="typing-dots" style={{ "--dot-color": model.color }}>
            <span />
            <span />
            <span />
          </div>
        )}
        {message && <div className="model-response">{message}</div>}
        {!isLoading && !message && (
          <div className="model-placeholder">Response will appear here</div>
        )}
      </div>
    </div>
  );
}

function VerdictBanner({ verdict, isJudging }) {
  if (isJudging)
    return (
      <div className="verdict-banner judging">
        <span className="spin" style={{ fontSize: 18 }}>
          ⚖
        </span>
        <span>Qwen Coder is evaluating all three responses…</span>
      </div>
    );
  if (!verdict) return null;
  return (
    <div className="verdict-banner done">
      <div className="verdict-left">
        <span className="verdict-icon">⚖</span>
        <div className="verdict-text">
          <span className="verdict-label">JUDGE'S VERDICT</span>
          <span className="verdict-winner">👑 {verdict.winner} wins</span>
        </div>
      </div>
      <div className="verdict-reason">{verdict.reason}</div>
      <div className="verdict-scores">
        <span style={{ color: "#D4A574" }}>
          Claude: {verdict.score_claude}/10
        </span>
        <span style={{ color: "#7BA7E8" }}>
          DeepSeek: {verdict.score_deepseek}/10
        </span>
        <span style={{ color: "#A67BE8" }}>Qwen: {verdict.score_qwen}/10</span>
      </div>
    </div>
  );
}

function ChatMessage({ role, content, responses, verdict, isJudging }) {
  return (
    <div className={`chat-message ${role}`}>
      {role === "user" ? (
        <div className="user-bubble">
          <span className="user-label">You</span>
          <p>{content}</p>
        </div>
      ) : (
        <div className="assistant-responses">
          <div className="response-grid">
            {MODELS.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                message={responses?.[model.id]}
                isLoading={responses?.[model.id] === null}
                isWinner={verdict?.winner === model.name}
                score={
                  verdict
                    ? model.id === "claude"
                      ? verdict.score_claude
                      : model.id === "deepseek"
                        ? verdict.score_deepseek
                        : verdict.score_qwen
                    : undefined
                }
              />
            ))}
          </div>
          <VerdictBanner verdict={verdict} isJudging={isJudging} />
        </div>
      )}
    </div>
  );
}

function ChatView({ activeChatId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    api(`/api/chats/${activeChatId}/messages`).then((msgs) => {
      const rebuilt = [];
      for (const m of msgs) {
        if (m.role === "user") {
          rebuilt.push({ role: "user", content: m.content });
        } else {
          rebuilt.push({
            role: "assistant",
            responses: {
              claude: m.claude_response,
              deepseek: m.deepseek_response,
              qwen: m.qwen_response,
            },
            verdict: m.winner
              ? {
                  winner: m.winner,
                  score_claude: m.score_claude,
                  score_deepseek: m.score_deepseek,
                  score_qwen: m.score_qwen,
                  reason: m.reason,
                }
              : null,
            isJudging: false,
          });
        }
      }
      setMessages(rebuilt);
    });
  }, [activeChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateLastMessage = (updater) =>
    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = updater(updated[updated.length - 1]);
      return updated;
    });

  const handleSubmit = async () => {
    const prompt = input.trim();
    if (!prompt || isProcessing || !activeChatId) return;
    setInput("");
    setIsProcessing(true);

    await api(`/api/chats/${activeChatId}/messages`, {
      method: "POST",
      body: JSON.stringify({ role: "user", content: prompt }),
    });

    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt },
      {
        role: "assistant",
        responses: { claude: null, deepseek: null, qwen: null },
        verdict: null,
        isJudging: false,
      },
    ]);

    const updateResponse = (modelId, text) =>
      updateLastMessage((msg) => ({
        ...msg,
        responses: { ...msg.responses, [modelId]: text },
      }));

    const [claudeResult, deepseekResult, qwenResult] = await Promise.allSettled(
      [
        api("/api/claude", { method: "POST", body: JSON.stringify({ prompt }) })
          .then((d) => {
            const t = d.response || d.error;
            updateResponse("claude", t);
            return t;
          })
          .catch(() => {
            updateResponse("claude", "⚠ Failed to reach Claude Sonnet.");
            return null;
          }),
        api("/api/deepseek", {
          method: "POST",
          body: JSON.stringify({ prompt }),
        })
          .then((d) => {
            const t = d.response || d.error;
            updateResponse("deepseek", t);
            return t;
          })
          .catch(() => {
            updateResponse("deepseek", "⚠ Failed to reach DeepSeek R1.");
            return null;
          }),
        api("/api/qwen", { method: "POST", body: JSON.stringify({ prompt }) })
          .then((d) => {
            const t = d.response || d.error;
            updateResponse("qwen", t);
            return t;
          })
          .catch(() => {
            updateResponse("qwen", "⚠ Failed to reach Qwen Coder.");
            return null;
          }),
      ],
    );

    const claudeText =
      claudeResult.status === "fulfilled" ? claudeResult.value : null;
    const deepseekText =
      deepseekResult.status === "fulfilled" ? deepseekResult.value : null;
    const qwenText =
      qwenResult.status === "fulfilled" ? qwenResult.value : null;

    let verdict = null;
    if (claudeText && deepseekText && qwenText) {
      updateLastMessage((msg) => ({ ...msg, isJudging: true }));
      try {
        verdict = await api("/api/judge", {
          method: "POST",
          body: JSON.stringify({
            prompt,
            claudeResponse: claudeText,
            deepseekResponse: deepseekText,
            qwenResponse: qwenText,
          }),
        });
        console.log("VERDICT FROM SERVER:", verdict);
        updateLastMessage((msg) => ({ ...msg, verdict, isJudging: false }));
      } catch {
        updateLastMessage((msg) => ({ ...msg, isJudging: false }));
      }
    }

    await api(`/api/chats/${activeChatId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        role: "assistant",
        claude_response: claudeText,
        deepseek_response: deepseekText,
        qwen_response: qwenText,
        winner: verdict?.winner || null,
        score_claude: verdict?.score_claude || null,
        score_deepseek: verdict?.score_deepseek || null,
        score_qwen: verdict?.score_qwen || null,
        reason: verdict?.reason || null,
      }),
    });

    setIsProcessing(false);
  };

  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <div className="chat-view">
      <main className="chat-area">
        {messages.length === 0 ? (
          <div className="welcome">
            <div className="welcome-icon">⬡</div>
            <h1>Ask anything.</h1>
            <p>
              Your prompt is sent to <strong>Claude Sonnet</strong>,{" "}
              <strong>DeepSeek R1</strong>, and <strong>Qwen Coder</strong>{" "}
              simultaneously. The best response is selected automatically.
            </p>
            <div className="welcome-suggestions">
              {[
                "Explain how React hooks work",
                "Write a Python function to reverse a linked list",
                "What's the difference between REST and GraphQL?",
                "How does garbage collection work in JavaScript?",
              ].map((s) => (
                <button
                  key={s}
                  className="suggestion-chip"
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            {!activeChatId && (
              <p className="no-chat-hint">← Create a new chat to get started</p>
            )}
          </div>
        ) : (
          <div className="messages">
            {messages.map((msg, i) => (
              <ChatMessage key={i} {...msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>
      <footer className="input-area">
        <div className="input-wrapper">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize(e);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              activeChatId
                ? "Ask a software development question…"
                : "Create a new chat first…"
            }
            rows={1}
            disabled={isProcessing || !activeChatId}
          />
          <button
            className={`send-btn ${isProcessing ? "processing" : ""}`}
            onClick={handleSubmit}
            disabled={isProcessing || !input.trim() || !activeChatId}
          >
            {isProcessing ? <span className="spin">↻</span> : <span>↑</span>}
          </button>
        </div>
        <p className="input-hint">
          Enter to send · Shift+Enter for new line · Judged by Qwen Coder
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("chat");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("nexus_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp * 1000 > Date.now()) setUser(payload);
        else localStorage.removeItem("nexus_token");
      } catch {
        localStorage.removeItem("nexus_token");
      }
    }
  }, []);

  useEffect(() => {
    if (user)
      api("/api/chats").then((data) =>
        setChats(Array.isArray(data) ? data : []),
      );
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("nexus_token");
    setUser(null);
    setChats([]);
    setActiveChatId(null);
    setView("chat");
  };

  const handleNewChat = async () => {
    const title = "Chat " + new Date().toLocaleTimeString();
    const chat = await api("/api/chats", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
  };

  const handleDeleteChat = async (id) => {
    await api(`/api/chats/${id}`, { method: "DELETE" });
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  if (!user) return <AuthPage onLogin={setUser} />;
  if (view === "admin") return <AdminPanel onBack={() => setView("chat")} />;

  return (
    <div className="app-layout">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        user={user}
        onLogout={handleLogout}
        onAdmin={() => setView("admin")}
      />
      <div className="main-content">
        <header className="app-header">
          <div className="header-models">
            {MODELS.map((m) => (
              <div
                key={m.id}
                className="header-model-badge"
                style={{ "--model-color": m.color }}
              >
                <span>{m.icon}</span> {m.name}
              </div>
            ))}
            <div className="header-model-badge judge-badge">
              <span>⚖</span> Judge
            </div>
          </div>
        </header>
        <ChatView activeChatId={activeChatId} />
      </div>
    </div>
  );
}
