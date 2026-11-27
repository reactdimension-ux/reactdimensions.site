# 20 ideas for lyric animations

Looks that build on the Lyric Sync component. Every one runs on the same
engine, so none needs new timing code: timed lyrics in the standard `.lrc`
format, per-word progress (`--p`, 0 to 1), the current line, and the
instrumental-gap line. Each idea lists:

- **Look**: what the visitor sees
- **Sync**: which part of the timing drives it
- **Controls**: the props shown in the library's Customize panel
- **Detail**: the thing that makes it feel right, often a timing or easing detail

Every one should also respect reduced motion, stop animating off-screen, keep
the lyrics readable as text (aria labels, no text trapped in a canvas) and
let you click a line to jump to it.

## Status

Already built as looks of Lyric Sync: Apple Music (blur by distance, word
fill), Spotify (line colour, sung lines stay bright) and Karaoke (centred,
the sung word pops). These 20 are new.

Also built, as its own component: Poster Lyrics, flat three-colour poster scenes
where each line is set as a stretched stack, an arch, words around a drawing,
a road in perspective, or a drawing that drives through the words. It is the
starting point for idea 1 (Kinetic pop).

---

## Typographic motion

### 1. Kinetic pop
- **Look:** words slam in at different sizes and angles, like a lyric video; stressed words are huge, small words tuck in around them.
- **Sync:** a word appears at its start time and holds until the line ends; its size comes from a weight written in the lyrics (`<00:12.50>*word*`).
- **Controls:** energy, max size, shake on the beat, palette, layout (centre, stagger, stack).
- **Detail:** words land on a spring with a small overshoot, and the line packs itself into the box so nothing overflows.

### 2. Bouncing ball
- **Look:** the old karaoke ball hops across the line, squashing as it lands on each word, and the word it touches changes colour.
- **Sync:** one hop per word, from the word's start to its end; the arc height follows the word's length.
- **Controls:** ball colour, ball size, hop height, trail, show the ball on the next line while waiting.
- **Detail:** the ball squashes on the way down and stretches on the way up, and it eases across the line break instead of teleporting.

### 3. Neon tubes
- **Look:** lyrics are glowing neon tubing on a dark brick wall; each word switches on as it is sung and the current line buzzes.
- **Sync:** a word lights when its progress passes 0, with a short flicker before it settles.
- **Controls:** tube colour, off colour, glow, flicker, wall (brick, dark, black), font (script, block).
- **Detail:** the unlit tubes keep a faint dark outline, and one letter per line occasionally flickers on its own.

### 4. Cinematic subtitles
- **Look:** film subtitles at the bottom of a widescreen frame over a slow drifting scene, one or two lines at a time.
- **Sync:** the line fades up when it starts and out when it ends; a long gap clears the screen.
- **Controls:** background (gradient, blur, loop), letterbox on or off, font, outline, position.
- **Detail:** the frame breathes (a slow zoom) so a held line never looks frozen, and text gets a soft dark shadow for any background.

### 5. Handwritten pen
- **Look:** a pen writes the lyric in cursive across a paper page as it is sung, then the page turns.
- **Sync:** each word's stroke is drawn from 0 to 100% along its progress, so a long note stretches the stroke.
- **Controls:** pen (ink, pencil, marker), ink colour, paper (lined, plain, craft), slant, page turn.
- **Detail:** the pen lifts between words, and slow words get slightly thicker ink.

## Reacting to the music

### 6. Vinyl groove
- **Look:** the lyric runs along the spiral groove of a spinning record; the line being sung sits at the needle.
- **Sync:** the record turns with the clock, so the current word always arrives at the needle exactly when it is sung.
- **Controls:** record colour, label art, groove spacing, speed, tonearm on or off.
- **Detail:** past lyrics keep spiralling inwards and fade, and the needle drops onto the first line when playback starts.

### 7. Waveform ride
- **Look:** a live waveform runs across the screen and the words sit on it, bobbing with the amplitude.
- **Sync:** a word lifts on the waveform from its start to its end; the wave is driven by a small Web Audio synth, with no audio files.
- **Controls:** wave style (line, bars, filled), amplitude, colour, mirror, sound (off by default).
- **Detail:** letters are displaced by the wave under them, so a long word ripples rather than moving as a block.

### 8. Equalizer bars
- **Look:** a row of equalizer bars behind the lyric, and each word stands on the bar that rises while it is sung.
- **Sync:** the bar for the current word jumps to full height at its start and decays by its end; nearby bars follow with a lag.
- **Controls:** bar count, bar colour, gap, glow, idle motion, peak caps.
- **Detail:** bars never sit at zero (a gentle idle wobble), and peak caps fall slowly like a real analyser.

### 9. Piano roll
- **Look:** words are notes on a piano roll with a playhead sweeping across; higher notes sit higher, like a karaoke pitch lane.
- **Sync:** each word is a bar from its start to its end; the bar fills as it is sung. Pitch comes from an optional `<pitch>` tag, otherwise it is generated.
- **Controls:** lane count, note colour, scale (major, minor, pentatonic), playhead, labels.
- **Detail:** notes round their corners and glow while sung, and a score line ticks up when you hit the gap, for a karaoke feel.

## Stage and scene

### 10. Spotlight sweep
- **Look:** a dark stage; a spotlight beam sweeps across the line, and only the words it touches are lit.
- **Sync:** the beam follows the word progress, so it speeds up and slows down with the singer.
- **Controls:** beam width, softness, colour, haze, backdrop (curtain, brick, black).
- **Detail:** the beam is a soft cone with haze, and words that have been lit stay faintly visible instead of dropping back to black.

### 11. LED dot-matrix marquee
- **Look:** a stadium scoreboard of round LEDs scrolling the lyric from right to left.
- **Sync:** the sung word is centred and bright; the scroll speed adapts so each word crosses the centre exactly on its time.
- **Controls:** LED size, spacing, on and off colours, rows, scroll direction, scanline.
- **Detail:** glyphs are real pixel fonts, and bright LEDs bleed a little light into their neighbours.

### 12. Bubble pop
- **Look:** each word floats up in a soap bubble; when it is sung the bubble pops and the word settles into the line.
- **Sync:** the bubble rises before the word's start and pops exactly at it, with a tiny splash.
- **Controls:** bubble tint, size, drift, pop sound (off by default), rainbow sheen.
- **Detail:** bubbles wobble, reflect a window, and pop with a ring of droplets.

### 13. Burn away
- **Look:** upcoming lines sit as clean text; as each word is sung it chars and burns away into drifting embers.
- **Sync:** the burn front moves across a word with its progress, so the burn is the highlight.
- **Controls:** flame colour, ember amount, burn width, paper or black background, smoke.
- **Detail:** burnt edges glow orange before going black, and the ashes of a finished line rise and fade.

### 14. Cylinder carousel
- **Look:** lyrics are wrapped around a rotating 3D cylinder, with the current line facing the viewer.
- **Sync:** the cylinder turns one step per line, with a spring, and the fill runs along the line facing you.
- **Controls:** cylinder radius, tilt, perspective, line spacing, backface (hide, dim).
- **Detail:** lines at the back are blurred and tiny, and the turn overshoots slightly before it settles.

### 15. Star Wars crawl
- **Look:** the lyrics scroll away into space in perspective, tilted, over a star field.
- **Sync:** the crawl speed is set by the clock, so the sung line passes a marker line at its time.
- **Controls:** tilt, speed, colour, stars, title card, fade distance.
- **Detail:** text shrinks and fades towards the vanishing point, and the sung line is outlined as it passes the marker.

### 16. Album ring
- **Look:** the lyric runs around the edge of a circular album cover, turning like a record label.
- **Sync:** the ring rotates so the current word is always at the top; the fill follows the arc.
- **Controls:** radius, cover art, direction, cover spin, font size.
- **Detail:** letters are placed along the arc one by one so spacing stays even at any radius.

## Easy to follow, easy to share

### 17. Ransom-note cut-outs
- **Look:** each word is a different cut-out of paper and magazine letters, taped crooked onto a page.
- **Sync:** a word is stuck down at its start time, with a small drop-and-tape animation.
- **Controls:** paper tone, tape, tilt amount, font mix, shadow, page colour.
- **Detail:** each word's styling is chosen from its letters, so the same word always looks the same.

### 18. Duet chat bubbles
- **Look:** an iMessage-style conversation: two singers alternate on left and right, each line a bubble that types in.
- **Sync:** the typing dots show during the previous line's end; the bubble pops in at its start and fills word by word.
- **Controls:** singer names, bubble colours, avatar, read receipts, sounds (off by default).
- **Detail:** an optional `[A]` / `[B]` prefix on each lyric line assigns the singer, and shared lines span both sides.

### 19. Rhyme tints and notes
- **Look:** words that rhyme share a colour across the whole song, and tapping a word opens a small note about it.
- **Sync:** rhymes light up as they are sung, and earlier rhymes of the same sound pulse once to show the link.
- **Controls:** palette, rhyme sensitivity, notes (on, off), underline style, legend.
- **Detail:** rhyme groups come from the end sounds of line-final words, and notes are an optional `{note}` tag in the lyrics.

### 20. Translation pairs
- **Look:** each line is shown with a smaller second line under it (a translation or romanisation) that fills in step.
- **Sync:** the original fills word by word; the second line fills across the same time, scaled to its own length.
- **Controls:** second line style (translation, romanisation, both), size, colour, show only on the current line.
- **Detail:** timings for the second line are optional: without them it fills evenly, so any pasted translation works.

---

Start with 1 (Kinetic pop), 3 (Neon tubes) and 6 (Vinyl groove): they look the
most different from what is already built, and need no new timing data.
