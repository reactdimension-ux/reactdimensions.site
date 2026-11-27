# 50 ideas for new low-poly components

Ideas for the Motion Graphics section, following the existing low-poly set
(pine, fox, treasure chest, grass tile, crystal rock). Each is built from
faceted primitives (cones, icospheres, boxes) with `facet`, `Flat`, `Stage`,
`useGeo` and `useKick` from `src/lowpoly/kit.jsx`, and has:

- **Idle**: a motion that runs on its own, so the shot is never still
- **Tap**: a reaction when the visitor clicks it

Every component takes `autoRotate`, `float` and `background`, plus a colour or
variant select, and a thin wrapper in `src/lib/` lazy-loads the scene.

Effort: items 1-15 and 26-40 are the cheapest (stacked primitives). Animals
(16-25) take longer because each needs a small rig like the fox.

The same 50 items are split by build difficulty, with the shared parts each
level should add for the next:

1. [Level 1, easiest](lowpoly-level-1-easy.md)
2. [Level 2, simple](lowpoly-level-2-simple.md)
3. [Level 3, medium](lowpoly-level-3-medium.md)
4. [Level 4, hard](lowpoly-level-4-hard.md)
5. [Level 5, hardest (rigged animals)](lowpoly-level-5-hardest.md)

The next 50 (items 51-100) are in [Low poly 2](lowpoly-2.md).

## Nature

| # | Item | Idle | Tap |
| --- | --- | --- | --- |
| 1 | Mountain peak | Snow cap shimmers | Small avalanche puff |
| 2 | Palm tree | Fronds sway | Drops a coconut |
| 3 | Cactus | A flower blooms on top | Wobbles |
| 4 | Mushroom cluster | Caps pulse | Releases spore puffs |
| 5 | Flower | Petals open and close | Spins the bloom |
| 6 | Sunflower | Head tracks the cursor | Petals shake |
| 7 | Island | Bobs on water | Sends out a ripple |
| 8 | Waterfall cliff | Faceted water sheet loops down | Splash burst |
| 9 | Volcano | Lava glows | Erupts with rocks |
| 10 | Iceberg | Floats and tilts | Rolls over |
| 11 | Cloud | Drifts | Rains faceted drops |
| 12 | Rainbow arc | Bands ripple in sequence | Bands flare |
| 13 | Campfire | Flames flicker | Throws sparks |
| 14 | Log stump with rings | Rings glow outward | Pops a leaf |
| 15 | Bonsai | Canopy sways | Drops petals |

## Animals

| # | Item | Idle | Tap |
| --- | --- | --- | --- |
| 16 | Penguin | Waddles in place | Flaps its flippers |
| 17 | Owl | Blinks and swivels its head | Hoot puff |
| 18 | Bunny | Ears twitch | Hops |
| 19 | Fish | Swims a loop | Darts |
| 20 | Turtle | Shell bobs | Pulls its head in |
| 21 | Bee | Hovers with buzzing wings | Loops |
| 22 | Whale | Tail rolls | Blows a spout |
| 23 | Frog | Throat pulses | Jumps |
| 24 | Elephant | Trunk swings | Sprays water |
| 25 | Dino | Tail sways | Roars with a head throw |

## Objects

| # | Item | Idle | Tap |
| --- | --- | --- | --- |
| 26 | Rocket | Flame flutters | Launches and resets |
| 27 | Hot air balloon | Rises and sways | Burner flares |
| 28 | Sailboat | Rocks on the swell | Catches the wind |
| 29 | Lighthouse | Beam rotates | Flashes |
| 30 | Windmill | Blades spin | Speeds up |
| 31 | Castle tower | Flags flutter | Cannon puff |
| 32 | Gift box | Ribbon bounces | Lid pops open |
| 33 | Lantern | Glow pulses | Swings |
| 34 | Treasure map pin | Bounces | Ring pulses |
| 35 | Trophy | Spins | Sparkles |
| 36 | Hourglass | Sand falls | Flips |
| 37 | Potion bottle | Liquid sloshes | Bubbles |
| 38 | Camera | Lens iris breathes | Flash |
| 39 | Headphones | Cups pulse to a beat | Beat doubles |
| 40 | Paper plane | Banks and glides | Loops |

## Scenes and props

| # | Item | Idle | Tap |
| --- | --- | --- | --- |
| 41 | Tent and campsite | Fire flickers | Lights a lantern |
| 42 | Cottage | Chimney smoke curls | Opens the door |
| 43 | Street lamp | Light flickers | Switches off and on |
| 44 | Snowman | Scarf flutters | Wobbles |
| 45 | Pumpkin | Face glows | Flips the expression |
| 46 | Gem | Rotates, facets refract | Flashes |
| 47 | Heart | Beats | Ripple of hearts |
| 48 | Star | Spins | Bursts into mini stars |
| 49 | Coin stack | Coins flip in sequence | Fans out |
| 50 | Cube character | Blinks and bounces | Squashes and stretches |

## Status

| Built | Component |
| --- | --- |
| ✓ | Low Poly Pine |
| ✓ | Low Poly Fox |
| ✓ | Low Poly Treasure Chest |
| ✓ | Low Poly Grass Tile |
| ✓ | Low Poly Crystal Rock |
| ✓ | Level 1: Gem, Heart, Star, Flower, Rainbow, Lantern, Map Pin, Trophy, Tree Stump, Mushrooms |
| ✓ | Level 2: Palm Tree, Cactus, Sunflower, Bonsai, Windmill, Lighthouse, Street Lamp, Snowman, Pumpkin, Gift Box |
| ✓ | Level 3: Campfire, Cloud, Mountain, Island, Iceberg, Castle Tower, Campsite, Cottage, Rocket, Paper Plane |
| ✓ | Level 4: Volcano, Waterfall, Hot Air Balloon, Sailboat, Hourglass, Potion, Instant Camera, Headphones, Coin Stack, Cube Buddy |
| ✓ | Level 5: Penguin, Owl, Bunny, Fishbowl, Tortoise, Bee, Whale, Frog, Elephant, Dinosaur |
| ✓ | Extra: Ferris Wheel (real rotor, drive, brake and gondola-pendulum physics) |
| hidden | Low Poly Runner (a man at full sprint) |
| hidden | Low Poly Tiger |
