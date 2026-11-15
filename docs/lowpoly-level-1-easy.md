# Low poly, level 1: easiest

One or two primitives, one looping motion, one tap kick. About 50-90 lines
each. Build these first: they prove the shared parts that every later level
reuses.

## Items

| # | Item | Built from | Idle | Tap |
| --- | --- | --- | --- | --- |
| 46 | Gem | One faceted octahedron or lathe | Rotates, facets catch the light | Flash and spin burst |
| 47 | Heart | Two blobs and a cone | Beats | Ripple of hearts |
| 48 | Star | Extruded 5-point star | Spins | Bursts into mini stars |
| 5 | Flower | Petal cones around a blob | Petals open and close | Spins the bloom |
| 12 | Rainbow arc | Stacked lathe arcs | Bands ripple in sequence | Bands flare |
| 33 | Lantern | Box frame, glowing core | Glow pulses | Swings |
| 34 | Treasure map pin | Cone and sphere | Bounces | Ring pulses |
| 35 | Trophy | Lathe cup, box base | Spins | Sparkles |
| 14 | Log stump with rings | Cylinder with ring top | Rings glow outward | Pops a leaf |
| 4 | Mushroom cluster | Cones and flattened blobs | Caps pulse | Spore puffs |

## Reuse from what exists

- **kit.jsx**: `facet` for the hand-modelled look, `Flat` for the matt
  material, `Stage` for light, shadow and orbit, `useGeo` to dispose geometry,
  `useKick` for the tap decay, `rng` for seeded jitter.
- **Fox.jsx**: the `blob` and `cone` helpers (a faceted icosphere and cone).
  Move them into the kit so every scene stops redefining them.
- **CrystalRock.jsx**: the `crystal` lathe and the per-crystal pulse. Gem,
  lantern and heart reuse the pulse.
- **Fox.jsx and Tree.jsx**: the `useKick` pattern with eased tilt and a sine
  sway.

## Build once here, reuse in every later level

1. **`blob` and `cone` in the kit.** Needed by nearly all 50 items.
2. **`usePulse(rate, phase)`.** A 0..1 sine for glow, scale and emissive.
   Used by gem, heart, lantern, rainbow, crystal, windmill glow and many more.
3. **`Burst`.** A small pool of faceted bits that fly out and fade on a tap.
   Heart, star, trophy and mushroom need it now. Volcano, cannon, campfire and
   coin stack need it later. Start from the coin burst in Chest.jsx.
4. **`Ripple`.** An expanding fading ring for map pin and heart. Reused by
   island, iceberg and whale.
5. **`Spin`.** A group that turns at an eased rate and speeds up on a tap.
   Reused by windmill, star, trophy and gem.
