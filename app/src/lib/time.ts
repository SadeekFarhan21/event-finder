// When a spot happens, in the words a person planning a night out uses.
import type { Spot } from "./types";

type WhenFields = Pick<Spot, "start" | "category" | "title" | "deal">;

// Happy hours and standing specials come back from the agent with whatever date the
// source page had; show them as recurring instead of a one-off time.
const RECURRING = /happy hour|daily|every (day|night)|weekdays?|nightly|all day/i;

export const isRecurring = (e: WhenFields) => e.category === "deal" || RECURRING.test(`${e.title} ${e.deal ?? ""}`);

// Times show in the time zone of the city on the map, not the phone's: someone in New York
// browsing Los Angeles sees LA shows at LA times. ScoutScreen sets it when the city changes.
let ZONE: string | undefined; // undefined = the phone's own zone
export function setCityZone(city: string | null | undefined) {
  ZONE = /los angeles|\bla\b/i.test(city ?? "") ? "America/Los_Angeles" : /new york|nyc/i.test(city ?? "") ? "America/New_York" : undefined;
}
const parts = (t: number) => Object.fromEntries(new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
}).formatToParts(new Date(t)).map((x) => [x.type, x.value])) as Record<string, string>;
// The zone's wall clock read as if it were UTC, minus the real instant: the zone's offset.
const offset = (t: number) => { const p = parts(t); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(t / 6e4) * 6e4; };

// A night out runs until 6am: a 1am set belongs to the evening before, so it reads "Tonight".
// The night's date in the city's zone, as a day number (wall clock, so DST changes are fine).
const nightDay = (t: number) => { const p = parts(t - 6 * 3600e3); return Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5; };

// End of the current night (6am in the city), shared by the "Tonight" filter and the labels.
export const nightEnd = (now = Date.now()) => {
  const wall = (nightDay(now) + 1) * 864e5 + 6 * 3600e3; // 6am the next morning, as wall-clock ms
  return wall - offset(wall);
};

// "Sat " when d falls on another night than tonight (a night runs until 6am), "" when it's tonight:
// leaving at 12:58 AM on a Friday night out reads "at 12:58 AM", not "Sat at 12:58 AM".
export const otherDayPrefix = (d: Date) => (nightDay(d.getTime()) === nightDay(Date.now()) ? "" : `${fmt(d, { weekday: "short" })} `);

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => (o.hour ? d.toLocaleTimeString : d.toLocaleDateString).call(d, undefined, { ...o, timeZone: ZONE });

export function whenLabel(e: WhenFields) {
  if (isRecurring(e)) return /happy hour/i.test(`${e.title} ${e.deal ?? ""}`) ? "Happy hour" : "Recurring deal";
  if (!e.start) return "Ongoing";
  const d = new Date(e.start);
  const days = nightDay(d.getTime()) - nightDay(Date.now());
  const day = days === 0 ? "Tonight" : days === 1 ? "Tomorrow" : fmt(d, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${fmt(d, { hour: "numeric", minute: "2-digit" })}`;
}

// "10 PM", "9:30 PM": whole hours without ":00", the way people say it.
export const clock = (d: Date) => fmt(d, { hour: "numeric", minute: "2-digit" }).replace(":00", "");

// For sentences ("…at Nublu, tonight at 10 PM."): lowercase relative words, proper-case days.
export function whenPhrase(e: WhenFields) {
  if (isRecurring(e)) return /happy hour/i.test(`${e.title} ${e.deal ?? ""}`) ? "during happy hour" : "any night this week";
  if (!e.start) return "this week";
  const d = new Date(e.start);
  const days = nightDay(d.getTime()) - nightDay(Date.now());
  const day = days === 0 ? "tonight" : days === 1 ? "tomorrow" : fmt(d, { weekday: "short", month: "short", day: "numeric" });
  return `${day} at ${clock(d)}`;
}

// "Producer Mondays with Ray Angry & The Council of…": long scraped titles, cut at a word.
export function shortTitle(title: string, max = 48) {
  if (title.length <= max) return title;
  const cut = title.slice(0, max).replace(/\s+\S*$/, "");
  return `${cut}…`;
}
