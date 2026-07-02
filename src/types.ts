export interface TrackData {
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
  soundPreset: string
}

export interface SavedPattern {
  id: string
  name: string
  bpm: number
  selectedKit: string
  masterVolume: number
  tracks: {
    id: string
    steps: boolean[]
    velocities: number[]
    subdivision: string
    playbackRate: number
    isMuted: boolean
    isSolo: boolean
    volume: number
    soundPreset: string
  }[]
}
