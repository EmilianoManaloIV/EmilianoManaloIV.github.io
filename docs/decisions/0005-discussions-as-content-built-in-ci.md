# 0005: GitHub Discussions as the content source, built in CI

Status: Accepted (2026-10-18). Amends 0001 (no build step) and 0004 (hand-written posts).

## Context

The owner wants to publish R&D posts without editing HTML, ideally from a phone at the conference. Visitors should be able to comment on posts and sign an old-internet guestbook. The site has no server, so comments and signatures need somewhere to live.

## Decision

GitHub Discussions on this repository holds the content. A zero-dependency Node build (`tools/build.mjs`, with pure helpers in `tools/render.mjs`) runs in GitHub Actions and turns it into static pages before every deploy.

**Content:**
- **Posts:** discussions in the **R&D** category, written by the owner, become pages at `/rd/<number>-<slug>/`.
- **Comments:** comments and one level of replies on a post render under it, with a link to comment on GitHub.
- **Guestbook:** the owner's oldest discussion in the **Guestbook** category is the guestbook. Each comment on it is a signature, shown numbered and oldest first at `/guestbook/`.

**Security:**
- **Who can publish:** a post must be in R&D and authored by the owner. Both categories use GitHub's announcement format, so only maintainers can start discussions there. That's two independent checks.
- **Sanitizing:** post and comment bodies use GitHub's pre-rendered, sanitized HTML, but the build does not rely on that. A small tokenizer keeps only allowlisted tags and attributes, escapes every `<` that doesn't start a complete allowed tag, drops comments, unfinished tags, scripts, frames, styles, event handlers, and `javascript:` or `data:` URLs, and balances open tags so a fragment can't break the page around it. Titles and usernames are escaped.
- **Literal insertion:** template values are filled in one pass and markers are replaced literally, so `{{` or `$&` in anything a visitor writes is plain text and can't break a build.
- **Visitor links:** links in comments and guestbook entries get `rel="nofollow ugc noopener"`.
- **Read-only build:** the token has only `contents: read` and `discussions: read`.

**Privacy:**
- **Images:** images are downloaded at build time into the page's folder, with their width and height. Visitors make no requests to GitHub or anyone else.
  - Only GitHub's image hosts are fetched, over HTTPS, with a 15-second timeout, a 10 MB cap enforced while downloading, and at most 20 images per page. Anything else is dropped with a build warning, so comments can't make the build fetch arbitrary addresses.
- **Avatars:** commenters show by username with an initial badge, so no avatars load.
- **Disclosure:** pages say that commenting and signing use a GitHub account.

**Moderation and freshness:**
- **When it rebuilds:** discussion and comment events (created, edited, deleted) rebuild within about a minute.
- **Hiding:** hiding a comment fires no event, so an hourly scheduled rebuild drops hidden comments. GitHub pauses scheduled workflows after 60 days without repository activity; any post or comment counts as activity, and a manual run restarts it.
- **On failure:** a failed build skips the deploy, so the last good site stays live.

**Stable links:**
- **Short address:** `/rd/<number>/` is a no-JavaScript redirect to the current address.
- **Renamed posts:** the 404 page sends any `/rd/<number>-<old-name>/` to `/rd/<number>/`, so links survive renames.

**Unchanged rules:** the deployed site keeps every rule from 0001 to 0004:
- no dependencies;
- no client-side network calls;
- the JavaScript budget;
- identical header and footer on every page.

The build runs only on GitHub's servers and in local previews. Generated pages are never committed.

## Alternatives

- **Local post-creator script:** no build in CI, but posting needs a laptop, Git, and a pull request.
- **Browser editor page:** produces files that still need a manual upload.
- **Embedded comments (giscus):** a third-party script and iframe on every post, which breaks the no-network rule.
- **Guestbook without accounts (form service or own server):** lower friction for visitors, but adds a third-party service or a backend to secure and maintain.

## Consequences

- **The site depends on GitHub Discussions.** If the API fails, deploys pause until it recovers.
- **Commenting and signing require a GitHub account.**
- **Visible delay:** new posts and comments show after a build, in about a minute. Hidden comments disappear within an hour.
- **Page limits:** discussion and comment lists are paged through. Replies show the first 50 per comment.
- **Local preview:** run `node tools/build.mjs`, with `--offline` or `--fixture` to work without a token.
