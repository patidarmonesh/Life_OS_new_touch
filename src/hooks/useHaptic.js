/**
 * Premium Haptic Feedback System
 * - Android: Uses Vibration API with calibrated patterns
 * - iOS: Uses Web Audio micro-click fallback (psychoacoustic tap)
 */

const hasVibrationAPI = typeof navigator !== 'undefined' && 'vibrate' in navigator

// Audio-Tactile fallback for iOS Safari (no vibration API)
let audioCtx = null
function playAudioTap(type = 'light') {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!audioCtx) audioCtx = new AC()
    if (audioCtx.state === 'suspended') audioCtx.resume()

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    const now = audioCtx.currentTime
    osc.type = 'sine'

    if (type === 'success') {
      osc.frequency.setValueAtTime(140, now)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(now)
      osc.stop(now + 0.015)
    } else {
      osc.frequency.setValueAtTime(120, now)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(now)
      osc.stop(now + 0.008)
    }
  } catch { /* Audio blocked before user interaction */ }
}

function isHapticsEnabled() {
  try {
    const rawMeta = localStorage.getItem('lifeos-module-state-v1:settings')
    if (rawMeta) {
      const parsed = JSON.parse(rawMeta)
      return parsed.preferences?.hapticsEnabled !== false
    }
  } catch { /* Optional device capability unavailable. */ }
  return true
}

function triggerHaptic(pattern, audioType = 'light') {
  if (!isHapticsEnabled()) return
  if (hasVibrationAPI) {
    try { navigator.vibrate(pattern) } catch { /* Optional device capability unavailable. */ }
  } else {
    playAudioTap(audioType)
  }
}

/** Light tap — button press, tab switch */
export function hapticLight() { triggerHaptic(10) }

/** Medium tap — primary actions, confirms */
export function hapticMedium() { triggerHaptic(20) }

/** Success — double pulse for completions */
export function hapticSuccess() { triggerHaptic([10, 50, 20], 'success') }

/** Warning — dual buzz for caution */
export function hapticWarning() { triggerHaptic([30, 40, 30]) }

/** Error — triple sharp buzz */
export function hapticError() { triggerHaptic([50, 30, 50, 30, 50]) }

export const haptic = hapticLight
