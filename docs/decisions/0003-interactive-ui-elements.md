# 0003: Interactive UI elements for conference visitors

Status: Accepted (2026-10-18). Builds on 0002. Amended 2026-10-18: the talk status chip and js/status.js were removed with the Talk section.

## Context

Visitors reach the site on a phone after a conversation, often on slow Wi-Fi. They need to know where they are on a long single page, swap contact details quickly, and know whether the talk is on yet. The owner asked for dynamic elements where human-computer interaction matters, without making the design busy.

## Decision

Add one interaction module, `js/ui.js`, separate from the motion code in `js/main.js`, plus pure time logic in `js/status.js`, which is unit-tested in Node.

- **Wayfinding:**
  - The nav marks the section in view with `aria-current`.
  - Wide screens get a dot rail.
  - Phones get a sticky section bar that links back to the menu.
- **Share and copy:**
  - The Share button opens the native share sheet, falling back to copying the canonical URL.
  - A Copy button copies the email.
  - One polite live region confirms each action.
- **Talk status chip:**
  - TBA, upcoming with a countdown, live, or ended, from `data-start` and `data-end` on the Talk card.
  - Shows the start in the visitor's time zone.
  - Updates once a minute without a live region.

All rules from 0002 still hold:
- **No network use.** `navigator.share` and `navigator.clipboard` are local OS features.
- **Usable without JavaScript.** The rail, the bar, and the action buttons stay hidden without it. The `mailto:` link and the vCard still work.
- **Reduced motion respected.** Under reduced motion, transitions are off.

The JavaScript budget rises from **8 KB to 10 KB gzipped**, summed per file. KB here means 1,024 bytes. The measured total after this change is about 10,000 bytes, so the headroom is small.

## Alternatives

- **Hamburger menu on phones:** hides the sections behind a tap. The two-column numbered nav plus the section bar keeps them visible.
- **Live countdown every second:** more motion and more screen-reader noise for no real gain. The status is useful to the minute.
- **Third-party share widgets:** network calls and tracking, ruled out by 0001.

## Consequences

- The budget has little headroom. The next feature needs trimming or another decision.
- The talk chip reads "Schedule TBA" until the owner fills in the session times.
