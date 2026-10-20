# 0012: Pre-launch audit: contrast, print, and page weight

Status: Accepted (2026-10-18).

## Context

Before the conference, every page was audited for keyboard use, screen-reader names and roles, colour contrast in both themes, reduced motion, print, and load time on slow Wi-Fi. Three problems turned up:
- **Link buttons:** text on the orange link buttons was cream on `#d7882b`, only 2.43:1.
- **Skill tags:** cream on `#a65e1e`, 4.27:1, just under the 4.5:1 that WCAG AA asks for small text.
- **Print:** only the QR card had print rules. Printing any other page in dark mode, or the dark panels in either mode, would put cream text on white paper, because browsers drop page backgrounds when printing.

## Decision

**Contrast:**
- **Link buttons:** they keep the brand orange, with near-black text (`--color-tag-primary-ink: #1a1a1a`), 6.17:1.
- **Skill tags:** their background darkens slightly, from `#a65e1e` to `#9c581c` (`--color-tag`), 4.73:1 with cream text. The brand token `--brand-accent-dark` is unchanged. The small count inside an About skill tag ("×2") is no longer dimmed, since 80% opacity dropped it to 3.64:1.
- **Current-position cues:** the current-page nav underline and the active rail dot use `--color-marker`. In the light theme that's the brand's darker orange, 4.27:1 on paper and 3.52:1 over the banner. In the dark theme it's the lighter orange, 5.17:1. The other rail dots use `--color-rail`, slate in the light theme and silver in the dark theme, 3.24:1 or more everywhere. Before, the underline was 2.43:1 on paper and the dark-theme dots were 2.71:1.
- **Test:** a site test computes WCAG contrast from the design tokens themselves, light and dark, for the site's text and control pairings. Alpha is composited, and the minimum is 4.5:1 for text and 3:1 for large text, focus rings, and position cues. It also checks that the buttons, tags, nav underline, and rail dots actually use those tokens, and that the system dark mode and the toggle's dark mode define the same colours.
- **Excluded:** decorative, `aria-hidden` marks (frame corners, ticks, margin labels, and the console echoes until 0017 removed them) are left out on purpose.

**Print:**
- **Colours:** print is always black on white. The colour roles and signal colours are set under `:root:root:root`, which beats both theme blocks.
- **Left out:** the header, the banner art (including the "Bridging" statement), the 3D models, the echoes (removed in 0017), the ambient sphere, the toggles, and the action buttons.
- **Tags:** tags lose their coloured background on paper, so they print as black outlined text.
- **Links:** outside links in prose, entry lists, project cards, and the footer's social links print their address. The contact list already shows its addresses.
- **Breaks:** cards and entries avoid page breaks.
- **Card:** the QR card keeps its own badge layout (0011).
- **Test:** a site test checks the token overrides and the hidden parts in the site-wide print block alone, so the QR card's own rules can't satisfy it.

**Page weight:**
- **Ceiling:** every page must load in under 200 KB gzipped: the page, the stylesheet, every script, and every font, uncached. Each page is about 136 KB today, and the test reports each page's figure.
- **Speed:** fonts use `font-display: swap`, so text appears before they arrive.
- **Images:** post and project images aren't counted, because their own caps already apply (0005).

## Consequences

- **Visible change:** the orange buttons now have dark text instead of cream, and the skill tags are a shade darker.
- **New colours:** a future colour change that hurts legibility fails the build, and the test names the pairing and its ratio.
- **Checked by hand only:** some things can't be automated here, so the PR records them as manual checks:
  - true screen-reader output;
  - a real print preview;
  - reduced-motion emulation;
  - network throttling.
