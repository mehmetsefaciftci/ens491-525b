// Walking detection from the accelerometer (DeviceMotion, gravity removed).
// P(moving) = logistic((RMS acceleration over 2 s - 0.6 m/s^2) / 0.15). Thresholds are [N]
// engineering guesses to be checked in the pilot; a phone held still reads about 0.1 m/s^2.
export class MotionMeter {
  constructor({ windowSec = 2, mid = 0.6, scale = 0.15 } = {}) {
    Object.assign(this, { windowSec, mid, scale, samples: [], available: false });
  }

  // Must be called inside a tap handler: iOS asks for permission there.
  requestPermission() {
    const DME = window.DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === "function") return DME.requestPermission().catch(() => "denied");
    return Promise.resolve(DME ? "granted" : "unsupported");
  }

  start() {
    window.addEventListener("devicemotion", (e) => {
      const a = e.acceleration;
      if (!a || a.x == null) return;
      this.available = true;
      const t = performance.now();
      this.samples.push([t, a.x * a.x + a.y * a.y + a.z * a.z]);
      while (this.samples.length && t - this.samples[0][0] > this.windowSec * 1000) this.samples.shift();
    });
  }

  rms() {
    if (!this.available || this.samples.length < 5) return null;
    return Math.sqrt(this.samples.reduce((s, x) => s + x[1], 0) / this.samples.length);
  }

  pMoving() {
    const r = this.rms();
    return r == null ? 0 : 1 / (1 + Math.exp(-(r - this.mid) / this.scale));
  }
}
