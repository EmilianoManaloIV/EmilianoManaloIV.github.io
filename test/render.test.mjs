import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml, slugify, postPath, isPost, findGuestbook, sanitize, insertAt, isAllowedMediaUrl, imageSources, imageSize, localizeImages,
  videoSources, clipInfo, isPlayableClip, clipLabel, localizeVideos,
  versionUrls, versionImports, importsOf, isProject, projectPath, skillsOf, extractLink, projectCard, skillsList,
  readingMinutes, summary, formatDate, renderComments, countComments, fill, postCard, guestbookEntries, redirectPage,
  parseSiteText, readSiteText, renderInline, applySiteText, applyVcard, SITE_TEXT, headExtras, sitemapXml, robotsTxt, isOpinion, opinionTag,
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
  const card = projectCard({ title: '<b>"Blend"</b>', path: "/projects/1-blend/", summary: "<i>s</i>", link: "https://x.example", skills: ["C<script>"], media: null }, 0);
  assert.doesNotMatch(card, /<b>|<i>|<script>/);
  assert.match(card, /&lt;b&gt;&quot;Blend&quot;&lt;\/b&gt; link<\/a>/);
  assert.match(card, /class="slot"/);
  assert.match(card, /FIG\. 02\.1 \/ /);
  const withImage = projectCard({ title: "B", path: "/projects/2-b/", summary: "s", link: null, skills: [], media: { src: "/projects/2-b/img-1.png", width: 640, height: 480, clip: false } }, 1);
  assert.match(withImage, /<img src="\/projects\/2-b\/img-1\.png" alt="B" width="640" height="480" loading="lazy">/);
  assert.doesNotMatch(withImage, /tag-link/, "no Link: line, no button");
  assert.match(withImage, /FIG\. 02\.2 \/ B/);
  // A clip on a card has no controls; js/main.js plays it only while motion is on.
  const withClip = projectCard({ title: 'C "1"', path: "/projects/3-c/", summary: "s", link: null, skills: [], media: { src: "/projects/3-c/clip-1.mp4", width: 160, height: 90, clip: true } }, 2);
  assert.match(withClip, /<video src="\/projects\/3-c\/clip-1\.mp4#t=0\.001" width="160" height="90" aria-label="C &quot;1&quot;" muted loop playsinline preload="metadata" data-clip><\/video>/);
  assert.doesNotMatch(withClip, /controls|autoplay|<img/);
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

test("only GitHub's image and attachment hosts are fetched", () => {
  assert.equal(isAllowedMediaUrl("https://github.com/user-attachments/assets/abc"), true);
  assert.equal(isAllowedMediaUrl("https://private-user-images.githubusercontent.com/1/x.png?jwt=y"), true);
  for (const url of ["http://github.com/user-attachments/assets/abc", "https://169.254.169.254/latest", "https://evil.example/x.png", "https://github.com.evil.example/user-attachments/x", "file:///etc/passwd"]) {
    assert.equal(isAllowedMediaUrl(url), false, url);
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

// == Video clips (ADR 0007)

const CLIP_URL = "https://private-user-images.githubusercontent.com/1/2-a.mp4?jwt=x";
// GitHub's own markup for a dragged-in video, as the API returns it.
const githubVideo = (name, src, extra = "") => `<details open="" class="details-reset border rounded-2">
  <summary class="tmp-px-3 py-2">
    <svg aria-hidden="true" class="octicon octicon-device-camera-video"><path d="M16 3.75"></path></svg>
    <span class="m-1">${name}</span>
    <span class="dropdown-caret"></span>
  </summary>
  <video src="${src}" data-canonical-src="${src}" controls="controls" muted="muted" class="d-block" style="max-height:640px"${extra}>
  </video>
</details>`;

test("sanitize keeps video only from the owner, only from GitHub, and only its src", () => {
  const owner = sanitize(githubVideo("a.mp4", CLIP_URL, ' autoplay onplay="alert(1)" poster="https://evil.example/p.png"'));
  assert.match(owner, /<video src="https:\/\/private-user-images\.githubusercontent\.com\/1\/2-a\.mp4\?jwt=x">\s*<\/video>/);
  assert.doesNotMatch(owner, /autoplay|onplay|poster|style|canonical|controls|<svg|evil/);
  assert.match(sanitize('<video src="https://evil.example/x.mp4"></video>'), /^<video><\/video>$/, "off-site src is dropped");
  assert.match(sanitize('<video src="/local.mp4"></video>'), /^<video><\/video>$/, "only GitHub's hosts, even for the owner");
  assert.equal(sanitize(`<video src="${CLIP_URL}"><video src="${CLIP_URL}"></video></video>`).match(/<video/g).length, 1, "no video inside a video");
  for (const html of [githubVideo("a.mp4", CLIP_URL), `<video src="${CLIP_URL}" autoplay></video>`]) {
    assert.doesNotMatch(sanitize(html, { ugc: true }), /<video|<details/, "visitors get no video, and no empty box where it was");
    assert.doesNotMatch(renderComments([comment("x", { bodyHTML: html })]), /<video/);
    assert.doesNotMatch(guestbookEntries([comment("x", { bodyHTML: html })]), /<video/);
  }
});

test("localizeVideos unwraps GitHub's box into one clip that never autoplays", () => {
  const body = sanitize(`<p>Before</p>${githubVideo("orbit-demo.mp4", CLIP_URL)}<p>After</p>`);
  assert.deepEqual(videoSources(body), [CLIP_URL]);
  const clips = new Map([[CLIP_URL, { file: "clip-1.mp4", width: 160, height: 90, clip: true }]]);
  assert.equal(
    localizeVideos(body, clips),
    `<p>Before</p><video src="clip-1.mp4#t=0.001" width="160" height="90" aria-label="orbit demo" controls muted loop playsinline preload="metadata" data-clip></video><p>After</p>`,
  );
  // A bare <video> works too; missing clips, and image entries, are removed with their box.
  assert.match(localizeVideos(`<video src="${CLIP_URL}"></video>`, clips), /^<video src="clip-1\.mp4#t=0\.001"[^>]*aria-label="Video clip"/);
  assert.equal(localizeVideos(sanitize(githubVideo("gone.mp4", "https://github.com/user-attachments/assets/gone")), clips), "");
  assert.equal(localizeVideos(`<video src="${CLIP_URL}"></video>`, new Map([[CLIP_URL, { file: "img-1.png", width: 1, height: 1 }]])), "");
  // An owner's own <details> around other content is left alone.
  assert.equal(localizeVideos("<details><summary>More</summary><p>text</p></details>", clips), "<details><summary>More</summary><p>text</p></details>");
});

test("clipLabel names a clip from its file, unless it's a camera default", () => {
  assert.equal(clipLabel("orbit-demo.mp4"), "orbit demo");
  assert.equal(clipLabel("Torus_spin.v2.webm"), "Torus spin v2");
  for (const name of ["IMG_9408.MOV", "Screenrecording_20261006_132118_Compressed.mp4", "PXL_20261001.mp4", "VID 2026.mp4", "12345.mp4", ""]) {
    assert.equal(clipLabel(name), "Video clip", name);
  }
});

const box = (type, ...payload) => {
  const body = payload.flat(Infinity);
  return [...be32(8 + body.length), ...ascii(type), ...body];
};
const FIXED = 0x10000; // 1.0 in 16.16
// tkhd version 0: version and flags, 20 bytes of times and ids, 16 reserved, the matrix, then the size.
const tkhd = (w, h, matrix = [FIXED, 0, 0, 0, FIXED, 0, 0, 0, 0x40000000]) =>
  box("tkhd", [0, 0, 0, 0], new Array(36).fill(0), matrix.map(be32), be32(w * FIXED), be32(h * FIXED));
const trak = (handler, codec, header) =>
  box("trak", header, box("mdia", box("hdlr", [0, 0, 0, 0], [0, 0, 0, 0], ascii(handler), new Array(12).fill(0)), box("minf", box("stbl", box("stsd", [0, 0, 0, 0], be32(1), be32(16), ascii(codec), new Array(8).fill(0))))));
const mp4 = (...traks) => bytes(box("ftyp", ascii("isom"), be32(512), ascii("isomavc1")), box("moov", ...traks));

test("clipInfo reads an MP4's video track size and codec", () => {
  assert.deepEqual(clipInfo(mp4(trak("soun", "mp4a", tkhd(0, 0)), trak("vide", "avc1", tkhd(1280, 720)))), { type: "mp4", codec: "avc1", width: 1280, height: 720 });
  // A phone's portrait clip is stored landscape with a 90° matrix.
  const turned = mp4(trak("vide", "avc1", tkhd(1920, 1080, [0, FIXED, 0, -FIXED >>> 0, 0, 0, 0, 0, 0x40000000])));
  assert.deepEqual(clipInfo(turned), { type: "mp4", codec: "avc1", width: 1080, height: 1920 });
  // moov after a large mdat that uses the 64-bit size form, as in a non-faststart file.
  const mdat = [...be32(1), ...ascii("mdat"), ...be32(0), ...be32(24), ...new Array(8).fill(7)];
  assert.deepEqual(clipInfo(bytes(box("ftyp", ascii("qt  "), be32(0)), mdat, box("moov", trak("vide", "avc1", tkhd(640, 360))))), { type: "mp4", codec: "avc1", width: 640, height: 360 });
  assert.equal(isPlayableClip(clipInfo(mp4(trak("vide", "avc1", tkhd(2, 2))))), true);
  assert.equal(isPlayableClip(clipInfo(mp4(trak("vide", "hvc1", tkhd(2, 2))))), false, "HEVC is refused");
  assert.equal(clipInfo(mp4(trak("soun", "mp4a", tkhd(0, 0)))), null, "no video track");
  assert.equal(clipInfo(bytes(box("ftyp", ascii("isom")), [0, 0, 0, 200], ascii("moov"))), null, "truncated box");
  // A million nested moov boxes would exhaust the stack; the clip is refused, not the build.
  const depth = 1_000_000;
  const nested = new Uint8Array(16 + depth * 8);
  nested.set(box("ftyp", ascii("isom"), be32(0)));
  for (let i = 0; i < depth; i++) nested.set([...be32(nested.length - 16 - i * 8), ...ascii("moov")], 16 + i * 8);
  assert.equal(clipInfo(nested), null, "hostile nesting");
});

const el = (id, ...content) => {
  const body = content.flat();
  return [...id, 0x80 | body.length, ...body];
};

test("clipInfo reads a WebM's video size and codec", () => {
  const header = el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], ascii("webm")));
  const tracks = el([0x16, 0x54, 0xae, 0x6b],
    el([0xae], el([0x83], [2]), el([0x86], ascii("A_OPUS"))),
    el([0xae], el([0x83], [1]), el([0x86], ascii("V_VP9")), el([0xe0], el([0xb0], [0x02, 0x80]), el([0xba], [0x01, 0xe0]))));
  // MediaRecorder writes the Segment and Clusters with "unknown" sizes.
  const unknown = [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  const webm = bytes(header, [0x18, 0x53, 0x80, 0x67], unknown, tracks, [0x1f, 0x43, 0xb6, 0x75], unknown, new Array(16).fill(0));
  assert.deepEqual(clipInfo(webm), { type: "webm", codec: "V_VP9", width: 640, height: 480 });
  assert.equal(isPlayableClip(clipInfo(webm)), true);
  // A 9 MB codec name is read capped, never spread into one giant call.
  const start = bytes(header, [0x18, 0x53, 0x80, 0x67], unknown, [0x16, 0x54, 0xae, 0x6b], unknown, [0xae], unknown, [0x83, 0x81, 1], [0x86, 0x10, 0x89, 0x54, 0x40]);
  const longCodec = new Uint8Array(start.length + 0x895440).fill(65);
  longCodec.set(start);
  assert.equal(clipInfo(longCodec).codec, "A".repeat(32));
  assert.equal(clipInfo(bytes(ascii("not a video at all"))), null);
});

test("clipInfo reads the fixture's real browser-recorded MP4", async () => {
  const { readFileSync } = await import("node:fs");
  const { media } = JSON.parse(readFileSync(new URL("./fixtures/discussions.json", import.meta.url), "utf8"));
  const clip = Object.entries(media).find(([url]) => url.endsWith(".mp4?jwt=fixture"))[1];
  assert.deepEqual(clipInfo(Buffer.from(clip, "base64")), { type: "mp4", codec: "avc1", width: 160, height: 90 });
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

// == Site text (ADR 0010)

// A complete, valid file built from SITE_TEXT, with optional overrides per section.
function siteFile(overrides = {}, links = {}) {
  const linkLines = { Email: "me@example.com", LinkedIn: "https://www.linkedin.com/in/me", Instagram: "", X: "", GitHub: "https://github.com/me", ...links };
  const parts = ["<!-- How to edit: change the text under each heading. -->", "## Links", ...Object.entries(linkLines).map(([k, v]) => `${k}: ${v}`)];
  for (const [name, , kind] of SITE_TEXT) {
    parts.push("", `## ${name}`);
    if (name in overrides) parts.push(overrides[name]);
    else if (kind === "entries") parts.push("### 2023–2027 | Some title", "What happened.");
    else parts.push(`${name} text.`);
  }
  return parts.join("\n");
}

test("site text: sections, ### entries, paragraphs, and comments parse", () => {
  const sections = parseSiteText("<!-- note -->\r\n## Intro\nOne\nline.\n\nTwo.\n## List\n### A | B\nBody");
  assert.deepEqual(sections.get("intro").lines.filter(Boolean), ["One", "line.", "Two."]);
  assert.equal(sections.get("list").entries[0].head, "A | B");
  const { fields, links } = readSiteText(siteFile({ "About story": "First para\ncontinues.\n\nSecond *para*." }));
  assert.equal(fields["about-story"], "\n            <p>First para continues.</p>\n            <p>Second <em>para</em>.</p>\n          ");
  assert.deepEqual(fields.education, [{ when: "2023–2027", title: "Some title", body: ["What happened."] }]);
  assert.equal(links.instagram, "");
  assert.equal(links.email, "me@example.com");
});

test("site text: a missing, empty, or malformed section fails with its name", () => {
  const without = siteFile().replace(/## Home about text\nHome about text text\./, "");
  assert.throws(() => readSiteText(without), /"## Home about text" is missing/);
  assert.throws(() => readSiteText(siteFile({ "Value 2 text": "" })), /"## Value 2 text" is empty/);
  assert.throws(() => readSiteText(siteFile({ Education: "no entries here" })), /"## Education" needs at least one/);
  assert.throws(() => readSiteText(siteFile({ Experience: "### just a title" })), /should look like/);
  assert.throws(() => readSiteText(siteFile({}, { Email: "not-an-email" })), /must be an email address/);
  assert.throws(() => readSiteText(siteFile({}, { LinkedIn: "http://insecure.example" })), /must start with https/);
  assert.throws(() => readSiteText(siteFile({}, { X: "javascript:alert(1)" })), /must start with https/);
});

test("site text: inline formatting is escaped, limited, and sanitized", () => {
  assert.equal(renderInline("a *b* **c** [d](https://e.example/f?g=1&h=2)"), 'a <em>b</em> <strong>c</strong> <a href="https://e.example/f?g=1&amp;h=2">d</a>');
  assert.equal(renderInline("<script>x</script> & {{title}} $&"), "&lt;script&gt;x&lt;/script&gt; &amp; {{title}} $&amp;");
  assert.doesNotMatch(renderInline("[x](javascript:alert(1))"), /<a/);
  assert.doesNotMatch(renderInline("[x](http://insecure.example)"), /<a/);
});

test("site text: pages get the text, links, and email, and lose the markers", () => {
  const page = [
    '<p data-text="home-subtitle">old</p>',
    '<ol class="entry-list" data-text="education"><li>old</li></ol>',
    '<li><a href="https://x.com/TODO" data-link="x" aria-label="X">X</a></li>',
    '<li>LinkedIn: <a href="https://www.linkedin.com/in/TODO" data-link="linkedin" data-link-text>old</a></li>',
    '<li>Email: <a href="mailto:TODO@example.com" data-link="email" data-link-text>old</a> <button data-link="email" data-copy-email="TODO@example.com">Copy</button></li>',
  ].join("\n");
  const site = readSiteText(siteFile({ "Home subtitle": "New $& subtitle" }, { X: "" }));
  const out = applySiteText(page, site);
  assert.match(out, /<p>New \$&amp; subtitle<\/p>/);
  assert.match(out, /<ol class="entry-list">\s*<li>\s*<p class="entry-when">2023–2027<\/p>/);
  assert.doesNotMatch(out, /x\.com/, "a blank link removes its list item");
  assert.match(out, /<a href="https:\/\/www\.linkedin\.com\/in\/me">linkedin\.com\/in\/me<\/a>/);
  assert.match(out, /<a href="mailto:me@example\.com">me@example\.com<\/a> <button data-copy-email="me@example\.com">Copy<\/button>/);
  assert.doesNotMatch(out, /data-text|data-link/);
  assert.throws(() => applySiteText('<p data-text="nope">x</p>', site), /unknown data-text="nope"/);
});

test("site text: the contact card gets the email and LinkedIn", () => {
  const vcf = "BEGIN:VCARD\nEMAIL;TYPE=INTERNET:TODO@example.com\nEND:VCARD\n";
  const out = applyVcard(vcf, readSiteText(siteFile()));
  assert.match(out, /^EMAIL;TYPE=INTERNET:me@example\.com$/m);
  assert.match(out, /^URL:https:\/\/www\.linkedin\.com\/in\/me\nEND:VCARD$/m);
});

test("site text: silent mistakes are caught and named", () => {
  assert.throws(() => readSiteText(siteFile() + "\n## Links\nEmail: x@y.co"), /"## Links" appears more than once/);
  assert.throws(() => readSiteText(siteFile().replace("## Value 2 text", "## Value two text")), /"## Value two text" isn't a heading/);
  assert.throws(() => readSiteText(siteFile({}, { Twitter: "https://x.example/me" })), /"Twitter: [^"]*" in "## Links" isn't one of/);
  assert.throws(() => readSiteText(siteFile().replace("LinkedIn:", "- LinkedIn:")), /isn't one of/);
  assert.throws(() => readSiteText(siteFile({ "About story": "### oops\ntext" })), /can't have "###" lines/);
  assert.throws(() => readSiteText(siteFile({ "Home subtitle": "One.\n\nTwo." })), /single paragraph/);
  assert.throws(() => readSiteText(siteFile({}, { Email: "mailto:a@b.co" })), /must be an email address/);
  assert.throws(() => readSiteText(siteFile({}, { Email: "a@b.co?subject=hi" })), /must be an email address/);
});

test("site text: a $ in an address is inserted as typed", () => {
  const url = "https://www.linkedin.com/in/a$&b$'c$$d";
  const site = readSiteText(siteFile({}, { LinkedIn: url }));
  const out = applySiteText('<li><a href="old" data-link="linkedin" data-link-text>old</a></li>', site);
  assert.equal(out, '<li><a href="https://www.linkedin.com/in/a$&amp;b$&#39;c$$d">linkedin.com/in/a$&amp;b$&#39;c$$d</a></li>');
  const card = applyVcard("BEGIN:VCARD\r\nEMAIL;TYPE=INTERNET:x\r\nURL:https://github.com/old\r\nEND:VCARD\r\n", site);
  assert.ok(card.split("\r\n").includes(`URL:${url}`));
  assert.ok(card.split("\r\n").includes("URL:https://github.com/me"), "GitHub follows the file");
  assert.doesNotMatch(card, /github\.com\/old/);
  assert.doesNotMatch(card, /[^\r]\n/, "the card keeps CRLF line endings");
});

test("site text: inline formatting edge cases", () => {
  assert.equal(renderInline("2 * 3 * 4"), "2 * 3 * 4");
  assert.equal(renderInline("[wiki](https://en.wikipedia.org/wiki/A_(b))"), '<a href="https://en.wikipedia.org/wiki/A_(b)">wiki</a>');
  assert.equal(renderInline("[x](https://x.example/a*b*c) and *y*"), '<a href="https://x.example/a*b*c">x</a> and <em>y</em>');
  assert.equal(renderInline("[x](HTTPS://x.example)"), '<a href="HTTPS://x.example">x</a>');
});

// == Launch polish (ADR 0011)

test("preview and touch-icon tags appear only for images that exist", () => {
  const head = '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n  <meta name="twitter:card" content="summary">';
  assert.equal(headExtras(head, { site: "https://s.example" }), head);
  const both = headExtras(head, { site: "https://s.example", shareImage: true, touchIcon: true });
  assert.match(both, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(both, /<meta property="og:image" content="https:\/\/s\.example\/assets\/img\/share\.png">/);
  assert.match(both, /<meta property="og:image:alt" content="[^"]+">/);
  assert.match(both, /<link rel="icon"[^>]*>\n  <link rel="apple-touch-icon" href="\/assets\/img\/apple-touch-icon\.png">/);
});

test("the sitemap is sorted, escaped, and dated where known; robots points at it", () => {
  const xml = sitemapXml([{ loc: "https://s.example/rd/", lastmod: "2026-10-18" }, { loc: "https://s.example/?a=1&b=2" }]);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.ok(xml.indexOf("s.example/?a=1&amp;b=2") < xml.indexOf("s.example/rd/"));
  assert.match(xml, /<url><loc>https:\/\/s\.example\/rd\/<\/loc><lastmod>2026-10-18<\/lastmod><\/url>/);
  assert.equal(robotsTxt("https://s.example"), "User-agent: *\nAllow: /\n\nSitemap: https://s.example/sitemap.xml\n");
});

// == Opinion posts (ADR 0013)

test("posts labelled opinion carry an Opinion tag; others don't", () => {
  const opinion = { labels: { nodes: [{ name: "bug" }, { name: " Opinion " }] } };
  assert.ok(isOpinion(opinion));
  assert.ok(!isOpinion({ labels: { nodes: [{ name: "opinions" }, { name: "skill: opinion" }] } }));
  assert.ok(!isOpinion({}));
  assert.equal(opinionTag(opinion), ' · <span class="tag-opinion">Opinion</span>');
  assert.equal(opinionTag({}), "");
  const card = postCard({ ...opinion, createdAt: "2026-10-18T12:00:00Z", minutes: 2, commentCount: 0, path: "/rd/1-x/", title: "X", summary: "s" });
  assert.match(card, /0 comments · <span class="tag-opinion">Opinion<\/span><\/p>/);
});
