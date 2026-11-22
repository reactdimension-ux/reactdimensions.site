import { Link } from 'react-router-dom'

// A few of the library's components, floating round the headline. The
// thumbnails are the library's own preview images. x / y are the card's
// centre as a percentage of the hero; r is a small tilt; t sets the float delay.
const FLOATERS = [
  { slug: 'watch', name: 'Watch', x: 6.5, y: 15, r: -5, t: 0 },
  { slug: 'low-poly-fox', name: 'Low-poly fox', x: 15, y: 32, r: 4, t: 1.4 },
  { slug: 'turntable', name: 'Turntable', x: 6.5, y: 49, r: 3, t: 2.4 },
  { slug: 'low-poly-rocket', name: 'Low-poly rocket', x: 15, y: 66, r: -4, t: 0.8 },
  { slug: 'sunglasses', name: 'Sunglasses', x: 7, y: 83, r: 5, t: 1.8 },
  { slug: 'laptop', name: 'Laptop', x: 93.5, y: 15, r: 4, t: 1.2 },
  { slug: 'low-poly-robot', name: 'Low-poly robot', x: 85, y: 32, r: -4, t: 2 },
  { slug: 'headphones', name: 'Headphones', x: 93.5, y: 49, r: -4, t: 0.6 },
  { slug: 'low-poly-owl', name: 'Low-poly owl', x: 85, y: 66, r: 3, t: 2.8 },
  { slug: 'glass-bottle', name: 'Glass bottle', x: 93, y: 83, r: -3, t: 3 },
  { slug: 'low-poly-ufo', name: 'Low-poly UFO', x: 38, y: 9, r: -3, t: 1 },
  { slug: 'low-poly-rubber-duck', name: 'Low-poly rubber duck', x: 62, y: 9, r: 3, t: 2.2 },
  { slug: 'low-poly-penguin', name: 'Low-poly penguin', x: 38, y: 91, r: 3, t: 0.4 },
  { slug: 'low-poly-ice-cream', name: 'Low-poly ice cream', x: 62, y: 91, r: -3, t: 1.6 },
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
              aria-label={f.name}
              style={{ '--x': `${f.x}%`, top: `${f.y}%`, '--r': `${f.r}deg`, '--t': `${f.t}s` }}
            >
              <img src={`/previews/${f.slug}.jpg`} alt={f.name} width="608" height="380" loading="lazy" />
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
