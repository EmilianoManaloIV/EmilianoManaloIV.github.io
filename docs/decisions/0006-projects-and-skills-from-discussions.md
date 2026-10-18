# 0006: Projects and skills from Discussions

Status: Accepted (2026-10-18). Builds on 0005.

## Context

R&D posts publish from GitHub Discussions (0005). Projects were still typed by hand into the home page, and the About page's "From my projects" skills were a hand-kept copy of those projects' tags. The owner wants to add a project the same way as a post, and wants each project's skills to appear on the About page without editing it.

## Decision

Projects use the same pipeline as posts, with three conventions.

**Content:**
- **Projects:** discussions in the **Projects** category, written by the owner, become pages at `/projects/<number>-<slug>/` with their comments. The category uses the announcement format, so visitors can't start one; the author check is the second guard.
- **Cards:** the home page's Projects section is generated, newest first. Each card shows the title (linking to the page), the first paragraph, the link button, the skills, and the first image, in the existing alternating card layout. With no projects, an empty-state line shows. The build removes empty states itself rather than relying only on CSS `:has()`, so older browsers show the same thing.
- **Skills:** only labels named `skill: <name>` count, shown without the prefix. GitHub's default labels (`bug`, `enhancement`, and so on) are ignored. Only people with triage access can label a discussion, so visitors can't add skills.
- **About page:** the "From my projects" list is the union of every project's skills, sorted by how many projects use each, with a count and a tooltip naming the projects.
- **Link button:** a first line of the form `Link: https://…`, with nothing else on it, becomes the orange "<Title> link" button and is removed from the text. Only `https` links count. Without that line, there is no button.

**Rebuilds:** adding or removing a label fires the `labeled` and `unlabeled` discussion events, so skills update within about a minute.

**Stable links:** `/projects/<number>/` redirects to the current address, and the 404 page sends a renamed project's old address there, as for posts.

**Security and privacy:** unchanged from 0005. Project bodies use the owner's sanitizer rules, comments use the visitor rules, labels and titles are escaped, and images are downloaded at build time.

## Alternatives

- **Skills in the body (a `Skills:` line):** no labels needed, but the text would be easy to mistype and harder to reuse across projects.
- **Every label is a skill:** simpler, but the default labels would leak onto the About page.
- **Cards only, no project pages:** less to build, but no place for a longer write-up or comments.

## Consequences

- **Existing projects move:** Blendity and UNOverse must be recreated as discussions. Until then, the home page shows the empty-state line.
- **Hand-written skills:** other skill groups on the About page stay hand-written. Only "From my projects" is generated.
- **Order:** projects are always newest first. Pinning or manual order would be a later change.
