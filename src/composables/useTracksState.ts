import { ref } from 'vue'
import type { TrackData } from '../types'

// We define a strict interface for audioEngine dependency injection
interface AudioEngineDependency {
  isAudioInitialized: { value: boolean }
  setupSequence: (track: TrackData) => void
  updateTrackVolume: (trackId: string, volDb: number) => void
  updateTrackMute: (trackId: string, isMuted: boolean) => void
  updateTrackSolo: (trackId: string, isSolo: boolean) => void
  applyPresetSettings: (trackId: string, preset: string) => void
}

export function useTracksState(audioEngine: AudioEngineDependency) {
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

  const bpm = ref(120)
  const masterVolume = ref(-6)

  function toggleStep(trackId: string, stepIndex: number) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.steps[stepIndex] = !track.steps[stepIndex]
      track.velocities[stepIndex] = track.steps[stepIndex] ? 1.0 : 0.0
    }
  }

  function fillTrackSteps(trackId: string, interval: number) {
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

  function updateStepVelocity(trackId: string, stepIndex: number, velocity: number) {
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

  function updateSubdivision(trackId: string, value: string) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.subdivision = value
      if (audioEngine.isAudioInitialized.value) {
        audioEngine.setupSequence(track)
      }
    }
  }

  function updatePlaybackRate(trackId: string, value: number) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.playbackRate = value
      if (audioEngine.isAudioInitialized.value) {
        audioEngine.setupSequence(track)
      }
    }
  }

  function toggleMute(trackId: string) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.isMuted = !track.isMuted
      audioEngine.updateTrackMute(trackId, track.isMuted)
    }
  }

  function toggleSolo(trackId: string) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.isSolo = !track.isSolo
      audioEngine.updateTrackSolo(trackId, track.isSolo)
    }
  }

  function updateVolume(trackId: string, value: number) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.volume = value
      audioEngine.updateTrackVolume(trackId, value)
    }
  }

  function updatePreset(trackId: string, value: string) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.soundPreset = value
      audioEngine.applyPresetSettings(trackId, value)
    }
  }

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

  function syncTrackToAudio(track: TrackData) {
    if (audioEngine.isAudioInitialized.value) {
      audioEngine.updateTrackVolume(track.id, track.volume)
      audioEngine.updateTrackMute(track.id, track.isMuted)
      audioEngine.updateTrackSolo(track.id, track.isSolo)
      audioEngine.applyPresetSettings(track.id, track.soundPreset)
      audioEngine.setupSequence(track)
    }
  }

  return {
    tracks,
    bpm,
    masterVolume,
    toggleStep,
    fillTrackSteps,
    updateStepVelocity,
    updateSubdivision,
    updatePlaybackRate,
    toggleMute,
    toggleSolo,
    updateVolume,
    updatePreset,
    clearPattern,
    randomizePattern,
    syncTrackToAudio
  }
}
