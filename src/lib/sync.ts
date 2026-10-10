import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppState, Transaction } from '../types';
import { HOUSEHOLD_ID, supabase, supabaseEnabled } from './supabase';

interface RemoteRow {
  data: AppState;
  updatedAt: string;
}

export { supabaseEnabled };

export async function fetchRemoteState(): Promise<RemoteRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_state')
    .select('data, updated_at')
    .eq('id', HOUSEHOLD_ID)
    .maybeSingle();
  if (error || !data) return null;
  return { data: data.data as AppState, updatedAt: data.updated_at as string };
}

export type PushResult =
  | { ok: true; updatedAt: string }
  | { ok: false; reason: 'conflict' | 'error' };

/**
 * Push local state to Supabase. When `lastKnownUpdatedAt` is provided, this
 * is a conditional update: it only succeeds if nobody else has written to
 * the row since we last saw it. That stops two devices saving at the same
 * moment from silently clobbering each other — a failed push comes back as
 * `{ ok: false, reason: 'conflict' }` so the caller can merge and retry
 * instead of overwriting someone else's change.
 */
export async function pushRemoteState(
  state: AppState,
  lastKnownUpdatedAt: string | null,
): Promise<PushResult> {
  if (!supabase) return { ok: false, reason: 'error' };
  const nowIso = new Date().toISOString();

  if (lastKnownUpdatedAt) {
    const { data, error } = await supabase
      .from('app_state')
      .update({ data: state, updated_at: nowIso })
      .eq('id', HOUSEHOLD_ID)
      .eq('updated_at', lastKnownUpdatedAt)
      .select('updated_at');
    if (error) return { ok: false, reason: 'error' };
    if (data && data.length > 0) return { ok: true, updatedAt: nowIso };
    return { ok: false, reason: 'conflict' };
  }

  const { error } = await supabase
    .from('app_state')
    .upsert({ id: HOUSEHOLD_ID, data: state, updated_at: nowIso });
  if (error) return { ok: false, reason: 'error' };
  return { ok: true, updatedAt: nowIso };
}

/**
 * Merge two versions of the shared state after a write conflict.
 * Transactions are unioned by id (local wins if the same id was edited on
 * both sides); people/categories/settings prefer local, since those are
 * rare, deliberate edits. This recovers cleanly from the common case —
 * two people adding different expenses within the same second — without
 * losing either one.
 */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const byId = new Map<string, Transaction>();
  for (const t of remote.transactions) byId.set(t.id, t);
  for (const t of local.transactions) byId.set(t.id, t); // local wins on id collision
  const transactions = [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);

  const categories = [...new Set([...remote.categories, ...local.categories])];

  return {
    people: local.people,
    transactions,
    categories,
    settings: local.settings,
  };
}

export function subscribeRemoteState(
  onChange: (row: RemoteRow) => void,
): () => void {
  if (!supabase) return () => {};
  let channel: RealtimeChannel | null = supabase
    .channel(`app_state:${HOUSEHOLD_ID}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_state', filter: `id=eq.${HOUSEHOLD_ID}` },
      (payload) => {
        const row = payload.new as { data?: AppState; updated_at?: string } | null;
        if (row?.data && row.updated_at) {
          onChange({ data: row.data, updatedAt: row.updated_at });
        }
      },
    )
    .subscribe();

  return () => {
    if (channel) {
      supabase?.removeChannel(channel);
      channel = null;
    }
  };
}
