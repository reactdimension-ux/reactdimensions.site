# Low poly 4: 50 more ideas for low-poly components

The next 50, continuing from [lowpoly.md](lowpoly.md) (1-50),
[lowpoly-2.md](lowpoly-2.md) (51-100) and [lowpoly-3.md](lowpoly-3.md)
(101-150), all built. None repeats an existing component or an item from those
lists or from [3d-ideas.md](../3d/3d-ideas.md). They follow the same pattern:
faceted primitives built with `facet`, `Flat`, `Stage`, `useGeo` and `useKick`
from `src/lowpoly/kit.jsx`, and each has:

- **Idle**: a motion that runs on its own, so the shot is never still
- **Tap**: a reaction when the visitor clicks it

Every component takes `autoRotate`, `float` and `background`, plus a `look`
select with three or four colour schemes, and a thin wrapper in `src/lib/`
lazy-loads the scene.

The **Level** column uses the same scale as before:

| Level | Meaning | Examples there |
| --- | --- | --- |
| 1 | One or two primitives, one loop, one kick | Dandelion, Metronome, Gem |
| 2 | A few stacked parts, one moving part | Fern, Desk Fan, Water Tower |
| 3 | Several parts with their own motions, or simple particles | Teapot, Cable Car, Clock Tower |
| 4 | Mechanisms, liquids or many particles | Rice Terraces, Popcorn Machine, Black Hole |
| 5 | A rigged animal (body, limbs and head on their own pivots) | Red Panda, Sloth, Peacock |

## Nature

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 151 | Pine cone | Stacked rings of scale plates | 1 | Turns slowly, scales catch the light | Scales open out and a few seeds spin down |
| 152 | Tulip bed | A row of stems with cupped flower heads in a planter | 2 | Heads nod in a breeze | The tulips open wide one after another, then close |
| 153 | Succulent garden | Rosettes of thick leaves in a shallow bowl with pebbles | 2 | Rosettes breathe very slightly | One rosette sends up a stalk and blooms |
| 154 | Sand dune | Curved dune with a sharp crest and ripple lines | 3 | Ripples creep across the slope | A gust lifts a streamer of sand off the crest |
| 155 | Weeping willow | Trunk with a curtain of hanging strands by a pond | 3 | Strands sway, the pond shimmers | A gust ripples through the curtain and onto the water |
| 156 | Storm cloud | Dark puffy cloud over a tree on a hill | 3 | Rain falls in streaks | Lightning strikes the tree with a flash and a puff of smoke |
| 157 | Glacier | Blue-white ice tongue running down to a dark sea | 4 | Meltwater trickles off the face | A chunk calves off and splashes into the sea |
| 158 | Cave | Rock mouth with stalactites and stalagmites | 4 | Drips fall and ripple in a pool | A swarm of bats pours out and circles back in |

## Animals

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 159 | Starfish | One five-armed faceted star on a rock | 1 | Arm tips curl and uncurl in turn | Flips over and back with a little hop |
| 160 | Caterpillar | Chain of round segments with tiny legs on a leaf | 3 | Inches along the leaf in waves | Curls into a ball, then uncurls |
| 161 | Dragonfly | Long thin body, four clear wings, big eyes, on a reed | 3 | Wings shimmer while it perches | Darts off in a zigzag and lands back |
| 162 | Narwhal | Mottled whale body with a long spiral tusk, in a water patch | 4 | Swims a slow lap with tail beats | Breaches out of the water with a splash |
| 163 | Beaver lodge | Beaver, stick dam and pond | 4 | Beaver gnaws a log, chips fly | Slaps its tail on the water with a big splash |
| 164 | Kangaroo | Upright body, long tail, big hind legs, joey in pouch | 5 | Twitches ears, the joey peeks out | Takes one huge bounding hop and lands back |
| 165 | Sea otter | Floating on its back in kelp, holding a shell | 5 | Bobs and taps the shell on its chest | Spins over in the water and floats back up |
| 166 | Meerkat | Slim upright body on a sandy burrow mound | 5 | Stands sentry, head turning | Ducks down into the burrow and pops back up |
| 167 | Capybara | Barrel body, blunt head, sitting in a hot spring with an orange on its head | 5 | Eyes half closed, steam rises | A slow yawn, the orange wobbles |
| 168 | Armadillo | Banded shell, small head, long tail | 5 | Snuffles along the ground | Rolls into a ball, rolls a short way and unrolls |

## Food and kitchen

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 169 | Pizza slice | One wedge with crust, cheese and pepperoni | 1 | Turns slowly, steam rises | The tip pulls away with a stretching cheese string |
| 170 | Taco | Folded shell with filling and toppings | 2 | Rocks on its side | Toppings bounce up and settle back in |
| 171 | Cookie jar | Lidded jar of cookies | 2 | A crumb falls now and then | The lid pops off and a cookie hops out and back |
| 172 | Boba tea | Clear cup, tea layers, pearls, wide straw | 3 | Pearls drift and settle | The straw slurps a few pearls up the tube |
| 173 | Birthday cake | Tiered cake with candles and flames | 3 | Flames flicker | Candles blow out with smoke, then relight |
| 174 | Waffle iron | Hinged iron with a grid and a waffle | 3 | Steam leaks from the seam | The lid opens and the waffle pops out and lands back |
| 175 | Hot pot | Split pot of bubbling broth on a burner with ingredients | 4 | Broth bubbles on both sides | Ingredients drop in with splashes and bob |

## Vehicles and travel

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 176 | Penny-farthing | Huge front wheel, tiny back wheel, saddle | 2 | Rocks slightly on its wheels | Rolls forward a turn and back with a bell ding |
| 177 | Kayak | Long boat with a paddler and double paddle on water | 2 | Paddler strokes, the boat rocks | Rolls right over and comes back up |
| 178 | Tuk-tuk | Three-wheeled cab with a canopy | 3 | Idles with a shake and exhaust puffs | Horn toots and it zips round a small circle |
| 179 | Seaplane | High-wing plane on two floats on water | 3 | Floats bob, propeller ticks over | Takes off, flies a loop and lands with a splash |
| 180 | Airship | Long envelope, gondola, tail fins, propellers | 3 | Drifts with props turning | Searchlight sweeps and the ship dips its nose |
| 181 | Snowmobile | Body on skis and a rear track in snow | 3 | Engine idles, snow flicks from the track | Launches over a bump with a spray of snow |
| 182 | Fire engine | Truck with a turntable ladder and hose | 4 | Lights flash | Ladder extends and the hose sprays a water arc |
| 183 | Excavator | Tracked body, boom, arm and bucket by a dirt pile | 4 | Cab sways, bucket scrapes | Digs a scoop, swings round and dumps it |

## Buildings and places

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 184 | Lemonade stand | Small wooden stand, sign, jug and cups | 2 | Sign sways, a fly loops the jug | Lemonade pours into a cup and a coin drops in the tin |
| 185 | Phone box | Upright booth with glass panels and a handset | 2 | Interior light hums | The phone rings, the box shakes and the light flashes |
| 186 | Greenhouse | Glass house with plant beds | 3 | Misting haze inside | Sprinklers spray and the flowers open |
| 187 | Mini golf hole | Green with a bumper, ramp and flag hole | 3 | Flag flutters | A ball putts round the bumper and drops in |
| 188 | Bus stop | Shelter, bench, sign and a puddle in the rain | 3 | Rain falls and ripples the puddle | An umbrella pops open and a small bus pulls in and out |
| 189 | Fishing pier | Wooden pier on stilts with a rod and a bobber | 4 | Bobber bobs, water laps the stilts | The rod bends and a fish flips out of the water |
| 190 | Carousel | Round canopy, poles, horses on a turning base | 4 | Turns slowly, horses rise and fall | Lights chase and it spins up, then slows |

## Objects and gadgets

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 191 | Paper boat | One folded-paper boat on a puddle | 1 | Bobs and turns slowly | Tips over and rights itself with a ripple |
| 192 | Pinwheel | Four curled vanes on a stick | 2 | Turns slowly in the breeze | A gust spins it into a blur |
| 193 | Ship in a bottle | Glass bottle on a stand with a little ship and painted waves | 3 | The ship rocks on its waves | The bottle rocks and the ship sails across inside |
| 194 | Lava lamp | Tapered glass, base, cap, wax blobs | 3 | Blobs rise, split and sink | The lamp brightens and the blobs speed up |
| 195 | Rotary phone | Body, dial, coiled cord, handset | 3 | The dial creeps round now and then | It rings and the handset jumps on its cradle |

## Fantasy and space

| # | Item | Built from | Level | Idle | Tap |
| --- | --- | --- | --- | --- | --- |
| 196 | Satellite | Body box, solar panels, dish | 2 | Turns slowly, panels catch the light | Panels unfold wider and the dish pings a signal |
| 197 | Cauldron | Pot on legs over a fire, bubbling brew | 3 | Bubbles pop, green steam rises | A puff of smoke and a burst of sparkles |
| 198 | Genie lamp | Oil lamp with spout and lid on a cushion | 3 | A wisp curls from the spout | A swirl of smoke rises with stars, then sinks back |
| 199 | Fairy mushroom house | Big mushroom with a door, windows and a path | 4 | Windows glow, fireflies drift | The door opens and fireflies stream out and back |
| 200 | Unicorn | Horse body, mane, tail, spiral horn | 5 | Tosses its mane and paws the ground | Rears up, the horn sparkles and a small rainbow arcs |

## New kit parts these need

- **Open out**: rings of plates that splay on cue (pine cone, tulips, satellite panels).
- **Curtain**: many thin hanging strands that sway and ripple together (willow, carousel lights).
- **Swarm**: a flock of small flapping shapes following a loop (bats, fireflies).
- **Stretch string**: a stretchy line between two moving points (pizza cheese, boba straw).
- **Calve**: a chunk that breaks off a mesh and falls with a splash (glacier).
- **Roll up**: a segmented body that curls into a ball (caterpillar, armadillo).

## Status

| Built | Component |
| --- | --- |
| | Level 1: Pine Cone (151), Starfish (159), Pizza Slice (169), Paper Boat (191) |
| | Level 2: Tulip Bed (152), Succulent Garden (153), Taco (170), Cookie Jar (171), Penny-farthing (176), Kayak (177), Lemonade Stand (184), Phone Box (185), Pinwheel (192), Satellite (196) |
| | Level 3: Sand Dune (154), Weeping Willow (155), Storm Cloud (156), Caterpillar (160), Dragonfly (161), Boba Tea (172), Birthday Cake (173), Waffle Iron (174), Tuk-tuk (178), Seaplane (179), Airship (180), Snowmobile (181), Greenhouse (186), Mini Golf Hole (187), Bus Stop (188), Ship in a Bottle (193), Lava Lamp (194), Rotary Phone (195), Cauldron (197), Genie Lamp (198) |
| | Level 4: Glacier (157), Cave (158), Narwhal (162), Beaver Lodge (163), Hot Pot (175), Fire Engine (182), Excavator (183), Fishing Pier (189), Carousel (190), Fairy Mushroom House (199) |
| | Level 5: Kangaroo (164), Sea Otter (165), Meerkat (166), Capybara (167), Armadillo (168), Unicorn (200) |

None built yet.
