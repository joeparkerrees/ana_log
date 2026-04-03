// ── Gesture Engine ──

class SwipeHandler {
  constructor(el, opts = {}) {
    this.el = el;
    this.onMove = opts.onMove;
    this.onEnd = opts.onEnd;
    this.onStart = opts.onStart;
    this.direction = opts.direction || 'horizontal';
    this.tracking = false;
    this.startX = 0;
    this.startY = 0;
    this.dx = 0;
    this.dy = 0;
    this.startTime = 0;
    this.locked = false;

    this._ts = this._onTouchStart.bind(this);
    this._tm = this._onTouchMove.bind(this);
    this._te = this._onTouchEnd.bind(this);

    el.addEventListener('touchstart', this._ts, { passive: true });
    el.addEventListener('touchmove', this._tm, { passive: false });
    el.addEventListener('touchend', this._te, { passive: true });
    el.addEventListener('touchcancel', this._te, { passive: true });
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

      this.locked = true;
      if (this.direction === 'horizontal') {
        this.tracking = absDx > absDy;
      } else if (this.direction === 'vertical') {
        this.tracking = absDy > absDx;
      } else {
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
    const vx = this.dx / Math.max(elapsed, 1) * 1000;
    const vy = this.dy / Math.max(elapsed, 1) * 1000;
    if (this.onEnd) this.onEnd(this.dx, this.dy, vx, vy);
    this.tracking = false;
  }

  destroy() {
    this.el.removeEventListener('touchstart', this._ts);
    this.el.removeEventListener('touchmove', this._tm);
    this.el.removeEventListener('touchend', this._te);
    this.el.removeEventListener('touchcancel', this._te);
  }
}

class TapHandler {
  constructor(el, { onTap, onDoubleTap }) {
    this.el = el;
    this.onTap = onTap;
    this.onDoubleTap = onDoubleTap;
    this.lastTapTime = 0;
    this.tapTimeout = null;
    this.startX = 0;
    this.startY = 0;

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
      }
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      if (e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      if (Math.abs(t.clientX - this.startX) > 12 || Math.abs(t.clientY - this.startY) > 12) return;

      const now = Date.now();
      if (this.onDoubleTap && now - this.lastTapTime < 300) {
        clearTimeout(this.tapTimeout);
        this.lastTapTime = 0;
        this.onDoubleTap(t.clientX, t.clientY);
      } else {
        this.lastTapTime = now;
        if (this.onTap) {
          this.tapTimeout = setTimeout(() => {
            this.onTap(t.clientX, t.clientY);
          }, this.onDoubleTap ? 300 : 0);
        }
      }
    }, { passive: true });
  }
}
