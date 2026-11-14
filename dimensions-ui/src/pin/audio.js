// Bowling sounds made in the browser, no audio files: the bright, hollow
// clatter of plastic-coated maple pins knocking together and hitting the
// deck, the ball's low rumble down the lane (louder the faster it rolls),
// and the deep thock of ball meeting pin.

export function createPinAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 4
  out.connect(comp).connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 1)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  // the rumble: looped noise, low-passed, its level set by the ball's speed
  const rumble = ctx.createBufferSource()
  rumble.buffer = buf
  rumble.loop = true
  const rf = ctx.createBiquadFilter()
  rf.type = 'lowpass'
  rf.frequency.value = 180
  const rg = ctx.createGain()
  rg.gain.value = 0
  rumble.connect(rf).connect(rg).connect(out)
  rumble.start()

  const noise = (freq, q, decay, gain, at = 0, type = 'bandpass') => {
    const t = ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq * (0.9 + Math.random() * 0.2)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + decay * 4 + 0.02)
  }
  const tone = (freq, decay, gain, at = 0) => {
    const t = ctx.currentTime + at
    const o = ctx.createOscillator()
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + decay + 0.02)
  }
  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume()
  }
  const k = (s) => Math.min(1, Math.max(0.04, s))

  return {
    // pin on pin: a hollow, ringing clack (each pin rings a little differently)
    clack(s = 1) {
      wake()
      s = k(s)
      const f = 1500 + Math.random() * 900
      noise(f, 3, 0.012, 0.45 * s)
      tone(f * 0.62, 0.09, 0.12 * s)
      tone(f * 1.37, 0.05, 0.06 * s)
    },
    // a pin landing on the deck
    knock(s = 1) {
      wake()
      s = k(s)
      noise(700, 1.4, 0.025, 0.4 * s)
      tone(330 + Math.random() * 80, 0.1, 0.1 * s)
    },
    // the ball into the pins
    thock(s = 1) {
      wake()
      s = k(s)
      noise(260, 1, 0.05, 0.8 * s, 0, 'lowpass')
      noise(1900, 2, 0.015, 0.5 * s)
      tone(120, 0.12, 0.25 * s)
    },
    // ball speed (m/s) for the rumble; 0 when it is in the air or still
    roll(speed) {
      const t = ctx.currentTime
      rg.gain.setTargetAtTime(Math.min(0.5, speed * 0.05), t, 0.06)
      rf.frequency.setTargetAtTime(120 + speed * 25, t, 0.06)
    },
    dispose() {
      ctx.close()
    },
  }
}
