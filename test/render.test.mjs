import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml, slugify, postPath, isPost, findGuestbook, sanitize, imageSources, imageSize, localizeImages,
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
