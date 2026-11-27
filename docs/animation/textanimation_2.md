# 50 more text animation ideas

A second set, after `text-ideas.md` (all 50 of those are built). None of these
repeat an effect the library already has. Each one names the mechanism that
would make it feel real, since the library's rule is that things move the way
the real object does.

## Particles and matter

1. Sand: letters made of grains that pour away through a neck and pile up again as the next word (granular flow with an angle of repose)
2. Iron filings: scattered specks that swing into line along a magnet's field and gather into letters as the pointer magnet comes near
3. Smoke: the word drifts apart into smoke that the pointer stirs (a small fluid simulation carrying the ink)
4. Shatter: click and the text cracks from that point into shards that fall, then fly back together (Voronoi fracture, rigid pieces)
5. Soap bubbles: each letter floats inside a bubble that wobbles, drifts on air currents and pops when touched
6. Jelly: soft-body letters that wobble and jiggle when poked and settle slowly (spring-mass mesh)
7. Autumn leaves: a gust blows a pile of leaves into the shape of the word, and the next gust scatters them
8. Dominoes: the letters stand as dominoes and topple in a chain from wherever you tip the first one

## Heat, water and weather

9. Frost: ice crystals grow across cold glass into the letters; the pointer's warmth melts a path through them
10. Fogged glass: write on a steamed window with your finger, and drips run down from the strokes
11. Burning paper: the letters char in from an ember edge that eats across the page, leaving glowing outlines
12. Rain on a window: the text sits behind glass, sharp only through the drops that slide down it (each drop is a tiny lens)
13. Thermal camera: the word shows only where the pointer has warmed it, and cools away as the heat spreads
14. Reflection on water: the word stands at the edge of a pond and its mirror image ripples when you touch the surface
15. Wet ink in rain: drops land on fresh lettering and each one blooms into a soft-edged run

## Light and optics

16. Shadow type: the letters themselves are invisible; you read them from the shadows they cast as a light moves round
17. Caustics: text lying on a pool floor under the moving bright network that waves focus onto it
18. Hologram foil: a rainbow sheen that slides and changes colour with viewing angle (thin-film diffraction)
19. Projector beam: the word projected through dusty air, pulled in and out of focus, with a keystone tilt
20. Light painting: a glowing point traces the letters in the dark and leaves a fading long-exposure trail
21. Anamorphic: floating fragments that only line up into the word from one viewing angle as you orbit
22. ~~Laser engraving: a beam scans the text into wood line by line, with sparks, a scorch halo and a wisp of smoke~~ **(discontinued)**
23. Glow in the dark: shine the pointer on the text to charge it, then watch it fade the way phosphor does
24. Prism: white text passes through a prism and fans out into its spectrum, recombining when you move it away
25. Moiré: two fine line gratings slide over each other and the word appears in the interference bands

## Machines and displays

26. Flip-dot sign: a bus-destination board of magnetic discs that flip black to yellow with a clatter
27. Nixie tubes: stacked wire digits glowing orange behind a mesh inside glass, with the unlit ones faintly visible
28. ~~Label maker: an embossing tape that clicks out one raised white letter at a time and feeds forward~~ **(discontinued)**
29. Rubber stamp: thumps down slightly crooked, inks unevenly, and fades over repeated stamps until re-inked
30. Stencil and spray: paint builds up through a stencil with soft overspray at the edges and the odd drip
31. Receipt printer: thermal paper feeds out line by line with a slight curl, and tears off at the serrated edge
32. Pin art: a bed of sliding pins pushes out into the letters as if pressed from behind
33. Peg lights: glowing coloured pegs are plugged into a black board one by one to spell the word
34. Combination lock: rings of letters spin at different speeds and click to a stop, one ring at a time
35. Punched tape: holes punched in a paper strip scroll past a reader that lights the letter each row encodes
36. Sketch toy: a single unbroken line draws the letters by turning two knobs; shake to erase

## Craft and paper

37. Embroidery: a needle stitches the letters into cloth one stitch at a time, the thread pulling the fabric slightly
38. Knitting: the word appears row by row in knitted stitches, like a pattern in a jumper
39. Bricks: the letters are built from toy bricks that snap on from the bottom up
40. Origami: a flat sheet folds itself, crease by crease, into each letter
41. ~~Flipbook: a stack of pages riffles past and the word animates across them~~ **(discontinued)**
42. Ransom note: every letter is a different clipping that slides in, slightly rotated, and gets taped down
43. Scratch card: the text is hidden under silver foil that you scratch away, with flakes falling
44. Fridge magnets: word tiles you can drag about that snap gently into rows and knock each other aside

## Living and natural

45. Murmuration: a flock of birds wheels across the sky and settles into the word, then lifts off again (boids)
46. Vines: the letters grow as branching stems that put out leaves and the occasional flower
47. Constellation: stars fade in, lines join them into letters, and the whole sky turns slowly
48. Fireflies: scattered blinking lights that gradually fall into step with each other and flash the word together
49. Turing pattern: spots and stripes that grow and fill the letter shapes, the way animal markings form

## Motion and maths

50. Pendulum wave: each letter hangs on a string of a different length, so the row swings in and out of step in travelling patterns

## Where to start

The quickest wins reuse parts the library already has: the flip-dot sign and
Nixie tubes build on Split-Flap and Seven Segment; the rubber stamp and label
maker (since discontinued) on Letterpress and Emboss Plate; dominoes and fridge magnets on the
rigid-body solver in Tumble Text; the pendulum wave on the swing in Unfold
Text. The particle ideas (sand, iron filings, murmuration, fireflies) share one
canvas particle loop, so building one makes the next three cheap. Smoke,
caustics and the Turing pattern need a shader or a grid simulation and are the
biggest pieces of work.
