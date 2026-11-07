// "Rooms": venue leads for Yelo's partner team.
// Yelo's model (joinyelo.com/partner): pick a venue's quiet night, build an event there,
// fill it with Yelo riders. This agent finds rooms that fit that playbook.
import type { AgentDeps } from "./deps.ts";
import { cleanVenue } from "./clean.ts";
import { PARTNERS, isPartner } from "./partners.ts";

export type Lead = {
  id: string;
  venue: string;
  area: string;
  address: string;
  kind: string; // bar, lounge, gallery, music venue...
  capacity: string | null;
  fit: string; // why it's a good Yelo room
  quietNight: string | null; // a night that likely runs slow
  contact: string | null; // booking email/page or Instagram
  url: string | null;
  city: string;
  confidence: "low" | "medium" | "high";
  foundAt: string;
};

// 9 fields + the array = Exa's 10-property cap for /search output schemas.
const LEAD_SCHEMA = {
  type: "object",
  properties: {
    leads: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          venue: { type: "string", description: "Short venue name as on its sign" },
          area: { type: "string", description: "Neighborhood" },
          address: { type: "string" },
          kind: { type: "string", description: "e.g. cocktail bar, dive bar, lounge, gallery, small music venue" },
          capacity: { type: "string", description: "Max standing capacity as a number, else empty" },
          fit: { type: "string", description: "One sentence, under 110 characters, on why it suits a student/20s themed night" },
          quietNight: { type: "string", description: "Just the weekday name with no regular programming on its calendar, else empty" },
          contact: { type: "string", description: "One value: booking email, else Instagram handle, else private-events URL" },
          url: { type: "string", description: "Venue website or events page" },
        },
        required: ["venue", "area", "address", "kind", "fit"],
      },
    },
  },
  required: ["leads"],
};

function queriesFor(city: string) {
  return [
    `Bars and lounges in ${city} that host private events, DJ nights or pop-ups and book outside promoters`,
    `Small music venues and event spaces in ${city} under 300 capacity popular with college students and 20-somethings`,
    `Neighborhood bars near universities in ${city} with event space, a sound system, and slow weeknights`,
  ];
}

// The agent writes paragraphs; cards need one value each.
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// "Tuesday (regular programming is Wednesday game night...)" -> "Tuesday"
// "Wednesday or Thursday (weeknight buyouts...)" -> "Wed or Thu"
export function shortNight(s?: string | null) {
  if (!s) return null;
  const head = s.split("(")[0];
  const found = DAYS.filter((day) => new RegExp(`\\b${day}`, "i").test(head));
  if (!found.length) return null;
  return found.length === 1 ? found[0] : found.slice(0, 2).map((x) => x.slice(0, 3)).join(" or ");
}

// "Full buyout 220 guests; partial buyout 100 guests" -> "Up to 220"
export function shortCapacity(s?: string | null) {
  const nums = (s ?? "").match(/\d{2,4}/g)?.map(Number).filter((n) => n >= 20 && n <= 5000);
  return nums?.length ? `Up to ${Math.max(...nums)}` : null;
}

// Yelo's brief: independent rooms for 50-400 people. A known capacity outside that is the wrong
// room for a Yelo night (Echoplex holds 780); an unknown one stays, the team can ask.
export function inBrief(capacity?: string | null) {
  const n = Number((capacity ?? "").match(/\d+/)?.[0]);
  return !n || (n >= 50 && n <= 400);
}

// Prefer an email, then an Instagram handle, then a URL.
export function shortContact(s?: string | null) {
  if (!s) return null;
  const email = s.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  if (email) return email.replace(/[.;,]+$/, "");
  const ig = s.match(/(^|\s)@([\w.]{2,30})/)?.[2];
  if (ig) return `@${ig}`;
  const url = s.match(/(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/[^\s;,)]*)?/)?.[0];
  return url ? (url.startsWith("http") ? url : `https://${url}`) : null;
}

export function tidyLead(l: Lead): Lead {
  return {
    ...l,
    area: l.area.split("/")[0].split(",")[0].trim(),
    kind: shortKind(l.kind),
    capacity: shortCapacity(l.capacity),
    quietNight: shortNight(l.quietNight),
    contact: shortContact(l.contact),
    // First clause only: before a ";" or "(e.g." aside, else the first real sentence.
    fit: l.fit.split(/;|\s\((?:e\.g\.|incl)/i)[0].split(/(?<=[a-z]{3}\.)\s/)[0].replace(/[,\s]+$/, "").trim(),
  };
}

export async function findLeads(city: string, { exa, log = () => {} }: Pick<AgentDeps, "exa" | "log">): Promise<Lead[]> {
  const now = new Date().toISOString();
  const systemPrompt = [
    `Find real, currently operating venues in ${city} that could host a recurring themed night`,
    `(DJ night, live band, jazz night, gallery party) promoted to a student and 20s audience.`,
    `Prefer independent rooms with 50-400 capacity and an events or private-hire page. Skip chains, restaurants`,
    `without a bar or event space, large arenas, and these existing partners: ${PARTNERS.map((p) => p.name).join(", ")}.`,
  ].join(" ");

  const runs = await Promise.allSettled(
    queriesFor(city).map(async (query, i) => {
      await new Promise((r) => setTimeout(r, i * 700));
      log(`exa: ${query}`);
      const res = await exa.search(query, { type: "deep", numResults: 10, systemPrompt, outputSchema: LEAD_SCHEMA });
      const content = res.output?.content;
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      const rows: Record<string, string>[] = Array.isArray(parsed?.leads) ? parsed.leads : [];
      const grounding = res.output?.grounding ?? [];
      const rank = { low: 0, medium: 1, high: 2 } as const;
      return rows.map((r, j): Record<string, string> & { confidence: Lead["confidence"] } => {
        const g = grounding.filter((x) => x.field.startsWith(`leads[${j}]`));
        const confidence = g.length
          ? g.reduce((m, x) => (rank[x.confidence] < rank[m] ? x.confidence : m), "high" as Lead["confidence"])
          : "medium";
        return { ...r, url: r.url || g.flatMap((x) => x.citations)[0]?.url || "", confidence };
      });
    }),
  );

  const seen = new Set<string>();
  const out: Lead[] = [];
  for (const r of runs.flatMap((x) => (x.status === "fulfilled" ? x.value : (log(`exa error: ${x.reason}`), [])))) {
    if (!r.venue || !r.address || isPartner(r.venue)) continue;
    const venue = cleanVenue(r.venue);
    const key = venue.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const lead = tidyLead({
      id: `${city}-${key}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      venue,
      area: (r.area ?? "").replace(/\s*\([^)]*\)/g, "").trim(), // "Manhattan (Hart Bar location)" -> "Manhattan"
      address: r.address,
      kind: r.kind ?? "",
      capacity: r.capacity || null,
      fit: r.fit ?? "",
      quietNight: r.quietNight || null,
      contact: r.contact || null,
      url: r.url || null,
      city,
      confidence: r.confidence as Lead["confidence"],
      foundAt: now,
    });
    if (inBrief(lead.capacity)) out.push(lead);
  }
  log(`${out.length} room leads`);
  return out;
}

// A room's type should read like "Cocktail bar", not a description the model wrote
// ("Old East Coast study/pub-themed bar"). Trimming a description into a type gives nonsense,
// so keep it only when it is already short; otherwise show no type rather than a cut-off one.
export function shortKind(kind: string) {
  const k = kind.split("(")[0].split(/\s+with\s+/i)[0].trim();
  return k.split(/\s+/).length <= 3 && k.length <= 22 && !/[\/–—]/.test(k) ? k : "";
}
