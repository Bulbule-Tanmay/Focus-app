import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Circle, CheckCircle2, Clock3, Trash2, X } from "lucide-react";
import { todayISO, daysUntil, addDaysISO, formatLongDate } from "../lib/dates";
import { postMemoryOps } from "../lib/memoryApi";

const T = {
  bg: "#EDEAE2", panel: "#F8F6F1", panelAlt: "#F1EEE6", ink: "#21281F",
  inkSoft: "#5B6355", inkFaint: "#8B9184", line: "#DAD5C8", growth: "#4C7359",
  growthSoft: "#DCE6DD", urgent: "#B8763A", mood: "#7A5C7E",
  todo: "#5B6355", todoSoft: "#E7E4DA",
  progress: "#3D5A9E", progressSoft: "#E4E9F7",
};
const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

const PRIORITY_COLORS = {
  low: { bg: "#E1EBDF", fg: "#3F6B44" },
  medium: { bg: "#F7E3B4", fg: "#8A6415" },
  high: { bg: "#F5D6CC", fg: "#A2503F" },
};

const COLUMNS = [
  { key: "open", label: "To Do", icon: "plus", color: T.todo, soft: T.todoSoft },
  { key: "in_progress", label: "In Progress", icon: "clock", color: T.progress, soft: T.progressSoft },
  { key: "done", label: "Completed", icon: "check", color: T.growth, soft: T.growthSoft },
];

function bucketDateFor(task) {
  if (task.status === "done") return task.completedAt || task.deadline || task.createdAt;
  return task.deadline || null; // resolved against "isToday" by caller when null
}

function tasksForDate(memory, dateISO) {
  const isToday = dateISO === todayISO();
  return memory.filter((m) => {
    if (m.type !== "task") return false;
    const bucket = bucketDateFor(m);
    if (bucket === null) return isToday; // undated open/in-progress tasks live under "today"
    return bucket === dateISO;
  });
}

export default function Board({ memory, setMemory }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [addingFor, setAddingFor] = useState(null); // column key currently showing the quick-add form
  const [busyId, setBusyId] = useState(null);

  const dayTasks = tasksForDate(memory, selectedDate);
  const completedCount = dayTasks.filter((t) => t.status === "done").length;

  const applyOps = async (ops) => {
    const { items } = await postMemoryOps(ops);
    setMemory(items);
  };

  const advance = async (task) => {
    const next = task.status === "open" ? "in_progress" : task.status === "in_progress" ? "done" : "open";
    setBusyId(task.id);
    try {
      await applyOps([{ op: "update", id: task.id, fields: { status: next } }]);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (task) => {
    setBusyId(task.id);
    try {
      await applyOps([{ op: "delete", id: task.id }]);
    } finally {
      setBusyId(null);
    }
  };

  const quickAdd = async ({ title, deadline, priority }) => {
    await applyOps([{ op: "add_task", title, deadline: deadline || null, priority: priority || "medium", status: "open" }]);
    setAddingFor(null);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      {/* Date navigator */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px 8px" }}>
        <div style={{ display: "flex", border: `1px solid ${T.line}`, borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <button
            onClick={() => setSelectedDate((d) => addDaysISO(d, -1))}
            style={navBtnStyle}
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setSelectedDate((d) => addDaysISO(d, 1))}
            style={{ ...navBtnStyle, borderLeft: `1px solid ${T.line}` }}
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: T.ink }}>
            {formatLongDate(selectedDate)}
          </div>
          <div style={{ fontSize: 12.5, color: T.inkFaint, marginTop: 2 }}>
            {dayTasks.length} task{dayTasks.length === 1 ? "" : "s"} • {completedCount} completed
          </div>
        </div>
        {selectedDate !== todayISO() && (
          <button
            onClick={() => setSelectedDate(todayISO())}
            style={{
              marginLeft: "auto", background: "none", border: `1px solid ${T.line}`, borderRadius: 8,
              padding: "6px 12px", fontSize: 12, fontFamily: FONT_BODY, color: T.inkSoft, cursor: "pointer",
            }}
          >
            Today
          </button>
        )}
      </div>

      {/* Columns */}
      <div style={{ flex: 1, overflow: "auto", padding: "10px 22px 22px" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", minWidth: 0 }}>
          {COLUMNS.map((col) => {
            const items = dayTasks.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                style={{
                  flex: "1 1 0", minWidth: 240, background: T.panel, border: `1px solid ${T.line}`,
                  borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden",
                }}
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  background: col.key === "open" ? T.panel : col.soft,
                  borderBottom: `1px solid ${T.line}`,
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, background: "#fff", display: "flex",
                    alignItems: "center", justifyContent: "center", color: col.color, flexShrink: 0,
                    border: `1px solid ${T.line}`,
                  }}>
                    {col.key === "open" ? (
                      <button
                        onClick={() => setAddingFor(addingFor === col.key ? null : col.key)}
                        style={{ background: "none", border: "none", padding: 0, display: "flex", cursor: "pointer", color: col.color }}
                        aria-label="Add task"
                      >
                        <Plus size={15} />
                      </button>
                    ) : col.key === "in_progress" ? (
                      <Clock3 size={14} />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                  </div>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14.5, color: col.key === "open" ? T.ink : col.color, flex: 1 }}>
                    {col.label}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: col.key === "open" ? T.inkFaint : col.color }}>
                    {items.length}
                  </span>
                </div>

                <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 90 }}>
                  {col.key === "open" && addingFor === "open" && (
                    <QuickAddForm onCancel={() => setAddingFor(null)} onSubmit={quickAdd} defaultDate={selectedDate} />
                  )}
                  {items.length === 0 && !(col.key === "open" && addingFor === "open") && (
                    <div style={{ textAlign: "center", padding: "18px 6px", fontSize: 12.5, color: T.inkFaint }}>
                      No tasks
                    </div>
                  )}
                  {items.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      busy={busyId === t.id}
                      onAdvance={() => advance(t)}
                      onDelete={() => remove(t)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const navBtnStyle = {
  background: "none", border: "none", padding: "8px 9px", display: "flex",
  alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.inkSoft,
};

function TaskCard({ task, busy, onAdvance, onDelete }) {
  const pr = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const du = daysUntil(task.deadline);
  const overdue = du !== null && du < 0 && task.status !== "done";
  return (
    <div style={{
      background: "#fff", border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 12px",
      opacity: busy ? 0.6 : 1, transition: "opacity 120ms",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <button
          onClick={onAdvance}
          disabled={busy}
          style={{ background: "none", border: "none", padding: 0, marginTop: 1, display: "flex", cursor: busy ? "default" : "pointer", color: task.status === "done" ? T.growth : T.inkFaint, flexShrink: 0 }}
          aria-label={task.status === "done" ? "Reopen task" : "Advance task"}
        >
          {task.status === "done" ? <CheckCircle2 size={17} /> : <Circle size={17} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, color: T.ink, fontWeight: 500,
            textDecoration: task.status === "done" ? "line-through" : "none",
            wordBreak: "break-word",
          }}>
            {task.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{
              fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4, padding: "2.5px 7px",
              borderRadius: 20, background: pr.bg, color: pr.fg, textTransform: "uppercase",
            }}>
              {task.priority || "medium"}
            </span>
            {task.deadline && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontFamily: FONT_MONO, color: overdue ? T.urgent : T.inkFaint }}>
                <Clock3 size={10} />
                {overdue ? `${Math.abs(du)}d over` : du === 0 ? "today" : du > 0 ? `${du}d` : task.deadline}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={busy}
          style={{ background: "none", border: "none", padding: 0, display: "flex", cursor: busy ? "default" : "pointer", color: T.inkFaint, flexShrink: 0 }}
          aria-label="Delete task"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function QuickAddForm({ onCancel, onSubmit, defaultDate }) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState(defaultDate || "");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), deadline, priority });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: T.panelAlt, border: `1px solid ${T.line}`, borderRadius: 11, padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
          placeholder="Task title…"
          style={{ flex: 1, border: `1px solid ${T.line}`, borderRadius: 7, padding: "6px 9px", fontSize: 13, fontFamily: FONT_BODY, outline: "none" }}
        />
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 2 }} aria-label="Cancel">
          <X size={14} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          style={{ flex: 1, border: `1px solid ${T.line}`, borderRadius: 7, padding: "5px 7px", fontSize: 12, fontFamily: FONT_BODY, outline: "none", color: T.inkSoft }}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          style={{ border: `1px solid ${T.line}`, borderRadius: 7, padding: "5px 7px", fontSize: 12, fontFamily: FONT_BODY, outline: "none", color: T.inkSoft, background: "#fff" }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <button
        onClick={submit}
        disabled={!title.trim() || saving}
        style={{
          background: T.growth, border: "none", borderRadius: 7, padding: "6px 0", color: "#fff",
          fontSize: 12.5, fontFamily: FONT_BODY, fontWeight: 500, cursor: !title.trim() || saving ? "default" : "pointer",
          opacity: !title.trim() || saving ? 0.6 : 1,
        }}
      >
        {saving ? "Adding…" : "Add task"}
      </button>
    </div>
  );
}
