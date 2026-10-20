# 0013: AI-use disclosure and opinion posts

Status: Accepted (2026-10-19). Builds on 0005 and 0010.

## Context

Much of this site's code was written with Claude, an AI coding assistant, under the owner's direction. The owner's stated values ("Human First": technology should help people create, not replace them) and the "AI-Assisted Development" skill on the site make an honest, specific disclosure part of the message.

The owner also wants the R&D log to hold opinionated posts, rants included, alongside learning notes. Conference contacts and possible employers read it, so opinion posts should be easy to tell apart.

## Decision

**Disclosure:**
- **Footer:** every page's footer, part of the shared chrome (0004), says "Built with AI assistance" and links to `/about/#made`.
- **About section:** "06 / How this site was made" says who did what. The owner designed the site in Figma. Claude wrote most of the code and some interface text under the owner's direction. The owner reviewed every change. The bio, projects, and posts are the owner's own words.
- **Editing:** the text lives in `site-text.md` under `## How this site was made` (0010), so the owner can keep it accurate as things change.

**Opinion posts:**
- **Label:** an R&D discussion labelled `opinion` on GitHub gets an outlined **Opinion** tag in its date line, on the post and on its R&D list card.
- **Matching:** the match is exact and case-insensitive, so `opinions` or `skill: opinion` don't count.
- **Who can set it:** labels can only be set by people with triage access, so visitors can't tag posts. Adding or removing the label rebuilds the site (0006).

## Alternatives

- **A title prefix such as "Opinion:"** needs no code, but changes the post's address and reads louder than a tag.
- **A separate "Opinion" category** would split the R&D log in two and need its own page.

## Consequences

- **Keeping it true:** the disclosure must stay accurate. If the owner writes more of the code, or AI writes some of the prose, the owner updates the section in `site-text.md`.
- **Applying the tag:** a post becomes an opinion post by adding one label, with no code change.
