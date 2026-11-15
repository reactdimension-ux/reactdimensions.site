# Low poly, level 4: hard

Needs a simulated or procedural effect (liquid, flow, stacking, a looping
path) or a character with a squash-and-stretch rig. About 250-400 lines each.
Needs the level 1 to 3 parts.

## Items

| # | Item | Built from | Idle | Tap | Hard part |
| --- | --- | --- | --- | --- | --- |
| 9 | Volcano | Terrain, crater, lava | Lava glows | Erupts with rocks | Ballistic rocks that land back on the slope |
| 8 | Waterfall cliff | Terrain, water sheet | Faceted water sheet loops down | Splash burst | Seamless looping flow and mist |
| 27 | Hot air balloon | Lathe envelope, basket, ropes | Rises and sways | Burner flares | Pendulum basket under a swaying envelope |
| 28 | Sailboat | Hull, mast, sail, water | Rocks on the swell | Catches the wind | Sail cloth and hull riding the water height |
| 36 | Hourglass | Glass lathes, sand | Sand falls | Flips | Sand level shrinking in one bulb and growing in the other |
| 37 | Potion bottle | Glass lathe, liquid, cork | Liquid sloshes | Bubbles | A liquid surface that tilts with the bottle |
| 38 | Camera | Body, lens barrel, iris | Lens iris breathes | Flash | Iris blades and a flash that lights the scene |
| 39 | Headphones | Band, cups | Cups pulse to a beat | Beat doubles | A beat clock shared by every part |
| 49 | Coin stack | Cylinders | Coins flip in sequence | Fans out | Stack of coins on a path with correct contact |
| 50 | Cube character | Box, face, limbs | Blinks and bounces | Squashes and stretches | Squash and stretch without breaking the faces |

## Reuse from what exists

- **Chest.jsx**: coins, their arcs and landing, as the base for coin stack
  and volcano rocks.
- **Runner.jsx (hidden)**: the pose blend (`blendPose`) between two poses,
  which gives the cube character its squash and stretch states.
- **Tree.jsx**: the lag chain for the balloon rope and sail.
- **Stage in kit.jsx**: `hint` and `float` stay the same; only the camera and
  target change for tall items like the balloon.

## Build once here, reuse later

1. **`Liquid(level, tilt)`.** A clipped faceted slab whose top stays level
   under the container's rotation. Reused by potion, hourglass sand, cup and
   bucket.
2. **`Loop(path, speed)`.** A moving texture-free flow along a path, with
   segments recycled at the end. Reused by waterfall, river, conveyor and
   falling sand.
3. **`PathFollower`.** A part that follows a closed curve with banking.
   Reused by paper plane, bee, fish, rocket and any orbiting object.
4. **`Beat(bpm)`.** A shared clock that emits a pulse and a count. Reused by
   headphones, speaker, drum and every rhythm item.
5. **`Cloth(w, h)`.** A grid of vertices pinned at one edge with a sine
   travelling wave. Reused by sail, flag, cape, scarf and banner.

## Status

All ten items are built, in `dimensions-ui/src/lowpoly/` (the camera is
`InstantCamera.jsx`, the cube character `CubeBuddy.jsx`). The shared parts
added to `kit.jsx` for this level:

| Part | Kit export | Used by |
| --- | --- | --- |
| Liquid that stays level, fills by volume and sloshes | `Liquid`, `fillHeight` | Hourglass (sand), Potion |
| Bits flowing along a path, and a strip along it | `Flow`, `ribbonGeo` | Volcano (lava), Waterfall |
| Cloth pinned on one edge, flag or sail | `Cloth` | Sailboat (sails and pennant) |
| Beat clock | `beat` | Headphones |
| Wave height of the Water surface | `waveAt` | Sailboat (riding the waves) |
| Crater terrain and its height profile | `terrainShape` | Volcano, Waterfall |
| Live readout over the canvas | `Readout` | Hot Air Balloon |

The hot air balloon flies on real buoyancy (lift from the air temperature
difference, cooling, drag and an autopilot burner), and the sailboat's
height, pitch and roll come from the water surface it floats on.
