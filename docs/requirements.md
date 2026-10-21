# Requirements

What the site must do, numbered so a task spec can cite them (`R-01`) and a review can check them.
Functional requirements are `R-nn`; qualities are `Q-nn`. Never renumber; retire a requirement by marking
it so. These were back-filled from `CLAUDE.md` and ADRs 0001 to 0017 when the process was adopted
(ADR 0018); each cites the decision it comes from.

## Functional
- **R-01** A visitor who scans the conference QR code on a phone lands on the home page and sees who the
  owner is, the banner, the About card, the projects, the values and the contact details, without
  waiting on anything but the page itself (ADR 0001, 0003, 0011).
- **R-02** The owner publishes an R&D post by starting a discussion in the **R&D** category from the web or
  the GitHub app; within about a minute it appears at `/rd/<number>-<title>/` with its comments, newest
  first on the R&D page. Editing updates it, renaming keeps old links working, deleting removes it
  (ADR 0005).
- **R-03** The owner adds a project the same way, in **Projects**: a card on the Projects page (and on the home
  page while it is one of the two newest), a page at `/projects/<number>-<title>/`, an optional link
  button, and skills from `skill:` labels listed with counts on the About page (ADR 0006, 0019).
- **R-04** Posts and projects can carry short video clips that play muted and looped only while motion is
  on; HEVC recordings are refused with a build warning; comments never show video (ADR 0007).
- **R-05** Visitors sign a guestbook (one pinned discussion, one comment per signature) with their GitHub
  account; the owner moderates by deleting or hiding comments (ADR 0005).
- **R-06** The owner edits every piece of page copy and every link in one file, `site-text.md`, from a
  phone; a mistake fails the build with a plain message and leaves the last good site live (ADR 0010).
- **R-07** The owner has a conference card at `/card/`: a QR code drawn by the build, a printable badge
  insert, a vCard, and link previews and a home-screen icon when their images exist (ADR 0011).
- **R-08** Visitors can turn the hands-on 3D models (the Utah teapot on every page, the VR headset on the
  R&D page, the tesseract on the Projects page) by dragging or with the arrow keys, and put them back with
  Reset or the Home key (ADR 0009, 0015, 0019).
- **R-09** The home banner shows the art designed in Figma: the pierced spheroid, the drifting terrain, the
  console, the headline, and the instrument labels (ADR 0014, 0016, 0017).
- **R-10** Every page discloses that the site was built with AI assistance and links to how; R&D posts
  labelled `opinion` show an Opinion tag (ADR 0013).
- **R-11** The top nav links whole pages (Home, About, Projects, R&D, Guestbook); every page ends with the
  contact details and the teapot (ADR 0015, 0019).
- **R-12** Visitors can copy the owner's email, share the page, save the contact, follow the social
  links, see where they are on the page, switch the theme, and pause all motion; the site remembers the
  theme and motion choices (ADR 0003, 0008, 0017).
- **R-13** Visitors find every project on one page, `/projects/`, newest first, under a heading with a
  hands-on tesseract; the home page previews the two newest and links to it (ADR 0019).

## Qualities
- **Q-01** Zero dependencies: no npm packages, frameworks, CDNs, or external stylesheet, script or font
  URLs; no inline scripts; fonts self-hosted (ADR 0001).
- **Q-02** JavaScript is first-party, makes no network requests, uses only relative imports, and stays
  under 32 KB gzipped in total (ADR 0002, 0003, 0009).
- **Q-03** Each page stays under 200 KB gzipped (ADR 0012).
- **Q-04** Every page works without JavaScript (ADR 0001, 0003).
- **Q-05** All motion is pausable from every page and starts paused under reduced motion; looping CSS
  animation runs only while motion is on (ADR 0008).
- **Q-06** Colours pass WCAG AA in both themes, and print is black on white (ADR 0012).
- **Q-07** Visitor content is sanitized against an allowlist, links from visitors are marked nofollow, and
  media is kept only from GitHub's own hosts (ADR 0005).
- **Q-08** Deploys never mix old and new files (fingerprinted addresses), and a failed build leaves the
  last good site live (ADR 0005).
- **Q-09** Layouts work from 320 px phones to 1920 px screens, mobile-first at 800, 1280 and 1600 px,
  with no horizontal scrolling (ADR 0009).
- **Q-10** Keyboard and screen-reader users can reach and name every control; decorative content is
  hidden from screen readers (ADR 0003, 0009).
- **Q-11** Every page repeats the shared header and footer exactly (ADR 0004).

## Out of scope (for now)
- Trackers and analytics: the disclosure promises none (ADR 0013).
- Frameworks, bundlers and package managers: ADR 0001.
- Server-side code or a database: the site is static, built in CI (ADR 0005).
- Visitor video, and commenting without a GitHub account (ADR 0005, 0007).
- A boot or intro screen: several were previewed in October 2026 and turned down by the owner; an intro
  delays visitors on slow Wi-Fi.
