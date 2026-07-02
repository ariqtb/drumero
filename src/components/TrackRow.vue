<script setup lang="ts">
import { computed } from 'vue'
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
  soundPreset: string
}

const props = defineProps<{
  track: TrackData
  isGlobalKitActive?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-step', index: number): void
  (e: 'update-subdivision', value: string): void
  (e: 'update-playback-rate', value: number): void
  (e: 'toggle-mute'): void
  (e: 'toggle-solo'): void
  (e: 'update-volume', value: number): void
  (e: 'fill-steps', interval: number): void
  (e: 'update-preset', value: string): void
}>()

const subdivisions = [
  { value: '4n', label: '1/4 (Quarter)' },
  { value: '8n', label: '1/8 (Eight)' },
  { value: '16n', label: '1/16 (Sixteenth)' },
  { value: '32n', label: '1/32 (Thirty-Second)' }
]

const presets = computed(() => {
  if (props.track.id === 'kick') {
    return [
      { value: 'classic', label: 'Synth: Classic Kick' },
      { value: 'sub808', label: 'Synth: 808 Sub' },
      { value: 'punchy', label: 'Synth: Punchy Dance' },
      { value: 'soft', label: 'Synth: Soft Jazz' },
      { value: 'sample_808_kick', label: 'Sample: TR-808' },
      { value: 'sample_cr78_kick', label: 'Sample: CR-78' },
      { value: 'sample_acoustic_kick', label: 'Sample: Acoustic' }
    ]
  } else if (props.track.id === 'snare') {
    return [
      { value: 'acoustic', label: 'Synth: Acoustic' },
      { value: 'electronic', label: 'Synth: Electronic' },
      { value: 'synthesized', label: 'Synth: 808' },
      { value: 'noise_only', label: 'Synth: Noise Only' },
      { value: 'sample_808_snare', label: 'Sample: TR-808' },
      { value: 'sample_cr78_snare', label: 'Sample: CR-78' },
      { value: 'sample_acoustic_snare', label: 'Sample: Acoustic' }
    ]
  } else {
    return [
      { value: 'closed', label: 'Synth: Closed Hat' },
      { value: 'open', label: 'Synth: Open Hat' },
      { value: 'industrial', label: 'Synth: Industrial' },
      { value: 'sizzle', label: 'Synth: Sizzle Ride' },
      { value: 'sample_808_hat', label: 'Sample: TR-808' },
      { value: 'sample_cr78_hat', label: 'Sample: CR-78' },
      { value: 'sample_acoustic_hat', label: 'Sample: Acoustic' }
    ]
  }
})

function handlePresetChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update-preset', target.value)
}

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
</script>

<template>
  <div class="track-row glass-panel">
    <!-- Left Panel: Name & Meta -->
    <div class="track-info">
      <div :class="['track-color-indicator', track.color]" />
      <div class="track-meta">
        <span class="track-name">{{ track.name }}</span>
        <div class="track-sub-info-row">
          <span class="track-sub-info">
            {{ track.subdivision }} @ {{ track.playbackRate.toFixed(2) }}x
          </span>
          <div class="quick-fill-group">
            <span class="quick-fill-label">Fill:</span>
            <button
              type="button"
              class="btn-fill btn-fill-clear"
              title="Clear all steps"
              @click="emit('fill-steps', 0)"
            >
              C
            </button>
            <button
              type="button"
              class="btn-fill"
              title="Fill every 2 steps (8 active dots)"
              @click="emit('fill-steps', 2)"
            >
              2
            </button>
            <button
              type="button"
              class="btn-fill"
              title="Fill every 4 steps (4 active dots)"
              @click="emit('fill-steps', 4)"
            >
              4
            </button>
            <button
              type="button"
              class="btn-fill"
              title="Fill every 8 steps (2 active dots)"
              @click="emit('fill-steps', 8)"
            >
              8
            </button>
          </div>
        </div>
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

      <!-- Sound Preset Dropdown -->
      <div :class="['select-wrapper', { 'select-disabled': isGlobalKitActive }]">
        <select
          :value="track.soundPreset"
          :disabled="isGlobalKitActive"
          class="custom-select"
          aria-label="Sound Preset"
          @change="handlePresetChange"
        >
          <option v-for="preset in presets" :key="preset.value" :value="preset.value">
            {{ isGlobalKitActive ? 'Kit Override' : preset.label }}
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
          @wheel.prevent="handleWheel"
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
          @wheel.prevent="handleWheel"
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
  </div>
</template>
