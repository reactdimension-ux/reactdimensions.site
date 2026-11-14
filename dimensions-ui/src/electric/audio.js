// Electric guitar sound, made in WebAudio so there are no files to ship, and
// driven by the same string model as the picture (strings.js).
//
//   string   one voice per string: a bank of sine partials at the string's
//            (slightly stretched) harmonics. Each partial's level is what the
//            selected pickups hear of that mode for this pluck point; high
//            partials die faster. A re-pluck damps the old note; fretting,
//            tuning and the tremolo glide every partial's pitch live.
//   pickups  single coils: a resonant peak from the coil's inductance and
//            the cable, around 4 kHz
//   tone     a low-pass the tone knob opens and closes
//   volume   the volume knob
//   amp      a preamp that clips softly as the drive goes up, a 2×12 cab's
//            response, and a little spring-ish room.
import { STRINGS, pickupMode, SCALE, fretFromNut } from './strings.js'

const PARTIALS = 16
let ctx = null
let chain = null
const voices = new Array(6).fill(null)

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    chain = buildChain(ctx)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function curve(drive) {
  const n = 2048
  const c = new Float32Array(n)
  const k = 1 + drive * 60
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    c[i] = Math.tanh(k * x) / Math.tanh(k)
  }
  return c
}

function buildChain(c) {
  const input = c.createGain()
  const coil = c.createBiquadFilter()
  coil.type = 'peaking'
  coil.frequency.value = 4200
  coil.Q.value = 1.8
  coil.gain.value = 6
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 9000
  tone.Q.value = 0.7
  const volume = c.createGain()
  const pre = c.createGain()
  const shaper = c.createWaveShaper()
  shaper.curve = curve(0.15)
  shaper.oversample = '4x'
  const post = c.createGain()
  // the cabinet: no deep lows, a presence bump, nothing above ~5.5 kHz
  let node = post
  const cab = []
  for (const [type, f, q, g] of [
    ['highpass', 85, 0.7, 0],
    ['peaking', 120, 1, 3],
    ['peaking', 1900, 1.2, 4],
    ['lowpass', 5200, 0.9, 0],
    ['lowpass', 6500, 0.7, 0],
  ]) {
    const b = c.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    b.gain.value = g
    node.connect(b)
    node = b
    cab.push(b)
  }
  const len = Math.floor(c.sampleRate * 1.6)
  const ir = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4) * (i % 1301 < 6 ? 2 : 1)
  }
  const verb = c.createConvolver()
  verb.buffer = ir
  const wet = c.createGain()
  wet.gain.value = 0.14
  const master = c.createGain()
  master.gain.value = 0.5
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -12
  comp.ratio.value = 4
  input.connect(coil).connect(tone).connect(volume).connect(pre).connect(shaper).connect(post)
  node.connect(comp)
  comp.connect(master)
  comp.connect(verb).connect(wet).connect(master)
  master.connect(c.destination)
  return { input, tone, volume, pre, shaper, post, drive: -1 }
}

// pickup positions, metres from the saddle; the bridge pickup is slanted
export const PICKUPS = {
  neck: () => 0.161,
  middle: () => 0.1,
  bridge: (i) => 0.047 - i * 0.0024,
}
export const SELECTOR = [['bridge'], ['bridge', 'middle'], ['middle'], ['middle', 'neck'], ['neck']]

// settings: { selector 0..4, volume 0..10, tone 0..10, drive 0..1 }
export function setTone({ volume, tone, drive }) {
  if (!ctx) return
  const t = ctx.currentTime
  chain.volume.gain.setTargetAtTime(Math.pow(volume / 10, 1.6), t, 0.02)
  chain.tone.frequency.setTargetAtTime(500 * Math.pow(24, tone / 10), t, 0.02)
  if (Math.abs(chain.drive - drive) > 0.01) {
    chain.drive = drive
    chain.shaper.curve = curve(drive)
    chain.pre.gain.setTargetAtTime(0.6 + drive * 4, t, 0.02)
    chain.post.gain.setTargetAtTime(1 / (1 + drive * 2.2), t, 0.02)
  }
}

function stop(i, when = 0.015) {
  const v = voices[i]
  if (!v) return
  voices[i] = null
  const t = ctx.currentTime
  v.out.gain.cancelScheduledValues(t)
  v.out.gain.setValueAtTime(v.out.gain.value, t)
  v.out.gain.setTargetAtTime(0, t, when)
  for (const p of v.partials) p.osc.stop(t + when * 10)
}

// pluck string i at fraction b from the saddle, with `strength` 0..1, at
// frequency f, fretted at `fret`, through the pickups in `selector`
export function pluck(i, { b, strength, f, fret, selector }) {
  ensure()
  stop(i)
  const s = STRINGS[i]
  const t = ctx.currentTime
  const out = ctx.createGain()
  out.gain.value = 0
  out.gain.setTargetAtTime(0.16 * strength, t, 0.002)
  out.connect(chain.input)
  const L = SCALE - fretFromNut(Math.max(0, fret))
  const pus = SELECTOR[selector] || SELECTOR[0]
  const partials = []
  const amps = []
  let norm = 0
  for (let n = 1; n <= PARTIALS; n++) {
    let a = 0
    for (const p of pus) a += pickupMode(n, b, PICKUPS[p](i), L)
    amps.push(a)
    norm = Math.max(norm, Math.abs(a))
  }
  for (let n = 1; n <= PARTIALS; n++) {
    const fn = n * f * Math.sqrt(1 + s.B * n * n)
    if (fn > 16000) break
    const osc = ctx.createOscillator()
    osc.frequency.value = fn
    const g = ctx.createGain()
    const a = amps[n - 1] / (norm || 1)
    // higher modes lose energy faster to the air, the nut and the frets
    const tau = s.decay / (1 + 0.035 * n * n)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(a, t + 0.003)
    g.gain.setTargetAtTime(0, t + 0.003, tau)
    osc.connect(g).connect(out)
    osc.start(t)
    osc.stop(t + tau * 7 + 0.05)
    partials.push({ osc, n })
  }
  voices[i] = { out, partials, s, f }
}

// glide a ringing string to a new pitch (fretting, tuning, tremolo)
export function bend(i, f) {
  const v = voices[i]
  if (!v || !ctx) return
  if (Math.abs(f / v.f - 1) < 0.0003) return
  v.f = f
  const t = ctx.currentTime
  for (const p of v.partials) p.osc.frequency.setTargetAtTime(p.n * f * Math.sqrt(1 + v.s.B * p.n * p.n), t, 0.004)
}

// a hand laid on a string
export function mute(i) {
  if (ctx) stop(i, 0.03)
}

export function dispose() {
  for (let i = 0; i < 6; i++) if (voices[i]) stop(i)
}
