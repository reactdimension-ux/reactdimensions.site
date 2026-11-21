import { Link } from 'react-router-dom'

// A few of the library's components, floating round the headline. The
// thumbnails are the library's own preview images. x / y are the card's
// centre as a percentage of the hero; r is a small tilt; t sets the float delay.
const FLOATERS = [
  { slug: 'watch', name: 'Watch', x: 9, y: 20, r: -5, t: 0 },
  { slug: 'laptop', name: 'Laptop', x: 91, y: 20, r: 4, t: 1.2 },
  { slug: 'turntable', name: 'Turntable', x: 5, y: 50, r: 3, t: 2.4 },
  { slug: 'headphones', name: 'Headphones', x: 95, y: 50, r: -4, t: 0.6 },
  { slug: 'sunglasses', name: 'Sunglasses', x: 12, y: 80, r: 5, t: 1.8 },
  { slug: 'glass-bottle', name: 'Glass Bottle', x: 88, y: 80, r: -3, t: 3 },
]

export default function Landing() {
  return (
    <main>
      <section className="hero hero-lander">
        <div className="floaters" aria-label="Some of the components inside the library">
          {FLOATERS.map((f) => (
            <Link
              key={f.slug}
              to={`/library/${f.slug}`}
              className="floater"
              style={{ left: `${f.x}%`, top: `${f.y}%`, '--r': `${f.r}deg`, '--t': `${f.t}s` }}
            >
              <img src={`/previews/${f.slug}.jpg`} alt="" width="608" height="380" loading="lazy" />
              <span>{f.name}</span>
            </Link>
          ))}
        </div>
        <div className="hero-copy">
          <h1 className="load" style={{ '--d': 0 }}>
            From flat to <em>fully&nbsp;3D</em>: React components for every style.
          </h1>
          <div className="actions load" style={{ '--d': 1 }}>
            <Link className="btn" to="/library">
              Go to library <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

      </section>
    </main>
  )
}
