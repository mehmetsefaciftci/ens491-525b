// Ambient sound level from the device microphone.
// Output is dBFS (relative to digital full scale) plus a user-set calibration offset,
// i.e. an UNCALIBRATED estimate of dB SPL. It is not dBA (no A-weighting) and not
// traceable to a reference meter. The proposal's window: 6 s, updated every 1 s.

export class NoiseMeter {
  constructor({ windowSec = 6, sampleHz = 10, calOffset = 90 } = {}) {
    this.windowSec = windowSec;
    this.sampleHz = sampleHz;
    this.calOffset = calOffset;
    this.samples = [];          // mean-square values (linear energy)
    this.available = false;
    this.instantDb = null;
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.available = true;
    this.timer = setInterval(() => this._sample(), 1000 / this.sampleHz);
  }

  _sample() {
    this.analyser.getFloatTimeDomainData(this.buf);
    let ms = 0;
    for (let i = 0; i < this.buf.length; i++) ms += this.buf[i] * this.buf[i];
    ms /= this.buf.length;
    this.instantDb = 10 * Math.log10(ms + 1e-12) + this.calOffset;
    this.samples.push(ms);
    const max = Math.round(this.windowSec * this.sampleHz);
    if (this.samples.length > max) this.samples.splice(0, this.samples.length - max);
  }

  // Energy-averaged level over the window (Leq-style), or null if the channel is missing.
  level() {
    if (!this.available || this.samples.length < this.sampleHz) return null;
    const mean = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    return 10 * Math.log10(mean + 1e-12) + this.calOffset;
  }

  rawDbfs() {
    if (!this.available || !this.samples.length) return null;
    const mean = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    return 10 * Math.log10(mean + 1e-12);
  }

  // Sets the offset so that the current window reads `referenceDb`.
  calibrateTo(referenceDb) {
    const raw = this.rawDbfs();
    if (raw != null) this.calOffset = referenceDb - raw;
    return this.calOffset;
  }
}
