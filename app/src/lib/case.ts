// Keep in sync with supabase/functions/_shared/case.ts.
// "AKIN B2B ABS - DERO B2B LATAS - ALPACA" -> "Akin B2B Abs - Dero B2B Latas - Alpaca".
// Only for titles that are mostly capitals (scraped flyers shout); normal titles are untouched.
// Keeps acronyms (DJ, NYC, LA, B2B, R&B, 21+, roman numerals) and words with digits as written.
const KEEP = /^(DJ|DJS|MC|NYC|LA|SF|UK|US|USA|B2B|R&B|EDM|LGBTQ\+?|BYOB|RSVP|VIP|NYE|AM|PM|II|III|IV|TV|BK|LES|UES|UWS|DTLA|WEHO|ID)$/;
const SMALL = /^(a|an|and|at|by|for|in|of|on|or|the|to|vs|w\/|with|x)$/i;

export function calmCaps(title: string) {
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (letters.length < 6 || letters.replace(/[^A-Z]/g, "").length / letters.length < 0.7) return title;
  return title.split(/(\s+)/).map((w, i) => {
    if (/^\s+$/.test(w)) return w;
    const bare = w.replace(/[^A-Za-z0-9&+/]/g, "");
    if (/^\d+(ST|ND|RD|TH)$/.test(bare)) return w.toLowerCase(); // "10TH" -> "10th"
    if (KEEP.test(bare) || /\d/.test(bare)) return w;
    const lower = w.toLowerCase();
    if (i > 0 && SMALL.test(bare)) return lower;
    return lower.replace(/[a-z]/, (c) => c.toUpperCase());
  }).join("");
}

// Scraped fields often repeat each other ("$4 Yuengling Drafts & Shots" as both title and price).
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9$]/g, "");
export const similar = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  let i = 0;
  while (i < x.length && x[i] === y[i]) i++;
  return x.includes(y) || y.includes(x) || i >= 12;
};
