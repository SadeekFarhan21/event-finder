// A photo for a spot from its own event page: the og:image / twitter:image a page sets for link
// previews. Most listings arrive without one, and the app's cards are photo-first.
//
// This fetches URLs that came from the web, so it's careful about where it goes: public https
// hosts only (no IP literals, no localhost / internal names), a short timeout, and it reads at
// most the first 256 KB of HTML.

export const NOT_A_PHOTO = /logo|favicon|icon|avatar|placeholder|default[-_]?(image|og)|sprite|blank|\.svg(\?|$)/i;
// A site's one-size-fits-all link preview ("/brand/share/home.jpg", "fan-social.png"), not this place.
const SITE_CARD = /(^|[\/_.-])(share|sharing|social|og[-_]?default|opengraph[-_]?default)([\/_.-]|$)|\/brand\//i;

const MAX_BYTES = 256 * 1024;

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

export async function findPagePhoto(pageUrl: string, timeoutMs = 4000): Promise<string | null> {
  const u = isPublicHttps(pageUrl);
  if (!u) return null;
  try {
    const res = await fetch(u, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "scout-yelo-prototype/0.2 (+https://scout-download.vercel.app)", Accept: "text/html" },
    });
    if (!res.ok || !res.body || !isPublicHttps(res.url) || !/html/i.test(res.headers.get("content-type") ?? "")) return null;
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
    return ogImageFrom(html, res.url);
  } catch {
    return null; // timeouts, TLS errors, bot walls: no photo, no problem
  }
}
