// Thin client for /api/memory, shared by the chat view and the board view.

export async function fetchMemory() {
  const res = await fetch("/api/memory");
  if (!res.ok) throw new Error("Failed to load saved tasks/notes");
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function postMemoryOps(ops) {
  const res = await fetch("/api/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ops }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to save");
  return {
    items: Array.isArray(data.items) ? data.items : [],
    added: Array.isArray(data.added) ? data.added : [],
  };
}
