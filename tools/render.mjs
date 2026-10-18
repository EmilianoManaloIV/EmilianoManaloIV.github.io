// Pure rendering helpers for the R&D build (ADR 0005). No I/O, no dependencies,
// so every rule here is unit-tested in test/render.test.mjs.

export const OWNER = "EmilianoManaloIV";
export const POSTS_CATEGORY = "R&D";
export const GUESTBOOK_CATEGORY = "Guestbook";

export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// "R&D: Learning Shaders!" -> "r-and-d-learning-shaders". Accents fold to ASCII;
// anything else non-alphanumeric becomes a single dash.
export function slugify(title) {
  const slug = String(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "post";
}

export const postPath = (discussion) => `/rd/${discussion.number}-${slugify(discussion.title)}/`;

// Only the owner's discussions in the R&D category are posts. Two independent checks,
// so a stranger's discussion can never become a page on the site.
export const isPost = (d) => d?.category?.name === POSTS_CATEGORY && d?.author?.login === OWNER;

// The guestbook is the owner's oldest discussion in the Guestbook category.
export function findGuestbook(discussions) {
  return discussions
    .filter((d) => d?.category?.name === GUESTBOOK_CATEGORY && d?.author?.login === OWNER)
    .sort((a, b) => a.number - b.number)[0];
}

// == Sanitizing GitHub's pre-rendered HTML (defense in depth: it is already sanitized)

// Decode before re-escaping, so an attribute is never escaped twice. Numeric entities
// are decoded too, so "&#106;avascript:" can't slip past the URL check.
const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);?/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);?/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|template|noscript|textarea|select)\b[\s\S]*?<\/\1\s*>/gi;
const ALLOWED = {
  p: [], br: [], hr: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
  ul: [], ol: ["start"], li: [], blockquote: [], pre: [], code: [], kbd: [],
  em: [], strong: [], b: [], i: [], s: [], del: [], ins: [], sup: [], sub: [],
  a: ["href", "title"], img: ["src", "alt", "width", "height", "title"],
  figure: [], figcaption: [], table: [], thead: [], tbody: [], tr: [], th: ["align"], td: ["align"],
  details: [], summary: [], span: [], div: [],
};
const VOID = new Set(["br", "hr", "img"]);
const URL_ATTRS = new Set(["href", "src"]);
const SAFE_URL = /^(https?:|mailto:|\/|#)/i;

function cleanAttributes(tag, raw) {
  const kept = [];
  for (const [, name, , dq, sq, bare] of raw.matchAll(/([^\s"'=<>/]+)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const key = name.toLowerCase();
    if (!ALLOWED[tag].includes(key)) continue;
    const value = decodeEntities((dq ?? sq ?? bare ?? "").trim());
    if (URL_ATTRS.has(key) && !SAFE_URL.test(value.replace(/[\u0000- ]/g, ""))) continue;
    kept.push(` ${key}="${escapeHtml(value)}"`);
  }
  return kept.join("");
}

// Keeps an allowlist of tags and attributes; drops scripts, frames, styles, event
// handlers, and javascript:/data: URLs. Headings shift down one level, because the
// post title is the page's only h1.
export function sanitize(html) {
  return String(html ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROP_WITH_CONTENT, "")
    .replace(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g, (match, name, rest) => {
      const original = name.toLowerCase();
      if (!(original in ALLOWED)) return "";
      const tag = /^h[1-5]$/.test(original) ? `h${Number(original[1]) + 1}` : original;
      if (match.startsWith("</")) return VOID.has(tag) ? "" : `</${tag}>`;
      return `<${tag}${cleanAttributes(original, rest.replace(/\/\s*$/, ""))}>`;
    });
}

// == Images

export const imageSources = (html) => [...String(html).matchAll(/<img\b[^>]*\ssrc="([^"]+)"/gi)].map((m) => m[1].replace(/&amp;/g, "&"));

// Reads width and height from PNG, JPEG, GIF, or WebP headers. Returns null otherwise.
export function imageSize(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const u16be = (i) => (b[i] << 8) | b[i + 1];
  const u16le = (i) => b[i] | (b[i + 1] << 8);
  const u24le = (i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const u32be = (i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const ascii = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
  if (b.length >= 24 && ascii(1, 3) === "PNG") return { type: "png", width: u32be(16), height: u32be(20) };
  if (b.length >= 10 && ascii(0, 3) === "GIF") return { type: "gif", width: u16le(6), height: u16le(8) };
  if (b.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8 ") return { type: "webp", width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { type: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { type: "webp", width: u24le(24) + 1, height: u24le(27) + 1 };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const length = u16be(i + 2);
      // SOF0-SOF15 carry the frame size, except DHT (C4), JPG (C8), and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "jpeg", width: u16be(i + 7), height: u16be(i + 5) };
      }
      i += 2 + length;
    }
  }
  return null;
}

// Rewrites image sources (and links that point at them) to local files, adding
// dimensions and lazy loading. Images missing from the map are removed.
export function localizeImages(html, images) {
  return String(html)
    .replace(/<img\b([^>]*)>/gi, (tag, rest) => {
      const src = (rest.match(/\ssrc="([^"]+)"/) || [])[1]?.replace(/&amp;/g, "&");
      const local = images.get(src);
      if (!local) return "";
      const alt = (rest.match(/\salt="([^"]*)"/) || [])[1] ?? "";
      return `<img src="${local.file}" alt="${alt}" width="${local.width}" height="${local.height}" loading="lazy">`;
    })
    .replace(/<a\b([^>]*)\shref="([^"]+)"([^>]*)>/gi, (tag, before, href, after) => {
      const local = images.get(href.replace(/&amp;/g, "&"));
      return local ? `<a${before} href="${local.file}"${after}>` : tag;
    });
}

// == Text helpers

export const plainText = (html) =>
  String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export const readingMinutes = (html) => Math.max(1, Math.round(plainText(html).split(" ").filter(Boolean).length / 220));

// The first paragraph as a one-line summary, cut at a word near 160 characters.
export function summary(html) {
  const first = plainText((String(html).match(/<p\b[^>]*>([\s\S]*?)<\/p>/i) || [, html])[1]);
  if (first.length <= 160) return first;
  return `${first.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// UTC so builds are reproducible wherever they run.
export function formatDate(iso) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export const isoDate = (iso) => new Date(iso).toISOString().slice(0, 10);

// == Markup

const visible = (nodes) => (nodes ?? []).filter((c) => c && !c.isMinimized);
const login = (c) => c?.author?.login || "ghost";

function commentItem(comment, { replies = true } = {}) {
  const name = login(comment);
  const children = replies ? visible(comment.replies?.nodes) : [];
  return `<li class="comment">
  <p class="comment-meta"><span class="badge" aria-hidden="true">${escapeHtml(name[0].toUpperCase())}</span> <a href="https://github.com/${escapeHtml(name)}">${escapeHtml(name)}</a> · <time datetime="${isoDate(comment.createdAt)}">${formatDate(comment.createdAt)}</time></p>
  <div class="comment-body prose">${sanitize(comment.bodyHTML)}</div>${
    children.length ? `\n  <ol class="comment-replies">\n${children.map((r) => commentItem(r, { replies: false })).join("\n")}\n  </ol>` : ""
  }
</li>`;
}

// Visible comments and their visible replies; replies render one level deep.
export function renderComments(comments) {
  const items = visible(comments);
  return items.length ? `<ol class="comment-list">\n${items.map((c) => commentItem(c)).join("\n")}\n</ol>` : `<p class="empty-state">No comments yet. Start the conversation on GitHub.</p>`;
}

export const countComments = (comments) => visible(comments).reduce((n, c) => n + 1 + visible(c.replies?.nodes).length, 0);

export function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in values)) throw new Error(`template value missing: ${key}`);
    return values[key];
  });
}

export function postCard(post) {
  const n = post.commentCount;
  return `<li class="post-card">
            <p class="eyebrow"><time datetime="${isoDate(post.createdAt)}">${formatDate(post.createdAt)}</time> · ${post.minutes} min read · ${n} ${n === 1 ? "comment" : "comments"}</p>
            <h3><a href="${post.path}">${escapeHtml(post.title)}</a></h3>
            <p>${escapeHtml(post.summary)}</p>
          </li>`;
}

// Guestbook entries, oldest first and numbered, like the old ones.
export function guestbookEntries(comments) {
  const items = visible(comments).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return items
    .map(
      (c, i) => `<li class="guestbook-entry">
            <p class="guestbook-meta"><span class="guestbook-number">#${String(i + 1).padStart(3, "0")}</span> <a href="https://github.com/${escapeHtml(login(c))}">${escapeHtml(login(c))}</a> · <time datetime="${isoDate(c.createdAt)}">${formatDate(c.createdAt)}</time></p>
            <div class="prose">${sanitize(c.bodyHTML)}</div>
          </li>`,
    )
    .join("\n          ");
}

// A no-JavaScript redirect page for /rd/<number>/ to the post's current address.
export function redirectPage(to, site) {
  const href = escapeHtml(to);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting…</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${escapeHtml(site)}${href}">
  <meta http-equiv="refresh" content="0; url=${href}">
</head>
<body>
  <p>This post moved to <a href="${href}">${href}</a>.</p>
</body>
</html>
`;
}
