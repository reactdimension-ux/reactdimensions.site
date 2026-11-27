# 50 text effect ideas

Text components for the library and the landing page, grouped by the feel
they give. The library already has MeasureText (dimension lines) and
DecodeText (scramble reveal); these build out from there. Most are a span
per character plus a transform or a shader, so they stay light.

## Reveals and entrances

1. Typewriter with a blinking caret and variable key delay
2. Letters that fall into place from above with a small bounce
3. Blur-to-sharp: words resolve from a soft blur one at a time
4. Mask wipe: text revealed by a bar sweeping across
5. Split-flap board, like an airport departures display
6. Count-up numbers that tick to a target with easing
7. Unfold: each word swings down from a hinge on its top edge
8. Ink bleed: strokes spread from a point like wet ink
9. Dot-matrix printer that prints the line row by row
10. Handwriting stroke draw along an SVG path

## Hover and pointer

11. Magnetic letters that drift toward the cursor
12. Variable-font weight that swells under the pointer
13. Spotlight: only letters near the cursor are lit
14. Repel: characters scatter from the cursor and spring back
15. Proximity italics: slant follows the pointer's x position
16. Lens: a magnifier bubble follows the cursor over the text
17. Hover swap: each letter flips to an alternate glyph then back
18. Rubber band: drag a word and let it snap back

## Scroll driven

19. Marquee that speeds up with scroll velocity
20. Parallax lines, each layer scrolling at a different rate
21. Sticky headline that shrinks into a nav title on scroll
22. Words that fill with colour as they scroll past the centre
23. Horizontal scrub: a long sentence pans as the page scrolls
24. Skew on scroll: text leans in the scroll direction
25. Stack: lines pile up from the bottom like cards

## Three-dimensional

26. Extruded 3D headline with bevels and studio reflections
27. Text wrapped around a cylinder that you can spin
28. Letters as physical blocks that tumble with physics
29. Neon tube signage with flicker and a glow halo
30. Embossed and debossed labels on a metal plate
31. Text on a ribbon that waves in wind
32. Rotating 3D word cloud orbiting a centre
33. Letterpress: ink pressed into paper with a deep shadow
34. Chrome type with a moving environment reflection
35. Text cut out of a slab with light passing through the holes

## Technical and data

36. Terminal output with prompt, cursor and live stdout
37. Hex dump or code that scrolls with syntax highlights
38. Odometer digits that roll over
39. Seven-segment display with a dimmed "ghost" of unlit segments
40. Ticker tape of live-updating numbers with up and down flashes
41. Timestamped log that appends lines and auto-scrolls
42. Braille, Morse or binary toggle that translates on hover

## Glitch and distortion

43. Chromatic aberration split on hover
44. Scanline CRT text with slight barrel curve
45. Wave displacement: a sine ripple travelling through the baseline
46. Pixel sort on reveal, settling to clean glyphs
47. Liquid: letters melt downward then reform
48. Static burst between word swaps

## Layout and typography play

49. Kinetic poster: words resize to fill the box, justified edge to edge
50. Bilingual flip: each word swaps language on an interval with a cross-fade

## Where to start

The magnetic letters, variable-weight swell and spotlight reuse the pointer
spring from MagneticButton and TiltCard almost directly; the typewriter and
count-up pair well with DecodeText for a consistent landing-page intro.
