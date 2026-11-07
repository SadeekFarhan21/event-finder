// Who's going, said the way a friend would: names from your crews first, then everyone else as a
// count. "Maya and you", "Maya, Jo and you · 3 more", "Maya and 1 more", "You and 2 more", or "4 going".
export type CrewPeople = { others: string[]; me: boolean }; // crew members heading to this spot (not dropped out)

export function goingLine(total: number, crew?: CrewPeople): string | null {
  const others = crew?.others ?? [];
  const me = !!crew?.me;
  // Going on your own (no crew yet): say so, as the sheet does ("3 going, including you").
  if (!others.length && me) return total > 1 ? `You and ${total - 1} more` : "You're going";
  if (!others.length) return total > 0 ? `${total} going` : null;
  const named = others.slice(0, 2), hidden = others.length - named.length;
  const people = me ? [...named, "you"] : named;
  const list = people.length === 1 ? people[0] : `${people.slice(0, -1).join(", ")} and ${people[people.length - 1]}`;
  // The going count already includes your crew, so: crew names not shown + everyone outside the crew.
  const strangers = Math.max(0, total - others.length - (me ? 1 : 0));
  const rest = hidden + strangers;
  return rest > 0 ? `${list} · ${rest} more` : list;
}

// A friend's initials for face circles: first letter of each word, at most two ("Maya" M, "Maya Lin" ML).
export const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();

// The crew you're in that leaves soonest within the next 45 minutes, if you haven't set off yet:
// the Crews pill names it ("Nublu in 18 min") so nobody has to open Crews to remember. Up to
// 10 minutes past the leave time it still shows (as "now"): that's when a nudge matters most.
type SoonCrew = { venue: string; leaveAt: string; members: { me: boolean; status: string }[] };
export function leavingSoon<T extends SoonCrew>(crews: T[], now: number, within = 45): { crew: T; mins: number } | null {
  let best: { crew: T; mins: number } | null = null;
  for (const c of crews) {
    if (!c.members.some((m) => m.me && m.status === "in")) continue; // on the way or out: nothing to remind
    const mins = Math.ceil((Date.parse(c.leaveAt) - now) / 60000);
    if (mins < -10 || mins > within) continue;
    if (!best || mins < best.mins) best = { crew: c, mins };
  }
  return best;
}
