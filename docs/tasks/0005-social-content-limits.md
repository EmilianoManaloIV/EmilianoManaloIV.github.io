# 0005 · Fit announcement text and images to each social channel

- **Status:** in review
- **Requirements:** R-02, R-15, Q-08
- **Decisions:** ADR 0020
- **Model:** main session
- **PR:** [#35](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/pull/35)

## Goal
The owner can publish a full R&D article even when its text or media exceeds a social platform's limits.

## Scope and acceptance
LinkedIn and Instagram fit the title and excerpt into their text limits while retaining the link or bio prompt. X normalizes Unicode before counting and retains the link. Instagram uses the branded JPEG when the article's image is too small, incompatible, or unavailable at submission. An unavailable fallback affects Instagram alone. The published article retains its original title, body, and eligible website media.

## Validation
Exercise long posts and normalization, small images, unavailable live images, and the full article in a fixture build. Run the offline, fixture, and live build suites before opening a PR. The owner merges.

## After the review
The independent review reproduced two overflows against Buffer's API limits. Instagram counts line breaks as two units and caps the caption at 2,196 units. LinkedIn counts a URL as 24 units. The formatter now allows for both rules, and the regressions measure the finished announcements using Buffer's weights.
