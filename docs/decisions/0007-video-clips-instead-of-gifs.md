# 0007: Video clips instead of GIFs

Status: Accepted (2026-10-18). Builds on 0002, 0003, 0005, and 0006.

## Context

R&D posts and projects show work in motion: a shader, a rig, a UI. Until now the only way was an animated GIF. GIFs work, but they are heavy on conference Wi-Fi, often 5 to 10 times larger than the same clip as H.264. They also ignore the site's motion toggle and reduced motion, so they break the rule from 0002 that all motion can be paused (WCAG 2.2.2).

GitHub lets the owner drag an `.mp4`, `.mov`, or `.webm` into a discussion. The API then returns it as a `<video>` inside a `<details>` box whose summary is the file name. The sanitizer from 0005 had no `video` tag, so clips were silently dropped.

## Decision

Short, silent clips are supported in the owner's posts and project bodies. They play only while the site's motion is on.

**Sanitizer:**
- `<video>` is allowed only in the owner's text. In comments and guestbook signatures it is dropped like any other unknown tag, so visitors get no video.
- The only attribute kept is `src`, and only from GitHub's image and attachment hosts. `autoplay`, `poster`, `style`, event handlers, and everything else GitHub or a writer adds are dropped.
- There is no video inside a video, so the fragment always stays balanced.

**Build:**
- Clips are downloaded like images (0005). They use the same host allowlist, redirect check, 15-second timeout, streaming size cap, and 20-file limit per page. They also share the 25 MB page budget with images.
- **Size cap:** 10 MB per clip, matching GitHub's free-plan upload limit for video. Clips over 4 MB get a build warning, since they load slowly on conference Wi-Fi.
- **Format check, with no dependencies:** the build reads the file's own structure. For MP4 and MOV it walks the boxes to the video track's `tkhd` (display size, including a phone's 90° rotation) and `stsd` (codec). For WebM it reads the EBML track entry.
- **Codecs:** only codecs every current browser plays are kept: H.264 in MP4 or MOV, and VP8 or VP9 in WebM. An iPhone's HEVC `.MOV` is dropped with a warning to export it as H.264 MP4, because Chrome and Firefox can't play HEVC everywhere. A clip whose size can't be read is dropped too, so every clip has a width and height and the page never jumps.
- **Markup:** GitHub's `<details>` box is unwrapped into a single clip: `<video src="clip-1.mp4#t=0.001" width height aria-label controls muted loop playsinline preload="metadata" data-clip>`. The markup never says `autoplay`. `#t=0.001` with `preload="metadata"` shows the first frame in place of a poster.
- **Accessible name:** the clip is named from its file name, so `orbit-demo.mp4` reads as "orbit demo". Camera and recorder defaults such as `IMG_9408.MOV` say nothing, so they become "Video clip".

**Motion (`js/main.js`):**
- Clips join the existing motion gate. A clip plays only when motion is on, the tab is visible, and the clip is on screen. Otherwise it pauses. The footer toggle pauses every clip at once.
- Reduced motion already starts motion off unless the visitor chose otherwise (0002), so clips start paused.
- The gate acts only when its own answer changes. A visitor who presses play while motion is off keeps that choice. A pause while motion is on holds until the clip leaves the screen and comes back. Remembering every manual pause would cost bytes the budget doesn't have, and the footer toggle stays the way to stop all clips.
- Without JavaScript, nothing plays on its own and the browser's controls still work.
- The JavaScript budget stays at 10 KB gzipped (0003). This adds about 180 bytes (10,094 of 10,240 in total), leaving roughly 145 bytes of headroom.

**Project cards (0006):**
- The card shows the project's first image, as before.
- Only a project with no image uses its first clip, without controls and under the same motion gate. The home page is where visitors land from the QR code, so a still image stays the lighter default.

## Alternatives

- **Keep GIFs only:** nothing to build, but GIFs stay heavy and can't be paused, which breaks 0002.
- **Re-encode in CI (ffmpeg):** would make posters, strip audio, and move metadata to the front of the file, but adds a large binary dependency to a zero-dependency build (0001).
- **YouTube or Vimeo embeds:** third-party frames, cookies, and requests, ruled out by 0001.
- **Allow video in comments:** visitors could post clips, but it widens what strangers can make the build download and the page show, for little gain in a comment thread.
- **Clips as card media first:** livelier cards, but the home page would load video for every project on conference Wi-Fi.

## Consequences

- **Owner workflow:** drag a short `.mp4` into the discussion, under 10 MB (ideally under 4 MB), named for what it shows. HEVC phone recordings must be exported as H.264 first. A dropped clip is named in the Actions run's warnings.
- **Codec profiles:** the check reads the codec name only. A rare 10-bit or 4:4:4 H.264 file passes but may show black in some browsers. Ordinary phone and editor exports are 8-bit 4:2:0 and play everywhere.
- **Visitors' videos:** the sanitizer drops the video and the empty box GitHub wraps it in, so a comment shows only its text.
- **No poster image and no captions:** making a poster needs a video decoder. The clips are silent demos, so the text around a clip should say what it shows, as alt text does for an image.
- **Metadata at the end of a file:** an MP4 written without "faststart" still plays. GitHub Pages supports range requests, so the browser makes one extra request to find the metadata.
- **Budget:** the JavaScript headroom is nearly used up. The next script feature needs trimming or a new decision.
