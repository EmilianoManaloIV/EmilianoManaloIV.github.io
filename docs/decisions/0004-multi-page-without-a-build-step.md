# 0004: Multiple pages without a build step

Status: Accepted (2026-10-18). Amends 0001, which assumed a single page. Amended by 0005: R&D posts are now built from GitHub Discussions, not written by hand.

## Context

The home page is a fast overview for conference visitors. The owner wants depth on separate pages:
- **About & CV:** background, education, experience, skills, and the CV.
- **R&D:** a blog of things learned and research, each entry open for discussion.

The Talk and Research sections were removed from the home page, and research writing moves into R&D.

ADR 0001 rejected a build step for a single page, noting that shared markup would be duplicated if pages were added.

## Decision

Add pages as plain HTML files with clean folder URLs: `/about/`, `/rd/`, and `/rd/<slug>/`. There is still no build step and no generator.

- **Shared chrome:** every page repeats the home page's header and footer verbatim.
  - Nav links are root-absolute (`/#about`, `/rd/`), so the same markup works everywhere.
  - Each subpage marks its own nav item with `aria-current="page"`.
- **Drift protection:** `test/site.test.mjs` fails if any page's header or footer differs from `index.html`, ignoring `aria-current`. This replaces a templating tool.
- **Posts:** each post is a copy of `templates/rd-post.html`. The template is not deployed. Tests require every post to be listed on the R&D index, dated with `<time datetime>`, and linked to its own GitHub Discussions thread.
- **Discussion:** happens on GitHub Discussions, through a plain link. No comment widget, script, or tracking is added, so ADR 0002's no-network rule holds.
- **Scripts:** the same three scripts load on every page. `main.js` and `ui.js` skip anything their page doesn't have.
- **Motion:** every page carries a motion toggle in the shared footer, and the home banner has a second one; all share one state (WCAG 2.2.2). The visitor's choice is remembered across pages and visits in `localStorage`. Without a saved choice, reduced-motion visitors start paused. Before 2026-10-19 only the home page animated, because it was the only page with a toggle.

## Alternatives

- **Zero-dependency Node script that stamps partials into pages:** removes duplication, but adds a build step for about four pages.
- **Static site generator (Eleventy, Hugo):** adds dependencies, ruled out by 0001.
- **Embedded comments (giscus):** a third-party script and iframe, which breaks the no-network rule.

## Consequences

- **Header and footer changes:** a nav or footer change must be made in every page. The test points to any page that was missed.
- **Publishing a post:** copy the template, fill it in, and add a card to `rd/index.html`. That's three manual steps, checked by tests.
- **When to revisit:** past about 10 pages or posts, a small zero-dependency Node script that generates pages from partials becomes worth it, and would get its own ADR.
- **Discussions:** must be turned on in the repository settings before the first post.
