# Low poly 3: 50 more ideas for low-poly components

The next 50, continuing from [lowpoly.md](lowpoly.md) (1-50) and
[lowpoly-2.md](lowpoly-2.md) (51-100), all built. None repeats an existing
component or an item from those lists. They follow the same pattern: faceted
primitives built with `facet`, `Flat`, `Stage`, `useGeo` and `useKick` from
`src/lowpoly/kit.jsx`, and each has:

- **Idle**: a motion that runs on its own, so the shot is never still
- **Tap**: a reaction when the visitor clicks it

Every component takes `autoRotate`, `float` and `background`, plus a colour or
variant select, and a thin wrapper in `src/lib/` lazy-loads the scene.

The **Level** column uses the same scale as before:

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
| 101 | Dandelion | Thin stem, faceted seed-head sphere | 1 | Sways in a light breeze | Seeds blow off and drift away, then regrow |
| 102 | Fern | Curled fronds made of tapered leaf strips | 2 | One frond slowly unfurls from a spiral | All fronds curl up, then open again |
| 103 | Desert rock arch | Two stacked boulder columns, a bent slab span | 2 | Sun shadow sweeps under the arch | A tumbleweed rolls through the gap |
| 104 | Venus flytrap | Pot, stem, two hinged toothed jaws | 3 | Jaws open and close slightly, breathing | A fly buzzes in and the jaws snap shut |
| 105 | Snowy pine patch | Three cone-stack pines, snow-capped ground disc | 3 | Light snowfall | Snow slides off a branch with a puff |
| 106 | Mangrove | Arched root legs, blob canopy, water disc | 3 | Water laps around the roots | A fish jumps between the roots |
| 107 | Sea stack with gulls | Tall faceted rock, foam ring, gulls | 4 | Waves break at the base, gulls circle | The gulls scatter and land again |
| 108 | Rice terraces | Stepped curved paddies on a hillside | 4 | Water ripples on each step | Water fills down the steps one by one |

## Animals

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 109 | Ladybug | Dome shell halves, spotted, small head | 2 | Crawls in a small circle on a leaf | Shell opens, wings flap, flies off and lands back |
| 110 | Pufferfish | Faceted sphere body, fins, cone spikes | 3 | Hovers, fins flutter | Inflates into a spiky ball, then deflates |
| 111 | Seahorse | Curled lathe body, snout, dorsal fin | 3 | Bobs upright, tail curls and uncurls | Spins round a strand of seagrass |
| 112 | Stag beetle | Segmented body, big hinged mandibles | 3 | Antennae twitch, mandibles open slowly | Rears up and clacks its mandibles |
| 113 | Manta ray | One wide flat body with wing tips | 4 | Glides with slow wing waves | Does a barrel roll |
| 114 | Axolotl | Soft body, frilly gill stalks, stubby legs | 4 | Gills wave, tail sways | Smiles and swims a little loop |
| 115 | Chameleon | Curled tail, cone eyes on a branch | 5 | Eyes roll in different directions | Tongue shoots out; body colour shifts |
| 116 | Sloth | Long arms hooked over a branch | 5 | Very slow blink and head turn | Slowly waves one arm |
| 117 | Peacock | Body, neck, folded tail of feather blades | 5 | Pecks, head bobs | Tail fans open with shimmering eye spots |
| 118 | Red panda | Round body, striped ringed tail, mask face | 5 | Tail curls, ears flick | Stands up on hind legs and raises its arms |

## Food and kitchen

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 119 | Watermelon slice | Faceted wedge, rind, seeds | 1 | Gently rocks | A bite is taken out with a squash |
| 120 | Pancake stack | Stacked discs, butter cube, syrup | 2 | Syrup drips down the side | The top pancake flips |
| 121 | Sushi plate | Slab plate, rice blocks with toppings | 2 | Plate turns slowly | Chopsticks pick up one piece |
| 122 | Toaster | Rounded box, slots, lever | 3 | Heat shimmer from the slots | Toast pops up and falls back |
| 123 | Teapot | Lathe body, spout, lid, cup | 3 | Steam curls from the spout | Tilts and pours into the cup |
| 124 | Ramen bowl | Bowl, broth disc, noodles, egg, chopsticks | 4 | Steam rises, broth shimmers | Chopsticks lift a noodle pull |
| 125 | Popcorn machine | Glass cart, kettle, kernels | 4 | Kernels pop now and then | Burst of popcorn overflows the kettle |

## Vehicles and travel

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 126 | Scooter | Curved body, two small wheels, handlebar | 3 | Idles with a small shake | Wheelie, then rolls on |
| 127 | Cable car | Cabin, hanger arm, wire, two towers | 3 | Glides along the wire and back | Cabin swings as it stops |
| 128 | Canal gondola | Long curved boat, gondolier with oar | 3 | Gondolier rows, boat rocks | Gondola turns under a small bridge |
| 129 | Hovercraft | Boat body, air skirt, rear fans | 3 | Hovers with spray, fans spin | Spins on the spot |
| 130 | Bullet train | Long nose cone car, track segment | 3 | Sits humming, lights pulse | Shoots past in a blur and returns |
| 131 | Monster truck | Small body on huge tyres, springs | 4 | Suspension bounces | Jumps a ramp and lands with a squash |
| 132 | Paddle steamer | Hull, chimneys, side paddle wheel | 4 | Paddle wheel turns, smoke puffs | Horn sounds with a big smoke ring |
| 133 | Lunar rover | Frame, mesh wheels, antenna, crater ground | 4 | Wheels creep over bumps | Antenna dish turns and beams a signal |

## Buildings and places

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 134 | Water tower | Tank on four legs, ladder | 2 | Small drip from the tank | Tank sloshes and a leak sprays |
| 135 | Beach huts | Row of three striped huts on sand | 2 | Flags flutter on the roofs | One door swings open |
| 136 | Clock tower | Tall block tower, clock faces, belfry | 3 | Hands tick round | The bell swings and rings |
| 137 | Bakery | Shop front, striped awning, bread in the window | 3 | Warm smoke from the chimney | Door opens, a loaf pops out on a tray |
| 138 | Observatory | Dome on a drum, slit, telescope | 4 | Dome slowly turns | Slit opens, telescope tilts up, stars twinkle |
| 139 | Stone bridge | Arched block bridge, stream below | 4 | Water flows under the arch | A boat drifts under it |
| 140 | Drive-in cinema | Big screen, a few cars, projector beam | 4 | Screen flickers through colours | Headlights flash and the film changes |

## Objects and gadgets

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 141 | Metronome | Pyramid body, swinging arm | 1 | Arm ticks side to side | Tempo speeds up, then settles |
| 142 | Desk fan | Base, neck, cage, blades | 2 | Blades spin, head oscillates | Speed jumps up and a paper flies off |
| 143 | Gramophone | Box base, record, flared horn | 3 | Record spins, notes float out | Needle drops with a sparkle of notes |
| 144 | Music box | Hinged lid box, small dancer | 3 | Lid opens a crack, dancer turns | Lid opens fully and the dancer spins |
| 145 | Sewing machine | Body arm, wheel, needle, fabric | 4 | Needle bobs, wheel turns | Fabric feeds through, leaving a stitched line |

## Fantasy and space

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 146 | Comet | Faceted icy head, particle tail | 2 | Streaks slowly with a glowing tail | Tail flares bright and long |
| 147 | Dragon egg nest | Spotted egg in a twig nest | 3 | Egg wobbles and glows | Cracks open and a tiny dragon peeks out |
| 148 | Wizard tower | Crooked stacked tower, cone roof, orb | 4 | Windows glow, orb floats | Sparks spiral up and fireworks burst |
| 149 | Black hole | Dark sphere, accretion disk of particles | 4 | Disk swirls and bends light | Pulls in a passing asteroid |
| 150 | Mech walker | Box body, two jointed legs, cockpit | 5 | Shifts weight, cockpit scans | Takes a few heavy steps with ground thumps |

## New kit parts these need

- **Inflate**: scale a body with spikes popping out along normals (pufferfish).
- **Unfurl**: a spiral strip that winds open over time (fern, chameleon tail).
- **Tongue / extend**: a part that shoots out along a line and snaps back (chameleon, flytrap fly).
- **Pop**: small objects launched with gravity and squash on landing (toaster, popcorn, monster truck).
- **Fill steps**: water planes that rise one after another (rice terraces).
- **Colour shift**: blend a material between palettes on cue (chameleon, observatory sky).

## Status

| Built | Component |
| --- | --- |
| ✓ | Level 1: Dandelion (101), Watermelon Slice (119), Metronome (141) |
| ✓ | Level 2: Fern (102), Desert Rock Arch (103), Ladybug (109), Pancake Stack (120), Sushi Plate (121), Water Tower (134), Beach Huts (135), Desk Fan (142), Comet (146) |
| ✓ | Level 3: Venus Flytrap (104), Snowy Pine Patch (105), Mangrove (106), Pufferfish (110), Seahorse (111), Stag Beetle (112), Toaster (122), Teapot (123), Scooter (126), Cable Car (127), Canal Gondola (128), Hovercraft (129), Bullet Train (130), Clock Tower (136), Bakery (137), Gramophone (143), Music Box (144), Dragon Egg Nest (147) |
| ✓ | Level 4: Sea Stack (107), Rice Terraces (108), Manta Ray (113), Axolotl (114), Ramen Bowl (124), Popcorn Machine (125), Monster Truck (131), Paddle Steamer (132), Lunar Rover (133), Observatory (138), Stone Bridge (139), Drive-in Cinema (140), Sewing Machine (145), Wizard Tower (148), Black Hole (149) |
| ✓ | Level 5: Chameleon (115), Sloth (116), Peacock (117), Red Panda (118), Mech Walker (150) |

All 50 built (2026-11-16).
