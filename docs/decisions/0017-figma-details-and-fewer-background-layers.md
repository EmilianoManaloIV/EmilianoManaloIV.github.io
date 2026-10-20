# 0017: Figma details, and fewer background layers

Status: Accepted (2026-10-20). Removes the console echoes from 0008 and 0009, and the data columns from 0016. Builds on 0014 and 0015.

## Context

The owner wanted the background console text gone and more of the Figma design ("Personal Website") carried into the site. I compared the Figma Site preview at 1280 px with the site and listed the gaps. The owner chose what to remove and what to adopt:

- **Remove:**
  - the faint console echoes beside the name, above the values, and behind subpage headings (0008, 0009);
  - the data columns behind the banner art and the footer teapot (0016).
- **Keep:** the banner console. Figma has a console there too.
- **Adopt from Figma:**
  - the social icons;
  - the values band's ID strip;
  - the banner's "Technicals labels".
- **Not adopted for now:** Figma's pink artwork for projects without an image.

## Decision

**Removed:**
- **Markup:** the `.terminal-echo` and `.data-columns` blocks on every page and template.
- **Styles:** their CSS, including the echo-drift animation.
- **Script:** their code in `js/main.js`. The console now types only on the home page, gated by the banner being on screen. Subpages run no telemetry at all.
- **Kept from 0016:** the barcode row's decode and the bigger teapot.

**Social icons:**
- **Markup:** the header's and footer's "IG in X GH" text labels become outline icons (Instagram, LinkedIn, X, GitHub), as in Figma.
  - They're inline SVG, 20 px, drawn in `currentColor` with a 1.75 stroke, with no downloads.
  - Each link keeps its `aria-label`, and each icon is `aria-hidden`.
  - The links are 24 px targets at least (WCAG 2.5.8), and turn the marker colour on hover.
- **Source:** the shapes follow Tabler Icons (MIT), credited in the README.
- **Build:** it still fills each `href` from `site-text.md` (0010), and a blank link still removes its icon.

**ID strip (values band):**
- **Layout:** as Figma's component, one bordered row of joined cells:
  - the ERC mark;
  - ID with a small label above the value;
  - Batch, the same way;
  - the barcode.
- **Markers:** each text cell carries a small crossed-box marker in its corner.
- **Batch value:** corrected to Figma's `X5/22`, from `XS/22`.
- **Decode:** the row still decodes on arrival (0016).

**Banner labels:**
- **Layout:** the System Core, Batch, and Serial labels become Figma's "Technicals labels": one bordered grid in mint, with shared borders.
  - **Desktop (1280 px and up):** the globe cell, then the three system lines, then Batch over Serial.
  - **Phones and tablets:** the globe and system lines share a row, with the two small cells side by side below, so nothing overflows a narrow column.
- **Defaults:** they follow Figma ("System Core X7", "Module sector 12B", "X5-77", "IN-2087-A"). The live device readout still replaces them when JavaScript runs.
- **Motion toggle:** it stays beside the grid.

## Alternatives

- **Exporting Figma's icon images** would add files and requests. Inline SVG costs a few hundred bytes per page and follows the theme colour.
- **Allowing SVG in visitor content** was never on the table. The page-level allowlist test now accepts `svg`, `rect`, `circle`, and `path` (with presentation attributes only), and a new test keeps SVG to the social-icon lists. Visitor comments stay as strict as before.

## Consequences

- **Quieter background:** the hero, the values band, and the subpage headings no longer have faint text behind them.
- **The 0008 echo notes and the 0016 data-column notes** no longer describe the site.
- **Changing an icon** means editing every page and both templates at once, like the rest of the shared chrome (0004).
