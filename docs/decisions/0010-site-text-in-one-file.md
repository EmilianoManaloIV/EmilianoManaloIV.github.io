# 0010: Site text in one file

Status: Accepted (2026-10-18).

## Context

Before the conference, the owner needs to replace about 54 placeholders, such as the bio, values, education, experience, email, and social links, and to keep editing them later from a phone, without asking for code changes. The text lived in hand-written HTML across several pages, and the social links were repeated in every page's header and footer.

## Decision

All of that copy lives in **`site-text.md`** at the repository root: labelled `## Heading` sections, edited on GitHub with the pencil button. The build (ADR 0005) fills the pages from it.

**Format:**
- **Sections:** each section's text belongs to the owner. `*italic*`, `**bold**` and `[links](https://…)` work, and blank lines separate paragraphs.
- **Entries:** Education and Experience take `### When | Title` entries, each with a sentence or two.
- **Links:** a `## Links` block holds `Email:`, `LinkedIn:`, `Instagram:`, `X:` and `GitHub:`.
- **Guidance:** HTML comments in the file are notes for the editor and are ignored.

**Markup:**
- **Text:** source pages mark editable spots with `data-text="key"` and keep readable fallback text, so they still work unbuilt.
- **Links:** links use `data-link="name"`. `data-link-text` also replaces the visible text with the address.
- **Email:** the email reaches the mailto link, the copy button, and the `.vcf` contact card. The card's GitHub and LinkedIn URLs follow the file too, and keep its CRLF line endings.
- **Blank links:** a blank social link removes its list item from every page's header, footer, and contact list.
- **Cleanup:** the build removes every marker from the published pages.

**Safety:**
- **Fail fast:** `readSiteText` checks the whole file before anything is built. Every mistake fails the build with a message saying what to fix:
  - a missing, duplicated, empty, or misspelled heading;
  - `###` lines outside Education and Experience;
  - extra paragraphs in a one-paragraph section;
  - an unknown or repeated link name;
  - a bad email;
  - a non-`https` link.
  The last good site stays live, but every rebuild waits on the file, including new posts and comments, so the README asks for a quick fix.
- **Escaping:** text is escaped first, then the small formatting subset is applied, then the owner sanitizer from 0005 runs. Links are found before emphasis, so stars inside an address stay literal. `*` only marks emphasis when it hugs the words, so `2 * 3` stays as typed. Typed `<script>`, `{{` or `$&` shows as plain text, in text and in links alike, because addresses are inserted with function replacers.
- **Typos in markup:** an unknown `data-text` key in a page fails the build.

**Tests:** the unit tests cover parsing, failures, escaping, filling, and the card. The site tests check that markers are gone, that the email agrees everywhere, and that every page key exists. The header and footer test now compares built pages with the built home page, and templates with the source home page, because the build fills links.

## Alternatives

- **A pinned "Site text" discussion:** consistent with posts, but easier to break the format by accident, and it would mix site settings with public conversation.
- **A guide to editing the HTML directly:** no build change, but the same link would have to be edited in a dozen places, and a stray `<` could break a page.

## Consequences

- **One file to edit:** the owner changes `site-text.md` and the site updates within about a minute.
- **New editable text:** making more text editable means adding a section to `SITE_TEXT` in `tools/render.mjs`, a `data-text` attribute in the page, and the section in the file.
- **No visible change yet:** the first version of the file holds the exact text the pages had, TODOs included, so this change alone alters nothing on the site except adding the LinkedIn address to the contact card.
