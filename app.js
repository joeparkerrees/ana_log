// ── ana_log ──

(function () {
  'use strict';

  const M = window.Motion;
  const G = window.Gestures;

  // ── Tunables ──
  // Ratios are of screen width, so they hold across device sizes. Paging has
  // no threshold of its own — it snaps to whichever page the momentum was
  // aiming at (see the pager's onEnd).
  const BACK_COMMIT = 0.38;      // projected travel that commits a back swipe
  const PARALLAX = 0.28;         // how far the outgoing screen trails behind
  const FLICK_VELOCITY = 420;    // px/s that commits a back swipe outright
  const EXPAND_PULL = 68;        // px of pull that opens a photo stack

  const screensEl = document.getElementById('screens');
  const viewerEl = document.getElementById('photo-viewer');
  const scrimEl = document.getElementById('viewer-scrim');
  const stageEl = document.getElementById('viewer-stage');
  const trackEl = document.getElementById('viewer-track');

  const screens = [];
  let width = window.innerWidth;
  let height = window.innerHeight;

  function el(tag, className) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    return n;
  }

  // Stagger helper that collapses to zero when the user asked for less motion.
  function stagger(i, step) {
    return M.reduceMotion ? 0 : i * (step || 35);
  }

  // ── Scattered position generator ──
  // Rejection sampling that keeps the *best* candidate rather than the first
  // acceptable one. The previous version accepted anything more than half an
  // item apart, which permits 50% overlap, and gave up after 30 tries by
  // dropping the item in the top-left corner. Scoring every candidate by its
  // distance to the nearest neighbour means a crowded card degrades to "as
  // evenly spread as it can be" instead of a pile.
  function scatterPositions(count, areaW, areaH, itemW, itemH, seed) {
    const rng = mulberry32(seed);
    const positions = [];
    const padX = 18;
    const padTop = 104;   // clear of the breadcrumb + title
    const padBottom = 88; // clear of the add button and dots
    const usableW = Math.max(0, areaW - itemW - padX * 2);
    const usableH = Math.max(0, areaH - itemH - padTop - padBottom);

    for (let i = 0; i < count; i++) {
      // Alternate which half of the card each item is drawn from. A card is
      // much taller than it is wide, so pure max-distance sampling satisfies
      // itself by walking straight down and the result reads as a column.
      // Banding forces the zig-zag that makes it look hand-scattered.
      const band = (i % 2) * 0.5;
      let best = { x: padX, y: padTop };
      let bestScore = -Infinity;

      for (let attempt = 0; attempt < 48; attempt++) {
        const x = padX + (band + rng() * 0.5) * usableW;
        const y = padTop + rng() * usableH;

        let nearest = Infinity;
        for (const p of positions) {
          // Normalised by item size so wide and tall items are judged alike.
          const dx = (x - p.x) / itemW;
          const dy = (y - p.y) / itemH;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < nearest) nearest = d;
        }
        if (nearest > bestScore) { bestScore = nearest; best = { x: x, y: y }; }
      }

      positions.push({ x: best.x, y: best.y, rotation: (rng() - 0.5) * 18 });
    }
    return positions;
  }

  // ── Screen ──
  // One level of navigation. Owns its cards, its horizontal pager, and the
  // dim overlay that darkens it while a child screen sits on top.
  class Screen {
    constructor(spec) {
      this.spec = spec;
      this.cards = spec.cards;
      this.index = 0;
      this.placed = [];   // scattered items, kept so they can be reclamped

      this.el = el('div', 'screen');
      this.anim = new M.Animated(this.el);

      this.trackEl = el('div', 'card-track');
      this.trackAnim = new M.Animated(this.trackEl);
      this.el.appendChild(this.trackEl);

      this.cards.forEach((card, i) => {
        this.trackEl.appendChild(this.buildCard(card, i));
      });

      this.dimEl = el('div', 'screen-dim');
      this.dimAnim = new M.Animated(this.dimEl, { opacity: 0 });
      this.el.appendChild(this.dimEl);

      if (this.cards.length > 1) this.buildDots();

      this.setupPager();
      this.setupEdgeBack();
    }

    // ── Card construction ──
    buildCard(card) {
      const cardEl = el('div', 'content-card');
      const inner = el('div', 'card-inner');
      cardEl.appendChild(inner);

      if (this.spec.trail && this.spec.trail.length) {
        const bc = el('div', 'breadcrumb');
        this.spec.trail.forEach((item, i) => {
          const span = el('span', 'breadcrumb-item');
          span.textContent = item;
          new G.Drag(span, {
            axis: 'none',
            onTap: () => popTo(i),
          });
          bc.appendChild(span);
        });
        inner.appendChild(bc);
      }

      if (card.title) {
        const title = el('div', 'card-title');
        title.textContent = card.title + (card.flag ? ' ' + card.flag : '');
        inner.appendChild(title);
      }

      if (card.type === 'cameras') this.renderCameras(inner);
      else if (card.type === 'film') this.renderFilm(inner);
      else if (card.type === 'camera-detail') this.renderCameraDetail(inner, card);
      else if (card.type === 'roll-detail') this.renderRollDetail(inner, card);

      const addBtn = el('button', 'add-btn');
      addBtn.textContent = 'add';
      const addAnim = new M.Animated(addBtn);
      const addPress = G.press(addAnim);
      new G.Drag(addBtn, {
        axis: 'none',
        onPressStart: addPress.start,
        onPressEnd: addPress.end,
      });
      inner.appendChild(addBtn);
      return cardEl;
    }

    // Scattered objects share the same setup: laid out with left/top, with
    // rotation and everything else driven through one Animated so a press
    // scale can never wipe out the layout rotation.
    placeItem(node, pos, inner) {
      node.style.left = pos.x + 'px';
      node.style.top = pos.y + 'px';
      const anim = new M.Animated(node, {
        rotate: pos.rotation,
        scale: 0.86,
        opacity: 0,
        y: 10,
      });
      inner.appendChild(node);
      this.placed.push({ node: node, pos: pos });
      return anim;
    }

    enter(anim, i) {
      setTimeout(() => {
        anim.to({ opacity: 1, scale: 1, y: 0 }, { config: M.GENTLE });
      }, stagger(i, 38));
    }

    renderCameras(inner) {
      // Sizes here are the item's real footprint including the room its
      // rotation needs, not the CSS width — the sampler spaces by them.
      const positions = scatterPositions(CAMERAS.length, width, height, 160, 130, 42);
      CAMERAS.forEach((camera, i) => {
        const item = el('div', 'scattered-item camera-obj');
        const img = el('img');
        img.src = getCameraIcon(camera);
        img.alt = camera.name;
        img.draggable = false;
        item.appendChild(img);

        const anim = this.placeItem(item, positions[i], inner);
        const p = G.press(anim);
        new G.Drag(item, {
          axis: 'none',            // horizontal drags fall through to the pager
          onPressStart: p.start,
          onPressEnd: p.end,
          onTap: () => {
            M.haptic(6);
            pushCamera(camera);
          },
        });
        this.enter(anim, i);
      });
    }

    renderFilm(inner) {
      const positions = scatterPositions(FILM_STOCKS.length, width, height, 140, 155, 77);
      FILM_STOCKS.forEach((film, i) => {
        const item = el('div', 'scattered-item film-obj');
        const img = el('img');
        img.src = getFilmIcon(film);
        img.alt = film.name;
        img.draggable = false;
        item.appendChild(img);

        const anim = this.placeItem(item, positions[i], inner);
        const p = G.press(anim);
        new G.Drag(item, {
          axis: 'none',
          onPressStart: p.start,
          onPressEnd: p.end,
        });
        this.enter(anim, i);
      });
    }

    renderCameraDetail(inner, card) {
      const camera = card.camera;
      // 140 of polaroid plus fan spread, and 188 tall plus the label below it.
      const positions = scatterPositions(
        camera.rolls.length, width, height, 165, 225, hashStr(camera.id + 'detail')
      );

      camera.rolls.forEach((roll, i) => {
        const stack = el('div', 'photo-stack');
        const polaroids = [];

        roll.photos.slice(0, 3).forEach((photo, j) => {
          const pol = el('div', 'polaroid');
          const img = el('img');
          img.src = getPhotoSrc(photo, false);
          img.alt = '';
          img.draggable = false;
          pol.appendChild(img);
          stack.appendChild(pol);
          // Resting fan — each layer sits slightly rotated and offset.
          const base = { rotate: (j - 1) * 4, x: (j - 1) * 3, y: (j - 1) * 3 };
          polaroids.push({ el: pol, base: base, anim: new M.Animated(pol, base) });
        });

        const label = el('div', 'stack-label');
        label.textContent = roll.title + (roll.flag ? ' ' + roll.flag : '');
        stack.appendChild(label);

        const anim = this.placeItem(stack, positions[i], inner);
        setupStack(stack, anim, polaroids, positions[i], camera, roll);
        this.enter(anim, i);
      });
    }

    renderRollDetail(inner, card) {
      const roll = card.roll;
      const positions = scatterPositions(
        roll.photos.length, width, height, 155, 200, hashStr(roll.id)
      );

      roll.photos.forEach((photo, i) => {
        const item = el('div', 'scattered-item scattered-polaroid');
        if (i % 3 === 0) item.classList.add('large');
        const pol = el('div', 'polaroid');
        const img = el('img');
        img.src = getPhotoSrc(photo, false);
        img.alt = '';
        img.draggable = false;
        pol.appendChild(img);
        item.appendChild(pol);

        const anim = this.placeItem(item, positions[i], inner);
        const p = G.press(anim);
        new G.Drag(item, {
          axis: 'none',
          onPressStart: p.start,
          onPressEnd: p.end,
          onTap: () => openViewer(roll, i, item),
        });
        this.enter(anim, i);
      });
    }

    // ── Dots ──
    buildDots() {
      this.dotsEl = el('div', 'card-dots');
      this.dots = this.cards.map((_, i) => {
        const dot = el('div', 'card-dot' + (i === 0 ? ' active' : ''));
        this.dotsEl.appendChild(dot);
        return dot;
      });
      this.el.appendChild(this.dotsEl);
    }

    syncDots() {
      if (!this.dots) return;
      this.dots.forEach((dot, i) => dot.classList.toggle('active', i === this.index));
    }

    // ── Horizontal pager ──
    setupPager() {
      if (this.cards.length <= 1) return;

      this.pagerDrag = new G.Drag(this.el, {
        axis: 'x',
        onStart: () => {
          // Take over whatever the release spring was doing rather than
          // snapping to its target — this is what lets you catch a page
          // mid-flight and keep dragging from exactly where it is.
          this.trackAnim.stop();
          this.dragOrigin = this.trackAnim.get('x');
        },
        onMove: (s) => {
          const min = -(this.cards.length - 1) * width;
          let x = this.dragOrigin + s.dx;
          // Past either end, resistance builds instead of sliding free.
          if (x > 0) x = M.rubberBand(x, width);
          else if (x < min) x = min + M.rubberBand(x - min, width);
          this.trackAnim.track({ x: x });
        },
        onEnd: (s) => {
          // Where the momentum is aiming, snapped to the nearest page. Asking
          // "where would this have coasted to?" handles a slow half-drag and a
          // short hard flick with the same rule, instead of needing a distance
          // threshold and a velocity threshold that disagree at the margins.
          const projected = this.trackAnim.get('x') + M.project(s.vx);
          let target = Math.round(-projected / width);
          // One page per gesture — a pager should feel deliberate, not scrub.
          target = M.clamp(target, this.index - 1, this.index + 1);
          this.goTo(M.clamp(target, 0, this.cards.length - 1), s.vx);
        },
      });
    }

    goTo(index, velocity) {
      const changed = index !== this.index;
      this.index = index;
      if (changed) M.haptic(8);
      this.trackAnim.to({ x: -index * width }, {
        config: M.GLIDE,
        velocity: velocity || 0,
      });
      this.syncDots();
    }

    // ── Edge-swipe back ──
    // Lives on a strip inside the screen so it gets first refusal on the
    // pointer before the pager, which is wired to the screen itself.
    setupEdgeBack() {
      if (screens.length === 0) return;   // root screen has nowhere to go
      this.edgeEl = el('div', 'edge-back-zone');
      this.el.appendChild(this.edgeEl);

      this.edgeDrag = new G.Drag(this.edgeEl, {
        axis: 'x',
        edge: 'left',
        slop: 4,
        onStart: () => beginBack(this),
        onMove: (s) => updateBack(this, s.dx),
        onEnd: (s) => endBack(this, s),
      });
    }

    setVisible(on) {
      this.el.style.visibility = on ? '' : 'hidden';
    }

    relayout() {
      this.trackAnim.set({ x: -this.index * width });
      // Positions were sampled against the old width. Rather than re-scatter
      // — which would shuffle the whole card under the user — pull anything
      // that now hangs off the right edge back into view.
      this.placed.forEach((item) => {
        const w = item.node.offsetWidth || 0;
        item.node.style.left = Math.max(8, Math.min(item.pos.x, width - w - 12)) + 'px';
      });
    }

    destroy() {
      if (this.pagerDrag) this.pagerDrag.destroy();
      if (this.edgeDrag) this.edgeDrag.destroy();
      this.el.remove();
    }
  }

  // ── Photo stack: pull to fan open ──
  // Vertical only. A horizontal drag on a stack falls through to the pager,
  // which is what you want — the stacks cover most of the card.
  function setupStack(stack, anim, polaroids, home, camera, roll) {
    const p = G.press(anim);
    let opening = false;

    function fan(progress) {
      const mid = (polaroids.length - 1) / 2;
      polaroids.forEach((pol, j) => {
        const off = j - mid;
        pol.anim.track({
          rotate: pol.base.rotate + off * 18 * progress,
          x: pol.base.x + off * 34 * progress,
          y: pol.base.y - 12 * progress,
        });
      });
    }

    function restFan(velocity) {
      polaroids.forEach((pol) => {
        pol.anim.to(
          { rotate: pol.base.rotate, x: pol.base.x, y: pol.base.y },
          { config: M.SETTLE, velocity: { y: velocity || 0 } }
        );
      });
    }

    new G.Drag(stack, {
      axis: 'y',
      onPressStart: p.start,
      onPressEnd: p.end,
      onTap: () => {
        M.haptic(6);
        pushRoll(camera, roll);
      },
      onStart: () => {
        anim.stop();
        polaroids.forEach((pol) => pol.anim.stop());
      },
      onMove: (s) => {
        const progress = M.clamp(Math.abs(s.dy) / EXPAND_PULL, 0, 1);
        // The stack itself trails the finger at a fraction of the distance,
        // so it reads as weighty rather than stuck to the cursor.
        anim.track({
          y: s.dy * 0.3,
          scale: 1 + progress * 0.05,
          rotate: home.rotation,
        });
        fan(progress);
      },
      onEnd: (s, cancelled) => {
        const projected = Math.abs(s.dy) + Math.abs(M.project(s.vy)) * 0.5;
        const commit = !cancelled && (projected > EXPAND_PULL || Math.abs(s.vy) > 700);

        if (commit && !opening) {
          opening = true;
          M.haptic(10);
          // Carry the fan past the threshold as the screen pushes, so the
          // stack looks like it's coming apart into the next view.
          const mid = (polaroids.length - 1) / 2;
          polaroids.forEach((pol, j) => {
            const off = j - mid;
            pol.anim.to({
              rotate: pol.base.rotate + off * 30,
              x: pol.base.x + off * 58,
              y: pol.base.y - 22,
              opacity: 0,
            }, { config: M.GENTLE });
          });
          anim.to({ scale: 1.06, opacity: 0 }, { config: M.GENTLE });
          pushRoll(camera, roll);
          // Reset the stack behind the incoming screen so it's intact if the
          // user swipes straight back.
          setTimeout(() => {
            opening = false;
            anim.set({ y: 0, scale: 1, opacity: 1, rotate: home.rotation });
            polaroids.forEach((pol) => {
              pol.anim.set({
                rotate: pol.base.rotate, x: pol.base.x, y: pol.base.y, opacity: 1,
              });
            });
          }, 420);
        } else {
          anim.to({ y: 0, scale: 1, rotate: home.rotation }, {
            config: M.SETTLE,
            velocity: { y: s.vy },
          });
          restFan(s.vy);
        }
      },
    });
  }

  // ── Navigation ──
  function currentScreen() { return screens[screens.length - 1]; }

  function trailFor() {
    return screens.map((s) => s.spec.label);
  }

  function pushScreen(spec) {
    const parent = currentScreen();
    const screen = new Screen(spec);
    screensEl.appendChild(screen.el);
    screens.push(screen);

    screen.anim.set({ x: width });
    screen.anim.to({ x: 0 }, {
      config: M.GLIDE,
      onRest: () => { if (screens[screens.length - 1] === screen) parent.setVisible(false); },
    });
    parent.anim.to({ x: -width * PARALLAX }, { config: M.GLIDE });
    parent.dimAnim.to({ opacity: 1 }, { config: M.GLIDE });
    return screen;
  }

  function pushCamera(camera) {
    pushScreen({
      label: camera.name,
      trail: trailFor(),
      cards: [{ type: 'camera-detail', title: camera.name, camera: camera }],
    });
  }

  function pushRoll(camera, roll) {
    pushScreen({
      label: roll.title,
      trail: trailFor(),
      cards: [{ type: 'roll-detail', title: roll.title, flag: roll.flag, roll: roll, camera: camera }],
    });
  }

  // ── Interactive back ──
  function beginBack(screen) {
    const parent = screens[screens.indexOf(screen) - 1];
    if (!parent) return;
    screen.anim.stop();
    parent.anim.stop();
    parent.setVisible(true);
    screen._backOrigin = screen.anim.get('x');
  }

  function updateBack(screen, dx) {
    const parent = screens[screens.indexOf(screen) - 1];
    if (!parent) return;
    let x = Math.max(0, (screen._backOrigin || 0) + dx);
    if (x > width) x = width + M.rubberBand(x - width, width);
    const progress = M.clamp(x / width, 0, 1);
    screen.anim.track({ x: x });
    parent.anim.track({ x: -width * PARALLAX * (1 - progress) });
    parent.dimAnim.track({ opacity: 1 - progress });
  }

  function endBack(screen, s) {
    const parent = screens[screens.indexOf(screen) - 1];
    if (!parent) return;
    const projected = screen.anim.get('x') + M.project(s.vx);
    const commit = projected > width * BACK_COMMIT || s.vx > FLICK_VELOCITY;
    if (commit) popScreen(s.vx);
    else cancelBack(screen, parent, s.vx);
  }

  function cancelBack(screen, parent, velocity) {
    screen.anim.to({ x: 0 }, {
      config: M.GLIDE,
      velocity: velocity,
      onRest: () => { if (screens[screens.length - 1] === screen) parent.setVisible(false); },
    });
    parent.anim.to({ x: -width * PARALLAX }, { config: M.GLIDE });
    parent.dimAnim.to({ opacity: 1 }, { config: M.GLIDE });
  }

  function popScreen(velocity) {
    if (screens.length < 2) return;
    const screen = screens.pop();
    const parent = currentScreen();
    parent.setVisible(true);
    M.haptic(8);

    screen.anim.to({ x: width }, {
      config: M.GLIDE,
      velocity: velocity || 0,
      onRest: () => screen.destroy(),
    });
    parent.anim.to({ x: 0 }, { config: M.GLIDE, velocity: velocity || 0 });
    parent.dimAnim.to({ opacity: 0 }, { config: M.GLIDE });
  }

  // Breadcrumb jump — drop the levels in between, then animate the top one
  // away so the motion still reads as "going back".
  function popTo(index) {
    if (index >= screens.length - 1) return;
    while (screens.length - 2 > index) {
      screens.splice(screens.length - 2, 1)[0].destroy();
    }
    popScreen(0);
  }

  // ── Photo viewer ──
  let viewerOpen = false;
  let viewerPages = [];
  let viewerIndex = 0;
  let viewerSource = null;
  const stageAnim = new M.Animated(stageEl);
  const trackAnim = new M.Animated(trackEl);
  const scrimAnim = new M.Animated(scrimEl, { opacity: 0 });

  const idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 1); };

  function mountViewer(roll) {
    trackEl.innerHTML = '';
    viewerPages = roll.photos.map((photo) => {
      const page = el('div', 'viewer-page');
      const frame = el('div', 'viewer-frame');
      const img = el('img');
      img.draggable = false;
      img.alt = '';
      frame.appendChild(img);
      page.appendChild(frame);
      trackEl.appendChild(page);
      return { photo: photo, el: page, frame: frame, img: img, loaded: false };
    });
  }

  // Only the current photo and its immediate neighbours hold a decoded
  // full-size image. Generating one is synchronous canvas work, so anything
  // beyond the centre is deferred to idle time — that's the difference
  // between a clean swipe and a hitch exactly as the finger lifts.
  function syncViewerWindow(center) {
    viewerPages.forEach((p, i) => {
      const dist = Math.abs(i - center);
      if (dist === 0 && !p.loaded) {
        p.img.src = getPhotoSrc(p.photo, true);
        p.loaded = true;
      } else if (dist > 2 && p.loaded) {
        p.img.src = '';
        p.loaded = false;
      }
    });
    [center - 1, center + 1].forEach((i) => {
      const p = viewerPages[i];
      if (!p || p.loaded) return;
      idle(() => {
        if (p.loaded) return;
        p.img.src = getPhotoSrc(p.photo, true);
        p.loaded = true;
      });
    });
  }

  function openViewer(roll, index, sourceEl) {
    viewerOpen = true;
    viewerIndex = index;
    viewerSource = sourceEl;
    mountViewer(roll);
    syncViewerWindow(index);

    viewerEl.classList.add('active');
    trackAnim.set({ x: -index * width });
    M.haptic(6);

    // Fly the viewer out of the polaroid that was tapped, so the photo
    // appears to come from where you touched rather than from nowhere.
    const from = flyFrom(sourceEl);
    stageAnim.set(from);
    stageAnim.to({ x: 0, y: 0, scale: 1, rotate: 0 }, { config: M.GLIDE });
    scrimAnim.set({ opacity: 0 });
    scrimAnim.to({ opacity: 1 }, { config: M.GLIDE });
  }

  // Transform that maps the centred viewer frame back onto a source element.
  function flyFrom(sourceEl) {
    if (!sourceEl) return { x: 0, y: 0, scale: 0.9, rotate: 0 };
    const src = sourceEl.getBoundingClientRect();
    const dst = viewerPages[viewerIndex].frame.getBoundingClientRect();
    if (!dst.width || !src.width) return { x: 0, y: 0, scale: 0.9, rotate: 0 };
    return {
      x: (src.left + src.width / 2) - (dst.left + dst.width / 2),
      y: (src.top + src.height / 2) - (dst.top + dst.height / 2),
      scale: src.width / dst.width,
      rotate: 0,
    };
  }

  function closeViewer(velocity) {
    if (!viewerOpen) return;
    viewerOpen = false;

    // A thrown photo keeps going the way it was thrown — reversing it back
    // into the polaroid would fight the gesture. Only a tap-to-close, where
    // there's no momentum to respect, flies back to where it came from.
    let backTo;
    if (Math.abs(velocity) > 1) {
      backTo = {
        x: stageAnim.get('x'),
        y: (velocity > 0 ? 1 : -1) * height,
        scale: 0.7,
        rotate: stageAnim.get('rotate'),
      };
    } else if (viewerSource && viewerSource.isConnected) {
      backTo = flyFrom(viewerSource);
    } else {
      backTo = { x: stageAnim.get('x'), y: stageAnim.get('y'), scale: 0.85, rotate: 0 };
    }

    stageAnim.to(backTo, {
      config: M.GLIDE,
      velocity: { y: velocity || 0 },
      onRest: () => {
        if (viewerOpen) return;
        viewerEl.classList.remove('active');
        trackEl.innerHTML = '';
        viewerPages = [];
        stageAnim.set({ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 });
      },
    });
    stageAnim.to({ opacity: 0 }, { config: M.GLIDE });
    scrimAnim.to({ opacity: 0 }, { config: M.GLIDE });
  }

  function goToPhoto(index, velocity) {
    const clamped = M.clamp(index, 0, viewerPages.length - 1);
    if (clamped !== viewerIndex) {
      viewerIndex = clamped;
      M.haptic(8);
      syncViewerWindow(clamped);
      // Once we've paged away, closing back into the original polaroid would
      // fly to the wrong photo — drop the shared-element return.
      viewerSource = null;
    }
    trackAnim.to({ x: -clamped * width }, { config: M.GLIDE, velocity: velocity || 0 });
  }

  function setupViewerGestures() {
    let axis = null;
    let originX = 0;

    new G.Drag(viewerEl, {
      axis: 'both',
      onStart: () => {
        trackAnim.stop();
        stageAnim.stop();
        axis = null;
        originX = trackAnim.get('x');
      },
      onMove: (s) => {
        if (!axis) axis = s.axis;
        if (axis === 'x') {
          const min = -(viewerPages.length - 1) * width;
          let x = originX + s.dx;
          if (x > 0) x = M.rubberBand(x, width);
          else if (x < min) x = min + M.rubberBand(x - min, width);
          trackAnim.track({ x: x });
        } else {
          const progress = M.clamp(Math.abs(s.dy) / (height * 0.5), 0, 1);
          stageAnim.track({
            y: s.dy,
            scale: 1 - progress * 0.2,
            // A slight tilt in the drag direction gives the photo some weight.
            rotate: s.dx * 0.008,
          });
          scrimAnim.track({ opacity: 1 - progress * 0.85 });
        }
      },
      onEnd: (s) => {
        if (axis === 'x') {
          const projected = trackAnim.get('x') + M.project(s.vx);
          let target = M.clamp(
            Math.round(-projected / width), viewerIndex - 1, viewerIndex + 1
          );
          goToPhoto(target, s.vx);
        } else {
          const projected = Math.abs(s.dy) + Math.abs(M.project(s.vy)) * 0.5;
          if (projected > height * 0.22 || Math.abs(s.vy) > 650) {
            closeViewer(s.vy);
          } else {
            stageAnim.to({ y: 0, scale: 1, rotate: 0 }, {
              config: M.SETTLE,
              velocity: { y: s.vy },
            });
            scrimAnim.to({ opacity: 1 }, { config: M.SETTLE });
          }
        }
        axis = null;
      },
    });

    // Tapping the surround closes; tapping the photo itself does not.
    new G.Drag(scrimEl, {
      axis: 'none',
      onTap: () => closeViewer(0),
    });
  }

  // ── Init ──
  function boot() {
    const root = new Screen({
      label: 'my cameras',
      trail: null,
      cards: [
        { type: 'cameras', title: 'my cameras' },
        { type: 'film', title: 'my film' },
      ],
    });
    screensEl.appendChild(root.el);
    screens.push(root);
    setupViewerGestures();
  }

  // Rebuilding the scatter on every resize means the layout reshuffles when
  // the mobile URL bar collapses. Only a real width change justifies that;
  // a height change just needs the geometry refreshed.
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    const newW = window.innerWidth;
    height = window.innerHeight;
    if (newW === width) {
      screens.forEach((s) => s.relayout());
      return;
    }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      width = window.innerWidth;
      screens.forEach((s, i) => {
        s.relayout();
        s.anim.set({ x: i === screens.length - 1 ? 0 : -width * PARALLAX });
      });
      if (viewerOpen) trackAnim.set({ x: -viewerIndex * width });
    }, 120);
  });

  // Hardware/browser back pops a screen instead of leaving the prototype.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (viewerOpen) closeViewer(0);
      else popScreen(0);
    }
  });

  boot();
})();
