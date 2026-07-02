<script setup lang="ts">
import { computed } from 'vue'

interface TrackData {
  id: string
  name: string
  steps: boolean[]
  activeStep: number | null
  color: string
}

const props = defineProps<{
  tracks: TrackData[]
}>()

const emit = defineEmits<{
  (e: 'toggle-step', trackId: string, stepIndex: number): void
}>()

// SVG geometry configuration
const size = 320
const cx = size / 2
const cy = size / 2

// Define fixed radii for the concentric instrument rings
function getTrackRadius(trackId: string): number {
  switch (trackId) {
    case 'kick':
      return 55
    case 'snare':
      return 95
    case 'hihat':
    default:
      return 135
  }
}

// Calculate angle for a step (0-15) - starts at 12 o'clock (-90 deg) and sweeps clockwise
function getStepAngle(index: number): number {
  return (index * 2 * Math.PI) / 16 - Math.PI / 2
}

// Computes (x, y) coordinates for a node
function getNodeCoords(trackId: string, index: number) {
  const radius = getTrackRadius(trackId)
  const angle = getStepAngle(index)
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  }
}

// Calculate coordinates for radial tick lines (spokes on a wheel)
const radialTicks = computed(() => {
  return Array.from({ length: 16 }, (_, i) => {
    const angle = getStepAngle(i)
    return {
      x1: cx + 35 * Math.cos(angle),
      y1: cy + 35 * Math.sin(angle),
      x2: cx + 145 * Math.cos(angle),
      y2: cy + 145 * Math.sin(angle)
    }
  })
})
</script>

<template>
  <div class="radar-card glass-panel">
    <span class="control-label" style="margin-bottom: 1rem;">Radar Beat Sequencer</span>
    
    <svg
      class="radar-svg"
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
    >
      <!-- Center Core Label -->
      <circle :cx="cx" :cy="cy" r="28" fill="rgba(255, 255, 255, 0.02)" stroke="rgba(255, 255, 255, 0.05)" />
      <text :x="cx" :y="cy" class="radar-text radar-center-lbl">
        Beats
      </text>

      <!-- Radial Subdivision Tick Guidelines (Spokes) -->
      <line
        v-for="(tick, idx) in radialTicks"
        :key="`tick-${idx}`"
        :x1="tick.x1"
        :y1="tick.y1"
        :x2="tick.x2"
        :y2="tick.y2"
        class="radar-radial-tick"
      />

      <!-- Concentric Track Rings (Paths behind the nodes) -->
      <circle
        v-for="track in tracks"
        :key="`track-ring-${track.id}`"
        :cx="cx"
        :cy="cy"
        :r="getTrackRadius(track.id)"
        class="radar-track-ring"
      />

      <!-- Instrument Ring Label Markers -->
      <text :x="cx" :y="cy - 55 - 12" class="radar-text" style="font-size: 8px; fill: var(--text-dim);">Kick</text>
      <text :x="cx" :y="cy - 95 - 12" class="radar-text" style="font-size: 8px; fill: var(--text-dim);">Snare</text>
      <text :x="cx" :y="cy - 135 - 12" class="radar-text" style="font-size: 8px; fill: var(--text-dim);">Hi-Hat</text>

      <!-- Steps Nodes (Beats) Grid rendering -->
      <g v-for="track in tracks" :key="`track-nodes-${track.id}`">
        <!-- Render 16 Step circles -->
        <g v-for="(active, index) in track.steps" :key="`step-${track.id}-${index}`">
          <!-- Clickable node -->
          <circle
            :cx="getNodeCoords(track.id, index).x"
            :cy="getNodeCoords(track.id, index).y"
            r="6.5"
            :class="[
              'radar-step-node',
              track.color,
              {
                'is-active': active,
                'is-current': track.activeStep === index
              }
            ]"
            :title="`${track.name} - Step ${index + 1}`"
            @click="emit('toggle-step', track.id, index)"
          />

          <!-- Playhead Sweep Halo Ring (shows when activeStep is sweeping over the node) -->
          <circle
            v-if="track.activeStep === index"
            :cx="getNodeCoords(track.id, index).x"
            :cy="getNodeCoords(track.id, index).y"
            r="10"
            class="radar-playhead"
          />
        </g>
      </g>
    </svg>
  </div>
</template>
