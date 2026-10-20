# 0015: Pages-only nav, and contact in the footer

Status: Accepted (2026-10-19). Changes the nav from 0003 and 0004, and the footer model from 0009.

## Context

A friend who tried the site gave two pieces of feedback on the home page:

- **Numbering:** the nav went 01 About, 02 Projects, 03 R&D, 04 Contact. Scrolling the home page showed 01, 02, then 04, because 03 (R&D) is a separate page reachable only from the top.
- **Page end:** the end felt disjointed. Contact's Utah teapot sat right above the footer's torus, two hands-on models stacked with a large gap.

The owner decided that:
- the top nav should link only to full pages;
- the contact details should join the footer;
- the teapot, not the torus, should end the page.

## Decision

**Nav (every page, kept identical by the 0004 test):**
- **Items:** `00 Home → /`, `01 About → /about/`, `02 R&D → /rd/`, `03 Guestbook → /guestbook/`.
- **Current page:** each page marks its own item with `aria-current="page"`, and the home page marks Home. R&D posts mark R&D. Project pages, the 404, and the QR card mark nothing.
- **In-page wayfinding** moves off the nav entirely.
  - **Rail:** the home page's side rail keeps one dot per section (Home, About, Projects).
  - **Phone bar:** it names the current section from its rail dot's label ("Projects"), with no number. Numbers now mean pages, so section numbers would collide with them.
  - **Subpages** (About & CV, R&D, Guestbook, projects) keep their own numbered section headings ("01 / Story"). They count within the page, as on a drawing sheet, and the home page has none since 0014. Renumbering them is left for later, if the overlap with the nav's numbers confuses visitors.

**Contact in the footer (every page):**
- **Content:** email with Copy, LinkedIn, GitHub, Save contact (`/emiliano-manalo.vcf`), and Share this page. They sit first in the footer, under a visually hidden "Contact" heading, in a block with `id="contact"`. So older `/#contact` links still land on it, on any page.
- **Removed from the home page:** its Contact section and rail dot. The guestbook is linked from the nav and the footer, so the contact list drops it.
- **Copy and share** (`js/ui.js`) bind every such button, and report in the status line nearest the button. The QR card keeps its own buttons and status line, so its footer hides the duplicate contact block.
- **Site text:** the build already fills the site-text links on every page (0010), so the footer's email and profile links come from `site-text.md` like before.

**The teapot ends every page:**
- **Footer:** the footer's torus is replaced by the hands-on Utah teapot, captioned "Utah teapot, Newell 1975", with no section number, since the footer is shared. The torus mesh, its painter, its console line, and `torus()` are removed, and the console's SCENE line reports the teapot instead.
- **404:** it loses its separate heading teapot, so no page has two teapots that would turn together when one is dragged.
- **Layout:** on tablets and up, contact sits above the brand on the left, with the teapot beside both. On phones they stack: contact, brand, teapot.

## Alternatives

- **An "03 R&D" teaser section on the home page** would have fixed the numbering. But it would keep the nav a mix of sections and pages, which was the owner's objection.
- **Renumbering the nav while keeping section links** would still mix anchors and pages.
- **Keeping Contact as a home section without the teapot** would leave contact details on the home page only. Visitors on a post or the About page would have to go back to reach them.

## Consequences

- **Every page ends with the contact details,** which suits conference visitors who land on a post from a shared link.
- **Projects have no nav item.** They stay on the home page, which the Home item reaches, and the 404's "ways back" still link `/#projects`.
- **Changing the nav or footer** still means editing every page and both templates at once. The test names any page that was missed.
