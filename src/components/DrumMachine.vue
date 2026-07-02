<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
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
    color: 'kick'
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
    color: 'snare'
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
    volume: -16,
    activeStep: null,
    color: 'hihat'
  }
])

// Non-reactive Tone.js references to prevent Vue Proxy overhead
let kickSynth: Tone.MembraneSynth | null = null
let snareSynth: Tone.NoiseSynth | null = null
let hihatSynth: Tone.MetalSynth | null = null

const channels: Record<string, Tone.Channel> = {}
const sequences: Record<string, Tone.Sequence> = {}

// Initialize Audio Context & Synthesis Engine
async function initAudio() {
  if (isAudioInitialized.value) return

  await Tone.start()

  // 1. Create Tone.Channels for mute, solo, and volume control per track
  channels['kick'] = new Tone.Channel({ volume: -6, mute: false, solo: false }).toDestination()
  channels['snare'] = new Tone.Channel({ volume: -12, mute: false, solo: false }).toDestination()
  channels['hihat'] = new Tone.Channel({ volume: -16, mute: false, solo: false }).toDestination()

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

  hihatSynth = new Tone.MetalSynth({
    envelope: {
      attack: 0.001,
      decay: 0.08,
      release: 0.08
    },
    resonance: 7000,
    harmonicity: 5.1
  }).connect(channels['hihat'])

  // 3. Setup separate sequences for each track (enables independent tempos)
  tracks.value.forEach((track) => {
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

// Trigger Synthesis Engines at Scheduled Auditory Ticks
function triggerInstrument(trackId: string, time: number, velocity: number) {
  if (trackId === 'kick' && kickSynth) {
    kickSynth.triggerAttackRelease('C1', '8n', time, velocity)
  } else if (trackId === 'snare' && snareSynth) {
    snareSynth.triggerAttack(time, velocity)
  } else if (trackId === 'hihat' && hihatSynth) {
    hihatSynth.triggerAttack(time, velocity)
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

// Track Control Emits handlers
function toggleStep(trackId: string, stepIndex: number) {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) {
    track.steps[stepIndex] = !track.steps[stepIndex]
    track.velocities[stepIndex] = track.steps[stepIndex] ? 1.0 : 0.0
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

// Component Teardown Cleanup
onUnmounted(() => {
  Tone.Transport.stop()
  Object.values(sequences).forEach((seq) => seq.dispose())
  Object.values(channels).forEach((ch) => ch.dispose())
  
  if (kickSynth) kickSynth.dispose()
  if (snareSynth) snareSynth.dispose()
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

    <!-- Dashboard Layout: Radar Controller + Master Control Dashboard -->
    <div class="dashboard-layout">
      <div class="left-sidebar-stack">
        <RadarTempoController
          :tracks="tracks"
          @toggle-step="toggleStep"
        />
        
        <RadarBeatVisualizer
          :tracks="tracks"
          @update-step-velocity="handleUpdateStepVelocity"
        />
      </div>

      <!-- Master Control Dashboard -->
      <section class="master-controls glass-panel" aria-label="Master Controls" style="margin-bottom: 0;">
        <div class="master-group">
          <button
            type="button"
            :class="['btn', 'btn-primary', 'btn-play', { 'btn-active': isPlaying }]"
            @click="togglePlay"
          >
            <span v-if="isPlaying">⏸ Pause</span>
            <span v-else>▶ Play</span>
          </button>
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
    </div>

    <!-- Track Grid Control Board -->
    <main class="track-board">
      <TrackRow
        v-for="track in tracks"
        :key="track.id"
        :track="track"
        @toggle-step="(index) => toggleStep(track.id, index)"
        @update-subdivision="(value) => handleUpdateSubdivision(track.id, value)"
        @update-playback-rate="(value) => handleUpdatePlaybackRate(track.id, value)"
        @toggle-mute="handleToggleMute(track.id)"
        @toggle-solo="handleToggleSolo(track.id)"
        @update-volume="(value) => handleUpdateVolume(track.id, value)"
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
