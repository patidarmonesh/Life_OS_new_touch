import { useState, useRef, useEffect } from 'react'

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

// Generate Brown Noise Buffer (smooth waterfall/wind rumble)
function createBrownNoiseBuffer(ctx) {
  const bufferSize = ctx.sampleRate * 2 // 2 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  
  let lastOut = 0.0
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1
    data[i] = (lastOut + 0.02 * white) / 1.02
    lastOut = data[i]
    data[i] *= 3.5 // compensation gain
  }
  
  return buffer
}

// Generate White Noise Buffer (filtered rain droplet texture)
function createWhiteNoiseBuffer(ctx) {
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  
  return buffer
}

export function useSoundscape() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volumes, setVolumes] = useState({
    brown: 0.3,
    rain: 0.2,
    beats: 0.1,
  })

  // Nodes storage
  const nodesRef = useRef({
    brownSource: null,
    brownGain: null,
    
    rainSource: null,
    rainGain: null,
    rainFilter: null,
    
    beatsOscL: null,
    beatsOscR: null,
    beatsGain: null,
    beatsPannerL: null,
    beatsPannerR: null,
  })

  // Synchronize gain volumes
  useEffect(() => {
    if (!isPlaying) return
    const nodes = nodesRef.current

    if (nodes.brownGain) nodes.brownGain.gain.setValueAtTime(volumes.brown, audioCtx.currentTime)
    if (nodes.rainGain) nodes.rainGain.gain.setValueAtTime(volumes.rain, audioCtx.currentTime)
    if (nodes.beatsGain) nodes.beatsGain.gain.setValueAtTime(volumes.beats, audioCtx.currentTime)
  }, [volumes, isPlaying])

  const stopAll = () => {
    const nodes = nodesRef.current
    
    // Stop brown noise
    if (nodes.brownSource) {
      try { nodes.brownSource.stop() } catch { /* Optional device capability unavailable. */ }
      nodes.brownSource = null
    }
    nodes.brownGain = null

    // Stop rain noise
    if (nodes.rainSource) {
      try { nodes.rainSource.stop() } catch { /* Optional device capability unavailable. */ }
      nodes.rainSource = null
    }
    nodes.rainGain = null
    nodes.rainFilter = null

    // Stop binaural beats
    if (nodes.beatsOscL) {
      try { nodes.beatsOscL.stop() } catch { /* Optional device capability unavailable. */ }
      nodes.beatsOscL = null
    }
    if (nodes.beatsOscR) {
      try { nodes.beatsOscR.stop() } catch { /* Optional device capability unavailable. */ }
      nodes.beatsOscR = null
    }
    nodes.beatsOscL = null
    nodes.beatsOscR = null
    nodes.beatsGain = null
    nodes.beatsPannerL = null
    nodes.beatsPannerR = null

    setIsPlaying(false)
  }

  const startAll = () => {
    const ctx = getAudioContext()
    if (!ctx) return
    
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const nodes = nodesRef.current

    // 1. Brown Noise setup
    const brownBuffer = createBrownNoiseBuffer(ctx)
    nodes.brownSource = ctx.createBufferSource()
    nodes.brownSource.buffer = brownBuffer
    nodes.brownSource.loop = true
    
    nodes.brownGain = ctx.createGain()
    nodes.brownGain.gain.setValueAtTime(volumes.brown, ctx.currentTime)
    
    nodes.brownSource.connect(nodes.brownGain)
    nodes.brownGain.connect(ctx.destination)
    nodes.brownSource.start(0)

    // 2. Rain Sound setup (Filtered white noise + bandpass)
    const rainBuffer = createWhiteNoiseBuffer(ctx)
    nodes.rainSource = ctx.createBufferSource()
    nodes.rainSource.buffer = rainBuffer
    nodes.rainSource.loop = true

    nodes.rainFilter = ctx.createBiquadFilter()
    nodes.rainFilter.type = 'bandpass'
    nodes.rainFilter.frequency.value = 1000
    nodes.rainFilter.Q.value = 1.0

    nodes.rainGain = ctx.createGain()
    nodes.rainGain.gain.setValueAtTime(volumes.rain, ctx.currentTime)

    nodes.rainSource.connect(nodes.rainFilter)
    nodes.rainFilter.connect(nodes.rainGain)
    nodes.rainGain.connect(ctx.destination)
    nodes.rainSource.start(0)

    // 3. Binaural Beats setup (Left ear 140Hz, Right ear 146Hz for a 6Hz Theta wave)
    nodes.beatsOscL = ctx.createOscillator()
    nodes.beatsOscL.type = 'sine'
    nodes.beatsOscL.frequency.value = 140

    nodes.beatsOscR = ctx.createOscillator()
    nodes.beatsOscR.type = 'sine'
    nodes.beatsOscR.frequency.value = 146

    nodes.beatsPannerL = ctx.createStereoPanner()
    nodes.beatsPannerL.pan.value = -1.0

    nodes.beatsPannerR = ctx.createStereoPanner()
    nodes.beatsPannerR.pan.value = 1.0

    nodes.beatsGain = ctx.createGain()
    nodes.beatsGain.gain.setValueAtTime(volumes.beats, ctx.currentTime)

    nodes.beatsOscL.connect(nodes.beatsPannerL)
    nodes.beatsPannerL.connect(nodes.beatsGain)

    nodes.beatsOscR.connect(nodes.beatsPannerR)
    nodes.beatsPannerR.connect(nodes.beatsGain)

    nodes.beatsGain.connect(ctx.destination)

    nodes.beatsOscL.start(0)
    nodes.beatsOscR.start(0)

    setIsPlaying(true)
  }

  const togglePlay = () => {
    if (isPlaying) {
      stopAll()
    } else {
      startAll()
    }
  }

  const adjustVolume = (type, val) => {
    const pct = parseFloat(val)
    setVolumes(prev => ({
      ...prev,
      [type]: pct,
    }))
  }

  // Auto clean up on unmount
  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [])

  return {
    isPlaying,
    volumes,
    togglePlay,
    adjustVolume,
    stopAll,
  }
}
