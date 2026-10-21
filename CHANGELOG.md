# Changelog

One entry per round of requests, newest first: what was asked, what changed, and how it was checked.
Rounds 1 to 22 were back-filled from the merged pull requests when this changelog was adopted (ADR 0018).
Dates are the owner's local merge dates (Pacific time). Quoted requests are the owner's words from the
working sessions, verbatim, typos included; where they weren't kept, **Asked** is reconstructed from the
pull request and marked so. The numbers under **Checked** are the ones each pull request reported.

## 2026-10-21 (round 24): A Projects page with a hands-on 4D cube (task 0002, ADR 0019)

**Asked:** "I want to add a project page to my website while retaining the style that is currently
established. Just like the research had a VR-headset, my project page should have a 4D cube." Then: "Make
sure to pull the current repository on GitHub since I included change manually and the appropriate mark
down file for adding my own own information remotely."

**Added**
- **`/projects/`,** in the R&D page's layout: the heading, an intro from a new `## Projects intro` section
  at the end of `site-text.md` (the owner's own words above it untouched), and every project card, newest
  first (R-13).
- **A hands-on tesseract** beside the heading: the 16 corners and 32 edges of a 4D cube, turned in the
  xw, yw and zw planes and projected to 3D, then drawn like the headset. Drag, the arrow keys, Home and
  Reset work as on the other models; the 4D turn runs only while motion is on. Its largest projected
  radius, `2d / √(d² − 4)`, is computed in closed form, so `fitScale()` keeps it inside its frame at any
  angle (`tesseract()`, `rotate4()`, `project4()`, `tesseractRadius()` in `js/geometry.js`).

**Changed**
- **The home page previews the two newest projects** and links to the rest with "All projects"; with no
  projects it keeps its empty state and no link (amends ADR 0006).
- **Projects joins the nav as 02:** 00 Home, 01 About, 02 Projects, 03 R&D, 04 Guestbook, on every page
  and both templates; project pages mark Projects as current (amends ADR 0015).
- Project pages' breadcrumb and "Back to all projects", and the 404's way back, go to `/projects/`.
- ADRs 0006, 0009 and 0015 carry amendments pointing to ADR 0019; requirements R-03, R-08 and R-11
  amended, R-13 added; ARCHITECTURE, USABILITY, MANUAL, README and `CLAUDE.md` updated.

**Changed after the review**
- **The tablet header no longer squeezes:** with five nav items, from 800 to about 940 px each label
  broke its number from its name, the theme toggle wrapped, and the social icons shrank to 17 px, under
  their 24 px target. The tools now wrap to a second row there; measured in headless Chrome from 320 to
  1600 px in both themes with no broken label and every icon at least 24 px.
- Amendments added to the three ADRs this changes; the README's layout table and test count, and
  `CLAUDE.md`'s ADR range, corrected; the console's unused "TESS" label removed (task 0002, "After the
  review").

**Checked**
- New tests: the tesseract's corners, edges and degree; `rotate4` keeping lengths; the sampled worst
  radius within 1% of the bound; the cube inside its frame at every sampled 4D and 3D angle together; the
  Projects page, its hands-on model and its list; the five-item nav and its marks; the home preview of
  two with its link, and none offline; no `/#projects` links left; the intro from `site-text.md`; the
  tablet header's wrapping. The sample data gained a third project.
- Unit and site checks: offline build 175 tests (173 pass, 1 skipped, 1 todo); fixture build 200 (199
  pass, 1 todo); live build 185 (183 pass, 1 skipped, 1 todo). The skip is the sample-data-only projects
  check; the todo is the launch-readiness check for `TODO` placeholders.
- JavaScript 19,898 bytes gzipped (budget 32 KB); the largest page about 141 KB gzipped (budget 200 KB),
  the Projects page about 140 KB.
- Browser (headless Chrome; the in-app browser was unavailable): the Projects page at 320, 375, 800, 1280
  and 1600 px in light and dark, the model beside the heading from 800 px, no horizontal scroll; the cube
  turning with motion on and frozen with motion off and under reduced motion; arrow keys, Home and Reset;
  the home preview; no console errors.

## 2026-10-21 (round 23): Adopt the engineering methodology kit (task 0001, ADR 0018)

**Asked:** "Integrate this template into this project along with its standardard."

**Added**
- **The kit's documents, adapted to this site:** `ARCHITECT.md`; `CHANGELOG.md` (this file, back-filled
  from PRs #1 to #26); `docs/requirements.md` (R-01 to R-12, Q-01 to Q-11, each citing its ADR);
  `docs/ARCHITECTURE.md`; `docs/USABILITY.md`; the task and ADR templates and READMEs; and the PR template.
  Every change now starts as an approved task spec and ends with a reviewed PR and an entry here (task 0001).
- **Two agents:** `implementer` and `test-engineer`, on Sonnet, with this repository's test files, three
  builds and boundaries.

**Changed**
- **`CLAUDE.md`** restructured into the kit's sections (role, communication, approval boundaries,
  simplicity, project map, build, testing, code standards, labelling, documentation duties, gates, agents,
  Git, security, done, pitfalls), with every earlier rule kept. Branches are now `task/NNNN-slug`.
- **`code-reviewer`** rewritten from the kit, on Opus, with this site's correctness risks; its JavaScript
  budget corrected from 10 KB to 32 KB.
- **`main` is protected:** pull requests need the `test` check to pass. The owner, as administrator, can
  still commit `site-text.md` edits straight from GitHub's editor, which the build validates (ADR 0018).
- The kit's multi-platform `build.yml` was not added: the existing workflow already tests every PR (ADR 0018).

**Changed after the review**
- A stale USABILITY row about `TODO` site text corrected; the owner's web-editor path for `site-text.md`
  kept working under branch protection and documented; the camera-scan claim attributed; local dates;
  the PR count; the terrain's noise reference; agent instructions that needed a browser; the reviewer's
  simplicity check restored (task 0001, "After the review").

**Checked**
- Unit and site checks: offline build 156 tests (155 pass, 1 todo); fixture build 176 (175 pass, 1 todo);
  live build 166 (165 pass, 1 todo), unchanged, since this round changes no code. The todo is the
  launch-readiness check for `TODO` placeholders.
- JavaScript 19,013 bytes gzipped (budget 32 KB); every page under the 200 KB budget (the site test).
- Every relative link and anchor in the new and changed Markdown files resolves; `CLAUDE.md` has all 16 of
  the kit's sections; the three agents' frontmatter is complete.

## 2026-10-20 (round 22): The owner's portrait (PR #26)

**Asked:** "Here is my portrait, what do you think?", then "Yeah, do the crop. No alt text will be necessary."

**Added**
- **Portrait:** the owner's photo replaces the grey placeholder on the home page's About card and the
  About & CV page, cropped to the frame's 5:4 shape, 1088 x 864, 112 KB, with no camera or location data.
  `alt=""` by the owner's choice; lazy-loaded on the home page, eager on the About page, where it is near
  the top.

**Changed after the review**
- Compressed harder (161 KB to 112 KB) for conference Wi-Fi; the About page's copy loads eagerly.

**Checked**
- Offline 155, fixture 175, live 165 passing, 1 todo each. Browser at 1280 and 375 px: no overflow, no
  console errors.

## 2026-10-20 (round 21): A README about the project; the owner's guide moves to a manual (PR #25)

**Asked:** "Change ReadMe to be more about how this project was created, the tech stack, and any relevant
information regarding what I built; instead of noting all the things you can do with it. You can probably
just turn that into a manual/documentation that is separated from the ReadMe."

**Added**
- **`docs/MANUAL.md`:** the owner's how-to sections, moved word for word apart from link paths, with a
  contents list that gained the missing "The AI-use note" entry.

**Changed**
- **`README.md`:** the project's story in the owner's voice: how it was made, the stack, what was built,
  the layout, local commands, the decision records, and credits.

**Changed after the review**
- A fact-check corrected two claims: the web manifest is not generated, and the review ran before nearly
  every PR, not every one.

**Checked**
- Offline 155 passing, 1 todo. Every relative link and anchor resolves; the manual's text matches the old
  README's exactly.

## 2026-10-20 (round 20): Figma's icons, ID strip and labels; the background echoes removed (PR #23)

**Asked:** "No more bootstrap, I just want to remove the console in the background. A lot of elements from
the figma elements I designed should be implemented appropriately." Then: "Re-Add lines separating each
category, but nothing more."

**Added**
- **Social icons:** outline Instagram, LinkedIn, X and GitHub icons in the header and footer, as in Figma,
  instead of "IG in X GH" (ADR 0017).
- **The ID strip** in the values band as Figma's joined row of cells, and the banner's System Core, Batch
  and Serial labels as one mint grid.
- **Section lines:** a plain rule above About, Projects and Contact, without the old headings.

**Changed**
- The faint console echoes and the data columns are removed; the banner console stays.

**Fixed**
- The ID strip no longer overflows phones of 360 px and narrower.

**Changed after the review**
- The strip's phone layout fixed and re-measured at 320, 360 and 375 px; the SVG attributes in the markup
  allowlist test scoped to the SVG tags only; an orphaned rule removed; 9 px labels raised to 10 px.

**Checked**
- Offline 155, fixture 175, live 165 passing, 1 todo each. Browser at 320, 360, 375, 800, 1280 and 1920
  px, both themes: no horizontal overflow on any page, no console errors.

## 2026-10-20 (round 19): Faint data columns, a decoding ID row, a bigger teapot (PR #22)

**Asked:** "Make the Utah teapot bigger, make the "ERC ID 023132 etc." more dynamic and visually
interesting. Add faded vertical consoles in the background as well in the 3D object area; doesn't have to
be related to the current console. Just feels like there should be things visually in there."

**Added**
- **Data columns:** faint, motion-gated columns of made-up readouts behind the banner art and the footer
  teapot (removed again in round 20).
- **Decoding ID row:** the values band's ERC / ID / Batch text decodes from glyphs as it arrives (ADR 0016).

**Changed**
- The footer teapot about 1.6 times larger on tablets and up.

**Changed after the review**
- The larger teapot cap limited to tablets and up; each column kind given its own pace; tests check the
  column kinds against the script and the stacking rules.

**Checked**
- Offline 155, fixture 175, live 165 passing, 1 todo each; JavaScript about 19 KB gzipped.

## 2026-10-20 (round 18): A pages-only nav; contact and the teapot end every page (PR #21)

**Asked:** a friend's feedback, passed on by the owner: "The part at the bottom of orojects feels
disjointed as well as projects being 02 and then jumping to 04 whie habing to click and a link at the top
to get to 03".

**Changed**
- **Nav:** links whole pages only, 00 Home, 01 About, 02 R&D, 03 Guestbook (ADR 0015).
- **Footer:** the contact details move into every page's footer, and the Utah teapot replaces the torus as
  the one model ending every page; the 404 loses its second teapot.

**Changed after the review**
- The card page's duplicate footer contact hidden; a teapot-based fit test; phone spacing.

**Checked**
- Offline 153, fixture 173, live 163 passing, 1 todo each.

## 2026-10-20 (round 17): Banner art matched to Figma; the home headings removed (PR #20)

**Asked:** "Make the objects in my figma design exactly the same for the hero page. Especially the plane
that should be jagged and "terrain like" rather than a tear drop wave. Furthermore, I want that object that
is a spheroid by have a cylinder slice through it. Also, the "01 / About" text and each consequence text of
separation can be removed. Show me the preview of the design."

**Added**
- **The pierced spheroid** and **jagged, drifting terrain**, placed at Figma's positions across the whole
  desktop banner (ADR 0014).

**Changed**
- The home page's "01 / About"-style headings and margin notes removed; screen readers keep hidden headings.

**Changed after the review**
- The Contact teapot's grid row fixed; the layout mode read on resize instead of every frame. The terrain
  later enlarged at the owner's request.

**Checked**
- Offline 153, fixture 173, live 163 passing, 1 todo each. Browser at 375, 800, 1280 and 1920 px.

## 2026-10-19 (round 16): An AI-use disclosure and an Opinion tag (PR #19)

**Asked:** "Yes! I would really appreciate a disclosure note and a small opinion tag! Thank you so much!"

**Added**
- **Disclosure:** "Built with AI assistance · How this site was made" in every footer, linking to a new
  About section whose text lives in `site-text.md` (ADR 0013).
- **Opinion tag:** an R&D discussion labelled `opinion` shows an outlined Opinion tag.

**Changed after the review**
- A test that would have blocked the live deploy fixed; a visible separator before the tag.

**Checked**
- Offline 150, fixture 170, live 160 passing.

## 2026-10-18 (round 15): Pre-launch audit (PR #18)

**Asked:** "Go ahead with the pre-launch audit."

**Fixed**
- **Contrast:** orange link buttons from 2.43:1 to 6.17:1 with dark text; skill tags to 4.73:1; tag
  counts, the current-page underline and dark-mode rail dots (ADR 0012).
- **Print:** a site-wide black-on-white print stylesheet.

**Added**
- Tests for contrast from the tokens in both themes, print, and a 200 KB page budget.

**Changed after the review**
- Skill tags no longer print cream on white; a print test that passed for the wrong reason fixed.

**Checked**
- Offline 147, fixture 167 passing. Pages about 136 KB with every font.

## 2026-10-18 (round 14): The conference kit (PR #17)

**Asked:** "Go ahead with the conference kit (QR card and launch polish)."

**Added**
- **`/card/`:** a QR code from a dependency-free encoder (`tools/qr.mjs`), a printable badge, Save contact
  and Share; "Show my QR card" in every footer (ADR 0011).
- Link-preview and home-screen-icon tags when their images exist; the web manifest; a generated sitemap
  and `robots.txt`.

**Changed after the review**
- An independent decoder confirmed the codes decode exactly.

**Checked**
- Offline 144, fixture 164 passing. The PR left the camera scan to the owner, who reported in the session
  that the code opened the site before merging.

## 2026-10-18 (round 13): Site text in one file (PR #16)

**Asked:** (reconstructed from PR #16) let the owner edit the bio, values, education, experience, email
and links without touching HTML.

**Added**
- **`site-text.md`:** every piece of page copy and every link, filled into the pages by the build, with
  plain-language errors that leave the last good site live (ADR 0010).

**Changed after the review**
- Valid `&` links, `$` in addresses, duplicate or misspelled headings, stray paragraphs, `*` inside
  links, and mixed line endings in the contact card all handled, with tests.

**Checked**
- Offline 127, fixture 147 passing; the built site byte-for-byte identical apart from the contact card.

## 2026-10-18 (round 12): The Utah teapot, hands-on models, big screens (PR #15)

**Asked:** (reconstructed from PR #15) usability-driven graphics, the Utah teapot, and a larger JavaScript
budget.

**Added**
- **Hands-on models:** the Utah teapot and the footer torus turn by drag or arrow keys, with a hint and
  Reset view; a VR headset on the R&D heading (ADR 0009).
- **A reading-progress bar**, section markers, a friendly 404, and hover and focus feedback.
- **Big screens (1600 px and up):** a scaled-up layout, a full-width banner, margin labels and a faint
  ambient sphere.

**Changed**
- The JavaScript budget raised from 10 KB to 32 KB gzipped.

**Fixed**
- Contact sat 90 px left on big screens; the headset could spill past its frame.

**Changed after the review**
- Drag direction, focus contrast, right-click and two-finger drags, browser shortcuts, the screen-reader
  label, captions without JavaScript, and section rules in high-contrast mode and print.

**Checked**
- Offline 116, fixture 136 passing; about 16.8 KB of JavaScript.

## 2026-10-18 (round 11): Video clips (PR #14)

**Asked:** (reconstructed from PR #14) short clips in posts and projects instead of GIFs.

**Added**
- **Clips:** `.mp4` (H.264) and `.webm` dragged into a discussion become muted, looped, motion-gated video,
  read and checked by a zero-dependency container parser; HEVC is refused with a warning (ADR 0007).

**Changed after the review**
- The clip parser returns nothing instead of throwing on hostile input.

**Checked**
- Offline 105 tests (104 pass, 1 todo), fixture 125 (124 pass, 1 todo).

## 2026-10-18 (round 10): Ambient motion and scroll reveals (PR #13)

**Asked:** (reconstructed from PR #13) a visual pass in the branding guide's style.

**Added**
- A drifting page grid, a scanning dot field, a bigger console, console echoes, and scroll reveals, all
  under the motion rules (ADR 0008).

**Changed after the review**
- Reveal timings that could leave a heading clipped on tall screens.

**Checked**
- Offline 101, fixture 121 passing.

## 2026-10-18 (round 9): The owner's README (PR #12)

**Asked:** (reconstructed from PR #12) a guide to running the site from Discussions.

**Added**
- `README.md` as the owner's day-to-day guide (later moved to `docs/MANUAL.md` in round 21).

**Checked**
- Every claim checked against the code; offline build passing.

## 2026-10-18 (round 8): Projects from Discussions (PR #9)

**Asked:** (reconstructed from PR #9) publish projects the same way as posts, with skills.

**Added**
- **Projects:** discussions in **Projects** become cards and pages; `skill:` labels fill the About page's
  "From my projects" list with counts (ADR 0006).

**Changed after the review**
- `Link:` parsing that could swallow body text; empty states that relied only on `:has()`.

**Checked**
- Offline 97, fixture 117 passing.

## 2026-10-18 (round 7): Cache-busting (PR #8)

**Asked:** (reconstructed from PR #8) the R&D model and Motion button appeared broken right after a deploy.

**Fixed**
- Browsers mixed new pages with cached old scripts; the build now fingerprints every script and stylesheet
  address (ADR 0005).

**Checked**
- Offline 88, fixture 98 passing.

## 2026-10-18 (round 6): A motion toggle on every page (PR #7)

**Asked:** (reconstructed from PR #7) make the footer torus turn on every page.

**Added**
- A Motion toggle in every page's footer, sharing one remembered state with the banner's (ADR 0004).

**Checked**
- Offline 85, fixture 95 passing.

## 2026-10-18 (round 5): R&D posts, comments and a guestbook from Discussions (PR #5)

**Asked:** (reconstructed from PR #5) publish R&D posts from GitHub Discussions, with comments and a
guestbook.

**Added**
- **The build:** a zero-dependency Node build in GitHub Actions turns Discussions into posts, comments and
  a guestbook, with an allowlist sanitizer and images copied onto the site (ADR 0005).

**Changed after the review**
- Two independent security reviews; their fixes harden the sanitizer against structure breakouts.

**Checked**
- 25 render unit tests; offline 85, fixture 95 site checks.

## 2026-10-18 (round 4): About & CV and the R&D blog (PR #4)

**Asked:** (reconstructed from PR #4) move depth onto separate pages; remove Talk and Research.

**Added**
- `/about/` and `/rd/`, with the shared header and footer kept identical by a test (ADR 0004).

**Changed**
- Talk and Research removed from the home page.

**Checked**
- 50 passing, 1 todo.

## 2026-10-18 (round 3): Mobile fixes, wayfinding, share and copy (PR #3)

**Asked:** (reconstructed from PR #3) fix the mobile artifacts, then add interaction aids.

**Added**
- Wayfinding (a dot rail and a phone section bar), share and copy (ADR 0003).

**Fixed**
- Stretched canvases on phones, and banner shapes cut off at the canvas edge.

**Checked**
- 37 passing, 1 todo.

## 2026-10-18 (round 2): Banner v2 (PR #2)

**Asked:** (reconstructed from PR #2) make the banner match Figma more closely and feel alive.

**Added**
- A full-height console typing telemetry from the shapes, the headline decode, the visitor's device
  readout, the cube behind "Bridging", and the globe (ADR 0002).

**Checked**
- 30 passing, 1 todo.

## 2026-10-18 (round 1): The site, version 1 (PR #1)

**Asked:** (reconstructed from PR #1) a personal website for the conference, from the Figma design.

**Added**
- The home page from the Figma Sites design at three breakpoints, Figma's colours in light and dark,
  canvas wireframes, a dark-mode toggle, a Motion toggle, self-hosted fonts, a vCard, and GitHub Actions
  testing and deploying to Pages (ADR 0001, 0002).

**Checked**
- 26 passing, 1 todo.
