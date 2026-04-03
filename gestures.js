// ── Gesture Engine ──
// Handles swipe, pinch-zoom, double-tap, and flick-to-dismiss

class SwipeHandler {
  constructor(el, { onMove, onEnd, onStart, direction = 'horizontal' }) {
    this.el = el;
    this.onMove = onMove;
    this.onEnd = onEnd;
    this.onStart = onStart;
    this.direction = direction;
    this.tracking = false;
    this.startX = 0;
    this.startY = 0;
    this.dx = 0;
    this.dy = 0;
    this.startTime = 0;

    el.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
    el.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
    el.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: true });
    el.addEventListener('touchcancel', this._onTouchEnd.bind(this), { passive: true });
  }

  _onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    this.startX = t.clientX;
    this.startY = t.clientY;
    this.dx = 0;
    this.dy = 0;
    this.startTime = Date.now();
    this.tracking = false;
    this.locked = false;
  }

  _onTouchMove(e) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    this.dx = t.clientX - this.startX;
    this.dy = t.clientY - this.startY;

    if (!this.locked) {
      const absDx = Math.abs(this.dx);
      const absDy = Math.abs(this.dy);
      if (absDx < 5 && absDy < 5) return;

      if (this.direction === 'horizontal') {
        this.locked = true;
        this.tracking = absDx > absDy;
      } else if (this.direction === 'vertical') {
        this.locked = true;
        this.tracking = absDy > absDx;
      } else {
        this.locked = true;
        this.tracking = true;
      }

      if (this.tracking && this.onStart) this.onStart();
    }

    if (this.tracking) {
      e.preventDefault();
      if (this.onMove) this.onMove(this.dx, this.dy);
    }
  }

  _onTouchEnd() {
    if (!this.tracking) return;
    const elapsed = Date.now() - this.startTime;
    const velocityX = this.dx / Math.max(elapsed, 1) * 1000;
    const velocityY = this.dy / Math.max(elapsed, 1) * 1000;
    if (this.onEnd) this.onEnd(this.dx, this.dy, velocityX, velocityY);
    this.tracking = false;
  }

  destroy() {
    // Could remove listeners if needed
  }
}

class PinchZoomHandler {
  constructor(el, { onZoomChange, onDoubleTap, onTap }) {
    this.el = el;
    this.onZoomChange = onZoomChange;
    this.onDoubleTap = onDoubleTap;
    this.onTap = onTap;

    this.scale = 1;
    this.lastScale = 1;
    this.originX = 0;
    this.originY = 0;
    this.translateX = 0;
    this.translateY = 0;
    this.lastTranslateX = 0;
    this.lastTranslateY = 0;
    this.isPinching = false;
    this.initialDistance = 0;
    this.initialMidX = 0;
    this.initialMidY = 0;

    // Double tap detection
    this.lastTapTime = 0;
    this.lastTapX = 0;
    this.lastTapY = 0;
    this.tapTimeout = null;

    // Pan when zoomed
    this.panStartX = 0;
    this.panStartY = 0;

    el.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    el.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
    el.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: true });
    el.addEventListener('touchcancel', this._onTouchEnd.bind(this), { passive: true });
  }

  _getDistance(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  _getMidpoint(t1, t2) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  }

  _onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.isPinching = true;
      this.initialDistance = this._getDistance(e.touches[0], e.touches[1]);
      const mid = this._getMidpoint(e.touches[0], e.touches[1]);
      this.initialMidX = mid.x;
      this.initialMidY = mid.y;
      this.lastScale = this.scale;
      this.lastTranslateX = this.translateX;
      this.lastTranslateY = this.translateY;
    } else if (e.touches.length === 1 && this.scale > 1) {
      // Pan start when zoomed
      this.panStartX = e.touches[0].clientX - this.translateX;
      this.panStartY = e.touches[0].clientY - this.translateY;
    }
  }

  _onTouchMove(e) {
    if (e.touches.length === 2 && this.isPinching) {
      e.preventDefault();
      const dist = this._getDistance(e.touches[0], e.touches[1]);
      const mid = this._getMidpoint(e.touches[0], e.touches[1]);

      this.scale = Math.max(1, Math.min(5, this.lastScale * (dist / this.initialDistance)));

      // Translate to keep pinch center stable
      this.translateX = this.lastTranslateX + (mid.x - this.initialMidX);
      this.translateY = this.lastTranslateY + (mid.y - this.initialMidY);

      this._clampTranslation();
      this._emitChange();
    } else if (e.touches.length === 1 && this.scale > 1 && !this.isPinching) {
      e.preventDefault();
      this.translateX = e.touches[0].clientX - this.panStartX;
      this.translateY = e.touches[0].clientY - this.panStartY;
      this._clampTranslation();
      this._emitChange(true);
    }
  }

  _clampTranslation() {
    const rect = this.el.getBoundingClientRect();
    const maxTx = (rect.width * (this.scale - 1)) / 2;
    const maxTy = (rect.height * (this.scale - 1)) / 2;
    this.translateX = Math.max(-maxTx, Math.min(maxTx, this.translateX));
    this.translateY = Math.max(-maxTy, Math.min(maxTy, this.translateY));
  }

  _onTouchEnd(e) {
    if (this.isPinching && e.touches.length < 2) {
      this.isPinching = false;
      if (this.scale <= 1.1) {
        this.resetZoom();
      }
      return;
    }

    // Tap / double-tap detection (single finger, no pinch active)
    if (e.changedTouches.length === 1 && !this.isPinching) {
      const t = e.changedTouches[0];
      const now = Date.now();
      const dx = Math.abs(t.clientX - (this._touchStartX || 0));
      const dy = Math.abs(t.clientY - (this._touchStartY || 0));

      // Only count as tap if finger didn't move much
      if (dx < 10 && dy < 10) {
        if (now - this.lastTapTime < 300 &&
            Math.abs(t.clientX - this.lastTapX) < 30 &&
            Math.abs(t.clientY - this.lastTapY) < 30) {
          // Double tap
          clearTimeout(this.tapTimeout);
          this.lastTapTime = 0;
          if (this.scale > 1) {
            this.resetZoom();
          } else if (this.onDoubleTap) {
            this.onDoubleTap(t.clientX, t.clientY);
            this.scale = 2.5;
            const rect = this.el.getBoundingClientRect();
            this.translateX = (rect.width / 2 - t.clientX) * (this.scale - 1) / this.scale;
            this.translateY = (rect.height / 2 - t.clientY) * (this.scale - 1) / this.scale;
            this._clampTranslation();
            this._emitChange();
          }
        } else {
          this.lastTapTime = now;
          this.lastTapX = t.clientX;
          this.lastTapY = t.clientY;

          // Delayed single tap
          this.tapTimeout = setTimeout(() => {
            if (this.onTap) this.onTap();
          }, 300);
        }
      }
    }

    // Track start position for tap detection
    if (e.type === 'touchstart' && e.touches.length === 1) {
      this._touchStartX = e.touches[0].clientX;
      this._touchStartY = e.touches[0].clientY;
    }
  }

  resetZoom() {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this._emitChange();
  }

  _emitChange(panning) {
    if (this.onZoomChange) {
      this.onZoomChange(this.scale, this.translateX, this.translateY, panning);
    }
  }
}
