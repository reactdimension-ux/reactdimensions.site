// Sword sounds made in the browser, no audio files: the long, bell-like ring
// of a steel blade struck on its flat (a cluster of inharmonic bending
// modes, the higher ones dying first, louder the nearer the tip you strike),
// and the swish of the blade cutting air, rising in pitch and level with
// the speed of the tip.

export function createSwordAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.6
  const verb = ctx.createConvolver()
  const len = Math.floor(ctx.sampleRate * 2.2)
  const ir = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  }
  verb.buffer = ir
  const wet = ctx.createGain()
  wet.gain.value = 0.22
  out.connect(ctx.destination)
  out.connect(verb).connect(wet).connect(ctx.destination)

  // the swish: looped noise through a band-pass that follows the tip speed
  const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const nd = nb.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = nb
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.4
  bp.frequency.value = 400
  const sg = ctx.createGain()
  sg.gain.value = 0
  src.connect(bp).connect(sg).connect(out)
  src.start()

  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume()
  }
  return {
    // struck at `at` (0 at the guard, 1 at the tip) with strength s
    ring(at = 0.6, s = 1) {
      wake()
      const t = ctx.currentTime
      const modes = [
        [436, 3.2, 0.5],
        [1205, 2.1, 0.55],
        [2363, 1.3, 0.4],
        [3907, 0.8, 0.28],
        [5830, 0.5, 0.16],
        [8120, 0.3, 0.08],
      ]
      modes.forEach(([f, decay, amp], n) => {
        // a strike near a mode's node barely excites it
        const shape = Math.abs(Math.sin((n + 1.2) * Math.PI * at * 0.9 + 0.3))
        const o = ctx.createOscillator()
        o.frequency.value = f * (0.995 + Math.random() * 0.01)
        const o2 = ctx.createOscillator()
        o2.frequency.value = o.frequency.value * 1.0025 // a slow beat from the blade's two flats
        const g = ctx.createGain()
        const peak = amp * shape * Math.min(1, s) * 0.35
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(peak, t + 0.002)
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
        o.connect(g)
        o2.connect(g)
        g.connect(out)
        o.start(t)
        o2.start(t)
        o.stop(t + decay + 0.05)
        o2.stop(t + decay + 0.05)
      })
    },
    // tip speed in m/s
    swish(speed) {
      const t = ctx.currentTime
      const v = Math.max(0, speed - 2)
      sg.gain.setTargetAtTime(Math.min(0.5, v * v * 0.004), t, 0.03)
      bp.frequency.setTargetAtTime(300 + v * 90, t, 0.03)
    },
    start: wake,
    dispose() {
      ctx.close()
    },
  }
}
