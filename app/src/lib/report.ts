// One place errors are reported from. Today it logs; a crash reporter (e.g. Sentry's
// captureException) plugs in here without touching callers.
export function reportError(err: unknown, context?: Record<string, unknown>) {
  console.error("[scout]", err instanceof Error ? err.message : err, context ?? {});
}
