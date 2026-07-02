export interface KitConfig {
  kick: string
  snare: string
  hihat: string
}

export const kitsConfig: Record<string, KitConfig> = {
  tr808: {
    kick: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808bd/BD0000.WAV',
    snare: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808sd/SD0000.WAV',
    hihat: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808/CH.WAV'
  },
  cr78: {
    kick: 'https://oramics.github.io/sampled/DM/CR-78/samples/kick.wav',
    snare: 'https://oramics.github.io/sampled/DM/CR-78/samples/snare.wav',
    hihat: 'https://oramics.github.io/sampled/DM/CR-78/samples/hihat.wav'
  },
  tr909: {
    kick: 'https://oramics.github.io/sampled/DM/TR-909/Detroit/samples/kick.wav',
    snare: 'https://oramics.github.io/sampled/DM/TR-909/Detroit/samples/snare.wav',
    hihat: 'https://oramics.github.io/sampled/DM/TR-909/Detroit/samples/hihat-closed.wav'
  },
  linndrum: {
    kick: 'https://oramics.github.io/sampled/DM/LM-2/samples/kick.wav',
    snare: 'https://oramics.github.io/sampled/DM/LM-2/samples/snare.wav',
    hihat: 'https://oramics.github.io/sampled/DM/LM-2/samples/hihat-closed.wav'
  },
  acoustic: {
    kick: 'https://tonejs.github.io/audio/drum-samples/kick.mp3',
    snare: 'https://tonejs.github.io/audio/drum-samples/snare.mp3',
    hihat: 'https://tonejs.github.io/audio/drum-samples/hihat.mp3'
  }
}
