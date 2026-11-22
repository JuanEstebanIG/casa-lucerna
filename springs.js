// ============================================================================
// Casa Lucerna — Fluid Spring Physics & Direct Manipulation Primitives
// Translated from Apple WWDC "Designing Fluid Interfaces"
// ============================================================================

/**
 * Apple's exponential-decay momentum projection (UIScrollView deceleration).
 * Projects resting offset from release velocity in px/s.
 */
export function projectVelocity(velocityPxPerSec, decelerationRate = 0.998) {
  return ((velocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Apple's progressive soft-boundary resistance (rubber-banding).
 */
export function rubberband(overshoot, dimension, constant = 0.55) {
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Interruptible, velocity-preserving 1D spring parameterized by Apple's
 * (response, dampingRatio) pair rather than raw stiffness/damping.
 *
 * - dampingRatio = 1.0  -> critically damped (smooth settle, no overshoot)
 * - dampingRatio = 0.82 -> slight physical overshoot for flick/momentum gestures
 */
export class FluidSpring {
  constructor(initialValue = 0, { response = 0.38, dampingRatio = 1.0, precision = 0.001 } = {}) {
    this.value = initialValue;
    this.target = initialValue;
    this.velocity = 0;
    this.precision = precision;
    this.setConfig({ response, dampingRatio });
  }

  setConfig({ response = 0.38, dampingRatio = 1.0 } = {}) {
    const r = Math.max(0.08, response);
    this.response = r;
    this.dampingRatio = Math.max(0.2, dampingRatio);
    this.stiffness = Math.pow((2 * Math.PI) / r, 2);
    this.damping = (4 * Math.PI * this.dampingRatio) / r;
  }

  /**
   * Re-target smoothly from the LIVE presentation value while preserving
   * existing velocity (or blending in a new gesture handoff velocity).
   */
  setTarget(nextTarget, handoffVelocity = null) {
    this.target = nextTarget;
    if (typeof handoffVelocity === 'number' && Number.isFinite(handoffVelocity)) {
      this.velocity = handoffVelocity;
    }
  }

  /**
   * Immediately teleport (used during 1:1 direct pointer tracking).
   */
  snap(val) {
    this.value = val;
    this.target = val;
    this.velocity = 0;
  }

  /**
   * Advance spring by dt seconds using sub-stepped semi-implicit Euler
   * for rock-solid stability across 60Hz–240Hz displays.
   * Returns true while still in motion.
   */
  step(dt) {
    const clampedDt = Math.min(Math.max(dt, 0), 0.064);
    const maxStep = 0.004;
    let remaining = clampedDt;

    while (remaining > 0) {
      const h = Math.min(remaining, maxStep);
      const displacement = this.value - this.target;
      const springForce = -this.stiffness * displacement;
      const dampingForce = -this.damping * this.velocity;
      const accel = springForce + dampingForce;
      this.velocity += accel * h;
      this.value += this.velocity * h;
      remaining -= h;
    }

    const isSettled =
      Math.abs(this.value - this.target) < this.precision &&
      Math.abs(this.velocity) < this.precision * 10;

    if (isSettled) {
      this.value = this.target;
      this.velocity = 0;
      return false;
    }
    return true;
  }
}

/**
 * Tracks a rolling window of pointer samples to compute clean release velocity (px/s).
 */
export class VelocityTracker {
  constructor(windowMs = 90) {
    this.windowMs = windowMs;
    this.samples = [];
  }

  reset() {
    this.samples.length = 0;
  }

  add(pos, time = performance.now()) {
    this.samples.push({ pos, time });
    const cutoff = time - this.windowMs;
    while (this.samples.length > 2 && this.samples[0].time < cutoff) {
      this.samples.shift();
    }
  }

  getVelocity() {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dtMs = last.time - first.time;
    if (dtMs <= 1) return 0;
    return ((last.pos - first.pos) / dtMs) * 1000;
  }
}

/**
 * Shared lightweight rAF driver for multiple active springs.
 */
export function createSpringRunner(onFrame) {
  let rafId = null;
  let lastTime = 0;

  function tick(now) {
    const dt = lastTime ? (now - lastTime) / 1000 : 1 / 60;
    lastTime = now;
    const keepRunning = onFrame(dt);
    if (keepRunning) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
      lastTime = 0;
    }
  }

  return {
    start() {
      if (rafId === null) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    },
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
        lastTime = 0;
      }
    }
  };
}
