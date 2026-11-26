import { isPost, plainText } from "./render.mjs";

export const SOCIAL_LABEL = "share: social";
export const CHANNELS = ["linkedin", "x", "instagram"];
export const COVER = "/assets/img/rd-social.jpg";
export const coverImage = (site) => ({ url: site + COVER, alt: "R&D on Emiliano Panday Manalo IV's website" });
export const wantsSocial = (discussion) =>
  isPost(discussion) && discussion.labels?.nodes?.some(({ name }) => name === SOCIAL_LABEL);

export function socialCandidate(post, body, media, site) {
  if (!wantsSocial(post)) return null;
  // The localized article body contains only the author's images and their original alt text.
  const byFile = new Map([...media.values()].map((item) => [item.file, item]));
  let image = coverImage(site);
  for (const [, file, alt] of body.matchAll(/<img src="(img-\d+\.jpg)" alt="([^"]*)"/g)) {
    const { width, height, bytes } = byFile.get(file);
    const ratio = width / height;
    if (width < 320 || bytes > 8_000_000 || ratio < 0.8 || ratio > 1.91) continue;
    image = { url: site + post.path + file, alt: plainText(alt) };
    break;
  }
  const updatedAt = post.updatedAt ?? post.createdAt;
  return { number: post.number, title: post.title, summary: post.summary, url: site + post.path, updatedAt, image };
}

export const revisionMarker = (revision) => "<!-- social-revision: " + revision + " -->";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// A conservative allowance for URLs in the source copy, including bare domains.
const urlMarkers = (text) => text.match(/[.:\u3002\uff0e\uff61]/gu)?.length ?? 0;
const linkedinWeight = (text) => text.length + 24 * urlMarkers(text);
const xWeight = (text) => 2 * Array.from(text).length + 23 * urlMarkers(text);
const instagramWeight = (text) => text.length + (text.match(/[\r\n]/g)?.length ?? 0);

function shorten(text, limit, weight) {
  if (weight(text) <= limit) return text;
  let remaining = limit - weight("…");
  let shortened = "";
  for (const { segment } of graphemes.segment(text)) {
    remaining -= weight(segment);
    if (remaining < 0) break;
    shortened += segment;
  }
  return shortened.trimEnd() + "…";
}

export function announcements(post) {
  const title = post.title.normalize("NFC").replace(/\s+/g, " ").trim();
  const summary = [title, post.summary.normalize("NFC")].filter(Boolean).join("\n\n");
  const link = "\n\n" + post.url;
  const bio = "\n\nRead it via the R&D link in my bio.";
  return {
    // Buffer counts the LinkedIn link as 24 characters and the two newlines as two.
    linkedin: { text: shorten(summary, 3000 - 26, linkedinWeight) + link },
    // X counts the article link as 23 characters and the newline as one.
    x: { text: shorten(title, 280 - 24, xWeight) + "\n" + post.url },
    instagram: { text: shorten(summary, 2196 - instagramWeight(bio), instagramWeight) + bio, image: post.image },
  };
}

// External effects are supplied by the Actions runner or replaced by mocks in tests.
export async function runSocial({ posts, enabled, eligible, loadState, prepare, send, channelIds, report }) {
  let complete = true;

  for (const post of posts) {
    const messages = announcements(post);
    if (!enabled) {
      for (const channel of CHANNELS) report(post, channel, "preview", messages[channel]);
      continue;
    }

    const state = await loadState(post.number);
    if (CHANNELS.every((channel) => state.entries[channel]?.status === "accepted")) continue;
    for (const channel of CHANNELS) {
      const previous = state.entries[channel];
      if (previous && previous.status !== "not_sent") {
        if (previous.status !== "accepted") {
          report(post, channel, "needs review (" + previous.status + ")");
          complete = false;
        }
        continue;
      }

      const firstCheck = await eligible(post);
      if (firstCheck !== "ready") {
        report(post, null, firstCheck);
        if (firstCheck === "waiting for live page") complete = false;
        break;
      }
      const preparation = await prepare(channel, messages[channel]);

      const attempt = {
        channelId: channelIds[channel], attemptedAt: new Date().toISOString(), url: post.url, revision: post.revision,
      };
      if (preparation.rejection) {
        await state.save(channel, { ...attempt, ...preparation.rejection });
        report(post, channel, "rejected");
        complete = false;
        continue;
      }
      // Persist the claim before Buffer can accept anything. A crash or timeout leaves it for review.
      await state.save(channel, { ...attempt, status: "pending" });
      const eligibility = await eligible(post).catch(() => "eligibility check failed");
      if (eligibility !== "ready") {
        // This claim is safe to reuse if a later deployment is eligible.
        await state.save(channel, { ...attempt, status: "not_sent", reason: eligibility });
        report(post, channel, eligibility);
        if (["waiting for live page", "eligibility check failed"].includes(eligibility)) complete = false;
        break;
      }
      let result;
      try {
        result = await send(preparation.input);
      } catch {
        report(post, channel, "outcome unknown (pending)");
        complete = false;
        continue;
      }
      await state.save(channel, { ...attempt, ...result });
      report(post, channel, result.status);
      if (result.status !== "accepted") complete = false;
    }
  }
  return complete;
}
