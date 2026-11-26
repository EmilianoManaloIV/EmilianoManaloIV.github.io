import { isPost, plainText } from "./render.mjs";

export const SOCIAL_LABEL = "share: social";
export const CHANNELS = ["linkedin", "x", "instagram"];
export const COVER = "/assets/img/rd-social.jpg";
export const wantsSocial = (discussion) =>
  isPost(discussion) && discussion.labels?.nodes?.some(({ name }) => name === SOCIAL_LABEL);

export function socialCandidate(post, body, media, site) {
  if (!wantsSocial(post)) return null;
  // The localized article body contains only the author's images and their original alt text.
  const byFile = new Map([...media.values()].map((item) => [item.file, item]));
  let image = { url: site + COVER, alt: "R&D on Emiliano Panday Manalo IV's website" };
  for (const [, file, alt] of body.matchAll(/<img src="(img-\d+\.jpg)" alt="([^"]*)"/g)) {
    const { width, height, bytes } = byFile.get(file);
    const ratio = width / height;
    if (bytes > 8_000_000 || ratio < 0.8 || ratio > 1.91) continue;
    image = { url: site + post.path + file, alt: plainText(alt) };
    break;
  }
  const updatedAt = post.updatedAt ?? post.createdAt;
  return { number: post.number, title: post.title, summary: post.summary, url: site + post.path, updatedAt, image };
}

export const revisionMarker = (revision) => "<!-- social-revision: " + revision + " -->";

export function announcements(post) {
  const title = post.title.replace(/\s+/g, " ").trim();
  const summary = [title, post.summary].filter(Boolean).join("\n\n");
  // Budget two units per character and reserve a shortened URL for any domain separator in the title.
  let remaining = 240;
  let shortTitle = "";
  for (const character of title) {
    remaining -= /[.\u3002\uff0e\uff61]/u.test(character) ? 25 : 2;
    if (remaining < 0) break;
    shortTitle += character;
  }
  if (shortTitle !== title) shortTitle = shortTitle.trimEnd() + "…";
  return {
    linkedin: { text: summary + "\n\n" + post.url },
    x: { text: shortTitle + "\n" + post.url },
    instagram: { text: summary + "\n\nRead it via the R&D link in my bio.", image: post.image },
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
