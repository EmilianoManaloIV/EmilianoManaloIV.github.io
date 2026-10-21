# ADR 0019: A Projects page, with a hands-on tesseract

- **Status:** accepted (2026-10-21, task 0002)
- **Deciders:** the user (asked; chose the home preview of two and the nav position), the main session
  (proposed)
- **Related:** amends ADR 0006 (where project cards appear), ADR 0009 (hands-on models), ADR 0015 (the
  pages-only nav); task 0002

## Context
Projects appear only as cards in the home page's Projects section (ADR 0006). Every project already has
its own page, but there is no page listing them all, and the home page grows by one full card per project,
which costs the QR-code visitor on slow Wi-Fi more scrolling and weight with every addition. The R&D page
established a pattern for a section's own page: a heading paired with a hands-on wireframe (the VR headset,
ADR 0009). The owner asked for a Projects page in the same style, with a 4D cube.

A 4D cube (a tesseract, or 8-cell) can't be seen directly; it is shown the way it has been shown since the
first computer animations of hyperobjects (A. Michael Noll, "A computer technique for displaying
n-dimensional hyperobjects", *Communications of the ACM*, 1967; Thomas Banchoff, *Beyond the Third
Dimension*, 1990): rotate it in the planes that involve the fourth axis, project it to 3D in perspective,
then project that to the screen. The inner cube appears to turn inside out through the outer one, which is
the effect that reads as "four-dimensional".

## Alternatives
- **Keep every card on the home page and add the Projects page beside it:** no change for visitors who
  scroll the home page, but the home page keeps growing; the owner chose the preview.
- **Draw the tesseract as a fixed animation (no interaction):** simpler, but it would break the R&D page's
  pattern, where the heading's model is hands-on.
- **A Schlegel diagram (a single fixed projection):** the classic textbook figure, but static, so it loses
  what makes the fourth dimension legible: the motion.

## Decision
- **`/projects/`, a new source page** in the R&D page's layout: the heading, an intro from a new
  `## Projects intro` section in `site-text.md` (ADR 0010), the tesseract beside it, then `01 — All
  projects` with every card, newest first.
- **The home page previews the two newest projects** and links to `/projects/` (amends ADR 0006).
- **The nav gains Projects as 02:** 00 Home, 01 About, 02 Projects, 03 R&D, 04 Guestbook, in content order
  (amends ADR 0015). Project pages mark Projects as current, as posts mark R&D. The project template's and
  the 404's links point to `/projects/`.
- **The tesseract** (`js/geometry.js`): the 16 vertices and 32 edges of [±1]⁴, rotated in the xw, yw and
  zw planes, projected to 3D with `k = d / (d + w)` (the same rule as the existing 3D projection), then through the existing 3D rotation and projection.
  It is hands-on like the headset (amends ADR 0009): drag and arrow keys turn the 3D view, Reset and Home
  put it back, and the 4D turn runs only while motion is on.
- **No clipping, by construction:** the largest 3D radius a projected vertex can reach is
  `2d / √(d² − 4)` (at `w = −4 / d`), and the existing `fitScale()` sizes the frame from it.
- Out: changing the cards, the project pages' layout, or the About page's skills.

## Rationale
The page follows the R&D page's established pattern, so it adds no new layout or component, only a mesh
and a page. Previewing two projects keeps the home page short and fast as the list grows, while every
project stays one tap away. The closed-form radius gives the same guarantee the headset has, proven by a
test rather than tuned by eye; since the projections map lines to lines, bounding the vertices bounds the
whole wireframe.

## Consequences
- Visitors get a page for all projects; the home page stays short.
- The nav has five items; on a 320 px phone the two-column nav grid takes one more row, and on tablets
  narrower than about 1000 px the header's tools (social links, theme toggle) wrap below the nav instead
  of breaking the labels or shrinking the icons under 24 px.
- Existing project pages and addresses are unchanged; only their breadcrumb now goes to `/projects/`.
- One more hands-on model to keep accessible and inside its budget (a few hundred bytes of JavaScript).
- Watch: the 4D turn and a visitor's 3D drag together; a test samples both at once.
