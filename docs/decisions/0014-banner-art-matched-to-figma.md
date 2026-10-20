# 0014: Banner art matched to Figma

Status: Accepted (2026-10-19). Supersedes the banner shapes in 0002 and the wave in 0008; changes the home page's section headings from 0009.

## Context

The owner wants the home banner's 3D art to match the Figma design ("Personal Website", desktop banner section "Image", 1280 × 542). The site drew stand-ins: a dome with a brim, and a smooth ripple spreading from the centre (a "teardrop wave"). Figma has, measured from the layers:

- **Pierced spheroid** ("Vector", L 591, T 22, 287 × 253): an oblate (squashed) spheroid wireframe of latitude rings and meridians, with a cylinder bored through its short axis. Its axis leans up and to the right, toward the viewer, so the bore's opening, ringed by a thick lip, shows at the upper right.
- **Terrain** ("Vector", L 143, T 250, 345 × 122): a square line grid seen from above at a low angle, turned slightly, with irregular hills. A tall peak sits right of centre, smaller bumps surround it, and the edges are flat. It runs across the console's right edge.

The owner also asked to remove the home page's "01 / About"-style headings and their rule lines, and their big-screen margin notes, as Figma has none there.

## Decision

**Shapes (`js/geometry.js`, unit-tested):**
- **`piercedSpheroid()`:** one `lathe` profile. It runs from the bore's top rim over the outside to the bottom rim, then up the bore wall. A last set of edges closes the wall onto the top rim. The polar radius is 0.62, the bore radius 0.32, and two extra latitude rings near each rim draw Figma's lip.
- **`terrainHeight(x, z, t)`:** four broad hills placed as in Figma, plus three octaves of hashed value noise.
  - **Jaggedness:** the noise blends lattice points along straight lines, so it keeps creases, which make the ridges jagged.
  - **Edges:** a smoothstep fade flattens all four edges.
  - **Determinism:** there is no `Math.random`, so every visit sees the same land.
  - **Motion:** the land drifts toward the viewer at `DRIFT` (0.08 units a second) and repeats every 25 seconds, without a seam. Hills rise in at the back and sink at the front. Like all motion, it stops with the Motion toggle.
- **`orient()`:** turns, then tilts, then rolls. So the spheroid spins on its own bore axis while that axis holds Figma's lean.

**Layout (`js/main.js`, `styles.css`):**
- **Desktop (1280 px and up):** the banner canvas leaves the grid. It is absolutely positioned over the whole banner container, behind the text (`z-index: -1` inside an isolated container, `grid-area: auto` so the grid cell no longer frames it).
  - **Placement:** each shape is scaled to a width and centred on a spot, as fractions of the banner. The spheroid is 22.4% wide at (56%, 27.4%), and the terrain 40% wide at (27%, 62%).
  - **Deviations from Figma**, both made because the site differs from the mockup:
    - **Spheroid position:** 1.4% left of Figma's 57.4%, because the site's headline is set larger than Figma's and would otherwise touch it.
    - **Terrain size:** 40% wide instead of Figma's 27%, centred a little lower. The site's desktop banner is about 1.36 times taller than Figma's 542 px, so at Figma's width the terrain looked small (the owner's feedback). It still overlaps the console's right edge, as in Figma.
  - **Frames:** size and centre come from the frame at t = 0, the one Figma shows.
- **Tablet and phone:** the art keeps its own 4:3 grid area. Both shapes are placed in it, then shrunk and nudged only if their whole motion would spill past the canvas.
- **Mode switch:** the script picks the layout from the canvas's computed `position`, so CSS alone decides it.
- **Console:** the lines become `CORE` (pose and vertex count) and `TERR` (the current peak height and the drift phase), within the 6-character column.

**Home headings (`index.html`):**
- **Headings:** About, Projects, and Contact keep a real `<h2>`, but with `class="visually-hidden"`. They disappear visually, rule lines included, while screen readers and heading navigation still find each section.
- **Margin notes:** their `data-label` attributes are removed, which removes them.
- **Subpages:** About & CV, R&D, and the Guestbook keep their numbered headings and margin notes.
- **Tests:** a site test checks the home page's state, and the margin-label test's minimum count drops by exactly those three.

## Alternatives

- **Exporting Figma's vectors as SVG** would match pixel for pixel, but would stop the art moving and add image weight. The console's telemetry would also no longer describe real shapes.
- **Seeded `Math.random` terrain** would need a seeded generator anyway. A hash is shorter and deterministic.
- **Hiding headings with `display: none`** would remove them from screen readers too, and leave the sections unnamed.

## Consequences

- **Readability:** on desktop the terrain runs under the console text, as in Figma. The canvas paints behind the text, so the text stays readable.
- **Changing the art:** placements live in one table (`artSpots` in `main.js`), and the hill layout in one constant (`HILLS` in `geometry.js`).
- **Heading text:** the home sections' names are now only in the hidden headings and the nav, so a renamed section needs both changed.
