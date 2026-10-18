# CLAUDE.md

Personal website for Emiliano Panday Manalo IV, built for conference use.
Visitors mostly arrive on a phone by scanning a QR code, often on slow Wi-Fi.

## Stack

Hand-written static HTML and CSS. **Zero dependencies, no build step, no JavaScript.**
See `docs/decisions/0001-zero-dependency-static-site.md` before changing this.

- `index.html` is the single page. Sections are anchored by id.
- `styles.css` holds design tokens in `:root` at the top, then components.
- `assets/fonts/` holds self-hosted `.woff2` files. Never link a font CDN.
- `assets/img/` holds images exported from Figma.

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

- Do not add `<script>` tags, npm packages, or external stylesheet/script/font URLs. The tests fail if you do.
- Every `<img>` needs `alt`, `width`, and `height`.
- Every in-page `href="#..."` must match an element id.
- Placeholder content is marked with `TODO` so it is easy to find before launch.

## Git workflow

- Feature branches: `feature/`, `fix/`, `docs/`, `chore/`.
- Open a PR into `main`. CI runs `node --test` on every PR.
- Pushing to `main` deploys to GitHub Pages. **Only the owner merges into `main`.**
