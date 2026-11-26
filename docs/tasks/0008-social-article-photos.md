# 0008 · Attach article photos on LinkedIn and X

- **Status:** in review
- **Requirements:** R-15, Q-01
- **Decisions:** ADR 0020
- **Model:** main session
- **PR:** pending

## Goal
LinkedIn and X announcements can attach a photo from the article along with the article link.

## Acceptance criteria
1. Select the first compatible article JPEG or PNG independently for LinkedIn and X. Keep the author's alt text and use a digest-based public URL. Exclude comment images.
2. Use text and the article link when the channel's selected photo is unavailable or ineligible. Instagram keeps its JPEG and branded fallback rules. Older artifacts still publish.
3. Verify previews and Buffer payloads with mocks, and run the offline, fixture, and live test suites. The owner merges the PR.

## After the review
The review found alt-text length and decoding edge cases. Each channel now skips photos outside its
alt-text limit. The build decodes the original attribute once, preserving literal entities in the
author's description. The focused tests cover both cases.
