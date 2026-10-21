# 0001: Adopt the engineering methodology kit

- **Status:** in review
- **Requirements:** all (this task introduces `docs/requirements.md`)
- **Decisions:** ADR 0018
- **Model:** main session
- **PR:** #27

## Goal
The owner asked: "Integrate this template into this project along with its standardard." Afterwards, every
change to the site follows the kit's method (spec, approval, implementation, independent tests and
review, recorded checks, one PR per task, the human merges), with documents and agents adapted to this
static site.

## Context
Verified in the repository before this spec: a project-specific `CLAUDE.md`; ADRs 0001-0017 in an older
format; one `code-reviewer` agent (on Sonnet, with a stale 10 KB JavaScript budget); the `Test and
deploy` workflow, whose `test` job runs on every PR; `README.md` and `docs/MANUAL.md`; no CHANGELOG,
requirements, task specs, ARCHITECTURE or USABILITY documents, PR template, or branch protection.
The owner chose: back-fill the CHANGELOG and requirements from the merged PRs and ADRs; turn on branch
protection requiring `test`; the plain architect voice, without personas.

## Scope
- In: `ARCHITECT.md`; `CLAUDE.md` restructured; `.claude/agents/` (implementer, test-engineer,
  code-reviewer); `.github/pull_request_template.md`; `CHANGELOG.md`; `docs/requirements.md`,
  `docs/ARCHITECTURE.md`, `docs/USABILITY.md`; `docs/decisions/README.md`, `TEMPLATE.md`, ADR 0018;
  `docs/tasks/README.md`, `TEMPLATE.md`, this spec; a "How it's run" paragraph in `README.md`; branch
  protection on `main`.
- Out (not in this task): any change to pages, scripts, styles, the build or the tests; rewriting ADRs
  0001-0017; a new CI workflow; specs for past work.

## Dependencies
- None. Branch protection is applied after this PR's `test` check passes.

## Deliverables
- The files above, one PR from `task/0001-engineering-standards`, and `main` protected.

## Likely files
- `CLAUDE.md`, `ARCHITECT.md`, `CHANGELOG.md`, `README.md`
- `.claude/agents/*.md`, `.github/pull_request_template.md`
- `docs/requirements.md`, `docs/ARCHITECTURE.md`, `docs/USABILITY.md`, `docs/decisions/*`, `docs/tasks/*`

## Acceptance criteria
1. `CLAUDE.md` has every section of the kit's `CLAUDE.md` (Role and mission, Communication, Approval
   boundaries, Simplicity and surgical changes, Project map, Build and run, Testing rules, Code
   standards, Labelling, Documentation duties, Workflow and approval gates, Agents models and
   parallelism, Git and publishing, Security, Definition of done, Pitfalls), with no placeholders left,
   and every rule from the previous `CLAUDE.md` still present.
2. The three agents have valid frontmatter (name, description, model, tools) and name this repository's
   test files, builds and boundaries; the reviewer's JavaScript budget is 32 KB.
3. `docs/requirements.md` numbers every requirement (`R-nn`, `Q-nn`) and each cites its ADR.
4. `CHANGELOG.md` has one entry per merged PR (#1 to #26), newest first, and an entry for this task.
5. Every relative link and anchor in the new and changed Markdown files resolves.
6. `node --test` passes on the offline, fixture and live builds, with the same counts as before.
7. `gh api .../branches/main/protection` shows `test` as a required check, PRs required, force pushes
   and deletions off.

## Tests and checks to run
- The full suite on all three builds; a link-check script over the Markdown files; reading back each
  agent's frontmatter; the protection API.

## Risks and edge cases
- Losing a project rule in the `CLAUDE.md` restructure: checked line by line against the old file.
- Inventing history in the back-filled CHANGELOG: requests are marked as reconstructed, and numbers come
  only from the PR bodies.
- Branch protection blocking the owner: approving reviews are not required, and administrators can
  override.

## Documentation to update
- All of the above is documentation. CHANGELOG round 23.

## After the review
The `code-reviewer` found the method intact and every acceptance criterion met (7 pending, as planned),
and asked for these changes, all made:
- `docs/USABILITY.md` claimed the owner's site text was still `TODO`; the owner had filled it on `main`.
  The row now names the two real placeholders (the CV PDF, hand-written skill groups).
- Branch protection would have collided with the owner's routine `site-text.md` edits from GitHub's web
  editor. Protection is not enforced on administrators, and ADR 0018 and `docs/MANUAL.md` now describe
  that path and why it fails safe.
- The CHANGELOG's camera-scan claim is now attributed to the owner's own report; its dates are the owner's
  local (Pacific) dates, and its header says the quoted requests are verbatim from the working sessions.
- ADR 0018 said 26 pull requests; 22 merged. The README's span is three days, October 18 to 20.
- `docs/ARCHITECTURE.md` cited Perlin's gradient noise for what is value noise; it now cites value noise,
  and no longer credits the build-free pages with what a test enforces.
- The agents no longer ask for browser checks they can't run; the implementer's Git permission is
  read-only; ADRs are the main session's; the reviewer regained its simplicity check and its rule against
  defects without evidence.
- `CLAUDE.md` regained two owner-workflow details the manual kept (posting from the GitHub app; exporting
  HEVC as H.264).
