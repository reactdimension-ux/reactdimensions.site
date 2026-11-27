# 3D charts: real WebGL versions of the charts that suit depth

A third version of the charts, after the premium 2D set and the Doodle and Flat twins. These are built in real 3D with React Three Fiber. They have solid extruded shapes, a glossy studio-lit look, a tilted three-quarter camera, soft contact shadows and labels that float beside the data. They are for hero sections, landing pages and dashboards where the chart is partly decoration. They are not for dense analysis.

Only charts that gain something from depth get a 3D version. Section 4 lists the ones that should stay 2D, and why.

Five are built and sit in **Charts → 3D charts**: **3D Pie Chart** (`Pie3DChart.jsx`), **3D Bar Chart** (`Bar3DChart.jsx`), **3D Pyramid Chart** (`Pyramid3DChart.jsx`), **3D Scatter Plot** (`Scatter3DChart.jsx`) and **3D Surface Plot** (`Surface3DChart.jsx`). The pie set the pattern described here.

---

## 1. The look

| Element | 2D versions | 3D version |
|---|---|---|
| Marks | Flat SVG shapes | Extruded solids (wedges, boxes, cylinders, ribbons) with a small rounded bevel on every edge |
| Shading | Flat colour or gradient | The light top is the series colour; the side walls are the same colour 18% darker. A clearcoat gives a soft gloss |
| Camera | Head-on | Tilted three-quarter view, about 38° above the floor by default. Drag to turn within limits |
| Background | Card | Light studio grey (`#f2f2f3`). There is no card: the canvas fills its container |
| Ground | None | A soft contact shadow under the chart. There is no visible floor plane |
| Labels | SVG text | HTML labels pinned to 3D points (drei `<Html>`). They are big numbers with the name underneath, and they always face the screen |
| Highlight | Colour or dim | The hovered mark lifts toward the camera, and the others' labels dim to 40% |
| Tooltip | Card | A dark rounded pill floating above the hovered mark |
| Motion | Draw-on or pop | Marks grow up from the floor one after another with a slight springy overshoot |

Default palette (from the reference image the pie was built from): `#ff9a2e` orange, `#2f8fff` blue, `#a93ce0` purple, `#ef4a3a` red, then `#14a89e` teal and `#c49a12` gold. Every colour is a prop.

---

## 2. How the 3D look is made

Each chart is one self-contained file in `src/lib/`, like every other component. It imports only `react`, `three`, `@react-three/fiber` and `@react-three/drei`, with no imports between lib files. Each file carries its own copy of the small 3D kit below; `Pie3DChart.jsx` is the reference copy.

### 3D kit (inline helpers)

| Helper | What it does |
|---|---|
| `parseRows(data)` | The same `"Label:value, ..."` string format as the 2D charts, so `data` moves between versions unchanged. |
| `mix(a, b, t)` | Blends two hex colours. It is used for the darker side walls (`mix(c, '#000', 0.18)`). |
| `pop(x)` | Ease-out with a small overshoot, for the grow-in. |
| Shape builder (e.g. `wedgeGeometry`) | Builds a `THREE.Shape` in the floor plane and extrudes it with `ExtrudeGeometry` (bevel 4 segments, `curveSegments` scaled to the arc length). It then rotates it to lie flat (`rotateX(-π/2)`) and lifts it so the base sits on y = 0. ExtrudeGeometry puts the caps in material group 0 and the walls in group 1, which is how tops and sides get different materials. |
| `Rig` | Places the camera on the `tilt` angle and backs it off until the whole chart *and its labels* fit the canvas width: `d = reach × 1.05 / (tan(fov/2) × min(aspect, 1.3))`. It reruns on resize. |
| Progress ref | A ref that goes from 0 to 1 over `duration` and restarts when the data changes. Marks read it in `useFrame`: each one is staggered, its `scale.y` follows `pop(k)`, and its label fades in over the last 40% of its own grow. Reduced motion jumps straight to 1. |
| Per-mark lerp | Hover lift and explode distance are eased in `useFrame` (`1 - exp(-dt × 12)`), not CSS, so they stay smooth with no React re-renders. |
| Studio lighting | A drei `<Environment>` built from three `<Lightformer>` soft boxes (a broad top light and two side strips), plus one shadow-casting directional light and a low ambient. Tone mapping is `NeutralToneMapping`; ACES washes the colours out to pastel. |
| `<ContactShadows>` | A soft shadow just under the chart (opacity ~0.32, blur ~2.4). |
| `<OrbitControls>` | No pan or zoom. The polar angle is limited to about `tilt − 20°` to `tilt + 25°`, and `interactive={false}` turns it off. |

### Shared 3D props (on every 3D chart)

| Prop | Default | Meaning |
|---|---|---|
| `tilt` | `38` | Camera angle above the floor, in degrees (10 = nearly side-on, 85 = top-down). |
| `thickness` | depends on chart | Height of the extrusion (slice depth, bar base height and so on). |
| `bevel` | `0.04` | Rounding on every edge. It is capped so thin marks never turn inside out. |
| `gloss` | `0.6` | Clearcoat strength. |
| `gap` | `0.04` | Space between neighbouring marks. |
| `hoverLift` | `0.25` | How far a hovered mark rises. |
| `labels` | `'percent'` or `'value'` | Which number floats beside each mark, or `'none'`. |
| `labelColor` | `'slice'` | `'slice'` colours the big number like its mark (as in the reference); `'text'` uses `textColor` for easier reading. |
| `showLegend` | `false` | An HTML legend along the bottom. |
| `autoRotate` | `false` | Slow idle turn. It pauses while a mark is hovered. |
| `interactive` | `true` | Drag to turn. |
| `animate`, `duration` | `true`, `1400` | Grow-in. |
| `decimals`, `prefix`, `suffix` | `0`, `''`, `''` | Number formatting. |
| `title`, `subtitle` | — | HTML overlay, centred at the top of the canvas. |
| `color` … `color6`, `background`, `textColor`, `mutedColor` | palette above | Every colour is a prop. |
| `style` | — | Passed to the wrapper `<div>`; the registry preview uses `{ position: 'absolute', inset: 0 }`. |

### Rules every 3D chart follows

1. **Labels never sit on a mark.** Place each label in 3D beside its mark, then correct for the camera:
   - Marks on the camera side (+z) push their label further out and lower, so it clears the side wall.
   - Marks on the far side lift their label above the back rim.
   - Check every chart at a narrow canvas width as well as the default.
2. **Fit includes the labels.** The `Rig` reach counts the label ring, not just the geometry, so nothing is cut off at the edge.
3. **No CSS transitions on anything `useFrame` writes.** A transition fights the per-frame value and leaves labels stuck half-faded. Ease in `useFrame` instead.
4. **Readable numbers.** Labels are HTML, never 3D text, so they stay sharp at any size and can be read by screen readers. The wrapper has `role="img"` and an `aria-label` listing every value, the same as the 2D twin.
5. **Interaction.**
   - Hovering lifts the mark, shows the tooltip and dims the other labels.
   - Clicking toggles an "explode" where the chart has one.
   - The cursor becomes a pointer over marks and is reset on pointer out.
6. **Dispose what you build.** Geometry made in `useMemo` is disposed in an effect cleanup when its inputs change.
7. **One canvas per chart.** Browsers cap live WebGL contexts at about 16, so 3D charts must not be shown many at once live. Gallery grids use the still preview image instead.
8. **Honest by default.** Perspective makes near marks look bigger, so the exact number is always shown in the label and the tooltip. Use `heightBy: 'value'` only as an extra encoding, never the only one.

---

## 3. Every chart that suits 3D

**Status:** ✅ built · 🟡 next · ⚪ later.

### Parts of a whole

| 3D component | Twin | 3D treatment | Status |
|---|---|---|---|
| `Pie3DChart` | Pie & Donut | Extruded wedges, a tilted camera and the smallest slice exploded. `innerRadius` makes a donut and `heightBy: 'value'` makes bigger slices taller. Floating % labels; click to explode a slice. | ✅ |
| `Pyramid3DChart` | Flat Pyramid / Funnel | Stacked frustum layers (a cone cut into bands), or a square pyramid with `shape: 'pyramid'`, with gaps between layers. Layers drop in from the bottom up, and each has its number on the front. Big values sit in a right-hand column on dotted leader lines, which bend when thin layers would crowd their labels. `inverted` gives a funnel, `mode: 'value'` sizes bands by value, and a hovered layer slides out. | ✅ |
| `Waffle3DChart` | Waffle Chart | A 10×10 grid of rounded cubes. Each category's cubes rise in a wave and the remainder stays as flat tiles. | ⚪ |
| `Treemap3DChart` | Treemap | Extruded tiles whose height also follows value, with groups separated by a gap and a lifted group label. | ⚪ |

### Comparing categories

| 3D component | Twin | 3D treatment | Status |
|---|---|---|---|
| `Bar3DChart` | Bar Chart | Rounded boxes or cylinders on a soft floor with a back-wall value scale. Several series can be grouped, stacked, or set in depth rows. Bars grow up one after another, and values float above with a halo so they stay readable over taller neighbours. Three-quarter camera with `tilt` and `turn`. | ✅ |
| `BarGrid3DChart` | Heatmap / Bar | Two category axes (e.g. month × region) give a "city" of bars, each with its height and colour set by value. Hover shows the row and column. | ⚪ |
| `Radar3DChart` | Radar Chart | The series polygon extruded into a slab over a flat web, with the second series as a second slab at a different height. | ⚪ |

### Change over time

| 3D component | Twin | 3D treatment | Status |
|---|---|---|---|
| `Ribbon3DChart` | Line / Area | Each series is an extruded ribbon running along x. Series sit one behind another in z, like a ridgeline in depth. | ⚪ |
| `Stack3DChart` | Area (stacked) | Stacked area layers as solid slabs that build upward over time. | ⚪ |

### Relationships and distribution

| 3D component | Twin | 3D treatment | Status |
|---|---|---|---|
| `Scatter3DChart` | Scatter / Bubble | Glossy balls (drei `<Instances>`) in a true x/y/z axis box, with drop lines and soft shadows on the floor. A fourth value sets the size and an optional fifth names the group. Hovering draws dashed guide lines to all three walls. The demo data is clustered groups. It turns slowly by default, because orbiting is how depth gets read. | ✅ |
| `Surface3DChart` | Heatmap | A height-mapped terrain from a grid of values (`data` rows, or a preset: peaks, ripple, saddle, waves, hills). The colour ramp is sequential, diverging (automatic when values cross zero) or stepped into flat bands (`steps`). It has grid lines on the surface and a faint heatmap of itself on the floor. Hovering reads the value at the pointer. | ✅ |
| `Histogram3DChart` | Histogram (2D bins) | A bivariate histogram: bars on an x/y bin grid. | ⚪ |

### Single values and progress

| 3D component | Twin | 3D treatment | Status |
|---|---|---|---|
| `Gauge3DChart` | Gauge | A torus arc track with a glossy fill arc and the value in the middle. | ⚪ |
| `Cylinders3DChart` | Progress | Glass cylinders filling with a coloured liquid level, one per metric. | ⚪ |

### Geographic

| 3D component | Twin | 3D treatment | Status |
|---|---|---|---|
| `Globe3DChart` | (map) | A rotating globe with points sized by value and arcs between places. | ⚪ |
| `PrismMap3DChart` | Choropleth | Regions extruded by value. This needs map geometry, so it comes after the 2D map charts. | ⚪ |

---

## 4. Charts that stay 2D

These would get harder to read in 3D, with no gain:

- **Box plot, violin, strip/swarm, ridgeline (as-is):** small differences in spread are the whole point, and perspective distorts them.
- **Sankey, alluvial, chord:** link widths carry the data, and depth hides and foreshortens them.
- **Parallel coordinates, slope, dot plot, bullet, lollipop:** precise positions along one axis, where 3D only adds occlusion.
- **Sparklines, KPI tiles:** they have to be tiny and quick to read.
- **Correlation matrix, hexbin:** dense grids, which `Surface3DChart` covers better.
- **Gantt, candlestick, waterfall, pareto:** exact alignment to a time or value axis.

---

## 5. Build order

1. **Pie** ✅. It established the kit, lighting, label rules and camera fit.
2. **Bar3DChart** ✅, then **Pyramid3DChart** ✅: the two most-requested infographic shapes.
3. **Scatter3DChart** ✅ and **Surface3DChart** ✅: the analytical ones that need a 3D axis box. Each file carries an inline `AxisBox`: a floor and two back walls with grid lines and `<Html>` tick labels. The walls move to whichever sides face away from the camera, checked each frame, so they never hide the data while orbiting.
4. **Waffle, Gauge, Cylinders**: quick wins that reuse the bar and pie geometry.
5. **Ribbon, Stack, Treemap, Radar, BarGrid, Histogram.**
6. **Globe and PrismMap** last, after the 2D map charts settle the data format.

Each chart is done when:

- **File:** one self-contained file in `src/lib/`.
- **Registry:**
  - It is lazy-loaded (`const X = lazy(() => import('../lib/X.jsx'))`).
  - The entry has `category: 'Charts'`, `fill: true` and `deps: ['three', '@react-three/fiber', '@react-three/drei']`.
  - The preview wraps the chart in `<Suspense>` with `style={{ position: 'absolute', inset: 0 }}`.
  - Every prop is a control.
- **Sidebar:** the slug is listed under **3D charts** in `src/library/sections.js`.
- **Screenshots:**
  - Default.
  - A variant with a narrow canvas.
  - A variant with the alternative shape (donut, stacked, inverted and so on).
  - The animated path, run through to its end state.
- **Build:** `vite build` passes and generates `r/<slug>.json`.
- **Hand checks in a real browser:** hover, click, drag limits, resize and reduced motion.

### Headless screenshots of 3D charts

WebGL needs software rendering in headless Chrome. Use a throwaway harness page that renders the chart directly (the library page's stage loader never clears in headless Chrome, for every 3D component), and give it a virtual time budget so the grow-in finishes:

```sh
chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1300,560 --virtual-time-budget=5000 \
  --screenshot=out.png "http://localhost:5291/<harness>.html?props=<url-encoded JSON array>"
```

Leave `--virtual-time-budget` off the 2D chart pages that run a never-ending animation loop, because it can hang there. The 3D harness is fine with it.

Two more traps:

- **Fixed cell height.** Give each harness cell an explicit pixel height, not `height: 100%`. Otherwise R3F measures the canvas before the layout settles. Under virtual time the canvas then resizes after the HTML labels last updated, so the screenshot shows every label shifted off its mark. A real browser keeps rendering frames and re-syncs, so this only affects headless screenshots.
- **Fresh profile per run.** Use a separate `--user-data-dir` for each screenshot. A Chrome left over from a killed run holds the profile, and new runs silently hand off to it and write nothing.

Also make the label fade finish inside the animation for the *last* mark. With staggered delays, a fade that starts after the delay can run past progress = 1 and leave the last label half-transparent.

## 6. Naming

- **Component:** the chart name plus `3DChart`, e.g. `Pie3DChart`, `Bar3DChart`.
- **Slug:** the chart name plus `-3d-chart`, e.g. `pie-3d-chart`, `bar-3d-chart`.
- **Sidebar:** a **3D charts** group in the Charts category, above the Flat and Doodle groups.
