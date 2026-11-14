# Phone UI: Phase Four

Phase Four is 24 more phone app ideas, after the 50 already built (see
[phase one](phone-ui-phase-one.md) and [phase two](phone-ui-phase-two.md)) and
the 24 planned in [phase three](phone-ui-phase-three.md). None of these repeat
those. Where Phase Three leaned on live status, commerce and AI, this phase
leans on creative tools, learning, community and utilities, with more
canvas, audio and timeline work.

Every build is the same kind of multi-screen click-through prototype: a tab bar
or in-app navigation, every row and button leads to a real screen, and a
`startScreen` select jumps to any of its five pages. Each build is a
self-contained component in `src/lib/` (React only, every picture drawn in SVG
or CSS), registered under Phone UI, with a 608×380 thumbnail in
`public/previews/`. Before calling one done, load it on every `startScreen`,
check the console for errors, then drive its main interactions by hand. The
Web Audio ones (beat maker, tuner, audio rooms) should stay silent until the
user taps something, and must offer a mute control.

| # | App | Pages | Hard part |
| --- | --- | --- | --- |
| 1 | Sketchpad | Canvas, Layers, Brushes, Gallery, Settings | Pressure-style brush strokes on a canvas, layers, undo and redo |
| 2 | Photo editor | Edit, Adjust, Filters, Crop, Export | Live sliders on an image, hold to compare with the original |
| 3 | Video editor | Project, Timeline, Clip, Audio, Export | Drag and trim clips on a timeline, playhead scrubbing |
| 4 | Beat maker | Pads, Sequencer, Mixer, Library, Settings | Step-sequencer grid with a moving playhead, tempo, pad sounds |
| 5 | Instrument tuner | Tuner, Instruments, Metronome, Ear training, Settings | Needle that swings and settles on a simulated pitch |
| 6 | Letter tracing | Alphabet, Trace, Stars, Parent, Settings | Trace a glyph along a path, validation with stars |
| 7 | Chore chart | Today, Chores, Rewards, Family, Settings | Tick chores, coin counter, reward redeem with celebration |
| 8 | Class booking | Schedule, Class, Booking, Passes, Profile | Week timetable, spot count, waitlist promotion |
| 9 | Yoga flow | Library, Flow, Pose, Builder, Progress | Timed pose sequence with a breathing cue and a skeleton drawing |
| 10 | Step challenge | Today, Challenge, Friends, Badges, Settings | Live step count, race track with friends, badge unlocks |
| 11 | Grocery list | Lists, List, Add item, Store mode, Share | Aisle-grouped list, swipe to tick, store mode with a running total |
| 12 | Real estate | Search, Results, Listing, Saved, Contact | Map and list with filters, price range slider, photo carousel |
| 13 | Mortgage calculator | Calculator, Breakdown, Compare, Schedule, Settings | Sliders updating a payment donut and an amortisation chart |
| 14 | Festival planner | Lineup, Stage, My plan, Map, Friends | Overlapping set times, clash warnings, a site map with pins |
| 15 | Audio rooms | Rooms, Room, Speakers, Schedule, Profile | Speaker rings that pulse, raise hand, join and leave animation |
| 16 | Community Q&A | Feed, Question, Answer, Tags, Profile | Vote arrows with live score, accepted answer, threaded replies |
| 17 | Donations | Causes, Cause, Donate, Impact, Profile | Progress thermometer, amount chips, a thank-you animation |
| 18 | Invoicing | Dashboard, Invoice, Clients, New invoice, Reports | Line-item editor with totals and tax, status pipeline, PDF-style preview |
| 19 | Focus timer | Timer, Tasks, Stats, Sounds, Settings | Pomodoro cycles with a ring, long breaks, a streak calendar |
| 20 | Sky map | Sky, Object, Tonight, Saved, Settings | Star field that pans with drag, constellation lines, time slider |
| 21 | Hiking trails | Trails, Trail, Elevation, Record, Saved | Elevation profile you can scrub with a map marker following |
| 22 | Dice and scoreboard | Dice, Scores, Players, History, Settings | 3D-looking dice roll animation, running totals per player |
| 23 | Item finder | Items, Find, Map, Alerts, Settings | Radar sweep with a distance-based ping, ring and left-behind alert |
| 24 | Email client | Inbox, Message, Compose, Folders, Search | Swipe actions (archive, snooze), thread view, compose with attachments |

## Suggested first three

Beat maker (4), Sketchpad (1) and Email client (24). They are three different
kinds of hard: audio timing, freehand drawing, and gesture-heavy lists. Between
them they cover the interaction patterns the library has not yet shown in a
phone app.

## Before starting

Phase Four assumes Phase Three is built (or deliberately skipped) and that these
loose ends are cleared:

- The Phase Three carry-over fixes (Messenger's unwired toggles, the
  Notifications toast resetting a swipe, Story's progress bar restarting, and
  the rest listed in [phone-ui-phase-three.md](phone-ui-phase-three.md)).
- URL State (animation idea 47) tested under the real library router, since it
  was only tested with plain browser history.
- Head Parallax (animation idea 44) tried with a real camera and a real face.
- A hands-on pass for the drag, swipe, hold and timer apps from Phases One and
  Two.

## Status

Nothing is built yet.

| Built | App | Component |
| --- | --- | --- |
| | 4. Beat maker | |
| | 1. Sketchpad | |
| | 24. Email client | |
