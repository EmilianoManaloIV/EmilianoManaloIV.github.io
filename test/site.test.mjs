// Site checks. Uses only Node built-ins so the project stays dependency-free.
// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const SITE = "https://emilianomanaloiv.github.io";

// Every deployed page: HTML files outside tooling folders (templates are not deployed).
const skip = new Set(["test", "templates", "docs", "node_modules", ".git", ".github", ".claude", "assets", "js"]);
const pages = readdirSync(root, { recursive: true })
  .map((f) => f.split(sep).join("/"))
  .filter((f) => f.endsWith(".html") && !skip.has(f.split("/")[0]))
  .sort();

// Strip comments so commented-out examples are not checked.
const html = (file) => read(file).replace(/<!--[\s\S]*?-->/g, "");
// Attribute values, double- or single-quoted.
const attrs = (source, name) =>
  [...source.matchAll(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "gi"))].map((m) => m[1] ?? m[2]);
const isExternal = (url) => /^(https?:|mailto:|tel:)/.test(url);

// Resolve a local href or src from a page to a file path and optional fragment.
function target(page, url) {
  const [path, hash = ""] = url.split("?")[0].split("#");
  let file = path.startsWith("/") ? path.slice(1) : relative(root, resolve(root, dirname(page), path)).split(sep).join("/");
  if (path === "") file = page;
  if (file === "" || file.endsWith("/")) file += "index.html";
  return { file, hash };
}

test("site has the expected pages", () => {
  for (const page of ["index.html", "404.html", "about/index.html", "rd/index.html"]) {
    assert.ok(pages.includes(page), `${page} missing`);
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

  test(`${page}: has no external stylesheets, fonts, or icons`, () => {
    // Only rel="canonical" may point off-site; every other link must be local.
    for (const tag of html(page).match(/<link\b[^>]*>/gi) ?? []) {
      const href = attrs(tag, "href")[0] ?? "";
      const rel = (attrs(tag, "rel")[0] ?? "").toLowerCase();
      if (rel !== "canonical") {
        assert.ok(!isExternal(href) && !href.startsWith("//"), `external ${rel} not allowed: ${href}`);
      }
    }
  });

  test(`${page}: local links, sources, and #anchors resolve across pages`, () => {
    const source = html(page);
    for (const url of [...attrs(source, "src"), ...attrs(source, "href")]) {
      if (isExternal(url) || url.startsWith("//")) continue;
      const { file, hash } = target(page, url);
      assert.ok(existsSync(join(root, file)), `${page}: missing file for ${url}`);
      if (hash && file.endsWith(".html")) {
        assert.ok(attrs(html(file), "id").includes(hash), `${page}: no #${hash} in ${file}`);
      }
    }
  });

  test(`${page}: has lang, title, description, viewport, and canonical`, () => {
    const source = html(page);
    assert.match(source, /<html lang="[^"]+"/);
    assert.match(source, /<title>[^<]+<\/title>/);
    assert.match(source, /<meta name="description" content="[^"]+"/);
    assert.match(source, /<meta name="viewport"/);
    assert.match(source, new RegExp(`<link rel="canonical" href="${SITE}/`));
  });

  test(`${page}: ids are unique and every image has alt, width, and height`, () => {
    const source = html(page);
    const ids = attrs(source, "id");
    assert.equal(new Set(ids).size, ids.length, "duplicate id found");
    for (const tag of source.match(/<img\b[^>]*>/gi) ?? []) {
      for (const name of ["alt", "width", "height"]) assert.match(tag, new RegExp(`\\s${name}="`), `${name} missing: ${tag}`);
    }
  });
}

test("pages have unique titles and canonical URLs", () => {
  const titles = pages.map((p) => html(p).match(/<title>([^<]+)<\/title>/)[1]);
  const canonicals = pages.map((p) => attrs(html(p).match(/<link rel="canonical"[^>]*>/)[0], "href")[0]);
  assert.equal(new Set(titles).size, titles.length, "duplicate title");
  assert.equal(new Set(canonicals).size, canonicals.length, "duplicate canonical");
});

// ADR 0004: no templating tool, so the shared header and footer must stay identical.
test("every page repeats the home page's header and footer exactly", () => {
  const chrome = (file) => {
    const source = read(file).replace(/ aria-current="page"/g, "");
    return ["header", "footer"].map((tag) => source.match(new RegExp(`<${tag} class="site-${tag}">[\\s\\S]*?</${tag}>`))?.[0]);
  };
  const [header, footer] = chrome("index.html");
  assert.ok(header && footer, "index.html header or footer not found");
  for (const page of [...pages, "templates/rd-post.html"]) {
    const [h, f] = chrome(page);
    assert.equal(h, header, `${page}: header differs from index.html`);
    assert.equal(f, footer, `${page}: footer differs from index.html`);
  }
});

test("each subpage marks exactly its own nav item; home and 404 mark none", () => {
  const marks = (file) => html(file).match(/<a href="([^"]+)" aria-current="page">/g) ?? [];
  assert.deepEqual(marks("index.html"), []);
  assert.deepEqual(marks("404.html"), []);
  assert.deepEqual(marks("about/index.html"), ['<a href="/#about" aria-current="page">']);
  for (const page of pages.filter((p) => p.startsWith("rd/"))) {
    assert.deepEqual(marks(page), ['<a href="/rd/" aria-current="page">'], page);
  }
});

test("every page loads the shared scripts and a skip link", () => {
  for (const page of [...pages, "templates/rd-post.html"]) {
    const source = html(page);
    for (const script of ["js/theme.js", "js/main.js", "js/ui.js"]) {
      assert.match(source, new RegExp(`<script[^>]*src="/?${script.replace(".", "\\.")}"`), `${page}: missing ${script}`);
    }
    assert.match(source, /<a class="skip-link" href="#main">/, `${page}: missing skip link`);
  }
});

test("main.js animates only where the motion toggle can pause it", () => {
  assert.match(read("js/main.js"), /let motion = !reducedMotion\.matches && pausable;/);
});

test("R&D: every post is listed on the index, dated, and linked to its discussion", () => {
  const index = html("rd/index.html");
  // Every page under rd/ except the index is a post, however deeply nested.
  const posts = pages.filter((p) => p.startsWith("rd/") && p !== "rd/index.html");
  for (const post of posts) {
    const slug = post.replace(/^rd\//, "").replace(/\/?index\.html$/, "");
    assert.match(index, new RegExp(`href="/rd/${slug}/"`), `${slug} is not listed on rd/index.html`);
    const source = html(post);
    assert.match(source, /<time datetime="\d{4}-\d{2}-\d{2}">/, `${slug}: needs a <time datetime>`);
    assert.match(source, /href="https:\/\/github\.com\/EmilianoManaloIV\/EmilianoManaloIV\.github\.io\/discussions\/\d+"/, `${slug}: needs its Discussions thread`);
  }
});

test("index.html: has Open Graph tags for link previews", () => {
  const source = html("index.html");
  for (const prop of ["og:title", "og:description", "og:url", "og:type"]) {
    assert.match(source, new RegExp(`property="${prop}" content="[^"]+"`), prop);
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
  assert.match(main, /prefers-reduced-motion: reduce[\s\S]*let motion = !reducedMotion\.matches/, "motion must start paused under reduced motion");
});

test("index.html: interaction aids from ADR 0003 are present and named", () => {
  const page = html("index.html");
  assert.match(page, /<button[^>]*data-share[^>]*>Share this page<\/button>/, "share button");
  // The accessible name contains the visible label (WCAG 2.5.3).
  assert.match(page, /<button[^>]*data-copy-email="[^"]*" aria-label="Copy email address">Copy<\/button>/);
  assert.match(page, /<p class="copy-status" role="status" data-copy-status><\/p>/, "live region for copy feedback");
  assert.match(page, /<nav class="section-rail" aria-label="Sections">/);
  const rail = page.match(/<nav class="section-rail"[\s\S]*?<\/nav>/)[0];
  const dots = rail.match(/<a href="#\w+" aria-label="\w+"><\/a>/g) ?? [];
  assert.equal(dots.length, 4, "one named rail dot per home section");
  assert.match(page, /<a class="section-bar" href="#site-nav"/);
  assert.match(page, /<script type="module" src="js\/ui.js"><\/script>/);
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
    assert.ok(existsSync(join(root, url)), `missing file in styles.css: ${url}`);
  }
});

// Walk js/ recursively so nested or .mjs files cannot escape the checks.
const scripts = readdirSync(join(root, "js"), { recursive: true }).filter((f) => /\.m?js$/.test(f));

test("js: makes no network requests and loads no remote code", () => {
  for (const file of scripts) {
    const code = read(join("js", file));
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
  const bytes = scripts.reduce((sum, f) => sum + gzipSync(readFileSync(join(root, "js", f)), { level: 9 }).length, 0);
  assert.ok(bytes < 10 * 1024, `js/ is ${bytes} bytes gzipped`);
});

test("js: every file parses", () => {
  for (const file of scripts) {
    const result = spawnSync(process.execPath, ["--check", join(root, "js", file)], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test("emiliano-manalo.vcf: is a valid vCard with CRLF line endings", () => {
  const card = read("emiliano-manalo.vcf");
  assert.match(card, /^BEGIN:VCARD\r\n/);
  assert.match(card, /\r\nFN:[^\r\n]+\r\n/);
  assert.match(card, /END:VCARD\r\n?$/);
});

test(".github/workflows/pages.yml: deploys every page folder", () => {
  const copied = read(".github/workflows/pages.yml").match(/cp -r ([^\n]+) _site\//)[1].split(/\s+/);
  for (const folder of new Set(pages.filter((p) => p.includes("/")).map((p) => p.split("/")[0]))) {
    assert.ok(copied.includes(folder), `${folder}/ is not copied into _site`);
  }
});

// Reported as a todo rather than a failure while content is still pending.
const todos = [...pages, "emiliano-manalo.vcf", "styles.css"].filter((f) => read(f).includes("TODO"));
test("launch readiness: no TODO placeholders remain", { todo: todos.length > 0 }, () => {
  assert.deepEqual(todos, [], `placeholders remain in: ${todos.join(", ")}`);
});
