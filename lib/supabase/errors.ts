/**
 * Rethrow Supabase/PostgREST errors with full message so error boundary can show code/hint.
 * Use after: if (error) throw toSupabaseError(error);
 */
export function toSupabaseError(err: unknown): Error {
  if (err instanceof Error) return err;
  const e = err as { message?: string; code?: string; details?: string; hint?: string };
  const msg = [e?.message, e?.code && `[${e.code}]`, e?.hint && `Hint: ${e.hint}`]
    .filter(Boolean)
    .join(' ');
  const error = new Error(msg || 'Unknown error') as Error & { code?: string; details?: string; hint?: string };
  if (e?.code) error.code = e.code;
  if (e?.details) error.details = e.details;
  if (e?.hint) error.hint = e.hint;
  return error;
}
