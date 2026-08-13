// ── gestures.js — pointer-based gesture recognition ──
//
// Built on Pointer Events rather than Touch Events so touch, trackpad, mouse
// and pen all run through one code path — the prototype behaves the same on a
// phone and on a laptop.
//
// The important idea here is ownership. A drag on a photo stack must not also
// page the card underneath it. Handlers are wired innermost-first (event
// bubbling gives the most specific element first refusal), and whichever one
// claims the pointer holds it until release; everyone else stands down.

(function (global) {
  'use strict';

  const M = global.Motion;

  let owner = null;
  let ownerPointerId = -1;

  function claim(recognizer, pointerId) {
    if (owner && owner !== recognizer) return false;
    owner = recognizer;
    ownerPointerId = pointerId;
    return true;
  }

  function release(recognizer) {
    if (owner === recognizer) {
      owner = null;
      ownerPointerId = -1;
    }
  }

  function isBlocked(recognizer) {
    return owner !== null && owner !== recognizer;
  }

  // ── Drag ──
  class Drag {
    constructor(el, opts) {
      const o = opts || {};
      this.el = el;
      this.axis = o.axis || 'x';            // 'x' | 'y' | 'both'
      this.slop = o.slop != null ? o.slop : 6;
      this.lockRatio = o.lockRatio != null ? o.lockRatio : 1;
      this.edge = o.edge || null;           // 'left' — only start near that edge
      this.edgeSize = o.edgeSize != null ? o.edgeSize : 28;
      this.enabled = o.enabled !== false;

      this.onStart = o.onStart;
      this.onMove = o.onMove;
      this.onEnd = o.onEnd;
      this.onTap = o.onTap;
      this.onPressStart = o.onPressStart;
      this.onPressEnd = o.onPressEnd;
      this.tapSlop = o.tapSlop != null ? o.tapSlop : 10;
      this.tapTime = o.tapTime != null ? o.tapTime : 400;

      this.pointerId = -1;
      this.active = false;      // pointer is down
      this.claimed = false;     // we own the gesture
      this.rejected = false;    // we evaluated and declined this pointer
      this.lockedAxis = null;   // which way the gesture went, once decided
      this.tracker = new M.VelocityTracker(100);

      this._down = this._onDown.bind(this);
      this._move = this._onMove.bind(this);
      this._up = this._onUp.bind(this);
      this._cancel = this._onCancel.bind(this);

      // touch-action:none tells the browser we handle panning ourselves, which
      // means move listeners can stay passive — no preventDefault needed, so
      // no main-thread round trip before the browser knows what to do.
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', this._down);
      // Move stays on the element so DOM bubbling decides who claims first.
      el.addEventListener('pointermove', this._move, { passive: true });
      el.addEventListener('dragstart', preventDefault);
      // Up/cancel go on the window, added only while a pointer is down. On
      // the element they get missed whenever the finger lifts somewhere else
      // — which is every drag that travels — leaving the recognizer latched
      // and deaf to everything after it.
    }

    _onDown(e) {
      if (!this.enabled || this.active) return;
      if (!e.isPrimary) return;
      if (this.edge === 'left' && e.clientX > this.edgeSize) return;

      this.pointerId = e.pointerId;
      this.active = true;
      this.claimed = false;
      this.rejected = false;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.dx = 0;
      this.dy = 0;
      this.startTime = performance.now();
      this.lockedAxis = null;
      this.tracker.reset(e.clientX, e.clientY);

      window.addEventListener('pointerup', this._up);
      window.addEventListener('pointercancel', this._cancel);

      if (this.onPressStart) this.onPressStart(this._state(e));
    }

    _onMove(e) {
      if (!this.active || e.pointerId !== this.pointerId) return;

      this.dx = e.clientX - this.startX;
      this.dy = e.clientY - this.startY;
      this.tracker.add(e.clientX, e.clientY);

      if (!this.claimed) {
        if (this.rejected) return;
        const adx = Math.abs(this.dx);
        const ady = Math.abs(this.dy);
        if (adx < this.slop && ady < this.slop) return;

        // Past the slop radius the direction is decided once and held for the
        // rest of the gesture. Re-deciding mid-drag is what makes a pager feel
        // like it's fighting you.
        let wants;
        if (this.axis === 'none') wants = false;   // tap-only; let drags fall through
        else if (this.axis === 'x') wants = adx > ady * this.lockRatio;
        else if (this.axis === 'y') wants = ady > adx * this.lockRatio;
        else wants = true;
        this.lockedAxis = adx > ady ? 'x' : 'y';

        if (!wants || isBlocked(this) || !claim(this, this.pointerId)) {
          // Not our gesture. Stand down immediately and let it pass to
          // whoever is next up the tree.
          if (this.onPressEnd) this.onPressEnd(this._state(e));
          this._finish();
          this.rejected = true;
          return;
        }

        this.claimed = true;
        // Capture so the drag keeps tracking after the finger leaves the
        // element's bounds — otherwise fast drags stall at the edges.
        try { this.el.setPointerCapture(this.pointerId); } catch (err) { /* not fatal */ }
        if (this.onPressEnd) this.onPressEnd(this._state(e));
        if (this.onStart) this.onStart(this._state(e));
      }

      if (this.claimed && this.onMove) this.onMove(this._state(e));
    }

    _onUp(e) {
      if (!this.active || e.pointerId !== this.pointerId) return;
      const state = this._state(e);
      const wasClaimed = this.claimed;
      this._finish();

      if (wasClaimed) {
        if (this.onEnd) this.onEnd(state);
      } else {
        // Never claimed and never travelled — that's a tap. (A recognizer
        // that declined the gesture has already finished, so it won't reach
        // here at all.)
        const dist = Math.hypot(state.dx, state.dy);
        if (dist <= this.tapSlop && state.duration <= this.tapTime && this.onTap) {
          this.onTap(state);
        }
      }
      if (this.onPressEnd) this.onPressEnd(state);
    }

    _onCancel(e) {
      if (!this.active || e.pointerId !== this.pointerId) return;
      const state = this._state(e);
      const wasClaimed = this.claimed;
      this._finish();
      if (wasClaimed && this.onEnd) this.onEnd(state, true);
      if (this.onPressEnd) this.onPressEnd(state);
    }

    _finish() {
      if (this.claimed) {
        try { this.el.releasePointerCapture(this.pointerId); } catch (err) { /* not fatal */ }
      }
      window.removeEventListener('pointerup', this._up);
      window.removeEventListener('pointercancel', this._cancel);
      release(this);
      this.active = false;
      this.claimed = false;
      this.pointerId = -1;
    }

    _state(e) {
      const v = this.tracker.get();
      return {
        dx: this.dx,
        dy: this.dy,
        axis: this.lockedAxis,
        x: e.clientX,
        y: e.clientY,
        startX: this.startX,
        startY: this.startY,
        vx: v.x,
        vy: v.y,
        duration: performance.now() - this.startTime,
        event: e,
      };
    }

    setEnabled(on) {
      this.enabled = on;
      if (!on && this.active) this._finish();
    }

    destroy() {
      this._finish();
      this.el.removeEventListener('pointerdown', this._down);
      this.el.removeEventListener('pointermove', this._move);
      this.el.removeEventListener('dragstart', preventDefault);
    }
  }

  function preventDefault(e) { e.preventDefault(); }

  // ── Press feedback ──
  // Scales through an Animated so it composes with whatever rotation the
  // element was laid out with, instead of overwriting the transform.
  function press(animated, opts) {
    const o = opts || {};
    const down = o.scale != null ? o.scale : 0.96;
    return {
      start: function () {
        animated.to({ scale: down }, { config: M.STIFF });
      },
      end: function () {
        animated.to({ scale: 1 }, { config: M.SNAP });
      },
    };
  }

  global.Gestures = {
    Drag: Drag,
    press: press,
    get owner() { return owner; },
  };
})(window);
