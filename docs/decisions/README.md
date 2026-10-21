# Architecture decision records

Why the site is built the way it is: one record per decision that is hard to reverse. An ADR is written
with the task spec that needs it and approved by the human before the code.

ADRs 0001 to 0017 were written before this format was adopted (ADR 0018). They stay as written, with
their own section layout; when a later change touches one, it gets an amendment, never a rewrite. New
ADRs copy `TEMPLATE.md`.

## When an ADR is needed
- A new subsystem, or a change to how subsystems talk to each other (the build, the page scripts, the
  content pipeline from Discussions).
- A change to what a page, a template, the shared chrome, or `site-text.md` must contain.
- A new dependency (with its licence and a dependency-free fallback). The site has none by rule (ADR 0001).
- A change to a convention another ADR or `CLAUDE.md` documents.

## Rules
- File name `NNNN-short-slug.md`, four digits, numbered in order, never reused; referred to as "ADR NNNN".
- Copy `TEMPLATE.md`. Keep the sections: Status, Deciders, Related, Context, Alternatives, Decision,
  Rationale, Consequences.
- Amend rather than contradict: a later change adds an "Amendment (date, task)" section to the ADR it
  touches; it never silently does the opposite of what the ADR says.
- "Consequences" lists what gets easier, what gets harder, what existing pages and content see, and a
  "Watch" line for the thing most likely to go wrong.
- Decisions are research-informed: "Context" names the standards, papers, books or tools the decision
  draws on, with years, and says what was tried or considered and why it lost.
