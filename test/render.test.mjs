import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml, slugify, postPath, isPost, findGuestbook, sanitize, insertAt, isAllowedImageUrl, imageSources, imageSize, localizeImages,
  versionUrls, versionImports, importsOf, isProject, projectPath, skillsOf, extractLink, projectCard, skillsList,
  readingMinutes, summary, formatDate, renderComments, countComments, fill, postCard, guestbookEntries, redirectPage,
} from "../tools/render.mjs";

const owner = { login: "EmilianoManaloIV" };
const stranger = { login: "someone-else" };
const comment = (body, extra = {}) => ({ author: stranger, createdAt: "2026-10-20T12:00:00Z", bodyHTML: `<p>${body}</p>`, isMinimized: false, ...extra });

test("slugify folds accents, spells out &, and collapses punctuation", () => {
  assert.equal(slugify("R&D: Learning Shaders!"), "r-and-d-learning-shaders");
  assert.equal(slugify("Café déjà vu"), "cafe-deja-vu");
  assert.equal(slugify("🚀🚀"), "post");
  assert.equal(slugify("a".repeat(80)).length, 60);
  assert.equal(postPath({ number: 12, title: "Learning Shaders" }), "/rd/12-learning-shaders/");
});

test("only the owner's discussions in R&D are posts", () => {
  assert.equal(isPost({ category: { name: "R&D" }, author: owner }), true);
  assert.equal(isPost({ category: { name: "R&D" }, author: stranger }), false, "stranger");
  assert.equal(isPost({ category: { name: "General" }, author: owner }), false, "other category");
  assert.equal(isPost({ category: { name: "R&D" }, author: null }), false, "deleted account");
});

test("the guestbook is the owner's oldest discussion in Guestbook", () => {
  const found = findGuestbook([
    { number: 9, category: { name: "Guestbook" }, author: owner },
    { number: 4, category: { name: "Guestbook" }, author: stranger },
    { number: 7, category: { name: "Guestbook" }, author: owner },
  ]);
  assert.equal(found.number, 7);
  assert.equal(findGuestbook([]), undefined);
});

test("sanitize drops scripts, frames, styles, handlers, and unsafe URLs", () => {
  const dirty = `<p onclick="x()" style="color:red">Hi <script>alert(1)</script><iframe src="https://evil"></iframe>
    <a href="javascript:alert(1)">bad</a> <a href=" JaVaScRiPt:alert(1)">bad2</a> <a href="https://ok.example">ok</a>
    <img src="data:image/png;base64,AAAA" alt="d"><svg><script>1</script></svg><form><input></form></p>`;
  const clean = sanitize(dirty);
  assert.doesNotMatch(clean, /script|iframe|onclick|style=|javascript:|data:|<svg|<form|<input/i);
  assert.doesNotMatch(sanitize('<a href="&#106;avascript:alert(1)">x</a>'), /href/, "numeric-entity javascript: URL");
  assert.match(clean, /<a href="https:\/\/ok\.example">ok<\/a>/);
  assert.match(clean, /<p>Hi /);
});

// Regression tests from the security review: each input once escaped the old sanitizer.
test("unfinished tags are escaped, never completed by the markup around them", () => {
  const wrapped = (html) => `<div>${html}</div>`;
  const xss = sanitize("<p>hi</p><img src=x onerror=alert(document.domain)//", { ugc: true });
  // Escaped, it shows as harmless text; what matters is that no real tag exists.
  assert.doesNotMatch(wrapped(xss), /<img/i);
  assert.match(xss, /&lt;img src=x onerror/);
  assert.doesNotMatch(sanitize("<img src=http://evil.example/t.png"), /<img/, "unfinished third-party image");
  assert.doesNotMatch(guestbookEntries([comment("x", { bodyHTML: "<p>hi</p><img src=x onerror=alert(1)//" })]), /<img/i);
  assert.doesNotMatch(renderComments([comment("x", { bodyHTML: "<b>hi<img src=x onerror=alert(1)//" })]), /<img/i);
});

test("an unterminated comment or dropped element only removes the rest of the fragment", () => {
  assert.equal(sanitize("<p>before</p><!-- hidden forever"), "<p>before</p>");
  assert.equal(sanitize("<p>a</p><script>alert(1)"), "<p>a</p>");
  assert.equal(sanitize("<p>a</p><style>p{}</style><p>b</p>"), "<p>a</p><p>b</p>");
});

test("a > inside a quoted attribute stays inside the attribute", () => {
  const out = sanitize('<a href="https://ok.example" title="a>b" onclick=alert(1)>x</a>');
  assert.equal(out, '<a href="https://ok.example" title="a&gt;b">x</a>');
});

test("fragments can't close or leave open the page's own elements", () => {
  assert.equal(sanitize("</div></li></ol><p>ok</p>"), "<p>ok</p>");
  assert.equal(sanitize("<details><div><p>open"), "<details><div><p>open</p></div></details>");
  assert.equal(sanitize("<b><i>x</b>y"), "<b><i>x</i></b>y");
});

test("prototype names and impossible character codes don't crash the sanitizer", () => {
  assert.equal(sanitize("<constructor a=b>x</constructor>y"), "xy");
  // Not a valid tag name, so it is shown as text rather than parsed.
  assert.equal(sanitize("<__proto__>y"), "&lt;__proto__&gt;y");
  assert.equal(sanitize('<a href="/x" title="&#99999999;&#x110000;&#xD800;&#0;">x</a>'), '<a href="/x" title="����">x</a>');
});

test("visitor links get nofollow ugc, and visitor headings sit under the page's", () => {
  assert.equal(sanitize('<a href="https://x.example">x</a>', { ugc: true }), '<a href="https://x.example" rel="nofollow ugc noopener">x</a>');
  assert.equal(sanitize("<h1>A</h1>", { shift: 2 }), "<h3>A</h3>");
  assert.match(renderComments([comment("x", { bodyHTML: '<h1>T</h1><a href="https://x.example">l</a>' })]), /<h3>T<\/h3>[\s\S]*rel="nofollow ugc noopener"/);
});

test("sanitizing hostile input stays fast", () => {
  const started = performance.now();
  sanitize("<a ".repeat(30000));
  sanitize('<a title="'.repeat(5000));
  sanitize("<b>".repeat(30000) + "</i>".repeat(40000));
  sanitize("<p>".repeat(33000) + "</b>".repeat(25000));
  assert.ok(performance.now() - started < 1500, "sanitize took too long");
});

// From the second security review: these shapes made the browser's parser close
// elements outside the fragment, spilling later comments out of their box.
test("list items and tables can't break out of a comment box", () => {
  const visitor = { shift: 2, ugc: true };
  assert.equal(sanitize("<li>x</li>", visitor), "x");
  assert.equal(sanitize("<ul><li>a</li></ul>", visitor), "<ul><li>a</li></ul>");
  assert.equal(sanitize("<div><li>x</li></div>", visitor), "<div>x</div>");
  assert.equal(sanitize("<table><tr><td>x</td></tr></table>", visitor), "x", "no tables from visitors");
  assert.equal(sanitize("<table><div><table>x"), "<table><div>x</div></table>", "no table inside a table");
  assert.equal(sanitize("<td>x</td>"), "x", "table parts only inside a table");
  assert.equal(sanitize("<table><tr><td>x</td></tr></table>"), "<table><tr><td>x</td></tr></table>", "owner tables still work");
});

test("visitor links must be full https or mailto URLs; owner links may be site-relative", () => {
  const visitor = { ugc: true };
  for (const href of ["//example.org/x", "/\\evil.example", "/no-such-page/", "#user-content-fn-1", "/\t/evil.example"]) {
    assert.doesNotMatch(sanitize(`<a href="${href}">x</a>`, visitor), /href=/, href);
  }
  assert.match(sanitize('<a href="mailto:a@b.example">m</a>', visitor), /href="mailto:a@b\.example"/);
  assert.match(sanitize('<a href="/about/">about</a>'), /href="\/about\/"/);
  for (const href of ["//example.org/x", "/\\evil.example", "#fn-1"]) assert.doesNotMatch(sanitize(`<a href="${href}">x</a>`), /href=/, `owner ${href}`);
});

test("insertAt inserts text literally, whatever it contains", () => {
  assert.equal(insertAt("[<!-- X -->]", "<!-- X -->", "$& $` $' {{name}}"), "[$& $` $' {{name}}]");
  assert.throws(() => insertAt("no marker", "<!-- X -->", "v"), /marker missing/);
});

test("versionUrls fingerprints the site's scripts and stylesheet, and nothing else", () => {
  const versions = new Map([["styles.css", "aaa"], ["js/main.js", "bbb"], ["js/geometry.js", "ccc"]]);
  const html = '<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="styles.css"><link rel="modulepreload" href="/js/geometry.js"><script type="module" src="js/main.js"></script><script src="/js/unknown.js"></script><a href="/rd/">x</a><a href="https://cdn.example/js/main.js">y</a>';
  assert.equal(
    versionUrls(html, versions),
    '<link rel="stylesheet" href="/styles.css?v=aaa"><link rel="stylesheet" href="styles.css?v=aaa"><link rel="modulepreload" href="/js/geometry.js?v=ccc"><script type="module" src="js/main.js?v=bbb"></script><script src="/js/unknown.js"></script><a href="/rd/">x</a><a href="https://cdn.example/js/main.js">y</a>',
  );
});

test("versionImports fingerprints relative module imports to match the preload", () => {
  const versions = new Map([["js/geometry.js", "ccc"]]);
  const code = 'import { torus } from "./geometry.js";\nimport { x } from "./other.js";';
  assert.equal(versionImports(code, versions), 'import { torus } from "./geometry.js?v=ccc";\nimport { x } from "./other.js";');
  assert.deepEqual(importsOf(code), ["js/geometry.js", "js/other.js"]);
});

test("only the owner's discussions in Projects are projects, at stable paths", () => {
  assert.equal(isProject({ category: { name: "Projects" }, author: owner }), true);
  assert.equal(isProject({ category: { name: "Projects" }, author: stranger }), false);
  assert.equal(isProject({ category: { name: "R&D" }, author: owner }), false);
  assert.equal(projectPath({ number: 21, title: "Blendity" }), "/projects/21-blendity/");
});

test("skillsOf keeps only 'skill:' labels, trimmed and de-duplicated", () => {
  const labels = (...names) => ({ labels: { nodes: names.map((name) => ({ name })) } });
  assert.deepEqual(skillsOf(labels("skill: C++", "bug", "Skill:Unity3D", "skill:  c++ ", "enhancement", "skill:", "skill: Research")), ["C++", "Unity3D", "Research"]);
  assert.deepEqual(skillsOf({}), []);
});

test("extractLink takes only a first-paragraph https Link: line", () => {
  const body = '<p>Link: <a href="https://example.com/blendity">https://example.com/blendity</a></p><p>Text</p>';
  assert.deepEqual(extractLink(body), { href: "https://example.com/blendity", body: "<p>Text</p>" });
  assert.equal(extractLink('<p>Intro</p><p>Link: <a href="https://x.example">x</a></p>').href, null, "not the first paragraph");
  assert.equal(extractLink('<p>Link: <a href="http://x.example">x</a></p>').href, null, "not https");
  assert.equal(extractLink("<p>No link here</p>").body, "<p>No link here</p>");
  // Never swallows text: trailing words or a second link keep the paragraph intact.
  const trailing = '<p>Link: <a href="https://ok.example">u</a> more words</p><p>Second <a href="https://z.example">z</a></p>';
  assert.deepEqual(extractLink(trailing), { href: null, body: trailing });
  const two = '<p>Link: <a href="https://a.example">a</a><a href="https://b.example">b</a></p>';
  assert.deepEqual(extractLink(two), { href: null, body: two });
  // A line break after the link keeps the rest of the paragraph as the intro.
  assert.deepEqual(extractLink('<p>Link: <a href="https://x.example">x</a><br>\nIntro text.</p><p>More</p>'), { href: "https://x.example", body: "<p>Intro text.</p><p>More</p>" });
});

test("skillsOf tolerates missing label entries", () => {
  assert.deepEqual(skillsOf({ labels: { nodes: [null, { name: "skill: C++" }, {}] } }), ["C++"]);
});

test("project cards escape titles and skills and fall back to the placeholder", () => {
  const card = projectCard({ title: '<b>"Blend"</b>', path: "/projects/1-blend/", summary: "<i>s</i>", link: "https://x.example", skills: ["C<script>"], image: null }, 0);
  assert.doesNotMatch(card, /<b>|<i>|<script>/);
  assert.match(card, /&lt;b&gt;&quot;Blend&quot;&lt;\/b&gt; link<\/a>/);
  assert.match(card, /class="slot"/);
  assert.match(card, /FIG\. 02\.1 \/ /);
  const withImage = projectCard({ title: "B", path: "/projects/2-b/", summary: "s", link: null, skills: [], image: { src: "/projects/2-b/img-1.png", width: 640, height: 480 } }, 1);
  assert.match(withImage, /<img src="\/projects\/2-b\/img-1\.png" alt="B" width="640" height="480" loading="lazy">/);
  assert.doesNotMatch(withImage, /tag-link/, "no Link: line, no button");
  assert.match(withImage, /FIG\. 02\.2 \/ B/);
});

test("skillsList counts uses, sorts most used first, and names the projects", () => {
  const html = skillsList([
    { title: "Blendity", skills: ["C++", "Research"] },
    { title: "UNOverse", skills: ["C#", "Research"] },
  ]);
  assert.ok(html.indexOf("Research") < html.indexOf("C++"), "most used first");
  assert.ok(html.indexOf("C#") < html.indexOf("C++"), "then alphabetical");
  assert.match(html, /title="Used in Blendity, UNOverse">Research <span class="tag-count">×2<\/span>/);
});

test("only GitHub's image hosts are fetched", () => {
  assert.equal(isAllowedImageUrl("https://github.com/user-attachments/assets/abc"), true);
  assert.equal(isAllowedImageUrl("https://private-user-images.githubusercontent.com/1/x.png?jwt=y"), true);
  for (const url of ["http://github.com/user-attachments/assets/abc", "https://169.254.169.254/latest", "https://evil.example/x.png", "https://github.com.evil.example/user-attachments/x", "file:///etc/passwd"]) {
    assert.equal(isAllowedImageUrl(url), false, url);
  }
});

test("sanitize shifts headings down so the title stays the only h1", () => {
  assert.equal(sanitize("<h1>A</h1><h3>B</h3><h6>C</h6>"), "<h2>A</h2><h4>B</h4><h6>C</h6>");
});

test("sanitize keeps attributes escaped and drops unknown tags but keeps their text", () => {
  assert.equal(sanitize('<a href="https://x.example/?a=1&amp;b=&quot;2&quot;" title="t">x</a>'), '<a href="https://x.example/?a=1&amp;b=&quot;2&quot;" title="t">x</a>');
  assert.equal(sanitize("<marquee>still here</marquee>"), "still here");
});

const bytes = (...parts) => Uint8Array.from(parts.flat());
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n) => [n & 255, (n >> 8) & 255];
const le24 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

test("imageSize reads PNG, GIF, JPEG, and the three WebP variants", () => {
  assert.deepEqual(imageSize(bytes([137, 80, 78, 71, 13, 10, 26, 10], be32(13), ascii("IHDR"), be32(640), be32(480))), { type: "png", width: 640, height: 480 });
  assert.deepEqual(imageSize(bytes(ascii("GIF89a"), le16(32), le16(16))), { type: "gif", width: 32, height: 16 });
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 8, 0x01, 0xe0, 0x02, 0x80, 3];
  assert.deepEqual(imageSize(bytes([0xff, 0xd8], app0, sof0, new Array(8).fill(0))), { type: "jpeg", width: 640, height: 480 });
  const riff = (chunk, body) => bytes(ascii("RIFF"), be32(0), ascii("WEBP"), ascii(chunk), be32(0), body, new Array(8).fill(0));
  assert.deepEqual(imageSize(riff("VP8X", [0, 0, 0, 0, ...le24(1199), ...le24(629)])), { type: "webp", width: 1200, height: 630 });
  const lossless = (299 & 0x3fff) | ((199 & 0x3fff) << 14);
  assert.deepEqual(imageSize(riff("VP8L", [0x2f, lossless & 255, (lossless >> 8) & 255, (lossless >> 16) & 255, (lossless >>> 24) & 255])), { type: "webp", width: 300, height: 200 });
  assert.deepEqual(imageSize(riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(400), ...le16(300)])), { type: "webp", width: 400, height: 300 });
  assert.equal(imageSize(bytes(ascii("not an image at all"))), null);
});

test("localizeImages points images and their links at local files, dropping missing ones", () => {
  const html = `<a href="https://gh.example/a.png"><img src="https://gh.example/a.png" alt="A"></a><img src="https://gh.example/missing.png" alt="B">`;
  assert.deepEqual(imageSources(html), ["https://gh.example/a.png", "https://gh.example/missing.png"]);
  const out = localizeImages(html, new Map([["https://gh.example/a.png", { file: "img-1.png", width: 10, height: 20 }]]));
  assert.equal(out, `<a href="img-1.png"><img src="img-1.png" alt="A" width="10" height="20" loading="lazy"></a>`);
});

test("reading time, summary, and dates", () => {
  assert.equal(readingMinutes("<p>short</p>"), 1);
  assert.equal(readingMinutes(`<p>${"word ".repeat(660)}</p>`), 3);
  assert.equal(summary("<p>First &amp; best.</p><p>Second.</p>"), "First & best.");
  assert.ok(summary(`<p>${"word ".repeat(80)}</p>`).endsWith("…"));
  assert.ok(summary(`<p>${"word ".repeat(80)}</p>`).length <= 160);
  assert.equal(formatDate("2026-10-18T23:30:00Z"), "Oct 18, 2026");
});

test("comments hide minimized entries and nest replies one level", () => {
  const comments = [
    comment("visible", { replies: { nodes: [comment("reply"), comment("MINIMIZED-REPLY", { isMinimized: true })] } }),
    comment("MINIMIZED-COMMENT", { isMinimized: true }),
    comment("ghosted", { author: null }),
  ];
  const html = renderComments(comments);
  assert.match(html, /visible/);
  assert.match(html, /reply/);
  assert.doesNotMatch(html, /MINIMIZED/);
  assert.match(html, /ghost/);
  assert.equal((html.match(/class="comment-replies"/g) ?? []).length, 1);
  assert.equal(countComments(comments), 3);
  assert.match(renderComments([]), /No comments yet/);
});

test("titles and names are escaped in markup", () => {
  const card = postCard({ title: "<b>x</b> & y", path: "/rd/1-x/", createdAt: "2026-10-18T00:00:00Z", minutes: 2, commentCount: 1, summary: "<i>s</i>" });
  assert.match(card, /&lt;b&gt;x&lt;\/b&gt; &amp; y/);
  assert.match(card, /1 comment</);
  assert.equal(escapeHtml(`"'<>&`), "&quot;&#39;&lt;&gt;&amp;");
  assert.match(renderComments([comment("hi", { author: { login: '"><script>' } })]), /&quot;&gt;&lt;script&gt;/);
});

test("guestbook entries are oldest first, numbered, and skip hidden ones", () => {
  const html = guestbookEntries([
    comment("second", { createdAt: "2026-10-21T00:00:00Z" }),
    comment("spam", { isMinimized: true, createdAt: "2026-10-19T00:00:00Z" }),
    comment("first", { createdAt: "2026-10-20T00:00:00Z" }),
  ]);
  assert.ok(html.indexOf("first") < html.indexOf("second"));
  assert.match(html, /#001[\s\S]*first/);
  assert.match(html, /#002[\s\S]*second/);
  assert.doesNotMatch(html, /spam/);
});

test("fill replaces every placeholder and refuses missing values", () => {
  assert.equal(fill("{{a}}-{{b}}", { a: 1, b: 2 }), "1-2");
  assert.throws(() => fill("{{missing}}", {}), /missing/);
});

test("redirect page needs no JavaScript and stays out of search", () => {
  const page = redirectPage("/rd/12-new-name/", "https://example.github.io");
  assert.match(page, /http-equiv="refresh" content="0; url=\/rd\/12-new-name\/"/);
  assert.match(page, /<a href="\/rd\/12-new-name\/">/);
  assert.match(page, /noindex/);
  assert.doesNotMatch(page, /<script/);
});
