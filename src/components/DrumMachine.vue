<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import TrackRow from './TrackRow.vue'
import RadarTempoController from './RadarTempoController.vue'
import RadarBeatVisualizer from './RadarBeatVisualizer.vue'
import MasterControls from './MasterControls.vue'

import { useAudioEngine } from '../composables/useAudioEngine'
import { usePatternManager } from '../composables/usePatternManager'
import { useTracksState } from '../composables/useTracksState'

// 1. Initialize Audio Engine Composable
const audioEngine = useAudioEngine()
const { isAudioInitialized, isPlaying, selectedKit } = audioEngine

// 2. Initialize Tracks State Composable (injecting audioEngine dependency)
const tracksState = useTracksState(audioEngine)
const { tracks, bpm, masterVolume } = tracksState

// 3. Initialize LocalStorage Pattern Manager Composable
const patternManager = usePatternManager()
const { savedPatterns, newPatternName, selectedPatternId } = patternManager

// Orchestrator Actions
async function initializeAudio() {
  await audioEngine.initAudio(tracks.value, bpm.value, masterVolume.value)
}

async function handleTogglePlay() {
  await audioEngine.togglePlay(tracks.value, bpm.value, masterVolume.value)
}

function handleUpdateBpm(val: number) {
  tracksState.bpm.value = val
  audioEngine.updateBpm(val)
}

function handleUpdateMasterVolume(val: number) {
  tracksState.masterVolume.value = val
  audioEngine.updateMasterVolume(val)
}

function handleUpdateSelectedKit(val: string) {
  selectedKit.value = val
}

function handleSavePattern() {
  patternManager.savePattern(bpm.value, selectedKit.value, masterVolume.value, tracks.value)
}

function handleLoadPattern() {
  patternManager.loadPattern(
    tracks,
    bpm,
    selectedKit,
    masterVolume,
    (track) => tracksState.syncTrackToAudio(track)
  )
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.code === 'Space') {
    e.preventDefault()
    handleTogglePlay()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  patternManager.loadPatternsFromStorage()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  audioEngine.disposeAudioEngine()
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
    <MasterControls
      :is-playing="isPlaying"
      :bpm="bpm"
      :master-volume="masterVolume"
      :selected-kit="selectedKit"
      :saved-patterns="savedPatterns"
      :selected-pattern-id="selectedPatternId"
      :new-pattern-name="newPatternName"
      @toggle-play="handleTogglePlay"
      @update-bpm="handleUpdateBpm"
      @update-master-volume="handleUpdateMasterVolume"
      @update-selected-kit="handleUpdateSelectedKit"
      @save-pattern="handleSavePattern"
      @load-pattern="handleLoadPattern"
      @delete-pattern="patternManager.deletePattern"
      @randomize-pattern="tracksState.randomizePattern"
      @clear-pattern="tracksState.clearPattern"
      @update:new-pattern-name="newPatternName = $event"
      @update:selected-pattern-id="selectedPatternId = $event"
    />

    <!-- Radar Controller & Visualizer side-by-side -->
    <div class="radars-layout-horizontal">
      <RadarTempoController
        :tracks="tracks"
        @toggle-step="tracksState.toggleStep"
      />
      
      <RadarBeatVisualizer
        :tracks="tracks"
        @update-step-velocity="tracksState.updateStepVelocity"
        @toggle-step="tracksState.toggleStep"
      />
    </div>

    <!-- Track Grid Control Board -->
    <main class="track-board">
      <TrackRow
        v-for="track in tracks"
        :key="track.id"
        :track="track"
        :is-global-kit-active="selectedKit !== 'synthesizers'"
        @toggle-step="(index) => tracksState.toggleStep(track.id, index)"
        @update-subdivision="(value) => tracksState.updateSubdivision(track.id, value)"
        @update-playback-rate="(value) => tracksState.updatePlaybackRate(track.id, value)"
        @toggle-mute="tracksState.toggleMute(track.id)"
        @toggle-solo="tracksState.toggleSolo(track.id)"
        @update-volume="(value) => tracksState.updateVolume(track.id, value)"
        @fill-steps="(value) => tracksState.fillTrackSteps(track.id, value)"
        @update-preset="(value) => tracksState.updatePreset(track.id, value)"
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
        <button type="button" class="btn btn-primary btn-play" @click="initializeAudio">
          🎧 Initialize Audio Context
        </button>
      </div>
    </div>
  </div>
</template>
