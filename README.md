# Trio Split

A shared expense & repayment tracker for three people — built with React, TypeScript, Vite, Tailwind, and Zustand.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test            # accounting/settlement unit tests
npm run build        # typecheck + production build
```

By default the app stores everything in your browser's `localStorage` — no setup required.

## Using it from every device

Want the same balances on your phone, laptop, and your friends' phones? See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full step-by-step: pushing to GitHub, setting up a free Supabase project for cross-device sync, and deploying to Vercel.

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
