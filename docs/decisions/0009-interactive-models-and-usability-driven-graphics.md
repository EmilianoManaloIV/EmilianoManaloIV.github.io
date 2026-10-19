# 0009: Interactive models and usability-driven graphics

Status: Accepted (2026-10-18). Amends 0003 (the JavaScript budget). Builds on 0002 and 0008.

## Context

The owner found the site a little sparse. They wanted more graphical elements that still mean something and stay easy to use, in the branding guide's style. They also wanted a classic computer-graphics model among the wireframes: the Utah teapot or Suzanne, Blender's monkey.

After the video clips (0007) and ambient motion (0008), `js/` was 10 bytes under the 10 KB gzipped budget from 0003.

## Decision

**Budget:** the limit rises from 10 KB to **32 KB gzipped**. That makes room for model data and interaction while staying under a third of the self-hosted fonts, which are about 105 KB. On slow Wi-Fi it adds well under a second. After this change `js/` is about 16.1 KB.

**Each addition answers a usability principle:**

| Addition | Principle | What it does |
|---|---|---|
| Hands-on models | Direct manipulation, feedback | The teapot and the footer torus follow the hand when dragged, or turn with the arrow keys. A visible hint and "Reset view" sit under each one, Home also resets, and the console logs `USER ROTATE`. |
| Reading-progress bar | Visibility of system status | A thin brand-gradient bar at the top shows how far down the page the reader is. |
| Scroll ruler | Visibility of system status, wayfinding | On screens 1440 px and up, a drawing-style ruler in the empty right margin has a marker at the reader's position and a readout like `Y 01840 / 06210 · SEC 02`. |
| Section markers | Wayfinding | Each section rule ends in a registration mark and draws in as the section arrives. |
| 404 teapot | Error recovery | The 404 page explains itself with a nod to HTTP 418 and offers three large, named ways back. |
| Hover and focus feedback | Affordance | Card brackets close in, link arrows nudge forward, and card titles underline when pointed at or focused. |

**Models:**
- **Utah teapot:** Martin Newell's 32 bicubic Bézier patches, transcribed from three.js `TeapotGeometry` (MIT License). The University of Utah says the model files "are freely available for any use" and asks that it be named a Utah Teapot, which the caption and `js/models.js` do. `bezierPatches` in `geometry.js` draws the patches as iso-lines, and `uprightUnit` fits the model to the other meshes' size.
- **VR headset:** built procedurally by `headset()` in `geometry.js`. It's original geometry: a superellipse visor shell, front sensors, lenses, a head band, and a top strap. It sits on the R&D page heading and is hands-on like the teapot. `fitUnit` centres and scales it.
- **Suzanne: not included.** No clearly permissive license was found for the mesh. Blender developers have said it likely falls under Blender's GPL. A home-made monkey head or a CC0 model could be added later.

**Interactive canvases:**
- They are `tabindex="0" role="img" aria-roledescription="3D model"`, labelled with what they show. The label doesn't promise arrow keys, because screen readers in browse mode keep the arrows for themselves. A visible hint ("Drag or use arrow keys") and a 44 px "Reset view" button sit under each model.
- Arrow keys ignore Alt, Ctrl, Meta, and Shift, so browser shortcuts like Alt+Left still work. Only the primary button or a single touch drags, and redraws are limited to one per frame.
- Decorative canvases stay `aria-hidden`.
- Sideways drags turn the model, and `touch-action: pan-y` keeps vertical swipes scrolling the page on phones.
- A visitor's turn redraws even with motion paused, because the visitor is the one driving it.

**Echoes on subpages:** the R&D, About, and Guestbook headings get the faint console echo from 0008. Those pages have no console, so `main.js` runs the same telemetry without one: one finished line every couple of seconds, gated like the console by motion, tab visibility, and the echo being on screen.

**Progress bar and ruler:** they are status displays, not decoration, so it follows scrolling under reduced motion and with the motion toggle off. Browsers without scroll timelines don't show it. A site test exempts them by name from the 0008 motion gates, and checks that both are in every page's shared header. The ruler's readout comes from `ui.js`'s existing scroll handler.

**Reduced motion:** hover and focus feedback changes instantly instead of animating, so the feedback stays and the movement goes.

## Alternatives

- **A counted section code (`SEC.02`) on each marker:** dropped. Unnumbered panels made the count disagree with the visible `04 /` index, and a wrong number is worse than none.
- **Suzanne from a third-party download:** rejected until its license is clear.
- **Keep the 10 KB budget:** every feature would need to strip comments or skip interaction. The owner chose to raise it.

## Consequences

- **Every page loads the teapot data,** about 2 KB gzipped, because static imports are the only kind allowed (0002) and the footer torus shares the module.
- **Credit the teapot** in any derived use as a Utah Teapot.
- **New interactive canvases** must keep the focus, label, and reset pattern, or the site test fails.
