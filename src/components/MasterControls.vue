<script setup lang="ts">
import type { SavedPattern } from '../types'

defineProps<{
  isPlaying: boolean
  bpm: number
  masterVolume: number
  selectedKit: string
  savedPatterns: SavedPattern[]
  selectedPatternId: string
  newPatternName: string
}>()

const emit = defineEmits<{
  (e: 'toggle-play'): void
  (e: 'update-bpm', val: number): void
  (e: 'update-master-volume', val: number): void
  (e: 'update-selected-kit', val: string): void
  (e: 'save-pattern'): void
  (e: 'load-pattern'): void
  (e: 'delete-pattern'): void
  (e: 'randomize-pattern'): void
  (e: 'clear-pattern'): void
  (e: 'update:newPatternName', val: string): void
  (e: 'update:selectedPatternId', val: string): void
}>()

function handleKitChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update-selected-kit', target.value)
}

function handleBpmInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update-bpm', parseInt(target.value))
}

function handleVolumeInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update-master-volume', parseFloat(target.value))
}

function handlePatternChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:selectedPatternId', target.value)
  emit('load-pattern')
}

function handlePatternNameInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:newPatternName', target.value)
}

function handleWheel(event: WheelEvent, type: 'bpm' | 'volume') {
  const target = event.currentTarget as HTMLInputElement
  if (!target) return

  const min = parseFloat(target.min || '0')
  const max = parseFloat(target.max || '100')
  const step = parseFloat(target.step || '1')
  const val = parseFloat(target.value)

  let deltaY = event.deltaY
  if (event.deltaMode === 1) {
    deltaY *= 33
  } else if (event.deltaMode === 2) {
    deltaY *= 400
  }

  const range = max - min
  const multiplier = range * 0.0002
  let delta = deltaY * multiplier

  if (Math.abs(delta) < step) {
    delta = deltaY > 0 ? step : -step
  } else {
    delta = Math.round(delta / step) * step
  }

  const newVal = Math.max(min, Math.min(max, val + delta))
  
  if (type === 'bpm') {
    emit('update-bpm', newVal)
  } else {
    emit('update-master-volume', newVal)
  }
}
</script>

<template>
  <section class="master-controls glass-panel" aria-label="Master Controls" style="margin-bottom: 1.5rem;">
    <!-- Group 1: Play & Kit Selection -->
    <div class="master-group" style="gap: 1rem;">
      <button
        type="button"
        :class="['btn', 'btn-primary', 'btn-play', { 'btn-active': isPlaying }]"
        @click="emit('toggle-play')"
      >
        <span v-if="isPlaying">⏸ Pause</span>
        <span v-else>▶ Play</span>
      </button>

      <div class="select-wrapper">
        <select
          :value="selectedKit"
          class="custom-select"
          aria-label="Global Drum Kit"
          style="min-width: 170px;"
          @change="handleKitChange"
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

    <!-- Group 2: Master BPM & Volume Sliders -->
    <div class="master-group">
      <!-- Master BPM -->
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
          @input="handleBpmInput"
          @wheel.prevent="handleWheel($event, 'bpm')"
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
          @input="handleVolumeInput"
          @wheel.prevent="handleWheel($event, 'volume')"
        />
      </div>
    </div>

    <!-- Group 3: Quick Grid Actions -->
    <div class="master-group">
      <button type="button" class="btn" @click="emit('randomize-pattern')">
        🎲 Randomize
      </button>
      <button type="button" class="btn btn-danger-outline" @click="emit('clear-pattern')">
        🗑 Clear Grid
      </button>
    </div>

    <!-- Group 4: Pattern Manager -->
    <div class="master-group pattern-manager" style="border-left: 1px solid rgba(255, 255, 255, 0.08); padding-left: 1.25rem; gap: 0.75rem;">
      <div class="select-wrapper">
        <select
          :value="selectedPatternId"
          class="custom-select"
          aria-label="Load Pattern"
          style="min-width: 140px;"
          @change="handlePatternChange"
        >
          <option value="" disabled>Load Pattern...</option>
          <option v-for="pat in savedPatterns" :key="pat.id" :value="pat.id">
            {{ pat.name }}
          </option>
        </select>
      </div>
      <div class="pattern-save-group" style="display: flex; gap: 0.5rem; align-items: center;">
        <input
          type="text"
          :value="newPatternName"
          placeholder="Pattern name..."
          class="pattern-name-input"
          aria-label="New pattern name"
          @input="handlePatternNameInput"
        />
        <button type="button" class="btn btn-save" @click="emit('save-pattern')">
          💾 Save
        </button>
      </div>
      <button
        v-if="selectedPatternId"
        type="button"
        class="btn btn-danger-icon"
        title="Delete Pattern"
        @click="emit('delete-pattern')"
      >
        🗑️
      </button>
    </div>
  </section>
</template>
