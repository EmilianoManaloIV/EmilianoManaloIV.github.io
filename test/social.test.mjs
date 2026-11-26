import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { publishSocial } from "../tools/publish-social.mjs";
import { announcements } from "../tools/social.mjs";

const REPO = "EmilianoManaloIV/EmilianoManaloIV.github.io";
const SITE = "https://emilianomanaloiv.github.io";
const BRANCH = "social-publishing-state";
const root = join(import.meta.dirname, "..");
const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "discussions.json"), "utf8"));
const discussion = fixture.discussions.find(({ number }) => number === 14);
const candidate = {
  number: 14,
  title: "Learning shaders, one triangle at a time",
  summary: "Notes from my first week writing fragment shaders for the banner wireframes.",
  url: SITE + "/rd/14-learning-shaders-one-triangle-at-a-time/",
  updatedAt: discussion.createdAt,
  image: {
    url: SITE + "/assets/img/rd-social.jpg",
    alt: "R&D on Emiliano Panday Manalo IV's website",
  },
};
const cover = readFileSync(join(root, "assets", "img", "rd-social.jpg"));
candidate.revision = createHash("sha256").update(JSON.stringify(candidate)).update(cover).digest("hex");
const copy = {
  linkedin: "Learning shaders, one triangle at a time\n\nNotes from my first week writing fragment shaders for the banner wireframes.\n\nhttps://emilianomanaloiv.github.io/rd/14-learning-shaders-one-triangle-at-a-time/",
  x: "Learning shaders, one triangle at a time\nhttps://emilianomanaloiv.github.io/rd/14-learning-shaders-one-triangle-at-a-time/",
  instagram: "Learning shaders, one triangle at a time\n\nNotes from my first week writing fragment shaders for the banner wireframes.\n\nRead it via the R&D link in my bio.",
};
const ids = { linkedin: "linked-in-id", x: "x-id", instagram: "insta-id" };
const env = {
  PAGES_DEPLOYED: "success",
  SOCIAL_PUBLISH: "true",
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: REPO,
  GITHUB_REF: "refs/heads/main",
  GITHUB_TOKEN: "fake-github-token",
  BUFFER_API_KEY: "fake-buffer-key",
  BUFFER_ORGANIZATION_ID: "organization-id",
  BUFFER_CHANNEL_IDS: JSON.stringify(ids),
};

function buildFixture(t, content, { unreadableManifestPath = false } = {}) {
  // The build only accepts an underscore-prefixed output directly inside the repo.
  const out = mkdtempSync(join(root, "_social-test-"));
  const temp = mkdtempSync(join(tmpdir(), "site-social-test-"));
  t.after(() => {
    rmSync(out, { recursive: true, force: true });
    rmSync(temp, { recursive: true, force: true });
  });
  const input = join(temp, "discussions.json");
  const manifest = unreadableManifestPath ? temp : join(temp, "social.json");
  writeFileSync(input, JSON.stringify(content));
  const noFetch = "globalThis.fetch = () => { process.exit(91); };";
  const result = spawnSync(process.execPath, [
    "--import", "data:text/javascript," + encodeURIComponent(noFetch),
    join(root, "tools", "build.mjs"), "--fixture", input, "--out", basename(out), "--social-manifest", manifest,
  ], { cwd: root, encoding: "utf8", timeout: 15_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  return { out, posts: unreadableManifestPath ? null : JSON.parse(readFileSync(manifest, "utf8")), log: result.stdout };
}

function attachJpeg(content, name, alt, width = 1080, height = 1080) {
  const src = "https://github.com/user-attachments/assets/" + name + ".jpg";
  // A synthetic JPEG frame header is enough for the build's media inspection.
  const bytes = Buffer.from("ffd8ffc0000b080000000001011100ffd9", "hex");
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  content.media[src] = bytes.toString("base64");
  return `<p><img src="${src}" alt="${alt}"></p>`;
}

const accepted = (channelId) => ({
  data: { createPost: { __typename: "PostActionSuccess", post: { id: "buffer-" + channelId } } },
});

function mockPublisher({
  current = discussion,
  page = `<link rel="canonical" href="${candidate.url}"><!-- social-revision: ${candidate.revision} -->`,
  submit = accepted,
  instagramType = "business",
  headImage = (url) => {
    assert.equal(url, candidate.image.url);
    return new Response(null, { headers: { "Content-Type": "image/jpeg" } });
  },
  loadCurrent = () => current,
  onStateWrite = () => {},
} = {}) {
  const calls = [];
  const reports = [];
  const states = [];
  const mutations = [];
  let file;
  const statePath = `https://api.github.com/repos/${REPO}/contents/14.json`;
  return {
    calls, reports, states, mutations,
    report: (...args) => reports.push(args),
    async fetch(url, { method = "GET", body, headers } = {}) {
      const payload = body && JSON.parse(body);
      calls.push({ url, method, payload });
      if (method === "GET" && url === statePath + "?ref=" + BRANCH) {
        return file ? Response.json(file) : new Response(null, { status: 404 });
      }
      if (method === "PUT" && url === statePath) {
        assert.equal(payload.branch, BRANCH);
        assert.equal(payload.sha, file?.sha, "each write uses the most recent status file SHA");
        states.push(JSON.parse(Buffer.from(payload.content, "base64").toString("utf8")));
        file = { sha: "revision-" + states.length, content: payload.content };
        onStateWrite(states.at(-1));
        return Response.json({ content: { sha: file.sha } });
      }
      if (method === "POST" && url === "https://api.github.com/graphql") {
        const [owner, name] = REPO.split("/");
        assert.deepEqual(payload.variables, { owner, name, number: 14, after: null });
        assert.match(payload.query, /discussion\(number: \$number\)/);
        const live = loadCurrent();
        const labels = { pageInfo: { hasNextPage: false, endCursor: null }, ...live.labels };
        return Response.json({ data: { repository: { discussion: { ...live, labels } } } });
      }
      if (method === "GET" && url === candidate.url) return new Response(page);
      if (method === "HEAD") return headImage(url);
      if (method === "POST" && url === "https://api.buffer.com") {
        assert.equal(headers.Authorization, "Bearer fake-buffer-key");
        assert.equal(headers["Content-Type"], "application/json");
        if (payload.query.includes("channels(")) {
          assert.match(payload.query, /\$organization: OrganizationId!/);
          assert.match(payload.query, /channels\(input: \{ organizationId: \$organization \}\) \{ id service type isDisconnected \}/);
          assert.deepEqual(payload.variables, { organization: "organization-id" });
          return Response.json({ data: { channels: [
            { id: ids.linkedin, service: "linkedin" },
            { id: ids.x, service: "twitter" },
            { id: ids.instagram, service: "instagram", type: instagramType },
          ] } });
        }
        assert.match(payload.query, /\$input: CreatePostInput!/);
        assert.match(payload.query, /createPost\(input: \$input\)\s*\{\s*__typename/);
        assert.match(payload.query, /\.\.\. on PostActionSuccess \{ post \{ id \} \}/);
        const { input } = payload.variables;
        mutations.push({ input, stateAtSubmission: states.at(-1) });
        return Response.json(submit(input.channelId));
      }
      assert.fail(`Unexpected mocked request: ${method} ${url}`);
    },
  };
}

test("only labeled owner R&D posts announce, with exact channel copy and the Instagram fallback (task 0004)", async (t) => {
  const content = structuredClone(fixture);
  const post = content.discussions.find(({ number }) => number === 14);
  const comment = post.comments.nodes[0];
  comment.bodyHTML += attachJpeg(content, "comment", "A visitor's JPEG");
  for (const item of content.discussions.filter(({ number }) => [12, 3, 24].includes(number))) {
    item.labels ??= { nodes: [] };
    item.labels.nodes.push({ name: "share: social" });
  }
  const { out, posts } = buildFixture(t, content);
  assert.deepEqual(posts, [candidate], "unlabeled #11 and labeled stranger #12, guestbook #3 and project #24 are excluded");
  assert.ok(!existsSync(join(out, "social.json")), "the manifest is outside the deployed site");
  const article = join(out, new URL(candidate.url).pathname);
  const page = readFileSync(join(article, "index.html"), "utf8");
  assert.match(page, /alt="A visitor&#39;s JPEG"/, "the comment JPEG is on the page but cannot be selected");
  const mock = mockPublisher({ page });
  assert.equal(await publishSocial(posts, env, mock), true);

  // Buffer's CreatePostInput, including asset alt text and Instagram feed metadata.
  const inputFor = (channel) => ({
    channelId: ids[channel], text: copy[channel], assets: [],
    mode: "shareNow", schedulingType: "automatic", needsApproval: false,
  });
  assert.deepEqual(mock.mutations.map(({ input }) => input), [
    inputFor("linkedin"),
    inputFor("x"),
    {
      ...inputFor("instagram"),
      assets: [{ image: { url: candidate.image.url, metadata: { altText: candidate.image.alt } } }],
      metadata: { instagram: { type: "post", shouldShareToFeed: true } },
    },
  ]);
  assert.equal(mock.calls.filter(({ method, url }) => method === "HEAD" && url === candidate.image.url).length, 1);
  assert.equal(mock.calls.filter(({ payload }) => payload?.query?.includes("channels(")).length, 1);
  for (const [index, [channel, channelId]] of Object.entries(ids).entries()) {
    const claim = mock.mutations[index].stateAtSubmission[channel];
    assert.ok(Number.isFinite(Date.parse(claim.attemptedAt)));
    assert.equal(claim.channelId, channelId);
    assert.equal(claim.url, candidate.url);
    assert.equal(claim.revision, candidate.revision);
    assert.equal(claim.status, "pending");
    assert.deepEqual(mock.states.at(-1)[channel], { ...claim, status: "accepted", bufferId: "buffer-" + channelId });
  }

  const callsBefore = mock.calls.length;
  const renamed = { ...candidate, title: "Shader notes", url: SITE + "/rd/14-shader-notes/" };
  assert.equal(await publishSocial([renamed], env, mock), true);
  assert.deepEqual(mock.calls.slice(callsBefore).map(({ method, url }) => [method, url]), [
    ["GET", `https://api.github.com/repos/${REPO}/contents/14.json?ref=${BRANCH}`],
  ], "renaming an accepted Discussion only reads its existing record");
});

test("Instagram gets the author's first compatible JPEG and its alt text (task 0004)", (t) => {
  const content = structuredClone(fixture);
  const post = content.discussions.find(({ number }) => number === 14);
  post.bodyHTML += attachJpeg(content, "wide", "Too wide", 2160, 1080);
  post.bodyHTML += attachJpeg(content, "first", "Light &amp; shadow");
  post.bodyHTML += attachJpeg(content, "later", "A later JPEG");
  const { out, posts } = buildFixture(t, content);
  const image = Buffer.from(content.media["https://github.com/user-attachments/assets/first.jpg"], "base64");
  const digest = createHash("sha256").update(image).digest("hex");
  assert.deepEqual(posts[0].image, { url: candidate.url + "social-" + digest + ".jpg", alt: "Light & shadow" });
  assert.deepEqual(readFileSync(join(out, new URL(posts[0].image.url).pathname)), image);
});

test("a long article keeps its full title, body and media when Instagram needs the cover (task 0005)", (t) => {
  const content = structuredClone(fixture);
  const post = content.discussions.find(({ number }) => number === 14);
  post.title = "Shader notes " + "波".repeat(3_100) + " complete title";
  const paragraph = "From first triangle to last pixel. ".repeat(100) + "End of the opening paragraph.";
  post.bodyHTML = `<p>${paragraph}</p>` + post.bodyHTML
    + attachJpeg(content, "tiny", "Tiny shader thumbnail", 319, 319)
    + "<p>End of the full article.</p>";

  const { out, posts: [announcement] } = buildFixture(t, content);
  assert.deepEqual(announcement.image, candidate.image);
  const article = join(out, new URL(announcement.url).pathname);
  const page = readFileSync(join(article, "index.html"), "utf8");
  assert.ok(page.includes(`<h1>${post.title}</h1>`), "the page retains the entire title");
  assert.ok(page.includes(`<p>${paragraph}</p>`), "the page retains the entire opening paragraph");
  assert.ok(page.includes("<p>End of the full article.</p>"));
  for (const [alt, source] of [
    ["A rendered triangle", "https://github.com/user-attachments/assets/fixture-pixel.png"],
    ["Tiny shader thumbnail", "https://github.com/user-attachments/assets/tiny.jpg"],
  ]) {
    const image = page.match(new RegExp(`<img src="([^"]+)" alt="${alt}"`));
    assert.ok(image, `the article displays ${alt}`);
    assert.deepEqual(readFileSync(join(article, image[1])), Buffer.from(content.media[source], "base64"));
  }
  const clip = page.match(/<video\b[^>]*\bsrc="([^"]+)"/);
  assert.ok(clip, "the article keeps its playable clip");
  const clipSource = "https://private-user-images.githubusercontent.com/1/fixture-clip.mp4?jwt=fixture";
  const clipPath = new URL(clip[1], announcement.url).pathname;
  assert.deepEqual(readFileSync(join(out, clipPath)), Buffer.from(content.media[clipSource], "base64"));
});

const missingImage = () => new Response(null, { status: 404 });
for (const [scenario, authorResponse, coverAvailable] of [
  ["the author JPEG returns 404", missingImage, true],
  ["the author JPEG URL serves a different format", () => new Response(null, { headers: { "Content-Type": "image/png" } }), true],
  ["checking the author JPEG throws", () => { throw new TypeError("Simulated network failure"); }, true],
  ["neither JPEG URL is available", missingImage, false],
]) {
  test(`Instagram checks the branded cover when ${scenario} (task 0005)`, async () => {
    const digest = createHash("sha256").update("author JPEG fixture").digest("hex");
    const authorImage = { url: candidate.url + `social-${digest}.jpg`, alt: "The author's JPEG" };
    const post = { ...candidate, image: authorImage };
    const mock = mockPublisher({ headImage(url) {
      if (url === authorImage.url) return authorResponse();
      assert.equal(url, candidate.image.url);
      return coverAvailable
        ? new Response(null, { headers: { "Content-Type": "image/jpeg" } })
        : new Response(null, { status: 404 });
    } });

    assert.equal(await publishSocial([post], env, mock), coverAvailable);
    assert.deepEqual(mock.calls.filter(({ method }) => method === "HEAD").map(({ url }) => url), [
      authorImage.url, candidate.image.url,
    ]);
    const entries = mock.states.at(-1);
    assert.equal(entries.linkedin.status, "accepted");
    assert.equal(entries.x.status, "accepted");
    const expectedChannels = coverAvailable ? Object.values(ids) : [ids.linkedin, ids.x];
    assert.deepEqual(mock.mutations.map(({ input }) => input.channelId), expectedChannels);
    if (coverAvailable) {
      const { input } = mock.mutations.at(-1);
      assert.deepEqual(input.assets, [{ image: { url: candidate.image.url, metadata: { altText: candidate.image.alt } } }]);
      assert.equal(input.text, copy.instagram);
      assert.equal(entries.instagram.status, "accepted");
    } else {
      assert.equal(entries.instagram.status, "rejected");
      assert.match(entries.instagram.reason, /JPEG.*unavailable/);
    }
  });
}

test("a dry run previews all three announcements without external requests (task 0004)", async () => {
  const mock = mockPublisher();
  assert.equal(await publishSocial([candidate], { PAGES_DEPLOYED: "success" }, mock), true);
  assert.deepEqual(mock.calls, []);
  assert.deepEqual(mock.reports, [
    [candidate, "linkedin", "preview", { text: copy.linkedin }],
    [candidate, "x", "preview", { text: copy.x }],
    [candidate, "instagram", "preview", { text: copy.instagram, image: candidate.image }],
  ]);
});

test("a failed deployment produces no previews, records or submissions (task 0004)", async () => {
  const mock = mockPublisher();
  assert.equal(await publishSocial([candidate], { ...env, PAGES_DEPLOYED: "failure" }, mock), true);
  assert.deepEqual(mock.calls, []);
  assert.deepEqual(mock.reports, []);
});

test("a failed social manifest write still leaves a working Pages build (task 0004)", (t) => {
  const { out, log } = buildFixture(t, fixture, { unreadableManifestPath: true });
  assert.match(log, /could not write the social announcements manifest/);
  assert.ok(existsSync(join(out, new URL(candidate.url).pathname, "index.html")));
  assert.ok(existsSync(join(out, "sitemap.xml")));
});

test("publishing rechecks the current opt-in label and live canonical page (task 0004)", async () => {
  const withoutLabel = mockPublisher({ current: { ...discussion, labels: { nodes: [] } } });
  assert.equal(await publishSocial([candidate], env, withoutLabel), true);
  assert.deepEqual(withoutLabel.reports, [[candidate, null, "discussion no longer eligible"]]);
  assert.ok(withoutLabel.calls.every(({ url }) => url.startsWith("https://api.github.com/")));
  assert.equal(withoutLabel.calls.some(({ method }) => method === "PUT"), false);

  const wrongPage = mockPublisher({ page: '<link rel="canonical" href="https://example.com/">' });
  assert.equal(await publishSocial([candidate], env, wrongPage), false);
  assert.deepEqual(wrongPage.reports, [[candidate, null, "waiting for live page"]]);
  assert.deepEqual(wrongPage.states, []);
  assert.deepEqual(wrongPage.mutations, []);
});

test("a channel rejection or timeout persists for review while the other channels continue (task 0004)", async () => {
  const mock = mockPublisher({ submit(channelId) {
    if (channelId === ids.linkedin) return { data: { createPost: { __typename: "InvalidInputError" } } };
    if (channelId === ids.x) throw new DOMException("Simulated request timeout", "TimeoutError");
    return accepted(channelId);
  } });
  assert.equal(await publishSocial([candidate], env, mock), false);
  assert.deepEqual(mock.mutations.map(({ input }) => input.channelId), Object.values(ids));
  const entries = mock.states.at(-1);
  assert.equal(entries.linkedin.status, "rejected");
  assert.equal(entries.x.status, "pending");
  assert.equal(entries.instagram.status, "accepted");
  assert.equal(entries.instagram.bufferId, "buffer-insta-id");
  assert.deepEqual(mock.reports.map(([, channel]) => channel), Object.keys(ids));
  assert.match(mock.reports[0][2], /^rejected\b/);
  assert.deepEqual(mock.reports.slice(1).map(([, channel, status]) => [channel, status]), [
    ["x", "outcome unknown (pending)"],
    ["instagram", "accepted"],
  ]);

  const writesBefore = mock.states.length;
  mock.reports.length = 0;
  assert.equal(await publishSocial([candidate], env, mock), false);
  assert.equal(mock.states.length, writesBefore);
  assert.equal(mock.mutations.length, 3);
  assert.deepEqual(mock.reports.map(([, channel, status]) => [channel, status]), [
    ["linkedin", "needs review (rejected)"], ["x", "needs review (pending)"],
  ]);
});

test("an unexpected Buffer error leaves the channel pending for manual reconciliation (task 0004)", async () => {
  // Buffer's UnexpectedError does not say whether it created the post before failing.
  const mock = mockPublisher({ submit: (channelId) => channelId === ids.linkedin
    ? { data: { createPost: { __typename: "UnexpectedError" } } }
    : accepted(channelId) });
  assert.equal(await publishSocial([candidate], env, mock), false);
  assert.deepEqual(mock.mutations.map(({ input }) => input.channelId), Object.values(ids));
  assert.equal(mock.states.at(-1).linkedin.status, "pending");
});

test("an older manifest cannot publish after a comment takes the old image slot (task 0004)", async (t) => {
  const content = structuredClone(fixture);
  const post = content.discussions.find(({ number }) => number === 14);
  const originalBody = post.bodyHTML;
  post.bodyHTML += attachJpeg(content, "author-cover", "The author's own cover");
  const old = buildFixture(t, content).posts[0];

  post.bodyHTML = originalBody;
  post.comments.nodes[0].bodyHTML += attachJpeg(content, "visitor-cover", "A visitor's cover", 800, 800);
  const latest = buildFixture(t, content);
  const article = join(latest.out, new URL(old.url).pathname);
  const page = readFileSync(join(article, "index.html"), "utf8");
  assert.match(page, /img-2\.jpg" alt="A visitor/);
  assert.ok(!existsSync(join(latest.out, new URL(old.image.url).pathname)));
  assert.notEqual(latest.posts[0].revision, old.revision);
  const mock = mockPublisher({ page });
  assert.equal(await publishSocial([old], env, mock), false);
  assert.deepEqual(mock.mutations, []);
  assert.deepEqual(mock.states, []);
});

test("removing the opt-in label during LinkedIn submission stops the remaining channels (task 0004)", async () => {
  let current = discussion;
  const mock = mockPublisher({
    loadCurrent: () => current,
    submit(channelId) {
      current = { ...discussion, labels: { nodes: [] } };
      return accepted(channelId);
    },
  });
  assert.equal(await publishSocial([candidate], env, mock), true);
  assert.deepEqual(mock.mutations.map(({ input }) => input.channelId), [ids.linkedin]);
});

test("removing the opt-in label during a claim leaves the channel unsent (task 0004)", async () => {
  let current = discussion;
  let removeLabel = true;
  const mock = mockPublisher({
    loadCurrent: () => current,
    onStateWrite(entries) {
      if (removeLabel && entries.linkedin?.status === "pending") {
        current = { ...discussion, labels: { nodes: [] } };
      }
    },
  });
  assert.equal(await publishSocial([candidate], env, mock), true);
  assert.deepEqual(mock.mutations, []);
  assert.equal(mock.states.at(-1).linkedin.status, "not_sent");

  removeLabel = false;
  current = discussion;
  assert.equal(await publishSocial([candidate], env, mock), true);
  assert.deepEqual(mock.mutations.map(({ input }) => input.channelId), Object.values(ids));
});

test("Instagram personal accounts are caught before the publish request (task 0004)", async () => {
  const mock = mockPublisher({ instagramType: "profile" });
  assert.equal(await publishSocial([candidate], env, mock), false);
  assert.deepEqual(mock.mutations.map(({ input }) => input.channelId), [ids.linkedin, ids.x]);
  assert.match(mock.states.at(-1).instagram.reason, /professional connection/);
});

test("a long title leaves room for the URL in a standard X announcement (task 0004)", () => {
  const [title, url] = announcements({ ...candidate, title: "波".repeat(200) }).x.text.split("\n");
  assert.equal(url, candidate.url);
  assert.ok(title.endsWith("…"));
  assert.ok(Array.from(title).length * 2 + 24 <= 280);
});

const bufferLinkedInWeight = (text) => text.replace(/https?:\/\/[^\s]+/g, "u".repeat(24)).length;
const bufferInstagramWeight = (text) => text.replace(/\n/g, "\n\n").length;

for (const [channel, limit, suffix, weight] of [
  ["linkedin", 3_000, "\n\n" + candidate.url, bufferLinkedInWeight],
  ["instagram", 2_196, "\n\nRead it via the R&D link in my bio.", bufferInstagramWeight],
]) {
  test(`${channel} fits long text while keeping complete emoji and the full suffix (task 0005)`, () => {
    const emoji = "👩‍🔬";
    const prefix = candidate.title + "\n\n";
    const room = limit - weight(prefix + suffix);
    const excerptPrefix = "a".repeat(room - emoji.length);
    const summary = excerptPrefix + emoji;
    const exact = announcements({ ...candidate, summary })[channel].text;
    assert.equal(weight(exact), limit);
    assert.equal(exact, prefix + summary + suffix);

    const shortened = announcements({ ...candidate, summary: summary + "aa" + emoji.repeat(10) })[channel].text;
    assert.ok(weight(shortened) <= limit);
    assert.equal(shortened, prefix + excerptPrefix + "…" + suffix);

    const longTitle = announcements({ ...candidate, title: "波".repeat(3_200) })[channel].text;
    assert.ok(weight(longTitle) <= limit);
    assert.ok(longTitle.startsWith("波") && longTitle.endsWith("…" + suffix));
  });
}

test("LinkedIn reserves Buffer's full URL cost for links in announcement text (task 0005)", () => {
  const title = "https://a.co ".repeat(12) + "a".repeat(3_000);
  const suffix = "\n\n" + candidate.url;
  const text = announcements({ ...candidate, title }).linkedin.text;
  assert.ok(text.startsWith("https://a.co "));
  assert.ok(text.endsWith("…" + suffix));
  assert.ok(bufferLinkedInWeight(text) <= 3_000);
});

test("X counts NFC-expanded musical symbols and keeps complete notes before the link (task 0005)", () => {
  // U+1D15E expands in NFC to U+1D157 U+1D165. Both scalars weigh two on X.
  const note = "\u{1D15E}";
  const normalizedNote = "\u{1D157}\u{1D165}";
  const suffix = "\n" + candidate.url;
  const exact = announcements({ ...candidate, title: note.repeat(64) }).x.text;
  assert.equal(exact, normalizedNote.repeat(64) + suffix, "64 four-unit notes plus the link and newline exactly fit");

  const overflow = announcements({ ...candidate, title: note.repeat(65) }).x.text;
  assert.ok(overflow.endsWith("…" + suffix));
  const title = overflow.slice(0, -suffix.length);
  assert.ok(Array.from(title).length * 2 + 24 <= 280);
  assert.equal(title, normalizedNote.repeat(63) + "…", "the last visible note keeps its stem");
});
