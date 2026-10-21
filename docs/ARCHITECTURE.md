# Architecture

How the site is built: one row per subsystem or function others build on. Add a row when a change
introduces one (the `CLAUDE.md` duty); cite the task and the ADR in the first column. Rows written when
the process was adopted (ADR 0018) cite the ADRs only, since tasks start at task 0001.

## Overview
The site is hand-written HTML, CSS and first-party JavaScript with no dependencies (ADR 0001). The source
pages in the repository are complete on their own and open in a browser without a build; a test keeps
their shared header and footer identical (ADR 0004).

Content flows in from two places. The owner's words live in `site-text.md` (ADR 0010); posts, projects,
comments and the guestbook live in this repository's GitHub Discussions (ADR 0005, 0006). On every push to
`main`, every discussion event, and once an hour, GitHub Actions runs `tools/build.mjs`: it copies the
pages, fills the site text, reads the discussions through the GraphQL API, sanitizes everything visitors
wrote, copies images and clips onto the site, renders posts and projects from `templates/`, draws the QR
code, writes the sitemap, and fingerprints script and stylesheet addresses. The result is `_site/`.

The tests hook in after the build: `node --test` runs the unit tests of the pure modules and then checks
the built `_site/` itself (allowlisted markup, anchors, budgets, contrast from the tokens, the motion
rules, the shared chrome). Pull requests run them on an offline build and on a build from saved sample
discussions; `main` also runs them on the live build, and only a passing build is deployed to GitHub
Pages, so a failed build leaves the last good site live.

In the browser, `theme.js` applies the saved theme before first paint; `main.js` runs every canvas scene,
the banner console and the clips under one motion gate; `ui.js` runs wayfinding, sharing and copying. All
three are optional: without JavaScript the pages read the same, minus motion.

## Subsystems and shared functions

| What (file, task, ADR) | How it works | References |
|---|---|---|
| The build (`tools/build.mjs`) (ADR 0005, 0006, 0010, 0011) | Reads `site-text.md` first, so a mistake fails before anything else; copies the static pages; fetches discussions with the workflow's token (or a saved fixture, or none offline); renders posts, projects, the guestbook and redirect pages for renamed posts; writes `_site/`. It never writes to GitHub. | GitHub GraphQL API (Discussions) |
| The sanitizer (`sanitize()` in `tools/render.mjs`) (ADR 0005) | A small tokenizer that rebuilds visitor HTML from an allowlist of tags and attributes, drops everything else, shifts heading levels under the page's own, and marks visitor links `nofollow ugc noopener`. | OWASP XSS Prevention Cheat Sheet (allowlisting over denylisting) |
| Media localisation (`localizeImages()`, `localizeVideos()`, `clipInfo()`) (ADR 0005, 0007) | Keeps images and clips only from GitHub's own attachment hosts, copies them onto the site with their sizes read from the file headers, and refuses clips whose codec browsers can't all play (HEVC). | ISO BMFF (MP4) and WebM container formats |
| Site text (`readSiteText()`, `applySiteText()`) (ADR 0010) | Parses `site-text.md` by `##` headings, validates every field with plain-language errors, and fills `data-text` and `data-link` markers in every page. A blank social link removes its list item. | - |
| Fingerprinting (`versionUrls()`, `versionImports()`) (ADR 0005) | Appends a content hash to every script and stylesheet address and to module imports, so a deploy never mixes old and new files. | - |
| The QR code (`qrMatrix()`, `qrSvg()` in `tools/qr.mjs`) (ADR 0011) | Byte-mode encoding, Reed–Solomon error correction over GF(256), all eight masks scored by the standard's penalty rules, drawn as one SVG path. | ISO/IEC 18004:2015; Reed and Solomon (1960) |
| 3D geometry (`js/geometry.js`) (ADR 0002, 0009, 0014) | Pure functions: meshes (lathe, cube, sphere, icosphere, grid, the pierced spheroid, the VR headset), bicubic Bézier-patch tessellation, rotation, orientation and perspective projection, and `fitScale()`, which keeps a turning model inside its frame. | Newell's Utah teapot (1975); Bézier surfaces (Pierre Bézier, Renault UNISURF) |
| The terrain (`terrainHeight()`) (ADR 0014) | Hashed value noise in several octaves plus a few broad hills, faded at the edges, wrapping along the drift axis so the drift loops without a seam. | Value (lattice) noise with linear blending, as in Ebert et al., *Texturing and Modeling: A Procedural Approach* (3rd ed., 2003) |
| Canvas scenes and the motion gate (`js/main.js`) (ADR 0002, 0007, 0008, 0009) | Every canvas, clip, timer and the banner console runs only while motion is on, the tab is visible, and its element is on screen (`schedule()`); hands-on models turn by drag or keys and reset. | WCAG 2.2, 2.2.2 Pause, Stop, Hide |
| The banner console (`main.js`) (ADR 0002, 0014) | Types telemetry computed from the shapes on screen (poses, vertex counts, frame timing), sized to fill its box. | - |
| Wayfinding, share and copy (`js/ui.js`) (ADR 0003, 0015) | Marks the current home-page section in the side rail and phone bar; copy and share buttons report in the status line beside them. | - |
| Theme (`js/theme.js`) (ADR 0003) | Applies the saved light or dark theme in `<head>`, before first paint, so the page never flashes the wrong colours. | - |
| Design tokens (`styles.css` `:root`) (ADR 0012) | The Figma "Branding Guide" colours in light and dark; the tests compute WCAG contrast for each pairing from these tokens. | WCAG 2.2, 1.4.3 and 1.4.11 |
