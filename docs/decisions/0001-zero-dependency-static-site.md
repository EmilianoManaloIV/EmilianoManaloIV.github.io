# 0001: Zero-dependency static site

Status: Accepted (2026-10-18)

## Context

The site must be live within a week for a conference. Visitors arrive on phones, often over poor Wi-Fi.
The owner asked to minimize dependencies. The design is a single page in Figma Sites with three breakpoints.

## Decision

Build the site as hand-written HTML and CSS with no packages, no build step, and no JavaScript.
Self-host fonts. Host on GitHub Pages from the `EmilianoManaloIV.github.io` repository, deployed by GitHub Actions.
Validate with Node's built-in test runner, which needs no installed packages.

## Alternatives

- **Publish directly from Figma Sites.** Fastest, but ships Figma's runtime JavaScript and ties hosting to Figma.
- **Static site generator (Eleventy, Astro, Hugo).** Adds templating, which only pays off with many pages.
- **Small Node build script for shared partials.** Same output with a build step. Not needed for one page.

## Consequences

- Nothing to install or update, and nothing that can break from upstream changes.
- Shared markup (nav, footer) is duplicated if more pages are added. Revisit this decision at that point.
- Interactive features need a new ADR before any JavaScript is added.
