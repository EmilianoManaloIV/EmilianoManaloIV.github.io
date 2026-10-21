# 0002: A Projects page with a hands-on 4D cube

- **Status:** done
- **Requirements:** R-03, R-08, R-11, new R-13; Q-02, Q-03, Q-04, Q-05, Q-09, Q-10, Q-11
- **Decisions:** ADR 0019 (amends ADR 0006, 0009, 0015)
- **Model:** main session (cross-cutting: geometry, page, build, nav on every page); tests by the
  `test-engineer` agent
- **PR:** [#28](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/pull/28)

## Goal
The owner asked: "I want to add a project page to my website while retaining the style that is currently
established. Just like the research had a VR-headset, my project page should have a 4D cube."
Afterwards, `/projects/` lists every project under a heading with a hands-on tesseract, in the R&D page's
style; the home page previews the two newest projects and links to it; and Projects is in the nav.

## Context
Verified before this spec: projects are rendered only into the home page's `<!-- PROJECTS -->` by
`projectCard()` (`tools/render.mjs`) in `tools/build.mjs`; each project has a generated page at
`/projects/<number>-<slug>/` and a `/projects/<number>/` redirect. The R&D page pairs its heading with the
hands-on VR headset (`headset()`, `fitScale()` in `js/geometry.js`; the `headset` painter in `js/main.js`).
The nav links pages only (ADR 0015). The owner's recent edits on `main` (button padding in `styles.css`,
content in `site-text.md`) are kept. The owner chose: the home section previews the 2 newest projects
plus an "All projects" link; Projects joins the nav as 02.

## Scope
- In: `tesseract()`, `rotate4()`, `project4()`, `tesseractRadius()` in `js/geometry.js`; the `tesseract`
  painter, mesh and pose in `js/main.js`; `projects/index.html`; the `projects` entry in the build's
  `STATIC`; the build filling the Projects page with every card and the home page with the newest two plus
  a link; a `## Projects intro` section in `site-text.md` and its `SITE_TEXT` entry; the nav (5 items) on
  every page and both templates; the project template's and 404's links to `/projects/`; styles for the
  tesseract frame; tests and documentation.
- Out (not in this task): changing project cards' design, project pages' layout, the About page's skills
  list, or anything the owner wrote in `site-text.md`.

## Dependencies
- None.

## Deliverables
- The code and tests above, ADR 0019, documentation updates, one PR from `task/0002-projects-page`.

## Likely files
- `js/geometry.js`, `js/main.js`, `styles.css`, `projects/index.html`, `index.html`, every page's header,
  `templates/project.html`, `templates/rd-post.html`, `404.html`, `tools/build.mjs`, `tools/render.mjs`,
  `site-text.md`
- `test/geometry.test.mjs`, `test/site.test.mjs`, `test/fixtures/discussions.json`

## Acceptance criteria
1. `tesseract()` has 16 vertices and 32 edges; every vertex has 4 neighbours; every edge is 2 long in 4D.
2. `rotate4()` preserves a point's length; after `project4()`, no sampled rotation's 3D radius exceeds
   `tesseractRadius(d)`, and the worst sampled case comes within 1% of it.
3. Drawn with `fitScale(tesseractRadius(d))`, the projected cube stays inside its frame at every sampled 4D
   and 3D angle.
4. `/projects/` exists, repeats the shared header and footer, has a hands-on tesseract (focusable,
   labelled, with a hint and Reset view) beside its heading, and lists every generated project page.
5. The nav reads 00 Home, 01 About, 02 Projects, 03 R&D, 04 Guestbook (`/`, `/about/`, `/projects/`,
   `/rd/`, `/guestbook/`) on every page; `/projects/` and every project page mark Projects as current.
6. With 3 projects (the fixture build), the home page shows the 2 newest cards and links to `/projects/`;
   with none (the offline build), the home page shows its empty state and no link.
7. No page links to `/#projects` except the home page's own section rail.
8. The Projects page's intro text comes from `## Projects intro` in `site-text.md`.
9. The full suite passes on all three builds; JavaScript stays under 32 KB gzipped and every page under
   200 KB.

## Tests and checks to run
- One test: `node --test --test-name-pattern="tesseract"`, then the full suite on all three builds.
- Budgets: the JavaScript gzipped total and the largest page's weight.
- Browser: 320, 375, 800, 1280 and 1600 px, light and dark, motion on and off; drag, arrow keys, Reset and
  the Home key on the tesseract; the home preview; the 5-item nav on phones.

## Risks and edge cases
- The 4D turn and the 3D drag together must never clip the frame (criterion 3).
- Motion off and reduced motion must freeze the 4D turn; without JavaScript the figure hides.
- A fifth nav item on a 320 px phone (the two-column nav grid).
- Zero projects, one project, and projects without images.

## Documentation to update
- ADR 0019; `docs/requirements.md` (R-13, R-08, R-11); `docs/ARCHITECTURE.md`; `docs/USABILITY.md`;
  `docs/MANUAL.md`; `README.md`; `CLAUDE.md`; `CHANGELOG.md` round 24.

## After the review
The `code-reviewer` agent built and tested all three builds and measured the layout in headless Chrome.
Verdict: changes needed. What was done about each finding:
- **Must-fix, done: the five-item nav broke the tablet header.** From 800 to about 940 px every nav label
  wrapped its number above its name, the theme toggle broke onto two lines, and the header's social icons
  shrank below their 24 px target (17 px at 800). An iPad in portrait (820 or 834 px) would have seen it.
  The header now wraps its tools to a second row there and nav labels never break; measured at 320, 375,
  800 to 940, 1000, 1100, 1279, 1280 and 1600 px in light and dark, with no wrapped label or toggle, every
  icon at least 24 px and no overflow. A regression test reads the rule. ADR 0019's Consequences and
  ADR 0015's amendment say so.
- **Must-fix, done: ADRs 0006, 0009 and 0015 were contradicted without an amendment.** Each now ends with
  an "Amendment (2026-10-21, task 0002)" pointing to ADR 0019.
- **Should-fix, done:** the README's layout table now lists `projects/` and its test count reads "about
  200"; `CLAUDE.md` names ADRs 0001 to 0019 and its edited lines are rewrapped.
- **Should-fix, done:** the temporary preview entry in `.claude/launch.json` is reverted, not committed.
- **Nit, done:** the console's "TESS" label was removed; the console exists only on the home page, where
  the tesseract never is.
- **Nit, kept:** a project card is FIG. 02.1 or 02.2 on the home page but one higher on `/projects/`,
  where the tesseract is FIG. 02.1. Intended, and pinned by a test.
- **Nit, kept for a separate task:** project pages (like posts) mark their section with
  `aria-current="page"`; `"location"` would be more precise for both.
