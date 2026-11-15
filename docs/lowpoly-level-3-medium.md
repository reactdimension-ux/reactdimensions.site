# Low poly, level 3: medium

Several animated parts, a particle effect or a stretched or merged
geometry. About 150-250 lines each. Needs the level 1 and 2 parts.

## Items

| # | Item | Built from | Idle | Tap |
| --- | --- | --- | --- | --- |
| 13 | Campfire | Log ring, flame cones, ember points | Flames flicker | Throws sparks |
| 11 | Cloud | Merged blobs | Drifts | Rains faceted drops |
| 1 | Mountain peak | Displaced cone, snow cap | Snow cap shimmers | Avalanche puff |
| 7 | Island | Displaced disc, palm, water ring | Bobs on water | Sends out a ripple |
| 10 | Iceberg | Displaced polyhedron, waterline | Floats and tilts | Rolls over |
| 31 | Castle tower | Cylinder, battlements, flag | Flags flutter | Cannon puff |
| 41 | Tent and campsite | Prism tent, log, small fire | Fire flickers | Lights a lantern |
| 42 | Cottage | Box, roof prism, chimney, door | Chimney smoke curls | Opens the door |
| 26 | Rocket | Lathe body, fins, flame | Flame flutters | Launches and resets |
| 40 | Paper plane | Folded planes | Banks and glides | Loops |

## Reuse from what exists

- **Chest.jsx**: the coin burst for sparks, drops and smoke, and the glow
  that spills out for campfire and lighthouse.
- **GrassTile.jsx**: `mergeSimple`, which merges many parts into one geometry
  to cut draw calls. Island, mountain and cloud need it.
- **CrystalRock.jsx**: the glow flare on tap, reused for fire and rocket.
- **kit `facet` with `keep`**: pins a flat base while the top is displaced.
  Mountain, iceberg and island all use it.

## Build once here, reuse later

1. **`Particles`.** A pool with spawn rate, life, gravity, size curve and
   colour curve. Generalises the level 1 `Burst`. Reused by smoke, rain, snow,
   sparks, bubbles, spray and every effect in levels 4 and 5.
2. **`Flame`.** Two or three stacked cones with scale and colour flicker.
   Reused by campfire, tent, rocket, lantern, volcano and balloon burner.
3. **`Terrain(seed, size, height)`.** A faceted displaced disc or cone with a
   flat base. Reused by mountain, island, iceberg, volcano and cliff.
4. **`Water`.** A faceted plane with a slow vertex wave plus the `Ripple`.
   Reused by island, iceberg, sailboat, whale, fish and waterfall.
5. **`Trail`.** A short fading ribbon behind a moving part. Reused by paper
   plane, rocket, bee and fish.
