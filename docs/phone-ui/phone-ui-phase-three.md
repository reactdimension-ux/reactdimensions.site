# Phone UI: Phase Three

Phases One and Two built all 48 of the [phone UI ideas](phone-ui-ideas.md), so
the Phone UI category now has 50 apps (see [phase one](phone-ui-phase-one.md)
and [phase two](phone-ui-phase-two.md)). Phase Three is 24 new ideas, chosen to
avoid repeating anything already built: they lean on games, live status,
commerce, home and family, and AI. Every build is the same kind of multi-screen
click-through prototype: a tab bar or in-app navigation, every row and button
leads to a real screen, and a `startScreen` select jumps to any of its five
pages.

Each build is a self-contained component in `src/lib/` (React only, every
picture drawn in SVG or CSS), registered under Phone UI, with a 608×380
thumbnail in `public/previews/`. Before calling one done, load it on every
`startScreen` and check the console for errors, then drive its main
interactions by hand.

| # | App | Pages | Hard part |
| --- | --- | --- | --- |
| 1 | Home security | Cameras, Live view, Events, Sensors, Settings | Grid of animated camera feeds, motion alerts, arm and disarm |
| 2 | Plant care | My plants, Plant detail, Watering, Identify, Reminders | Water-level gauge, scan-to-identify animation |
| 3 | Pet tracker | Map, Pet, Activity, Safe zones, Settings | Live position on a map, geofence alerts |
| 4 | Baby tracker | Today, Log feed, Sleep, Growth, Settings | Quick-log buttons, timer for feeds and naps, growth chart |
| 5 | Language learning | Home, Lesson, Flashcards, Progress, Settings | Multiple-choice and word-order exercises, streak and XP |
| 6 | Cooking mode | Recipes, Recipe, Ingredients, Step by step, Timers | Hands-free big-text steps with several running timers |
| 7 | Food delivery tracking | Order, Tracking, Courier, Receipt, Help | Courier moving along a route, status steps, live ETA |
| 8 | Coffee order | Menu, Customise, Cart, Pickup, Rewards | Drink builder (size, milk, shots) with a live cup drawing |
| 9 | Online shop | Home, Product, Cart, Checkout, Orders | Image carousel, variants, cart steppers, order flow |
| 10 | Package tracking | Packages, Detail, Map, Add, Settings | Timeline with a moving marker, carrier detection from a code |
| 11 | Scooter rental | Map, Unlock, Ride, Pause, Summary | Scan to unlock, ride timer with a running price |
| 12 | EV charging | Map, Station, Charging, History, Settings | Charge ring filling live, plug-type filters |
| 13 | Airline check-in | Trips, Check-in, Seat, Boarding pass, Status | Seat map, step-by-step check-in, delay updates |
| 14 | Job swipe | Discover, Job, Applications, Profile, Filters | Swipe stack, application pipeline statuses |
| 15 | Quiz game | Home, Question, Result, Leaderboard, Categories | Countdown per question, streak bonus, animated scoring |
| 16 | Word guess | Game, Stats, How to play, Archive, Settings | Five-letter grid with a keyboard, tile flips, shake on invalid |
| 17 | Translator | Translate, Conversation, Phrasebook, History, Settings | Swap languages, two-way chat bubbles, saved phrases |
| 18 | AI chat | Chat, History, Prompts, Settings, Profile | Streamed typing replies, suggestion chips, regenerate |
| 19 | Live scores | Scores, Match, Table, Fixtures, Favourites | Ticking match clock, goal events, follow a team |
| 20 | Live auction | Auctions, Lot, Bid, Watchlist, Wins | Rising bids with a countdown, outbid alerts |
| 21 | Loyalty rewards | Card, Rewards, Offers, Activity, Settings | Stamp card filling, scratch-to-reveal offer, points redeem |
| 22 | Telehealth | Home, Find doctor, Booking, Visit, Records | Time-slot picker, waiting room, in-visit chat |
| 23 | Mood journal | Today, Entry, Calendar, Insights, Settings | Mood slider with a changing face, tag chips, monthly colour map |
| 24 | Digital ID wallet | Wallet, ID, Share, Verify, Settings | Hold-to-reveal details, QR that refreshes, consent sheet |

## Suggested first three

Food delivery tracking (7), AI chat (18) and Word guess (16). Between them they
cover live movement along a route, streamed text, and game logic with
animation, three things the library does not have yet.

## Carry-over fixes

Small issues reported while building Phases One and Two. Worth clearing at the
start of Phase Three:

- Messenger: the Message sounds toggle and the dark switch do nothing yet.
- Notifications: a toast arriving mid-swipe resets the drag.
- Story: returning from Reply restarts the slide's progress bar.
- Crypto: on coin detail the Buy/Sell row can sit under the home-indicator bar
  until you scroll.
- Stocks: the toast briefly covers the page title.
- Calendar: on events of 45 minutes or less the resize handle sits close to the
  time text.
- Composer: the toast can cover the font chips while the text editor is open.
- A hands-on pass for the drag, swipe, hold and timer apps, since most of those
  were checked by reading the code (Kanban, Dating, Story, Meditation, Video
  Call, Ride, Meds, Cinema and others).

## Status

Nothing is built yet.

| Built | App | Component |
| --- | --- | --- |
| | 7. Food delivery tracking | |
| | 18. AI chat | |
| | 16. Word guess | |
