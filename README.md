# Trio Split

A shared expense & repayment tracker for three people — built with React, TypeScript, Vite, Tailwind, and Zustand.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test            # accounting/settlement unit tests
npm run build        # typecheck + production build
```

By default the app stores everything in your browser's `localStorage` — no setup required. To access the same data from every device (phone, laptop, etc.), set up the optional Supabase sync below.

## Cross-device sync (optional but recommended)

The app can sync its data to a free [Supabase](https://supabase.com) project. Without this, data only lives in the browser that created it — see **Data safety**, below.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign up (free), and create a new project.
2. Open the **SQL Editor** and run:

   ```sql
   create table app_state (
     id text primary key,
     data jsonb not null,
     updated_at timestamptz not null default now()
   );

   alter table app_state enable row level security;

   -- No login system in this app (matches the original "no auth needed" design),
   -- so anyone holding the anon key below can read/write this one row. That's
   -- fine for a private household tracker; see the security note further down
   -- if you want to lock it down further.
   create policy "anon read/write app_state"
     on app_state
     for all
     using (true)
     with check (true);
   ```
3. Go to **Project Settings → Data API** (or **API** on older projects) and copy:
   - **Project URL**
   - **anon public** key

### 2. Enable Realtime on the table

**Database → Replication** → turn on replication for the `app_state` table (so edits made on one device show up live on the others).

### 3. Configure the app

Copy `.env.example` to `.env` and fill in the two values:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Restart `npm run dev` (or rebuild). A small sync badge appears in the header (Syncing… / Synced / Offline / Sync error) once this is configured.

That's it — every device that loads the app with these same two values will read and write the same shared balances in real time.

## Deploying so you can use it from your phone

This is a static site (no backend needed — Supabase handles persistence directly from the browser), so any static host works. **Vercel** is the easiest path from a GitHub repo:

1. Push this repo to GitHub (see below).
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo. It auto-detects Vite; no config needed.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as your `.env`).
4. Deploy. You'll get a `https://your-app.vercel.app` URL — open it on any phone/laptop and you're looking at the same live data.

Every `git push` to your main branch auto-redeploys.

**Alternative: GitHub Pages.** Works too, but since Pages serves a fixed sub-path (`username.github.io/repo-name/`), you'd need to set `base: '/repo-name/'` in `vite.config.ts` and add a GitHub Actions workflow to build and publish `dist/`. Vercel/Netlify skip all of that, which is why it's the recommended path above.

### Pushing this repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

(Create the empty repo on GitHub first — github.com → New repository — then use the URL it gives you above.)

## Data safety

- **Without Supabase configured:** data lives only in that browser's `localStorage`. It survives refreshes but not clearing browsing data, a different browser, or a different device. Use **Settings → Export Data (JSON)** periodically as a backup regardless.
- **With Supabase configured:** every device pushes/pulls the same row in your Supabase project, with realtime updates so changes appear on other open devices within a second or two. `localStorage` is still used as an instant local cache and offline fallback — if you lose internet, your edits queue locally and sync automatically once you're back online.
- **Conflict handling:** if two devices save at almost the exact same moment, the app detects the clash (optimistic concurrency check against Supabase) and merges both sets of changes rather than letting one silently overwrite the other. The one edge case this doesn't fully solve: if a transaction is *deleted* on one device while another device (that still has it locally) is offline and then reconnects, the deleted item can reappear. This is rare for casual day-to-day use; if it ever matters, the fix is moving from one shared JSON blob to one Supabase row per transaction — a bigger change that can be done later if needed.
- **Security note:** this app still has no login (by original design), so the Supabase anon key embedded in the deployed site lets anyone who finds your URL read and write your group's data. Fine for a private link shared only with your two friends; if you want real access control later, add Supabase Auth (email/magic-link) and tighten the row-level-security policy to check `auth.uid()`.

## Architecture

- `src/lib/accounting.ts` / `src/lib/settlement.ts` — pure, framework-free balance & debt-simplification logic (unit tested in `src/lib/__tests__`).
- `src/lib/storage.ts` — localStorage read/write + migration of older data shapes.
- `src/lib/supabase.ts` / `src/lib/sync.ts` — optional Supabase client, push/pull/merge/realtime subscription.
- `src/store/useStore.ts` — Zustand store wiring state, undo history, trash, and sync together.
- `src/components/screens/*` — Dashboard, History, Statistics, Settings.
- `src/components/forms/*` — Expense and Repayment forms (multi-payer support, equal/custom splits).
