# 0016: Background data columns, a decoding barcode row, and a bigger teapot

Status: Accepted (2026-10-19). Builds on 0008 (echoes, the motion gate), 0014 (banner art), and 0015 (the footer teapot). The data columns were removed in 0017, so the sections below about them are historical; the decode and the bigger teapot remain.

## Context

The owner felt three areas were too quiet:
- **The banner's 3D area** had nothing behind the art: "there should be things visually in there".
- **The values band's "ERC · ID · Batch · barcode" row** was static.
- **The Utah teapot** at the end of every page was small, capped at 24rem.

The owner chose:
- tall, faint data columns, unrelated to the console, behind the banner art and the footer teapot;
- a decode-on-arrival effect for the barcode row;
- a bigger teapot.

## Decision

**Data columns:**
- **Markup:** `<div class="data-columns" aria-hidden="true">` holding `pre[data-stream]` columns, in two places:
  - the banner's art grid cell, with four columns, behind the canvas;
  - the footer teapot's frame, with three columns, on every page.
- **Streams,** each a few characters wide, made up in `js/main.js`:
  - `addr`: a counting hex address with a drifting value;
  - `angle`: rotating `RX`/`RY`/`RZ` angles;
  - `bytes`: three hex bytes;
  - `bits`: two nibbles.
- **Fill and motion:** each column fills to its own height (a ResizeObserver refits it). While motion is on and the block is on screen, each adds a line and drops its oldest one at its kind's pace (`paces`, 0.5 to 0.9 seconds). The paces differ, so the columns never march together. The one motion gate (0008) stops them, and motion off freezes them in place.
- **Look:**
  - small monospace text at 14% opacity, fading out at the top and bottom;
  - `contain: size`, so the lines never grow the box they fill;
  - `z-index: -1` inside an isolated parent: the banner container, now isolated at every width, and the footer teapot's figure.
  - hidden without JavaScript and in print.

**The barcode row:**
- **Markup:** its five texts (ERC, ID, the number, Batch, the code) carry `data-decode`.
- **Effect:** when at least 60% of the row comes on screen with motion on, the texts decode from glyphs in about half a second. It's the same step as the "Bridging" headline, now shared as `decodeStep()`.
- **Fallback:** the real text is in the markup, so the row reads the same without JavaScript or with motion off. Pausing mid-decode puts it straight back. The row was already `aria-hidden`.

**The teapot:**
- **Size:** on tablets and up, the footer's teapot column becomes `1.2fr` against the contact and brand column's `1fr`, and the teapot may grow to 40rem there (phones keep the 24rem cap, which is already full width). That's about 600 px wide at 1280, up from 384.
- **Clipping:** its painter's scale is unchanged, 0.6 of the frame height, the largest at which the spout never clips as it swings toward the viewer. Only the frame grows.

## Alternatives

- **Copies of the main console,** like the echoes (0008), would repeat what the console already shows. The owner wanted something unrelated.
- **A CSS-animated scroll** would need its own keyframes and still could not invent new lines. Stepping in JS keeps the columns under the single motion gate.

## Consequences

- **Cost:** the data columns add about 1 KB of gzipped JavaScript. The timers run only while their block is on screen and motion is on.
- **Change in one place:** the column kinds are one table (`kinds` in `main.js`). Adding a kind means one entry there, plus the list in the site test.
