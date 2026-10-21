# ADR 0018: Adopt the engineering methodology kit (Template 0002)

- **Status:** accepted (2026-10-21, task 0001)
- **Deciders:** the user (asked, and chose the history backfill, branch protection, and the plain voice),
  the main session (proposed)
- **Related:** ADR 0001 (zero dependencies), ADR 0005 (the build in CI), task 0001

## Context
The site was built over 22 merged pull requests with feature branches, an independent review before most PRs,
and 17 ADRs, but without written requirements, task specs, a changelog, or required CI checks. The owner
keeps a standard for running projects with Claude Code ("Template 0002", the engineering methodology
kit): specs before code, numbered requirements, one PR per task, a reviewer that is not the author, a
changelog with real numbers, and the human as the only one who merges. The owner asked for it to be
integrated here, with its standard.

The kit is written for a native, multi-platform application: Windows, Linux and macOS builds, sanitizer
builds, stress sections, and a command line that drives every feature. This repository is a
zero-dependency static site (ADR 0001) built by one Node script in GitHub Actions (ADR 0005). Its
"platforms" are the three builds the tests run against: offline, from saved sample Discussions, and live.
The kit itself says to adapt it to the repository rather than impose infrastructure the project doesn't
need. Its sources are the owner's own operating prompts; the practices it draws on (architecture decision
records, Nygard 2011; small reviewed changes; required status checks) are standard.

## Alternatives
- **Copy the kit verbatim, placeholders and all:** fast, but half of it (the platform matrix, sanitizers,
  stress sections, console commands) would describe a project that doesn't exist, and the existing
  `CLAUDE.md` rules that the tests enforce would be lost or duplicated.
- **Leave the process informal:** what worked so far, but without specs and a changelog the reasons for a
  change live only in PR bodies, and nothing stops a red PR from merging.
- **Rewrite ADRs 0001-0017 into the new format:** uniform, but rewriting accepted decisions would blur
  what was decided when, which is the point of an ADR.

## Decision
- **Adopt the kit's method and documents.** `ARCHITECT.md` verbatim; `CLAUDE.md` restructured into the
  kit's sections with every existing project rule kept; the three agents (`implementer`,
  `test-engineer`, `code-reviewer`), the PR template, `CHANGELOG.md`, `docs/requirements.md`,
  `docs/ARCHITECTURE.md`, `docs/USABILITY.md`, and the task and ADR templates.
- **Adapt it to a static site.** The "platforms" are the offline, fixture and live builds; the tracked
  numbers are the test counts, the JS gzipped total and the largest page weight; "reachable from a
  console" becomes "checkable by `node --test`". `docs/MANUAL.md` joins the documentation duties.
- **Keep the existing CI.** `.github/workflows/pages.yml` already tests every PR and deploys only after
  the tests pass; its `test` job becomes a required check on `main` (branch protection, approved by the
  owner). The kit's `build.yml` is not added.
- **Number from here.** Task specs start at task 0001 (this change). The CHANGELOG is back-filled from
  the merged PRs, one round each, with each request marked as reconstructed. ADRs 0001-0017 stay as
  written and are amended, not rewritten.
- **Branches become `task/NNNN-slug`** (`fix/` and `docs/` for those kinds), and commit messages and PR
  titles end with the task and ADR numbers.
- Out: the kit's two-persona voice from the owner's earlier prompt (the owner chose the plain voice); a
  separate `build.yml`; required approving reviews (a solo owner can't approve their own PR).

## Rationale
The kit's value is its method (specs, independent review, recorded numbers, human merges), and that
carries over unchanged; its build matrix is incidental to the projects it was written for. Keeping
`pages.yml` avoids a redundant second workflow, and making its `test` job required closes the one real
gap: today a PR with failing tests could still be merged. Back-filling the CHANGELOG from the PR bodies
uses records that already exist, so it adds history without inventing any.

## Consequences
- Every change now starts as a task spec the owner approves, and ends with a CHANGELOG entry and a
  reviewed PR.
- Small changes cost a little more paperwork; the kit's own rule against fragmenting trivial changes
  still applies.
- Existing pages, content and the deploy are unchanged: this is documentation and configuration only.
- With branch protection on, pull requests into `main` merge only when their `test` check passes. The
  protection is not enforced on administrators, so the owner's routine path of editing `site-text.md` in
  GitHub's web editor and committing straight to `main` (ADR 0010, `docs/MANUAL.md`) keeps working. Such
  an edit skips the PR's `test` run, but the deploy build reads and validates `site-text.md` first and
  leaves the last good site live on a mistake, so it fails safe.
- Watch: documentation drifting from the code. The `code-reviewer` checks the documentation duties on
  every PR; a CHANGELOG entry without real numbers is a finding.
