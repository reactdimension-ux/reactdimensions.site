# Phone UI: Phase Two

The 28 ideas from the [48 phone UI ideas](phone-ui-ideas.md) that Phase One
([phone-ui-phase-one.md](phone-ui-phase-one.md)) did not cover. These are the
harder builds: richer gestures, live media, maps or canvas drawing. Every build
is the same kind of multi-screen click-through prototype as Phase One: a tab
bar or in-app navigation, every row and button leads to a real screen, and a
`startScreen` select jumps to any page.

Each build is a self-contained component in `src/lib/`, registered under
Phone UI, with a 608×380 thumbnail in `public/previews/`. Check each one on
every `startScreen` for console errors before calling it done.

| # | App | Pages | Hard part |
| --- | --- | --- | --- |
| 17 | Music player | Now playing, Library, Queue, Album, Search | Scrubbable waveform, swipe-up queue sheet |
| 10 | Card wallet | Wallet, Card detail, Add card, Transactions, Settings | Stack that fans out, card flip |
| 44 | Camera app | Viewfinder, Gallery, Photo detail, Filters, Settings | Mode carousel, shutter animation, thumbnail fly-in |
| 19 | Video feed | For you, Following, Comments, Profile, Upload | Vertical snap scroll, double-tap like |
| 25 | Ride-hailing | Home, Pick destination, Ride options, Trip, Receipt | Car moving along a route |
| 36 | Group video call | Lobby, Call, Participants, Chat, Settings | Tiles that rearrange on speaker change |
| 45 | Password vault | Lock, Vault, Item detail, Generator, Settings | PIN pad, hold to reveal |
| 15 | Stock watchlist | Watchlist, Stock detail, Alerts, Portfolio, Search | Swipe to set alert, live price pulse |
| 13 | Crypto portfolio | Portfolio, Coin detail, Buy, Activity, Settings | Pinch-to-zoom price chart |
| 12 | Split the bill | Receipt, Assign items, People, Summary, Pay | Drag items onto avatars |
| 16 | Expense scanner | Scan, Review items, Categories, History, Export | Receipt extraction animation |
| 18 | Podcast app | Home, Show, Episode, Downloads, Settings | Mini player that expands |
| 20 | Movie tickets | Now showing, Movie, Seats, Checkout, Ticket | Seat map, ticket tear edge |
| 21 | Photo gallery | Photos, Albums, Album, Viewer, Search | Pinch grid zooming months and years |
| 23 | Ebook reader | Library, Reader, Contents, Notes, Settings | Page-curl turns, font and night mode |
| 24 | Karaoke lyrics | Songs, Player, Queue, Recordings, Settings | Line highlight following a simulated track |
| 37 | Voice notes | Recordings, Record, Playback, Folders, Settings | Recorded waveform with a moving cursor |
| 40 | Stories composer | Camera, Edit, Stickers, Share, Drafts | Draggable stickers and text over a photo |
| 41 | Calendar day view | Day, Week, Event detail, New event, Settings | Draggable event blocks, current-time line |
| 1 | Workout tracker | Today, Workout, Exercise, History, Settings | Set counter, rest-timer ring |
| 4 | Running app | Start, Live run, Summary, History, Routes | Live map line, hold to finish |
| 6 | Period and cycle calendar | Calendar, Log day, Insights, Predictions, Settings | Phase-coloured grid with a prediction ring |
| 8 | Medication reminder | Today, Schedule, Medication, History, Settings | Swipe to mark taken |
| 27 | Trip planner | Trips, Itinerary, Place, Map, Packing | Drag to reorder stops |
| 30 | Parking finder | Map, Lot detail, Timer, Payment, History | Map pins with live free-space counts |
| 31 | Transit map | Map, Route, Station, Trip planner, Saved | Tap lines to see next arrivals |
| 46 | Smart watch companion | Watch face, Complications, Activity, Apps, Settings | Rounded watch face with tap-through complications |
| 47 | Car dashboard | Car, Climate, Lock, Trips, Settings | Range ring, lock and climate controls |

## Suggested first three

Music player (17), Card wallet (10) and Camera app (44). They are the most
distinct in the library (scrubbing, the stack fan and the shutter) and cover
media, finance and capture, so the category stops being mostly dashboards and
lists.

## Status

All 28 are built (28 of 28), registered in the Phone UI category, with a thumbnail each. Every app loads without console errors on every `startScreen` option (a sweep of 246 screen loads across the 49 apps that have one). Most of the drag, hold, pinch and timer interactions were checked by reading the code or only partly driven in a browser, so a hands-on pass is still worth doing.

| Built | App | Component |
| --- | --- | --- |
| ✓ | 17. Music player | Music App (`music-app`) |
| ✓ | 10. Card wallet | Wallet App (`wallet-app`) |
| ✓ | 44. Camera app | Camera App (`camera-app`) |
| ✓ | 19. Video feed | Video Feed App (`video-feed-app`) |
| ✓ | 25. Ride-hailing | Ride App (`ride-app`) |
| ✓ | 36. Group video call | Video Call App (`video-call-app`) |
| ✓ | 45. Password vault | Vault App (`vault-app`) |
| ✓ | 15. Stock watchlist | Stocks App (`stocks-app`) |
| ✓ | 13. Crypto portfolio | Crypto App (`crypto-app`) |
| ✓ | 12. Split the bill | Split App (`split-app`) |
| ✓ | 16. Expense scanner | Receipt App (`receipt-app`) |
| ✓ | 18. Podcast app | Podcast App (`podcast-app`) |
| ✓ | 20. Movie tickets | Cinema App (`cinema-app`) |
| ✓ | 21. Photo gallery | Gallery App (`gallery-app`) |
| ✓ | 23. Ebook reader | Reader App (`reader-app`) |
| ✓ | 24. Karaoke lyrics | Karaoke App (`karaoke-app`) |
| ✓ | 37. Voice notes | Voice Notes App (`voice-notes-app`) |
| ✓ | 40. Stories composer | Stories Composer (`composer-app`) |
| ✓ | 41. Calendar day view | Calendar App (`calendar-app`) |
| ✓ | 1. Workout tracker | Workout App (`workout-app`) |
| ✓ | 4. Running app | Run App (`run-app`) |
| ✓ | 6. Period and cycle calendar | Cycle App (`cycle-app`) |
| ✓ | 8. Medication reminder | Meds App (`meds-app`) |
| ✓ | 27. Trip planner | Trip Planner App (`trip-app`) |
| ✓ | 30. Parking finder | Parking App (`parking-app`) |
| ✓ | 31. Transit map | Transit App (`transit-app`) |
| ✓ | 46. Smart watch companion | Watch App (`watch-app`) |
| ✓ | 47. Car dashboard | Car App (`car-app`) |
