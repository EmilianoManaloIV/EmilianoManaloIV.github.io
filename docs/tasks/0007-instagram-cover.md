# 0007 · Update the Instagram fallback card

- **Status:** in review
- **Requirements:** R-15
- **Decisions:** ADR 0020
- **Model:** main session
- **PR:** pending

## Goal and scope
Use the owner's supplied square R&D graphic when an Instagram announcement needs a fallback image.

## Acceptance criteria
The JPEG at `assets/img/rd-social.jpg` preserves the original dimensions and composition, measures
1080 × 1080 pixels, and stays under 8 MB. Inspect the rendered image and verify the fixture prepares it
as the Instagram cover. Run the offline, fixture, and live suites. The owner merges the PR.

## After the review
Independent review confirmed the JPEG dimensions, composition, file size, and fallback selection.
