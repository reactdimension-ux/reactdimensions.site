# Racing circuit ideas: five environments

Five new circuits, each in a different setting, built from components that are
already in the library. They go in the **Scenes & Assets** category, style
`Scenes`, next to the existing Racing Circuit.

Build them one at a time. Each section below says what to reuse and what is new.
**Read "Shared rules" before starting any of them.**

| # | Circuit | Look | Main reuse |
|---|---|---|---|
| 1 | Coastal Cliff Circuit | Mediterranean, golden hour | Racing Circuit track + Ocean water + Countryside trees |
| 2 | Neon City Street Race | Downtown at night, wet | Racing Circuit track + Downtown buildings and traffic |
| 3 | Desert Canyon Rally | Red rock, gravel, dust | Racing Circuit track + Desert dunes + Monster Truck dust |
| 4 | Alpine Ice Circuit | Frozen lake, snow, pines | Racing Circuit track + Forest Valley terrain and trees |
| 5 | Sky Island Circuit | Fantasy low-poly, above clouds | Racing Circuit track + Cloud Sea + low-poly kit |

---

## Shared rules (apply to every circuit)

### 1. Reuse, don't copy

These parts exist and must be imported, not rewritten:

| Need | Reuse from | Exports |
|---|---|---|
| Track spline, asphalt, kerbs, barriers, ground mesher | `src/circuit/track.js` | `TRACK`, `W`, `HALF`, `N`, `mesher`, `groundAt`, `fbm`, `noise`, `hash`, `sstep`, `wrap` |
| Grandstands, crowd, pit garages, boards, trees, GT cars | `src/circuit/props.js` | `buildProps`, `buildGround`, `buildFlat`, `boardTexture`, `carGeometry`, `personGeometry`, `tyreGeometry`, `treeGeometry`, `TEAMS` |
| AI field lapping the racing line, cameras | `src/circuit/Circuit.jsx`, `src/circuit/CircuitScene.jsx` | follow their structure |
| Sky, sun direction and colour | `src/cloud/sun.js` | `makeSky`, `sunDirection`, `sunlight`, `horizonDirs` |
| Low-poly helpers | `src/lowpoly/kit.jsx` | `rng`, `facet`, `Particles`, `Trail`, `Water`, `terrainGeo`, `InfoHint` |
| Camera views + info button | `src/airliner/stage.jsx` | `CameraRig`, `InfoHint`, `V`, `from`, `fit` |
| Drivable player car | `src/racecar/RaceCar.jsx` + `src/pickup/drive.js` | `RaceCar`, `useDriveRig` |
| Keyboard / touch input, vehicle state | `src/pickup/controls.js` | `input`, `readInput`, `vehicle`, `resetVehicle`, `START` |

### 2. Make the track take its own points (do this once, before circuit 1)

`circuit/track.js` builds a single `TRACK` from a hard-coded `PTS` list, and
`props.js` / `Circuit.jsx` read that module-level `TRACK`. To reuse it:

1. Export `makeTrack(points)` and keep `export const TRACK = makeTrack(PTS)` so
   the existing Racing Circuit is unchanged.
2. Change `groundAt`, `padDist`, `buildProps`, `buildGround` and `buildFlat` to
   take the track (and the `PIT` / `POND` / `HELI` layout) as an argument, with
   the current values as defaults.
3. Check the existing Racing Circuit still looks identical (screenshot before
   and after from the same camera).

Each new circuit then has a small `layout.js` with its own control points,
pit position and features, and passes them in.

### 3. Drivable mode

Every new circuit gets a `drivable` toggle that drops the Low Poly Race Car
onto the start line:

- Render `<RaceCar drivable />` from `racecar/RaceCar.jsx`. It already uses the
  Pickup's rig (`pickup/drive.js`) for throttle, steering, suspension and the
  chase camera.
- Set `START` in `pickup/controls.js` to the circuit's grid slot before mounting
  (position = `TRACK` sample 0, heading from its tangent).
- Pass a bigger `arena` in the `DRIVE` config (the circuit is ~1 km, not 70 m),
  or better, keep the car on the ground with `groundAt(x, z)` and slow it on
  grass or gravel.
- The AI field keeps lapping while you drive. The player car is not part of the
  AI list.
- Put the controls in the same `InfoHint`: "W A S D / arrows · Space brake · R reset".

### 4. Files, naming and registry

- Folder per circuit: `src/circuit-coast/`, `src/circuit-city/`,
  `src/circuit-canyon/`, `src/circuit-alpine/`, `src/circuit-sky/`.
- Wrapper in `src/lib/<Name>Model.jsx` (lazy-loads the scene, like
  `RacingCircuitModel.jsx`).
- Registry entry in `src/library/registry.jsx`:
  `category: 'Scenes & Assets'`, `style: 'Scenes'`, `isNew: true`.
- The registry `files` list must include **every** reused file (track.js,
  props.js, sun.js, kit.jsx, stage.jsx, racecar/*, pickup/drive.js,
  pickup/controls.js, pickup/textures.js and any scene file borrowed below).
  The copy-out breaks if one is missing.
- Card thumbnail: `public/previews/<slug>.jpg`, 608 x 380.
- Shared controls on all five: `view` (overview / follow leader / trackside /
  drive), `cars` (0-16), `speed`, `drivable`, time-of-day presets.

### 5. Check before calling it done

- Headless Chrome on the dev server (port 5199, `--use-angle=d3d11 --enable-gpu`).
  Screenshot overview, follow cam and drive mode.
- Drive test over DevTools in real time: add keys to `input.keys`, wait, read
  `vehicle` (virtual-time screenshots barely advance frames).
- Aim for 30+ fps in headless d3d11, same as the existing Racing Circuit.
- Re-check the original Racing Circuit after any change to `circuit/`.

---

## 1. Coastal Cliff Circuit (Mediterranean)

**Slug:** `coastal-cliff-circuit` · **Folder:** `src/circuit-coast/`

A ribbon of road cut into sea cliffs: stone walls instead of armco on the cliff
side, a tunnel through the headland, a harbour hairpin past moored boats, and a
fast run along the top of the cliffs.

**Signature moment:** coming out of the tunnel into low sun with open sea below.

**Reuse**
- Track, kerbs, cars, crowd: `circuit/track.js`, `circuit/props.js`.
- Sea: `ocean/Ocean.jsx`, `ocean/oceanShader.js`, `ocean/waves.js`
  (`waterHeight` for boats bobbing in the harbour).
- Trees and hedges on the hillside: `valley/trees.js` (`broadleaf`, `bush`),
  `valley/shaders.js` (`foliageMaterial`), `valley/land.js`, plus
  `country/props.js` for walls.
- Sky: `cloud/sun.js`.
- Player car: `racecar/RaceCar.jsx` + `pickup/drive.js`.

**New**
- `layout.js`: control points hugging a coastline; one side of the track is
  cliff edge (height drop to the sea), the other is rock face.
- Cliff terrain: heights fall steeply to sea level on the outside of the lap.
- Tunnel: an arched shell along ~80 m of track, lit with a strip of lamps.
- Harbour: quay, a few low-poly boats, a lighthouse with a turning beam at night.
- White-washed houses on the hill (instanced boxes, terracotta roofs).

**Presets:** golden hour (default), midday, night (lighthouse + street lamps).

---

## 2. Neon City Street Race (night)

**Slug:** `neon-street-circuit` · **Folder:** `src/circuit-city/`

A closed downtown street circuit: concrete barriers and catch fencing, a pit
lane under an overpass, and wet tarmac reflecting the neon.

**Signature moment:** a blind 90-degree corner between towers, then a long
waterfront straight.

**Reuse**
- Buildings, street grid, lit windows: `city/layout.js`, `city/buildings.js`,
  `city/shaders.js`.
- Parked and background traffic: `city/cars.js`, `city/traffic.js` (stop the
  traffic on the closed streets).
- Street trees: `valley/trees.js`, `valley/shaders.js`, `valley/land.js`.
- Track ribbon and race cars: `circuit/track.js`, `circuit/props.js`
  (swap armco for concrete blocks and fencing).
- Sky at night: `cloud/sun.js`.
- Player car: `racecar/RaceCar.jsx` + `pickup/drive.js`.

**New**
- Track points follow the city grid: right angles, chicanes, one long straight.
- Wet asphalt: low roughness with a puddle mask, plus planar reflection on the
  straights only (River Valley's reflector pattern; redraw every other frame).
- Neon signs: emissive boards (reuse `boardTexture` from `circuit/props.js` with
  neon colours) so bloom picks them up.
- Rain on/off: falling streaks plus spray behind each car (`Particles` from
  `lowpoly/kit.jsx`).
- Grandstands on the waterfront with camera flashes.

**Presets:** night rain (default), night dry, dusk.

---

## 3. Desert Canyon Rally

**Slug:** `desert-canyon-rally` · **Folder:** `src/circuit-canyon/`

A gravel stage through red sandstone canyons: crests over the dunes, a dry
lakebed straight, and a wooden bridge over a wash.

**Signature moment:** a jump over a dune crest, landing in a cloud of dust,
into a long sweeper made for drifting.

**Reuse**
- Dunes and sand shader: `desert/Desert.jsx`, `desert/desertShader.js`,
  `desert/dunes.js` (`duneField`, `duneShape`).
- Dust clouds on landing and behind each car: the dust in
  `lowpoly/MonsterTruck.jsx` and `Particles` / `Trail` from `lowpoly/kit.jsx`.
- Track spline and the AI cars: `circuit/track.js`, `circuit/props.js`
  (no kerbs or armco; marker poles and hay bales instead).
- Sky and harsh sun: `cloud/sun.js`.
- Player car: `racecar/RaceCar.jsx` + `pickup/drive.js`.

**New**
- Canyon walls: layered red-rock terrain either side of the track, flat-shaded
  strata bands.
- Gravel road surface instead of asphalt, with tyre ruts.
- Track height follows the terrain, so the crests are real jumps (body pitch
  from the rig's suspension).
- **Gravel mode in the drive rig:** add a `grip` value to the `DRIVE` config
  (lower lateral grip, car slides). Add it as an optional setting in
  `pickup/drive.js` with a default of full grip, so the Pickup and the race car
  stay the same.
- Spectator spots on rocks, a service park with tents and trucks.

**Presets:** midday (default), sunset, sandstorm (haze + blowing sand).

---

## 4. Alpine Ice Circuit

**Slug:** `alpine-ice-circuit` · **Folder:** `src/circuit-alpine/`

A track on a frozen lake ringed by snowbanks, pine forest and a timber-chalet
pit building, with mountains behind and an ice tunnel.

**Signature moment:** spinning out into a soft snowbank, which pushes the car
back out the way the cones do.

**Reuse**
- Terrain, valley shape and pines: `forest/terrain.js` (`heightAt`, `scatter`,
  `buildTerrain`), `forest/Forest.jsx` with a winter palette.
- Clouds below the peaks: `cloud/CloudSea.jsx`, `cloud/cloudSeaShader.js`,
  `cloud/noise.js`.
- Snowbank push-back: the collision response in `pickup/Cones.jsx`
  (box-vs-point push out along the shallowest axis), applied to the snowbank line.
- Track, cars, crowd: `circuit/track.js`, `circuit/props.js`.
- Sky: `cloud/sun.js`.
- Player car: `racecar/RaceCar.jsx` + `pickup/drive.js`.

**New**
- Ice surface: glossy blue-white with scratch marks; very low `grip` (same
  setting as the Desert Canyon's gravel mode).
- Snowbanks along both edges instead of barriers.
- Falling snow (`Particles`), tyre tracks left on the snow (`Trail`).
- Chalet pit garages and a ski-lift in the background.

**Presets:** clear morning (default), snowfall, night under floodlights.

---

## 5. Sky Island Circuit (fantasy low-poly)

**Slug:** `sky-island-circuit` · **Folder:** `src/circuit-sky/`

Floating low-poly islands joined by banked bridges and a loop, high above a sea
of clouds, with waterfalls pouring off the edges.

**Signature moment:** a banked spiral round a giant crystal, then a jump across
the gap between two islands.

**Reuse**
- Clouds below: `cloud/CloudSea.jsx`, `cloud/cloudSeaShader.js`,
  `cloud/noise.js`, `cloud/sun.js`.
- Islands, rocks, trees, grass: `lowpoly/kit.jsx` (`terrainGeo`, `facet`,
  `blob`, `cone`, `Water`, `Flow` for waterfalls), `lowpoly/CrystalRock.jsx`,
  `lowpoly/Tree.jsx`, `lowpoly/GrassTile.jsx`.
- Track spline: `circuit/track.js` (needs a height per control point for the
  bridges and the loop: add an optional `y` to the points).
- Player car: `racecar/RaceCar.jsx` + `pickup/drive.js` (matching low-poly style).

**New**
- 3D track: control points with height; banking from curvature; a loop section.
- Floating islands under the track sections; bridges between them.
- Waterfalls off the island edges (`Flow` + mist `Particles`).
- Falling off the track: respawn on the last checkpoint (`resetVehicle` with a
  per-checkpoint `START`).

**Presets:** day (default), sunset, starry night with glowing crystals.

---

## Suggested build order

1. **Shared refactor** (Shared rules, step 2) and check that the original circuit
   is unchanged.
2. **5. Sky Island**: fits the Low Poly Race Car and the kit; no photoreal assets.
3. **3. Desert Canyon**: adds the `grip` setting to the drive rig.
4. **4. Alpine Ice**: reuses that `grip` setting.
5. **1. Coastal Cliff**.
6. **2. Neon City**: the heaviest (city + reflections + rain), so it comes last.
