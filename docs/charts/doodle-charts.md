# Doodle charts: a hand-drawn 2D version of every chart

A second version of every chart in the library, drawn as if by hand with a marker on paper. It has wobbly lines, hatched fills, scribbled labels and a little ink "boil". The data, props and behaviour match the existing chart; only the drawing changes.

Each doodle chart is a separate component next to its premium twin, for example `BarChart.jsx` and `DoodleBarChart.jsx`. They go in a new **Doodle charts** section of the Charts category, using the same groups as the premium charts.

---

## 1. The look

| Element | Premium version | Doodle version |
|---|---|---|
| Background | Dark glass card | Off-white paper (`#fbf8f1`), faint grid or ruled lines, soft torn-edge shadow |
| Lines | Crisp SVG strokes | Wobbly double strokes, slightly over-shot at the ends |
| Fills | Gradients | Hachure (diagonal pen strokes), with cross-hatch, zigzag, dots or a solid marker fill as options |
| Text | Inter | Handwriting stack: `"Caveat", "Patrick Hand", "Comic Neue", "Segoe Print", "Bradley Hand", cursive` |
| Colour | Neon accents on dark | Marker ink: graphite `#2b2b2b`, plus marker colours `#e4572e` `#2e86ab` `#3bb273` `#f2a541` `#9b5de5` `#f15bb5` |
| Highlights | Glow | Highlighter swipe behind the text (a translucent yellow skewed rect) |
| Grid | Dashed hairlines | Pencil lines: light, slightly crooked, not reaching the edges |
| Tooltip | Glass panel | Sticky note (yellow square, tilted 1–2°, tape strip on top) |
| Legend | Dots | Little scribbled swatches plus a handwritten label |
| Annotations | Text chips | Hand-drawn arrows with a curved shaft and a two-stroke head, pointing at the data |

The overall feel is a smart notebook sketch: neat enough to read, but clearly drawn by hand.

---

## 2. How the hand-drawn look is made

Keep every component self-contained, so each file copies out on its own. Use no `roughjs` dependency; each file gets a small inline "sketch kit". It is about 120 lines, the same way the current charts carry `_helpers`.

### Sketch kit (inline helpers)

| Helper | What it does |
|---|---|
| `rng(seed)` | Seeded random, so the wobble is the same on every render and doesn't shimmer. |
| `wobbleLine(x1, y1, x2, y2, { roughness, bowing })` | Returns a path for one line drawn twice. Each pass has slightly moved end points, a mid-point bowed sideways, and a small over-shoot. |
| `wobblePath(points, opts)` | The same for a polyline or curve. Points are split into short segments and each is jittered a little. |
| `sketchRect(x, y, w, h, opts)` | Four wobbly lines whose corners don't quite meet. |
| `sketchCircle(cx, cy, r, opts)` / `sketchArc(...)` | An ellipse traced 1.1 turns with a drifting radius, so the start and end overlap like a real pen loop. |
| `hachure(shape, { angle, gap, style })` | Fills a shape with pen strokes clipped by a `<clipPath>`. Styles: `hachure`, `cross-hatch`, `zigzag`, `dots`, `solid` (a marker fill with a ragged edge). |
| `scribbleUnderline`, `highlighter`, `arrow(from, to)` | Annotation helpers. |
| `useBoil(on, fps = 6)` | Bumps a counter a few times a second, and the kit re-seeds the wobble from it. The ink "boils" like hand-drawn animation. It is off for `prefers-reduced-motion`. |
| `drawOn` | Each stroke gets `pathLength="1"` and an animated `stroke-dashoffset` from 1 to 0, so it draws itself in. |

### Shared doodle props (on every doodle chart)

| Prop | Default | Meaning |
|---|---|---|
| `roughness` | `1.2` | How shaky the lines are (0 is ruler-straight, 3 is wild). |
| `bowing` | `1` | How much long lines bend. |
| `fillStyle` | `'hachure'` | `hachure`, `cross-hatch`, `zigzag`, `dots` or `solid`. |
| `hachureGap` | `6` | Space between fill strokes, in px. |
| `hachureAngle` | `-41` | Angle of fill strokes. |
| `strokeWidth` | `1.8` | Pen width. |
| `doubleStroke` | `true` | Draw each line twice for the marker look. |
| `boil` | `false` | Ink boil animation. |
| `drawOn` | `true` | Strokes draw themselves in on mount. |
| `seed` | `1` | Change it to get a different hand. |
| `paper` | `'grid'` | `grid`, `lined`, `dots` or `plain`. |
| `paperColor` | `#fbf8f1` | Paper colour. |
| `inkColor` | `#2b2b2b` | Lines and text. |
| `font` | handwriting stack | Text font. |
| `tilt` | `0.6` | Degrees the whole card is rotated, for a pinned-note feel. |
| `colors` | marker palette | Series colours. |

Doodle charts keep all the data props of their premium twin (`data`, `series`, `labels`, `title`, `subtitle`, value formatting and so on). Charts that have a built-in demo dataset keep it too, so a `data` string can move between the two versions.

### Rules every doodle chart follows

1. **Seeded wobble.** Same props give the same drawing, so screenshots are stable. Only `boil` changes it over time.
2. **Readable first.** Text never wobbles, only lines and shapes do. Numbers use the handwriting font at no less than 0.85 of the normal size.
3. **Hover.**
   - The hovered element gets a highlighter swipe or a thicker re-stroke.
   - Other elements fade to pencil grey.
   - The tooltip is a sticky note.
4. **Draw-on order.** Axes first, then data, then labels and annotations. The whole sequence takes about `duration`.
5. **Accessibility.**
   - Each chart keeps the same `role="img"` and `aria-label` text as its premium twin.
   - `prefers-reduced-motion` turns off draw-on and boil.
6. **Self-contained.** One file per chart, React only, no other dependencies. Each gets a registry entry, a preview image and a place in `sections.js` under **Doodle charts**.

---

## 3. Every chart, in doodle form

The doodle twin keeps the data format of the original. Each entry says what changes in the drawing.

### Comparing categories

| Doodle component | Twin | Doodle treatment |
|---|---|---|
| `DoodleBarChart` | Bar Chart | Sketch-rect bars with hachure fill, each series at a different hatch angle. A scribbled value sits on top of each bar, and the tallest gets a hand-drawn star. Stacked mode leaves a small gap between segments, like separate pen strokes. |
| `DoodleLollipopChart` | Lollipop Chart | A pencil stem with a filled marker dot at the end, coloured in with a circular scribble. The baseline is a ruler line with tick scratches. |
| `DoodleDotPlot` | Dot Plot | Open and filled hand circles joined by a wavy connector. The change shows as a little "+16" with an arrow. |
| `DoodleBulletChart` | Bullet Chart | Ranges as three hatch densities. The actual value is a solid marker bar and the target is a bold hand-drawn tick. |
| `DoodleRadarChart` | Radar Chart | A web of wobbly polygons, with each series filled using a different hatch style. Vertex dots are drawn as small scribbled circles. |

### Change over time

| Doodle component | Twin | Doodle treatment |
|---|---|---|
| `DoodleLineChart` | Line Chart | Lines draw on in pen. An optional hatched area sits under each line. The last point gets a circle and a handwritten end label with an arrow, and the forecast is a dotted pencil line. |
| `DoodleAreaChart` | Area Chart | Stacked bands in different hatch angles, each edged with a marker line. |
| `DoodleStepChart` | Step Chart | Steps drawn as a ruler-and-pen staircase. Each jump has a small circled "+$3" note. |
| `DoodleSparklines` | Sparklines | A row per metric with a tiny pen line and a hand-circled end point. The change is written in the margin with a ▲ or ▼ doodle. |
| `DoodleCandlestickChart` | Candlestick | Candle bodies as sketch rects: hatched for up, solid marker for down. Wicks are single pen strokes and the moving average is a highlighter line. |
| `DoodleGanttChart` | Gantt Chart | Task bars as sketch rects with progress hatched in. Dependencies are curvy hand arrows, milestones are scribbled diamonds, and "today" is a red marker line with a handwritten "today!". |
| `DoodleStreamgraph` | Streamgraph | Flowing layers each filled with a different fill style, with wobbly layer edges. Labels are written inside the widest part. |

### Parts of a whole

| Doodle component | Twin | Doodle treatment |
|---|---|---|
| `DoodlePieChart` | Pie & Donut | Sketch-arc slices with hatch fills at alternating angles. Leader lines are hand arrows to written percentages, and the donut centre has the total circled. |
| `DoodleTreemap` | Treemap | Sketch-rect tiles with hatch density by value. Group headers are written in the corner with an underline scribble. |
| `DoodleSunburst` | Sunburst | Rings of sketch arcs, with deeper rings in lighter hatch. The centre label is circled. |
| `DoodleWaffleChart` | Waffle Chart | A 10×10 grid of hand-drawn squares, crosses or little stick figures, filled with quick scribbles. |
| `DoodleShareBar` | Share Bar | Survey rows as sketch bars, diverging around a pencil zero line. The parts use different fill styles, with percentages written inside. |

### Distribution

| Doodle component | Twin | Doodle treatment |
|---|---|---|
| `DoodleHistogram` | Histogram | Hatched bin bars. The density curve is a smooth pen line, and the mean is a dashed marker line with "μ = 52" and a little arrow. |
| `DoodleBoxPlot` | Box Plot | A sketch-rect box with a thick marker median and whisker caps as short strokes. Outliers are small "x" marks. |
| `DoodleViolinPlot` | Violin Plot | A wobbly mirrored outline filled with hatching, with a pencil-drawn inner box. |
| `DoodleRidgelinePlot` | Ridgeline Plot | Overlapping hand-traced hills, each with its own hatch angle. The baselines are ruled lines. |
| `DoodleStripPlot` | Strip & Swarm | Every point as a tiny hand circle or tick. The median is a marker bar across each group. |

### Relationships

| Doodle component | Twin | Doodle treatment |
|---|---|---|
| `DoodleScatterPlot` | Scatter Plot | Points as small scribbled dots or "x" marks, with a ruler-drawn trend line and a handwritten "r = 0.82". Drag-select draws a lasso loop. |
| `DoodleBubbleChart` | Bubble Chart | Hand circles with hatch fill by group. Big bubbles have their names written inside. |
| `DoodleHeatmap` | Heatmap | Grid cells coloured in with marker scribble, denser for higher values, inside a pencil-drawn grid. |
| `DoodleHexbinPlot` | Hexbin Plot | Wobbly hexagons with hatch density by count. |
| `DoodleCorrelationMatrix` | Correlation Matrix | Circles sized by |r| inside hand-drawn cells, filled with cross-hatch for negative and hatch for positive. |

### Flow and connections

| Doodle component | Twin | Doodle treatment |
|---|---|---|
| `DoodleSankeyDiagram` | Sankey Diagram | Hand-drawn ribbons edged in pen and filled with light hatch. Nodes are marker blocks with written labels. |
| `DoodleAlluvialDiagram` | Alluvial Diagram | The same as Sankey, with stage names written at the top and underlined. |
| `DoodleChordDiagram` | Chord Diagram | A ring of sketch arcs with hatched ribbons crossing the middle and names written around the outside. |
| `DoodleNetworkGraph` | Network Graph | Nodes as hand circles with names written beside them, links as pencil curves, and communities circled with a loose lasso. Draggable, like the original. |
| `DoodleFunnelChart` | Funnel Chart | A hand-drawn funnel with each stage hatched. The conversion rate is written beside a downward arrow. |
| `DoodleTreeChart` | Tree Chart | Nodes as boxes with labels written inside, joined by pen connectors. Folded branches show a scribbled "+3". |

### Single values and progress

| Doodle component | Twin | Doodle treatment |
|---|---|---|
| `DoodleGauge` | Gauge | A sketched dial with zones in three hatch styles and a hand-drawn needle. The value is written big in the middle and circled. |
| `DoodleProgress` | Progress | Bars are outlined in pen and filled with scribble up to the value. Rings are pen loops. A finished job gets a big hand tick. |
| `DoodleKpiTiles` | KPI Tiles | Each tile is an index card with the number written big, a hand arrow showing the change, and a mini pen sparkline. |

### More charts

| Doodle component | Twin | Doodle treatment |
|---|---|---|
| `DoodleWaterfallChart` | Waterfall Chart | Floating sketch bars, hatched for rises and cross-hatched for falls, with dotted pen connectors. Totals are solid marker. |
| `DoodleParetoChart` | Pareto Chart | Hatched bars with a pen cumulative line. The 80% line is a red marker with a handwritten "the vital few →". |
| `DoodleSlopeChart` | Slope Chart | Two ruled columns joined by pen lines, with each end point circled. The biggest climber gets an arrow and a note. |
| `DoodlePopulationPyramid` | Population Pyramid | Mirrored sketch bars, each side with its own hatch angle. Age bands are written down the middle. |
| `DoodleParallelCoordinates` | Parallel Coordinates | Ruled axes with pencil polylines. Dragging an axis draws a bracket filter. |
| `DoodleWordCloud` | Word Cloud | Words in mixed handwriting weights, some rotated. The top word is circled and a few get highlighter swipes. |

### Geographic (once the premium versions exist)

| Doodle component | Doodle treatment |
|---|---|
| `DoodleChoropleth` | Region outlines traced in pen, filled with hatch density by value. |
| `DoodleSymbolMap` | Pins drawn as scribbled circles on a sketched map. |
| `DoodleFlowMap` | Curved hand arrows between places, with stroke width by volume. |
| `DoodleCartogram` | A tile grid of wobbly squares with region codes written in them. |

---

## 4. Build order

1. **Sketch kit first:**
   - Write the inline helpers once and test them on a plain page: lines, rects, circles, arcs, every fill style, arrows, `useBoil`.
   - Check that the wobble is stable across renders and that reduced motion is respected.
2. **Pilot three charts:** `DoodleBarChart`, `DoodleLineChart` and `DoodlePieChart`. Get the look agreed before building the rest.
3. **Then one group per batch**, in the same order as the premium charts:
   1. Comparing
   2. Change over time
   3. Parts of a whole
   4. Distribution
   5. Relationships
   6. Flow
   7. Single values
   8. More charts
4. **Geographic last**, after the premium map charts are decided.

Each batch is done when:

- **Files:** Each chart is a single self-contained file in `src/lib/`.
- **Registry:** Each chart has an entry with `category: 'Charts'`, every option as a control, the shared doodle props, and `files` / `deps` set.
- **Sidebar:** The slug is listed under **Doodle charts → <group>** in `sections.js`.
- **Preview:** `public/previews/doodle-<slug>.jpg` is captured after the draw-on finishes.
- **Build:** `vite build` passes, with no console errors in a headless check.
- **Hand checks:** hover, the tooltip sticky note, `boil` on and off, and reduced motion.

## 5. Naming

- **Component:** `Doodle` plus the premium component name, e.g. `DoodleBarChart`.
- **Slug:** `doodle-` plus the premium slug, e.g. `doodle-bar-chart`.
- **Sidebar:** a **Doodle charts** section whose groups mirror the premium Charts groups.
