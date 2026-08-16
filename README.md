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

If you see "Gemini API error" or "API key not valid", the current key is
expired, revoked, or pasted incorrectly. Create a new key and paste it into
your local `.env.local` file or the Vercel project environment variables.

## 2. Run it locally (optional, to test first)

```bash
npm install
cp .env.local.example .env.local
# paste your key into .env.local
npm run dev
```

Open http://localhost:3000

## 3. Set up a database (for tasks/notes storage)

Tasks and notes are stored in a real Postgres database (via Neon), not
`localStorage`, so they persist across deploys, devices, and browsers.

1. In your Vercel project, go to **Storage → Create Database → Postgres**
   (this provisions a free Neon Postgres database and connects it to your
   project automatically).
2. Vercel will add a `DATABASE_URL` environment variable to your project for
   you — no manual copy/paste needed.
3. Redeploy (or it'll pick it up on the next deploy).

That's it — `pages/api/memory.js` creates the `memory_items` table itself on
first request, so there's no separate migration step.

**Running locally:** after creating the database on Vercel, run
`vercel env pull .env.local` to pull `DATABASE_URL` down locally (this
merges with your existing `.env.local`, so your `GEMINI_API_KEY` stays put).

## 4. Deploy to Vercel

**Option A — via GitHub:**
1. Push this folder to a new GitHub repo (private, per the warning above).
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. In the project's Environment Variables, add:
   - `GEMINI_API_KEY` = your key
4. Deploy, then follow step 3 above to attach a database.

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
- `pages/api/memory.js` — serverless function that reads/writes the
  `memory_items` table in Postgres (via `@neondatabase/serverless`). This is
  the single store for both tasks and notes.
- `components/Companion.jsx` — the chat UI. Talk normally; the AI extracts
  tasks/deadlines/notes, which get saved to the database through
  `pages/api/memory.js`.
- Chat history (just the message log, not tasks/notes) still lives in
  `localStorage` since it's low-stakes and doesn't need to sync.

## Editing your context

Just edit `lib/userProfile.js` whenever something changes — grades, goals,
habits, whatever. It's plain text, no special format needed.
