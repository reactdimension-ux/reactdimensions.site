// Pistol handling sounds made in the browser, no audio files: the slide
// scraping back, the slide slamming home, the striker's dry-fire click, and
// the magazine catch.

export function createPistolAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.75
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.5)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const noise = (freq, q, decay, gain, at = 0, type = 'bandpass') => {
    const t = ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq * (0.94 + Math.random() * 0.12)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.2)
    src.stop(t + decay * 4 + 0.03)
  }
  const tone = (freq, decay, gain, at = 0) => {
    const t = ctx.currentTime + at
    const o = ctx.createOscillator()
    o.type = 'triangle'
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
  return {
    // steel on steel as the slide runs back over the barrel
    scrape(strength = 1) {
      wake()
      noise(2600, 0.9, 0.03, 0.12 * strength)
      noise(5200, 2, 0.012, 0.08 * strength, 0.01)
    },
    // the slide slamming into battery: a heavy clack with a ring
    slam() {
      wake()
      noise(1800, 0.8, 0.02, 0.55)
      noise(5400, 2.5, 0.008, 0.4, 0.002)
      noise(320, 1, 0.03, 0.35, 0, 'lowpass')
      tone(2900, 0.09, 0.05)
      tone(4400, 0.06, 0.03)
    },
    // the striker falling on an empty chamber
    click() {
      wake()
      noise(4600, 3, 0.005, 0.45)
      noise(1500, 1.5, 0.012, 0.2, 0.002)
    },
    // trigger resetting as the slide comes forward
    reset() {
      wake()
      noise(5800, 4, 0.004, 0.18)
    },
    // magazine catch letting go / locking in
    mag(seated) {
      wake()
      noise(3600, 2, 0.008, 0.35)
      if (seated) noise(900, 1, 0.02, 0.3, 0.004)
      else noise(1200, 0.7, 0.05, 0.12, 0.02)
    },
    dispose() {
      ctx.close()
    },
  }
}
