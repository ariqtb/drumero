import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SavedPattern, TrackData } from '../types'

export function usePatternManager() {
  const savedPatterns = ref<SavedPattern[]>([])
  const newPatternName = ref('')
  const selectedPatternId = ref('')

  function loadPatternsFromStorage() {
    try {
      const stored = localStorage.getItem('drumero_patterns')
      if (stored) {
        savedPatterns.value = JSON.parse(stored)
      } else {
        savedPatterns.value = []
      }
    } catch (e) {
      console.error('Failed to load patterns from local storage', e)
    }
  }

  function savePattern(bpm: number, selectedKit: string, masterVolume: number, tracks: TrackData[]) {
    const name = newPatternName.value.trim() || `Pattern #${savedPatterns.value.length + 1}`
    
    const newPattern: SavedPattern = {
      id: 'pattern_' + Date.now(),
      name: name,
      bpm: bpm,
      selectedKit: selectedKit,
      masterVolume: masterVolume,
      tracks: tracks.map(t => ({
        id: t.id,
        steps: [...t.steps],
        velocities: [...t.velocities],
        subdivision: t.subdivision,
        playbackRate: t.playbackRate,
        isMuted: t.isMuted,
        isSolo: t.isSolo,
        volume: t.volume,
        soundPreset: t.soundPreset
      }))
    }

    savedPatterns.value.push(newPattern)
    try {
      localStorage.setItem('drumero_patterns', JSON.stringify(savedPatterns.value))
      newPatternName.value = ''
      selectedPatternId.value = newPattern.id
    } catch (e) {
      console.error('Failed to save pattern to local storage', e)
    }
  }

  function loadPattern(
    tracks: Ref<TrackData[]>,
    bpmRef: Ref<number>,
    kitRef: Ref<string>,
    volRef: Ref<number>,
    onTrackLoaded: (track: TrackData) => void
  ) {
    if (!selectedPatternId.value) return
    
    const pattern = savedPatterns.value.find(p => p.id === selectedPatternId.value)
    if (!pattern) return

    bpmRef.value = pattern.bpm
    kitRef.value = pattern.selectedKit
    volRef.value = pattern.masterVolume

    pattern.tracks.forEach((patTrack) => {
      const track = tracks.value.find((t) => t.id === patTrack.id)
      if (track) {
        track.steps = [...patTrack.steps]
        track.velocities = [...patTrack.velocities]
        track.subdivision = patTrack.subdivision
        track.playbackRate = patTrack.playbackRate
        track.isMuted = patTrack.isMuted
        track.isSolo = patTrack.isSolo
        track.volume = patTrack.volume
        track.soundPreset = patTrack.soundPreset

        onTrackLoaded(track)
      }
    })
  }

  function deletePattern() {
    if (!selectedPatternId.value) return
    
    savedPatterns.value = savedPatterns.value.filter(p => p.id !== selectedPatternId.value)
    try {
      localStorage.setItem('drumero_patterns', JSON.stringify(savedPatterns.value))
      selectedPatternId.value = ''
    } catch (e) {
      console.error('Failed to delete pattern from local storage', e)
    }
  }

  return {
    savedPatterns,
    newPatternName,
    selectedPatternId,
    loadPatternsFromStorage,
    savePattern,
    loadPattern,
    deletePattern
  }
}
