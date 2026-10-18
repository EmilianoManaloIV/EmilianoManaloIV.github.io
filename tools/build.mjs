// Builds the deployable site into _site/ (ADR 0005): copies the static files, then
// turns GitHub Discussions into R&D posts, their comments, and the guestbook.
// Zero dependencies. Usage:
//   node tools/build.mjs                    real content (GITHUB_TOKEN, GH_TOKEN, or `gh auth token`)
//   node tools/build.mjs --offline          no posts or signatures; for quick previews and CI tests
//   node tools/build.mjs --fixture <file>   content from a saved JSON file, for tests and previews
//   --out _name                             build into another "_"-prefixed folder of the project
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import * as r from "./render.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://emilianomanaloiv.github.io";
const REPO = process.env.GITHUB_REPOSITORY || "EmilianoManaloIV/EmilianoManaloIV.github.io";
const STATIC = ["index.html", "404.html", "styles.css", "favicon.svg", "emiliano-manalo.vcf", "assets", "js", "about", "rd", "guestbook"];
// Limits for images found in posts and comments, which strangers can write.
// Attempts count against maxPerPage whether they succeed or not, so a comment full of
// dead links can't stall the build; pageBytes keeps a page's images well under Pages limits.
const IMAGE = { maxBytes: 10 * 1024 * 1024, pageBytes: 25 * 1024 * 1024, maxPerPage: 20, maxSide: 20000, timeoutMs: 15000 };
const API_TIMEOUT_MS = 30000;

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = resolve(root, option("--out") ?? "_site");
const fixturePath = option("--fixture");
const offline = args.includes("--offline");

// GitHub Actions shows these as warnings on the run.
const warn = (message) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `warning: ${message}`);

// == Content sources

const COMMENT = "url createdAt isMinimized bodyHTML author { login }";
const COMMENTS = `comments(first: 100, after: $after) { totalCount pageInfo { hasNextPage endCursor } nodes { ${COMMENT} replies(first: 50) { nodes { ${COMMENT} } } } }`;
const DISCUSSIONS = `query($owner: String!, $name: String!, $cursor: String, $after: String) {
  repository(owner: $owner, name: $name) {
    discussionCategories(first: 50) { nodes { name } }
    discussions(first: 50, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { number title url createdAt bodyHTML author { login } category { name } ${COMMENTS} }
    }
  }
}`;
const MORE_COMMENTS = `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) { discussion(number: $number) { ${COMMENTS} } }
}`;

function token() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  const gh = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
  if (gh.status === 0 && gh.stdout.trim()) return gh.stdout.trim();
  throw new Error("No GitHub token. Set GITHUB_TOKEN, run `gh auth login`, or use --offline.");
}

async function graphql(auth, query, variables) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${auth}`, "Content-Type": "application/json", "User-Agent": "site-build" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!response.ok || json.errors) throw new Error(`GitHub API ${response.status}: ${JSON.stringify(json.errors ?? json).slice(0, 500)}`);
  return json.data;
}

// Every discussion; then every comment, but only for the ones the site shows.
async function fetchDiscussions() {
  const auth = token();
  const [owner, name] = REPO.split("/");
  const all = [];
  let categories = [];
  let cursor = null;
  do {
    const repo = (await graphql(auth, DISCUSSIONS, { owner, name, cursor, after: null })).repository;
    if (!cursor) categories = repo.discussionCategories.nodes.map((c) => c.name);
    all.push(...repo.discussions.nodes);
    cursor = repo.discussions.pageInfo.hasNextPage ? repo.discussions.pageInfo.endCursor : null;
  } while (cursor);
  const guestbook = r.findGuestbook(all);
  for (const discussion of all.filter((d) => r.isPost(d) || d === guestbook)) {
    let { pageInfo } = discussion.comments;
    while (pageInfo.hasNextPage) {
      const thread = (await graphql(auth, MORE_COMMENTS, { owner, name, number: discussion.number, after: pageInfo.endCursor })).repository.discussion;
      if (!thread) break; // Deleted while building; the next build drops it.
      discussion.comments.nodes.push(...thread.comments.nodes);
      pageInfo = thread.comments.pageInfo;
    }
  }
  return { discussions: all, categories, images: null };
}

async function loadContent() {
  if (offline) return { discussions: [], categories: null, images: null };
  if (fixturePath) {
    const data = JSON.parse(readFileSync(resolve(root, fixturePath), "utf8"));
    return { discussions: data.discussions, categories: data.categories ?? null, images: data.images ?? {} };
  }
  return fetchDiscussions();
}

// == Images: copied into the page's folder so visitors make no outside requests.
// Only GitHub's image hosts are fetched, with a timeout and a size cap while reading.

async function readCapped(response) {
  const declared = Number(response.headers.get("content-length"));
  if (declared > IMAGE.maxBytes) throw new Error("larger than 10 MB");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > IMAGE.maxBytes) {
      await reader.cancel();
      throw new Error("larger than 10 MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function downloadImages(html, dir, fixtureImages) {
  const images = new Map();
  let attempts = 0;
  let saved = 0;
  let pageBytes = 0;
  for (const src of new Set(r.imageSources(html))) {
    try {
      if (!r.isAllowedImageUrl(src)) throw new Error("not a GitHub image host");
      if (++attempts > IMAGE.maxPerPage) throw new Error(`more than ${IMAGE.maxPerPage} images on one page`);
      let bytes;
      if (fixtureImages) {
        if (!(src in fixtureImages)) throw new Error("not in fixture");
        bytes = Buffer.from(fixtureImages[src], "base64");
      } else {
        const response = await fetch(src, { redirect: "follow", signal: AbortSignal.timeout(IMAGE.timeoutMs) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // GitHub redirects attachments to its CDN; anything else after a redirect is refused.
        if (!r.isAllowedImageUrl(response.url) && !/^https:\/\/[\w.-]+\.githubusercontent\.com\//.test(response.url)) {
          throw new Error(`redirected off GitHub to ${response.url.slice(0, 80)}`);
        }
        bytes = await readCapped(response);
      }
      const size = r.imageSize(bytes);
      if (!size) throw new Error("not a PNG, JPEG, GIF, or WebP");
      if (!(size.width > 0 && size.height > 0 && size.width <= IMAGE.maxSide && size.height <= IMAGE.maxSide)) throw new Error("implausible size");
      if ((pageBytes += bytes.length) > IMAGE.pageBytes) throw new Error("page image budget of 25 MB used up");
      const file = `img-${++saved}.${size.type === "jpeg" ? "jpg" : size.type}`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, file), bytes);
      images.set(src, { file, width: size.width, height: size.height });
    } catch (error) {
      warn(`dropped image ${src.slice(0, 120)}: ${error.message}`);
    }
  }
  return images;
}

// == Build

function write(file, html) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

async function build() {
  // Only ever clear a "_"-prefixed folder directly inside the project.
  if (dirname(out) !== root || !basename(out).startsWith("_")) throw new Error(`refusing to build into ${out}; use --out _name`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const entry of STATIC) cpSync(join(root, entry), join(out, entry), { recursive: true });

  const { discussions, categories, images: fixtureImages } = await loadContent();
  for (const category of [r.POSTS_CATEGORY, r.GUESTBOOK_CATEGORY]) {
    if (categories && !categories.includes(category)) warn(`no "${category}" discussion category; create it on GitHub (ADR 0005)`);
  }
  const template = readFileSync(join(root, "templates", "rd-post.html"), "utf8");

  // Template values are filled in one pass and never rescanned, so "{{" or "$&" in
  // anything a visitor wrote is inserted as plain text.
  const posts = [];
  for (const d of discussions.filter(r.isPost)) {
    const path = r.postPath(d);
    const dir = join(out, path);
    const comments = d.comments?.nodes ?? [];
    const body = r.sanitize(d.bodyHTML);
    const thread = r.renderComments(comments);
    const images = await downloadImages(body + thread, dir, fixtureImages);
    const commentCount = r.countComments(comments);
    const post = { ...d, path, summary: r.summary(body), minutes: r.readingMinutes(body), commentCount };
    write(
      join(dir, "index.html"),
      r.fill(template, {
        title: r.escapeHtml(d.title),
        description: r.escapeHtml(post.summary),
        path,
        date_iso: r.isoDate(d.createdAt),
        date: r.formatDate(d.createdAt),
        minutes: post.minutes,
        body: r.localizeImages(body, images),
        comments: r.localizeImages(thread, images),
        comment_count: commentCount,
        discussion_url: r.escapeHtml(d.url),
      }),
    );
    // /rd/<number>/ always reaches the current address, so renamed posts keep old links working.
    write(join(out, "rd", String(d.number), "index.html"), r.redirectPage(path, SITE));
    posts.push(post);
  }
  if (!offline && discussions.length && !posts.length) warn("found discussions but no R&D posts; check the category name and author");

  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const indexFile = join(out, "rd", "index.html");
  write(indexFile, r.insertAt(readFileSync(indexFile, "utf8"), "<!-- POSTS -->", posts.map(r.postCard).join("\n          ")));

  const guestbook = r.findGuestbook(discussions);
  if (!offline && !guestbook) warn('no Guestbook discussion by the owner; the "Sign" link points at the category');
  const signatures = guestbook?.comments?.nodes ?? [];
  const guestbookDir = join(out, "guestbook");
  const entries = r.guestbookEntries(signatures);
  const guestbookImages = await downloadImages(entries, guestbookDir, fixtureImages);
  const count = signatures.filter((c) => !c.isMinimized).length;
  const guestbookFile = join(guestbookDir, "index.html");
  const page = r.fill(readFileSync(guestbookFile, "utf8"), {
    signature_count: count,
    signature_label: count === 1 ? "signature" : "signatures",
    guestbook_url: r.escapeHtml(guestbook?.url ?? `https://github.com/${REPO}/discussions/categories/guestbook`),
  });
  write(guestbookFile, r.insertAt(page, "<!-- ENTRIES -->", r.localizeImages(entries, guestbookImages)));

  const mode = offline ? "offline" : fixturePath ? `fixture ${fixturePath}` : `live ${REPO}`;
  console.log(`built ${relative(root, out)}/ (${mode}): ${posts.length} posts, ${count} guestbook signatures`);
}

build().catch((error) => {
  console.error(`build failed: ${error.message}`);
  process.exit(1);
});
