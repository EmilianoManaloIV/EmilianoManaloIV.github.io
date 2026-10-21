# Task specs

Each piece of work is a small, clearly specified task: one behaviour, one area of the code, testable
acceptance criteria. The spec is written before the code and approved by the human (ADR 0018).

Numbering started with task 0001 when this process was adopted; the work before it is recorded in
`CHANGELOG.md` and the ADRs, not back-filled as specs.

## Lifecycle

| Status | Meaning | Who moves it on |
|---|---|---|
| draft | Being written in the main session with the human | the human approves |
| approved | Ready to implement | the implementer (or the main session) starts |
| in progress | Being implemented and tested | the implementer, when its report is done |
| in review | The code-reviewer agent is reviewing; then the PR is open | the human, by merging the PR |
| done | Merged to `main` (PR link added) | - |
| dropped | Not doing it (say why) | the human |

## Rules
- File name `NNNN-short-slug.md`, four digits, numbered in order (`0001-...`), never reused. Copy
  `TEMPLATE.md`.
- One task = one PR, on the branch `task/NNNN-slug` (`fix/NNNN-slug` for a bug, `docs/NNNN-slug` for
  documentation only). If a task grows, split it rather than widening the spec.
- Acceptance criteria are checks a test can make ("at 360 px the ID strip ends inside the container and
  the page has no horizontal scroll"), not intentions ("the strip fits better").
- An architectural choice needs an ADR in `docs/decisions/`, approved with the spec.
- Pick the model: the `implementer` and `test-engineer` agents for routine, well-specified work; the main
  session for hard or cross-cutting changes. Reviews always use the `code-reviewer`.
- User bug reports become a task with a reproduction as the first acceptance criterion.
- "After the review" is filled in before the PR is opened: what the reviewer found and what changed.
