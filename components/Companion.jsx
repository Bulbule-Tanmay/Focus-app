import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Sparkles, Menu, X, Check, Circle, Clock, Trash2, BookOpen, MessageSquare, LayoutGrid } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Board from "./Board";
import { todayISO, daysUntil } from "../lib/dates";
import { fetchMemory, postMemoryOps } from "../lib/memoryApi";

const T = {
  bg: "#EDEAE2", panel: "#F8F6F1", panelAlt: "#F1EEE6", ink: "#21281F",
  inkSoft: "#5B6355", inkFaint: "#8B9184", line: "#DAD5C8", growth: "#4C7359",
  growthSoft: "#DCE6DD", urgent: "#B8763A", mood: "#7A5C7E", bubbleUser: "#21281F",
};
const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

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
  const rawText = await res.text();
  const fallback = {
    reply: "I couldn't read that response clearly — please try again.",
    memory_ops: [],
  };
  const parsePayload = () => {
    try {
      let parsed = JSON.parse(rawText);
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return fallback;
        }
      }
      if (!parsed || typeof parsed !== "object") return fallback;
      const body = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
      const reply = typeof body.reply === "string" ? body.reply : fallback.reply;
      const memoryOps = Array.isArray(body.memory_ops) ? body.memory_ops : [];
      return { reply, memory_ops: memoryOps };
    } catch {
      return fallback;
    }
  };
  const parsed = parsePayload();
  if (!res.ok) {
    throw new Error(parsed.message || parsed.error || "API error");
  }
  return parsed;
}

function toMarkdown(text) {
  if (typeof text !== "string") return "";
  return text
    .split("\n")
    .map((line) => line.replace(/^(\s*)•\s+/, "$1- "))
    .join("\n");
}

export default function Companion() {
  const [tab, setTab] = useState("chat"); // "chat" | "board"
  const [memory, setMemory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    setMessages(loadLocal("chat-log", []));
    fetchMemory()
      .then((items) => setMemory(items))
      .catch((e) => setErrorMsg(e.message || "Could not load saved tasks/notes."))
      .finally(() => setReady(true));
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
      const { items, added } = await postMemoryOps(result.memory_ops);
      setMemory(items);
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
    <div style={{ fontFamily: FONT_BODY, background: T.bg, color: T.ink, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${T.line}`, background: T.panel, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color={T.growth} />
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600 }}>Companion</span>
        </div>
        <div style={{ display: "flex", gap: 3, background: T.panelAlt, padding: 3, borderRadius: 10, border: `1px solid ${T.line}` }}>
          <TabButton active={tab === "chat"} onClick={() => setTab("chat")} icon={MessageSquare} label="Chat" />
          <TabButton active={tab === "board"} onClick={() => setTab("board")} icon={LayoutGrid} label="Board" />
        </div>
        {tab === "chat" ? (
          <button onClick={() => setSidebarOpen((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex" }}>
            <Menu size={18} />
          </button>
        ) : (
          <div style={{ width: 18 }} />
        )}
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
      {tab === "board" ? (
        <Board memory={memory} setMemory={setMemory} />
      ) : (
      <>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
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
                    {m.role === "assistant" ? (
                      <div className="assistant-markdown">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                            ul: ({ children }) => <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{children}</ul>,
                            li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
                          }}
                        >
                          {toMarkdown(m.text)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      m.text
                    )}
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
      </>
      )}
      </div>
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

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
        borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontFamily: FONT_BODY, fontWeight: 500,
        background: active ? "#fff" : "transparent",
        color: active ? T.ink : T.inkFaint,
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function MemTask({ item, setMemory, memory }) {
  const du = daysUntil(item.deadline);
  const urgent = du !== null && du <= 2;
  const toggle = async () => {
    const fields = { status: item.status === "done" ? "open" : "done" };
    const { items } = await postMemoryOps([{ op: "update", id: item.id, fields }]);
    setMemory(items);
  };
  const remove = async () => {
    const { items } = await postMemoryOps([{ op: "delete", id: item.id }]);
    setMemory(items);
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
