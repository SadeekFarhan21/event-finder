// "Add to calendar" without a native module: Google Calendar's new-event link, filled in.
// Dated events only; the end is the start + 3 hours (listings rarely give one).
import type { Spot } from "./types";

const stamp = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function calendarUrl(e: Pick<Spot, "venue" | "title" | "start" | "address" | "url">): string | null {
  if (!e.start) return null;
  const from = Date.parse(e.start);
  if (Number.isNaN(from)) return null;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${e.title} at ${e.venue}`,
    dates: `${stamp(from)}/${stamp(from + 3 * 3600e3)}`,
    location: `${e.venue}, ${e.address}`,
    details: e.url ? `Found on Scout. ${e.url}` : "Found on Scout.",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
