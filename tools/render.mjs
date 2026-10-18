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
    details: [], summary: [], span: [], div: [],
  }),
);
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
    if (!ALLOWED.has(name)) continue;
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
    push(tag);
    out += `<${tag}${cleanAttributes(name, rest, ugc)}>`;
  }
  while (open.length) out += `</${pop()}>`;
  return out;
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

// Only GitHub's own image hosts are fetched during the build.
export const isAllowedImageUrl = (url) =>
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

export function postCard(post) {
  const n = post.commentCount;
  return `<li class="post-card">
            <p class="eyebrow"><time datetime="${isoDate(post.createdAt)}">${formatDate(post.createdAt)}</time> · ${post.minutes} min read · ${n} ${n === 1 ? "comment" : "comments"}</p>
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
// layout carry over. `image` is { src, width, height } or null for the placeholder.
export function projectCard(project, index) {
  const title = escapeHtml(project.title);
  const button = project.link ? `<li><a class="tag tag-link" href="${project.link}">${title} link</a></li>\n              ` : "";
  const media = project.image
    ? `<img src="${project.image.src}" alt="${title}" width="${project.image.width}" height="${project.image.height}" loading="lazy">`
    : `<div class="slot" aria-hidden="true">${title} image</div>`;
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
