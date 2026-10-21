# Usability

User-facing problems and what fixed them, one row each, newest at the bottom of each section. A row is
written when a task solves a problem a user met or would meet (the `CLAUDE.md` duty). The rows before
task 0001 were back-filled from the pull requests that fixed them (ADR 0018) and cite the PR.

## Fixed

| The problem (as the user met it) | Fixed by (task, ADR) |
|---|---|
| Visitors scan a QR code on slow conference Wi-Fi and wait on heavy pages. | Hand-written pages with no dependencies, self-hosted subset fonts, and no outside requests (PR #1, ADR 0001); later a 200 KB page budget enforced by a test (PR #18, ADR 0012). |
| Motion can't be stopped, which is hard on people sensitive to it. | A Motion toggle that pauses every animation, starting paused under reduced motion (PR #1, ADR 0002); a toggle in every page's footer sharing one remembered state (PR #7, ADR 0004). |
| On phones the 3D shapes stretched on early frames, zoom or rotation, and the banner art was cut off at the canvas edge. | Canvases resync their bitmaps before each draw, and the banner shapes are fitted inside the canvas (PR #3). |
| On a phone the name was pushed below the first screen, and long pages gave no sense of place. | A compact two-column nav, a sticky section bar, and a dot rail on wide screens (PR #3, ADR 0003). |
| Right after a deploy, the R&D page's model stood still and its Motion button did nothing. | Browsers mixed a new page with a cached old script; fingerprinted script and stylesheet addresses (PR #8, ADR 0005). |
| A renamed post or project broke every link shared to it. | `/rd/<number>/` and `/projects/<number>/` redirects to the current title (PR #5, PR #9, ADR 0005, 0006). |
| GIFs in posts were heavy and couldn't be paused. | Short video clips, muted and played only while motion is on; HEVC phone recordings refused with a clear warning (PR #14, ADR 0007). |
| On big screens the page left 40% of the screen empty, and Contact sat 90 px left of everything else. | A scaled-up layout and full-width banner at 1600 px and up; the margin label made zero-width so it no longer narrowed Contact's grid (PR #15, ADR 0009). |
| Editing the bio or a link meant editing HTML in several pages. | One file, `site-text.md`, editable from a phone, that fails the build with a plain message on a mistake (PR #16, ADR 0010). |
| The orange link buttons' cream text was 2.43:1, too faint for many people; printed pages came out cream on white. | Dark text on the buttons (6.17:1), darker skill tags, and a black-on-white print stylesheet, all tested from the tokens (PR #18, ADR 0012). |
| A friend found the nav jumping from 02 Projects to 04 Contact, with 03 R&D only reachable from the top. | The nav links whole pages only (Home, About, R&D, Guestbook), numbered without gaps (PR #21, ADR 0015). |
| The end of the home page felt disjointed: Contact's teapot sat stacked right above the footer's torus. | Contact moved into the shared footer with the teapot as the one model ending every page (PR #21, ADR 0015). |
| The teapot at the end of each page was small. | A wider footer column on tablets and up, about 1.6 times larger (PR #22, ADR 0016). |
| The banner's terrain looked small next to Figma's. | The terrain drawn at 40% of the banner's width, since the banner is taller than Figma's (PR #20, ADR 0014). |
| On phones of 360 px and narrower, the values band's ID strip was cut off at the right. | The strip's cells share a phone's width and keep Figma's widths only from 1280 px (PR #23, ADR 0017). |
| The home page showed a grey "portrait" placeholder. | The owner's photo, cropped to the frame and compressed to 112 KB (PR #26). |
| Every new project made the home page one card longer, and there was no single page listing them all. | A Projects page with every project under a hands-on tesseract; the home page previews the two newest and links to it; Projects in the nav (task 0002, ADR 0019). |

## Known

| The problem | Why it is still there |
|---|---|
| The About & CV page has no downloadable CV and only the skills from projects. | Two `TODO` notes in `about/index.html` wait for the CV PDF and any hand-written skill groups; the launch-readiness test stays pending until they are resolved. |
| Shared links show no preview image, and an iPhone home-screen icon falls back to a screenshot. | `assets/img/share.png` and `apple-touch-icon.png` are not exported from Figma yet; the build adds them automatically when they exist (ADR 0011). |
| The Copy and Share buttons are verified only through their failure path. | The automated browser can't grant clipboard access; a check on a real phone is the remaining test. |
| The R&D page is empty. | No R&D post has been published yet. |
