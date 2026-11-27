# 3D world items

Living things and pieces of the natural world, built the same way as the
components in [3d-ideas.md](3d-ideas.md): procedural geometry, painted canvas
textures, every colour exposed as a prop. Each item lists:

- **Interaction**: what the visitor does with it
- **Sound**: an optional sound, off by default, made with the Web Audio API
- **Controls**: the props shown in the library's Customize panel
- **Detail**: the modelling or motion detail that makes it feel alive

## Status

| Built | Item |
| --- | --- |
| ✓ | 1. Butterfly |
| ✓ | 2. Ocean |

---

### 1. Butterfly
- **Interaction:** it perches on a flower, slowly opening and closing its wings while it basks. Click it to take off: it flutters round the flower, rising on each downstroke and banking into turns, and follows the pointer at a distance. Click again and it flies back and lands.
- **Sound:** a faint papery flutter on each wingbeat in flight.
- **Controls:** species (Monarch, Blue Morpho, Swallowtail, Peacock, Cabbage White, Glasswing), flower colour, wingbeat speed, perched or flying.
- **Detail:** four wings, each with its own painted pattern (veins radiating from the root, a border band, spots and eyespots), hinged along the side of the thorax so the roots meet the body with no gap. The forewing overlaps the hindwing and they flap as one coupled pair, so they never pass through each other. A segmented body with a head, large eyes, clubbed antennae, a coiled proboscis and six legs gripping the flower. The Morpho shimmers with iridescence, the Swallowtail has tails and the Glasswing has see-through panels.

### 2. Ocean
- **Interaction:** click the water to send a marker buoy drifting there; it rides the waves, rising, falling and tilting with the surface. Drag to look around.
- **Sound:** none yet (a candidate: a low surf wash that swells with the chop).
- **Controls:** sun elevation and azimuth, exposure, chop, speed, foam, deep colour, scatter colour, buoy on or off, buoy colour, with Dawn, Noon, Sunset and Tropical presets.
- **Detail:** ported from the BattleShip project. Eight Gerstner waves are summed on the GPU over a radial grid, dense near the camera and sparse towards the horizon, under a physical sky that is baked into a cube map for reflections. The water has a Fresnel blend of sky and body colour, light scattering through the crests, a sun glint, whitecap foam where the crests compress, and a darker look from below the surface. The buoy reads the same wave sum on the CPU, so it sits exactly on the drawn surface.
