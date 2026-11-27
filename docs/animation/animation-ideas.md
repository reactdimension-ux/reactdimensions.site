# 50 animation ideas

Animations for the library's components, pages and 3D scenes that respond to
the user, grouped by the kind of input that drives them. Existing pieces
already cover click to open or fold, drag to orbit, drag to spin, double-tap to
bounce and keyboard driving; these build out from there. Each should respect
reduced-motion settings and work with touch as well as a mouse.

## Status

All 50 ideas are built; each is a component in the library (slug in
brackets).

| Built | Idea | Component |
| --- | --- | --- |
| ✓ | 1. Peek | Peek Card (`peek-card`) |
| ✓ | 2. Hover scrub | Hover Scrub (`hover-scrub`) |
| ✓ | 3. Cursor trail | Cursor Trail (`cursor-trail`) |
| ✓ | 4. Custom cursor | Morph Cursor (`morph-cursor`) |
| ✓ | 5. Tilt-to-reveal | Tilt Reveal (`tilt-reveal`) |
| ✓ | 6. Proximity glow | Proximity Glow (`proximity-glow`) |
| ✓ | 7. Long-hover tooltip | Long-hover Preview (`long-hover-preview`) |
| ✓ | 8. Edge hover nav | Edge Peek Nav (`edge-peek-nav`) |
| ✓ | 9. Inertia and snap | Inertia Snap (`inertia-snap`) |
| ✓ | 10. Throwable cards | Throw Cards (`throw-cards`) |
| ✓ | 11. Drag to reorder | Drag Reorder (`drag-reorder`) |
| ✓ | 12. Pull-to-refresh | Pull Refresh (`pull-refresh`) |
| ✓ | 13. Over-scroll slider | Rubber Slider (`rubber-slider`) |
| ✓ | 14. Drag the 3D model | Drag Model (`drag-model`) |
| ✓ | 15. Rope | Rope Sway (`rope-sway`) |
| ✓ | 16. Following drawer | Follow Drawer (`follow-drawer`) |
| ✓ | 17. Hold to confirm | Hold Button (`hold-button`) |
| ✓ | 18. Tap ripple | Tap Ripple (`tap-ripple`) |
| ✓ | 19. Tap to cycle presets | Preset Cycle (`preset-cycle`) |
| ✓ | 20. Double-tap to like | Double-tap Like (`double-tap-like`) |
| ✓ | 21. Tap to isolate a part | Isolate Part (`isolate-part`) |
| ✓ | 22. Long-press wobble edit | Wobble Edit (`wobble-edit`) |
| ✓ | 23. Hold to preview | Hold Preview (`hold-preview`) |
| ✓ | 24. Hotspot annotations | Hotspot Notes (`hotspot-notes`) |
| ✓ | 25. Scroll-linked assembly | Scroll Assembly (`scroll-assembly`) |
| ✓ | 26. Scroll to rotate | Scroll Rotate (`scroll-rotate`) |
| ✓ | 27. Horizontal scroll gallery | Scroll Gallery (`scroll-gallery`) |
| ✓ | 28. Scroll velocity skew | Scroll Skew (`scroll-skew`) |
| ✓ | 29. Snapping sections | Snap Rail (`snap-rail`) |
| ✓ | 30. Scroll-to-explode | Scroll Explode (`scroll-explode`) |
| ✓ | 31. Sticky product shot that changes colour | Sticky Color (`sticky-color`) |
| ✓ | 32. Reading progress as a 3D ring | Reading Ring (`reading-ring`) |
| ✓ | 33. Arrow keys nudge the selected 3D part | Nudge Part (`nudge-part`) |
| ✓ | 34. Type-to-search | Type Search (`type-search`) |
| ✓ | 35. Keyboard-driven carousel | Key Carousel (`key-carousel`) |
| ✓ | 36. Hotkeys shown on hover | Hotkey Hints (`hotkey-hints`) |
| ✓ | 37. Spacebar press-and-hold to pause all motion | Space Pause (`space-pause`) |
| ✓ | 38. Shift-drag constrains movement to one axis | Axis Lock Drag (`axis-lock-drag`) |
| ✓ | 39. Pinch to zoom and twist to rotate | Pinch Twist (`pinch-twist`) |
| ✓ | 40. Device tilt (gyroscope) to orbit | Tilt Orbit (`tilt-orbit`) |
| ✓ | 41. Shake to reset | Shake Reset (`shake-reset`) |
| ✓ | 42. Swipe up on a card to dismiss it with a throw | Swipe Throw (`swipe-throw`) |
| ✓ | 43. Two-finger scroll to scrub a timeline | Trackpad Scrub (`trackpad-scrub`) |
| ✓ | 44. Camera-based head tracking for parallax | Head Parallax (`head-parallax`) |
| ✓ | 45. Idle attract loop | Idle Attract (`idle-attract`) |
| ✓ | 46. Undo and redo with a history strip | Undo History (`undo-history`) |
| ✓ | 47. Autosave of control values to the URL | URL State (`url-state`) |
| ✓ | 48. Comparison slider between two presets | Compare Slider (`compare-slider`) |
| ✓ | 49. Record and replay a sequence | Record Replay (`record-replay`) |
| ✓ | 50. Presence: cursors of other viewers | Presence Cursors (`presence-cursors`) |

## Pointer and hover

1. Peek: hovering a card lifts it and shows its back edge
2. Hover scrub: moving across a thumbnail scrubs a short clip
3. Cursor trail that fades, with the trail colour taken from what it passes over
4. Custom cursor that changes shape over draggable, clickable and text targets
5. Tilt-to-reveal: a hidden layer shows through as the card tilts
6. Proximity glow on borders near the pointer
7. Long-hover tooltip that expands into a full preview
8. Edge hover: moving to the viewport edge peeks the hidden nav

## Drag and throw

9. Drag with inertia and a snap-to-grid on release
10. Throwable cards that bounce off the viewport walls
11. Drag to reorder with live reflow and a ghost placeholder
12. Pull-to-refresh with a stretchy rubber-band indicator
13. Drag a slider past its end for an over-scroll rubber feel
14. Drag the 3D model itself to move it, with a drop shadow that follows
15. Rope: drag one end of a cable and the whole thing sways
16. Drawer that follows the finger and settles to open or closed

## Click and tap

17. Multi-stage button: press, hold to confirm, release to commit
18. Ripple from the exact tap point
19. Tap to cycle through presets, with a small radial indicator of position
20. Double-tap to like with a burst, single tap to open
21. Tap a 3D part to isolate it and dim everything else
22. Long-press to enter edit mode with a wobble
23. Tap-and-hold to preview, release to go back
24. Click a hotspot on the model to open an annotation card

## Scroll

25. Scroll-linked model assembly: parts fly in as you scroll
26. Scroll to rotate the 3D model a full turn across the section
27. Horizontal gallery driven by vertical scroll
28. Scroll velocity drives blur or skew that settles when you stop
29. Snapping sections with a progress rail
30. Scroll-to-explode: a model separates into layers and reassembles
31. Sticky product shot that changes colour per text block passed
32. Reading progress drawn as a filling 3D ring

## Keyboard

33. Arrow keys nudge the selected 3D part by one unit, with a readout
34. Type-to-search that filters as you type and highlights matches
35. Keyboard-driven carousel with a visible focus ring on the active slide
36. Hotkeys shown on hover (press ? to list them)
37. Spacebar press-and-hold to pause all motion
38. Shift-drag constrains movement to one axis

## Gesture and device

39. Pinch to zoom the model and two-finger twist to rotate it
40. Device tilt (gyroscope) to orbit the camera on phones
41. Shake to reset (snow globe, dice, reset controls)
42. Swipe up on a card to dismiss it with a throw
43. Two-finger scroll on a trackpad to scrub a timeline
44. Camera-based head tracking for a parallax window effect

## Time and state

45. Idle attract loop: after a pause the model performs a short demo
46. Undo and redo for control changes with a visible history strip
47. Autosave of control values to the URL for sharing a state
48. Comparison slider between two prop presets, split down the middle
49. Record and replay a sequence of interactions as a short clip
50. Presence: cursors of other viewers shown on the same model

## Where to start

Scroll to rotate (26), hotspot annotations (24) and the comparison slider
(48) make the biggest difference to the landing page, and all three reuse the
existing camera rig and two-way prop pattern in the 3D scenes.
