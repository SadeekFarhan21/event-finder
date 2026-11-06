// Structured logs: one JSON object per line, so Supabase's log explorer (or any drain) can
// filter by event, run id, city or error code instead of grepping prose.
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function log(event: string, fields: LogFields = {}, level: "info" | "warn" | "error" = "info") {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

// The agents take a plain `(msg) => void` logger; this adapts it to structured lines for one run.
export const agentLogger = (runId: number, task: string) => (msg: string) => log("agent", { runId, task, msg });
