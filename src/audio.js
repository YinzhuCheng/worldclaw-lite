export class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.ambientGain = null;
    this.muted = false;
    this.ready = false;
    this.lastStep = 0;
  }

  async start() {
    if (!this.context) this.#createGraph();
    if (!this.context) {
      this.ready = false;
      return false;
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.ready = true;
    return true;
  }

  #createGraph() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.72;
    this.master.connect(this.context.destination);

    this.ambientGain = this.context.createGain();
    this.ambientGain.gain.value = 0.12;
    this.ambientGain.connect(this.master);

    const wind = this.context.createBufferSource();
    wind.buffer = this.#noiseBuffer(4);
    wind.loop = true;
    const windFilter = this.context.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 740;
    windFilter.Q.value = 0.7;
    wind.connect(windFilter).connect(this.ambientGain);
    wind.start();

    const hum = this.context.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 48;
    const humGain = this.context.createGain();
    humGain.gain.value = 0.025;
    hum.connect(humGain).connect(this.ambientGain);
    hum.start();
  }

  #noiseBuffer(seconds = 1) {
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    let value = 0;
    for (let index = 0; index < length; index += 1) {
      value = value * 0.985 + (Math.random() * 2 - 1) * 0.16;
      channel[index] = value;
    }
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.72, this.context.currentTime + 0.08);
    }
  }

  setNightFactor(value) {
    if (!this.ambientGain || !this.context) return;
    this.ambientGain.gain.setTargetAtTime(0.09 + value * 0.08, this.context.currentTime, 0.8);
  }

  tone({ frequency = 440, duration = 0.12, type = 'sine', gain = 0.12, slide = 0, delay = 0 } = {}) {
    if (!this.ready || !this.context || this.muted) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.025, duration * 0.3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  noise({ duration = 0.09, gain = 0.07, frequency = 1300, delay = 0 } = {}) {
    if (!this.ready || !this.context || this.muted) return;
    const start = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.#noiseBuffer(Math.max(0.1, duration));
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.85;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(envelope).connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  step(surface = 'grass', sprinting = false) {
    const now = performance.now();
    const interval = sprinting ? 270 : 390;
    if (now - this.lastStep < interval) return;
    this.lastStep = now;
    const frequency = surface === 'water' ? 680 : surface === 'stone' ? 1300 : 930;
    this.noise({ duration: 0.06, gain: sprinting ? 0.075 : 0.052, frequency });
  }

  collect() {
    [420, 630, 930].forEach((frequency, index) => this.tone({ frequency, duration: 0.18, gain: 0.09, slide: 90, delay: index * 0.055 }));
  }

  relay() {
    this.tone({ frequency: 110, duration: 0.8, type: 'sawtooth', gain: 0.08, slide: 520 });
    [260, 390, 520].forEach((frequency, index) => this.tone({ frequency, duration: 0.34, gain: 0.06, delay: 0.22 + index * 0.08 }));
  }

  shoot() {
    this.tone({ frequency: 180, duration: 0.09, type: 'square', gain: 0.07, slide: 580 });
    this.noise({ duration: 0.05, gain: 0.035, frequency: 2100 });
  }

  hit() {
    this.tone({ frequency: 150, duration: 0.1, type: 'triangle', gain: 0.08, slide: -60 });
  }

  enemyDown() {
    this.tone({ frequency: 380, duration: 0.35, type: 'sine', gain: 0.08, slide: -250 });
    this.noise({ duration: 0.22, gain: 0.05, frequency: 520 });
  }

  scan() {
    this.tone({ frequency: 720, duration: 0.42, type: 'sine', gain: 0.06, slide: -280 });
  }

  damage() {
    this.noise({ duration: 0.16, gain: 0.11, frequency: 240 });
    this.tone({ frequency: 82, duration: 0.2, type: 'sawtooth', gain: 0.08, slide: -22 });
  }

  complete() {
    [220, 330, 440, 660, 880].forEach((frequency, index) => this.tone({ frequency, duration: 0.55, gain: 0.075, slide: 50, delay: index * 0.12 }));
  }
}
