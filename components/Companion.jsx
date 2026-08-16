import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Sparkles, Menu, X, Check, Circle, Clock, Trash2, BookOpen } from "lucide-react";

const T = {
  bg: "#EDEAE2", panel: "#F8F6F1", panelAlt: "#F1EEE6", ink: "#21281F",
  inkSoft: "#5B6355", inkFaint: "#8B9184", line: "#DAD5C8", growth: "#4C7359",
  growthSoft: "#DCE6DD", urgent: "#B8763A", mood: "#7A5C7E", bubbleUser: "#21281F",
};
const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d) => {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((dt - now) / 86400000);
};

function loadLocal(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("localStorage save failed", e);
  }
}

async function callChatApi(memory, conversation) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memory, conversation }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API error");
  }
  return res.json();
}

function applyOps(memory, ops) {
  let next = [...memory];
  const added = [];
  for (const op of ops || []) {
    if (op.op === "add_task") {
      const item = { id: uid(), type: "task", title: op.title, deadline: op.deadline || null, priority: op.priority || "medium", status: "open", createdAt: todayISO() };
      next.push(item); added.push(item);
    } else if (op.op === "add_note") {
      const item = { id: uid(), type: "note", title: op.title, detail: op.detail || "", mood: op.mood || null, status: "logged", createdAt: todayISO() };
      next.push(item); added.push(item);
    } else if (op.op === "complete") {
      next = next.map((m) => (m.id === op.id ? { ...m, status: "done" } : m));
    } else if (op.op === "update") {
      next = next.map((m) => (m.id === op.id ? { ...m, ...op.fields } : m));
    } else if (op.op === "delete") {
      next = next.filter((m) => m.id !== op.id);
    }
  }
  return { next, added };
}

export default function Companion() {
  const [memory, setMemory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    setMemory(loadLocal("memory-items", []));
    setMessages(loadLocal("chat-log", []));
    setReady(true);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    setErrorMsg("");
    const userMsg = { role: "user", text: input.trim() };
    const convo = [...messages, userMsg];
    setMessages(convo);
    saveLocal("chat-log", convo);
    setInput("");
    setLoading(true);
    try {
      const result = await callChatApi(memory, convo);
      const { next, added } = applyOps(memory, result.memory_ops);
      setMemory(next);
      saveLocal("memory-items", next);
      const assistantMsg = { role: "assistant", text: result.reply, saved: added };
      const finalConvo = [...convo, assistantMsg];
      setMessages(finalConvo);
      saveLocal("chat-log", finalConvo);
    } catch (e) {
      setErrorMsg(e.message || "Something went wrong reaching the companion.");
      const finalConvo = [...convo, { role: "assistant", text: "Couldn't reach the companion just now — check the server is set up with a valid API key, then try again." }];
      setMessages(finalConvo);
      saveLocal("chat-log", finalConvo);
    }
    setLoading(false);
  };

  const openTasks = memory
    .filter((m) => m.type === "task" && m.status !== "done")
    .sort((a, b) => {
      const da = daysUntil(a.deadline), db = daysUntil(b.deadline);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  const notes = memory.filter((m) => m.type === "note").slice(-6).reverse();

  return (
    <div style={{ fontFamily: FONT_BODY, background: T.bg, color: T.ink, height: "100vh", display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${T.line}`, background: T.panel }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color={T.growth} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600 }}>Companion</span>
          </div>
          <button onClick={() => setSidebarOpen((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex" }}>
            <Menu size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {!ready ? (
            <div style={{ color: T.inkFaint, fontSize: 13 }}>Loading…</div>
          ) : messages.length === 0 ? (
            <div style={{ color: T.inkFaint, fontSize: 13.5, lineHeight: 1.7, maxWidth: 440 }}>
              Talk to me like normal — tell me what you did, what's on your plate, deadlines, how you're feeling.
              I already know your background context, so you can just ask <em>"what should I do?"</em> anytime.
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 16, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div>
                  <div style={{
                    maxWidth: 480, padding: "10px 14px", borderRadius: 14,
                    borderBottomRightRadius: m.role === "user" ? 4 : 14,
                    borderBottomLeftRadius: m.role === "user" ? 14 : 4,
                    background: m.role === "user" ? T.bubbleUser : T.panelAlt,
                    color: m.role === "user" ? "#F8F6F1" : T.ink,
                    fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap",
                  }}>
                    {m.text}
                  </div>
                  {m.saved && m.saved.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {m.saved.map((s, j) => (
                        <span key={j} style={{
                          fontSize: 10.5, fontFamily: FONT_MONO, padding: "3px 8px", borderRadius: 20,
                          background: s.type === "task" ? T.growthSoft : "#E7DDE9",
                          color: s.type === "task" ? T.growth : T.mood,
                        }}>
                          + saved {s.type === "task" ? "task" : "note"}: {s.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.inkFaint, fontSize: 12.5 }}>
              <Loader2 size={13} className="spin" /> thinking…
            </div>
          )}
          {errorMsg && (
            <div style={{ fontSize: 12, color: "#A2503F", marginTop: 6 }}>{errorMsg}</div>
          )}
          <div ref={endRef} />
        </div>

        <div style={{ padding: "14px 18px", borderTop: `1px solid ${T.line}`, background: T.panel }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Tell me what's going on, or ask what to do next…"
              rows={1}
              style={{
                flex: 1, resize: "none", padding: "10px 13px", borderRadius: 10, border: `1px solid ${T.line}`,
                background: "#fff", fontSize: 14, fontFamily: FONT_BODY, color: T.ink, outline: "none",
                maxHeight: 120, boxSizing: "border-box",
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: T.growth, border: "none", borderRadius: 10, width: 40, height: 40,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: loading || !input.trim() ? "default" : "pointer",
                opacity: loading || !input.trim() ? 0.5 : 1, color: "#fff", flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div style={{ width: 260, borderLeft: `1px solid ${T.line}`, background: T.panel, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: T.inkFaint }}>Remembered</span>
            <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {openTasks.length === 0 && notes.length === 0 && (
              <div style={{ fontSize: 12, color: T.inkFaint, fontStyle: "italic" }}>Nothing saved yet — just start talking.</div>
            )}
            {openTasks.length > 0 && (
              <>
                <div style={{ fontSize: 10.5, fontFamily: FONT_MONO, color: T.inkFaint, marginBottom: 6, marginTop: 4 }}>OPEN TASKS</div>
                {openTasks.map((t) => <MemTask key={t.id} item={t} setMemory={setMemory} memory={memory} />)}
              </>
            )}
            {notes.length > 0 && (
              <>
                <div style={{ fontSize: 10.5, fontFamily: FONT_MONO, color: T.inkFaint, marginBottom: 6, marginTop: 14 }}>RECENT NOTES</div>
                {notes.map((n) => (
                  <div key={n.id} style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "6px 0", fontSize: 12, color: T.inkSoft }}>
                    <BookOpen size={12} style={{ marginTop: 2, flexShrink: 0, color: T.mood }} />
                    <span>{n.title}{n.mood ? ` · mood ${n.mood}/5` : ""}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea::-webkit-scrollbar { width: 0px; }
        html, body { margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}

function MemTask({ item, setMemory, memory }) {
  const du = daysUntil(item.deadline);
  const urgent = du !== null && du <= 2;
  const toggle = () => {
    const next = memory.map((m) => (m.id === item.id ? { ...m, status: m.status === "done" ? "open" : "done" } : m));
    setMemory(next);
    saveLocal("memory-items", next);
  };
  const remove = () => {
    const next = memory.filter((m) => m.id !== item.id);
    setMemory(next);
    saveLocal("memory-items", next);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 0", fontSize: 12.5 }}>
      <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: T.growth }}>
        {item.status === "done" ? <Check size={14} /> : <Circle size={14} color={T.inkFaint} />}
      </button>
      <span style={{ flex: 1, color: T.ink, textDecoration: item.status === "done" ? "line-through" : "none" }}>{item.title}</span>
      {du !== null && (
        <span style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: FONT_MONO, fontSize: 10, color: urgent ? T.urgent : T.inkFaint }}>
          <Clock size={10} />{du < 0 ? `${Math.abs(du)}d over` : du === 0 ? "today" : `${du}d`}
        </span>
      )}
      <button onClick={remove} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 0, display: "flex" }}>
        <Trash2 size={11} />
      </button>
    </div>
  );
}
