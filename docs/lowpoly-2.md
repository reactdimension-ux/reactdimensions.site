# Low poly 2: 50 more ideas for low-poly components

The next 50 for the Motion Graphics section, continuing from
[lowpoly.md](lowpoly.md) (items 1-50, all built). None repeats an existing
component. They follow the same pattern: faceted primitives built with
`facet`, `Flat`, `Stage`, `useGeo` and `useKick` from `src/lowpoly/kit.jsx`,
and each has:

- **Idle**: a motion that runs on its own, so the shot is never still
- **Tap**: a reaction when the visitor clicks it

Every component takes `autoRotate`, `float` and `background`, plus a colour or
variant select, and a thin wrapper in `src/lib/` lazy-loads the scene.

The **Level** column uses the same scale as the first set:

| Level | Meaning | Examples there |
| --- | --- | --- |
| 1 | One or two primitives, one loop, one kick | Gem, Heart, Star |
| 2 | A few stacked parts, one moving part | Palm Tree, Windmill, Snowman |
| 3 | Several parts with their own motions, or simple particles | Campfire, Cottage, Rocket |
| 4 | Mechanisms, liquids or many particles | Volcano, Hourglass, Coin Stack |
| 5 | A rigged animal (body, limbs and head on their own pivots) | Penguin, Elephant, Dino |

## Nature

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 51 | Cherry blossom tree | Twisted trunk, pink blob canopy | 3 | Petals drift down | A gust sends a swirl of petals |
| 52 | Autumn maple | Trunk, orange and red blob crown | 3 | A leaf falls now and then | Shakes out a flurry of leaves |
| 53 | Bamboo grove | Segmented cylinders, blade leaves | 2 | Stalks sway out of step | Stalks clack together and settle |
| 54 | Lily pond | Disc water, pads, one lotus | 3 | Pads bob, ripples spread | The lotus opens |
| 55 | Geyser | Rock rim, pool, steam puffs | 3 | Steam curls up | Erupts in a column of water |
| 56 | Tornado | Stacked spinning rings | 3 | Funnel spins and wanders | Picks up debris and flings it |
| 57 | Moon | Faceted sphere with crater dimples | 1 | Turns slowly through its phases | A meteor strikes and leaves a puff |
| 58 | Ringed planet | Sphere, flat ring of rocks | 2 | Ring rocks orbit | A small moon swings round |
| 59 | Coral reef | Branch cones, fans, an anemone | 3 | Anemone fronds sway | Tiny fish dart out and back |
| 60 | Aurora hills | Faceted hills, ribbon strips | 4 | Ribbons ripple across the sky | Ribbons flare brighter |

## Animals

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 61 | Crab | Flat body, eye stalks, legs, claws | 5 | Scuttles sideways and back | Snaps both claws |
| 62 | Octopus | Blob head, eight tapered tentacles | 5 | Tentacles wave in a wave pattern | Squirts an ink puff and jets up |
| 63 | Jellyfish | Bell lathe, ribbon tentacles | 4 | Bell pulses, it drifts upward | Glows and pulses fast |
| 64 | Flamingo | Pink body, S-neck, one leg tucked | 5 | Balances on one leg, sways | Swaps legs and flaps |
| 65 | Butterfly | Body, four flat wings | 3 | Wings open and close slowly | Flies a figure-eight and lands |
| 66 | Snail | Spiral shell lathe, soft body | 4 | Glides, eye stalks wobble | Pulls into its shell |
| 67 | Hedgehog | Blob body, cone spines | 5 | Snuffles, nose twitches | Curls into a spiky ball and rolls |
| 68 | Parrot | Bright body, hooked beak, long tail | 5 | Bobs its head on a perch | Squawks, feathers ruffle |
| 69 | Deer | Slim body, long legs, antlers | 5 | Grazes, ears flick | Lifts its head and bounds away and back |
| 70 | Hummingbird | Small body, long beak, blurred wings | 4 | Hovers with buzzing wings | Zips to a flower and back |

## Objects

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 71 | Robot | Box body, head, antenna, arms | 3 | Antenna light blinks, head turns | Waves an arm |
| 72 | Alarm clock | Drum body, two bells, hands | 2 | Hands tick round | Rings and rattles across the table |
| 73 | Rubber duck | Blob body and head, beak | 1 | Bobs on a little water disc | Squashes with a squeak ring |
| 74 | Cupcake | Fluted cup, swirl icing, candle | 2 | Candle flame flickers | Sprinkles burst out |
| 75 | Ice cream cone | Cone, stacked scoops | 2 | A drip runs down | Top scoop wobbles and nearly falls |
| 76 | Coffee mug | Cylinder mug, handle, liquid disc | 2 | Steam curls | A spoon stirs a swirl |
| 77 | Light bulb | Glass blob, screw base, filament | 1 | Filament glows softly | Switches on with a bright burst |
| 78 | Lock and key | Padlock body, shackle, key | 3 | Key hovers and turns | Unlocks, the shackle pops up |
| 79 | Compass | Disc case, glass, needle | 2 | Needle seeks and settles | Spins wildly, then points north |
| 80 | Anchor | Shank, stock, flukes, chain links | 3 | Sways on its chain | Drops and kicks up a sand puff |
| 81 | Umbrella | Faceted canopy, curved handle | 3 | Raindrops run off the edge | Opens and spins, flinging drops |
| 82 | Arcade joystick | Box base, stick, buttons | 2 | Stick wiggles, buttons glow in turn | All buttons flash |

## Vehicles

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 83 | Steam train | Boiler, cab, wheels, a ring of track | 4 | Chugs round the loop puffing smoke | Whistles a burst of steam |
| 84 | Submarine | Capsule hull, tower, periscope | 3 | Periscope turns, it rises and sinks | Dives with a trail of bubbles |
| 85 | UFO | Saucer lathe, dome, rim lights | 3 | Hovers, rim lights chase | A beam lifts a cow and drops it back |
| 86 | Biplane | Fuselage, two wings, propeller | 3 | Propeller spins, it banks gently | Barrel roll |
| 87 | Tractor | Big rear wheels, cab, exhaust | 3 | Wheels turn, exhaust puffs | Pops a wheelie |
| 88 | Food truck | Box van, awning, serving hatch | 3 | Awning flaps | Hatch opens, a sign pops up |
| 89 | Rowboat | Hull, two oars, water disc | 2 | Rocks on the water | Oars pull a stroke and it glides |
| 90 | Space station | Core module, panels, docking ring | 4 | Ring turns, panels track the light | A capsule docks |

## Scenes and props

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 91 | Barn and silo | Gable barn, silo, weathervane | 3 | Weathervane turns | Barn doors swing open |
| 92 | Igloo | Block dome, tunnel, snow base | 2 | Snow falls | A penguin pokes its head out |
| 93 | Treehouse | Trunk, platform, hut, rope swing | 4 | Swing sways, leaves rustle | Windows light up, a ladder drops |
| 94 | Wishing well | Stone ring, roof, bucket and rope | 3 | Bucket bobs on the rope | A coin drops and splashes |
| 95 | Fountain | Tiered basins, water arcs | 4 | Water arcs fall in a loop | Jets surge higher |
| 96 | Torii gate | Two posts, curved beams, lanterns | 2 | Lanterns sway | A swirl of petals blows through |
| 97 | Pagoda | Stacked tiers with upturned eaves | 3 | Wind chimes swing | Lights glow tier by tier |
| 98 | Mailbox | Post, rounded box, flag | 1 | Flag twitches | Lid opens, a letter pops out |
| 99 | Haunted house | Crooked house, bare tree, fence | 4 | A ghost peeks from a window | Bats burst from the roof |
| 100 | Tiny planet | Small globe with a house and trees | 4 | Planet turns under the house | Clouds circle, a day-night flip |

## By level

| Level | Items | Count |
| --- | --- | --- |
| 1 | Moon, Rubber Duck, Light Bulb, Mailbox | 4 |
| 2 | Bamboo Grove, Ringed Planet, Alarm Clock, Cupcake, Ice Cream Cone, Coffee Mug, Compass, Arcade Joystick, Rowboat, Igloo, Torii Gate | 11 |
| 3 | Cherry Blossom, Autumn Maple, Lily Pond, Geyser, Tornado, Coral Reef, Butterfly, Robot, Lock and Key, Anchor, Umbrella, Submarine, UFO, Biplane, Tractor, Food Truck, Barn and Silo, Wishing Well, Pagoda | 19 |
| 4 | Aurora Hills, Jellyfish, Snail, Hummingbird, Steam Train, Space Station, Treehouse, Fountain, Haunted House, Tiny Planet | 10 |
| 5 | Crab, Octopus, Flamingo, Hedgehog, Parrot, Deer | 6 |

## Reuse from what exists

- **kit.jsx**: `facet`, `Flat`, `Stage`, `useGeo`, `useKick` and `rng`, as in
  the first set.
- **Particles** from Campfire, Volcano and Waterfall drive the petals (51),
  leaves (52), steam and spray (55, 76, 83, 95), snow (92), sprinkles (74),
  bubbles (84) and bats (99).
- **Water discs and ripples** from Island and Sailboat carry the duck (73),
  lily pond (54), rowboat (89) and well (94).
- **Lathe shapes** from Potion and Hourglass give the jellyfish bell (63),
  snail shell (66), UFO saucer (85), cupcake (74) and fountain basins (95).
- **Rigs** from Penguin, Owl and Elephant are the starting point for the
  level-5 animals; the Bee's wing blur gives the hummingbird (70) and
  butterfly (65) their wings.
- **Trees** from Pine, Palm and Bonsai give the cherry, maple, treehouse and
  tiny-planet trees; the Cottage's door and chimney smoke give the barn,
  igloo and haunted house their reactions.

## New shared parts worth adding to the kit

- **Ribbon**: a strip of quads that waves along its length (aurora, jellyfish
  tentacles, octopus arms, flags).
- **Orbit**: a group that carries children round a centre at a given speed
  (ringed planet, space station, tiny planet clouds, steam train).
- **Track loop**: a closed path with position and heading at any distance
  along it (steam train, butterfly figure-eight, hummingbird dart).

## Status

| Built | Component |
| --- | --- |
| | None yet |
