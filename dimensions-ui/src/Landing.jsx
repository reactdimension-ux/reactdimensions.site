import { Link } from 'react-router-dom'

// Polished, realistic models for the strip under the hero.
const SHOWCASE = [
  { slug: 'electric-guitar', name: 'Electric Guitar' },
  { slug: 'grand-piano', name: 'Grand Piano' },
  { slug: 'stealth-fighter', name: 'Stealth Fighter' },
  { slug: 'sneaker', name: 'Sneaker' },
  { slug: 'racing-circuit', name: 'Racing Circuit' },
  { slug: 'helicopter', name: 'Helicopter' },
  { slug: 'wine-glass', name: 'Wine Glass' },
  { slug: 'airliner', name: 'Airliner' },
  { slug: 'chessboard', name: 'Chessboard' },
  { slug: 'pickup', name: 'Pickup' },
  { slug: 'compact-disc', name: 'Compact Disc' },
  { slug: 'city-bus', name: 'City Bus' },
]

// Sports, courts and games for the second strip.
const SPORTS = [
  { slug: 'tennis-ball', name: 'Tennis Ball' },
  { slug: 'cricket-pitch', name: 'Cricket Pitch' },
  { slug: 'tennis-court', name: 'Tennis Court' },
  { slug: 'badminton-court', name: 'Badminton Court' },
  { slug: 'snooker-table', name: 'Snooker Table' },
  { slug: 'football', name: 'Football' },
  { slug: 'basketball', name: 'Basketball' },
  { slug: 'cricket-ball', name: 'Cricket Ball' },
  { slug: 'bowling-ball', name: 'Bowling Ball' },
  { slug: 'dartboard', name: 'Dartboard' },
  { slug: 'tennis-racket', name: 'Tennis Racket' },
  { slug: 'archery-target', name: 'Archery Target' },
  { slug: 'roulette-table', name: 'Roulette Table' },
  { slug: 'poker-table', name: 'Poker Table' },
  { slug: 'carrom-board', name: 'Carrom Board' },
  { slug: 'puzzle-cube', name: 'Puzzle Cube' },
  { slug: 'dumbbells', name: 'Dumbbells' },
  { slug: 'gamepad', name: 'Gamepad' },
]

function Strip({ items, reverse = false }) {
  return (
    <div className={`showcase-track${reverse ? ' reverse' : ''}`}>
      {[...items, ...items].map((f, i) => (
        <Link key={i} to={`/library/${f.slug}`} className="showcase-card" aria-label={f.name} tabIndex={i >= items.length ? -1 : 0} aria-hidden={i >= items.length || undefined}>
          <img src={`/previews/${f.slug}.jpg`} alt={f.name} width="608" height="380" loading="lazy" />
        </Link>
      ))}
    </div>
  )
}

export default function Landing() {
  return (
    <main>
      <section className="hero hero-lander">
        <div className="hero-copy">
          <h1 className="load" style={{ '--d': 0 }}>
            3D components for React, built to be seen.
          </h1>
          <p className="lede load" style={{ '--d': 1 }}>
            A growing library of 3D React components, from true-to-scale models to low-poly scenes. Preview them, make them yours, and drop them into your next project.
          </p>
          <div className="actions load" style={{ '--d': 2 }}>
            <Link className="btn" to="/library">
              Go to library
            </Link>
          </div>
        </div>

      </section>
      <section className="showcase" aria-label="More of the library">
        <Strip items={SHOWCASE} />
        <Strip items={SPORTS} reverse />
      </section>
    </main>
  )
}
