// One place errors are reported from. Today it logs; a crash reporter (e.g. Sentry's
// captureException) plugs in here without touching callers.
export function reportError(err: unknown, context?: Record<string, unknown>) {
  console.error("[scout]", err instanceof Error ? err.message : err, context ?? {});
}

// A sentence a person can read: drop "TimeoutError:"-style prefixes and raw technical messages.
export function friendlyError(err: unknown, fallback: string) {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).replace(/^\w*Error:\s*/, "").trim();
  if (!msg || /fetch|network request|json|undefined|null|status \d|code \d|PGRST|supabase/i.test(msg)) return fallback;
  return msg;
}
