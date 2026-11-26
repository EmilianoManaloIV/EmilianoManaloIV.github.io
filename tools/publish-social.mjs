import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { escapeHtml, postPath } from "./render.mjs";
import { CHANNELS, COVER, revisionMarker, runSocial, wantsSocial } from "./social.mjs";

const SITE = "https://emilianomanaloiv.github.io";
const REPO = "EmilianoManaloIV/EmilianoManaloIV.github.io";
const STATE_BRANCH = "social-publishing-state";
const BUFFER_API = "https://api.buffer.com";
const SERVICES = { linkedin: "linkedin", x: "twitter", instagram: "instagram" };
const NAMES = { linkedin: "LinkedIn", x: "X", instagram: "Instagram" };
const CURRENT_DISCUSSION = `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      number title createdAt updatedAt author { login } category { name }
      labels(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { name } }
    }
  }
}`;
const BUFFER_CHANNELS = `query($organization: OrganizationId!) {
  channels(input: { organizationId: $organization }) { id service type isDisconnected }
}`;
const CREATE_POST = `mutation($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id } }
  }
}`;
class PublishingError extends Error {}

function reportLine(post, channel, status, message) {
  const heading = `Discussion #${post.number}${channel ? " · " + NAMES[channel] : ""}${": " + status}`;
  if (!message) return "- " + heading + "\n";
  const image = message.image ? "\n\n![Instagram image](" + message.image.url + ")\n" : "";
  return "### " + heading + "\n\n<pre>" + escapeHtml(message.text) + "</pre>" + image + "\n\n";
}

function githubClient(auth, request) {
  return async (path, body, method = body ? "POST" : "GET") => {
    const response = await request("https://api.github.com" + path, {
      method,
      headers: {
        Authorization: "Bearer " + auth, Accept: "application/vnd.github+json", "Content-Type": "application/json",
      },
      ...(body && { body: JSON.stringify(body) }),
    });
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok) throw new PublishingError("GitHub publishing request returned HTTP " + response.status);
    return response.json();
  };
}

async function loadState(github, number) {
  const path = `/repos/${REPO}/contents/${number}.json`;
  const file = await github(path + "?ref=" + STATE_BRANCH);
  let sha = file?.sha;
  const entries = file ? JSON.parse(Buffer.from(file.content, "base64").toString("utf8")) : {};
  if (!entries || Array.isArray(entries) || typeof entries !== "object" ||
      Object.values(entries).some((entry) => !["pending", "rejected", "accepted", "not_sent"].includes(entry?.status))) {
    throw new PublishingError("Invalid publishing status for discussion #" + number);
  }

  return { entries, async save(channel, result) {
    const next = { ...entries, [channel]: result };
    const saved = await github(path, {
      branch: STATE_BRANCH,
      sha,
      message: `Record ${channel} publishing status for discussion #${number}`,
      content: Buffer.from(JSON.stringify(next, null, 2) + "\n").toString("base64"),
    }, "PUT");
    sha = saved.content.sha;
    entries[channel] = result;
  } };
}

async function eligibility(post, github, request) {
  const [owner, name] = REPO.split("/");
  let after = null;
  do {
    const { data, errors } = await github("/graphql", {
      query: CURRENT_DISCUSSION, variables: { owner, name, number: post.number, after },
    });
    if (errors || !data?.repository) throw new PublishingError("Could not verify the discussion label");
    const discussion = data.repository.discussion;
    if (!discussion || SITE + postPath(discussion) !== post.url) return "discussion removed or renamed";
    if (wantsSocial(discussion)) {
      if ((discussion.updatedAt ?? discussion.createdAt) !== post.updatedAt) return "waiting for live page";
      const canonical = `<link rel="canonical" href="${post.url}">`;
      try {
        const page = await request(post.url);
        if (page.ok) {
          const html = await page.text();
          if (html.includes(canonical) && html.includes(revisionMarker(post.revision))) return "ready";
        }
      } catch {
        // Pages can take time to serve a new deployment. A later run will check again.
      }
      return "waiting for live page";
    }
    const { pageInfo } = discussion.labels;
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after);
  return "discussion no longer eligible";
}

function bufferClient({ key, organization, channelIds }, request) {
  const queryBuffer = async (query, variables) => {
    const response = await request(BUFFER_API, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error("Buffer returned HTTP " + response.status);
    return response.json();
  };
  let channels;

  const reject = (reason) => ({ rejection: { status: "rejected", reason } });
  async function prepare(channel, { text, image }) {
    const channelId = channelIds[channel];
    const input = { channelId, text, assets: [], mode: "shareNow", schedulingType: "automatic", needsApproval: false };
    try {
      channels ??= queryBuffer(BUFFER_CHANNELS, { organization }).then((response) => response.data?.channels);
      const connection = (await channels)?.find(({ id, service }) => id === channelId && service === SERVICES[channel]);
      if (!connection || connection.isDisconnected) {
        return reject("Check the configured Buffer channel and its connection.");
      }
      if (image) {
        if (connection.type === "profile") return reject("Instagram automatic publishing needs a professional connection.");
        const photo = await request(image.url, { method: "HEAD" });
        if (!photo.ok || photo.headers.get("content-type")?.split(";")[0] !== "image/jpeg") {
          return reject("The Instagram JPEG is unavailable on the live site.");
        }
        input.assets = [{ image: { url: image.url, metadata: { altText: image.alt } } }];
        input.metadata = { instagram: { type: "post", shouldShareToFeed: true } };
      }
    } catch {
      return reject("Could not verify the Buffer channel or live JPEG.");
    }
    return { input };
  }
  async function send(input) {
    const response = await queryBuffer(CREATE_POST, { input });
    const result = response.data?.createPost;
    if (result?.__typename === "PostActionSuccess" && result.post?.id) {
      return { status: "accepted", bufferId: result.post.id };
    }
    if (["InvalidInputError", "LimitReachedError"].includes(result?.__typename) && !response.errors?.length) {
      return { status: "rejected", reason: "Buffer declined the create-post request." };
    }
    throw new Error("Could not confirm the Buffer submission");
  }
  return { prepare, send };
}

// Entry point shared with the mock integration test. Production endpoints are fixed.
export async function publishSocial(posts, env, { fetch = globalThis.fetch, report } = {}) {
  if (env.PAGES_DEPLOYED !== "success") return true;
  const enabled = env.SOCIAL_PUBLISH === "true";
  let channelIds;
  if (enabled && posts.length) {
    if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== REPO || env.GITHUB_REF !== "refs/heads/main") {
      throw new PublishingError("Social publishing requires this repository's production workflow");
    }
    try {
      channelIds = JSON.parse(env.BUFFER_CHANNEL_IDS || "{}");
    } catch {
      throw new PublishingError("BUFFER_CHANNEL_IDS must be a JSON object");
    }
    if (!env.BUFFER_API_KEY || !env.BUFFER_ORGANIZATION_ID || !env.GITHUB_TOKEN ||
        !CHANNELS.every((channel) => typeof channelIds?.[channel] === "string" && channelIds[channel].trim())) {
      throw new PublishingError("Configure the Buffer key, organization and three channel IDs before enabling social publishing");
    }
  }

  for (const post of posts) {
    const path = new URL(post.url).pathname;
    if (!Number.isSafeInteger(post.number) || post.number < 1 ||
        !/^[a-f0-9]{64}$/.test(post.revision) || !Number.isFinite(Date.parse(post.updatedAt)) ||
        SITE + postPath(post) !== post.url ||
        (post.image.url !== SITE + COVER &&
         !(post.image.url.startsWith(SITE + path) && /^social-[a-f0-9]{64}\.jpg$/.test(post.image.url.slice((SITE + path).length))))) {
      throw new PublishingError("Invalid article or image URL in the social manifest");
    }
  }

  const request = (url, options) => fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(15000) });
  const github = githubClient(env.GITHUB_TOKEN, request);
  return runSocial({
    posts, enabled, report, channelIds,
    eligible: (post) => eligibility(post, github, request),
    loadState: (number) => loadState(github, number),
    ...bufferClient({ key: env.BUFFER_API_KEY, organization: env.BUFFER_ORGANIZATION_ID, channelIds }, request),
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  const output = (text) => summary ? appendFileSync(summary, text) : process.stdout.write(text);
  try {
    const posts = JSON.parse(readFileSync(process.argv[2], "utf8"));
    output("## Social announcements\n\n");
    if (!posts.length) output("No tagged R&D posts in this deployment.\n");
    const done = await publishSocial(posts, process.env, {
      report: (...args) => output(reportLine(...args)),
    });
    if (!done) process.exitCode = 1;
  } catch (error) {
    // API response bodies and credentials belong in neither the job summary nor logs.
    const message = error instanceof PublishingError ? error.message : "Check the job configuration and status branch before retrying.";
    output("Social publishing stopped. " + message + "\n");
    console.error("Social publishing stopped. " + message);
    process.exitCode = 1;
  }
}
