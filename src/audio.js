export const AudioSystem = {
  playedSounds: [],

  play(soundName) {
    this.playedSounds.push({
      soundName,
      timestamp: Date.now()
    });

    try {
      if (typeof window !== 'undefined' && window.Audio) {
        const audio = new window.Audio();
        if (audio && typeof audio.play === 'function') {
          const p = audio.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        }
      }
    } catch (e) {
      // Audio playback fallback / ignore environment restrictions
    }
  },

  getAudioLog() {
    return [...this.playedSounds];
  },

  clearAudioLog() {
    this.playedSounds = [];
  }
};
