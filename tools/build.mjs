// Builds the deployable site into _site/ (ADR 0005): copies the static files, then
// turns GitHub Discussions into R&D posts, their comments, and the guestbook.
// Zero dependencies. Usage:
//   node tools/build.mjs                    real content (GITHUB_TOKEN, GH_TOKEN, or `gh auth token`)
//   node tools/build.mjs --offline          no posts or signatures; for quick previews and CI tests
//   node tools/build.mjs --fixture <file>   content from a saved JSON file, for tests and previews
//   --out _name                             build into another "_"-prefixed folder of the project
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import * as r from "./render.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://emilianomanaloiv.github.io";
const REPO = process.env.GITHUB_REPOSITORY || "EmilianoManaloIV/EmilianoManaloIV.github.io";
const STATIC = ["index.html", "404.html", "styles.css", "favicon.svg", "emiliano-manalo.vcf", "assets", "js", "about", "rd", "guestbook"];
// Limits for images and clips found in posts and comments, which strangers can write.
// Attempts count against maxPerPage whether they succeed or not, so a comment full of
// dead links can't stall the build; pageBytes keeps a page's media well under Pages limits.
// 10 MB matches GitHub's free-plan video upload limit; heavyClip only warns (ADR 0007).
const MEDIA = { maxBytes: 10 * 1024 * 1024, pageBytes: 25 * 1024 * 1024, heavyClip: 4 * 1024 * 1024, maxPerPage: 20, maxSide: 20000, timeoutMs: 15000 };
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
      nodes { number title url createdAt bodyHTML author { login } category { name } labels(first: 20) { nodes { name } } ${COMMENTS} }
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
  for (const discussion of all.filter((d) => r.isPost(d) || r.isProject(d) || d === guestbook)) {
    let { pageInfo } = discussion.comments;
    while (pageInfo.hasNextPage) {
      const thread = (await graphql(auth, MORE_COMMENTS, { owner, name, number: discussion.number, after: pageInfo.endCursor })).repository.discussion;
      if (!thread) break; // Deleted while building; the next build drops it.
      discussion.comments.nodes.push(...thread.comments.nodes);
      pageInfo = thread.comments.pageInfo;
    }
  }
  return { discussions: all, categories, media: null };
}

async function loadContent() {
  if (offline) return { discussions: [], categories: null, media: null };
  if (fixturePath) {
    const data = JSON.parse(readFileSync(resolve(root, fixturePath), "utf8"));
    return { discussions: data.discussions, categories: data.categories ?? null, media: data.media ?? {} };
  }
  return fetchDiscussions();
}

// == Images and clips: copied into the page's folder so visitors make no outside requests.
// Only GitHub's image and attachment hosts are fetched, with a timeout and a size cap while reading.

async function readCapped(response) {
  const declared = Number(response.headers.get("content-length"));
  if (declared > MEDIA.maxBytes) throw new Error("larger than 10 MB");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MEDIA.maxBytes) {
      await reader.cancel();
      throw new Error("larger than 10 MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// Checks a downloaded file and names it, or throws why it can't be used.
function mediaFile(kind, bytes, count) {
  if (kind === "image") {
    const size = r.imageSize(bytes);
    if (!size) throw new Error("not a PNG, JPEG, GIF, or WebP");
    return { ...size, file: `img-${count}.${size.type === "jpeg" ? "jpg" : size.type}` };
  }
  const clip = r.clipInfo(bytes);
  if (!clip) throw new Error("not an MP4, MOV, or WebM video");
  if (!r.isPlayableClip(clip)) throw new Error(`its ${clip.codec ?? "unknown"} video won't play in every browser; export it as an H.264 MP4`);
  // MOV holds the same boxes as MP4, and browsers play its H.264 as video/mp4.
  return { ...clip, clip: true, file: `clip-${count}.${clip.type}` };
}

async function downloadMedia(html, dir, fixtureMedia) {
  const media = new Map();
  const counts = { image: 0, clip: 0 };
  let attempts = 0;
  let pageBytes = 0;
  // Clips come only from the owner's text; the sanitizer drops them from comments.
  const sources = new Map([...r.imageSources(html).map((src) => [src, "image"]), ...r.videoSources(html).map((src) => [src, "clip"])]);
  for (const [src, kind] of sources) {
    try {
      if (!r.isAllowedMediaUrl(src)) throw new Error("not a GitHub image or attachment host");
      if (++attempts > MEDIA.maxPerPage) throw new Error(`more than ${MEDIA.maxPerPage} images and clips on one page`);
      let bytes;
      if (fixtureMedia) {
        if (!(src in fixtureMedia)) throw new Error("not in fixture");
        bytes = Buffer.from(fixtureMedia[src], "base64");
      } else {
        const response = await fetch(src, { redirect: "follow", signal: AbortSignal.timeout(MEDIA.timeoutMs) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // GitHub redirects attachments to its CDN; anything else after a redirect is refused.
        if (!r.isAllowedMediaUrl(response.url) && !/^https:\/\/[\w.-]+\.githubusercontent\.com\//.test(response.url)) {
          throw new Error(`redirected off GitHub to ${response.url.slice(0, 80)}`);
        }
        bytes = await readCapped(response);
      }
      const found = mediaFile(kind, bytes, counts[kind] + 1);
      if (!(found.width > 0 && found.height > 0 && found.width <= MEDIA.maxSide && found.height <= MEDIA.maxSide)) throw new Error("implausible size");
      if ((pageBytes += bytes.length) > MEDIA.pageBytes) throw new Error("page media budget of 25 MB used up");
      if (found.clip && bytes.length > MEDIA.heavyClip) {
        warn(`clip ${src.slice(0, 120)} is ${(bytes.length / 1048576).toFixed(1)} MB; under 4 MB loads faster on conference Wi-Fi`);
      }
      counts[kind]++;
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, found.file), bytes);
      media.set(src, { file: found.file, width: found.width, height: found.height, clip: Boolean(found.clip) });
    } catch (error) {
      warn(`dropped ${kind} ${src.slice(0, 120)}: ${error.message}`);
    }
  }
  return media;
}

// Local files in place of GitHub's addresses, for images and clips alike.
const localize = (html, media) => r.localizeVideos(r.localizeImages(html, media), media);

// == Cache-busting: fingerprint scripts and the stylesheet, then point every page at
// the fingerprinted addresses, so each deploy loads fresh files (see render.mjs).

const fingerprintOf = (text) => createHash("sha256").update(text).digest("hex").slice(0, 10);

function fingerprint() {
  const versions = new Map();
  const jsDir = join(out, "js");
  const pending = new Set(readdirSync(jsDir).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`));
  // A script's fingerprint covers its versioned imports, so it is computed after theirs.
  while (pending.size) {
    const ready = [...pending].filter((path) => r.importsOf(readFileSync(join(out, path), "utf8")).every((dep) => versions.has(dep) || !pending.has(dep)));
    if (!ready.length) throw new Error(`circular imports among ${[...pending].join(", ")}`);
    for (const path of ready) {
      const code = r.versionImports(readFileSync(join(out, path), "utf8"), versions);
      writeFileSync(join(out, path), code);
      versions.set(path, fingerprintOf(code));
      pending.delete(path);
    }
  }
  versions.set("styles.css", fingerprintOf(readFileSync(join(out, "styles.css"))));
  const pages = readdirSync(out, { recursive: true }).filter((f) => String(f).endsWith(".html"));
  for (const page of pages) {
    const file = join(out, page);
    writeFileSync(file, r.versionUrls(readFileSync(file, "utf8"), versions));
  }
  return versions;
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

  const { discussions, categories, media: fixtureMedia } = await loadContent();
  for (const category of [r.POSTS_CATEGORY, r.PROJECTS_CATEGORY, r.GUESTBOOK_CATEGORY]) {
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
    const media = await downloadMedia(body + thread, dir, fixtureMedia);
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
        body: localize(body, media),
        comments: localize(thread, media),
        comment_count: commentCount,
        discussion_url: r.escapeHtml(d.url),
      }),
    );
    // /rd/<number>/ always reaches the current address, so renamed posts keep old links working.
    write(join(out, "rd", String(d.number), "index.html"), r.redirectPage(path, SITE));
    posts.push(post);
  }
  if (!offline && discussions.length && !posts.length) warn("found discussions but no R&D posts; check the category name and author");

  // Projects (ADR 0006): rendered like posts, then listed on the home page, with
  // their "skill:" labels collected into the About page's skills.
  const projectTemplate = readFileSync(join(root, "templates", "project.html"), "utf8");
  const projects = [];
  for (const d of discussions.filter(r.isProject)) {
    const path = r.projectPath(d);
    const dir = join(out, path);
    const comments = d.comments?.nodes ?? [];
    const { href: link, body } = r.extractLink(r.sanitize(d.bodyHTML));
    const thread = r.renderComments(comments);
    const media = await downloadMedia(body + thread, dir, fixtureMedia);
    const skills = r.skillsOf(d);
    // The card shows the first image; a clip only when there is none, since the home
    // page is where visitors land on conference Wi-Fi (ADR 0007).
    const first = media.get(r.imageSources(body)[0]) ?? media.get(r.videoSources(body)[0]);
    const title = r.escapeHtml(d.title);
    const project = {
      ...d,
      path,
      link,
      skills,
      summary: r.summary(body),
      minutes: r.readingMinutes(body),
      media: first ? { src: `${path}${first.file}`, width: first.width, height: first.height, clip: first.clip } : null,
    };
    const actions = [link ? `<li><a class="tag tag-link" href="${link}">${title} link</a></li>` : "", r.projectSkillTags(skills)].filter(Boolean).join("\n          ");
    write(
      join(dir, "index.html"),
      r.fill(projectTemplate, {
        title,
        description: r.escapeHtml(project.summary),
        path,
        date_iso: r.isoDate(d.createdAt),
        date: r.formatDate(d.createdAt),
        minutes: project.minutes,
        actions,
        body: localize(body, media),
        comments: localize(thread, media),
        comment_count: r.countComments(comments),
        discussion_url: r.escapeHtml(d.url),
      }),
    );
    write(join(out, "projects", String(d.number), "index.html"), r.redirectPage(path, SITE));
    projects.push(project);
  }
  projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const homeFile = join(out, "index.html");
  // Empty states are removed here too, not only by CSS :has(), so older browsers never
  // show "on their way" under real cards or a heading over an empty list.
  let home = r.insertAt(readFileSync(homeFile, "utf8"), "<!-- PROJECTS -->", projects.map(r.projectCard).join("\n        "));
  if (projects.length) home = r.insertAt(home, '<p class="empty-state">Projects are on their way.</p>', "");
  write(homeFile, home);
  const aboutFile = join(out, "about", "index.html");
  const skills = r.skillsList(projects);
  let about = r.insertAt(readFileSync(aboutFile, "utf8"), "<!-- SKILLS -->", skills);
  if (!skills) about = r.insertAt(about, '<h3 class="list-heading">From my projects</h3>', "");
  write(aboutFile, about);

  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const indexFile = join(out, "rd", "index.html");
  write(indexFile, r.insertAt(readFileSync(indexFile, "utf8"), "<!-- POSTS -->", posts.map(r.postCard).join("\n          ")));

  const guestbook = r.findGuestbook(discussions);
  if (!offline && !guestbook) warn('no Guestbook discussion by the owner; the "Sign" link points at the category');
  const signatures = guestbook?.comments?.nodes ?? [];
  const guestbookDir = join(out, "guestbook");
  const entries = r.guestbookEntries(signatures);
  const guestbookMedia = await downloadMedia(entries, guestbookDir, fixtureMedia);
  const count = signatures.filter((c) => !c.isMinimized).length;
  const guestbookFile = join(guestbookDir, "index.html");
  const page = r.fill(readFileSync(guestbookFile, "utf8"), {
    signature_count: count,
    signature_label: count === 1 ? "signature" : "signatures",
    guestbook_url: r.escapeHtml(guestbook?.url ?? `https://github.com/${REPO}/discussions/categories/guestbook`),
  });
  write(guestbookFile, r.insertAt(page, "<!-- ENTRIES -->", localize(entries, guestbookMedia)));

  const versions = fingerprint();

  const mode = offline ? "offline" : fixturePath ? `fixture ${fixturePath}` : `live ${REPO}`;
  console.log(`built ${relative(root, out)}/ (${mode}): ${posts.length} posts, ${projects.length} projects, ${count} guestbook signatures, ${versions.size} fingerprinted assets`);
}

build().catch((error) => {
  console.error(`build failed: ${error.message}`);
  process.exit(1);
});
