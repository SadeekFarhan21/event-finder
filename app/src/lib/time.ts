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

// The hour (0-23) on the city's clock.
export const cityHour = (t: number) => +parts(t).hour;

// A night out runs until 6am: a 1am set belongs to the evening before, so it reads "Tonight".
// The night's date in the city's zone, as a day number (wall clock, so DST changes are fine).
const nightDay = (t: number) => { const p = parts(t - 6 * 3600e3); return Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5; };

// How many nights ahead t is (0 = tonight), and that night's weekday (0 Sun ... 6 Sat), in the city.
export const nightOffset = (t: number, now = Date.now()) => nightDay(t) - nightDay(now);
export const nightWeekday = (t: number) => new Date(nightDay(t) * 864e5).getUTCDay();

// End of the current night (6am in the city), shared by the "Tonight" filter and the labels.
export const nightEnd = (now = Date.now()) => {
  const wall = (nightDay(now) + 1) * 864e5 + 6 * 3600e3; // 6am the next morning, as wall-clock ms
  return wall - offset(wall);
};

// "Sat " when d falls on another night than tonight (a night runs until 6am), "" when it's tonight:
// leaving at 12:58 AM on a Friday night out reads "at 12:58 AM", not "Sat at 12:58 AM".
export const otherDayPrefix = (d: Date) => (nightDay(d.getTime()) === nightDay(Date.now()) ? "" : `${fmt(d, { weekday: "short" })} `);

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => (o.hour ? d.toLocaleTimeString : d.toLocaleDateString).call(d, undefined, { ...o, timeZone: ZONE });

// "Tonight" for the evening, "Today" for daytime starts (a 10 AM flea market isn't tonight).
// A start between 6 AM and 5 PM in the city reads Today; after midnight still belongs to tonight.
const todayWord = (d: Date) => { const h = +parts(d.getTime()).hour; return h >= 6 && h < 17 ? "Today" : "Tonight"; };
// The same word for right now, in the city on the map: the first filter chip reads Today until 5 PM.
export const nowWord = () => todayWord(new Date());

// A standing deal's daily hours from its own text ("Happy Hour 3-7pm", "4 to 6:30 PM"), as minutes
// after midnight. Never guessed: no stated hours, no status.
export function dealHours(text: string): { from: number; to: number } | null {
  const m = text.match(/\b(\d{1,2})(?::(\d\d))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d\d))?\s*(am|pm)\b/i);
  if (!m) return null;
  const toMin = (h: string, mm: string | undefined, ap: string) => ((+h % 12) + (/pm/i.test(ap) ? 12 : 0)) * 60 + (+(mm ?? 0));
  const to = toMin(m[4], m[5], m[6]);
  // "3-7pm": the start shares the end's am/pm unless that would put it after the end ("11-2am").
  let from = toMin(m[1], m[2], m[3] ?? m[6]);
  if (!m[3] && from > to) from = toMin(m[1], m[2], /pm/i.test(m[6]) ? "am" : "pm");
  return { from, to };
}

// "On until 7 PM" while a happy hour is running, "From 3 PM" before it starts, null after or unknown.
export function dealStatus(e: Pick<WhenFields, "title" | "deal">, now = Date.now()): string | null {
  const h = dealHours(`${e.deal ?? ""} ${e.title}`);
  if (!h) return null;
  const p = parts(now), mins = +p.hour * 60 + +p.minute;
  const on = h.to > h.from ? mins >= h.from && mins < h.to : mins >= h.from || mins < h.to; // "11-2am" crosses midnight
  if (on) return `On until ${sayUTC(h.to)}`;
  if (mins < h.from) return `From ${sayUTC(h.from)}`;
  return null;
  function sayUTC(m: number) { const hh = Math.floor(m / 60) % 24, mm = m % 60; return `${hh % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${hh < 12 ? "AM" : "PM"}`; }
}

// For ordering standing deals: running now (0), starting later today (1, by start), over or no hours (2).
export function dealRank(e: Pick<WhenFields, "title" | "deal">, now = Date.now()): number {
  const h = dealHours(`${e.deal ?? ""} ${e.title}`);
  if (!h) return 3000;
  const p = parts(now), mins = +p.hour * 60 + +p.minute;
  const on = h.to > h.from ? mins >= h.from && mins < h.to : mins >= h.from || mins < h.to;
  if (on) return 0;
  return mins < h.from ? 1 + h.from : 3000;
}

export function whenLabel(e: WhenFields) {
  if (isRecurring(e)) {
    const base = /happy hour/i.test(`${e.title} ${e.deal ?? ""}`) ? "Happy hour" : "Recurring deal";
    const st = dealStatus(e);
    return st ? `${base} · ${st.replace(/^On /, "").replace(/^From/, "from")}` : base; // "Happy hour · until 7 PM" / "· From 3 PM"
  }
  if (!e.start) return "Ongoing";
  const d = new Date(e.start);
  const days = nightDay(d.getTime()) - nightDay(Date.now());
  // Already under way: say so, rather than "Tonight" for a set that began hours ago.
  const day = d.getTime() <= Date.now() ? "Started" : days === 0 ? todayWord(d) : days === 1 ? "Tomorrow" : fmt(d, { weekday: "short", month: "short", day: "numeric" });
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
  const day = days === 0 ? todayWord(d).toLowerCase() : days === 1 ? "tomorrow" : fmt(d, { weekday: "short", month: "short", day: "numeric" });
  return `${day} at ${clock(d)}`;
}

// "Producer Mondays with Ray Angry & The Council of…": long scraped titles, cut at a word.
export function shortTitle(title: string, max = 48) {
  if (title.length <= max) return title;
  // Cut at a word, and never end on a joiner: "Latin &…" or "Night –…" reads broken.
  const cut = title.slice(0, max).replace(/\s+\S*$/, "").replace(/[\s&+–—\-,:;·/|]+$/, "");
  return `${cut}…`;
}
