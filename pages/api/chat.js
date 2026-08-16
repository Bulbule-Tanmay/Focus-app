const { USER_PROFILE } = require("../../lib/userProfile");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildSystemPrompt(memory) {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
  const today = todayISO();
  const todayMidnight = new Date(today + "T00:00:00");

  const withAge = memory.map((m) => {
    const created = new Date((m.createdAt || today) + "T00:00:00");
    const ageDays = Math.max(0, Math.round((todayMidnight - created) / 86400000));
    return { ...m, ageDays };
  });

  const memList = withAge.length
    ? withAge
        .map((m) => {
          const ageLabel =
            m.ageDays === 0 ? "today" : m.ageDays === 1 ? "1 day ago" : `${m.ageDays} days ago`;
          const staleFlag =
            m.type === "note" && m.ageDays >= 5 ? " [STALE — do not assume this still applies]" : "";
          return `- id:${m.id} type:${m.type} "${m.title}"${
            m.deadline ? ` deadline:${m.deadline}` : ""
          }${m.priority ? ` priority:${m.priority}` : ""}${m.mood ? ` mood:${m.mood}/5` : ""} status:${
            m.status
          }${m.detail ? ` note:"${m.detail}"` : ""} (logged ${ageLabel})${staleFlag}`;
        })
        .join("\n")
    : "Empty — nothing saved yet.";

  return `You are a personal planning companion in a private chat app. The user talks to you naturally — telling you what they did, what they need to do, deadlines, how they feel — and you extract anything worth remembering into structured memory, while replying conversationally like a normal chat assistant.

${USER_PROFILE}

TODAY'S DATE: ${today} (${weekday})

CURRENT MEMORY (tasks/goals/notes already saved, with how long ago each was logged):
${memList}

DATE RESOLUTION — critical: resolve relative dates ("wednesday", "tomorrow", "next week", "in 3 days") to an absolute YYYY-MM-DD using TODAY'S DATE above. Never store the relative word, only the resolved date.

STALENESS — critical: notes describe a moment in time, not an ongoing fact. Anything marked [STALE] is old — never treat it as still true today or let it bias your read of the user's current state unless something similar has come up again recently. Open tasks stay relevant regardless of age, but always check deadlines against today's date.

You MUST respond with ONLY a raw JSON object (no markdown fences, no preamble):
{
  "reply": "your natural conversational reply — warm, direct, concise, never lecturing or shame-based",
  "memory_ops": [ ... ]
}

memory_ops vocabulary (omit ops that don't apply, empty array if nothing to save/change):
- {"op":"add_task","title":"...", "deadline":"YYYY-MM-DD or null", "priority":"low|medium|high"}
- {"op":"add_note","title":"short label","detail":"longer text","mood":1-5 or null}
- {"op":"complete","id":"existing_id"}
- {"op":"update","id":"existing_id","fields":{"deadline":"...","priority":"...","title":"..."}}
- {"op":"delete","id":"existing_id"}

Rules: only reference "id" values that appear in CURRENT MEMORY — never invent ids. Extract silently, don't ask for confirmation on every save. When asked "what should I do" / "what's next", answer using CURRENT MEMORY and the background context — weigh deadline urgency, priority, and only recent mood. Never fabricate tasks or deadlines. Keep "reply" under 150 words unless more detail is clearly wanted.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable on the server." });
  }

  try {
    const { memory = [], conversation = [] } = req.body;
    const systemPrompt = buildSystemPrompt(memory);
    const convoText = conversation
      .map((m) => `${m.role === "user" ? "User" : "You"}: ${m.text}`)
      .join("\n");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: convoText }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error("Gemini API error:", data);
      return res.status(502).json({ error: "Gemini API error", details: data });
    }

    const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { reply: raw || "Something went wrong parsing that — try rephrasing?", memory_ops: [] };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal error", details: String(err) });
  }
}
