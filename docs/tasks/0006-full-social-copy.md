# 0006 · Share the article text up to each channel's limit

- **Status:** in review
- **Requirements:** R-02, R-15
- **Decisions:** ADR 0020
- **Model:** main session
- **PR:** [#37](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/pull/37)

## Goal
Social announcements include the full text when it fits. The owner asked to shorten copy only when a destination's limit requires it.

## Acceptance criteria
1. Generate social copy from the rendered author article and preserve paragraph breaks. LinkedIn, X and Instagram all include the body when it fits.
2. Keep the article URL on LinkedIn and X and the bio prompt on Instagram. Count the platform's text, newline and URL weights before truncating. Keep complete text segments when shortening.
3. Preserve the existing website article, website card excerpts, image selection and the eligibility rules. Test dry runs and Buffer payloads with mocks. Validate the offline, fixture and live builds before opening the PR.

## After the review
Preserved boundaries between paragraphs and other blocks without splitting words at inline tags. The
review's URL cases now cover adjacent links, nested parentheses, and dotted code identifiers. X uses
the published Unicode weights. The website excerpts and the legacy artifact fallback were verified.
