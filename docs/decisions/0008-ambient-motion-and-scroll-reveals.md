# 0008: Ambient background motion and scroll reveals

Status: Accepted (2026-10-18). Builds on 0002 and 0003. (0007 is reserved for the parallel video-clips work.)

## Context

The owner wants the site more visually interesting while keeping the branding guide's style:
- livelier background grids;
- a console that fills more of the screen;
- sections and the values text that slide into view while scrolling.

The JavaScript budget (ADR 0003, 10 KB gzipped) was almost spent, and a parallel feature also needs room in it. Motion must stay pausable (WCAG 2.2.2) and start paused under reduced motion (ADR 0002).

## Decision

**Do the motion in CSS.** JavaScript changes are limited to copying console lines and the wave formula.

**Two kinds of motion, two gates:**
- **Looping motion** (the page grid's slow drift, the dot-matrix shimmer, the console echo drift, removed in 0017) runs only under `html.js-ready:not(.motion-off)`. `main.js` adds `js-ready` once it has run and sets `motion-off` in `setMotion`, so no new class or script is needed. (A separate `motion-on` class was dropped to stay inside the JavaScript budget once video clips landed.) The footer and banner toggles therefore stop it, reduced-motion visitors start with it off, and it never runs without JavaScript, when no toggle exists.
- **Scroll-linked motion** (section reveals, the values' staggered entry and heading wipe, the grid's parallax) moves only while the visitor scrolls, so it is not auto-playing. It still sits inside `@media screen and (prefers-reduced-motion: no-preference)` and under `html:not(.motion-off)`. Printing gets the page as is.

**The pieces:**
- **Page-wide grid:** `body::before` is a faint 48 px grid fixed behind the page. Dark panels cover it. While motion is on it drifts one cell diagonally every 40 seconds, which loops seamlessly. It also moves slower than the page through a scroll timeline. The two use the separate `translate` and `transform` properties, so they combine. An earlier full-page scan line was dropped as too busy.
- **Dot-matrix columns:** the dimming lives in the dot color, so a brighter band of the same dots can scan up and down. The scan animates `mask-position`, which repaints, so it runs only at 800 px and up. On phones the dots return, static, behind the headline only.
- **Wave** (replaced by the terrain in 0014): a larger, faster ripple plus a diagonal swell, bounded at ±0.3 by a test. The banner layout still sizes the mesh from sampled poses, so a peak between samples can come within a few pixels of the canvas edge. The console's WAVE line uses the same phase speed.
- **Console:** on desktop the banner grows toward the screen height and the console column widens. On phones the console shows more lines. The existing line fitting adapts automatically.
- **Echoes** (removed in 0017): faint, `aria-hidden` copies of the console's finished lines sit beside the name and above the values. They update once per finished line, not per character, and cannot be selected. The hero echoes show at 1280 px and up, and the values echo at 800 px and up.
- **Reveals:** CSS view timelines (`animation-timeline: view()`) inside `@supports`. Content is hidden only inside the animation, so browsers without view timelines, such as Firefox today, show the page as is, and anchor jumps land fully revealed. Every range ends by `entry 100%`, which any block with content below it always reaches, so nothing stays half-revealed at the bottom of the page.

**Tests** enforce:
- every selector of every infinite CSS animation is gated by `html.js-ready:not(.motion-off)`, except the console cursor that `main.js` creates;
- every `animation-timeline` is inside a screen, no-preference block, and every scroll-linked rule is stopped by the toggle;
- echoes are `aria-hidden` (the echoes were removed in 0017).

## Alternatives

- **IntersectionObserver reveals in JavaScript:** works in every browser, but costs budget the video feature needs, and only replaces a progressive enhancement.
- **A canvas background grid:** more freedom, but more script and constant repainting on phones.

## Consequences

- **Budget:** with video clips (ADR 0007), `js/` sits just under the 10.24 KB gzipped budget. The next feature that adds script must make room or revisit ADR 0003.
- **Firefox:** visitors without view timelines see no reveals or parallax. Everything else works.
- **New looping animations** must be gated by `html.js-ready:not(.motion-off)`, or the site test fails.
