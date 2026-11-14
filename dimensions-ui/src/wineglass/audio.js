// The ring of a wine glass, made in the browser (no audio files).
//
// A struck glass bowl rings in its bending modes: a fundamental (four
// nodes round the rim) and higher modes at roughly 2.3, 4.1 and 6.2 times
// it, the higher ones dying away fastest. Each mode is really a pair a hair
// apart in pitch (the bowl is never perfectly round), which gives the slow
// shimmer you hear as it fades. Wine lowers the pitch: the liquid moves
// with the wall, so (after A. P. French, "In vino veritas", 1983)
//   (f0 / f)^2 = 1 + k (h / H)^4
// with h the wine depth and H the bowl's height; k is about 3.6 for a thin
// glass this size. Wine also damps the ring.

const MODES = [
  [1, 1, 3.8],
  [2.32, 0.32, 1.6],
  [4.08, 0.14, 0.8],
  [6.24, 0.06, 0.4],
]

export const pitchFor = (f0, depthFraction) => f0 / Math.sqrt(1 + 3.6 * Math.pow(Math.max(0, depthFraction), 4))

export function createGlassAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.5
  const comp = ctx.createDynamicsCompressor()
  out.connect(comp).connect(ctx.destination)

  // a short burst of noise for the strike itself
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate)
  const nd = noise.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004))

  return {
    // strength 0..1, f the fundamental, damping 0..1 (how much wine)
    ring(f, strength = 1, damping = 0) {
      if (ctx.state === 'suspended') ctx.resume()
      const t = ctx.currentTime + 0.005
      const a = 0.25 + 0.75 * strength
      for (const [ratio, amp, decay] of MODES) {
        const d = decay * (1 - 0.65 * damping)
        for (const detune of [-0.35, 0.35]) {
          const o = ctx.createOscillator()
          o.type = 'sine'
          o.frequency.value = f * ratio + detune * ratio
          const g = ctx.createGain()
          g.gain.setValueAtTime(0, t)
          g.gain.linearRampToValueAtTime(amp * a * 0.22, t + 0.002)
          g.gain.setTargetAtTime(0, t + 0.002, d / 4.6)
          o.connect(g).connect(out)
          o.start(t)
          o.stop(t + d + 0.1)
        }
      }
      const n = ctx.createBufferSource()
      n.buffer = noise
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 3500
      const ng = ctx.createGain()
      ng.gain.value = 0.25 * a
      n.connect(hp).connect(ng).connect(out)
      n.start(t)
    },
    dispose() {
      ctx.close()
    },
  }
}
