import { readFileSync } from "node:fs";
import { domainToASCII } from "node:url";
import { decodeEntities, isPost, plainText } from "./render.mjs";

export const SOCIAL_LABEL = "share: social";
export const CHANNELS = ["linkedin", "x", "instagram"];
export const COVER = "/assets/img/rd-social.jpg";
export const coverImage = (site) => ({ url: site + COVER, alt: "R&D on Emiliano Panday Manalo IV's website" });
export const wantsSocial = (discussion) =>
  isPost(discussion) && discussion.labels?.nodes?.some(({ name }) => name === SOCIAL_LABEL);

export function socialCandidate(post, article, media, site) {
  if (!wantsSocial(post)) return null;
  // The localized article body contains only the author's images and their original alt text.
  const byFile = new Map([...media.values()].map((item) => [item.file, item]));
  const selected = {};
  for (const [, file, extension, alt] of article.matchAll(/<img src="(img-\d+\.(jpg|png))" alt="([^"]*)"/g)) {
    const { width, height, bytes } = byFile.get(file);
    if (width < 2 || height < 2) continue;
    const ratio = width / height;
    const photo = { url: site + post.path + file, alt: decodeEntities(alt) };
    if (photo.alt.length <= 300 && bytes < 10_000_000 && width * height < 36_152_320) selected.linkedin ??= photo;
    if (photo.alt.length <= 1000 && bytes <= 5_000_000 && width <= 8192 && height <= 8192) selected.x ??= photo;
    if (extension === "jpg" && width >= 320 && bytes <= 8_000_000 && ratio >= 0.8 && ratio <= 1.91) {
      selected.instagram ??= photo;
    }
    if (selected.linkedin && selected.x && selected.instagram) break;
  }
  const text = article
    .split(/<\/?(?:p|h[1-6]|li|ul|ol|blockquote|pre|figure|figcaption|table|tr|details|summary|div)(?:\s[^>]*)?>|<(?:br|hr)\s*\/?>/gi)
    .map((block) => plainText(block.replace(/<\/t[dh]>/gi, " ").replace(/<[^>]+>/g, "")))
    .filter(Boolean)
    .join("\n\n");
  const updatedAt = post.updatedAt ?? post.createdAt;
  const { instagram: image = coverImage(site), ...images } = selected;
  return {
    number: post.number, title: post.title, text, url: site + post.path, updatedAt, image,
    ...(Object.keys(images).length && { images }),
  };
}

export const revisionMarker = (revision) => "<!-- social-revision: " + revision + " -->";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// A checked-in IANA snapshot keeps previews reproducible and dotted identifiers as plain text.
const topLevelDomains = new Set(readFileSync(new URL("./social-tlds.txt", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1));
const domains = /(?<![\p{L}\p{M}\p{N}@-])(?:https?:\/\/)?(?:[\p{L}\p{M}\p{N}-]+[.\u3002\uff0e\uff61])+([\p{L}\p{M}\p{N}-]+)(?::\d+)?/giu;
const units = (text) => text.length;
// The one-unit ranges and emoji weights come from X's twitter-text v3 configuration (ADR 0020).
const xLight = /[\u0000-\u10ff\u2000-\u200d\u2010-\u201f\u2032-\u2037]/u;
const xWeight = (text) => /^\p{RGI_Emoji}$/v.test(text) ? 2
  : Array.from(text, (character) => xLight.test(character) ? 1 : 2).reduce((sum, count) => sum + count, 0);
const instagramWeight = (text) => text.length + (text.match(/[\r\n]/g)?.length ?? 0);

function urlEnd(text, hostEnd) {
  if (!/[/?#]/.test(text[hostEnd] ?? "")) return hostEnd;
  let depth = 0;
  let end = hostEnd;
  for (let i = hostEnd; i < text.length; i++) {
    const character = text[i];
    if (/[\s<>"]/.test(character)) break;
    if (character === "," && /^https?:\/\//i.test(text.slice(i + 1, i + 9))) break;
    if (character === "(") depth++;
    if (character === ")") {
      if (depth === 0) break;
      depth--;
    }
    if (depth === 0 && !/[.,!?;:\]}]/.test(character)) end = i + 1;
  }
  return end;
}

function* textSegments(text, urlWeight) {
  let offset = 0;
  if (urlWeight) {
    for (const match of text.matchAll(domains)) {
      if (match.index < offset || !topLevelDomains.has(domainToASCII(match[1]).toUpperCase())) continue;
      for (const { segment } of graphemes.segment(text.slice(offset, match.index))) yield [segment, null];
      offset = urlEnd(text, match.index + match[0].length);
      yield [text.slice(match.index, offset), urlWeight];
    }
  }
  for (const { segment } of graphemes.segment(text.slice(offset))) yield [segment, null];
}

function shorten(text, limit, weight, urlWeight) {
  const weighted = Array.from(textSegments(text, urlWeight), ([part, cost]) => [part, cost ?? weight(part)]);
  if (weighted.reduce((sum, [, count]) => sum + count, 0) <= limit) return text;
  let remaining = limit - weight("…");
  let shortened = "";
  for (const [segment, count] of weighted) {
    remaining -= count;
    if (remaining < 0) break;
    shortened += segment;
  }
  return shortened.trimEnd() + "…";
}

export function announcements(post) {
  const title = post.title.normalize("NFC").replace(/\s+/g, " ").trim();
  // A previous workflow version may still have an excerpt-only artifact.
  const text = (post.text ?? post.summary ?? "").normalize("NFC");
  const article = [title, text].filter(Boolean).join("\n\n");
  const link = "\n\n" + post.url;
  const bio = "\n\nRead it via the R&D link in my bio.";
  return {
    // Buffer counts the LinkedIn link as 24 characters and the two newlines as two.
    linkedin: { text: shorten(article, 3000 - 26, units, 24) + link, ...(post.images?.linkedin && { image: post.images.linkedin }) },
    // X counts the article link as 23 characters and the newline as one.
    x: { text: shorten(article, 280 - 24, xWeight, 23) + "\n" + post.url, ...(post.images?.x && { image: post.images.x }) },
    instagram: { text: shorten(article, 2196 - instagramWeight(bio), instagramWeight) + bio, image: post.image },
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
