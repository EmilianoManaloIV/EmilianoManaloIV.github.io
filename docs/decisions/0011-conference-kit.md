# 0011: Conference kit: QR card, link previews, home-screen icon, sitemap

Status: Accepted (2026-10-18). Builds on 0005 and 0010.

## Context

The site is meant for a conference, where visitors arrive by scanning a QR code, often on slow Wi-Fi.
- **No QR code:** there was no QR code to show or print.
- **No previews:** a shared link had no preview image.
- **No home-screen icon:** "add to home screen" had no manifest.
- **Not findable:** search engines had no sitemap.

## Decision

**QR card (`/card/`):**
- **The page:** it shares the site chrome, and the footer of every page links to it ("Show my QR card"). It shows a large QR code, the name, the subtitle from `site-text.md` (0010), the address in text, Save contact, and Share.
- **On a phone:** held up at a booth, the code comes first and fills the screen, up to 70% of its height.
- **Printed:** it becomes a black-on-white 4 × 3 in badge insert with no chrome.
- **The code:** `tools/qr.mjs` generates it at build time, so the browser runs no extra script. It's a small, dependency-free QR encoder written from ISO/IEC 18004: byte mode, error-correction level M, versions 1–10, Reed-Solomon over GF(256), BCH format and version information, and all 8 masks scored by the standard penalty rules.
- **The output:** `card/qr.svg` holds black modules in one path, on a white four-module quiet zone, so it scans in either theme. It's also published for stickers and slides.
- **Tests:**
  - Reed-Solomon is checked by its defining property, since every codeword has zero syndromes at the generator's roots.
  - Format and version bits match the standard's published values.
  - A reader in the test has its own map of function modules, including the version areas. It reads the second format copy, unmasks, de-interleaves the blocks, checks every block's syndromes, and decodes the text, for versions 1 to 10 at their capacity edges and for multibyte text. Its zigzag order and mask formulas mirror the encoder's, so the independent checks are the published format and version tables, the syndromes, and the decoded text.
  - The chosen mask is tested to score no higher than any other.
  - A phone camera scan is the final check before merging.

**Link previews:**
- **Tags:** `og:image`, its size and alt text, and `twitter:card="summary_large_image"` are added to every page only if `assets/img/share.png` exists. It's a 1200 × 630 image exported from the Figma file, so no page ever points at a missing file.
- **Default:** until then, previews stay text-only.

**Home screen:**
- **Manifest:** `site.webmanifest` (name, "EM", brand colours, the SVG favicon as the icon) is linked from every page.
- **iOS icon:** `apple-touch-icon` is added only if `assets/img/apple-touch-icon.png` exists (180 × 180, from Figma), because iOS doesn't use SVG icons.

**Sitemap and robots:**
- **Sitemap:** the build writes `sitemap.xml` listing every real page: no 404 and no redirect pages, but the card is included. Posts and projects are dated by their last edit (`updatedAt`, now fetched).
- **Robots:** `robots.txt` allows everything and points at the sitemap.

## Alternatives

- **A QR library from npm, or a QR image service:** both break the zero-dependency rule (0001), and a service would also make every build depend on a third party.
- **Generating the QR code in the browser:** adds script to every visit for an image that never changes.
- **Drawing the share image in the build:** needs font rendering, which means a dependency, so a Figma export is simpler and matches the brand exactly.

## Consequences

- **Address changes:** if the site's address ever changes, the QR code changes with it on the next build, but printed cards don't.
- **Optional images:** the preview image and iOS icon are optional files in `assets/img/`, which holds a short README so the folder exists for uploads on GitHub. Adding them needs no code change.
- **The manifest is minimal:** it has an SVG icon and `display: browser`, so phones can bookmark the site with its name and colours. It isn't meant to make the site installable as an app.
