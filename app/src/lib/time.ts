// When a spot happens, in the words a person planning a night out uses.
import type { Spot } from "./types";

type WhenFields = Pick<Spot, "start" | "category" | "title" | "deal">;

// Happy hours and standing specials come back from the agent with whatever date the
// source page had; show them as recurring instead of a one-off time.
const RECURRING = /happy hour|daily|every (day|night)|weekdays?|nightly|all day/i;

export const isRecurring = (e: WhenFields) => e.category === "deal" || RECURRING.test(`${e.title} ${e.deal ?? ""}`);

// A night out runs until 6am: a 1am set belongs to the evening before, so it reads "Tonight".
// Local midnight of the night that time t belongs to. Wall-clock arithmetic (not fixed ms)
// so the 6am boundary holds across daylight-saving changes.
const nightDay = (t: number) => {
  const d = new Date(t);
  d.setHours(d.getHours() - 6, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d;
};

// End of the current night (6am), shared by the "Tonight" filter and the labels.
export const nightEnd = (now = Date.now()) => nightDay(now).setHours(30, 0, 0, 0);

export function whenLabel(e: WhenFields) {
  if (isRecurring(e)) return /happy hour/i.test(`${e.title} ${e.deal ?? ""}`) ? "Happy hour" : "Recurring deal";
  if (!e.start) return "Ongoing";
  const d = new Date(e.start);
  const days = Math.round((nightDay(d.getTime()).getTime() - nightDay(Date.now()).getTime()) / 864e5);
  const day = days === 0 ? "Tonight" : days === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// "10 PM", "9:30 PM": whole hours without ":00", the way people say it.
export const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(":00", "");

// For sentences ("…at Nublu, tonight at 10 PM."): lowercase relative words, proper-case days.
export function whenPhrase(e: WhenFields) {
  if (isRecurring(e)) return /happy hour/i.test(`${e.title} ${e.deal ?? ""}`) ? "during happy hour" : "any night this week";
  if (!e.start) return "this week";
  const d = new Date(e.start);
  const days = Math.round((nightDay(d.getTime()).getTime() - nightDay(Date.now()).getTime()) / 864e5);
  const day = days === 0 ? "tonight" : days === 1 ? "tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} at ${clock(d)}`;
}
