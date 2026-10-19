# 0009: Interactive models and usability-driven graphics

Status: Accepted (2026-10-18). Amends 0003 (the JavaScript budget). Builds on 0002 and 0008.

## Context

The owner found the site a little sparse. They wanted more graphical elements that still mean something and stay easy to use, in the branding guide's style. They also wanted a classic computer-graphics model among the wireframes: the Utah teapot or Suzanne, Blender's monkey.

After the video clips (0007) and ambient motion (0008), `js/` was 10 bytes under the 10 KB gzipped budget from 0003.

## Decision

**Budget:** the limit rises from 10 KB to **32 KB gzipped**. That makes room for model data and interaction while staying under a third of the self-hosted fonts, which are about 105 KB. On slow Wi-Fi it adds well under a second. After this change `js/` is about 14.1 KB.

**Each addition answers a usability principle:**

| Addition | Principle | What it does |
|---|---|---|
| Hands-on models | Direct manipulation, feedback | The teapot and the footer torus follow the hand when dragged, or turn with the arrow keys. A visible hint and "Reset view" sit under each one, Home also resets, and the console logs `USER ROTATE`. |
| Reading-progress bar | Visibility of system status | A thin brand-gradient bar at the top shows how far down the page the reader is. |
| Section markers | Wayfinding | Each section rule ends in a registration mark and draws in as the section arrives. |
| 404 teapot | Error recovery | The 404 page explains itself with a nod to HTTP 418 and offers three large, named ways back. |
| Hover and focus feedback | Affordance | Card brackets close in, link arrows nudge forward, and card titles underline when pointed at or focused. |

**Models:**
- **Utah teapot:** Martin Newell's 32 bicubic Bézier patches, transcribed from three.js `TeapotGeometry` (MIT License). The University of Utah says the model files "are freely available for any use" and asks that it be named a Utah Teapot, which the caption and `js/models.js` do. `bezierPatches` in `geometry.js` draws the patches as iso-lines, and `uprightUnit` fits the model to the other meshes' size.
- **Suzanne: not included.** No clearly permissive license was found for the mesh. Blender developers have said it likely falls under Blender's GPL. A home-made monkey head or a CC0 model could be added later.

**Interactive canvases:**
- They are `tabindex="0" role="img" aria-roledescription="3D model"`, labelled with what they show. The label doesn't promise arrow keys, because screen readers in browse mode keep the arrows for themselves. A visible hint ("Drag or use arrow keys") and a 44 px "Reset view" button sit under each model.
- Arrow keys ignore Alt, Ctrl, Meta, and Shift, so browser shortcuts like Alt+Left still work. Only the primary button or a single touch drags, and redraws are limited to one per frame.
- Decorative canvases stay `aria-hidden`.
- Sideways drags turn the model, and `touch-action: pan-y` keeps vertical swipes scrolling the page on phones.
- A visitor's turn redraws even with motion paused, because the visitor is the one driving it.

**Progress bar:** it is a status display, not decoration, so it follows scrolling under reduced motion and with the motion toggle off. Browsers without scroll timelines don't show it. A site test exempts it by name from the 0008 motion gates, and checks that it is in every page's shared header.

**Reduced motion:** hover and focus feedback changes instantly instead of animating, so the feedback stays and the movement goes.

## Alternatives

- **A counted section code (`SEC.02`) on each marker:** dropped. Unnumbered panels made the count disagree with the visible `04 /` index, and a wrong number is worse than none.
- **Suzanne from a third-party download:** rejected until its license is clear.
- **Keep the 10 KB budget:** every feature would need to strip comments or skip interaction. The owner chose to raise it.

## Consequences

- **Every page loads the teapot data,** about 2 KB gzipped, because static imports are the only kind allowed (0002) and the footer torus shares the module.
- **Credit the teapot** in any derived use as a Utah Teapot.
- **New interactive canvases** must keep the focus, label, and reset pattern, or the site test fails.
