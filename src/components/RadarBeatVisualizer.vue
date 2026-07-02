<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

interface TrackData {
  id: string
  name: string
  steps: boolean[]
  velocities: number[]
  activeStep: number | null
  color: string
}

const props = defineProps<{
  tracks: TrackData[]
}>()

const emit = defineEmits<{
  (e: 'update-step-velocity', trackId: string, stepIndex: number, velocity: number): void
}>()

// SVG geometry configuration
const size = 320
const cx = size / 2
const cy = size / 2
const minRadius = 15 // Collapsed radius (sitting near center) when step is OFF

// Maximum radius for each instrument's circle track
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

// Computes coordinates for a track's step at a given radius
function getCoords(trackId: string, index: number, radius: number) {
  const angle = getStepAngle(index)
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  }
}

const svgRef = ref<SVGSVGElement | null>(null)
const activeDragTrack = ref<string | null>(null)
const activeDragStep = ref<number | null>(null)

// 1. Process track shapes, active polygons, and reference handle positions
const trackShapes = computed(() => {
  return props.tracks.map((track) => {
    const maxRad = getTrackRadius(track.id)

    // Calculate coordinates for all 16 handles (active or inactive)
    const allSteps = track.steps.map((active, index) => {
      const velocity = track.velocities[index] !== undefined ? track.velocities[index] : (active ? 1.0 : 0.0)
      // Visual radius ranges from minRadius (15px) to maxRad (instrument maximum)
      const radius = minRadius + velocity * (maxRad - minRadius)
      const coords = getCoords(track.id, index, radius)
      return {
        index,
        active,
        velocity,
        x: coords.x,
        y: coords.y,
        angle: getStepAngle(index)
      }
    })

    // Filter only active points for drawing polygon path
    const activePoints = allSteps.filter((s) => s.active)
    const pointsString = activePoints.map((p) => `${p.x},${p.y}`).join(' ')
    const point1 = activePoints[0] || null
    const point2 = activePoints[1] || null

    // Radar sweeper coordinates
    let playheadLine = null
    let activePlayheadPoint = null
    if (track.activeStep !== null) {
      const angle = getStepAngle(track.activeStep)
      playheadLine = {
        x2: cx + (maxRad + 8) * Math.cos(angle),
        y2: cy + (maxRad + 8) * Math.sin(angle)
      }
      const activeStepObj = allSteps[track.activeStep]
      if (activeStepObj && activeStepObj.active) {
        activePlayheadPoint = activeStepObj
      }
    }

    return {
      id: track.id,
      name: track.name,
      color: track.color,
      allSteps,
      activePoints,
      pointsString,
      point1,
      point2,
      activePlayheadPoint,
      activeStep: track.activeStep,
      playheadLine
    }
  })
})

// 2. Drag Handlers
function startDrag(trackId: string, stepIndex: number) {
  activeDragTrack.value = trackId
  activeDragStep.value = stepIndex
}

function handleMove(clientX: number, clientY: number) {
  if (!activeDragTrack.value || activeDragStep.value === null || !svgRef.value) return

  const rect = svgRef.value.getBoundingClientRect()
  const mouseX = clientX - rect.left
  const mouseY = clientY - rect.top

  // Offset from center
  const dx = mouseX - cx
  const dy = mouseY - cy

  // Axis angle for the dragged step
  const angle = getStepAngle(activeDragStep.value)
  const maxRad = getTrackRadius(activeDragTrack.value)

  // Project cursor coordinate onto the step's 1D radial line (Scalar projection)
  const projectedRadius = dx * Math.cos(angle) + dy * Math.sin(angle)

  // Clamp radius between minRadius (15px) and maxRad
  const clampedRadius = Math.max(minRadius, Math.min(projectedRadius, maxRad))

  // Convert to velocity (0.0 to 1.0)
  const normalized = (clampedRadius - minRadius) / (maxRad - minRadius)

  emit('update-step-velocity', activeDragTrack.value, activeDragStep.value, parseFloat(normalized.toFixed(2)))
}

function handleMouseMove(e: MouseEvent) {
  handleMove(e.clientX, e.clientY)
}

function handleTouchMove(e: TouchEvent) {
  if (activeDragTrack.value && activeDragStep.value !== null) {
    // Prevent document scrolling when dragging on mobile
    e.preventDefault()
    const touch = e.touches[0]
    if (touch) {
      handleMove(touch.clientX, touch.clientY)
    }
  }
}

function stopDrag() {
  activeDragTrack.value = null
  activeDragStep.value = null
}

// Bind global window events
onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', stopDrag)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', stopDrag)
})
</script>

<template>
  <div class="radar-card glass-panel">
    <span class="control-label" style="margin-bottom: 0.25rem;">Radar Beat Shape</span>
    <span style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 1rem; text-align: center;">
      Drag nodes radially to adjust step velocity. Drag to center to delete.
    </span>
    
    <svg
      ref="svgRef"
      class="radar-svg"
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
    >
      <!-- Center core -->
      <circle :cx="cx" :cy="cy" r="28" fill="rgba(255, 255, 255, 0.02)" stroke="rgba(255, 255, 255, 0.05)" />
      <text :x="cx" :y="cy" class="radar-text radar-center-lbl">
        Shapes
      </text>

      <!-- Center minimum radius track ring -->
      <circle
        :cx="cx"
        :cy="cy"
        :r="minRadius"
        fill="none"
        stroke="rgba(255, 255, 255, 0.05)"
        stroke-dasharray="2 3"
      />

      <!-- Concentric Max boundary tracks -->
      <circle
        v-for="track in tracks"
        :key="`boundary-ring-${track.id}`"
        :cx="cx"
        :cy="cy"
        :r="getTrackRadius(track.id)"
        class="radar-track-ring"
        style="stroke: rgba(255, 255, 255, 0.015);"
      />

      <!-- Loop through each instrument's shape state -->
      <g v-for="shape in trackShapes" :key="`shape-${shape.id}`">
        
        <!-- Radar Sonar Line (playhead pointer) -->
        <line
          v-if="shape.playheadLine"
          :x1="cx"
          :y1="cy"
          :x2="shape.playheadLine.x2"
          :y2="shape.playheadLine.y2"
          stroke="rgba(255, 255, 255, 0.15)"
          stroke-width="1.2"
          stroke-dasharray="2 3"
        />

        <!-- Render beat footprint shape based on number of active points -->

        <!-- Case 1: 1 Active Step - Render a glowing dot -->
        <circle
          v-if="shape.activePoints.length === 1 && shape.point1"
          :cx="shape.point1.x"
          :cy="shape.point1.y"
          r="5"
          :class="['visualizer-dot', shape.color]"
        />

        <!-- Case 2: 2 Active Steps - Render a glowing line -->
        <line
          v-else-if="shape.activePoints.length === 2 && shape.point1 && shape.point2"
          :x1="shape.point1.x"
          :y1="shape.point1.y"
          :x2="shape.point2.x"
          :y2="shape.point2.y"
          :class="['visualizer-line', shape.color]"
        />

        <!-- Case 3: >= 3 Active Steps - Render a morphing polygon -->
        <polygon
          v-else-if="shape.activePoints.length >= 3"
          :points="shape.pointsString"
          :class="['visualizer-polygon', shape.color]"
        />

        <!-- Render the 16 draggable handles (active nodes show colored, inactive show faint gray) -->
        <circle
          v-for="pt in shape.allSteps"
          :key="`handle-${shape.id}-${pt.index}`"
          :cx="pt.x"
          :cy="pt.y"
          :r="pt.active ? 6.5 : 3.5"
          :class="[
            pt.active ? 'radar-step-node' : 'visualizer-ref-dot',
            shape.color,
            {
              'is-active': pt.active,
              'is-current': shape.activeStep === pt.index
            }
          ]"
          style="cursor: grab;"
          :title="`${shape.name} - Step ${pt.index + 1} ${pt.active ? `(Vol: ${(pt.velocity * 100).toFixed(0)}%)` : '(Off)'}`"
          @mousedown="startDrag(shape.id, pt.index)"
          @touchstart.stop.prevent="startDrag(shape.id, pt.index)"
        />

        <!-- Playhead sweep highlight overlay on the vertex if playhead lands on active beat -->
        <circle
          v-if="shape.activePlayheadPoint"
          :cx="shape.activePlayheadPoint.x"
          :cy="shape.activePlayheadPoint.y"
          r="10"
          class="radar-playhead"
        />
      </g>
    </svg>
  </div>
</template>
