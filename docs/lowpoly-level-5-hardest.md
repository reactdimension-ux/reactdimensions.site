# Low poly, level 5: hardest

Rigged animals with a body, limbs, a head and a tail, each with an idle
cycle and a tap action. About 250-500 lines each. Fox.jsx (173 lines) is the
simple version of this; the hidden Tiger.jsx (525 lines) and Runner.jsx
(325 lines) are the full versions. Needs every earlier level.

## Items

| # | Item | Body plan | Idle | Tap |
| --- | --- | --- | --- | --- |
| 16 | Penguin | Biped, flippers | Waddles in place | Flaps its flippers |
| 17 | Owl | Biped, wings, big head | Blinks and swivels its head | Hoot puff |
| 18 | Bunny | Quadruped, ears | Ears twitch | Hops |
| 19 | Fish | Tapered body, fins | Swims a loop | Darts |
| 20 | Turtle | Quadruped, shell | Shell bobs | Pulls its head in |
| 21 | Bee | Body, four wings | Hovers with buzzing wings | Loops |
| 22 | Whale | Long body, flukes | Tail rolls | Blows a spout |
| 23 | Frog | Crouching quadruped | Throat pulses | Jumps |
| 24 | Elephant | Quadruped, trunk, ears | Trunk swings | Sprays water |
| 25 | Dino | Biped, tail, jaw | Tail sways | Roars with a head throw |

## Reuse from what exists

- **Fox.jsx**: the whole recipe. Breathing by scaling the torso, a blink on a
  timer, ears twitching on their own beat, a head that turns and tilts, a tail
  swish and a tap that eases a tilt in. Bunny, owl, frog and dino start as a
  copy of Fox with a new body list.
- **Runner.jsx**: `limb`, `block` and `wedge` for limbs that hang from a
  joint, and the pose blend for a limb cycle. Penguin, dino and bunny legs use
  these.
- **Tiger.jsx**: the quadruped gait. Elephant and turtle reuse it.

## Build once here, reuse later

1. **`Rig`.** A bone tree description (name, parent, pivot) that builds the
   nested groups and returns a ref map, so scenes stop hand-writing
   `set('thigh0')` and the nested groups. Cuts each animal by about a third.
2. **`Gait(phases)`.** A leg cycle for two and four legs, with a stride
   phase that accumulates so a speed change never jumps the pose. Lifted out
   of Runner and Tiger. Reused by every walker.
3. **`Breathe`, `Blink`, `LookAround`, `EarTwitch`.** The Fox idle behaviours
   as small hooks, each with its own phase offset so nothing syncs.
4. **`Wing(flapRate)`.** A hinged wing pair with a flap and fold. Reused by
   bee, owl, butterfly, bat and any bird.
5. **`Tail(segments)`.** The lag chain with a sine travelling down it.
   Reused by fox, dino, whale, fish and cat.

## Build order across all five levels

Build level 1 first and finish the five shared parts it lists. Each later
level then adds its own shared parts on top, so by level 5 an animal is a
body list, a palette and a few hooks.
