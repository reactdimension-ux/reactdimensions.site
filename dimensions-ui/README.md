# React Dimensions — landing page

A React landing page for React Dimensions, a (concept) library of physically based 3D components. The design is a technical drawing: drafting-paper grid, dimension lines, crop marks and a title block. The hero is the live, draggable 3D card.

## Run

```bash
npm install
npm run dev
```

## Sections

1. **Hero**: headline, install chip, and the live 3D card framed by animated dimension lines and a cursor readout.
2. **Ticker**: a tilted band of features.
3. **Primitives**: Material / Light / Motion, with CSS-rendered material spheres, a tone-mapping curve and a damped-spring curve that draw in on scroll.
4. **Models**: the card and pickup from this repo, each with its real dimensions.
5. **Code**: a sample component API and key numbers.
6. **Early access**: email sign-up (front-end only, nothing is sent anywhere yet).

## Site design

The whole site follows the docs layout described in `../docs/reactbits-ui-research.md`, with its own colours and type:

- **Dark by default**, with a light theme (header toggle, remembered, applied before first paint so there is no flash). All colours are CSS variables in `src/styles.css`.
- **60px frosted header** with the logo, links, a search button (press `/` or Ctrl/Cmd+K), theme toggle and a GitHub link. On small screens it gains a menu button that opens the component list.
- **Command-palette search** (`src/SearchDialog.jsx`): ranked results, arrow keys and Enter.
- **Library page**: a fixed frosted-glass sidebar (category icon picker with a sliding pill, filter box, "New" badges, active item, scroll-edge fades), a docs column, and an "On this page" panel on wide screens.
- **Docs page**: title and meta chips, a Preview / Code switch with a sliding pill, preview width presets (desktop, tablet, mobile), reload, copy link; the stage, then Customize, Props and Dependencies; the Code tab has Install (npm, pnpm, yarn, bun), Usage that reflects your settings, and Source; then related components and previous/next.
- **Hover preview**: hovering (or focusing) a sidebar item shows a thumbnail card of that component (`public/previews/*.jpg`, captured from the live previews). The same thumbnails appear on the related-component cards. Hidden on touch screens.
- **Favourites**: the star in the toolbar saves a component to a *Favourites* group at the top of the sidebar (kept in localStorage).
- **Download for AI**: a menu that saves the page as a `.txt` file to attach to an assistant: as a prompt (description, props table with your current settings, usage and the full source), as Markdown docs, or as source only. Open in ChatGPT / Claude still sends a short prompt that links to the registry JSON.
- **JavaScript / TypeScript**: the Code tab can add a generated `.d.ts` (props typed from the controls) and the matching `@types` install line. The components themselves are plain JSX with inline styles, so there is no CSS/Tailwind variant.
- The preview **stage stays light** in both themes, because the demos draw dark ink and studio backdrops.

## Library (`/library`)

A component browser in the style of React Bits. Sidebar with search (press `/`), grouped by category; on phones it becomes a dropdown. Each component page has:

- **Preview**: live demo with a replay button where it applies
- **Customize**: sliders, toggles, segmented options and colour pickers that update the preview live
- **Props** table
- **Code** tab: install command, a usage snippet that reflects your current settings, and the full source (copy buttons on each)

| Category | Components |
| --- | --- |
| Text | Measure Text, Decode Text, Handwriting Text, Lyric Sync (Apple Music, Spotify and karaoke looks), Poster Lyrics (flat poster-type lyric scenes) |
| Animation | Tilt Card, Spring Button, Magnetic Button, Peek Card, Hover Scrub, Cursor Trail, Morph Cursor, Tilt Reveal, Proximity Glow, Long-hover Preview, Edge Peek Nav, Inertia Snap, Throw Cards, Nudge Part (three.js), Type Search, Key Carousel, Hotkey Hints, Space Pause, Axis Lock Drag (three.js), Pinch Twist (three.js), Tilt Orbit (three.js, device tilt), Shake Reset (device shake), Swipe Throw, Trackpad Scrub, Head Parallax (optional camera), Idle Attract, Undo History, URL State, Compare Slider, Record Replay, Presence Cursors (across tabs) |
| UI | **Flat:** Flat Dashboard, Flat Onboarding, Flat Utility, Flat Shop, Flat Docs, Flat UI Kit · **Glassmorphism:** Glass Player, Glass Weather, Glass Login, Glass Finance, Glass Desktop, Glass Dashboard · **Neumorphism:** Neu Home Remote, Neu Calculator, Neu Fitness, Neu Mixer, Neu Settings · **Liquid glass:** Liquid Tab Bar, Liquid Lens, Liquid Control Centre, Liquid Media Controls, Liquid Hero · **Bento:** Bento Features, Bento Portfolio, Bento Analytics, Bento Home, Bento Specs · **Minimalism:** Min Reader, Min To-do, Min Portfolio, Min Checkout, Min Settings, Min Dashboard · **Maximalism:** Max Festival, Max Drop, Max Editorial, Max Kids, Max Profile · **Skeuomorphism:** Skeu Delay, Skeu Journal, Skeu Camera, Skeu Hi-Fi, Skeu Calendar, Skeu Console |
| Phone UI | Smart Home App, Food Tracker App, Banking App, Onboarding App, Messenger App, Weather App, Water Intake App, Sleep Tracker App, Boarding Pass App, Hotel App, Reservation App, Social App, Story App, Dating App, Event App, Notifications App, Notes App, Habit App, Meditation App, Savings App, Budget App, Kanban App, Music App, Podcast App, Karaoke App, Wallet App, Stocks App, Crypto App, Camera App, Gallery App, Stories Composer, Video Feed App, Video Call App, Voice Notes App, Ride App, Parking App, Transit App, Vault App, Watch App, Car App, Split App, Receipt App, Cinema App, Reader App, Calendar App, Trip Planner App, Workout App, Run App, Meds App, Cycle App |
| 3D & Materials | Clear-coat Card (three.js), Pickup (three.js, optionally drivable), Snake (three.js, procedural), Turntable (three.js, playable), Vinyl Record (three.js), Sunglasses (three.js, parametric), Watch (three.js, analog and smart), Laptop (three.js), Glass Bottle (three.js), TV (three.js), Phone (three.js), Headphones (three.js), Mechanical Keyboard (three.js, type on it), Typewriter (three.js, types onto paper) |
| Backgrounds | Drafting Grid, Light Sweep, Cyclorama, Gradient Sweep, Soft Horizon |

The **Phone UI** apps are full multi-screen click-through prototypes, each drawn at an iPhone's 390 × 844 px and scaled to fit its box. Every tab, row and button leads somewhere: tapping a row opens its detail screen with a back button, flows such as Banking's send-money or Hotel's booking carry their state through (the balance changes, the booking appears under Trips), and drag, swipe, hold and pinch gestures are real. Each one has a **startScreen** control that opens it on any of its five pages, an **accent** colour, and a **frame** toggle for the device bezel. They are self-contained components (React only, every picture drawn in SVG or CSS), so a single file copies out on its own. The build lists are in `../docs/phone-ui-phase-one.md` and `../docs/phone-ui-phase-two.md`.

The **Snake** is built entirely in code (no model file): a tube along a spring-driven spine, with an overlapping-scale texture drawn on a canvas from your colours. Colour presets set several colours at once and every colour stays editable. In *rear* mode the head follows the pointer; in *slither* mode it crawls after it along the floor with a travelling body wave.

The **Turntable** is a playable record player built in code. Press power (in the controls or on the deck), drag the tonearm onto the record, click the speed knob, or grab the record to scratch it. Pull the record past its edge to lift it off the platter: it follows your pointer (tilting as it moves, with the bare felt-matted platter underneath), and where you let go it either drops back on the platter or comes to rest beside the deck, which stands on small feet so the disc can slide partly underneath. Drag it back on to load it again and the arm cues itself. Platter speed has real inertia (it spins up and slows down), and the needle creeps inwards as it plays. Turn **sound** on for a synthesised lo-fi loop with vinyl crackle whose pitch follows the platter, so 45 rpm, slowing down and scratching all bend the sound. The pieces are laid out in plan view in `src/turntable/arm.js`, which also solves the tonearm's geometry so the needle lands on the right groove.

The **Vinyl Record** is the same disc as on the turntable, as its own component: microgrooves, track gaps, a printed label (text and colour), a drifting sheen, and solid, marbled or splatter finishes. It spins by itself (`spin`, `rpm`), spins by hand when you drag it (with momentum when you let go), and leans towards the pointer. Turn on `sleeve` to stand it in a paper sleeve and slide it out with `pullOut`. The artwork code lives in `src/vinyl/textures.js` and is shared with the Turntable, which also takes the new `finish` and `accent` props.

The **Sunglasses** are fully parametric and built in code. Six frame shapes (wayfarer, aviator, round, cat-eye, square, hexagon) are defined as lens outlines; sliders reshape them (lens width and height, bridge, rim thickness, wrap, arm length) and the frame is rebuilt from the outline: a thick acetate rim, or a thin wire frame with a double bridge on aviators when the finish is `metal`. Lenses are curved sheets so they catch highlights, with an optional gradient tint and a mirror coating in any colour. Four finishes (gloss, matte, metal, tortoiseshell), separate frame, arm-tip and lens colours, and arms that fold. Six one-click styles set shape, finish and colours together. The shape maths is in `src/sunglasses/shapes.js`, the geometry in `build.js`.

The **Watch** is one component with two kinds of head and four kinds of strap, all swappable. `type` is `analog` (case, lugs, crown, a rotating diver bezel or plain one, a textured dial with index, numeral or diver markers, a domed crystal and hands showing the real time) or `smart` (a rounded-square case with a live screen: activity rings, an analog face or a big digital time, redrawn each second). `strap` is `leather` (stitched, with holes), `sport` (rubber with vents), `nylon` (woven with edge stripes) or `metal` (individually modelled links with a clasp). Change either and the old part pops off and the new one pops on; you can also click the watch to swap it or click the strap to cycle it. Case, strap, strap accent, dial, hands, bezel and accent colours are all props, and six palettes set a whole look at once. `time="10:10"` freezes the hands for a product shot.

The **Laptop** is a thin-aluminium laptop in the style of a modern unibody ultrabook, with no logos or brand marks. It has an island keyboard of 70-odd individual keys with printed legends (drawn as one instanced mesh, so it stays cheap), a large trackpad, speaker grilles, side ports, a hinge, and a lid that swings open on a lightly damped spring (click it to open or close, or use the `open` slider). The display is a shader wallpaper in your colour with a generic desktop on top: menu bar, code window, widgets and dock, updated each minute; it sleeps when the lid is nearly shut. `bodyColor`, `keyColor` and `wallpaper` ease smoothly to new values, so swapping a palette is a cross-fade rather than a jump. It is orange by default, with eight one-click palettes.

The **Glass Bottle** is an empty swing-top bottle. The glass is one closed lathe shell (outer wall, rounded lip, inner wall and a thick pushed-in base) rendered with real refraction (`transmission`, `ior`, `thickness`), so it bends what is behind it. A second shell that fades in towards the edges draws the dark outline clear glass has in photographs. The stopper is a ceramic cap on a red gasket with a plug, and the wire clamp is a neck ring plus a lever that swings on a damped spring: click the bottle (or use `open`) to open or close it. Glass and tint colour, tint strength, frost, condensation (instanced beads placed on the real outline of the glass), and the stopper, gasket and wire colours are props, with six palettes.

The **TV** is sized by a slider from 32 to 100 inches. The screen is true 16:9 (width = 0.8716 × diagonal, height = 0.4903 × diagonal) and the whole scene is at real-world scale in inches, with a media console and a 5′9″ figure beside it, so a bigger TV genuinely looks bigger. The panel is modelled once at 55″ and scaled, with its depth kept constant. Size changes ease on a damped spring, so dragging the slider feels physical; the width and height are measured live with dimension lines, and a large readout shows the diagonal in inches and centimetres. Mount it on `feet`, a `pedestal` or the `wall` (it swings between mounts and the supports scale in and out). The screen shows a generic streaming home screen over a wallpaper that eases to new colours, plain wallpaper, or off. `fitCamera` zooms to the TV as it changes size (and is on by default on narrow screens). Quick-size buttons jump to 32, 43, 55, 65, 75, 85 and 100.

The **Phone** is a modern smartphone to real size in millimetres (71.6 × 147.6 × 7.8), in the style of a current flagship but with no logos or brand marks. The metal frame is an extruded squircle-cornered outline with a bevel; the front and back are glass slabs; the back carries a camera plate with three lenses (metal ring, black glass, inner element), a flash, a depth sensor and a microphone. It also has a pill cut-out, side buttons, antenna breaks and a USB-C port with speaker holes. The screen is a shader wallpaper in your colour with a generic lock screen or home screen drawn over it (it shows the real time), or it can be off. `frameColor`, `backColor`, `cameraColor` and `wallpaper` ease to new values, `finish` switches the back between frosted and glossy, and clicking the phone flips it on a damped spring (or use `view`). Eight one-click colourways.

The **Headphones** are over-ear headphones with no brand marks. The headband is an oval cross-section swept along an arch (a custom sweep, so it can have the soft rounded shape of the reference), with rounded end caps and a thin seam; each ear cup is a smooth ellipsoid shell, a thick oval cushion (a squashed torus) and a speaker-fabric disc behind it, joined to the band by a metal yoke pin. Soft-leather grain comes from a generated bump map. `bandColor`, `padColor`, `cupColor` and `accentColor` ease to new values, `finish` switches between leather, matte and gloss, `adjust` slides the cups down the band, and `fold` (or a click) swivels both cups flat on a damped spring. Eight palettes, including a two-tone.

The 3D components load three.js lazily, so the rest of the page stays light. The Pickup's keyboard driving only listens while its preview has focus (click it first), so the page still scrolls normally.

Components live in `src/lib/`, one self-contained file each (no CSS files), so the source can be copied straight into a project. To add one, drop a file in `src/lib/` and add an entry to `src/library/registry.jsx`.

The site uses client-side routing, so a static host needs to serve `index.html` for unknown paths (SPA fallback).

## Notes

- The 3D hero is lazy-loaded, so the page paints before three.js downloads.
- Fonts: Instrument Serif (display), Hanken Grotesk (body), IBM Plex Mono (labels), from Google Fonts.
- Respects `prefers-reduced-motion`.
- `react-dimensions` and the code sample are placeholder copy: there is no published package yet.
