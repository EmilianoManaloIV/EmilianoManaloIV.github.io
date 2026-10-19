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
  "sub summary sup table tbody td th thead time title tr ul").split(" "));
const SAFE_ATTRS = /^(alt|align|as|charset|class|content|crossorigin|datetime|download|height|href|http-equiv|id|lang|loading|media|name|property|rel|role|src|start|title|type|width|aria-[a-z]+|data-[a-z-]+)$/;
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
  const [header, footer] = chrome(read("index.html"));
  assert.ok(header && footer, "index.html header or footer not found");
  for (const [name, text] of [...pages.map((p) => [p, read(p)]), ...TEMPLATES.map((t) => [t, source(t)])]) {
    const [h, f] = chrome(text);
    assert.equal(h, header, `${name}: header differs from index.html`);
    assert.equal(f, footer, `${name}: footer differs from index.html`);
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

test("styles.css: looping animations run only under html.motion-on (ADR 0008)", () => {
  const css = withoutComments(read("styles.css"));
  // The console cursor is made by main.js and stops under .motion-off.
  const allowed = new Set([".terminal .cursor"]);
  let loops = 0;
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/animation[^:;]*:[^;]*\binfinite\b/.test(body)) continue;
    loops++;
    // Every selector in the list must be gated, not just one of them.
    for (const part of selectorList(selector)) {
      assert.ok(/^html\.motion-on(?![\w-])/.test(part) || allowed.has(part), `infinite animation not gated by html.motion-on: ${part}`);
    }
  }
  assert.ok(loops >= 3, "the grid drift, dot shimmer, and echo drift should be found");
  assert.match(read("js/main.js"), /classList\.toggle\("motion-on", on\)/);
});

test("styles.css: scroll-linked motion is screen-only, no-preference, and stops with the toggle (ADR 0008)", () => {
  const css = withoutComments(read("styles.css"));
  const safe = blocksAt(css, "@media screen and (prefers-reduced-motion: no-preference)");
  const uses = [...css.matchAll(/animation-timeline\s*:/g)].map((m) => m.index);
  assert.ok(uses.length >= 2, "the grid parallax and reveals should be found");
  for (const at of uses) {
    assert.ok(safe.some(([from, to]) => at > from && at < to), `animation-timeline outside a screen no-preference block at offset ${at}`);
  }
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/animation-(timeline|range)\s*:/.test(body)) continue;
    for (const part of selectorList(selector)) {
      assert.ok(/^html(:not\(\.motion-off\)|\.motion-on)(?![\w-])/.test(part), `scroll-linked motion not stopped by the toggle: ${part}`);
    }
  }
});

test("console echoes are decorative and hidden from screen readers", () => {
  const echoes = pages.flatMap((p) => html(p).match(/<pre class="terminal-echo"[^>]*>/g) ?? []);
  assert.ok(echoes.length >= 3, "the home page has three echoes");
  for (const tag of echoes) assert.match(tag, /aria-hidden="true"/, tag);
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
test("js: total gzipped size stays under the 10 KB budget (ADR 0003)", () => {
  const bytes = scripts.reduce((sum, f) => sum + gzipSync(readFileSync(join(site, "js", f)), { level: 9 }).length, 0);
  assert.ok(bytes < 10 * 1024, `js/ is ${bytes} bytes gzipped`);
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
