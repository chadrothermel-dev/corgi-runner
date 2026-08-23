export class MockAudio {
  constructor(src) {
    this.src = src;
    this.currentTime = 0;
  }

  play() {
    if (typeof window !== 'undefined' && window._audioLog) {
      window._audioLog.push({ src: this.src, timestamp: Date.now() });
    }
    return Promise.resolve();
  }

  pause() {}
}

export function installAudioMock() {
  if (typeof window !== 'undefined') {
    window._audioLog = [];

    window.Audio = MockAudio;

    const mockAudioContext = function() {
      return {
        createOscillator: () => ({
          connect: () => {},
          start: () => {},
          stop: () => {},
          frequency: { value: 440 }
        }),
        createGain: () => ({
          connect: () => {},
          gain: { value: 1, setValueAtTime: () => {} }
        }),
        destination: {}
      };
    };

    window.AudioContext = window.AudioContext || mockAudioContext;
    window.webkitAudioContext = window.webkitAudioContext || mockAudioContext;
  }
}

export function getAudioLog() {
  return typeof window !== 'undefined' ? (window._audioLog || []) : [];
}

export function clearAudioLog() {
  if (typeof window !== 'undefined') {
    window._audioLog = [];
  }
}
