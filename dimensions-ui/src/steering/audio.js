// Steering wheel sounds made in the browser, no audio files: a two-tone car
// horn that sounds for as long as it is held, the tick of a scroll wheel's
// detent, and the dull clunk of the rack reaching its stop.

export function createSteeringAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.6
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.3)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume()
  }

  // the horn: two disc horns a third apart (about 500 and 405 Hz), each a
  // buzzy, slightly overdriven tone through the trumpet's resonance
  let horn = null
  const hornOn = (vol = 1) => {
    wake()
    if (horn) return
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.32 * vol, t + 0.02)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1300
    bp.Q.value = 0.7
    const shaper = ctx.createWaveShaper()
    const c = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1
      c[i] = Math.tanh(3 * x)
    }
    shaper.curve = c
    const oscs = [500, 405].map((f) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.connect(shaper)
      o.start(t)
      return o
    })
    shaper.connect(bp).connect(g).connect(out)
    horn = { g, oscs }
  }
  const hornOff = () => {
    if (!horn) return
    const t = ctx.currentTime
    horn.g.gain.cancelScheduledValues(t)
    horn.g.gain.setValueAtTime(horn.g.gain.value, t)
    horn.g.gain.linearRampToValueAtTime(0, t + 0.04)
    horn.oscs.forEach((o) => o.stop(t + 0.06))
    horn = null
  }
  const noise = (freq, q, decay, gain) => {
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t)
    src.stop(t + decay * 4 + 0.02)
  }
  return {
    hornOn,
    hornOff,
    tick() {
      wake()
      noise(3800, 5, 0.004, 0.25)
    },
    click() {
      wake()
      noise(2600, 3, 0.008, 0.35)
    },
    clunk(s = 1) {
      wake()
      noise(260, 1, 0.03, 0.5 * Math.min(1, s))
    },
    dispose() {
      hornOff()
      ctx.close()
    },
  }
}
