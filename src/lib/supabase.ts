import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True once both env vars are set — lets the app run fully offline-only otherwise. */
export const supabaseEnabled = Boolean(url && anonKey);

export const supabase = supabaseEnabled ? createClient(url!, anonKey!) : null;

/**
 * All three of you share one row, identified by this id. Override it via
 * VITE_HOUSEHOLD_ID if you ever want to point separate groups at the same
 * Supabase project.
 */
export const HOUSEHOLD_ID = (import.meta.env.VITE_HOUSEHOLD_ID as string | undefined) || 'default';
