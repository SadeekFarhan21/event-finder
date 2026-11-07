// Who's going, said the way a friend would: names from your crews first, then everyone else as a
// count. "Maya and you", "Maya, Jo and you · 3 more", "Maya and 1 more", or "4 going" with no crew.
export type CrewPeople = { others: string[]; me: boolean }; // crew members heading to this spot (not dropped out)

export function goingLine(total: number, crew?: CrewPeople): string | null {
  const others = crew?.others ?? [];
  const me = !!crew?.me;
  if (!others.length) return total > 0 ? `${total} going` : null;
  const named = others.slice(0, 2), hidden = others.length - named.length;
  const people = me ? [...named, "you"] : named;
  const list = people.length === 1 ? people[0] : `${people.slice(0, -1).join(", ")} and ${people[people.length - 1]}`;
  // The going count already includes your crew, so: crew names not shown + everyone outside the crew.
  const strangers = Math.max(0, total - others.length - (me ? 1 : 0));
  const rest = hidden + strangers;
  return rest > 0 ? `${list} · ${rest} more` : list;
}
