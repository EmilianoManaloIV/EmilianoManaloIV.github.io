// Site checks. Uses only Node built-ins so the project stays dependency-free.
// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "404.html"];
const read = (file) => readFileSync(join(root, file), "utf8");

// Strip comments so commented-out examples are not checked.
const html = (file) => read(file).replace(/<!--[\s\S]*?-->/g, "");
// Attribute values, double- or single-quoted.
const attrs = (source, name) =>
  [...source.matchAll(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "gi"))].map((m) => m[1] ?? m[2]);
const isExternal = (url) => /^(https?:|mailto:|tel:)/.test(url);

for (const page of pages) {
  test(`${page}: scripts are local files only, with no inline code`, () => {
    const source = html(page);
    for (const [, attributes, body] of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = attrs(attributes, "src")[0];
      assert.ok(src, "inline scripts are not allowed");
      assert.ok(!isExternal(src), `external script not allowed: ${src}`);
      assert.equal(body.trim(), "", `script with src must be empty: ${src}`);
    }
  });

  test(`${page}: has no external stylesheets, fonts, or icons`, () => {
    const source = html(page);
    // Only rel="canonical" may point off-site; every other link must be local.
    for (const tag of source.match(/<link\b[^>]*>/gi) ?? []) {
      const href = attrs(tag, "href")[0] ?? "";
      const rel = (attrs(tag, "rel")[0] ?? "").toLowerCase();
      if (rel !== "canonical") {
        assert.ok(!isExternal(href) && !href.startsWith("//"), `external ${rel} not allowed: ${href}`);
      }
    }
  });

  test(`${page}: local src and href targets exist`, () => {
    const source = html(page);
    for (const url of [...attrs(source, "src"), ...attrs(source, "href")]) {
      if (isExternal(url) || url.startsWith("#")) continue;
      const path = url.split(/[?#]/)[0].replace(/^\//, "") || "index.html";
      assert.ok(existsSync(join(root, path)), `missing file: ${url}`);
    }
  });

  test(`${page}: has title, description, and viewport`, () => {
    const source = html(page);
    assert.match(source, /<html lang="[^"]+"/);
    assert.match(source, /<title>[^<]+<\/title>/);
    assert.match(source, /<meta name="description" content="[^"]+"/);
    assert.match(source, /<meta name="viewport"/);
  });
}

test("index.html: every in-page link has a matching id", () => {
  const source = html("index.html");
  const ids = new Set(attrs(source, "id"));
  for (const href of attrs(source, "href").filter((h) => h.startsWith("#"))) {
    assert.ok(ids.has(href.slice(1)), `no element with id for ${href}`);
  }
});

test("index.html: ids are unique", () => {
  const ids = attrs(html("index.html"), "id");
  assert.equal(new Set(ids).size, ids.length, "duplicate id found");
});

test("index.html: every image has alt, width, and height", () => {
  for (const tag of html("index.html").match(/<img\b[^>]*>/gi) ?? []) {
    for (const name of ["alt", "width", "height"]) {
      assert.match(tag, new RegExp(`\\s${name}="`), `${name} missing: ${tag}`);
    }
  }
});

test("index.html: has Open Graph tags for link previews", () => {
  const source = html("index.html");
  for (const prop of ["og:title", "og:description", "og:url", "og:type"]) {
    assert.match(source, new RegExp(`property="${prop}" content="[^"]+"`), prop);
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

test("index.html: motion and theme controls follow ADR 0002", () => {
  const page = html("index.html");
  for (const id of ["motion-toggle", "theme-toggle"]) {
    assert.match(page, new RegExp(`<button[^>]*id="${id}"[^>]*aria-pressed=`), `${id} button missing`);
  }
  assert.match(read("styles.css"), /html:not\(\.js-ready\) \.toggle/, "toggles must hide until main.js runs");
  assert.match(read("js/theme.js"), /classList\.add\("js"\)/);
  const main = read("js/main.js");
  assert.match(main, /classList\.add\("js-ready"\)/);
  assert.match(
    main,
    /prefers-reduced-motion: reduce[\s\S]*let motion = !reducedMotion\.matches/,
    "motion must start paused under reduced motion",
  );
});

test("index.html: animated headline keeps a readable copy for screen readers", () => {
  const page = html("index.html");
  assert.match(page, /<span class="visually-hidden">Bridging technology, engineering, and art<\/span>/);
  const animated = page.match(/<span[^>]*data-scramble[^>]*>/g) ?? [];
  assert.equal(animated.length, 4, "expected four scrambled words");
  for (const tag of animated) assert.match(tag, /aria-hidden="true"/, `not hidden: ${tag}`);
});

test("index.html: interaction aids from ADR 0003 are present and named", () => {
  const page = html("index.html");
  assert.match(page, /<button[^>]*data-share[^>]*>Share this page<\/button>/, "share button");
  // The accessible name contains the visible label (WCAG 2.5.3).
  assert.match(page, /<button[^>]*data-copy-email="[^"]*" aria-label="Copy email address">Copy<\/button>/);
  assert.match(page, /<p class="copy-status" role="status" data-copy-status><\/p>/, "live region for copy feedback");
  assert.match(page, /data-talk data-start="[^"]*" data-end="[^"]*"/, "talk session times");
  assert.match(page, /<nav class="section-rail" aria-label="Sections">/);
  const railLinks = page.match(/<a href="#\w+" aria-label="\w+"><\/a>/g) ?? [];
  assert.equal(railLinks.length, 6, "every rail dot has an accessible name");
  assert.match(page, /<a class="section-bar" href="#site-nav"/);
  assert.match(page, /<script type="module" src="js\/ui.js"><\/script>/);
});

test("index.html: every media figure has a numbered caption", () => {
  const page = html("index.html");
  const figures = page.match(/<figure class="card-media">[\s\S]*?<\/figure>/g) ?? [];
  assert.ok(figures.length >= 5);
  for (const figure of figures) assert.match(figure, /<figcaption>FIG\. \d{2}\.\d \/ [^<]+<\/figcaption>/);
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

// Reported as a todo rather than a failure while content is still pending.
const todos = ["index.html", "emiliano-manalo.vcf", "styles.css"].filter((f) =>
  read(f).includes("TODO"),
);
test("launch readiness: no TODO placeholders remain", { todo: todos.length > 0 }, () => {
  assert.deepEqual(todos, [], `placeholders remain in: ${todos.join(", ")}`);
});
