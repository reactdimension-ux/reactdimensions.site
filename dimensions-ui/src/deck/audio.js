// Card sounds made in the browser, no audio files: the soft whoosh and tap of
// a card turning over, and the snap of cards dealt one after another.

export function createDeckAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.5)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  // a filtered noise burst; `sweep` glides the filter for a whoosh
  const noise = (freq, q, attack, decay, gain, at = 0, sweep = 1) => {
    const t = ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = q
    f.frequency.setValueAtTime(freq, t)
    f.frequency.exponentialRampToValueAtTime(freq * sweep, t + attack + decay)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.2)
    src.stop(t + attack + decay + 0.02)
  }
  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume()
  }
  return {
    flip() {
      wake()
      noise(1400, 0.7, 0.05, 0.12, 0.12, 0, 2.4)
      noise(3800, 2, 0.002, 0.03, 0.18, 0.2)
    },
    deal(n) {
      wake()
      for (let i = 0; i < n; i++) {
        noise(2600, 0.9, 0.01, 0.06, 0.16, i * 0.08, 1.8)
        noise(4400, 2.5, 0.002, 0.02, 0.12, i * 0.08 + 0.45)
      }
    },
    dispose() {
      ctx.close()
    },
  }
}
