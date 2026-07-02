<script setup lang="ts">
defineProps<{
  active: boolean
  isCurrent: boolean
  colorClass: string
  index: number
}>()

defineEmits<{
  (e: 'toggle'): void
}>()
</script>

<template>
  <button
    type="button"
    :class="[
      'step-btn',
      colorClass,
      {
        'is-active': active,
        'is-current': isCurrent,
        'beat-accent': index % 4 === 0
      }
    ]"
    :aria-label="`Track step ${index + 1}`"
    @click="$emit('toggle')"
  />
</template>
