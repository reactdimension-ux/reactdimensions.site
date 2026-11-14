// Face board sounds made in the browser, no audio files: the light plastic
// clack of a frame dropping onto the tray, and the snap of one clicking back
// up into its detent.

export function createBoardAudio() {
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
  const noise = (freq, q, decay, gain) => {
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq * (0.9 + Math.random() * 0.2)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.1)
    src.stop(t + decay * 4 + 0.02)
  }
  const tone = (freq, decay, gain) => {
    const t = ctx.currentTime
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
  const k = (s) => Math.min(1, Math.max(0.05, s))
  return {
    // a frame landing flat on the tray
    clack(s = 1) {
      wake()
      s = k(s)
      noise(2400, 2.5, 0.01, 0.5 * s)
      tone(900 + Math.random() * 300, 0.05, 0.08 * s)
    },
    // a frame snapping up into its detent
    snap(s = 1) {
      wake()
      s = k(s)
      noise(4200, 4, 0.005, 0.4 * s)
    },
    dispose() {
      ctx.close()
    },
  }
}
