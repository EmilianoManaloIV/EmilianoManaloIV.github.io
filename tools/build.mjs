// Builds the deployable site into _site/ (ADR 0005): copies the static files, then
// turns GitHub Discussions into R&D posts, their comments, and the guestbook.
// Zero dependencies. Usage:
//   node tools/build.mjs                    real content (GITHUB_TOKEN, GH_TOKEN, or `gh auth token`)
//   node tools/build.mjs --offline          no posts or signatures; for quick previews and CI tests
//   node tools/build.mjs --fixture <file>   content from a saved JSON file, for tests and previews
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import * as r from "./render.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://emilianomanaloiv.github.io";
const REPO = process.env.GITHUB_REPOSITORY || "EmilianoManaloIV/EmilianoManaloIV.github.io";
const STATIC = ["index.html", "404.html", "styles.css", "favicon.svg", "emiliano-manalo.vcf", "assets", "js", "about", "rd", "guestbook"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = resolve(root, option("--out") ?? "_site");
const fixturePath = option("--fixture");
const offline = args.includes("--offline");

// == Content sources

const COMMENT = "url createdAt isMinimized bodyHTML author { login }";
const COMMENTS = `comments(first: 100, after: $after) { totalCount pageInfo { hasNextPage endCursor } nodes { ${COMMENT} replies(first: 50) { nodes { ${COMMENT} } } } }`;
const DISCUSSIONS = `query($owner: String!, $name: String!, $cursor: String, $after: String) {
  repository(owner: $owner, name: $name) {
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
  });
  const json = await response.json();
  if (!response.ok || json.errors) throw new Error(`GitHub API: ${response.status} ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}

// Every discussion with every comment; long threads like the guestbook page through.
async function fetchDiscussions() {
  const auth = token();
  const [owner, name] = REPO.split("/");
  const all = [];
  let cursor = null;
  do {
    const page = (await graphql(auth, DISCUSSIONS, { owner, name, cursor, after: null })).repository.discussions;
    all.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  for (const discussion of all) {
    let { pageInfo } = discussion.comments;
    while (pageInfo.hasNextPage) {
      const more = (await graphql(auth, MORE_COMMENTS, { owner, name, number: discussion.number, after: pageInfo.endCursor })).repository.discussion.comments;
      discussion.comments.nodes.push(...more.nodes);
      pageInfo = more.pageInfo;
    }
  }
  return { discussions: all, images: null };
}

async function loadContent() {
  if (offline) return { discussions: [], images: null };
  if (fixturePath) {
    const data = JSON.parse(readFileSync(resolve(root, fixturePath), "utf8"));
    return { discussions: data.discussions, images: data.images ?? {} };
  }
  return fetchDiscussions();
}

// == Images: download into the page's folder so visitors make no outside requests

async function downloadImages(html, dir, fixtureImages) {
  const images = new Map();
  let n = 0;
  for (const src of new Set(r.imageSources(html))) {
    try {
      let bytes;
      if (fixtureImages) {
        if (!(src in fixtureImages)) throw new Error("not in fixture");
        bytes = Buffer.from(fixtureImages[src], "base64");
      } else {
        const response = await fetch(src, { redirect: "follow" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
      }
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error("larger than 10 MB");
      const size = r.imageSize(bytes);
      if (!size) throw new Error("not a PNG, JPEG, GIF, or WebP");
      const file = `img-${++n}.${size.type === "jpeg" ? "jpg" : size.type}`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, file), bytes);
      images.set(src, { file, width: size.width, height: size.height });
    } catch (error) {
      console.warn(`warning: dropped image ${src}: ${error.message}`);
    }
  }
  return images;
}

// == Build

function write(file, html) {
  if (html.includes("{{")) throw new Error(`${relative(root, file)}: unfilled template value`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

async function build() {
  // Only ever clear a folder inside the project, never the project itself.
  if (out === root || !out.startsWith(root)) throw new Error(`refusing to build into ${out}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const entry of STATIC) cpSync(join(root, entry), join(out, entry), { recursive: true });

  const { discussions, images: fixtureImages } = await loadContent();
  const template = readFileSync(join(root, "templates", "rd-post.html"), "utf8");

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

  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const indexFile = join(out, "rd", "index.html");
  write(indexFile, readFileSync(indexFile, "utf8").replace("<!-- POSTS -->", posts.map(r.postCard).join("\n          ")));

  const guestbook = r.findGuestbook(discussions);
  const signatures = guestbook?.comments?.nodes ?? [];
  const entries = r.guestbookEntries(signatures);
  const guestbookDir = join(out, "guestbook");
  const guestbookImages = await downloadImages(entries, guestbookDir, fixtureImages);
  const count = signatures.filter((c) => !c.isMinimized).length;
  const guestbookFile = join(guestbookDir, "index.html");
  write(
    guestbookFile,
    r.fill(readFileSync(guestbookFile, "utf8").replace("<!-- ENTRIES -->", r.localizeImages(entries, guestbookImages)), {
      signature_count: count,
      signature_label: count === 1 ? "signature" : "signatures",
      guestbook_url: r.escapeHtml(guestbook?.url ?? `https://github.com/${REPO}/discussions/categories/guestbook`),
    }),
  );

  const mode = offline ? "offline" : fixturePath ? `fixture ${fixturePath}` : `live ${REPO}`;
  console.log(`built ${relative(root, out)}/ (${mode}): ${posts.length} posts, ${count} guestbook signatures`);
}

build().catch((error) => {
  console.error(`build failed: ${error.message}`);
  process.exit(1);
});
