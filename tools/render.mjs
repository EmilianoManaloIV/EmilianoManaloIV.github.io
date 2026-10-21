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

// == Sanitizing HTML from discussions
// Strangers write comments and guestbook entries, so this must stand on its own even
// though GitHub's bodyHTML is already sanitized. It is a small tokenizer, not a
// find-and-replace: every "<" either starts a complete, allowed tag or is escaped, and
// open tags are balanced, so a fragment can never break out of the page around it.

// Out-of-range, surrogate, and NUL code points become U+FFFD instead of throwing.
const codePoint = (n) => (n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "�");

// Decode before re-escaping, so an attribute is never escaped twice. Numeric entities
// are decoded too, so "&#106;avascript:" can't slip past the URL check.
const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);?/g, (m, n) => codePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);?/gi, (m, n) => codePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// A Map, so names like "constructor" or "__proto__" are never mistaken for tags.
const ALLOWED = new Map(
  Object.entries({
    p: [], br: [], hr: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
    ul: [], ol: ["start"], li: [], blockquote: [], pre: [], code: [], kbd: [],
    em: [], strong: [], b: [], i: [], s: [], del: [], ins: [], sup: [], sub: [],
    a: ["href", "title"], img: ["src", "alt", "width", "height", "title"],
    figure: [], figcaption: [], table: [], thead: [], tbody: [], tr: [], th: ["align"], td: ["align"],
    details: [], summary: [], span: [], div: [], video: ["src"],
  }),
);
// Only the owner's posts and projects may show video clips (ADR 0007).
const OWNER_ONLY = new Set(["video"]);
// Elements whose content is dropped along with them. Unclosed, they drop everything after.
const DROP_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript", "textarea", "select", "title", "xmp", "plaintext", "noembed", "noframes"]);
const VOID = new Set(["br", "hr", "img"]);
const TABLE = new Set(["table", "thead", "tbody", "tr", "th", "td"]);
const URL_ATTRS = new Set(["href", "src"]);
// One complete tag, quote-aware. Names and unquoted values exclude "<", so a failed
// match stops at the next "<" and the scan stays linear.
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/y;
const MAX_INPUT = 200_000;

// Links visitors write must be full https/mailto URLs. The owner's posts may also use
// site-relative paths, but never "//host" or "/\host", which browsers send off-site.
// In-page "#" links are dropped: GitHub's footnote ids don't survive sanitizing.
const VISITOR_URL = /^(https?:|mailto:)/i;
const OWNER_URL = /^(https?:|mailto:|\/(?![/\\]))/i;

function cleanAttributes(name, raw, ugc) {
  const allowed = ALLOWED.get(name);
  const kept = [];
  for (const [, attr, , dq, sq, bare] of raw.matchAll(/([^\s"'=<>/]+)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const key = attr.toLowerCase();
    if (!allowed.includes(key)) continue;
    const value = decodeEntities((dq ?? sq ?? bare ?? "").trim());
    if (URL_ATTRS.has(key) && !(ugc ? VISITOR_URL : OWNER_URL).test(value.replace(/[\u0000-  ]/g, ""))) continue;
    if (name === "video" && !isAllowedMediaUrl(value)) continue;
    kept.push(` ${key}="${escapeHtml(value)}"`);
  }
  // Links written by visitors earn no search ranking from this site.
  if (ugc && name === "a") kept.push(' rel="nofollow ugc noopener"');
  return kept.join("");
}

// Keeps an allowlist of tags and attributes and drops everything else: scripts,
// frames, styles, event handlers, javascript:/data: URLs, comments, and unfinished
// tags. Headings move down `shift` levels so the page's own headings stay on top.
// `ugc` marks visitor-written content (comments, guestbook).
export function sanitize(html, { shift = 1, ugc = false } = {}) {
  const input = String(html ?? "").slice(0, MAX_INPUT);
  const open = [];
  const depth = new Map(); // open count per tag, so impossible closers are skipped in O(1)
  const push = (tag) => {
    open.push(tag);
    depth.set(tag, (depth.get(tag) ?? 0) + 1);
  };
  const pop = () => {
    const tag = open.pop();
    depth.set(tag, depth.get(tag) - 1);
    return tag;
  };
  const inside = (tag) => (depth.get(tag) ?? 0) > 0;
  let out = "";
  let i = 0;
  const heading = (name) => (/^h[1-6]$/.test(name) ? `h${Math.min(6, Number(name[1]) + shift)}` : name);
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      out += input.slice(i).replace(/>/g, "&gt;");
      break;
    }
    out += input.slice(i, lt).replace(/>/g, "&gt;");
    i = lt;
    if (input.startsWith("<!--", i)) {
      const end = input.indexOf("-->", i + 4);
      i = end === -1 ? input.length : end + 3;
      continue;
    }
    TAG.lastIndex = i;
    const match = TAG.exec(input);
    if (!match) {
      out += "&lt;";
      i += 1;
      continue;
    }
    i = TAG.lastIndex;
    const [, closing, rawName, rest] = match;
    const name = rawName.toLowerCase();
    if (DROP_CONTENT.has(name)) {
      if (!closing) {
        const close = new RegExp(`</${name}\\s*>`, "gi");
        close.lastIndex = i;
        i = close.exec(input) ? close.lastIndex : input.length;
      }
      continue;
    }
    if (!ALLOWED.has(name) || (ugc && OWNER_ONLY.has(name))) continue;
    const tag = heading(name);
    if (VOID.has(name)) {
      if (!closing) out += `<${tag}${cleanAttributes(name, rest, ugc)}>`;
      continue;
    }
    if (closing) {
      // Close only what this fragment opened; stray closers are dropped.
      if (!inside(tag)) continue;
      while (open.at(-1) !== tag) out += `</${pop()}>`;
      out += `</${pop()}>`;
      continue;
    }
    // The HTML parser lets <li> and nested tables close elements outside the fragment,
    // which would break out of the comment box. So: <li> only directly in a list,
    // no tables at all from visitors, and no table inside a table.
    if (name === "li" && !["ul", "ol"].includes(open.at(-1))) continue;
    if (TABLE.has(name) && (ugc || (name === "table" ? inside("table") : !inside("table")))) continue;
    if (name === "video" && inside("video")) continue;
    push(tag);
    out += `<${tag}${cleanAttributes(name, rest, ugc)}>`;
  }
  while (open.length) out += `</${pop()}>`;
  // A visitor's video leaves GitHub's box behind with only the file name in it; a
  // disclosure with nothing to disclose is dropped, so no dead control remains.
  return ugc ? out.replace(/<details>\s*<summary>(?:(?!<\/?(?:summary|details)\b)[\s\S])*<\/summary>\s*<\/details>/g, "") : out;
}

// Inserts text at a marker literally: no "$&"-style patterns and no template syntax
// are interpreted, whatever a visitor wrote.
export function insertAt(html, marker, value) {
  const at = html.indexOf(marker);
  if (at === -1) throw new Error(`marker missing: ${marker}`);
  return html.slice(0, at) + value + html.slice(at + marker.length);
}

// == Cache-busting: each script and stylesheet address carries a fingerprint of the
// file's contents ("main.js?v=3f9a2c1d7e"). A changed file gets a new address, so a
// browser never pairs a new page with an old cached script. `versions` maps
// "styles.css" or "js/<file>.js" to its fingerprint.

export function versionUrls(html, versions) {
  return html.replace(/\b(href|src)="(\/?)(styles\.css|js\/[\w.-]+\.js)"/g, (match, attr, slash, path) =>
    versions.has(path) ? `${attr}="${slash}${path}?v=${versions.get(path)}"` : match,
  );
}

// Module imports between scripts are versioned too, so the modulepreload in the page
// and the import inside main.js name the same URL and load the module once.
export function versionImports(code, versions) {
  return code.replace(/(\bfrom\s+")\.\/([\w.-]+\.js)(")/g, (match, start, file, end) =>
    versions.has(`js/${file}`) ? `${start}./${file}?v=${versions.get(`js/${file}`)}${end}` : match,
  );
}

export const importsOf = (code) => [...code.matchAll(/\bfrom\s+"\.\/([\w.-]+\.js)"/g)].map((m) => `js/${m[1]}`);

// Only GitHub's own image and attachment hosts are fetched during the build.
export const isAllowedMediaUrl = (url) =>
  /^https:\/\/(github\.com\/user-attachments\/|(user-images|private-user-images|camo|raw)\.githubusercontent\.com\/)/.test(url);


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
      if (!local || local.clip) return "";
      const alt = (rest.match(/\salt="([^"]*)"/) || [])[1] ?? "";
      return `<img src="${local.file}" alt="${alt}" width="${local.width}" height="${local.height}" loading="lazy">`;
    })
    .replace(/<a\b([^>]*)\shref="([^"]+)"([^>]*)>/gi, (tag, before, href, after) => {
      const local = images.get(href.replace(/&amp;/g, "&"));
      return local ? `<a${before} href="${local.file}"${after}>` : tag;
    });
}

// == Video clips (ADR 0007): short, silent loops in the owner's posts and projects,
// lighter than GIFs and paused with the rest of the site's motion.

export const videoSources = (html) => [...String(html).matchAll(/<video\b[^>]*\ssrc="([^"]+)"/gi)].map((m) => m[1].replace(/&amp;/g, "&"));

// Codecs every current browser plays: H.264 in MP4 or MOV, VP8 or VP9 in WebM.
// An iPhone's HEVC .MOV is refused, since Chrome and Firefox can't play it everywhere.
const PLAYABLE = new Set(["avc1", "avc3", "V_VP8", "V_VP9"]);
export const isPlayableClip = (clip) => PLAYABLE.has(clip?.codec);

// MP4 and MOV are trees of boxes; the video track's tkhd has its size, stsd its codec.
const MP4_CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl"]);

function mp4Info(b, u32, ascii) {
  const tracks = [];
  let track = null;
  const walk = (start, end) => {
    for (let i = start; i + 8 <= end; ) {
      let size = u32(i);
      let header = 8;
      if (size === 1) {
        size = u32(i + 8) * 2 ** 32 + u32(i + 12);
        header = 16;
      } else if (size === 0) size = end - i;
      if (size < header || i + size > end) return;
      const type = ascii(i + 4, 4);
      const p = i + header;
      const stop = i + size;
      if (type === "trak") {
        track = {};
        tracks.push(track);
        walk(p, stop);
        track = null;
      } else if (MP4_CONTAINERS.has(type)) walk(p, stop);
      else if (track && type === "hdlr" && p + 12 <= stop) track.handler = ascii(p + 8, 4);
      else if (track && type === "stsd" && p + 16 <= stop) track.codec = ascii(p + 12, 4);
      else if (track && type === "tkhd") {
        // Version 1 has 64-bit times; the matrix and the 16.16 size follow them.
        const at = b[p] === 1 ? 52 : 40;
        if (p + at + 44 > stop) return;
        const turned = u32(p + at) === 0 && u32(p + at + 16) === 0; // rotated 90° or 270°
        const w = Math.round(u32(p + at + 36) / 65536);
        const h = Math.round(u32(p + at + 40) / 65536);
        [track.width, track.height] = turned ? [h, w] : [w, h];
      }
      i = stop;
    }
  };
  walk(0, b.length);
  const video = tracks.find((t) => t.handler === "vide");
  return video ? { type: "mp4", codec: video.codec ?? null, width: video.width ?? 0, height: video.height ?? 0 } : null;
}

// WebM is EBML: variable-length ids and sizes. Segment > Tracks > TrackEntry > Video.
const EBML_CONTAINERS = new Set([0x18538067, 0x1654ae6b, 0xae, 0xe0]);

function webmInfo(b, ascii) {
  // A vint's length is its leading zero bits plus one; ids keep the marker bit, sizes don't.
  const vint = (i, id) => {
    const len = Math.clz32(b[i]) - 23;
    if (len < 1 || len > 8 || i + len > b.length) return null;
    let value = id ? b[i] : b[i] & (0xff >> len);
    let unknown = value === 0xff >> len;
    for (let k = 1; k < len; k++) {
      value = value * 256 + b[i + k];
      if (b[i + k] !== 0xff) unknown = false;
    }
    return { value, len, unknown: !id && unknown };
  };
  const uint = (i, n) => b.subarray(i, i + n).reduce((v, x) => v * 256 + x, 0);
  const found = [];
  let entry = null;
  const walk = (start, end) => {
    for (let i = start; i < end; ) {
      const id = vint(i, true);
      const size = id && vint(i + id.len, false);
      if (!size) return;
      const p = i + id.len + size.len;
      const stop = size.unknown ? end : Math.min(end, p + size.value);
      if (id.value === 0x1f43b675) return; // First Cluster: the tracks are behind us.
      if (id.value === 0xae) {
        entry = {};
        found.push(entry);
        walk(p, stop);
        entry = null;
      } else if (EBML_CONTAINERS.has(id.value)) walk(p, stop);
      else if (entry && id.value === 0x86) entry.codec = ascii(p, stop - p);
      else if (entry && id.value === 0x83) entry.kind = uint(p, stop - p);
      else if (entry && id.value === 0xb0) entry.width = uint(p, stop - p);
      else if (entry && id.value === 0xba) entry.height = uint(p, stop - p);
      i = stop;
    }
  };
  const header = vint(0, true);
  const headerSize = header && vint(header.len, false);
  if (!headerSize) return null;
  walk(header.len + headerSize.len + headerSize.value, b.length);
  const video = found.find((t) => t.kind === 1);
  return video ? { type: "webm", codec: video.codec ?? null, width: video.width ?? 0, height: video.height ?? 0 } : null;
}

// Reads the container, codec, and display size of an MP4, MOV, or WebM. Returns null otherwise,
// including for hostile files nested deep enough to exhaust the stack.
export function clipInfo(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const u32 = (i) => (i + 4 <= b.length ? ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3] : 0);
  // Codec names and box types are short; a capped read never spreads a huge array.
  const ascii = (i, n) => String.fromCharCode(...b.subarray(i, i + Math.min(n, 32)));
  try {
    if (b.length >= 12 && ascii(4, 4) === "ftyp") return mp4Info(b, u32, ascii);
    if (b.length >= 4 && u32(0) === 0x1a45dfa3) return webmInfo(b, ascii);
  } catch {
    // A RangeError from recursion: not a clip worth showing.
  }
  return null;
}

// "orbit-demo.mp4" reads as "orbit demo". Camera and recorder defaults
// (IMG_1234.MOV, Screenrecording_2026…) say nothing, so they become "Video clip".
export function clipLabel(fileName) {
  const name = String(fileName ?? "").trim().replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_\-.\s]+/g, " ").trim();
  if (!/[a-z]{2}/i.test(name) || /^(img|vid|mov|pxl|dsc|mvi|video|clip|recording|screen ?(recording|shot|capture))\b ?\d/i.test(name)) return "Video clip";
  return name;
}

// GitHub wraps each upload in a <details> whose summary is the file name. Both that
// wrapper and a bare <video> become one clip with its local file and size. The markup
// never autoplays: js/main.js plays clips only while motion is on (ADR 0002, 0007),
// and without JavaScript the controls still work. Clips missing from the map are removed.
const CLIP = /<details>\s*<summary>((?:(?!<\/?(?:summary|details)\b)[\s\S])*)<\/summary>\s*<video\b([^>]*)>[\s\S]*?<\/video>\s*<\/details>|<video\b([^>]*)>[\s\S]*?<\/video>/gi;

export const clipTag = ({ src, width, height, label, controls = true }) =>
  `<video src="${src}#t=0.001" width="${width}" height="${height}" aria-label="${escapeHtml(label)}"${controls ? " controls" : ""} muted loop playsinline preload="metadata" data-clip></video>`;

export function localizeVideos(html, clips) {
  return String(html).replace(CLIP, (tag, summaryHtml, wrapped, bare) => {
    const src = ((wrapped ?? bare).match(/\ssrc="([^"]+)"/) || [])[1]?.replace(/&amp;/g, "&");
    const local = clips.get(src);
    if (!local?.clip) return "";
    return clipTag({ src: local.file, width: local.width, height: local.height, label: clipLabel(plainText(summaryHtml ?? "")) });
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

// Visitor content sits under the page's "Comments" heading and links get nofollow.
const VISITOR = { shift: 2, ugc: true };
const visible = (nodes) => (nodes ?? []).filter((c) => c && !c.isMinimized);
const login = (c) => String(c?.author?.login || "ghost");

function commentItem(comment, { replies = true } = {}) {
  const name = login(comment);
  const children = replies ? visible(comment.replies?.nodes) : [];
  return `<li class="comment">
  <p class="comment-meta"><span class="badge" aria-hidden="true">${escapeHtml(name[0].toUpperCase())}</span> <a href="https://github.com/${escapeHtml(name)}">${escapeHtml(name)}</a> · <time datetime="${isoDate(comment.createdAt)}">${formatDate(comment.createdAt)}</time></p>
  <div class="comment-body prose">${sanitize(comment.bodyHTML, VISITOR)}</div>${
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

// Posts labelled "opinion" on GitHub carry an "Opinion" tag (ADR 0013).
export const isOpinion = (d) => (d?.labels?.nodes ?? []).some((node) => /^opinion$/i.test(String(node?.name ?? "").trim()));
export const opinionTag = (d) => (isOpinion(d) ? ' · <span class="tag-opinion">Opinion</span>' : "");

export function postCard(post) {
  const n = post.commentCount;
  return `<li class="post-card">
            <p class="eyebrow"><time datetime="${isoDate(post.createdAt)}">${formatDate(post.createdAt)}</time> · ${post.minutes} min read · ${n} ${n === 1 ? "comment" : "comments"}${opinionTag(post)}</p>
            <h3><a href="${post.path}">${escapeHtml(post.title)}</a></h3>
            <p>${escapeHtml(post.summary)}</p>
          </li>`;
}

// == Projects (ADR 0006): the owner's discussions in "Projects", with skills from
// "skill: <name>" labels and an optional first-paragraph "Link: https://…" button.

export const PROJECTS_CATEGORY = "Projects";
export const isProject = (d) => d?.category?.name === PROJECTS_CATEGORY && d?.author?.login === OWNER;
export const projectPath = (d) => `/projects/${d.number}-${slugify(d.title)}/`;

// Only labels named "skill: …" are skills, so GitHub's default labels never leak.
export function skillsOf(d) {
  const seen = new Set();
  const skills = [];
  for (const node of d?.labels?.nodes ?? []) {
    const match = /^skill:\s*(.+)$/i.exec(String(node?.name ?? "").trim());
    const skill = match?.[1].trim();
    if (skill && !seen.has(skill.toLowerCase())) {
      seen.add(skill.toLowerCase());
      skills.push(skill);
    }
  }
  return skills;
}

// Takes a sanitized body. If its first paragraph is "Link: <https URL>", returns that
// URL (already escaped by the sanitizer) and the body without the line.
// The link must be alone on the first line. GitHub renders a following line with no
// blank line between as a <br> in the same paragraph; that text stays as the intro.
export function extractLink(html) {
  const match = /^\s*<p>\s*Link:\s*<a href="(https:\/\/[^"]+)"[^>]*>[^<]*<\/a>\s*(<\/p>|<br>\s*)/i.exec(html);
  if (!match) return { href: null, body: html };
  const rest = html.slice(match[0].length);
  return { href: match[1], body: match[2] === "</p>" ? rest : `<p>${rest}` };
}

const tagList = (skills) => skills.map((s) => `<li><span class="tag">${escapeHtml(s)}</span></li>`).join("\n              ");

// Same markup as the original hand-written cards, so styles and the alternating
// layout carry over. `media` is { src, width, height, clip } or null for the placeholder;
// a clip on a card has no controls and plays only while motion is on (ADR 0007).
export function projectCard(project, index) {
  const title = escapeHtml(project.title);
  const button = project.link ? `<li><a class="tag tag-link" href="${project.link}">${title} link</a></li>\n              ` : "";
  const m = project.media;
  const media = !m
    ? `<div class="slot" aria-hidden="true">${title} image</div>`
    : m.clip
      ? clipTag({ ...m, label: project.title, controls: false })
      : `<img src="${m.src}" alt="${title}" width="${m.width}" height="${m.height}" loading="lazy">`;
  return `<article class="card">
          <div class="card-body">
            <h3><a href="${project.path}">${title}</a></h3>
            <p>${escapeHtml(project.summary)}</p>
            <ul class="tags">
              ${button}${tagList(project.skills)}
            </ul>
            <p class="card-more"><a href="${project.path}">Read the write-up</a></p>
          </div>
          <figure class="card-media">
            <div class="frame">
              ${media}
            </div>
            <figcaption>FIG. 02.${index + 1} / ${title}</figcaption>
          </figure>
        </article>`;
}

export const projectSkillTags = (skills) => tagList(skills);

// Every skill across projects, most used first, each with the projects that use it.
export function skillsList(projects) {
  const uses = new Map();
  for (const project of projects) {
    for (const skill of project.skills) {
      const key = skill.toLowerCase();
      if (!uses.has(key)) uses.set(key, { skill, titles: [] });
      uses.get(key).titles.push(project.title);
    }
  }
  return [...uses.values()]
    .sort((a, b) => b.titles.length - a.titles.length || a.skill.localeCompare(b.skill))
    .map(({ skill, titles }) => `<li><span class="tag" title="Used in ${escapeHtml(titles.join(", "))}">${escapeHtml(skill)} <span class="tag-count">×${titles.length}</span></span></li>`)
    .join("\n          ");
}

// Guestbook entries, oldest first and numbered, like the old ones.
export function guestbookEntries(comments) {
  const items = visible(comments).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return items
    .map(
      (c, i) => `<li class="guestbook-entry">
            <p class="guestbook-meta"><span class="guestbook-number">#${String(i + 1).padStart(3, "0")}</span> <a href="https://github.com/${escapeHtml(login(c))}">${escapeHtml(login(c))}</a> · <time datetime="${isoDate(c.createdAt)}">${formatDate(c.createdAt)}</time></p>
            <div class="prose">${sanitize(c.bodyHTML, VISITOR)}</div>
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

// == Site text (ADR 0010): page copy and links from one plain file, site-text.md,
// edited on GitHub. Pages mark editable spots with data-text="key" and links with
// data-link="name"; the build fills them and strips the markers.

// Every section the file must have, the page key it fills, and how it renders:
// "inline" (one run of text), "block" (paragraphs), or "entries" (### items).
export const SITE_TEXT = [
  ["Home subtitle", "home-subtitle", "inline"],
  ["Home about heading", "home-about-heading", "inline"],
  ["Home about text", "home-about-text", "inline"],
  ["Value 1 heading", "value-1-heading", "inline"],
  ["Value 1 text", "value-1-text", "inline"],
  ["Value 2 heading", "value-2-heading", "inline"],
  ["Value 2 text", "value-2-text", "inline"],
  ["Value 3 heading", "value-3-heading", "inline"],
  ["Value 3 text", "value-3-text", "inline"],
  ["About one-liner", "about-one-liner", "inline"],
  ["About story", "about-story", "block"],
  ["How this site was made", "about-made", "block"],
  ["Education", "education", "entries"],
  ["Experience", "experience", "entries"],
  ["Projects intro", "projects-intro", "inline"],
];
// Links: Email is required; a blank social link removes it from every page.
export const SITE_LINKS = ["Email", "LinkedIn", "Instagram", "X", "GitHub"];

// Splits the file into sections ("## Name") and their "### " entries. HTML comments
// are guidance for the editor and are dropped. A heading used twice is recorded in
// `duplicates`, so the check can name it instead of silently keeping the last.
export function parseSiteText(text) {
  const sections = new Map();
  sections.duplicates = [];
  let section = null;
  let entry = null;
  for (const raw of String(text).replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      section = { title: line.slice(3).trim(), lines: [], entries: [] };
      entry = null;
      const name = section.title.toLowerCase();
      if (sections.has(name)) sections.duplicates.push(section.title);
      sections.set(name, section);
    } else if (line.startsWith("### ") && section) {
      entry = { head: line.slice(4).trim(), lines: [] };
      section.entries.push(entry);
    } else if (section) {
      (entry ?? section).lines.push(line);
    }
  }
  return sections;
}

const paragraphs = (lines) =>
  lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean);

// *em* and **strong** only when the stars hug the words, so "2 * 3 * 4" stays as typed.
const emphasis = (html) =>
  html.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>").replace(/\*(?=\S)(.+?)(?<=\S)\*/g, "<em>$1</em>");

// A small, safe Markdown subset: *em*, **strong**, and [text](https:// or mailto:).
// Links are found first, so stars inside an address never become markup; one level
// of parentheses in an address is allowed, as in Wikipedia links. Everything is
// escaped before any markup is added, and the result goes through the owner sanitizer.
const LINK = /\[([^\]]+)\]\(((?:https:\/\/|mailto:)(?:[^\s()]|\([^\s()]*\))+)\)/gi;
export function renderInline(text) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(LINK)) {
    out.push(emphasis(escapeHtml(text.slice(last, m.index))));
    out.push(`<a href="${escapeHtml(m[2])}">${emphasis(escapeHtml(m[1]))}</a>`);
    last = m.index + m[0].length;
  }
  out.push(emphasis(escapeHtml(String(text).slice(last))));
  return sanitize(out.join(""));
}

const isHttps = (url) => /^https:\/\/[^\s/]+\.[^\s]+$/i.test(url);
const isEmail = (email) => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);

// Reads and checks the whole file. Any problem throws with the section's name, so a
// typo fails the build (and the last good site stays live) instead of publishing.
export function readSiteText(text) {
  const sections = parseSiteText(text);
  const fail = (message) => {
    throw new Error(`site-text.md: ${message}`);
  };
  if (sections.duplicates.length) fail(`"## ${sections.duplicates[0]}" appears more than once; keep one`);
  const known = new Set(["links", ...SITE_TEXT.map(([name]) => name.toLowerCase())]);
  for (const section of sections.values()) {
    if (!known.has(section.title.toLowerCase())) fail(`"## ${section.title}" isn't a heading this site uses; check its spelling against the list at the top of the file`);
  }
  const fields = {};
  for (const [name, key, kind] of SITE_TEXT) {
    const section = sections.get(name.toLowerCase());
    if (!section) fail(`"## ${name}" is missing`);
    if (kind !== "entries" && section.entries.length) fail(`"## ${name}" can't have "###" lines; those are only for Education and Experience`);
    if (kind === "entries") {
      if (!section.entries.length) fail(`"## ${name}" needs at least one "### When | Title" entry`);
      fields[key] = section.entries.map((e) => {
        const [when, ...rest] = e.head.split("|");
        const title = rest.join("|").trim();
        if (!when.trim() || !title) fail(`"### ${e.head}" in "${name}" should look like "### 2023–2027 | Title"`);
        const body = paragraphs(e.lines);
        return { when: renderInline(when.trim()), title: renderInline(title), body: body.map(renderInline) };
      });
      continue;
    }
    const body = paragraphs(section.lines);
    if (!body.length) fail(`"## ${name}" is empty`);
    if (kind === "inline" && body.length > 1) fail(`"## ${name}" should be a single paragraph (no blank lines inside it)`);
    // Blocks keep the pages' own indentation, so the built HTML reads like the source.
    fields[key] = kind === "block" ? `${body.map((p) => `\n            <p>${renderInline(p)}</p>`).join("")}\n          ` : renderInline(body.join(" "));
  }
  const links = {};
  const linkSection = sections.get("links");
  if (!linkSection) fail(`"## Links" is missing`);
  if (linkSection.entries.length) fail(`"## Links" can't have "###" lines`);
  const allowed = SITE_LINKS.map((n) => n.toLowerCase());
  for (const line of linkSection.lines.map((l) => l.trim()).filter(Boolean)) {
    // The name is everything before the first colon, so addresses keep theirs.
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    const key = match?.[1].trim().toLowerCase();
    if (!match || !allowed.includes(key)) fail(`"${line}" in "## Links" isn't one of ${SITE_LINKS.join(", ")} followed by a colon`);
    if (key in links) fail(`"${match[1].trim()}:" appears twice in "## Links"`);
    links[key] = match[2].trim();
  }
  for (const name of SITE_LINKS) {
    const value = links[name.toLowerCase()] ?? "";
    if (name === "Email") {
      if (!isEmail(value)) fail(`"Email:" in "## Links" must be an email address, not "${value}"`);
    } else if (value && !isHttps(value)) {
      fail(`"${name}:" in "## Links" must start with https://, not "${value}"`);
    }
  }
  return { fields, links: Object.fromEntries(SITE_LINKS.map((n) => [n.toLowerCase(), links[n.toLowerCase()] ?? ""])) };
}

const displayUrl = (url) => url.replace(/^https:\/\/(www\.)?/i, "").replace(/\/$/, "");

function entryItems(entries) {
  return entries
    .map(
      (e) => `
          <li>
            <p class="entry-when">${e.when}</p>
            <div>
              <h3>${e.title}</h3>${e.body.map((p) => `\n              <p>${p}</p>`).join("")}
            </div>
          </li>`,
    )
    .join("") + "\n        ";
}

// Fills one page. Unknown keys throw, so a typo in a page's markup can't go unnoticed.
export function applySiteText(html, { fields, links }) {
  let out = html.replace(/<([a-z][a-z0-9]*)\b([^>]*?)\sdata-text="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g, (_, tag, before, key, after) => {
    if (!(key in fields)) throw new Error(`unknown data-text="${key}"`);
    const value = fields[key];
    const inner = Array.isArray(value) ? entryItems(value) : value;
    return `<${tag}${before}${after}>${inner}</${tag}>`;
  });
  for (const name of Object.keys(links)) {
    const value = links[name];
    if (!value) {
      // A blank link removes its list item (header and footer icons, contact list).
      out = out.replace(new RegExp(String.raw`\s*<li\b[^>]*>(?:(?!</li>)[\s\S])*?\sdata-link="${name}"(?:(?!</li>)[\s\S])*</li>`, "g"), "");
      continue;
    }
    const href = name === "email" ? `mailto:${value}` : value;
    out = out.replace(new RegExp(String.raw`<([a-z]+)\b([^>]*?)\sdata-link="${name}"([^>]*)>([\s\S]*?)</\1>`, "g"), (_, tag, before, after, inner) => {
      // Function replacers, so a "$" in an address is inserted as typed.
      let attrs = `${before}${after}`;
      attrs = attrs.replace(/\shref="[^"]*"/, () => ` href="${escapeHtml(href)}"`);
      attrs = attrs.replace(/\sdata-copy-email="[^"]*"/, () => ` data-copy-email="${escapeHtml(value)}"`);
      const showText = /\sdata-link-text\b/.test(attrs);
      attrs = attrs.replace(/\sdata-link-text\b/, "");
      return `<${tag}${attrs}>${showText ? escapeHtml(name === "email" ? value : displayUrl(value)) : inner}</${tag}>`;
    });
  }
  return out;
}

// The contact card carries the same email, the GitHub link as set (or none), and
// LinkedIn when given. It keeps the card's own line endings (vCard prefers CRLF).
export function applyVcard(vcf, { links }) {
  const eol = vcf.includes("\r\n") ? "\r\n" : "\n";
  const lines = vcf.split(/\r?\n/).filter((line) => !/^URL:https:\/\/(www\.)?(github|linkedin)\.com\//i.test(line));
  const end = lines.indexOf("END:VCARD");
  const extra = [links.github, links.linkedin].filter(Boolean).map((url) => `URL:${url}`);
  lines.splice(end, 0, ...extra);
  return lines.map((line) => (line.startsWith("EMAIL;TYPE=INTERNET:") ? `EMAIL;TYPE=INTERNET:${links.email}` : line)).join(eol);
}

// == Launch polish (ADR 0011)

// Link-preview and home-screen tags, added only for images that exist, so no page
// points at a missing file. The share image is 1200 x 630, exported from Figma.
export function headExtras(html, { site, shareImage = false, touchIcon = false }) {
  let out = html;
  if (shareImage) {
    out = out.replace(/<meta name="twitter:card" content="summary">/, () =>
      [
        '<meta name="twitter:card" content="summary_large_image">',
        `<meta property="og:image" content="${site}/assets/img/share.png">`,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="Emiliano Panday Manalo IV: creative technologist, technical artist, and software engineer">',
        `<meta name="twitter:image" content="${site}/assets/img/share.png">`,
      ].join("\n  "),
    );
  }
  if (touchIcon) out = out.replace(/(<link rel="icon"[^>]*>)/, (tag) => `${tag}\n  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">`);
  return out;
}

const xmlEscape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A sitemap of the given pages ({ loc, lastmod? }), in a stable order.
export function sitemapXml(entries) {
  const urls = [...entries]
    .sort((a, b) => a.loc.localeCompare(b.loc))
    .map(({ loc, lastmod }) => `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export const robotsTxt = (site) => `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`;
