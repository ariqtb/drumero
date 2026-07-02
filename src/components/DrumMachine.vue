<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as Tone from 'tone'
import TrackRow from './TrackRow.vue'
import RadarTempoController from './RadarTempoController.vue'
import RadarBeatVisualizer from './RadarBeatVisualizer.vue'

interface TrackData {
  id: string
  name: string
  steps: boolean[]
  velocities: number[]
  subdivision: string
  playbackRate: number
  isMuted: boolean
  isSolo: boolean
  volume: number
  activeStep: number | null
  color: string
  soundPreset: string
}

// Master State
const bpm = ref(120)
const isPlaying = ref(false)
const masterVolume = ref(-6) // dB
const isAudioInitialized = ref(false)

// Track State
const tracks = ref<TrackData[]>([
  {
    id: 'kick',
    name: 'Kick Drum',
    steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    velocities: [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
    subdivision: '16n',
    playbackRate: 1.0,
    isMuted: false,
    isSolo: false,
    volume: -6,
    activeStep: null,
    color: 'kick',
    soundPreset: 'classic'
  },
  {
    id: 'snare',
    name: 'Snare Drum',
    steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    velocities: [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
    subdivision: '16n',
    playbackRate: 1.0,
    isMuted: false,
    isSolo: false,
    volume: -12,
    activeStep: null,
    color: 'snare',
    soundPreset: 'acoustic'
  },
  {
    id: 'hihat',
    name: 'Hi-Hat',
    steps: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
    velocities: [1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0],
    subdivision: '16n',
    playbackRate: 1.0,
    isMuted: false,
    isSolo: false,
    volume: -10,
    activeStep: null,
    color: 'hihat',
    soundPreset: 'closed'
  }
])

const selectedKit = ref('synthesizers')

const kitsConfig = {
  tr808: {
    kick: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808bd/BD0000.WAV',
    snare: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808sd/SD0000.WAV',
    hihat: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808/CH.WAV'
  },
  cr78: {
    kick: 'https://oramics.github.io/sampled/DM/CR-78/samples/kick.wav',
    snare: 'https://oramics.github.io/sampled/DM/CR-78/samples/snare.wav',
    hihat: 'https://oramics.github.io/sampled/DM/CR-78/samples/hihat.wav'
  },
  tr909: {
    kick: 'https://oramics.github.io/sampled/DM/TR-909/Detroit/samples/kick.wav',
    snare: 'https://oramics.github.io/sampled/DM/TR-909/Detroit/samples/snare.wav',
    hihat: 'https://oramics.github.io/sampled/DM/TR-909/Detroit/samples/hihat-closed.wav'
  },
  linndrum: {
    kick: 'https://oramics.github.io/sampled/DM/LM-2/samples/kick.wav',
    snare: 'https://oramics.github.io/sampled/DM/LM-2/samples/snare.wav',
    hihat: 'https://oramics.github.io/sampled/DM/LM-2/samples/hihat-closed.wav'
  },
  acoustic: {
    kick: 'https://tonejs.github.io/audio/drum-samples/kick.mp3',
    snare: 'https://tonejs.github.io/audio/drum-samples/snare.mp3',
    hihat: 'https://tonejs.github.io/audio/drum-samples/hihat.mp3'
  }
}

// Non-reactive Tone.js references to prevent Vue Proxy overhead
let kickSynth: Tone.MembraneSynth | null = null
let snareSynth: Tone.NoiseSynth | null = null
let snareOsc: Tone.Synth | null = null
let hihatSynth: Tone.MetalSynth | null = null
const samplePlayers: Record<string, Tone.Player> = {}

const channels: Record<string, Tone.Channel> = {}
const sequences: Record<string, Tone.Sequence> = {}

// Initialize Audio Context & Synthesis Engine
async function initAudio() {
  if (isAudioInitialized.value) return

  await Tone.start()

  // 1. Create Tone.Channels for mute, solo, and volume control per track
  channels['kick'] = new Tone.Channel({ volume: -6, mute: false, solo: false }).toDestination()
  channels['snare'] = new Tone.Channel({ volume: -12, mute: false, solo: false }).toDestination()
  channels['hihat'] = new Tone.Channel({ volume: -10, mute: false, solo: false }).toDestination()

  // Apply track configuration to channels
  tracks.value.forEach((track) => {
    const ch = channels[track.id]
    if (ch) {
      ch.volume.value = track.volume <= -40 ? -Infinity : track.volume
      ch.mute = track.isMuted
      ch.solo = track.isSolo
    }
  })

  // 2. Synthesizer definitions
  kickSynth = new Tone.MembraneSynth({
    envelope: {
      sustain: 0,
      attack: 0.002,
      decay: 0.35,
      release: 0.2
    },
    octaves: 5
  }).connect(channels['kick'])

  snareSynth = new Tone.NoiseSynth({
    noise: {
      type: 'pink'
    },
    envelope: {
      attack: 0.001,
      decay: 0.15,
      sustain: 0,
      release: 0.1
    }
  }).connect(channels['snare'])

  snareOsc = new Tone.Synth({
    oscillator: {
      type: 'triangle'
    },
    envelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0,
      release: 0.1
    }
  }).connect(channels['snare'])

  hihatSynth = new Tone.MetalSynth({
    envelope: {
      attack: 0.001,
      decay: 0.05,
      release: 0.05
    },
    resonance: 8000,
    harmonicity: 5.1,
    modulationIndex: 32
  }).connect(channels['hihat'])

  // Load sample players from CDN for all kits dynamically
  Object.entries(kitsConfig).forEach(([kitKey, kitSamples]) => {
    Object.entries(kitSamples).forEach(([instrumentId, url]) => {
      const playerKey = `sample_${kitKey}_${instrumentId}`
      samplePlayers[playerKey] = new Tone.Player(url).connect(channels[instrumentId])
    })
  })

  // 3. Setup separate sequences and apply presets
  tracks.value.forEach((track) => {
    applyPresetSettings(track.id, track.soundPreset)
    setupSequence(track)
  })

  // 4. Bind master configurations
  Tone.Transport.bpm.value = bpm.value
  Tone.Destination.volume.value = masterVolume.value <= -40 ? -Infinity : masterVolume.value

  isAudioInitialized.value = true
}

// Sequence Scheduling & Audio-Visual Sync
function setupSequence(track: TrackData) {
  // Dispose existing sequencer if any to prevent duplicate loops
  const existingSeq = sequences[track.id]
  if (existingSeq) {
    existingSeq.dispose()
  }

  const seq = new Tone.Sequence(
    (time, stepIndex) => {
      // Audio execution
      if (track.steps[stepIndex]) {
        const velocity = track.velocities[stepIndex] !== undefined ? track.velocities[stepIndex] : 1.0
        triggerInstrument(track.id, time, velocity)
      }

      // Visual Synchronization via Tone.Draw.
      // Schedules DOM state updates to coincide precisely with the sound delivery.
      Tone.Draw.schedule(() => {
        track.activeStep = stepIndex
      }, time)
    },
    Array.from({ length: 16 }, (_, i) => i),
    track.subdivision
  )

  // Configure speed multiplier relative to master Transport
  seq.playbackRate = track.playbackRate
  
  // Start sequence at point zero on Transport timeline
  seq.start(0)
  
  sequences[track.id] = seq
}

// Play Synthesized Sounds (Fallback or Main Synth Engine)
function playSynth(trackId: string, preset: string, time: number, velocity: number) {
  if (trackId === 'kick' && kickSynth) {
    if (preset === 'sub808') {
      kickSynth.triggerAttackRelease('A0', '4n', time, velocity)
    } else if (preset === 'punchy') {
      kickSynth.triggerAttackRelease('C1', '8n', time, velocity)
    } else if (preset === 'soft') {
      kickSynth.triggerAttackRelease('G0', '8n', time, velocity * 0.7)
    } else {
      kickSynth.triggerAttackRelease('C1', '8n', time, velocity)
    }
  } else if (trackId === 'snare' && snareSynth) {
    if (preset === 'noise_only') {
      snareSynth.triggerAttackRelease('8n', time, velocity)
    } else if (preset === 'electronic') {
      snareSynth.triggerAttackRelease('16n', time, velocity)
      if (snareOsc) {
        snareOsc.triggerAttackRelease('A2', '16n', time, velocity * 0.5)
      }
    } else if (preset === 'synthesized') {
      snareSynth.triggerAttackRelease('32n', time, velocity)
      if (snareOsc) {
        snareOsc.triggerAttackRelease('G2', '16n', time, velocity * 0.6)
      }
    } else { // acoustic
      snareSynth.triggerAttackRelease('16n', time, velocity)
      if (snareOsc) {
        snareOsc.triggerAttackRelease('E2', '16n', time, velocity * 0.6)
      }
    }
  } else if (trackId === 'hihat' && hihatSynth) {
    if (preset === 'sizzle') {
      hihatSynth.triggerAttackRelease('F6', '2n', time, velocity * 0.6)
    } else if (preset === 'open') {
      hihatSynth.triggerAttackRelease('F#6', '4n', time, velocity * 0.8)
    } else {
      hihatSynth.triggerAttackRelease('G6', '32n', time, velocity)
    }
  }
}

// Trigger Synthesis Engines or Sample Players at Scheduled Ticks
function triggerInstrument(trackId: string, time: number, velocity: number) {
  const track = tracks.value.find((t) => t.id === trackId)
  
  if (selectedKit.value === 'synthesizers') {
    // 1. Synthesizer mode: Play custom synth preset selected on each individual track
    const preset = track ? track.soundPreset : 'default'
    
    // Play sample preset if chosen on individual track
    if (preset.startsWith('sample_')) {
      const player = samplePlayers[preset]
      if (player && player.loaded) {
        player.start(time)
        return
      }
    }
    
    playSynth(trackId, preset, time, velocity)
  } else {
    // 2. Global Drum Kit mode: Play sample from the globally selected drum kit
    const playerKey = `sample_${selectedKit.value}_${trackId}`
    const player = samplePlayers[playerKey]
    if (player && player.loaded) {
      player.start(time)
    } else {
      // Fallback to default synthesizers if sample is loading/offline
      const fallbackPreset = trackId === 'kick' ? 'classic' : (trackId === 'snare' ? 'acoustic' : 'closed')
      playSynth(trackId, fallbackPreset, time, velocity)
    }
  }
}

// Master Transport Actions
async function togglePlay() {
  if (!isAudioInitialized.value) {
    await initAudio()
  }

  if (isPlaying.value) {
    Tone.Transport.stop()
    // Reset visual indicators
    tracks.value.forEach((t) => (t.activeStep = null))
    isPlaying.value = false
  } else {
    // Start Transport (and all child sequences)
    Tone.Transport.start()
    isPlaying.value = true
  }
}

function updateBpm(event: Event) {
  const target = event.target as HTMLInputElement
  const val = parseInt(target.value)
  bpm.value = val
  if (isAudioInitialized.value) {
    Tone.Transport.bpm.value = val
  }
}

function updateMasterVolume(event: Event) {
  const target = event.target as HTMLInputElement
  const val = parseFloat(target.value)
  masterVolume.value = val
  if (isAudioInitialized.value) {
    Tone.Destination.volume.value = val <= -40 ? -Infinity : val
  }
}

function handleWheel(event: WheelEvent) {
  const target = event.currentTarget as HTMLInputElement
  if (!target) return

  const min = parseFloat(target.min || '0')
  const max = parseFloat(target.max || '100')
  const step = parseFloat(target.step || '1')
  const val = parseFloat(target.value)

  // Normalize deltaY across different browsers and scrolling modes
  let deltaY = event.deltaY
  if (event.deltaMode === 1) { // Line mode (Firefox)
    deltaY *= 33
  } else if (event.deltaMode === 2) { // Page mode
    deltaY *= 400
  }

  // Proportional but heavily damped delta: changes by approx 2% of range per 100px scroll
  const range = max - min
  const multiplier = range * 0.0002
  let delta = deltaY * multiplier

  // Ensure it changes by at least 1 step, and is aligned to the slider's step value
  if (Math.abs(delta) < step) {
    delta = deltaY > 0 ? step : -step
  } else {
    delta = Math.round(delta / step) * step
  }

  const newVal = Math.max(min, Math.min(max, val + delta))

  target.value = newVal.toString()
  target.dispatchEvent(new Event('input'))
}

// Track Control Emits handlers
function toggleStep(trackId: string, stepIndex: number) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    track.steps[stepIndex] = !track.steps[stepIndex]
    track.velocities[stepIndex] = track.steps[stepIndex] ? 1.0 : 0.0
  }
}

function handleFillSteps(trackId: string, interval: number) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    if (interval === 0) {
      track.steps = Array(16).fill(false)
      track.velocities = Array(16).fill(0.0)
    } else {
      track.steps = Array.from({ length: 16 }, (_, i) => i % interval === 0)
      track.velocities = track.steps.map((active) => active ? 1.0 : 0.0)
    }
  }
}

function handleUpdateStepVelocity(trackId: string, stepIndex: number, velocity: number) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    if (velocity <= 0.15) {
      track.steps[stepIndex] = false
      track.velocities[stepIndex] = 0
    } else {
      track.steps[stepIndex] = true
      track.velocities[stepIndex] = velocity
    }
  }
}

function handleUpdateSubdivision(trackId: string, value: string) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    track.subdivision = value
    if (isAudioInitialized.value) {
      setupSequence(track)
    }
  }
}

function handleUpdatePlaybackRate(trackId: string, value: number) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    track.playbackRate = value
    if (isAudioInitialized.value) {
      const seq = sequences[trackId]
      if (seq) {
        seq.playbackRate = value
      }
    }
  }
}

function handleToggleMute(trackId: string) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    track.isMuted = !track.isMuted
    if (isAudioInitialized.value) {
      const ch = channels[trackId]
      if (ch) {
        ch.mute = track.isMuted
      }
    }
  }
}

function handleToggleSolo(trackId: string) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    track.isSolo = !track.isSolo
    if (isAudioInitialized.value) {
      const ch = channels[trackId]
      if (ch) {
        ch.solo = track.isSolo
      }
    }
  }
}

function handleUpdateVolume(trackId: string, value: number) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    track.volume = value
    if (isAudioInitialized.value) {
      const ch = channels[trackId]
      if (ch) {
        ch.volume.value = value <= -40 ? -Infinity : value
      }
    }
  }
}

function handleUpdatePreset(trackId: string, value: string) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    track.soundPreset = value
    if (isAudioInitialized.value) {
      applyPresetSettings(trackId, value)
    }
  }
}

function applyPresetSettings(trackId: string, preset: string) {
  if (trackId === 'kick' && kickSynth) {
    if (preset === 'sub808') {
      kickSynth.envelope.decay = 0.8
      kickSynth.envelope.sustain = 0.05
      kickSynth.octaves = 8
    } else if (preset === 'punchy') {
      kickSynth.envelope.decay = 0.2
      kickSynth.envelope.sustain = 0
      kickSynth.octaves = 6
    } else if (preset === 'soft') {
      kickSynth.envelope.decay = 0.15
      kickSynth.envelope.sustain = 0
      kickSynth.octaves = 3
    } else { // classic
      kickSynth.envelope.decay = 0.35
      kickSynth.envelope.sustain = 0
      kickSynth.octaves = 5
    }
  } else if (trackId === 'snare' && snareSynth) {
    if (preset === 'electronic') {
      snareSynth.noise.type = 'white'
      snareSynth.envelope.decay = 0.1
    } else if (preset === 'noise_only') {
      snareSynth.noise.type = 'white'
      snareSynth.envelope.decay = 0.25
    } else if (preset === 'synthesized') {
      snareSynth.noise.type = 'pink'
      snareSynth.envelope.decay = 0.08
    } else { // acoustic
      snareSynth.noise.type = 'pink'
      snareSynth.envelope.decay = 0.15
    }
  } else if (trackId === 'hihat' && hihatSynth) {
    if (preset === 'open') {
      hihatSynth.envelope.decay = 0.3
      hihatSynth.envelope.release = 0.3
      hihatSynth.resonance = 7000
      hihatSynth.harmonicity = 5.1
      hihatSynth.modulationIndex = 32
    } else if (preset === 'industrial') {
      hihatSynth.envelope.decay = 0.04
      hihatSynth.envelope.release = 0.04
      hihatSynth.resonance = 5000
      hihatSynth.harmonicity = 8.5
      hihatSynth.modulationIndex = 64
    } else if (preset === 'sizzle') {
      hihatSynth.envelope.decay = 0.6
      hihatSynth.envelope.release = 0.6
      hihatSynth.resonance = 9000
      hihatSynth.harmonicity = 3.2
      hihatSynth.modulationIndex = 16
    } else { // closed
      hihatSynth.envelope.decay = 0.05
      hihatSynth.envelope.release = 0.05
      hihatSynth.resonance = 8000
      hihatSynth.harmonicity = 5.1
      hihatSynth.modulationIndex = 32
    }
  }
}

// Pattern Helper Utilities
function clearPattern() {
  tracks.value.forEach((track) => {
    track.steps = Array(16).fill(false)
    track.velocities = Array(16).fill(0.0)
    track.activeStep = null
  })
}

function randomizePattern() {
  tracks.value.forEach((track) => {
    track.steps = Array.from({ length: 16 }, () => Math.random() > 0.65)
    track.velocities = track.steps.map((active) => active ? 1.0 : 0.0)
  })
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.code === 'Space') {
    e.preventDefault()
    togglePlay()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

// Component Teardown Cleanup
onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  
  Tone.Transport.stop()
  Object.values(sequences).forEach((seq) => seq.dispose())
  Object.values(channels).forEach((ch) => ch.dispose())
  Object.values(samplePlayers).forEach((player) => player.dispose())
  
  if (kickSynth) kickSynth.dispose()
  if (snareSynth) snareSynth.dispose()
  if (snareOsc) snareOsc.dispose()
  if (hihatSynth) hihatSynth.dispose()
})
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <h1 class="app-title">Drum Loop Explorer</h1>
      <p class="app-subtitle">Explore independent tempos & subdivisions per track in real-time</p>
    </header>

    <!-- Master Control Dashboard -->
    <section class="master-controls glass-panel" aria-label="Master Controls" style="margin-bottom: 1.5rem;">
      <div class="master-group" style="gap: 1rem;">
        <button
          type="button"
          :class="['btn', 'btn-primary', 'btn-play', { 'btn-active': isPlaying }]"
          @click="togglePlay"
        >
          <span v-if="isPlaying">⏸ Pause</span>
          <span v-else>▶ Play</span>
        </button>

        <div class="select-wrapper">
          <select
            v-model="selectedKit"
            class="custom-select"
            aria-label="Global Drum Kit"
            style="min-width: 170px;"
          >
            <option value="synthesizers">🎛 Synth Engine</option>
            <option value="tr808">🥁 Roland TR-808</option>
            <option value="tr909">🥁 Roland TR-909</option>
            <option value="linndrum">🥁 LinnDrum LM-2</option>
            <option value="cr78">🥁 Roland CR-78</option>
            <option value="acoustic">🥁 Acoustic Kit</option>
          </select>
        </div>
      </div>

      <!-- BPM control -->
      <div class="master-group">
        <div class="slider-container">
          <div class="slider-header">
            <span class="control-label">Master BPM</span>
            <span class="slider-value">{{ bpm }} BPM</span>
          </div>
          <input
            type="range"
            min="60"
            max="200"
            step="1"
            :value="bpm"
            aria-label="Master BPM"
            @input="updateBpm"
            @wheel.prevent="handleWheel"
          />
        </div>

        <!-- Master Volume -->
        <div class="slider-container">
          <div class="slider-header">
            <span class="control-label">Master Volume</span>
            <span class="slider-value">
              {{ masterVolume <= -40 ? 'Mute' : `${masterVolume > 0 ? '+' : ''}${masterVolume.toFixed(0)} dB` }}
            </span>
          </div>
          <input
            type="range"
            min="-40"
            max="6"
            step="1"
            :value="masterVolume"
            aria-label="Master Volume"
            @input="updateMasterVolume"
            @wheel.prevent="handleWheel"
          />
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="master-group">
        <button type="button" class="btn" @click="randomizePattern">
          🎲 Randomize
        </button>
        <button type="button" class="btn btn-danger-outline" @click="clearPattern">
          🗑 Clear Grid
        </button>
      </div>
    </section>

    <!-- Radar Controller & Visualizer side-by-side -->
    <div class="radars-layout-horizontal">
      <RadarTempoController
        :tracks="tracks"
        @toggle-step="toggleStep"
      />
      
      <RadarBeatVisualizer
        :tracks="tracks"
        @update-step-velocity="handleUpdateStepVelocity"
        @toggle-step="toggleStep"
      />
    </div>

    <!-- Track Grid Control Board -->
    <main class="track-board">
      <TrackRow
        v-for="track in tracks"
        :key="track.id"
        :track="track"
        :is-global-kit-active="selectedKit !== 'synthesizers'"
        @toggle-step="(index) => toggleStep(track.id, index)"
        @update-subdivision="(value) => handleUpdateSubdivision(track.id, value)"
        @update-playback-rate="(value) => handleUpdatePlaybackRate(track.id, value)"
        @toggle-mute="handleToggleMute(track.id)"
        @toggle-solo="handleToggleSolo(track.id)"
        @update-volume="(value) => handleUpdateVolume(track.id, value)"
        @fill-steps="(value) => handleFillSteps(track.id, value)"
        @update-preset="(value) => handleUpdatePreset(track.id, value)"
      />
    </main>

    <!-- Visual Sync Explanation Guide -->
    <footer class="info-section glass-panel">
      <h2 class="info-title">Audio-Visual Sync Architecture</h2>
      <p class="info-text">
        This drum machine runs <strong>independent sequencers</strong> for each track, freeing them from a rigid single-tempo structure:
      </p>
      <ul class="info-list">
        <li>
          <strong>Subdivision:</strong> Updates the spacing of the steps (e.g. <code>4n</code> ticks every quarter note, while <code>32n</code> ticks eight times faster).
        </li>
        <li>
          <strong>Speed (Playback Rate):</strong> Mutates the internal playback speed multiplier of that track's sequencer in real-time, creating complex polyrhythms and phasing loops.
        </li>
        <li>
          <strong>Tone.Draw Sync:</strong> Because audio threads in the browser operate slightly ahead of the visual main thread to avoid stutter, visual steps are synchronized using <code>Tone.Draw.schedule()</code>. This triggers the visual pulse classes at the exact microsecond the sound card renders the audio wave, ensuring perfect visual-auditory alignment.
        </li>
      </ul>
    </footer>

    <!-- Audio Autoplay Policy Initialization Overlay -->
    <div v-if="!isAudioInitialized" class="audio-init-overlay">
      <div class="audio-init-card glass-panel">
        <h2 class="audio-init-title">Drum Loop Explorer</h2>
        <p class="audio-init-text">
          Welcome to the Web-Based Drum Loop Explorer. To begin synthesizing audio and exploring tempo subdivisions, click the button below to initialize the Tone.js context.
        </p>
        <button type="button" class="btn btn-primary btn-play" @click="initAudio">
          🎧 Initialize Audio Context
        </button>
      </div>
    </div>
  </div>
</template>
