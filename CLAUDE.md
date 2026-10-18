# CLAUDE.md

Personal website for Emiliano Panday Manalo IV, built for conference use.
Visitors mostly arrive on a phone by scanning a QR code, often on slow Wi-Fi.

## Stack

Hand-written static HTML, CSS, and a little first-party JavaScript. **Zero dependencies, no build step.**
Read `docs/decisions/0001-zero-dependency-static-site.md` and `0002-first-party-javascript-for-motion.md` before changing this.

- `index.html` is the single page. Sections are anchored by id.
- `styles.css` holds design tokens in `:root` at the top, then components.
- `js/theme.js` applies a saved theme in `<head>`. `js/main.js` runs the canvas wireframes, terminal, and toggles.
- `js/geometry.js` is pure mesh and projection math, unit-tested in `test/geometry.test.mjs`.
- `js/ui.js` runs wayfinding, share and copy, and the talk status chip. `js/status.js` holds its pure time logic, tested in `test/status.test.mjs`.
- `assets/fonts/` holds self-hosted `.woff2` files with their OFL licenses. Never link a font CDN.
- `assets/img/` holds images.

Colors come from the Figma "Branding Guide" variables, in Light and Dark modes. Keep the `--brand-*` names in sync with Figma.

Design source of truth: Figma Sites file "Personal Website"
https://www.figma.com/site/uuMSVAiWUYtckwg7fJRxfF/Personal-Website?node-id=0-1

Breakpoints match the Figma frames: mobile below 800px, tablet 800 to 1279px, desktop 1280px and up.
CSS is mobile-first with `min-width` queries at those two widths.

## Commands

```bash
node --test            # run the site checks in test/
py -m http.server 8000 # serve locally (use `py`, not `python`, on this machine)
```

## Rules

- No npm packages, CDNs, or external stylesheet, script, or font URLs. No inline scripts.
- JavaScript lives in `js/`, makes no network requests, uses only relative imports, and stays under 10 KB gzipped in total (ADR 0003).
- The page must work without JavaScript. Motion must be pausable and start paused under reduced motion.
- The tests enforce these rules. Do not weaken them to make a change pass.
- Every `<img>` needs `alt`, `width`, and `height`.
- Every in-page `href="#..."` must match an element id.
- Placeholder content is marked with `TODO` so it is easy to find before launch.

## Git workflow

- Feature branches: `feature/`, `fix/`, `docs/`, `chore/`.
- Open a PR into `main`. CI runs `node --test` on every PR.
- Pushing to `main` deploys to GitHub Pages. **Only the owner merges into `main`.**
