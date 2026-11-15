# Low poly, level 2: simple

A stack of primitives plus one animated sub-part (a canopy, a blade, a lid).
About 90-150 lines each. Needs the level 1 parts.

## Items

| # | Item | Built from | Idle | Tap |
| --- | --- | --- | --- | --- |
| 2 | Palm tree | Curved trunk segments, frond wedges | Fronds sway | Drops a coconut |
| 3 | Cactus | Capsule arms, flower blob | A flower blooms | Wobbles |
| 6 | Sunflower | Stem, disc, petal ring | Head tracks the cursor | Petals shake |
| 15 | Bonsai | Trunk, pot, canopy blobs | Canopy sways | Drops petals |
| 30 | Windmill | Tapered tower, four blades | Blades spin | Speeds up |
| 29 | Lighthouse | Striped tapered tower, lamp | Beam rotates | Flashes |
| 43 | Street lamp | Pole, arm, glowing bulb | Light flickers | Switches off and on |
| 44 | Snowman | Three blobs, cones, scarf | Scarf flutters | Wobbles |
| 45 | Pumpkin | Ribbed blob, stem, face | Face glows | Flips the expression |
| 32 | Gift box | Box, lid, ribbon bow | Ribbon bounces | Lid pops open |

## Reuse from what exists

- **Tree.jsx**: the tiered sway where each tier lags the one below. Palm,
  bonsai and cactus use the same lag chain with a different tier list.
- **Chest.jsx**: the hinged lid (a group rotated about an edge). Gift box
  uses it unchanged.
- **GrassTile.jsx**: the squash and spring on tap. Snowman and pumpkin use it.
- **CrystalRock.jsx**: emissive pulse for the lamp, lantern and lighthouse.

## Build once here, reuse later

1. **`useSway(tiers, wind)`.** A lag chain of rotations driven by one sine.
   Lifted out of Tree. Reused by palm, bonsai, flag, ribbon, fronds, tails,
   sails and any later hanging part.
2. **`Hinge`.** A pivot group with an eased open and close. Lifted out of
   Chest. Reused by door, trapdoor, wing, ear, jaw and camera shutter.
3. **`Squash(k)`.** Scale that conserves volume, `(1+k, 1-k, 1+k)`. Reused by
   every blob character.
4. **`Beam`.** A faceted cone of light with additive blending. Reused by
   lighthouse, lantern, street lamp and camera flash.
5. **`Face`.** Two eyes, an optional blink and a mouth. Reused by snowman,
   pumpkin, cube character and every animal.
