// Web Audio API Synthesizer Sound Engine for premium user interactions

let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  return audioCtx
}

// Read settings to check if sound is enabled
function isSoundEnabled() {
  return typeof document !== 'undefined' && document.documentElement.dataset.sound === 'enabled'
}

/**
 * Play a beautiful ascending success arpeggio arpeggio (C5 -> E5 -> G5 -> C6)
 */
export function playSuccessSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return
  
  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
  const duration = 0.08

  notes.forEach((freq, idx) => {
    const startTime = now + idx * duration
    
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, startTime)

    gainNode.gain.setValueAtTime(0.08, startTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start(startTime)
    osc.stop(startTime + 0.3)
  })
}

/**
 * Play a subtle mechanical acoustic-like click tick (high frequency sine decaying in 0.015s)
 */
export function playSubtleClick() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(3200, now)
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.012)

  gainNode.gain.setValueAtTime(0.03, now)
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.015)

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.015)
}

/**
 * Play a pleasant double-chime notice sound (A5 -> C#6)
 */
export function playNoticeChime() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const now = ctx.currentTime
  const notes = [880.00, 1109.73] // A5, C#6
  const spacing = 0.12

  notes.forEach((freq, idx) => {
    const startTime = now + idx * spacing
    
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, startTime)

    gainNode.gain.setValueAtTime(0.06, startTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start(startTime)
    osc.stop(startTime + 0.25)
  })
}

/**
 * Play a low dual-tone warning indicator (B2 -> Bb2)
 */
export function playWarningBeep() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const now = ctx.currentTime
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc1.type = 'triangle'
  osc1.frequency.setValueAtTime(146.83, now) // D3
  osc1.frequency.linearRampToValueAtTime(110.00, now + 0.22) // A2

  osc2.type = 'sawtooth'
  osc2.frequency.setValueAtTime(145.00, now)
  osc2.frequency.linearRampToValueAtTime(108.00, now + 0.22)

  gainNode.gain.setValueAtTime(0.07, now)
  gainNode.gain.linearRampToValueAtTime(0.001, now + 0.22)

  osc1.connect(gainNode)
  osc2.connect(gainNode)
  gainNode.connect(ctx.destination)

  osc1.start(now)
  osc2.start(now)
  osc1.stop(now + 0.22)
  osc2.stop(now + 0.22)
}
