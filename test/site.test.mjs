// Site checks. Uses only Node built-ins so the project stays dependency-free.
// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "404.html"];
const read = (file) => readFileSync(join(root, file), "utf8");

// Strip comments so commented-out examples are not checked.
const html = (file) => read(file).replace(/<!--[\s\S]*?-->/g, "");
const attrs = (source, name) =>
  [...source.matchAll(new RegExp(`\\s${name}="([^"]*)"`, "g"))].map((m) => m[1]);
const isExternal = (url) => /^(https?:|mailto:|tel:)/.test(url);

for (const page of pages) {
  test(`${page}: has no scripts or external stylesheets`, () => {
    const source = html(page);
    assert.doesNotMatch(source, /<script\b/i, "scripts are not allowed");
    for (const tag of source.match(/<link\b[^>]*>/gi) ?? []) {
      const href = tag.match(/href="([^"]*)"/)?.[1] ?? "";
      if (/rel="(stylesheet|preload|modulepreload|icon)"/.test(tag)) {
        assert.ok(!isExternal(href), `external resource not allowed: ${href}`);
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

test("styles.css: loads no external resources", () => {
  const css = read("styles.css");
  assert.doesNotMatch(css, /@import/, "@import is not allowed");
  assert.doesNotMatch(css, /url\(\s*["']?https?:/, "external url() is not allowed");
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
