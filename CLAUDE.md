# CLAUDE.md

Personal website for Emiliano Panday Manalo IV, built for conference use.
Visitors mostly arrive on a phone by scanning a QR code, often on slow Wi-Fi.

## Stack

Hand-written static HTML, CSS, and a little first-party JavaScript. **Zero dependencies.**
A zero-dependency build (`tools/build.mjs`) runs in CI and turns GitHub Discussions into R&D posts,
comments, and the guestbook (ADR 0005). Read the ADRs in `docs/decisions/` (0001 to 0005) before changing this.

- `index.html` is the home page: a fast overview with sections anchored by id.
- `about/index.html` (About & CV), `rd/index.html` (the R&D blog), and `guestbook/index.html` are subpages.
- Posts are generated into `_site/rd/<number>-<slug>/` from `templates/rd-post.html`; they are never committed.
- The build fingerprints script and stylesheet addresses (`?v=<hash>`) so deploys never mix old and new files. Write plain `js/main.js` or `/styles.css` in source pages; the build adds the fingerprint.
- `tools/render.mjs` holds the pure build helpers (sanitizer, images, markup), tested in `test/render.test.mjs`.
- Every page repeats the home page's header and footer exactly; a test enforces it (ADR 0004). Change the nav or footer in every page at once.
- `styles.css` holds design tokens in `:root` at the top, then components.
- `js/theme.js` applies a saved theme in `<head>`. `js/main.js` runs the canvas wireframes, terminal, and toggles.
- `js/geometry.js` is pure mesh and projection math, unit-tested in `test/geometry.test.mjs`.
- `js/ui.js` runs wayfinding and share and copy. It reads sections from `main section[id]` on any page.
- `assets/fonts/` holds self-hosted `.woff2` files with their OFL licenses. Never link a font CDN.
- `assets/img/` holds images.

Colors come from the Figma "Branding Guide" variables, in Light and Dark modes. Keep the `--brand-*` names in sync with Figma.

Design source of truth: Figma Sites file "Personal Website"
https://www.figma.com/site/uuMSVAiWUYtckwg7fJRxfF/Personal-Website?node-id=0-1

Breakpoints match the Figma frames: mobile below 800px, tablet 800 to 1279px, desktop 1280px and up.
CSS is mobile-first with `min-width` queries at those two widths.

## Commands

```bash
node tools/build.mjs --offline                                # build _site/ without posts
node tools/build.mjs --fixture test/fixtures/discussions.json # build with sample posts and comments
node tools/build.mjs                                          # build with real discussions (uses `gh auth token`)
node --test                                                   # unit tests plus site checks on _site/
py -m http.server 8000 --directory _site                      # preview the build (use `py`, not `python`)
```

## Rules

- No npm packages, CDNs, or external stylesheet, script, or font URLs. No inline scripts.
- JavaScript lives in `js/`, makes no network requests, uses only relative imports, and stays under 10 KB gzipped in total (ADR 0003).
- The page must work without JavaScript. Motion must be pausable and start paused under reduced motion.
- The tests enforce these rules. Do not weaken them to make a change pass.
- Every `<img>` needs `alt`, `width`, and `height`.
- Every in-page `href="#..."` must match an element id.
- Placeholder content is marked with `TODO` so it is easy to find before launch.

## Publishing an R&D post

Start a discussion in the **R&D** category of this repo's GitHub Discussions, from the web or the GitHub app.
Within about a minute the site rebuilds and the post appears at `/rd/<number>-<title>/`, with its comments.
Editing the discussion updates the page; renaming keeps old links working; deleting removes the page.

Moderation: delete a comment to remove it within a minute, or hide it to remove it within the hour.
The guestbook is the pinned discussion in the **Guestbook** category; each comment is a signature.
Only discussions written by `EmilianoManaloIV` in R&D become posts (ADR 0005).
A broken site link inside a post (for example `/no-such-page/`) stops the deploy until fixed; the Actions log names the page.

## Git workflow

- Feature branches: `feature/`, `fix/`, `docs/`, `chore/`.
- Open a PR into `main`. CI runs `node --test` on every PR.
- Pushing to `main` deploys to GitHub Pages. **Only the owner merges into `main`.**
