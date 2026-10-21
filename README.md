# emilianomanaloiv.github.io

My personal website, built for conference use: **https://emilianomanaloiv.github.io**

Most visitors arrive on a phone, by scanning the QR code on my badge, often on slow conference Wi-Fi. So the site had to load fast, work without JavaScript, stay accessible, and let me post R&D notes and projects from my phone between talks. Along the way it became a small showcase of the things I like building: real-time 3D graphics, careful interfaces, and systems with no moving parts I don't understand.

> Running the site day to day (posting, projects, the guestbook, moderation, the QR card) is in the **[owner's manual](docs/MANUAL.md)**.

## How I made it

I designed the site in **Figma** first, as a Figma Site called "Personal Website". Its colours are the "Branding Guide" variables, in light and dark modes, and the site's CSS tokens keep the same names.

I built it with **Claude Code**, Anthropic's AI coding assistant, working from my direction. Claude wrote most of the code and some of the interface text. I set the direction and the architecture, chose between the options it laid out, reviewed every change, and merged every pull request myself. My bio, projects, and R&D posts are my own words. The same note is on the site, at the bottom of the About page.

The process stayed deliberate the whole way:

- **One feature branch and pull request per change,** 22 merged over three days (October 18–20, 2026).
- **An independent review before nearly every PR.** A separate AI reviewer checked each substantial change, and its findings were fixed before I merged.
- **Tests on every PR in CI,** and a deploy only when they pass.
- **A decision record for every meaningful choice,** 18 so far, in [`docs/decisions/`](docs/decisions/).

## Tech stack

- **Hand-written HTML, CSS, and JavaScript,** with **zero dependencies**: no npm packages, frameworks, CDNs, or outside fonts. The JavaScript is first-party, about 19 KB gzipped, and makes no network requests.
- **A small Node build** ([`tools/build.mjs`](tools/build.mjs)), itself dependency-free, that runs in **GitHub Actions**.
- **GitHub Discussions as the content system.**
  - R&D posts, projects, and comments are discussions.
  - Project skills are labels.
  - The guestbook is one pinned discussion, and each comment is a signature.
  - I can publish from the GitHub mobile app.
- **GitHub Pages** for hosting, rebuilt within about a minute of any post, comment, or label change, and hourly otherwise.
- **Self-hosted fonts:** Inter, Space Grotesk, and IBM Plex Mono.

```
GitHub Discussions ─┐
site-text.md ───────┼─► GitHub Actions: node tools/build.mjs ─► node --test ─► _site/ ─► GitHub Pages
HTML · CSS · JS ────┘
```

Before anything is built from Discussions, CI runs the tests on an offline build and a sample build. Pull requests stop there; only `main` deploys.

## What I built

- **A small 3D wireframe engine on `<canvas>`** ([`js/geometry.js`](js/geometry.js)): meshes, rotation, and perspective projection in plain JavaScript, unit-tested.
  - **The banner art, matched to my Figma design:**
    - an oblate spheroid with a cylinder bored through it;
    - jagged, drifting terrain from hashed value noise that repeats without a seam.
  - **The Utah teapot,** drawn from its original Bézier patches (Martin Newell, 1975).
  - **A VR headset** built in code.
  - **A geodesic sphere** that drifts in the margins of big screens.
  - **Hands-on models:** the teapot and the headset can be dragged or turned with the arrow keys, and each has a Reset button.
- **A live console** in the banner that types real telemetry from the shapes on screen, a headline that decodes from glyphs, and a device readout of the visitor's own browser.
- **A content pipeline from Discussions:**
  - **Pages:** discussions become pages, with comments.
  - **Sanitizer:** a hardened HTML allowlist sanitizer handles anything a visitor writes.
  - **Media:** images and short video clips are copied onto the site (iPhone HEVC clips are detected and refused).
  - **Projects:** they get skills, cards, and their own pages.
  - **Renames:** a renamed post keeps its old links working.
- **A QR code generator written from scratch** ([`tools/qr.mjs`](tools/qr.mjs)), with Reed–Solomon error correction and masking. It draws the code for my conference card.
  - The card's page prints as a badge insert.
  - Visitors can save my contact as a vCard.
  - The build also writes the sitemap and `robots.txt`, and fills the vCard from `site-text.md`.
- **All my text in one file,** [`site-text.md`](site-text.md), editable on GitHub from a phone. The build validates it and fails with a plain-language message if something's wrong, leaving the last good site live.
- **Accessibility and resilience, enforced by tests:**
  - WCAG AA contrast, computed from the design tokens in both themes;
  - all motion pausable, and paused by default under reduced motion;
  - every page works without JavaScript;
  - a black-on-white print stylesheet;
  - cache-busting fingerprints, so deploys never mix old and new files;
  - each page under 200 KB gzipped.

## On the site

- **3D models:** turn the teapot at the bottom of every page, or the VR headset on the R&D page, by dragging or with the arrow keys. **Reset view** or the Home key puts it back.
- **Wayfinding:** a thin bar across the top fills as you scroll. On a phone, a bar names the home-page section you're in. On big screens, faint margin labels name the subpage section you're reading.
- **Settings:** the **Motion** button stops every animation, and **Dark mode** switches themes. The site remembers both choices.
- **Guestbook:** visitors can sign it with a GitHub account, old-internet style.
- **[QR card](https://emilianomanaloiv.github.io/card/):** the page I hold up at conferences.

## Repository layout

| Path | What's there |
|---|---|
| `index.html`, `about/`, `rd/`, `guestbook/`, `card/`, `404.html` | The pages, hand-written |
| `templates/` | The R&D post and project page templates the build fills |
| `styles.css` | Design tokens first, then components; mobile-first at 800, 1280, and 1600 px |
| `js/` | `main.js` (canvas scenes, console, motion), `geometry.js` (3D math), `models.js` (teapot data), `ui.js` (wayfinding, share, copy), `theme.js` |
| `tools/` | `build.mjs`, `render.mjs` (sanitizer and markup helpers), `qr.mjs` |
| `test/` | Unit tests, plus checks run on the built site |
| `site-text.md` | All page copy and links |
| `docs/` | The [owner's manual](docs/MANUAL.md), the [requirements](docs/requirements.md), [architecture](docs/ARCHITECTURE.md), [usability log](docs/USABILITY.md), [decision records](docs/decisions/) and [task specs](docs/tasks/) |
| `CHANGELOG.md`, `CLAUDE.md`, `ARCHITECT.md` | The [changelog](CHANGELOG.md), one entry per round of work; the engineering standards; the full architect prompt they condense |

## Run it locally

You need Node (24, as CI uses). Python is used only to serve the preview.

```bash
node tools/build.mjs --offline                                # build _site/ without posts
node tools/build.mjs --fixture test/fixtures/discussions.json # build with sample posts and comments
node --test                                                   # about 160 tests: unit tests plus checks on _site/
py -m http.server 8000 --directory _site                      # preview at http://localhost:8000
```

`py` is the Windows Python launcher; on macOS or Linux, use `python3 -m http.server 8000 --directory _site`. `node tools/build.mjs` with no flag builds from the real Discussions, using `gh auth token`.

## Design decisions

| | |
|---|---|
| [0001](docs/decisions/0001-zero-dependency-static-site.md) | Zero-dependency static site |
| [0002](docs/decisions/0002-first-party-javascript-for-motion.md) | First-party JavaScript for motion |
| [0003](docs/decisions/0003-interactive-ui-elements.md) | Interactive UI elements for conference visitors |
| [0004](docs/decisions/0004-multi-page-without-a-build-step.md) | Multiple pages without a build step |
| [0005](docs/decisions/0005-discussions-as-content-built-in-ci.md) | GitHub Discussions as the content source, built in CI |
| [0006](docs/decisions/0006-projects-and-skills-from-discussions.md) | Projects and skills from Discussions |
| [0007](docs/decisions/0007-video-clips-instead-of-gifs.md) | Video clips instead of GIFs |
| [0008](docs/decisions/0008-ambient-motion-and-scroll-reveals.md) | Ambient background motion and scroll reveals |
| [0009](docs/decisions/0009-interactive-models-and-usability-driven-graphics.md) | Interactive models and usability-driven graphics |
| [0010](docs/decisions/0010-site-text-in-one-file.md) | Site text in one file |
| [0011](docs/decisions/0011-conference-kit.md) | Conference kit: QR card, link previews, home-screen icon, sitemap |
| [0012](docs/decisions/0012-pre-launch-audit.md) | Pre-launch audit: contrast, print, and page weight |
| [0013](docs/decisions/0013-ai-disclosure-and-opinion-posts.md) | AI-use disclosure and opinion posts |
| [0014](docs/decisions/0014-banner-art-matched-to-figma.md) | Banner art matched to Figma |
| [0015](docs/decisions/0015-pages-only-nav-and-contact-in-the-footer.md) | Pages-only nav, and contact in the footer |
| [0016](docs/decisions/0016-data-columns-and-a-decoding-barcode-row.md) | Background data columns, a decoding barcode row, and a bigger teapot |
| [0017](docs/decisions/0017-figma-details-and-fewer-background-layers.md) | Figma details, and fewer background layers |
| [0018](docs/decisions/0018-engineering-methodology-kit.md) | Adopt the engineering methodology kit |

## How it's run

Since October 21, 2026 the project follows my engineering methodology kit (ADR 0018). Every change starts as a numbered task spec in [`docs/tasks/`](docs/tasks/) that I approve before any code is written, citing the [requirements](docs/requirements.md) it serves. Claude implements it on a `task/NNNN-slug` branch; separate test and review agents check it independently; the full suite runs on the offline, sample and live builds; and the round is recorded in the [changelog](CHANGELOG.md) with its numbers. `main` is protected, so a pull request can only merge when its `test` check passes, and only I merge.

The working rules (stack, commands, tests, conventions, and the workflow) are in [`CLAUDE.md`](CLAUDE.md), which condenses [`ARCHITECT.md`](ARCHITECT.md).

## Credits

- **Fonts:** Inter, Space Grotesk, and IBM Plex Mono, self-hosted under the SIL Open Font License (`assets/fonts/`).
- **Utah teapot:** Martin Newell's 1975 model, from its public Bézier patch data.
- **Social icons:** drawn after [Tabler Icons](https://tabler.io/icons) (MIT License, © Paweł Kuna).
