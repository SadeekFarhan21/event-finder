// The text that leaves the app (shared spots, crew invites): what it says about the night.
import { calmCaps } from "./case";
import { shortTitle } from "./time";

// What a shared message says about the night: the title in calm caps, cut at a word, or nothing
// when it would only repeat the venue or the time ("Come to Nublu tonight at 8 PM: Nublu.").
export function inviteBill(title: string, venue: string) {
  const bare = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = calmCaps(title.trim());
  if (!bare(t) || bare(t) === bare(venue) || /^(happy hour|daily specials?|specials?)$/i.test(t)) return "";
  return shortTitle(t);
}

// "Nublu tonight at 8 PM: Jazz Night." Ends with one mark, never "….".
export const withBill = (head: string, bill: string) => (bill ? `${head}: ${bill}${bill.endsWith("…") ? "" : "."}` : `${head}.`);
