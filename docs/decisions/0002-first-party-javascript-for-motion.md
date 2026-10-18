# 0002: First-party JavaScript for motion

Status: Accepted (2026-10-18). Amends 0001.

## Context

The owner wants the banner terminal to look live and the wireframe art to move in 3D.
The Figma design draws these as static text and flat vectors, so real 3D motion needs geometry and a renderer.
ADR 0001 ruled out JavaScript. The owner also wants a dark-mode toggle, which needs a few lines of script.

## Decision

Allow small, first-party JavaScript as progressive enhancement. Keep zero dependencies.

- `js/theme.js` runs in `<head>` and applies a saved theme before first paint.
- `js/geometry.js` builds wireframe meshes and projects them. It is pure and unit-tested in Node.
- `js/main.js` draws the meshes on `<canvas>`, types the terminal, and wires the theme and motion toggles.

Rules, enforced by `test/site.test.mjs`:

- No inline scripts and no external script URLs.
- No network APIs, URLs, or dynamic imports in `js/`. Only relative static imports.
- All of `js/` stays under 8 KB gzipped, summed per file. This tracks bytes over the network on slow Wi-Fi. It replaced a raw-size limit (12 KB, then 16 KB) that pushed useful comments out of the code.
- The page must stay usable without JavaScript. Toggles are hidden until scripts run.
- Motion starts paused under `prefers-reduced-motion`, and a visible control pauses it at any time (WCAG 2.2.2).

## Alternatives

- **three.js or another 3D library.** Hundreds of KB for three line-drawn shapes, and it breaks the zero-dependency rule.
- **Pre-rendered video loops.** No script, but far heavier on conference Wi-Fi.
- **CSS-only rotation of the Figma vectors.** No script, but the motion is 2D.

## Consequences

- The 3D shapes are procedural lookalikes of the Figma vectors, not exact copies.
- Animation runs only while a canvas is on screen and the tab is visible, to save battery.
- Any future script must fit the rules above or come with a new ADR.
