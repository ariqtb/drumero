import { ref } from 'vue'
import * as Tone from 'tone'
import { kitsConfig } from '../config/kits'
import type { TrackData } from '../types'

export function useAudioEngine() {
  const isAudioInitialized = ref(false)
  const isPlaying = ref(false)
  const selectedKit = ref('synthesizers')

  // Non-reactive Tone.js references to prevent Vue Proxy overhead
  let kickSynth: Tone.MembraneSynth | null = null
  let snareSynth: Tone.NoiseSynth | null = null
  let snareOsc: Tone.Synth | null = null
  let hihatSynth: Tone.MetalSynth | null = null
  
  const samplePlayers: Record<string, Tone.Player> = {}
  const channels: Record<string, Tone.Channel> = {}
  const sequences: Record<string, Tone.Sequence> = {}

  // Initialize Audio Context & Synthesis Engine
  async function initAudio(tracksVal: TrackData[], bpmValue: number, masterVolDb: number) {
    if (isAudioInitialized.value) return

    await Tone.start()

    // 1. Create Tone.Channels for mute, solo, and volume control per track
    channels['kick'] = new Tone.Channel({ volume: -6, mute: false, solo: false }).toDestination()
    channels['snare'] = new Tone.Channel({ volume: -12, mute: false, solo: false }).toDestination()
    channels['hihat'] = new Tone.Channel({ volume: -10, mute: false, solo: false }).toDestination()

    // Apply track configuration to channels
    tracksVal.forEach((track) => {
      const ch = channels[track.id]
      if (ch) {
        ch.volume.value = track.volume <= -40 ? -Infinity : track.volume
        ch.mute = track.isMuted
        ch.solo = track.isSolo
      }
    })

    // 2. Synthesizer definitions
    kickSynth = new Tone.MembraneSynth({
      envelope: {
        sustain: 0,
        attack: 0.002,
        decay: 0.35,
        release: 0.2
      },
      octaves: 5
    }).connect(channels['kick'])

    snareSynth = new Tone.NoiseSynth({
      noise: {
        type: 'pink'
      },
      envelope: {
        attack: 0.001,
        decay: 0.15,
        sustain: 0,
        release: 0.1
      }
    }).connect(channels['snare'])

    snareOsc = new Tone.Synth({
      oscillator: {
        type: 'triangle'
      },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0,
        release: 0.1
      }
    }).connect(channels['snare'])

    hihatSynth = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: 0.05,
        release: 0.05
      },
      resonance: 8000,
      harmonicity: 5.1,
      modulationIndex: 32
    }).connect(channels['hihat'])

    // Load sample players from CDN for all kits dynamically
    Object.entries(kitsConfig).forEach(([kitKey, kitSamples]) => {
      Object.entries(kitSamples).forEach(([instrumentId, url]) => {
        const playerKey = `sample_${kitKey}_${instrumentId}`
        samplePlayers[playerKey] = new Tone.Player(url).connect(channels[instrumentId]!)
      })
    })

    // 3. Setup separate sequences and apply presets
    tracksVal.forEach((track) => {
      applyPresetSettings(track.id, track.soundPreset)
      setupSequence(track)
    })

    // 4. Bind master configurations
    Tone.Transport.bpm.value = bpmValue
    Tone.Destination.volume.value = masterVolDb <= -40 ? -Infinity : masterVolDb

    isAudioInitialized.value = true
  }

  // Sequence Scheduling & Audio-Visual Sync
  function setupSequence(track: TrackData) {
    const existingSeq = sequences[track.id]
    if (existingSeq) {
      existingSeq.dispose()
    }

    const seq = new Tone.Sequence(
      (time, stepIndex) => {
        if (track.steps[stepIndex]) {
          const velocity = track.velocities[stepIndex] !== undefined ? track.velocities[stepIndex] : 1.0
          triggerInstrument(track.id, time, velocity, track.soundPreset)
        }

        Tone.Draw.schedule(() => {
          track.activeStep = stepIndex
        }, time)
      },
      Array.from({ length: 16 }, (_, i) => i),
      track.subdivision
    )

    seq.playbackRate = track.playbackRate
    seq.start(0)
    
    sequences[track.id] = seq
  }

  // Play Synthesized Sounds
  function playSynth(trackId: string, preset: string, time: number, velocity: number) {
    if (trackId === 'kick' && kickSynth) {
      if (preset === 'sub808') {
        kickSynth.triggerAttackRelease('A0', '4n', time, velocity)
      } else if (preset === 'punchy') {
        kickSynth.triggerAttackRelease('C1', '8n', time, velocity)
      } else if (preset === 'soft') {
        kickSynth.triggerAttackRelease('G0', '8n', time, velocity * 0.7)
      } else {
        kickSynth.triggerAttackRelease('C1', '8n', time, velocity)
      }
    } else if (trackId === 'snare' && snareSynth) {
      if (preset === 'noise_only') {
        snareSynth.triggerAttackRelease('8n', time, velocity)
      } else if (preset === 'electronic') {
        snareSynth.triggerAttackRelease('16n', time, velocity)
        if (snareOsc) {
          snareOsc.triggerAttackRelease('A2', '16n', time, velocity * 0.5)
        }
      } else if (preset === 'synthesized') {
        snareSynth.triggerAttackRelease('32n', time, velocity)
        if (snareOsc) {
          snareOsc.triggerAttackRelease('G2', '16n', time, velocity * 0.6)
        }
      } else {
        snareSynth.triggerAttackRelease('16n', time, velocity)
        if (snareOsc) {
          snareOsc.triggerAttackRelease('E2', '16n', time, velocity * 0.6)
        }
      }
    } else if (trackId === 'hihat' && hihatSynth) {
      if (preset === 'sizzle') {
        hihatSynth.triggerAttackRelease('F6', '2n', time, velocity * 0.6)
      } else if (preset === 'open') {
        hihatSynth.triggerAttackRelease('F#6', '4n', time, velocity * 0.8)
      } else {
        hihatSynth.triggerAttackRelease('G6', '32n', time, velocity)
      }
    }
  }

  // Trigger sound engine or samplers
  function triggerInstrument(trackId: string, time: number, velocity: number, trackPreset: string) {
    if (selectedKit.value === 'synthesizers') {
      if (trackPreset.startsWith('sample_')) {
        const player = samplePlayers[trackPreset]
        if (player && player.loaded) {
          player.start(time)
          return
        }
      }
      playSynth(trackId, trackPreset, time, velocity)
    } else {
      const playerKey = `sample_${selectedKit.value}_${trackId}`
      const player = samplePlayers[playerKey]
      if (player && player.loaded) {
        player.start(time)
      } else {
        const fallbackPreset = trackId === 'kick' ? 'classic' : (trackId === 'snare' ? 'acoustic' : 'closed')
        playSynth(trackId, fallbackPreset, time, velocity)
      }
    }
  }

  // Toggle play/pause
  async function togglePlay(tracksVal: TrackData[], bpmValue: number, masterVolDb: number) {
    if (!isAudioInitialized.value) {
      await initAudio(tracksVal, bpmValue, masterVolDb)
    }

    if (isPlaying.value) {
      Tone.Transport.stop()
      tracksVal.forEach((t) => (t.activeStep = null))
      isPlaying.value = false
    } else {
      Tone.Transport.start()
      isPlaying.value = true
    }
  }

  // BPM & Master Volume controls
  function updateBpm(val: number) {
    if (isAudioInitialized.value) {
      Tone.Transport.bpm.value = val
    }
  }

  function updateMasterVolume(val: number) {
    if (isAudioInitialized.value) {
      Tone.Destination.volume.value = val <= -40 ? -Infinity : val
    }
  }

  // Individual Track controls
  function updateTrackVolume(trackId: string, volDb: number) {
    if (isAudioInitialized.value) {
      const ch = channels[trackId]
      if (ch) {
        ch.volume.value = volDb <= -40 ? -Infinity : volDb
      }
    }
  }

  function updateTrackMute(trackId: string, isMuted: boolean) {
    if (isAudioInitialized.value) {
      const ch = channels[trackId]
      if (ch) {
        ch.mute = isMuted
      }
    }
  }

  function updateTrackSolo(trackId: string, isSolo: boolean) {
    if (isAudioInitialized.value) {
      const ch = channels[trackId]
      if (ch) {
        ch.solo = isSolo
      }
    }
  }

  function applyPresetSettings(trackId: string, preset: string) {
    if (trackId === 'kick' && kickSynth) {
      if (preset === 'sub808') {
        kickSynth.envelope.decay = 0.8
        kickSynth.envelope.sustain = 0.05
        kickSynth.octaves = 8
      } else if (preset === 'punchy') {
        kickSynth.envelope.decay = 0.2
        kickSynth.envelope.sustain = 0
        kickSynth.octaves = 6
      } else if (preset === 'soft') {
        kickSynth.envelope.decay = 0.15
        kickSynth.envelope.sustain = 0
        kickSynth.octaves = 3
      } else {
        kickSynth.envelope.decay = 0.35
        kickSynth.envelope.sustain = 0
        kickSynth.octaves = 5
      }
    } else if (trackId === 'snare' && snareSynth) {
      if (preset === 'electronic') {
        snareSynth.noise.type = 'white'
        snareSynth.envelope.decay = 0.1
      } else if (preset === 'noise_only') {
        snareSynth.noise.type = 'white'
        snareSynth.envelope.decay = 0.25
      } else if (preset === 'synthesized') {
        snareSynth.noise.type = 'pink'
        snareSynth.envelope.decay = 0.08
      } else {
        snareSynth.noise.type = 'pink'
        snareSynth.envelope.decay = 0.15
      }
    } else if (trackId === 'hihat' && hihatSynth) {
      if (preset === 'sizzle') {
        hihatSynth.envelope.decay = 0.05
        hihatSynth.envelope.release = 0.2
        hihatSynth.resonance = 6000
        hihatSynth.harmonicity = 4.0
        hihatSynth.modulationIndex = 20
      } else if (preset === 'open') {
        hihatSynth.envelope.decay = 0.25
        hihatSynth.envelope.release = 0.25
        hihatSynth.resonance = 8000
        hihatSynth.harmonicity = 5.1
        hihatSynth.modulationIndex = 32
      } else {
        hihatSynth.envelope.decay = 0.05
        hihatSynth.envelope.release = 0.05
        hihatSynth.resonance = 8000
        hihatSynth.harmonicity = 5.1
        hihatSynth.modulationIndex = 32
      }
    }
  }

  function disposeAudioEngine() {
    Tone.Transport.stop()
    Object.values(sequences).forEach((seq) => seq.dispose())
    Object.values(channels).forEach((ch) => ch.dispose())
    Object.values(samplePlayers).forEach((player) => player.dispose())
    
    if (kickSynth) kickSynth.dispose()
    if (snareSynth) snareSynth.dispose()
    if (snareOsc) snareOsc.dispose()
    if (hihatSynth) hihatSynth.dispose()
  }

  return {
    isAudioInitialized,
    isPlaying,
    selectedKit,
    initAudio,
    togglePlay,
    setupSequence,
    triggerInstrument,
    playSynth,
    updateBpm,
    updateMasterVolume,
    updateTrackVolume,
    updateTrackMute,
    updateTrackSolo,
    applyPresetSettings,
    disposeAudioEngine
  }
}
