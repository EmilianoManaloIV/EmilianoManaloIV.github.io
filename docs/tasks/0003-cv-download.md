# 0003: Download my CV from the About page

- **Status:** done
- **Requirements:** new R-14; Q-02, Q-03
- **Decisions:** none needed (the address was planned in `about/index.html` when the CV section was made)
- **Model:** main session (one asset, one link); tests by the `test-engineer` agent
- **PR:** (link when opened)

## Goal
The owner shared their resume ("This is my Resume") and chose to offer it as a download. Afterwards, the
About & CV page's CV section has a "Download CV (PDF)" link instead of "A downloadable CV is on its way",
and the PDF gives visitors the same email address as the rest of the site.

## Context
Verified before this spec: `about/index.html`'s `05 — CV` section shows an empty state, with a `TODO`
naming the planned file, `assets/cv/emiliano-manalo-cv.pdf`, and the link to put in its place. The build
copies `assets/` as it is (`STATIC` in `tools/build.mjs`), so no build change is needed. The first resume
shared gave `emilianopandaymanaloiv@gmail.com`, unlike the site (`emilianomanaloiv@gmail.com` in
`site-text.md`); the owner chose the site's and re-exported. The final export (SHA-256 `c817b17e…`) is one
page, 151,355 bytes (148 KB), made with LaTeX (pdfTeX); its printed email and its `mailto:` link both read
`emilianomanaloiv@gmail.com`, its metadata has no author name or file paths, and its other links are this
site, GitHub and LinkedIn. The footer's "Save contact" vCard link is the pattern
for a download link (`tag tag-link`, `download`).

## Scope
- In: the corrected PDF at `assets/cv/emiliano-manalo-cv.pdf`; the CV section's link replacing the empty
  state and its `TODO`; tests; documentation, including how the owner replaces the PDF later.
- Out (not in this task): the About page's hand-written skill groups (the other `TODO`, so the
  launch-readiness check stays pending); changing Education or Experience in `site-text.md`; linking the
  CV from the QR card or home page.

## Dependencies
- None: the corrected PDF has been received.

## Deliverables
- The PDF, the link, the tests, the docs, and one PR from `task/0003-cv-download`.

## Likely files
- `assets/cv/emiliano-manalo-cv.pdf` (new), `about/index.html` (the `#cv` section)
- `test/site.test.mjs`

## Acceptance criteria
1. The About page's CV section links `/assets/cv/emiliano-manalo-cv.pdf` with the `download` attribute and
   the text "Download CV (PDF)", and no longer shows the empty state or its `TODO`.
2. The built site holds that file; it starts with `%PDF-`, is one page, and is under 1 MB.
3. Every `mailto:` address in the PDF, read from its compressed streams as well as its plain text (Node's
   built-in `zlib`), is the `Email:` line of `site-text.md`, and the PDF has at least one; a changed
   address or an old export fails the tests instead of going live.
4. No other page changes, and the full suite passes on all three builds with the budgets holding (the PDF
   is fetched only when tapped, so it does not count toward the 200 KB page budget).

## Tests and checks to run
- One test: `node --test --test-name-pattern="CV"`, then the full suite on the offline, fixture and live
  builds.
- Budgets: the JavaScript total and the largest page's weight, unchanged.
- Browser: the About page's CV section at 320 and 1280 px, light and dark; the link downloads the file.

## Risks and edge cases
- The owner will replace the PDF later from GitHub's web upload; the link names no size or date, so
  replacing the file under the same name is the whole update.
- Personal details: the PDF shows the owner's city (Redlands, CA) and email publicly, as the owner's own
  resume does; the site already publishes the email.
- The exports compress their links, and one fixed the email link but not the printed address:
  the test can check links, but not printed text reliably, because LaTeX writes words in kerned pieces.
  The printed address is checked by eye at each update, and the manual says so.
- That export opens with `/OpenAction` (hyperref's initial view); no scripts, launches or embedded files.

## Documentation to update
- `docs/requirements.md` (R-14), `docs/USABILITY.md` (the CV row moves to Fixed; the skills part stays
  Known), `docs/MANUAL.md` ("Update your CV"), `README.md` if the feature list names the About page,
  `CHANGELOG.md` round 25.

## After the review
The `code-reviewer` agent rebuilt all three builds in its own folders and approved, with no must-fix.
What was done about each finding:
- **Should-fix, done: changing the email in `site-text.md` now stops the deploy until a matching CV is
  uploaded,** because the new test ties the two together. The manual's Links tip now says to upload a CV
  with the new address at the same time.
- **Should-fix, done: the manual understated what the build checks.** "Update your CV" now lists every
  check (one page, under 1 MB, no scripts or embedded files, the email link matching), points to the
  Actions tab, says to commit directly to `main`, and leaves only the printed email to the eye.
- **Nit, done:** the PDF reader no longer mistakes `endstream` for the start of a stream.
- **Nit, done:** the active-content guard matched bare names anywhere in compressed bytes, so a harmless
  re-export could fail by chance (estimated 1.6%); it now matches them only where a PDF dictionary uses
  them. The guard goes beyond the acceptance criteria (the spec named it only as a risk); it is kept
  because a PDF the owner uploads from any exporter is served to visitors.
- **Nit, done:** "updates in about a minute" became "within a few minutes", since GitHub Pages caches
  the PDF, which carries no fingerprint.
- **Nit, kept:** the email check reads literal `mailto:` strings, as pdfTeX writes them; hex-encoded links
  from another exporter would be missed only beside a correct one, since a PDF with no readable link fails.
- **Nit, for a separate task:** nothing marks `*.pdf` as binary in `.gitattributes`. This PDF is detected
  as binary and committed byte-identical (checked), but an uncompressed PDF committed locally could get
  CRLF line endings.
