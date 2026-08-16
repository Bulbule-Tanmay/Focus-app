# Companion

A private chat companion that remembers your tasks, deadlines, and notes from
natural conversation, and already knows your background context so you don't
have to re-explain yourself every time.

## ⚠️ Before you push this anywhere — read this

`lib/userProfile.js` contains real personal details about you (academics,
health, habits, etc.) in plain text. That file gets committed to your repo
like any other code file.

- **If your GitHub repo is public, that file is public.** Anyone can read it.
- Make the repo **private** on GitHub before pushing, or
- Delete/replace the contents of `lib/userProfile.js` with a placeholder and
  keep your real details somewhere private instead (e.g. paste them into the
  chat itself each session, or load them from a private, non-committed file).

Your `.env.local` (API key) is already excluded via `.gitignore` — that part
is safe by default. The profile file is not, because it needs to ship with
the app to work.

## 1. Get a free Gemini API key

Go to [aistudio.google.com](https://aistudio.google.com), sign in, and
generate an API key. No credit card required.

## 2. Run it locally (optional, to test first)

```bash
npm install
cp .env.local.example .env.local
# paste your key into .env.local
npm run dev
```

Open http://localhost:3000

## 3. Deploy to Vercel

**Option A — via GitHub:**
1. Push this folder to a new GitHub repo (private, per the warning above).
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. In the project's Environment Variables, add:
   - `GEMINI_API_KEY` = your key
4. Deploy.

**Option B — via Vercel CLI (no GitHub needed):**
```bash
npm i -g vercel
vercel
vercel env add GEMINI_API_KEY
vercel --prod
```

## How it works

- `lib/userProfile.js` — your background context, injected into every AI
  request so it already knows your situation.
- `pages/api/chat.js` — serverless function; the only place your API key is
  used, never exposed to the browser.
- `components/Companion.jsx` — the chat UI. Talk normally; the AI extracts
  tasks/deadlines/notes into memory automatically.
- Memory is currently stored in your browser's `localStorage` — private to
  your device, no database needed to get started. If you want it to sync
  across devices, swap this for a real database (Supabase and Vercel KV both
  have free tiers) — ask if you want that wired up.

## Editing your context

Just edit `lib/userProfile.js` whenever something changes — grades, goals,
habits, whatever. It's plain text, no special format needed.
