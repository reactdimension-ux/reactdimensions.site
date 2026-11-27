# 48 phone UI ideas

Full phone-app screens for the library's Phone UI category, grouped by the
kind of app. Two already exist: Smart Home App (glass, dark) and Food Tracker
App (flat, light), so these avoid repeating them. Each one is a self-contained
component with the same props as the existing two: an accent colour, a
name or title, a `frame` toggle for the device bezel and, where it helps, a
`startScreen` select. Each should work with touch and a mouse, and respect
reduced-motion settings.

## Health and fitness

1. Workout tracker: today's plan as stacked cards, a set counter and a rest timer ring that counts down
2. Sleep tracker: a night's stages drawn as a stepped timeline, with a draggable bedtime dial
3. Meditation timer: a breathing circle that grows and shrinks, with session streak dots
4. Running app: live map line, pace sparkline and a hold-to-finish button
5. Water intake: a glass that fills with a wave when you tap, with a daily goal line
6. Period and cycle calendar: phase-coloured month grid with a prediction ring
7. Habit streaks: a grid of habits with flame counters and a tap-to-check burst
8. Medication reminder: a pill schedule by time of day with swipe-to-mark-taken

## Money

9. Banking home: balance card, quick-action row and a transaction list that groups by day
10. Card wallet: stacked payment cards that fan out on tap, with a flip to the back
11. Budget planner: category rings that fill as spending adds up
12. Split-the-bill: items listed with avatars you drag onto to assign shares
13. Crypto portfolio: coin list with sparklines and a pinch-to-zoom price chart
14. Savings goals: jars that fill, with a round-up slider
15. Stock watchlist: swipe a row to set an alert, with a pulsing live price
16. Expense scanner: a receipt photo with line items extracted and tagged

## Media and entertainment

17. Music player: spinning cover, scrubbable waveform and a swipe-up queue sheet
18. Podcast app: episode list with a mini player that expands to full screen
19. Video feed: vertical snap scroll with double-tap to like and a comment sheet
20. Movie tickets: seat map you tap to select, ending in a ticket with a tear edge
21. Photo gallery: pinch grid that zooms between months and years
22. Story viewer: segmented progress bars, hold to pause, tap edges to skip
23. Ebook reader: page-curl turns, a font size slider and a night mode toggle
24. Karaoke lyrics: line-by-line highlight that follows a simulated track

## Travel and places

25. Ride-hailing: pickup map with a car sliding along the route and a driver card sheet
26. Boarding pass wallet: a pass with a barcode, gate countdown and a pull-down for details
27. Trip planner: day-by-day itinerary with drag to reorder stops
28. Hotel booking: image carousel, date range picker and a sticky price bar
29. Weather forecast: hourly strip, a temperature curve and a background that changes with conditions
30. Parking finder: map pins with live free-space counts and a timer once you park
31. Transit map: route lines you tap to see the next arrivals
32. Restaurant reservation: a time slot grid with a party size stepper

## Social and communication

33. Messenger: chat bubbles with typing dots, swipe-to-reply and emoji reaction pop-ups
34. Dating cards: a swipeable stack with a stamp for like and nope
35. Social profile: parallax header, follower counts that count up and a post grid
36. Group video call: tiles that rearrange on speaker change, with a floating controls bar
37. Voice notes: recorded waveform bubbles that play with a moving cursor
38. Event invite: an RSVP card with attendee faces and a confetti burst on Going
39. Notification centre: grouped cards that expand on tap and clear with a swipe
40. Stories composer: draggable stickers and text over a photo

## Productivity and tools

41. Calendar day view: draggable event blocks and a current-time line
42. Notes app: a list with pinned notes, a checklist mode and swipe actions
43. Kanban board: columns you swipe between, with drag to move a card
44. Camera app: viewfinder with mode carousel, shutter press animation and a thumbnail fly-in
45. Password vault: a locked screen with a PIN pad, then a list that reveals on hold
46. Smart watch companion: a rounded watch face with complications that tap through to detail
47. Car dashboard: a connected-car app with range ring, lock and climate controls
48. Onboarding flow: three swipeable intro pages with a parallax illustration and a progress pill

## Where to start

Music player (17), messenger (33) and the card wallet (10) show off the most
distinct interactions: scrubbing, swipe-to-reply and the stack fan. Banking
home (9) and weather forecast (29) are the quickest, since they are mostly
layout and reuse the dashboard patterns already in Flat Dashboard and Glass
Weather.
