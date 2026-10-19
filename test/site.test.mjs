// Site checks on the built output (ADR 0005). Uses only Node built-ins.
// Run with: node tools/build.mjs --offline && node --test
// SITE_DIR picks the built folder (default _site), e.g. after a --fixture build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readSiteText, escapeHtml } from "../tools/render.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = resolve(repo, process.env.SITE_DIR ?? "_site");
if (!existsSync(join(site, "index.html"))) {
  throw new Error(`No built site in ${site}. Run: node tools/build.mjs --offline`);
}
const read = (file) => readFileSync(join(site, file), "utf8");
const source = (file) => readFileSync(join(repo, file), "utf8");
const SITE = "https://emilianomanaloiv.github.io";
const list = (dir) => readdirSync(dir, { recursive: true }).map((f) => f.split(sep).join("/"));

// Every built page. Redirect pages (/rd/<number>/) are tiny meta-refresh stubs,
// checked separately instead of against the full-page rules.
const allPages = list(site).filter((f) => f.endsWith(".html")).sort();
const isRedirect = (file) => /http-equiv="refresh"/.test(read(file));
const pages = allPages.filter((p) => !isRedirect(p));
const redirects = allPages.filter(isRedirect);

// Strip comments so commented-out examples are not checked.
const strip = (text) => text.replace(/<!--[\s\S]*?-->/g, "");
const html = (file) => strip(read(file));
// Attribute values, double- or single-quoted.
const attrs = (text, name) =>
  [...text.matchAll(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "gi"))].map((m) => m[1] ?? m[2]);
const isExternal = (url) => /^(https?:|mailto:|tel:)/.test(url);

// Resolve a local href or src from a page to a built file and optional fragment.
function target(page, url) {
  const [path, hash = ""] = url.split("?")[0].split("#");
  let file = path.startsWith("/") ? path.slice(1) : relative(site, resolve(site, dirname(page), path)).split(sep).join("/");
  if (path === "") file = page;
  if (file === "" || file.endsWith("/")) file += "index.html";
  return { file, hash };
}

test("the build produces every source page plus the expected pages", () => {
  // Build output folders all start with "_" (tools/build.mjs --out), so none count as source.
  const skip = new Set(["test", "templates", "docs", "tools", "node_modules", ".git", ".github", ".claude", "assets", "js"]);
  const sources = list(repo).filter((f) => f.endsWith(".html") && !skip.has(f.split("/")[0]) && !f.startsWith("_"));
  for (const page of [...sources, "index.html", "404.html", "about/index.html", "rd/index.html", "guestbook/index.html"]) {
    assert.ok(allPages.includes(page), `${page} missing from the build`);
  }
});

// Visitors may legitimately write "{{" in a comment, so only the template's own names count.
test("no built page has an unfilled template value or build marker", () => {
  const names = ["templates/rd-post.html", "templates/project.html", "guestbook/index.html"].flatMap((f) => [...source(f).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
  const leftover = new RegExp(`\\{\\{(${[...new Set(names)].join("|")})\\}\\}|<!-- (POSTS|ENTRIES|PROJECTS|SKILLS) -->`);
  for (const page of allPages) assert.doesNotMatch(read(page), leftover, `${page}: unfilled template`);
});

// ADR 0005: strangers write comments and guestbook entries, so check every built page
// for anything that could run script or load from another site.
// An allowlist, not a denylist: every tag, attribute name, and URL scheme on every built
// page must be one the site itself uses or the sanitizer allows. Attribute *values* are
// only checked for URLs, so harmless visitor text ("javascript: is a language") passes.
const SAFE_TAGS = new Set(("a article b blockquote body br button canvas code del details div em figcaption figure footer " +
  "h1 h2 h3 h4 h5 h6 head header hr html i img ins kbd li link main meta nav ol p pre s script section span strong " +
  "sub summary sup table tbody td th thead time title tr ul video").split(" "));
const SAFE_ATTRS = /^(alt|align|as|charset|class|content|controls|crossorigin|datetime|download|height|href|http-equiv|id|lang|loading|loop|media|muted|name|playsinline|preload|property|rel|role|src|start|tabindex|title|type|width|aria-[a-z]+|data-[a-z-]+)$/;
// No "//host" or "/\host" (both leave the site), and any scheme must be http(s) or mailto.
// Decoded first, as a browser would: "javascript&colon;" and "java&#9;script:" are schemes too.
const TEMPLATES = ["templates/rd-post.html", "templates/project.html"];

const decodeUrl = (url) =>
  url
    .replace(/&#x([0-9a-f]+);?/gi, (m, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (m, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&colon;/gi, ":")
    .replace(/&(tab|newline);/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/[\u0000-  ]/g, "");
const SAFE_URL = (raw) => {
  const url = decodeUrl(raw);
  return !/^\/[/\\]/.test(url) && (!/^[a-z][a-z0-9+.-]*:/i.test(url) || /^(https?|mailto):/i.test(url));
};

test("no built page carries anything outside the tag, attribute, and URL allowlists", () => {
  for (const page of allPages) {
    const text = html(page);
    for (const [tag, name, rest] of text.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g)) {
      assert.ok(SAFE_TAGS.has(name.toLowerCase()), `${page}: <${name}> is not allowed`);
      // Browsers accept "/" as well as whitespace before an attribute (<a/onclick=...>).
      for (const [, attr, dq, sq, bare] of rest.matchAll(/[\s/]+([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
        const value = dq ?? sq ?? bare ?? "";
        assert.match(attr.toLowerCase(), SAFE_ATTRS, `${page}: attribute ${attr} in ${tag.slice(0, 80)}`);
        if (/^(href|src)$/i.test(attr)) assert.ok(SAFE_URL(value), `${page}: unsafe URL ${value}`);
      }
    }
    assert.equal((text.match(/<script\b/gi) ?? []).length, (text.match(/<script\b[^>]*\ssrc="\/?js\/[\w.]+(\?v=[0-9a-f]{10})?"[^>]*><\/script>/gi) ?? []).length, `${page}: script other than the site's own`);
  }
});

test("visitor links are marked nofollow ugc", () => {
  for (const page of allPages.filter((p) => /^(rd\/.+|guestbook\/)index\.html$/.test(p))) {
    for (const block of html(page).match(/<div class="(comment-body )?prose">[\s\S]*?<\/div>/g) ?? []) {
      for (const link of block.match(/<a\b[^>]*>/g) ?? []) {
        if (/class="comment-body|guestbook/.test(block) || page.startsWith("guestbook/")) {
          assert.match(link, /rel="nofollow ugc noopener"/, `${page}: visitor link without rel: ${link}`);
        }
      }
    }
  }
});

for (const page of pages) {
  test(`${page}: scripts are local files only, with no inline code`, () => {
    for (const [, attributes, body] of html(page).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = attrs(attributes, "src")[0];
      assert.ok(src, "inline scripts are not allowed");
      assert.ok(!isExternal(src), `external script not allowed: ${src}`);
      assert.equal(body.trim(), "", `script with src must be empty: ${src}`);
    }
  });

  test(`${page}: has no external stylesheets, fonts, icons, or images`, () => {
    // Only rel="canonical" may point off-site; every other link must be local.
    for (const tag of html(page).match(/<link\b[^>]*>/gi) ?? []) {
      const href = attrs(tag, "href")[0] ?? "";
      const rel = (attrs(tag, "rel")[0] ?? "").toLowerCase();
      if (rel !== "canonical") assert.ok(!isExternal(href) && !href.startsWith("//"), `external ${rel} not allowed: ${href}`);
    }
    // Post and guestbook images are copied into the site, so visitors make no outside requests.
    for (const src of attrs(html(page), "src")) assert.ok(!isExternal(src) && !src.startsWith("//"), `external src: ${src}`);
  });

  test(`${page}: local links, sources, and #anchors resolve across pages`, () => {
    const text = html(page);
    for (const url of [...attrs(text, "src"), ...attrs(text, "href")]) {
      if (isExternal(url) || url.startsWith("//")) continue;
      const { file, hash } = target(page, url);
      assert.ok(existsSync(join(site, file)), `${page}: missing file for ${url}`);
      if (hash && file.endsWith(".html")) {
        assert.ok(attrs(html(file), "id").includes(hash), `${page}: no #${hash} in ${file}`);
      }
    }
  });

  test(`${page}: has lang, title, description, viewport, and canonical`, () => {
    const text = html(page);
    assert.match(text, /<html lang="[^"]+"/);
    assert.match(text, /<title>[^<]+<\/title>/);
    assert.match(text, /<meta name="description" content="[^"]+"/);
    assert.match(text, /<meta name="viewport"/);
    assert.match(text, new RegExp(`<link rel="canonical" href="${SITE}/`));
  });

  test(`${page}: ids are unique and every image has alt, width, and height`, () => {
    const text = html(page);
    const ids = attrs(text, "id");
    assert.equal(new Set(ids).size, ids.length, "duplicate id found");
    for (const tag of text.match(/<img\b[^>]*>/gi) ?? []) {
      for (const name of ["alt", "width", "height"]) assert.match(tag, new RegExp(`\\s${name}="`), `${name} missing: ${tag}`);
    }
  });
}

test("redirect pages point at an existing post, need no JavaScript, and stay out of search", () => {
  for (const page of redirects) {
    const text = read(page);
    const to = text.match(/content="0; url=([^"]+)"/)[1];
    assert.ok(existsSync(join(site, to.slice(1), "index.html")), `${page} redirects to missing ${to}`);
    assert.match(text, /noindex/);
    assert.doesNotMatch(text, /<script/);
  }
});

test("pages have unique titles and canonical URLs", () => {
  const titles = pages.map((p) => html(p).match(/<title>([^<]+)<\/title>/)[1]);
  const canonicals = pages.map((p) => attrs(html(p).match(/<link rel="canonical"[^>]*>/)[0], "href")[0]);
  assert.equal(new Set(titles).size, titles.length, "duplicate title");
  assert.equal(new Set(canonicals).size, canonicals.length, "duplicate canonical");
});

// ADR 0004: no templating tool for the chrome, so header and footer must stay identical.
test("every page repeats the home page's header and footer exactly", () => {
  const chrome = (text) => {
    // Line endings differ by checkout (Git on Windows uses CRLF); browsers treat them alike.
    const clean = text.replace(/\r\n/g, "\n").replace(/ aria-current="page"/g, "");
    return ["header", "footer"].map((tag) => clean.match(new RegExp(`<${tag} class="site-${tag}">[\\s\\S]*?</${tag}>`))?.[0]);
  };
  // Built pages are compared with the built home page, and templates with the source
  // home page: the build fills site-text links (ADR 0010), so the two forms differ.
  for (const [home, others] of [
    [read("index.html"), pages.map((p) => [p, read(p)])],
    [source("index.html"), TEMPLATES.map((t) => [t, source(t)])],
  ]) {
    const [header, footer] = chrome(home);
    assert.ok(header && footer, "index.html header or footer not found");
    for (const [name, text] of others) {
      const [h, f] = chrome(text);
      assert.equal(h, header, `${name}: header differs from index.html`);
      assert.equal(f, footer, `${name}: footer differs from index.html`);
    }
  }
});

test("each subpage marks exactly its own nav item; home, guestbook, and 404 mark none", () => {
  const marks = (file) => html(file).match(/<a href="([^"]+)" aria-current="page">/g) ?? [];
  for (const page of ["index.html", "404.html", "guestbook/index.html"]) assert.deepEqual(marks(page), [], page);
  assert.deepEqual(marks("about/index.html"), ['<a href="/#about" aria-current="page">']);
  for (const page of pages.filter((p) => p.startsWith("projects/"))) {
    assert.deepEqual(marks(page), ['<a href="/#projects" aria-current="page">'], page);
  }
  for (const page of pages.filter((p) => p.startsWith("rd/"))) {
    assert.deepEqual(marks(page), ['<a href="/rd/" aria-current="page">'], page);
  }
});

test("every page loads the shared scripts and a skip link", () => {
  for (const [name, text] of [...pages.map((p) => [p, html(p)]), ...TEMPLATES.map((t) => [t, strip(source(t))])]) {
    for (const script of ["js/theme.js", "js/main.js", "js/ui.js"]) {
      // Built pages carry a fingerprint (?v=...); the template does not, until it is built.
      assert.match(text, new RegExp(`<script[^>]*src="/?${script.replace(".", "\\.")}(\\?v=[0-9a-f]{10})?"`), `${name}: missing ${script}`);
    }
    assert.match(text, /<a class="skip-link" href="#main">/, `${name}: missing skip link`);
  }
});

test("R&D: every post is listed on the index, dated, and linked to its discussion", () => {
  const index = html("rd/index.html");
  const posts = pages.filter((p) => p.startsWith("rd/") && p !== "rd/index.html");
  for (const post of posts) {
    const path = `/${post.replace(/index\.html$/, "")}`;
    assert.match(index, new RegExp(`href="${path}"`), `${path} is not listed on rd/index.html`);
    const text = html(post);
    assert.match(text, /<time datetime="\d{4}-\d{2}-\d{2}">/, `${path}: needs a <time datetime>`);
    assert.match(text, /href="https:\/\/github\.com\/EmilianoManaloIV\/EmilianoManaloIV\.github\.io\/discussions\/\d+"/, `${path}: needs its Discussions thread`);
    assert.equal((text.match(/<h1\b/g) ?? []).length, 1, `${path}: the title must be the only h1`);
  }
});

// The fixture marks everything a stranger wrote in an owner-only category this way.
test("nothing from a stranger's post or project is published", () => {
  for (const page of pages) assert.doesNotMatch(read(page), /FIXTURE-STRANGER/, page);
});

// ADR 0006: projects come from Discussions; their "skill:" labels feed the About page.
test("projects: every page is on the home page, dated, and linked to its discussion", () => {
  const home = html("index.html");
  const projects = pages.filter((p) => p.startsWith("projects/"));
  for (const page of projects) {
    const path = `/${page.replace(/index\.html$/, "")}`;
    assert.match(home, new RegExp(`<h3><a href="${path}">`), `${path} has no card on the home page`);
    const text = html(page);
    assert.match(text, /<time datetime="\d{4}-\d{2}-\d{2}">/, `${path}: needs a <time datetime>`);
    assert.match(text, /href="https:\/\/github\.com\/EmilianoManaloIV\/EmilianoManaloIV\.github\.io\/discussions\/\d+"/, `${path}: needs its Discussions thread`);
    for (const [, href] of text.matchAll(/<a class="tag tag-link" href="([^"]+)">[^<]* link<\/a>/g)) assert.match(href, /^https:\/\//, `${path}: link button must be https`);
  }
  const cards = home.match(/<article class="card">[\s\S]*?<\/article>/g) ?? [];
  assert.equal(cards.filter((c) => /<h3><a href="\/projects\//.test(c)).length, projects.length, "one home card per project page");
});

test("projects: every skill on a project appears on the About page, and only skills do", () => {
  const about = html("about/index.html");
  const list = about.match(/<ul class="tags skill-list">([\s\S]*?)<\/ul>/)?.[1] ?? "";
  const aboutSkills = [...list.matchAll(/<span class="tag" title="Used in [^"]*">([^<]+?) <span class="tag-count">/g)].map((m) => m[1]);
  assert.equal(new Set(aboutSkills).size, aboutSkills.length, "a skill is listed twice");
  const projectSkills = new Set();
  for (const page of pages.filter((p) => p.startsWith("projects/"))) {
    const tags = html(page).match(/<h1>[\s\S]*?<ul class="tags">([\s\S]*?)<\/ul>/)?.[1] ?? "";
    for (const [, skill] of tags.matchAll(/<span class="tag">([^<]+)<\/span>/g)) projectSkills.add(skill);
  }
  assert.deepEqual([...projectSkills].sort(), [...aboutSkills].sort(), "About skills must match the projects' skills");
  for (const name of ["bug", "enhancement", "documentation"]) assert.ok(!aboutSkills.includes(name), `non-skill label ${name} leaked`);
});

test("guestbook links to GitHub Discussions and explains signing", () => {
  const text = html("guestbook/index.html");
  assert.match(text, /<a class="tag tag-link" href="https:\/\/github\.com\/EmilianoManaloIV\/EmilianoManaloIV\.github\.io\/discussions[^"]*">Sign the guestbook<\/a>/);
  assert.match(text, /Signing uses your GitHub account/);
  assert.match(html("index.html"), /<a href="\/guestbook\/">sign the guestbook<\/a>/, "Contact links the guestbook");
});

// ADR 0007: clips are local files that never autoplay from markup; js/main.js plays
// them only while motion is on. Visitors' comments and signatures carry no video.
test("clips are local, sized, muted, never autoplay, and only in the owner's text", () => {
  for (const page of pages) {
    const text = html(page);
    for (const tag of text.match(/<video\b[^>]*>/gi) ?? []) {
      const src = attrs(tag, "src")[0] ?? "";
      assert.match(src, /^(\/projects\/[\w-]+\/)?clip-\d+\.(mp4|webm)#t=0\.001$/, `${page}: clip source ${src}`);
      assert.ok(existsSync(join(site, target(page, src).file)), `${page}: missing clip ${src}`);
      for (const name of ["width", "height", "aria-label"]) assert.match(tag, new RegExp(`\\s${name}="[^"]+"`), `${page}: ${name} missing: ${tag}`);
      for (const flag of ["muted", "loop", "playsinline", "data-clip"]) assert.match(tag, new RegExp(`\\s${flag}[\\s>]`), `${page}: ${flag} missing: ${tag}`);
      assert.doesNotMatch(tag, /\sautoplay\b/, `${page}: clips must not autoplay without the motion gate`);
    }
    for (const block of text.match(/<li class="(comment|guestbook-entry)">[\s\S]*?<\/li>/g) ?? []) {
      assert.doesNotMatch(block, /<video/, `${page}: video in a visitor's text`);
    }
  }
  // WCAG 2.2.2: clips play from one place only, behind the motion gate.
  const main = read("js/main.js");
  assert.match(main, /video\[data-clip\]/, "main.js gates clips");
  assert.match(main, /const awake = motion && !document\.hidden;[\s\S]*const want = awake && clip\.seen === true;\s*if \(want !== clip\.want\) want \? clip\.play\(\)/, "clips play only when motion is on, the tab is visible, and the clip is on screen");
  for (const file of scripts) assert.equal((read(`js/${file}`).match(/\.play\(/g) ?? []).length, file === "main.js" ? 1 : 0, `${file}: play() outside the motion gate`);
  // The fixture build has clips in a post, a project page, and that project's home card.
  if (pages.some((p) => read(p).includes("FIXTURE-VISITOR-VIDEO"))) {
    const count = pages.reduce((n, p) => n + (html(p).match(/<video\b/g) ?? []).length, 0);
    assert.equal(count, 3, "fixture clips");
  }
});

// WCAG 2.2.2: anything that moves must be pausable, so every page carries the
// motion toggle in its shared footer, and main.js only animates when a toggle exists.
test("every page has a motion toggle, and motion runs only where one exists", () => {
  for (const page of pages) {
    const footer = html(page).match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0] ?? "";
    assert.match(footer, /<button[^>]*data-motion-toggle[^>]*aria-pressed=/, `${page}: no motion toggle in the footer`);
  }
  assert.match(read("js/main.js"), /let motion = pausable && \(savedMotion \? savedMotion === "on" : !reducedMotion\.matches\);/);
});

// Cache-busting: every script and stylesheet address carries the fingerprint of the
// file it points at, and module imports match, so a deploy never mixes old and new files.
test("every script and stylesheet URL is fingerprinted with its file's current hash", async () => {
  const { createHash } = await import("node:crypto");
  const fingerprint = (file) => createHash("sha256").update(readFileSync(join(site, file))).digest("hex").slice(0, 10);
  let checked = 0;
  for (const page of pages) {
    for (const [, path, version] of html(page).matchAll(/(?:href|src)="\/?(styles\.css|js\/[\w.-]+\.js)(?:\?v=([0-9a-f]+))?"/g)) {
      assert.equal(version, fingerprint(path), `${page}: ${path} is not fingerprinted with its current hash`);
      checked++;
    }
  }
  assert.ok(checked >= pages.length * 4, "expected stylesheet and scripts on every page");
  const imports = [...read("js/main.js").matchAll(/from "\.\/([\w.-]+\.js)(?:\?v=([0-9a-f]+))?"/g)];
  assert.ok(imports.length > 0, "main.js imports geometry.js");
  for (const [, file, version] of imports) assert.equal(version, fingerprint(`js/${file}`), `main.js imports ${file} without its current hash`);
});

test("index.html: has Open Graph tags for link previews", () => {
  const text = html("index.html");
  for (const prop of ["og:title", "og:description", "og:url", "og:type"]) {
    assert.match(text, new RegExp(`property="${prop}" content="[^"]+"`), prop);
  }
});

test("index.html: animated headline keeps a readable copy for screen readers", () => {
  const page = html("index.html");
  assert.match(page, /<span class="visually-hidden">Bridging technology, engineering, and art<\/span>/);
  const animated = page.match(/<span[^>]*data-scramble[^>]*>/g) ?? [];
  assert.equal(animated.length, 4, "expected four scrambled words");
  for (const tag of animated) assert.match(tag, /aria-hidden="true"/, `not hidden: ${tag}`);
});

test("index.html: motion and theme controls follow ADR 0002", () => {
  const page = html("index.html");
  for (const id of ["motion-toggle", "theme-toggle"]) {
    assert.match(page, new RegExp(`<button[^>]*id="${id}"[^>]*aria-pressed=`), `${id} button missing`);
  }
  assert.match(read("styles.css"), /html:not\(\.js-ready\) \.toggle/, "toggles must hide until main.js runs");
  assert.match(read("js/theme.js"), /classList\.add\("js"\)/);
  const main = read("js/main.js");
  assert.match(main, /classList\.add\("js-ready"\)/);
  assert.match(main, /prefers-reduced-motion: reduce[\s\S]*: !reducedMotion\.matches\)/, "motion must start paused under reduced motion");
});

test("index.html: interaction aids from ADR 0003 are present and named", () => {
  const page = html("index.html");
  assert.match(page, /<button[^>]*data-share[^>]*>Share this page<\/button>/, "share button");
  // The accessible name contains the visible label (WCAG 2.5.3).
  assert.match(page, /<button[^>]*data-copy-email="[^"]*" aria-label="Copy email address">Copy<\/button>/);
  assert.match(page, /<p class="copy-status" role="status" data-copy-status><\/p>/, "live region for copy feedback");
  const rail = page.match(/<nav class="section-rail" aria-label="Sections">[\s\S]*?<\/nav>/)[0];
  assert.equal((rail.match(/<a href="#\w+" aria-label="\w+"><\/a>/g) ?? []).length, 4, "one named rail dot per home section");
  assert.match(page, /<a class="section-bar" href="#site-nav"/);
  assert.match(page, /<script type="module" src="js\/ui\.js\?v=[0-9a-f]{10}"><\/script>/);
});

test("styles.css: ADR 0003 aids hide without ui.js and respect reduced motion", () => {
  const css = read("styles.css");
  for (const name of ["action", "section-rail", "section-bar"]) {
    assert.match(css, new RegExp(`html:not\\(\\.ui-ready\\) \\.${name}`), `.${name} hidden until ui.js runs`);
  }
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.section-bar[^@]*\}/);
  assert.ok(reduced && /\.section-rail a/.test(reduced[0]), "rail and bar transitions off under reduced motion");
  assert.match(read("js/ui.js"), /classList\.add\("ui-ready"\)/);
});

// ADR 0008: looping CSS motion runs only while main.js says motion is on, so the
// motion toggle stops it, reduced motion starts it off, and it never runs without
// JavaScript. Scroll-linked effects stay inside a no-preference media block.
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
function blocksAt(css, opener) {
  const found = [];
  for (let at = css.indexOf(opener); at !== -1; at = css.indexOf(opener, at + 1)) {
    let depth = 0;
    let i = css.indexOf("{", at);
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) break;
    }
    found.push([at, i + 1]);
  }
  return found;
}

// Splits a selector list on top-level commas only, so `:is(a, b)` stays whole.
function selectorList(selector) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    if (selector[i] === "(") depth++;
    else if (selector[i] === ")") depth--;
    else if (selector[i] === "," && depth === 0) {
      parts.push(selector.slice(start, i).trim());
      start = i + 1;
    }
  }
  return [...parts, selector.slice(start).trim()];
}

// main.js adds js-ready once it has run and sets motion-off from the toggle and
// reduced motion, so "js-ready but not motion-off" means motion is on.
test("styles.css: looping animations run only under html.js-ready:not(.motion-off) (ADR 0008)", () => {
  const css = withoutComments(read("styles.css"));
  // The console cursor is made by main.js and stops under .motion-off.
  const allowed = new Set([".terminal .cursor"]);
  let loops = 0;
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/animation[^:;]*:[^;]*\binfinite\b/.test(body)) continue;
    loops++;
    // Every selector in the list must be gated, not just one of them.
    for (const part of selectorList(selector)) {
      assert.ok(/^html\.js-ready:not\(\.motion-off\)\s/.test(part) || allowed.has(part), `infinite animation not gated by motion: ${part}`);
    }
  }
  assert.ok(loops >= 3, "the grid drift, dot shimmer, and echo drift should be found");
  const main = read("js/main.js");
  assert.match(main, /classList\.toggle\("motion-off", !on\)/);
  assert.match(main, /classList\.add\("js-ready"\)/);
});

test("styles.css: scroll-linked motion is screen-only, no-preference, and stops with the toggle (ADR 0008)", () => {
  const css = withoutComments(read("styles.css"));
  const safe = blocksAt(css, "@media screen and (prefers-reduced-motion: no-preference)");
  // The reading-progress bar is a status display, not decoration (ADR 0009): it
  // reports scroll position, so it stays on under reduced motion and motion off.
  const statusDisplays = new Set([".read-progress"]);
  let rules = 0;
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = match;
    if (!/animation-(timeline|range)\s*:/.test(body)) continue;
    const parts = selectorList(selector);
    if (parts.every((part) => statusDisplays.has(part))) continue;
    rules++;
    const at = match.index + selector.length;
    assert.ok(safe.some(([from, to]) => at > from && at < to), `scroll-linked rule outside a screen no-preference block: ${selector.trim()}`);
    for (const part of parts) {
      assert.ok(/^html(\.js-ready)?:not\(\.motion-off\)\s/.test(part), `scroll-linked motion not stopped by the toggle: ${part}`);
    }
  }
  assert.ok(rules >= 2, "the grid parallax and reveals should be found");
});

test("the progress bar and ambient wireframe sit in the shared header of every page (ADR 0009)", () => {
  for (const page of pages.filter((p) => p.endsWith(".html"))) {
    assert.match(
      html(page),
      /<header class="site-header">\s*<div class="read-progress" aria-hidden="true"><\/div>\s*<canvas class="ambient-scene" data-scene="ambient" aria-hidden="true"><\/canvas>/,
      page,
    );
  }
  // The ambient wireframe only has room in a wide margin: hidden by default and
  // shown on screens 1600px and up, so it never crowds a laptop or phone.
  const css = withoutComments(read("styles.css"));
  assert.match(css, /\.ambient-scene \{[^}]*display: none;/);
  const wide = blocksAt(css, "@media screen and (min-width: 1600px)");
  assert.ok(wide.some(([from, to]) => /\.ambient-scene \{[^}]*display: block/.test(css.slice(from, to))), "shown only at 1600px and up");
});

test("named sections carry a margin label matching their title (ADR 0009)", () => {
  // Attributes are read individually, so their order and extra classes don't matter.
  const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  let labels = 0;
  for (const page of pages.filter((p) => p.endsWith(".html"))) {
    for (const [, tag, body] of html(page).matchAll(/(<section\b[^>]*>)([\s\S]*?)<\/section>/g)) {
      const title = body.match(/<span class="section-index" aria-hidden="true">(\d{2}) \/<\/span> ([^<]+)<\/h2>/);
      const label = attr(tag, "data-label");
      if (!title) {
        assert.equal(label, undefined, `${page}: a label without a numbered title: ${tag}`);
        continue;
      }
      if (!(attr(tag, "class") ?? "").split(/\s+/).includes("section")) continue;
      labels++;
      assert.equal(label, `${title[1]} — ${title[2].trim()}`, `${page}: margin label missing or disagrees with the title: ${tag}`);
    }
  }
  assert.ok(labels >= 10, "home, About, R&D, and Guestbook sections should be found");
});

test("hands-on models are focusable, labelled, and resettable (ADR 0009)", () => {
  let models = 0;
  for (const page of pages.filter((p) => p.endsWith(".html"))) {
    for (const [canvas] of html(page).matchAll(/<canvas\b[^>]*>/g)) {
      if (!/tabindex="0"/.test(canvas)) {
        continue;
      }
      models++;
      assert.match(canvas, /role="img"/, `${page}: ${canvas}`);
      assert.match(canvas, /aria-roledescription="3D model"/, `${page}: ${canvas}`);
      assert.match(canvas, /aria-label="[^"]+"/, `${page}: ${canvas}`);
      assert.doesNotMatch(canvas, /aria-hidden/, `${page}: a focusable canvas must not be hidden`);
    }
    // Every hands-on model shows how to use it and how to undo it.
    const turnable = (html(page).match(/<canvas\b[^>]*tabindex="0"/g) ?? []).length;
    const resets = (html(page).match(/data-reset>Reset view<\/button>/g) ?? []).length;
    const hints = (html(page).match(/<span class="model-hint" aria-hidden="true">Drag or use arrow keys<\/span>/g) ?? []).length;
    assert.equal(resets, turnable, `${page}: every hands-on model needs a Reset view button`);
    assert.equal(hints, turnable, `${page}: every hands-on model needs a visible hint`);
  }
  assert.ok(models >= 3, "the torus, teapot, and headset should be found");
  assert.match(html("index.html"), /data-scene="teapot"/);
  assert.match(html("rd/index.html"), /data-scene="headset"/);
});

test("console echoes are decorative and hidden from screen readers", () => {
  const echoes = pages.flatMap((p) => html(p).match(/<pre class="terminal-echo"[^>]*>/g) ?? []);
  assert.ok(echoes.length >= 6, "three on the home page, one on each subpage heading");
  for (const tag of echoes) assert.match(tag, /aria-hidden="true"/, tag);
  for (const page of ["about/index.html", "rd/index.html", "guestbook/index.html"]) {
    assert.match(html(page), /class="page-hero[^"]*">\s*(?:<!--[^>]*-->\s*)?<pre class="terminal-echo" aria-hidden="true"><\/pre>/, page);
  }
});

test("every media figure has a numbered caption", () => {
  for (const page of pages) {
    for (const figure of html(page).match(/<figure class="card-media">[\s\S]*?<\/figure>/g) ?? []) {
      assert.match(figure, /<figcaption>FIG\. \d{2}\.\d \/ [^<]+<\/figcaption>/, `${page}: uncaptioned figure`);
    }
  }
});

test("styles.css: loads no external resources and every url() exists", () => {
  const css = read("styles.css");
  assert.doesNotMatch(css, /@import/, "@import is not allowed");
  for (const [, url] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    assert.ok(!isExternal(url) && !url.startsWith("//"), `external url() not allowed: ${url}`);
    assert.ok(existsSync(join(site, url)), `missing file in styles.css: ${url}`);
  }
});

// Walk js/ recursively so nested or .mjs files cannot escape the checks.
const scripts = list(join(site, "js")).filter((f) => /\.m?js$/.test(f));

test("js: makes no network requests and loads no remote code", () => {
  for (const file of scripts) {
    const code = read(`js/${file}`);
    assert.doesNotMatch(code, /https?:\/\//, `${file}: URLs are not allowed`);
    assert.doesNotMatch(code, /["'`]\/\/[\w.-]/, `${file}: protocol-relative URLs are not allowed`);
    assert.doesNotMatch(
      code,
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\bWorker\s*\(|importScripts|\.src\s*=/,
      `${file}: network API`,
    );
    assert.doesNotMatch(code, /\bimport\s*\(/, `${file}: dynamic import is not allowed`);
    for (const [, spec] of code.matchAll(/^\s*import\b[^"']*["']([^"']+)["']/gm)) {
      assert.match(spec, /^\.\//, `${file}: only relative imports allowed, got ${spec}`);
    }
  }
});

// Budget tracks bytes over the network: each file gzipped, as GitHub Pages serves it.
test("js: total gzipped size stays under the 32 KB budget (ADR 0003, amended by 0009)", () => {
  const bytes = scripts.reduce((sum, f) => sum + gzipSync(readFileSync(join(site, "js", f)), { level: 9 }).length, 0);
  assert.ok(bytes < 32 * 1024, `js/ is ${bytes} bytes gzipped`);
});

test("js: every file parses", () => {
  for (const file of scripts) {
    const result = spawnSync(process.execPath, ["--check", join(site, "js", file)], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test("emiliano-manalo.vcf: is a valid vCard with CRLF line endings", () => {
  const card = read("emiliano-manalo.vcf");
  assert.match(card, /^BEGIN:VCARD\r\n/);
  assert.match(card, /\r\nFN:[^\r\n]+\r\n/);
  assert.match(card, /END:VCARD\r\n?$/);
});

test("deploy workflow builds with tools/build.mjs and tests the result", () => {
  const workflow = source(".github/workflows/pages.yml");
  assert.match(workflow, /node tools\/build\.mjs/);
  assert.match(workflow, /node --test/);
  assert.match(workflow, /discussions: read/);
  assert.doesNotMatch(workflow, /discussions: write|contents: write/, "the build only reads");
  assert.match(workflow, /discussion:\s*\n\s*types: \[[^\]]*\blabeled\b[^\]]*\bunlabeled\b/, "adding a skill label must rebuild (ADR 0006)");
});

// Reported as a todo rather than a failure while content is still pending.
const todos = [...pages, "emiliano-manalo.vcf", "styles.css"].filter((f) => read(f).includes("TODO"));
test("launch readiness: no TODO placeholders remain", { todo: todos.length > 0 }, () => {
  assert.deepEqual(todos, [], `placeholders remain in: ${todos.join(", ")}`);
});

// ADR 0010: page copy and links come from site-text.md.
test("site text: the file is valid, and the built pages carry it with no markers left", () => {
  const { fields, links } = readSiteText(source("site-text.md"));
  for (const page of [...pages, "emiliano-manalo.vcf"]) {
    assert.doesNotMatch(read(page), /\sdata-(text|link)(-text)?\b/, `${page}: a site-text marker was left in the built page`);
  }
  const home = read("index.html");
  assert.ok(home.includes(`<p>${fields["home-subtitle"]}</p>`), "the home subtitle comes from site-text.md");
  assert.ok(read("about/index.html").includes(fields["about-one-liner"]), "the About one-liner comes from site-text.md");
  // One email everywhere: the mailto link, the copy button, and the contact card.
  assert.ok(home.includes(`href="mailto:${escapeHtml(links.email)}"`));
  assert.ok(home.includes(`data-copy-email="${escapeHtml(links.email)}"`));
  assert.ok(read("emiliano-manalo.vcf").split(/\r?\n/).includes(`EMAIL;TYPE=INTERNET:${links.email}`), "the contact card has the same email");
  // Social links: in every page's header and footer where set, gone everywhere where
  // blank. Pages hold the address HTML-escaped (an "&" in a URL becomes "&amp;").
  const labels = { linkedin: "LinkedIn", instagram: "Instagram", x: "X", github: "GitHub" };
  for (const [name, label] of Object.entries(labels)) {
    for (const page of pages) {
      const icons = (read(page).match(new RegExp(`<a href="([^"]*)" aria-label="${label}">`, "g")) ?? []).length;
      if (links[name]) {
        assert.equal(icons, 2, `${page}: the ${label} icon should be in the header and footer`);
        assert.ok(read(page).includes(`<a href="${escapeHtml(links[name])}" aria-label="${label}">`), `${page}: ${label} points elsewhere`);
      } else {
        assert.equal(icons, 0, `${page}: a blank ${label} link should be removed`);
      }
    }
  }
});

test("site text: marked elements never contain their own tag, so filling them is exact", () => {
  // applySiteText replaces up to the first closing tag of the same name; a nested
  // element of that tag inside a marked one would leave a stray tail (ADR 0010).
  for (const file of ["index.html", "about/index.html", "rd/index.html", "guestbook/index.html", "404.html", ...TEMPLATES]) {
    for (const [, tag, inner] of source(file).matchAll(/<([a-z][a-z0-9]*)\b[^>]*\sdata-text="[^"]+"[^>]*>([\s\S]*?)<\/\1>/g)) {
      assert.doesNotMatch(inner, new RegExp(`<${tag}\\b`), `${file}: a <${tag} data-text> holds another <${tag}>`);
    }
  }
});

test("site text: every editable spot in the source pages is a known key", () => {
  const keys = new Set(Object.keys(readSiteText(source("site-text.md")).fields));
  for (const file of ["index.html", "about/index.html", "rd/index.html", "guestbook/index.html", "404.html", ...TEMPLATES]) {
    for (const [, key] of source(file).matchAll(/data-text="([^"]+)"/g)) assert.ok(keys.has(key), `${file}: unknown data-text="${key}"`);
  }
});

// ADR 0011: the conference kit.
test("the QR card page shows the generated code, and the code encodes the site's address", async () => {
  const card = html("card/index.html");
  assert.match(card, /<img src="\/card\/qr\.svg(\?v=[0-9a-f]+)?" alt="QR code that opens emilianomanaloiv\.github\.io" width="296" height="296">/);
  const svg = read("card/qr.svg");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 37 37"/);
  assert.match(svg, /<rect width="37" height="37" fill="#fff"\/>/, "a white quiet zone, so it scans in dark mode");
  const { qrSvg } = await import("../tools/qr.mjs");
  assert.equal(svg, qrSvg(`${SITE}/`, { title: "QR code for emilianomanaloiv.github.io" }), "built from the site's own address");
  for (const page of pages) assert.match(html(page), /<a href="\/card\/">Show my QR card<\/a>/, `${page}: footer link to the card`);
});

test("the sitemap lists exactly the real pages, and robots points at it", () => {
  const xml = read("sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = pages
    .filter((p) => p.endsWith(".html") && p !== "404.html")
    .map((p) => `${SITE}/${p.split(sep).join("/").replace(/index\.html$/, "")}`)
    .sort();
  assert.deepEqual([...locs].sort(), expected);
  assert.ok(locs.includes(`${SITE}/card/`));
  assert.match(read("robots.txt"), new RegExp(`^Sitemap: ${SITE}/sitemap\.xml$`, "m"));
});

test("the web manifest is valid and linked from every page", () => {
  const manifest = JSON.parse(read("site.webmanifest"));
  assert.equal(manifest.short_name, "EM");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.every((icon) => existsSync(join(site, icon.src))), "every manifest icon exists");
  for (const page of pages) assert.match(html(page), /<link rel="manifest" href="\/?site\.webmanifest">/, page);
});

test("preview and touch-icon tags appear only when their images exist", () => {
  const share = existsSync(join(repo, "assets", "img", "share.png"));
  const touch = existsSync(join(repo, "assets", "img", "apple-touch-icon.png"));
  for (const page of pages) {
    const text = html(page);
    assert.equal(/property="og:image"/.test(text), share && /twitter:card/.test(text), `${page}: og:image`);
    assert.equal(/rel="apple-touch-icon"/.test(text), touch, `${page}: apple-touch-icon`);
  }
});

// == Pre-launch audit (ADR 0012)

// WCAG contrast computed from the design tokens themselves, for both themes, so a
// colour change that hurts legibility fails here rather than in front of a visitor.
function themeTokens(css, theme) {
  // The rule's body: from "selector {" to the first line that is just "}".
  const block = (selector) => {
    const at = css.indexOf(`${selector} {`);
    return at === -1 ? "" : css.slice(at, css.indexOf("\n}", at));
  };
  const tokens = {};
  const take = (text) => {
    for (const [, name, value] of text.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) tokens[name] = value.trim();
  };
  take(block(":root"));
  if (theme === "dark") take(block(':root[data-theme="dark"]'));
  const resolve = (value, depth = 0) => {
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    return ref && depth < 10 ? resolve(tokens[ref[1]], depth + 1) : value;
  };
  return (name) => {
    const value = resolve(tokens[name]);
    const hex = /^#([0-9a-f]{6})$/i.exec(value);
    if (hex) return { rgb: [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)), alpha: 1 };
    const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(value);
    if (rgb) return { rgb: rgb.slice(1, 4).map(Number), alpha: rgb[4] ? Number(rgb[4]) : 1 };
    throw new Error(`${theme}: can't read ${name} = ${value}`);
  };
}
const luminance = (rgb) =>
  rgb.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
function contrast(fg, bg) {
  const shown = fg.rgb.map((c, i) => c * fg.alpha + bg.rgb[i] * (1 - fg.alpha));
  const [a, b] = [luminance(shown), luminance(bg.rgb)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

test("contrast: every text and control colour meets WCAG AA in both themes (ADR 0012)", (t) => {
  const css = withoutComments(read("styles.css"));
  // [foreground, background, minimum, where]. 4.5:1 for text, 3:1 for large text
  // (24px+, or 18.66px+ bold) and for focus rings. Decorative, aria-hidden marks
  // (frame corners, ticks, margin labels, echoes) are left out on purpose.
  const pairs = [
    ["--color-ink", "--color-bg", 4.5, "body text"],
    ["--color-ink-muted", "--color-bg", 4.5, "muted text, section titles, captions"],
    ["--color-ink-muted", "--color-slot", 4.5, "placeholder slots"],
    ["--color-panel-ink", "--color-panel", 4.5, "text on dark panels"],
    ["--color-panel-ink-muted", "--color-panel", 4.5, "muted text on dark panels"],
    ["--color-tag-ink", "--color-tag", 4.5, "skill tags"],
    ["--color-tag-primary-ink", "--color-tag-primary", 4.5, "orange link buttons"],
    ["--brand-mint", "--color-panel", 4.5, "banner labels and toggle"],
    ["--brand-red", "--color-panel", 3, "Bridging: Technology (large)"],
    ["--brand-amber", "--color-panel", 3, "Bridging: Engineering (large)"],
    ["--brand-yellow", "--color-panel", 3, "Bridging: Art (large)"],
    ["--brand-magenta", "--color-panel", 3, "value heading (large)"],
    ["--brand-blue", "--color-panel", 3, "value heading (large)"],
    ["--color-focus", "--color-bg", 3, "focus ring"],
    ["--color-focus", "--color-panel", 3, "focus ring on panels"],
    ["--color-marker", "--color-bg", 3, "current-page underline and active rail dot"],
    ["--color-marker", "--color-panel", 3, "active rail dot over the banner"],
    ["--color-rail", "--color-bg", 3, "rail dots"],
    ["--color-rail", "--color-panel", 3, "rail dots over the banner"],
  ];
  for (const theme of ["light", "dark"]) {
    const color = themeTokens(css, theme);
    for (const [fg, bg, min, where] of pairs) {
      const ratio = contrast(color(fg), color(bg));
      t.diagnostic(`${theme} ${where}: ${ratio.toFixed(2)}:1`);
      assert.ok(ratio >= min, `${theme}: ${where} (${fg} on ${bg}) is ${ratio.toFixed(2)}:1, needs ${min}:1`);
    }
  }
  // The token test only means something if the buttons and tags really use them.
  assert.match(css, /\.tag-link \{[^}]*color: var\(--color-tag-primary-ink\)/);
  assert.match(css, /\.tag \{[^}]*background: var\(--color-tag\);[^}]*color: var\(--color-tag-ink\)/);
  assert.doesNotMatch(css.match(/\.tag-count \{[^}]*\}/)?.[0] ?? "", /opacity/, "dimming the count would drop it below 4.5:1");
  assert.match(css, /\.nav-list a\[aria-current\] \{[^}]*text-decoration-color: var\(--color-marker\)/);
  assert.match(css, /\.section-rail a \{[^}]*background: var\(--color-rail\)/);
  // The system dark mode and the toggle's dark mode must define the same colours.
  const darkBlock = (start) => {
    const at = css.indexOf(start);
    return [...css.slice(at, css.indexOf("}", at)).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => `${m[1]}=${m[2].trim()}`).sort();
  };
  assert.deepEqual(darkBlock(':root:not([data-theme="light"]) {'), darkBlock(':root[data-theme="dark"] {'));
});

// Bytes over the network for one visit: the page, the stylesheet, every script,
// and every font (the worst case, before the browser caches anything).
test("page weight: every page loads in under 200 KB gzipped (ADR 0012)", (t) => {
  const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
  const shared =
    gz(join(site, "styles.css")) +
    readdirSync(join(site, "js")).reduce((sum, f) => sum + gz(join(site, "js", f)), 0) +
    readdirSync(join(site, "assets", "fonts")).filter((f) => f.endsWith(".woff2")).reduce((sum, f) => sum + readFileSync(join(site, "assets", "fonts", f)).length, 0);
  for (const page of pages.filter((p) => p.endsWith(".html"))) {
    const total = gz(join(site, page)) + shared;
    t.diagnostic(`${page}: ${Math.round(total / 1024)} KB`);
    assert.ok(total < 200 * 1024, `${page} is ${Math.round(total / 1024)} KB`);
  }
});

test("print: always black on white, with decoration and controls left out (ADR 0012)", () => {
  const css = withoutComments(read("styles.css"));
  // Only the site-wide print block counts (the QR card has its own), so a check here
  // can't pass on the strength of the card's rules.
  const print = blocksAt(css, "@media print").map(([from, to]) => css.slice(from, to)).find((block) => block.includes(":root:root:root"));
  assert.ok(print, "a site-wide print block exists");
  // Cream text would vanish on paper, since browsers drop page backgrounds when printing.
  const tokens = [["--color-bg", "#fff"], ["--color-ink", "#000"], ["--color-panel-ink", "#000"], ["--brand-mint", "#000"], ["--color-tag-ink", "#000"], ["--color-tag-primary-ink", "#000"]];
  for (const [token, value] of tokens) assert.ok(print.includes(`${token}: ${value};`), `print sets ${token}`);
  const hiddenRule = print.match(/([^{}]+)\{\s*display: none !important;\s*\}/)?.[1] ?? "";
  for (const hidden of [".site-header", ".banner", ".model", ".terminal-echo", ".ambient-scene", ".toggle", ".action", ".skip-link"]) {
    assert.ok(selectorList(hiddenRule).includes(hidden), `print hides ${hidden}`);
  }
  assert.match(print, /a\[href\^="http"\]::after \{\s*content: " \(" attr\(href\) "\)";/, "outside links show their address");
});
