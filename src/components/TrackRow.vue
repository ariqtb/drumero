<script setup lang="ts">
import StepButton from './StepButton.vue'

interface TrackData {
  id: string
  name: string
  steps: boolean[]
  subdivision: string
  playbackRate: number
  isMuted: boolean
  isSolo: boolean
  volume: number
  activeStep: number | null
  color: string
}

defineProps<{
  track: TrackData
}>()

const emit = defineEmits<{
  (e: 'toggle-step', index: number): void
  (e: 'update-subdivision', value: string): void
  (e: 'update-playback-rate', value: number): void
  (e: 'toggle-mute'): void
  (e: 'toggle-solo'): void
  (e: 'update-volume', value: number): void
}>()

const subdivisions = [
  { value: '4n', label: '1/4 (Quarter)' },
  { value: '8n', label: '1/8 (Eight)' },
  { value: '16n', label: '1/16 (Sixteenth)' },
  { value: '32n', label: '1/32 (Thirty-Second)' }
]

function handleSubdivisionChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update-subdivision', target.value)
}

function handlePlaybackRateChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update-playback-rate', parseFloat(target.value))
}

function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update-volume', parseFloat(target.value))
}
</script>

<template>
  <div class="track-row glass-panel">
    <!-- Left Panel: Name & Meta -->
    <div class="track-info">
      <div :class="['track-color-indicator', track.color]" />
      <div class="track-meta">
        <span class="track-name">{{ track.name }}</span>
        <span class="track-sub-info">
          {{ track.subdivision }} @ {{ track.playbackRate.toFixed(2) }}x
        </span>
      </div>
    </div>

    <!-- Middle Panel: Speed, Mute/Solo & Volume Controls -->
    <div class="track-controls">
      <!-- Subdivision Dropdown -->
      <div class="select-wrapper">
        <select
          :value="track.subdivision"
          class="custom-select"
          aria-label="Subdivision"
          @change="handleSubdivisionChange"
        >
          <option v-for="sub in subdivisions" :key="sub.value" :value="sub.value">
            {{ sub.label }}
          </option>
        </select>
      </div>

      <!-- Playback Rate Slider -->
      <div class="slider-container">
        <div class="slider-header">
          <span class="control-label">Speed</span>
          <span class="slider-value">{{ track.playbackRate.toFixed(2) }}x</span>
        </div>
        <input
          type="range"
          min="0.25"
          max="4.00"
          step="0.05"
          :value="track.playbackRate"
          aria-label="Playback Rate"
          @input="handlePlaybackRateChange"
        />
      </div>

      <!-- Volume Slider -->
      <div class="slider-container">
        <div class="slider-header">
          <span class="control-label">Volume</span>
          <span class="slider-value">
            {{ track.volume <= -40 ? 'Mute' : `${track.volume > 0 ? '+' : ''}${track.volume.toFixed(0)} dB` }}
          </span>
        </div>
        <input
          type="range"
          min="-40"
          max="6"
          step="1"
          :value="track.volume"
          aria-label="Volume"
          @input="handleVolumeChange"
        />
      </div>

      <!-- Mute & Solo Buttons -->
      <button
        type="button"
        :class="['btn-mute-solo', 'btn-mute', { muted: track.isMuted }]"
        title="Mute Track"
        @click="emit('toggle-mute')"
      >
        M
      </button>
      <button
        type="button"
        :class="['btn-mute-solo', 'btn-solo', { soloed: track.isSolo }]"
        title="Solo Track"
        @click="emit('toggle-solo')"
      >
        S
      </button>
    </div>

    <!-- Right Panel: Step Grid (16 Steps) -->
    <div class="track-grid">
      <StepButton
        v-for="(active, index) in track.steps"
        :key="index"
        :index="index"
        :active="active"
        :is-current="track.activeStep === index"
        :color-class="track.color"
        @toggle="emit('toggle-step', index)"
      />
    </div>
  </div>
</template>
