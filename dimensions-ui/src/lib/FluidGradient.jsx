import { useEffect, useRef } from 'react'

// A soft, slowly folding mesh gradient: four colours drift around the frame
// and the space between them is bent by layered sine flow, so the bands curl
// like poured paint. Drawn with a single WebGL fragment shader on a canvas;
// without WebGL it falls back to static CSS gradients.

const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC0, uC1, uC2, uC3;
uniform float uWarp, uScale, uGrain;

// sin-free hash: no diagonal banding in the grain
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) / uScale;
  float t = uTime;

  // layered sine flow bends the space into soft folds
  for (int i = 1; i < 5; i++) {
    float f = float(i);
    p.x += uWarp * 0.32 / f * sin(f * 1.9 * p.y + t * 0.55 + f * 1.7);
    p.y += uWarp * 0.32 / f * cos(f * 1.6 * p.x - t * 0.45 + f * 0.9);
  }

  // four colour sources wander on slow Lissajous paths
  vec2 s0 = vec2(-0.45 * asp + 0.20 * sin(t * 0.31), 0.30 + 0.18 * cos(t * 0.27));
  vec2 s1 = vec2( 0.40 * asp + 0.22 * cos(t * 0.23), 0.28 + 0.20 * sin(t * 0.35 + 1.0));
  vec2 s2 = vec2(-0.30 * asp + 0.25 * cos(t * 0.29 + 2.0), -0.32 + 0.18 * sin(t * 0.21));
  vec2 s3 = vec2( 0.35 * asp + 0.20 * sin(t * 0.26 + 3.0), -0.30 + 0.22 * cos(t * 0.33 + 0.5));
  s0 /= uScale; s1 /= uScale; s2 /= uScale; s3 /= uScale;

  // inverse-distance blend gives broad, smooth regions
  float w0 = 1.0 / pow(length(p - s0) + 0.05, 2.6);
  float w1 = 1.0 / pow(length(p - s1) + 0.05, 2.6);
  float w2 = 1.0 / pow(length(p - s2) + 0.05, 2.6);
  float w3 = 1.0 / pow(length(p - s3) + 0.05, 2.6);
  vec3 col = (uC0 * w0 + uC1 * w1 + uC2 * w2 + uC3 * w3) / (w0 + w1 + w2 + w3);

  col = pow(col, vec3(1.0 / 2.2));
  col += (hash(gl_FragCoord.xy + fract(t * 7.0)) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`

// '#rrggbb' -> linear RGB, so colours blend without muddy midtones
function toLinear(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex || '') || [0, '00', '00', '00']
  return [m[1], m[2], m[3]].map((h) => Math.pow(parseInt(h, 16) / 255, 2.2))
}

export default function FluidGradient({
  children,
  color1 = '#f0517a',
  color2 = '#fdd36b',
  color3 = '#b9dccb',
  color4 = '#f7849a',
  speed = 1,
  warp = 1,
  scale = 1,
  grain = 0.04,
  style,
}) {
  const canvasRef = useRef(null)
  const props = useRef({})
  props.current = { color1, color2, color3, color4, speed, warp, scale, grain }

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!gl) return

    const shader = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const u = Object.fromEntries(
      ['uRes', 'uTime', 'uC0', 'uC1', 'uC2', 'uC3', 'uWarp', 'uScale', 'uGrain'].map((n) => [n, gl.getUniformLocation(prog, n)]),
    )

    // the gradient is soft, so a capped pixel ratio costs nothing visible
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting })
    io.observe(canvas)

    let raf
    let last = performance.now()
    let time = 12 // start mid-flow rather than at the symmetric first frame
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!visible) return
      const p = props.current
      if (!reduced?.matches) time += dt * p.speed * 0.5
      resize()
      gl.uniform2f(u.uRes, canvas.width, canvas.height)
      gl.uniform1f(u.uTime, time)
      gl.uniform3fv(u.uC0, toLinear(p.color1))
      gl.uniform3fv(u.uC1, toLinear(p.color2))
      gl.uniform3fv(u.uC2, toLinear(p.color3))
      gl.uniform3fv(u.uC3, toLinear(p.color4))
      gl.uniform1f(u.uWarp, p.warp)
      gl.uniform1f(u.uScale, Math.max(0.2, p.scale))
      gl.uniform1f(u.uGrain, p.grain)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        // shown until (or instead of) the WebGL canvas
        background: [
          `radial-gradient(ellipse 60% 60% at 20% 25%, ${color1}, transparent 70%)`,
          `radial-gradient(ellipse 60% 60% at 80% 25%, ${color2}, transparent 70%)`,
          `radial-gradient(ellipse 60% 60% at 25% 80%, ${color3}, transparent 70%)`,
          `radial-gradient(ellipse 60% 60% at 80% 80%, ${color4}, transparent 70%)`,
          color1,
        ].join(', '),
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      />
      <div style={{ position: 'relative', height: '100%' }}>{children}</div>
    </div>
  )
}
