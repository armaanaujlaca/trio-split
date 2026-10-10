# Deployment Guide

Everything you need to get Trio Split live on the internet, synced across every device, in four steps. Takes about 10–15 minutes.

**End result:** a URL like `https://trio-split.vercel.app` that you, Roohaniat, and Sam can all open on your phones, with the same live balances.

---

## Step 1 — Push the code to GitHub

```bash
git status
```

If you already ran `git init` and made a commit earlier, skip to the `remote add`. Otherwise:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

Now create an empty repo on GitHub:

1. Go to [github.com/new](https://github.com/new)
2. Name it (e.g. `trio-split`)
3. **Do not** check "Add a README" or any other initialize option — you already have files locally
4. Click **Create repository**

GitHub will show you a remote URL. Use it here:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

✅ Checkpoint: refresh the GitHub page, you should see all your files.

---

## Step 2 — Create a free Supabase project (for cross-device sync)

This is what lets every device read/write the same balances instead of each phone having its own separate copy.

1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New Project**
   - Pick any name/region, set a database password (you won't need it again — the app doesn't use it directly), wait ~1 minute for it to provision
2. Open the **SQL Editor** (left sidebar) → **New query** → paste this and click **Run**:

   ```sql
   create table app_state (
     id text primary key,
     data jsonb not null,
     updated_at timestamptz not null default now()
   );

   alter table app_state enable row level security;

   create policy "anon read/write app_state"
     on app_state
     for all
     using (true)
     with check (true);
   ```

3. Go to **Database → Replication** (left sidebar) → find the `app_state` table → toggle it **on**
   (this is what makes changes appear on other devices live, within a second or two, instead of only on next refresh)

4. Go to **Project Settings → Data API** (gear icon, bottom left) and copy two values — you'll need them in Step 3:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`)

✅ Checkpoint: Table Editor (left sidebar) should show your new `app_state` table, currently empty.

> **Security note:** there's no login in this app (matches the original "no auth needed" design), so anyone who has your deployed URL can read/write this data — the anon key isn't a secret, it's meant to be public, and access is controlled by who you share the link with. Fine for a private link between the three of you. If you ever want real access control, add Supabase Auth later.

---

## Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → sign up (free, "Continue with GitHub" is easiest) → **Add New → Project**
2. Import the GitHub repo you pushed in Step 1 — Vercel auto-detects it's a Vite app, no config needed
3. Before clicking Deploy, expand **Environment Variables** and add both:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL from Step 2 |
   | `VITE_SUPABASE_ANON_KEY` | the anon public key from Step 2 |

4. Click **Deploy**. Takes about a minute.

✅ Checkpoint: Vercel gives you a URL like `https://trio-split-xyz.vercel.app`. Open it — you should see the app, and a small **Synced** badge (green cloud icon) in the top-right header, confirming it found Supabase.

From now on, every `git push` to `main` auto-redeploys this URL — you don't need to repeat Step 3.

---

## Step 4 — Verify sync works

1. Open your Vercel URL on your laptop and your phone (or two browser tabs) side by side
2. Add an expense on one
3. Within a couple seconds it should appear on the other, and the "Synced" badge should flash briefly on both

If that works, send the same URL to Roohaniat and Sam — all three of you are now looking at the same shared ledger.

---

## Troubleshooting

**Badge says "Offline" or "Sync error" instead of "Synced"**
- Double-check the two env var values in Vercel (Project Settings → Environment Variables) exactly match what Supabase showed you — a trailing space or truncated key is the usual culprit
- After changing env vars in Vercel, you must **redeploy** (Vercel → Deployments → ⋯ → Redeploy) — they only take effect on the next build
- Confirm Step 2.3 (Replication toggle) is actually on

**No badge appears at all**
- Means the app thinks Supabase isn't configured — the env vars weren't picked up at build time. Re-check spelling (`VITE_SUPABASE_URL`, not `SUPABASE_URL`) and redeploy

**Build fails on Vercel**
- Run `npm run build` locally first — if it fails locally too, fix that first and push again
- Check the Vercel build log for the actual TypeScript/Vite error

**I want to test Supabase sync locally before deploying**
```bash
cp .env.example .env
# paste your two values into .env
npm run dev
```

---

## Reference

| File | Purpose |
|---|---|
| `.env.example` | Template for the two Supabase env vars — copy to `.env` for local testing |
| `src/lib/supabase.ts` | Creates the Supabase client (no-ops if env vars are missing) |
| `src/lib/sync.ts` | Push / pull / merge / realtime subscription logic |
| `src/store/useStore.ts` | Wires sync into every state-changing action |

See [README.md](README.md) for local development, architecture, and the full data-safety explanation.
