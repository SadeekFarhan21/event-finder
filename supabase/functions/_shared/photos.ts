// A photo for a spot from its own event page: the og:image / twitter:image a page sets for link
// previews. Most listings arrive without one, and the app's cards are photo-first.
//
// This fetches URLs that came from the web, so it's careful about where it goes: public https
// hosts only (no IP literals, no localhost / internal names), every hostname resolved and every
// address checked against private ranges, redirects followed by hand with the same checks on each
// hop, a short timeout, and at most the first 256 KB of HTML read.

export const NOT_A_PHOTO = /logo|favicon|icon|avatar|placeholder|default[-_]?(image|og)|sprite|blank|\.svg(\?|$)/i;
// A site's one-size-fits-all link preview ("/brand/share/home.jpg", "fan-social.png"), not this place.
const SITE_CARD = /(^|[\/_.-])(share|sharing|social|og[-_]?default|opengraph[-_]?default)([\/_.-]|$)|\/brand\//i;

const MAX_BYTES = 256 * 1024;

// A page's preview photo only stands for a spot when the page is about that venue: a word from
// the venue's name (4+ letters, not a generic word) appears in the page's host or path. A
// "best live music this weekend" roundup leads with some other show's photo; that must not be
// shown as this venue.
const GENERIC = new Set(["the", "bar", "club", "room", "hall", "house", "lounge", "cafe", "gallery", "studio", "new", "york", "theater", "theatre", "music", "brooklyn", "manhattan", "angeles"]);
export function pageAboutVenue(pageUrl: string | null | undefined, venue: string): boolean {
  if (!pageUrl) return false;
  let u: URL;
  try { u = new URL(pageUrl); } catch { return false; }
  const hay = (u.hostname + u.pathname).toLowerCase().replace(/[^a-z0-9]/g, "");
  const words = venue.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !GENERIC.has(w));
  return words.some((w) => hay.includes(w));
}

export function isPublicHttps(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return null; // IP literals (v4 / v6)
  return u;
}

// Pull the preview image out of a page's <head>. Pure, so it's unit-tested without the network.
export function ogImageFrom(html: string, pageUrl: string): string | null {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const key of ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) {
    for (const tag of metas) {
      const name = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
      if (name !== key) continue;
      const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.trim().replace(/&amp;/g, "&");
      if (!content) continue;
      let abs: string;
      try { abs = new URL(content, pageUrl).toString(); } catch { continue; }
      if (NOT_A_PHOTO.test(abs) || SITE_CARD.test(new URL(abs).pathname) || !isPublicHttps(abs)) continue;
      return abs;
    }
  }
  return null;
}

// Addresses a fetch must never reach: loopback, private (RFC1918 / ULA), link-local (incl. the
// cloud metadata service at 169.254.169.254), CGNAT, "this network", multicast and reserved.
export function isPrivateAddress(ip: string): boolean {
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return isPrivateAddress(mapped[1]);
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

export type Resolver = (host: string) => Promise<string[]>;

// Every A/AAAA record must be public. No records, or a lookup we can't do, fails closed.
const denoResolver: Resolver = async (host) => {
  const all = await Promise.all((["A", "AAAA"] as const).map((t) => Deno.resolveDns(host, t).catch(() => [] as string[])));
  return all.flat();
};

export async function isSafeTarget(raw: string, resolve: Resolver = denoResolver): Promise<URL | null> {
  const u = isPublicHttps(raw);
  if (!u) return null;
  const addrs = await resolve(u.hostname).catch(() => []);
  return addrs.length && addrs.every((a) => !isPrivateAddress(a)) ? u : null;
}

export async function findPagePhoto(pageUrl: string, timeoutMs = 4000, resolve: Resolver = denoResolver): Promise<string | null> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    // Follow redirects ourselves, re-checking every hop before requesting it, so a public page
    // can't bounce the fetch to an internal address.
    let url = pageUrl;
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      const target = await isSafeTarget(url, resolve);
      if (!target) return null;
      res = await fetch(target, {
        redirect: "manual", signal,
        headers: { "User-Agent": "scout-yelo-prototype/0.2 (+https://scout-download.vercel.app)", Accept: "text/html" },
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!next) break;
      await res.body?.cancel();
      url = new URL(next, target).toString();
      res = null;
    }
    if (!res || !res.ok || !res.body || !/html/i.test(res.headers.get("content-type") ?? "")) return null;
    // Read just the head of the page; the meta tags are near the top.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
      if (new TextDecoder().decode(value).includes("</head>")) break;
    }
    reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(new Uint8Array(chunks.flatMap((c) => [...c])));
    return ogImageFrom(html, url);
  } catch {
    return null; // timeouts, TLS errors, bot walls: no photo, no problem
  }
}
