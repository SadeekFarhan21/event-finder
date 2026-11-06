// The scout function's request contract, validated before anything runs. Every rejection uses
// one shape, { error, code }: `error` is a sentence for people (the app and review page show it),
// `code` is stable for programs.
import { z } from "zod";

// Cities Yelo serves. Public callers (the app's Scout button) can only scout these, so arbitrary
// text never reaches the search agent's prompt. Trusted callers (cron, the owner's key) can try others.
export const SERVED_CITIES = ["New York, NY", "Los Angeles, CA"] as const;

// A city name is letters, spaces and light punctuation, nothing that reads like instructions.
const City = z.string().trim().min(2).max(60).regex(/^[\p{L} .,'-]+$/u, "City names are letters only");

export const ScoutRequest = z.discriminatedUnion("task", [
  z.object({ task: z.literal("events"), city: City, focus: z.number().int().min(0).max(10_000).optional() }),
  z.object({ task: z.literal("rooms"), city: City }),
  z.object({ task: z.literal("publish") }),
  z.object({
    task: z.literal("review"),
    action: z.enum(["list", "approve", "reject"]),
    id: z.number().int().positive().optional(),
    note: z.string().max(300).optional(),
  }),
]);
export type ScoutRequest = z.infer<typeof ScoutRequest>;

export type ErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "CITY_NOT_SERVED" | "RATE_LIMITED" | "BUSY" | "METHOD" | "INTERNAL";

export const errorBody = (code: ErrorCode, message: string) => ({ error: message, code });

// A Zod failure as one readable sentence ("city: City names are letters only").
export const describeIssues = (e: z.ZodError) =>
  e.issues.slice(0, 3).map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
