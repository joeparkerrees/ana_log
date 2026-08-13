// ── motion.js — self-contained spring physics ──
//
// Everything animated in the app runs off one shared rAF loop. Springs
// integrate first, then style writes flush in a single pass, so we never
// interleave reads and writes inside a frame.
//
// The reason this is hand-rolled rather than pulled from a library: gesture
// handoff. When a finger lifts, the release animation has to start with the
// velocity the finger was carrying, and it has to be re-grabbable mid-flight
// with whatever velocity it has at that instant. That's the whole feel.

(function (global) {
  'use strict';

  const springs = new Set();
  const dirty = new Set();
  let rafId = 0;
  let lastTime = 0;

  const reduceMotion = global.matchMedia
    ? global.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function schedule() {
    if (rafId) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function frame(now) {
    // Clamp dt so a dropped frame or a backgrounded tab can't detonate the
    // integrator. 64ms is about four frames at 60Hz.
    const dt = Math.min((now - lastTime) / 1000, 0.064);
    lastTime = now;

    for (const s of springs) s._advance(dt);
    for (const w of dirty) w._flush();
    dirty.clear();

    // Springs keep the loop alive; a gesture-only frame lets it stop and
    // gets rescheduled by the next _mark().
    rafId = springs.size ? requestAnimationFrame(frame) : 0;
  }

  // ── Spring ──
  // Damped harmonic oscillator, integrated at fixed 1ms substeps so the
  // result is identical at 60Hz, 120Hz, or after a stutter.
  class Spring {
    constructor(value, config) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.animating = false;
      this.owner = null;
      this.onRest = null;
      this.configure(config);
    }

    configure(config) {
      const c = config || Motion.SETTLE;
      this.stiffness = c.stiffness;
      this.damping = c.damping;
      this.mass = c.mass || 1;
      this.restDelta = c.restDelta != null ? c.restDelta : 0.01;
      this.restSpeed = c.restSpeed != null ? c.restSpeed : 0.2;
      return this;
    }

    // Hard set — kills velocity. Used while a finger is driving the value.
    set(v) {
      this.value = v;
      this.target = v;
      this.velocity = 0;
      this._stop();
      this._mark();
      return this;
    }

    // Drive the value directly without touching the target, so a spring can
    // be taken over by a gesture and released again without a discontinuity.
    track(v) {
      this.value = v;
      this._mark();
      return this;
    }

    // Retarget. Keeps whatever velocity the spring already has unless an
    // explicit one is handed in — that's the gesture-release path.
    to(target, opts) {
      const o = opts || {};
      if (o.config) this.configure(o.config);
      this.target = target;
      if (o.velocity != null) this.velocity = o.velocity;
      if (o.onRest !== undefined) this.onRest = o.onRest;

      if (reduceMotion.matches) {
        this.value = target;
        this.velocity = 0;
        this._stop();
        this._mark();
        if (this.onRest) { const cb = this.onRest; this.onRest = null; cb(); }
        return this;
      }

      if (!this.animating) {
        this.animating = true;
        springs.add(this);
        schedule();
      }
      return this;
    }

    stop() {
      this._stop();
      return this;
    }

    _stop() {
      if (!this.animating) return;
      this.animating = false;
      springs.delete(this);
    }

    _mark() {
      if (!this.owner) return;
      dirty.add(this.owner);
      // A finger-driven value changes without any spring running, so the
      // frame loop has to be woken here too — otherwise direct manipulation
      // writes nothing until something else happens to be animating.
      schedule();
    }

    _advance(dt) {
      const k = this.stiffness;
      const c = this.damping;
      const m = this.mass;
      const target = this.target;
      let x = this.value;
      let v = this.velocity;

      let remaining = dt;
      while (remaining > 0) {
        const h = remaining > 0.001 ? 0.001 : remaining;
        remaining -= h;
        const a = (-k * (x - target) - c * v) / m;
        v += a * h;
        x += v * h;
      }

      this.value = x;
      this.velocity = v;
      this._mark();

      if (Math.abs(x - target) < this.restDelta && Math.abs(v) < this.restSpeed) {
        this.value = target;
        this.velocity = 0;
        this._stop();
        this._mark();
        if (this.onRest) {
          const cb = this.onRest;
          this.onRest = null;
          cb();
        }
      }
    }
  }

  // ── Animated ──
  // Owns one element's transform. Every animated property lives here and the
  // transform string is always composed from the same slots in the same order,
  // so a scale animation can never wipe out a rotation the way it does when
  // separate animations each write `style.transform` themselves.
  class Animated {
    constructor(el, initial) {
      this.el = el;
      const i = initial || {};
      this.props = {};
      this._defs = {
        x: 0, y: 0, rotate: 0, scale: 1, opacity: 1,
      };
      for (const key in this._defs) {
        const s = new Spring(i[key] != null ? i[key] : this._defs[key]);
        s.owner = this;
        this.props[key] = s;
      }
      this._hinted = false;
      this._flush();
    }

    get(key) { return this.props[key].value; }

    // Instant, velocity-clearing write, flushed synchronously so that code
    // which positions an element and then measures it reads the new value
    // rather than last frame's. Not a hot path — gestures use track().
    set(values) {
      for (const key in values) this.props[key].set(values[key]);
      this._flush();
      dirty.delete(this);
      return this;
    }

    // Same as set() but preserves each spring's velocity, so an in-flight
    // animation can be grabbed by a finger and released with momentum intact.
    track(values) {
      for (const key in values) this.props[key].track(values[key]);
      return this;
    }

    velocityOf(key) { return this.props[key].velocity; }

    // Animate to a set of values. `opts.velocity` may be a per-key map.
    to(values, opts) {
      const o = opts || {};
      const keys = Object.keys(values);
      let restKey = null;
      // Attach the rest callback to whichever property has furthest to travel,
      // so "done" means the whole gesture is done, not just the fastest axis.
      let furthest = -Infinity;
      for (const key of keys) {
        const d = Math.abs(values[key] - this.props[key].value);
        if (d > furthest) { furthest = d; restKey = key; }
      }
      this._hint(true);
      for (const key of keys) {
        const vel = o.velocity && typeof o.velocity === 'object'
          ? o.velocity[key]
          : (key === 'x' || key === 'y' ? o.velocity : undefined);
        this.props[key].to(values[key], {
          config: o.config,
          velocity: vel,
          onRest: key === restKey
            ? () => { this._hint(false); if (o.onRest) o.onRest(); }
            : null,
        });
      }
      return this;
    }

    stop() {
      for (const key in this.props) this.props[key].stop();
      return this;
    }

    // will-change is expensive to leave on permanently — it pins a
    // compositor layer per element. Toggle it around actual motion.
    _hint(on) {
      if (on === this._hinted) return;
      this._hinted = on;
      this.el.style.willChange = on ? 'transform, opacity' : '';
    }

    _flush() {
      const p = this.props;
      const x = p.x.value;
      const y = p.y.value;
      const r = p.rotate.value;
      const s = p.scale.value;
      this.el.style.transform =
        'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) ' +
        'rotate(' + r.toFixed(3) + 'deg) ' +
        'scale(' + s.toFixed(4) + ')';
      const o = p.opacity.value;
      this.el.style.opacity = o >= 1 ? '' : o.toFixed(3);
    }
  }

  // ── Gesture math ──

  // How far a flick would coast if you let it decelerate naturally. This is
  // what decides whether a swipe commits: it answers "where was the user
  // aiming?" rather than "how far did their finger actually get?", which is
  // why a short fast flick and a long slow drag both do the right thing.
  //
  // The deceleration rate is defined per millisecond (this is the UIScrollView
  // formulation), so velocity — which arrives here in px/s — is converted
  // first. Skipping that conversion inflates every projection 1000x and makes
  // even a slow drag look like a committed flick.
  function project(velocity, decelerationRate) {
    const rate = decelerationRate != null ? decelerationRate : 0.998;
    return (velocity / 1000) * rate / (1 - rate);
  }

  // Asymptotic resistance past a boundary — the further you pull, the harder
  // it pushes back, approaching a limit rather than sliding linearly.
  function rubberBand(offset, dimension, constant) {
    const c = constant != null ? constant : 0.55;
    const sign = offset < 0 ? -1 : 1;
    const abs = Math.abs(offset);
    return sign * (1 - 1 / ((abs * c / dimension) + 1)) * dimension;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  // Short tick on state changes. Android honours this; iOS Safari ignores it
  // rather than erroring, so it's safe to call unconditionally.
  function haptic(ms) {
    if (global.navigator && global.navigator.vibrate) {
      try { global.navigator.vibrate(ms || 8); } catch (e) { /* not fatal */ }
    }
  }

  // ── Velocity tracker ──
  // Averages over a short trailing window instead of using the last two
  // points. A single-sample velocity is dominated by whatever jitter happened
  // in the final 8ms, which is how you get flicks that misfire.
  class VelocityTracker {
    constructor(window) {
      this.window = window || 100;
      this.samples = [];
    }
    reset(x, y) {
      this.samples = [{ x: x, y: y, t: performance.now() }];
    }
    add(x, y) {
      const now = performance.now();
      this.samples.push({ x: x, y: y, t: now });
      const cutoff = now - this.window;
      while (this.samples.length > 2 && this.samples[0].t < cutoff) {
        this.samples.shift();
      }
    }
    get() {
      if (this.samples.length < 2) return { x: 0, y: 0 };
      const first = this.samples[0];
      const last = this.samples[this.samples.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt <= 0) return { x: 0, y: 0 };
      return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
    }
  }

  // ── Spring presets ──
  // Damping ratios sit just under 1 — settles fast, with only as much
  // overshoot as reads "physical" rather than "bouncy".
  const Motion = {
    Spring: Spring,
    Animated: Animated,
    VelocityTracker: VelocityTracker,
    project: project,
    rubberBand: rubberBand,
    clamp: clamp,
    haptic: haptic,
    get reduceMotion() { return reduceMotion.matches; },

    SETTLE: { stiffness: 320, damping: 34, mass: 1 },   // ζ≈0.95 general purpose
    GLIDE:  { stiffness: 210, damping: 28, mass: 1 },   // ζ≈0.97 page transitions
    SNAP:   { stiffness: 480, damping: 38, mass: 1 },   // ζ≈0.87 small elements
    GENTLE: { stiffness: 140, damping: 22, mass: 1 },   // ζ≈0.93 large/soft moves
    STIFF:  { stiffness: 700, damping: 45, mass: 1 },   // ζ≈0.85 immediate response
  };

  global.Motion = Motion;
})(window);
