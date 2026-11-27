# 100 ideas for new 3D components

Ideas that suit the dimensions-ui style: procedural geometry, one or two
physical interactions, every colour exposed as a prop. Each idea lists:

- **Interaction**: what the visitor does with it
- **Sound**: an optional sound, off by default, made in the browser with the
  Web Audio API (no audio files), the way the turntable makes its sound
- **Controls**: the props shown in the library's Customize panel
- **Detail**: the modelling or physics detail that makes it feel real, often a
  joint or contact that has to be right

Every component should also take `autoRotate`, respect reduced motion, and
dispose of its geometry, materials and textures.

## Status

| Built | Component |
| --- | --- |
| ✓ | 1. Mechanical keyboard |
| ✓ | 2. Lighter |
| ✓ | 3. Pocket knife |
| ✓ | 4. Tape measure |
| ✓ | 8. Analog alarm clock |
| ✓ | 9. Desk lamp |
| ✓ | 68. Newton's cradle |
| ✓ | Typewriter (extra, not one of the 100) |
| ✓ | Dice (extra: rigid-body physics, no physics library) |
| ✓ | Ladder (extra: friction statics against a wall, checked against the textbook slip angle) |
| ✓ | Shirt (extra: cloth simulation, buttons as constraints, oxford, poplin, linen and denim) |
| ✓ | Earbuds (extra: a magnet-and-detent lid, buds that drop as rigid bodies and dock by magnet, charging) |

Already in the library but not on this list: clear-coat card, pickup, snake,
turntable, vinyl record, sunglasses, watch, laptop, glass bottle, TV, phone,
headphones, tablet bot and tablet.

---

## Everyday objects with a satisfying moving part

### 1. Mechanical keyboard ✓
- **Interaction:** click or type on your real keyboard and the matching key presses down; hold Shift to see modifiers light.
- **Sound:** a switch click per key, with tactile, linear and clicky profiles.
- **Controls:** layout (60%, TKL, full), switch type, keycap colour, legend colour, case colour, RGB on or off, RGB effect.
- **Detail:** keycaps on a sculpted row profile, so each row has its own tilt, and the stabilised space bar rocks on its wire.

### 2. Lighter ✓
- **Interaction:** click to flip the lid open, drag down on the wheel to strike, click again to snap it shut and kill the flame.
- **Sound:** the metallic clink of the lid and a flint scratch.
- **Controls:** finish (brushed, polished, black, brass), engraving text, flame size, wind.
- **Detail:** the lid turns on a hinge with a cam spring, so it snaps to fully open or shut, and the flame is a soft shader that leans with wind.

### 3. Pocket knife ✓
- **Interaction:** click a tool to swing it out; drag it to any angle and it snaps to closed, half-stop or open.
- **Sound:** a firm click at each detent.
- **Controls:** number of tools, scale colour, steel finish, blade shape.
- **Detail:** tools pivot on a shared rivet and nest in separate liners, so they never pass through each other when closed.

### 4. Tape measure ✓
- **Interaction:** drag the hook out to pull the blade; release and it reels back, or press the lock to hold it.
- **Sound:** a fast ratchet buzz on retraction and a thunk when the hook hits the case.
- **Controls:** case colour, blade colour, units (metric or imperial), lock on or off.
- **Detail:** the blade has a concave cross-section and sags under its own weight past a point, then buckles.

### 5. Combination padlock
- **Interaction:** drag each dial to spin it; the shackle pops when the code is right.
- **Sound:** a tick per number and a spring snap on unlock.
- **Controls:** code (the props hold it), number of dials, body colour, shackle finish.
- **Detail:** the shackle rises on a spring and turns 180° to free one leg, which is the joint most models get wrong.

### 6. Stapler
- **Interaction:** press down to staple a sheet; pull the top back to open it for reloading.
- **Sound:** a crunch on the press and a click on the return.
- **Controls:** body colour, open angle, paper on or off.
- **Detail:** the staple folds over the anvil and the spring returns the arm, and the paper shows the folded legs on its back.

### 7. Fountain pen
- **Interaction:** click to uncap; drag the cap onto the back of the barrel to post it; write a squiggle on the paper beneath.
- **Sound:** a soft friction click when the cap seats.
- **Controls:** barrel colour, trim (gold, silver, black), nib size, ink colour.
- **Detail:** a two-tone nib with a slit and breather hole, and a clip that flexes slightly as the cap slides on.

### 8. Analog alarm clock ✓
- **Interaction:** drag the hands to set a time; set the alarm hand and it rings when the time comes; tap the top to stop it.
- **Sound:** a ticking second hand and a hammer ringing between two bells.
- **Controls:** case colour, dial style, live time, alarm time, bell finish.
- **Detail:** the hammer swings between the bells and the whole clock judders across the surface while ringing.

### 9. Desk lamp ✓
- **Interaction:** drag the head and the arm segments to pose it; click the switch to turn it on.
- **Sound:** a click on the switch.
- **Controls:** body colour, light colour and brightness, arm length.
- **Detail:** a balanced arm with visible springs that stretch as the joints bend, and real light that falls on the desk.

### 10. Watch box
- **Interaction:** click to open the lid; click a cushion to lift a watch out.
- **Sound:** a soft velvet thud on close.
- **Controls:** number of slots, wood or leather, lining colour, glass lid on or off.
- **Detail:** the lid rests on a stay that stops at an angle, and the cushions compress slightly when a watch is pressed in.

## Kitchen and drink

### 11. Espresso machine
- **Interaction:** twist the portafilter to lock it, press the button to pull a shot, swing the steam wand out.
- **Sound:** the pump hum, the drip into the cup, and the hiss of steam.
- **Controls:** body colour, cup size, shot length, steam on or off.
- **Detail:** the portafilter's bayonet lugs turn into the group head, and crema builds up in the cup as it fills.

### 12. Moka pot
- **Interaction:** drag the top to unscrew it; the three parts come apart and stack back.
- **Sound:** a thread creak and a gurgle as it brews.
- **Controls:** finish (aluminium, steel, coloured), size in cups, brewing on or off.
- **Detail:** an eight-sided body with real threads, so unscrewing turns and rises together.

### 13. Chef's knife
- **Interaction:** drag it off the magnetic strip; draw it along the honing rod.
- **Sound:** the snap onto the magnet and the ring of steel on steel.
- **Controls:** blade style (Western, Japanese), handle wood, steel finish, Damascus pattern.
- **Detail:** a distal taper and a ground edge that catches a thin line of light.

### 14. Beer can
- **Interaction:** pull the tab up to crack it open; tilt it to pour.
- **Sound:** the crack and fizz on opening.
- **Controls:** can colour, label text, size, condensation amount.
- **Detail:** the tab levers on its rivet and pushes the scored flap in, and the condensation uses the same beads as the bottle.

### 15. Wine glass
- **Interaction:** drag to swirl the wine; tilt to see the level stay flat.
- **Sound:** a ring when you tap the rim.
- **Controls:** glass shape, wine colour, fill level, glass tint.
- **Detail:** the liquid surface stays level as the glass tilts, and wine legs run down the inside after a swirl.

### 16. Cast-iron pan
- **Interaction:** drag to slide it; click to drop an egg in and watch it fry.
- **Sound:** a sizzle while the egg cooks.
- **Controls:** seasoning sheen, size, handle style, heat on or off.
- **Detail:** a slightly rough, mottled surface with a real pour spout in the rim.

### 17. Toaster
- **Interaction:** press the lever to lower the bread; it glows, then the toast pops up.
- **Sound:** the lever click, a ticking timer and the pop.
- **Controls:** body colour, browning level, number of slots.
- **Detail:** the elements glow orange inside the slots, and the toast colour follows the browning level.

### 18. Kettle
- **Interaction:** flick the switch on; steam builds and it clicks off at the boil.
- **Sound:** rising rumble and a whistle that climbs in pitch.
- **Controls:** body colour, finish, whistle on or off.
- **Detail:** a hinged lid on the spout, and steam that curls up and drifts.

## Electronics and gadgets

### 19. Game controller
- **Interaction:** press the buttons, tilt the sticks, squeeze the triggers; it can also follow your real gamepad.
- **Sound:** soft clicks per button.
- **Controls:** shell colour, button colours, transparent shell, light bar colour.
- **Detail:** sticks that tilt on a ball joint and return to centre on a spring, and triggers with real travel.

### 20. Film camera
- **Interaction:** wind the lever, press the shutter, turn the zoom ring.
- **Sound:** the winder ratchet and a crisp shutter release.
- **Controls:** body colour, leatherette pattern, lens length, film counter.
- **Detail:** the shutter blades open and close behind the lens, and the frame counter advances one each wind.

### 21. Handheld console
- **Interaction:** open the clamshell and play a tiny game with the arrow keys.
- **Sound:** chiptune blips from the game.
- **Controls:** shell colour, screen palette, hinge angle.
- **Detail:** a friction hinge that holds the screen at any angle, and a screen that is a live canvas texture.

### 22. Earbuds in a case
- **Interaction:** flip the lid; lift an earbud out and it snaps back on the magnets.
- **Sound:** the magnetic snap of the lid.
- **Controls:** finish (gloss, matte), colour, LED colour.
- **Detail:** the earbuds seat into shaped wells, and a status light pulses while charging.

### 23. Retro radio
- **Interaction:** turn the tuning knob to slide the needle across the dial.
- **Sound:** static between stations and a tone that clears when tuned in.
- **Controls:** cabinet wood, grille fabric, dial colour, volume.
- **Detail:** the glow of a backlit dial and a speaker cloth with a woven texture.

### 24. Smart speaker
- **Interaction:** tap to wake it; the light ring reacts to sound.
- **Sound:** a chime on wake and a sample voice line.
- **Controls:** fabric colour, ring colour, volume.
- **Detail:** a knit fabric sleeve and a light ring that pulses to the audio level.

### 25. E-reader
- **Interaction:** swipe to turn the page with a curl.
- **Sound:** a quiet paper whisper on each turn.
- **Controls:** case colour, font size, page text, front light warmth.
- **Detail:** the page curl is a bent mesh that follows the drag, and the screen has an E Ink grain.

### 26. Walkie-talkie
- **Interaction:** hold the push-to-talk button; the antenna wobbles as you move it.
- **Sound:** a squelch beep and static.
- **Controls:** body colour, channel number, antenna length.
- **Detail:** a flexible rubber antenna that bends and springs back.

## Vehicles and machines

### 27. Bicycle
- **Interaction:** drag the pedals to turn the crank; the chain drives the back wheel, which keeps freewheeling.
- **Sound:** a freewheel tick.
- **Controls:** frame colour, wheel size, gear (changes the ratio), tyre colour.
- **Detail:** a chain whose links travel the real path round both sprockets.

### 28. Skateboard
- **Interaction:** click for a kickflip; drag a wheel to spin it.
- **Sound:** the clack of landing and a wheel roll.
- **Controls:** deck graphic colours, grip tape, wheel colour, truck finish.
- **Detail:** trucks that pivot on bushings so the board leans and the wheels steer.

### 29. Drone
- **Interaction:** click to spin up the props and take off; it follows the pointer and hovers.
- **Sound:** a rising rotor whine.
- **Controls:** body colour, prop colour, camera gimbal on or off.
- **Detail:** the body tilts into the direction of travel, and the props blur when fast.

### 30. Toy train
- **Interaction:** click to start or stop it on a looped track; drag to change speed.
- **Sound:** wheel clatter on the rail joins and a whistle.
- **Controls:** number of carriages, engine colour, track shape.
- **Detail:** couplers that keep each carriage on the curve, and wheels that turn by distance.

### 31. Kick scooter
- **Interaction:** click the latch to fold the stem down.
- **Sound:** a latch clack.
- **Controls:** deck colour, grip colour, wheel colour, folded or open.
- **Detail:** a folding joint whose latch has to clear the stem before it can swing.

### 32. Lawn mower
- **Interaction:** push it across the grass; the cut path stays shorter behind it.
- **Sound:** an engine hum.
- **Controls:** body colour, cut height, grass colour.
- **Detail:** instanced grass blades that shorten as the deck passes over them.

### 33. Gramophone
- **Interaction:** turn the crank to wind it, then lower the needle.
- **Sound:** a crackly record that slows as the spring runs down.
- **Controls:** horn finish, cabinet wood, record label colour.
- **Detail:** the spring's wind drives the speed, so it slows naturally.

### 34. Sewing machine
- **Interaction:** turn the handwheel or press the pedal; the needle goes up and down and the fabric feeds.
- **Sound:** a rhythmic chatter.
- **Controls:** body colour, thread colour, stitch length.
- **Detail:** the take-up lever and needle bar move in step, and stitches appear in the fabric.

## Furniture and home

### 35. Office chair
- **Interaction:** drag to spin it, pull the lever to change height, lean back to tilt.
- **Sound:** a gas-lift hiss.
- **Controls:** fabric colour, frame colour, height, armrests on or off.
- **Detail:** a five-star base whose casters swivel to trail the direction of spin.

### 36. Venetian blinds
- **Interaction:** pull the cord to raise them, twist the wand to tilt the slats.
- **Sound:** a slat rattle.
- **Controls:** slat colour, slat width, light colour outside.
- **Detail:** light through the slats casts moving stripes across the floor.

### 37. Chest of drawers
- **Interaction:** click a drawer to pull it out; folded cloth sits inside.
- **Sound:** a wooden slide and a soft close.
- **Controls:** wood, handle style, number of drawers.
- **Detail:** drawers stop on a stop block rather than coming all the way out.

### 38. Folding chair
- **Interaction:** click to fold it flat or open it.
- **Sound:** a metallic clack.
- **Controls:** frame colour, seat material.
- **Detail:** a four-bar linkage, so the seat and legs move together correctly.

### 39. Door
- **Interaction:** press the handle to free the latch, then drag to swing the door.
- **Sound:** a latch click and a creak.
- **Controls:** door colour, handle finish, opening direction.
- **Detail:** the latch bolt retracts only while the handle is down, and the door stops on its frame.

### 40. Ceiling fan
- **Interaction:** pull the chain to step through speeds.
- **Sound:** a hum that rises with speed.
- **Controls:** blade wood, motor finish, light on or off.
- **Detail:** the blades blur at speed and the light kit hangs below on its own fitting.

## Sports and play

### 41. Rubik's cube
- **Interaction:** drag a face to turn it; a button scrambles or solves it.
- **Sound:** a plastic click per turn.
- **Controls:** sticker colours, size (2 to 5), stickerless body.
- **Detail:** the face turn snaps to 90°, and each cubie keeps its own colours through any sequence.

### 42. Chess set
- **Interaction:** drag a piece to a legal square; captured pieces go to a tray.
- **Sound:** a wooden tap when a piece lands.
- **Controls:** board wood, piece colours, piece style.
- **Detail:** pieces lift on an arc and lean slightly as they move.

### 43. Basketball
- **Interaction:** click to bounce it; drag to spin it on a finger.
- **Sound:** a bounce thud with an echo.
- **Controls:** colour, seam colour, pressure (bounce height).
- **Detail:** pebbled grain and seams, and a slight squash at each bounce.

### 44. Dumbbell
- **Interaction:** drag plates on and off the bar; the weight readout updates.
- **Sound:** a clank as the plates touch.
- **Controls:** plate colour, bar finish, plate sizes.
- **Detail:** the collars must be off before a plate can slide.

### 45. Yo-yo
- **Interaction:** click to throw it down; click again to bring it back up.
- **Sound:** a whirr while it sleeps.
- **Controls:** body colour, string colour, string length.
- **Detail:** the string unwinds round the axle, and the yo-yo spins in place before it returns.

### 46. Dartboard
- **Interaction:** click to throw a dart at the pointer; the score adds up.
- **Sound:** a thunk on impact.
- **Controls:** board colours, wire colour, flight colour.
- **Detail:** darts stick at an angle and wobble on impact.

## Nature and soft bodies

### 47. Potted plant
- **Interaction:** drag the growth slider to grow leaves; blow on it (or move the pointer) to sway it.
- **Sound:** a soft rustle.
- **Controls:** leaf colour, pot colour, number of leaves, wind.
- **Detail:** leaves branch with a simple growth rule and bend along their length.

### 48. Hourglass
- **Interaction:** click to flip it; sand runs to the bottom.
- **Sound:** a faint hiss.
- **Controls:** sand colour, frame wood, duration.
- **Detail:** the sand piles into a cone below and forms a dip above.

### 49. Candle
- **Interaction:** click to light it; blow (click again) to put it out with a curl of smoke.
- **Sound:** a puff on blowing out.
- **Controls:** wax colour, height, flame colour.
- **Detail:** the wax melts a pool round the wick and a drip slides down the side.

### 50. Umbrella
- **Interaction:** click to open or close it; rain runs off the canopy.
- **Sound:** a whoosh on opening and rain on the canopy.
- **Controls:** canopy colour, rib count, rain on or off.
- **Detail:** ribs and stretchers fold as a linkage, so the runner slides up the shaft.

## Tools and workshop

### 51. Adjustable wrench
- **Interaction:** drag the worm screw to open or close the jaw.
- **Sound:** a fine thread click.
- **Controls:** finish, size, jaw width.
- **Detail:** the moving jaw slides in a channel driven by the worm.

### 52. Cordless drill
- **Interaction:** squeeze the trigger to spin the chuck; slide the battery out.
- **Sound:** a motor whine that follows the trigger.
- **Controls:** body colour, bit type, speed, direction.
- **Detail:** the chuck jaws close round the bit as you turn the collar.

### 53. Tape dispenser
- **Interaction:** drag the tape out and tear it on the teeth.
- **Sound:** a peel and a tear.
- **Controls:** body colour, tape colour, roll size.
- **Detail:** the roll shrinks as tape is pulled.

### 54. Spirit level
- **Interaction:** drag to tilt it; the bubble follows.
- **Sound:** none by default.
- **Controls:** body colour, vial colour, length.
- **Detail:** the bubble lags slightly, like a real liquid.

### 55. Bench vice
- **Interaction:** turn the handle to close the jaws on a block.
- **Sound:** a thread creak.
- **Controls:** body colour, jaw width, block on or off.
- **Detail:** the handle slides through the screw head and drops to one end.

### 56. Soldering iron
- **Interaction:** click to heat it; the tip glows and smoke rises.
- **Sound:** a crackle when touched to solder.
- **Controls:** handle colour, tip shape, temperature.
- **Detail:** the tip colour follows the temperature, from silver to dull orange.

### 57. Calipers
- **Interaction:** drag the jaw; the readout shows the measurement live.
- **Sound:** a quiet slide.
- **Controls:** digital or vernier, units, finish.
- **Detail:** the vernier scale lines up correctly for the reading.

### 58. Hand plane
- **Interaction:** drag it along a board; a shaving curls off.
- **Sound:** a hiss of cutting wood.
- **Controls:** body finish, tote wood, board wood, cut depth.
- **Detail:** the shaving curls as a growing spiral.

## Music

### 59. Electric guitar
- **Interaction:** drag across the strings to strum; push the tremolo arm.
- **Sound:** a plucked string tone per string.
- **Controls:** body colour, pickguard, fretboard wood, string count.
- **Detail:** strings vibrate with a visible blur, and the tremolo bends their pitch.

### 60. Metronome
- **Interaction:** slide the weight to change the tempo; click to start or stop.
- **Sound:** a tick each beat, with an accent on the first beat of the bar.
- **Controls:** tempo, beats per bar, wood or lacquer, colours, sound on or off.
- **Detail:** a pyramid body whose hinged front cover opens to reveal the pendulum.

### 61. Piano keys
- **Interaction:** click or type to play keys; open the lid.
- **Sound:** a piano-like tone per key.
- **Controls:** number of octaves, finish, lid open.
- **Detail:** black and white keys pivot at the back with the right travel.

### 62. Drum kit
- **Interaction:** click a drum or cymbal to hit it; press the pedal for the kick.
- **Sound:** a synthesised hit per piece.
- **Controls:** shell colour, hardware finish, number of toms.
- **Detail:** cymbals wobble on their stands and drum heads ripple.

### 63. Harmonica
- **Interaction:** move along it and click to play a hole.
- **Sound:** a reed tone per hole, blow or draw.
- **Controls:** cover finish, key, comb colour.
- **Detail:** the reed slots light as each one sounds.

### 64. Music box
- **Interaction:** turn the crank; the drum pins pluck the comb.
- **Sound:** a simple tune, faster as you crank faster.
- **Controls:** box wood, tune, glass lid.
- **Detail:** each tooth deflects and springs back when a pin passes.

### 65. Cassette tape
- **Interaction:** click play; the reels turn and the tape moves.
- **Sound:** a tape hiss.
- **Controls:** shell colour, label text, label colour.
- **Detail:** one reel grows as the other shrinks, so their speeds differ.

### 66. Trumpet
- **Interaction:** press the valves; blow to play.
- **Sound:** a brass tone that changes with the valves.
- **Controls:** finish (brass, silver, black), size.
- **Detail:** the valve pistons travel and the tubing path is correct.

## Toys and collectibles

### 67. Spinning top
- **Interaction:** pull the cord to launch it; it wobbles as it slows.
- **Sound:** a whirr.
- **Controls:** colour, pattern, spin strength.
- **Detail:** precession: the axis circles as the spin drops.

### 68. Newton's cradle ✓
- **Interaction:** drag an end ball, or several, and let go.
- **Sound:** a click per impact (not built yet).
- **Controls:** ball count, string length, damping, colours, frame finish.
- **Detail:** pendulum physics with elastic collisions, so lifting N balls sends N balls out.

### 69. Wind-up robot
- **Interaction:** turn the key to wind it; it walks until the spring runs down.
- **Sound:** the ratchet click and a clockwork whirr.
- **Controls:** body colour, eye colour, walk speed.
- **Detail:** the walk slows as the spring unwinds.

### 70. Nesting dolls
- **Interaction:** click to open a doll and reveal the next.
- **Sound:** a wooden pop.
- **Controls:** number of dolls, painted colours.
- **Detail:** each half is a lathe with a lip, so the halves seat together.

### 71. Snow globe
- **Interaction:** drag to shake it; snow swirls and settles.
- **Sound:** a soft swish.
- **Controls:** scene, base colour, snow amount.
- **Detail:** particles settle slowly, with the glass refracting the scene.

### 72. Kaleidoscope
- **Interaction:** drag to turn the tube; the pattern shifts.
- **Sound:** a tumble of beads.
- **Controls:** bead colours, mirror count, tube finish.
- **Detail:** the image is a real mirror reflection of tumbling beads.

### 73. Fidget spinner
- **Interaction:** flick it to spin; it slows down.
- **Sound:** a bearing whirr.
- **Controls:** colour, number of arms, finish.
- **Detail:** bearings with visible balls and a spin-down curve.

### 74. Jack-in-the-box
- **Interaction:** turn the crank; at the end of the tune the lid flies open.
- **Sound:** a music-box tune and a pop.
- **Controls:** box colours, jack colours.
- **Detail:** the spring compresses inside and the jack bobs as it settles.

## Bags, wear and personal

### 75. Backpack
- **Interaction:** drag the zip to open the main pocket; adjust the straps.
- **Sound:** a zip rasp.
- **Controls:** fabric colour, zip colour, strap colour.
- **Detail:** the zip pull follows the zip path and the fabric gapes as it opens.

### 76. Sneaker
- **Interaction:** click to tie the laces; drag to flex the sole.
- **Sound:** a squeak.
- **Controls:** upper, sole, lace and logo colours.
- **Detail:** laces follow the eyelets, and the sole bends at the ball of the foot.

### 77. Wallet
- **Interaction:** click to open it; cards fan out.
- **Sound:** a leather creak.
- **Controls:** leather colour, stitching colour, card colours.
- **Detail:** the fold bends with a real radius instead of a sharp crease.

### 78. Ring
- **Interaction:** drag to turn it; the gem throws coloured light.
- **Sound:** none by default.
- **Controls:** metal, gem colour, cut, size.
- **Detail:** the gem disperses light into colours and the prongs hold it.

### 79. Belt
- **Interaction:** drag the strap through the buckle and choose a hole.
- **Sound:** the buckle clink.
- **Controls:** leather colour, buckle finish.
- **Detail:** the prong drops into the hole and the strap curves round.

### 80. Baseball cap
- **Interaction:** drag the brim to bend it; snap the back closure.
- **Sound:** a snap.
- **Controls:** crown, brim and button colours, logo text.
- **Detail:** six panels meet at the button, with stitched seams.

### 81. Lipstick
- **Interaction:** twist the base; the bullet rises.
- **Sound:** a faint click.
- **Controls:** case finish, lipstick colour.
- **Detail:** the bullet rises on a helical track as you twist.

### 82. Perfume bottle
- **Interaction:** press the pump to puff a mist.
- **Sound:** a soft spritz.
- **Controls:** glass tint, liquid level, cap finish.
- **Detail:** the dip tube shows through the glass and the liquid refracts it.

## Architecture and spaces

### 83. Spiral staircase
- **Interaction:** drag the number of treads and the turn.
- **Sound:** none by default.
- **Controls:** treads, turn, rise, material.
- **Detail:** the handrail follows a smooth helix and the treads meet the column.

### 84. Revolving door
- **Interaction:** drag to push it round.
- **Sound:** a rubber brush sweep.
- **Controls:** number of wings, glass tint, frame finish.
- **Detail:** the wings seal against the drum walls as they pass.

### 85. Elevator cabin
- **Interaction:** press a floor button; the doors close, it rides, they open.
- **Sound:** a ding and a hum.
- **Controls:** finish, floor count, panel style.
- **Detail:** two-speed doors where the inner panel moves twice as far.

### 86. Bookshelf
- **Interaction:** tip a book out to read its spine.
- **Sound:** a book slide.
- **Controls:** shelf wood, book colours, number of shelves.
- **Detail:** books lean and settle against their neighbours.

### 87. Sash window
- **Interaction:** slide the sash up; draw the curtains.
- **Sound:** a wooden slide.
- **Controls:** frame colour, curtain colour, outside view.
- **Detail:** counterweights in the frame move opposite to the sash.

### 88. Garden gate
- **Interaction:** lift the latch and push it open; it swings back closed.
- **Sound:** a latch clank and a creak.
- **Controls:** wood or iron, colour, spring strength.
- **Detail:** a self-closing spring that brings it back and catches the latch.

### 89. Phone booth
- **Interaction:** click to fold the door open.
- **Sound:** a door creak.
- **Controls:** paint colour, lit or unlit.
- **Detail:** a folding door on a pivot and a guide track.

### 90. Tent
- **Interaction:** click to pitch it from the bag.
- **Sound:** a fabric flutter.
- **Controls:** fabric colour, number of poles, guy lines on or off.
- **Detail:** poles bend into arcs and the fabric tensions between them.

## Science and instruments

### 91. Globe
- **Interaction:** drag to spin it on its tilted axis.
- **Sound:** a soft whirr.
- **Controls:** map style, stand finish, day and night shading.
- **Detail:** a meridian ring holds the axis at 23.4°.

### 92. Telescope
- **Interaction:** drag to point it; turn the focus knob to sharpen the view.
- **Sound:** a fine focus click.
- **Controls:** tube colour, tripod finish, sky view.
- **Detail:** an eyepiece view that blurs or sharpens with focus.

### 93. Microscope
- **Interaction:** turn the nosepiece to change lens; move the stage.
- **Sound:** a click as a lens seats.
- **Controls:** body colour, specimen, light.
- **Detail:** the objectives turn on a rotating turret and click into place.

### 94. Barometer
- **Interaction:** drag the pressure slider; the needle follows.
- **Sound:** none by default.
- **Controls:** case wood, dial style.
- **Detail:** the needle overshoots slightly and settles.

### 95. Balance scale
- **Interaction:** drag weights onto the pans; the beam tips.
- **Sound:** a metallic clink.
- **Controls:** finish, weight set.
- **Detail:** the pans hang level on their chains as the beam tips.

### 96. Pendulum clock
- **Interaction:** watch the escapement tick; drag the pendulum bob to change the rate.
- **Sound:** a tick-tock.
- **Controls:** case wood, dial style, pendulum length.
- **Detail:** the escapement releases one tooth per swing.

### 97. Compass
- **Interaction:** orbit the camera; the needle keeps pointing north.
- **Sound:** none by default.
- **Controls:** case finish, rose style.
- **Detail:** the needle wobbles and settles as the case turns.

### 98. Prism
- **Interaction:** drag the light beam; it splits into a spectrum.
- **Sound:** none by default.
- **Controls:** beam colour, prism material.
- **Detail:** the spread follows the angle of the beam.

## Food

### 99. Burger
- **Interaction:** click to stack or unstack the layers.
- **Sound:** a soft squish.
- **Controls:** layers, bun colour, extras.
- **Detail:** layers squash slightly under the weight above.

### 100. Layer cake
- **Interaction:** drag out a slice; blow out the candle.
- **Sound:** a puff when blown out.
- **Controls:** sponge and frosting colours, layers, candle on or off.
- **Detail:** the slice shows its layers on the cut faces.
