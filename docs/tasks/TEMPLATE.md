# NNNN: <short title>

- **Status:** draft
- **Requirements:** R-xx, Q-xx
- **Decisions:** ADR NNNN (or "none needed")
- **Model:** implementer | main session
- **PR:** (link when opened; "#NN (stacked on #NN)" when it stacks)

## Goal
What the user should be able to do afterwards, in one or two sentences. For a bug: what happens now, and
what should happen. Quote the user's words when there are any.

## Context
<What exists today that this builds on or changes; what was verified in the repository before writing
this spec (facts), and what is assumed (hypotheses, each disclosed).>

## Scope
- In: <the functions, components, commands and docs this task adds or changes>
- Out (not in this task): <what it deliberately leaves alone, and why>

## Dependencies
- <other tasks, approvals or interface contracts this waits on; "none" when independent>

## Deliverables
- <the code, tests, docs and PR this task ends with>

## Likely files
- `index.html`, `js/...`, `styles.css`, `tools/...` (function or selector names when known)
- `test/site.test.mjs` or `test/render.test.mjs`, `test/geometry.test.mjs`, `test/qr.test.mjs`

## Acceptance criteria
1. <a check a test can make, with numbers>
2. ...
3. The full suite passes on all three builds, and the budgets hold.

## Tests and checks to run
- One test: `node --test --test-name-pattern="part of the test's name"`, then the full suite on all three builds
  (offline, fixture, live).
- Budgets: the JS gzipped total and the largest page's weight must stay under their limits (Q-02, Q-03).
- Browser: the widths the change can affect (320, 375, 800, 1280, 1600 px), light and dark, motion off.

## Risks and edge cases
- <empty or hostile Discussions content, no JavaScript, reduced motion, dark theme, print, 320 px, slow networks, ...>

## Documentation to update
- CHANGELOG entry, README count, ARCHITECTURE row, USABILITY row, ADR (as applicable), and
  `docs/MANUAL.md` when an owner workflow changes.

## After the review
- (what the reviewer found and what changed; filled before the PR is opened)
