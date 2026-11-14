// Roulette sounds made in the browser, no audio files: the ball's hiss as
// it rolls round the track (louder and higher the faster it goes) and a
// click each time it strikes a deflector or a pocket separator.

export function createRouletteAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.6
  out.connect(ctx.destination)
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  // the roll: looping noise through a band-pass that follows the ball's speed
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.4
  const level = ctx.createGain()
  level.gain.value = 0
  src.connect(band).connect(level).connect(out)
  src.start()

  return {
    // speed in metres a second, 0 to stop
    roll(speed) {
      if (ctx.state === 'suspended') ctx.resume()
      const t = ctx.currentTime
      const k = Math.min(1, speed / 3.5)
      level.gain.setTargetAtTime(k * k * 0.5, t, 0.05)
      band.frequency.setTargetAtTime(500 + k * 2600, t, 0.05)
    },
    click(strength = 1) {
      if (ctx.state === 'suspended') ctx.resume()
      const t = ctx.currentTime
      const s = ctx.createBufferSource()
      s.buffer = buf
      const f = ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 3200 * (0.85 + Math.random() * 0.3)
      f.Q.value = 5
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.5 * Math.min(1, 0.25 + strength), t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
      s.connect(f).connect(g).connect(out)
      s.start(t, Math.random())
      s.stop(t + 0.08)
    },
    dispose() {
      ctx.close()
    },
  }
}
