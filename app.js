// ── ana_log App (Motion-powered) ──

(function () {
  'use strict';

  const { animate, spring } = Motion;

  // ── Spring Configs (from design-motion-principles) ──
  const SPRING_SETTLE = { type: 'spring', stiffness: 300, damping: 30, mass: 1 };
  const SPRING_ENTER = { type: 'spring', duration: 0.45, bounce: 0 };
  const SPRING_SOFT = { type: 'spring', stiffness: 200, damping: 25, mass: 1 };
  const EASE_SHEET = [0.32, 0.72, 0, 1];
  const DISMISS_VELOCITY = 0.11;

  // ── State ──
  let currentCardIndex = 0;
  let navigationStack = [];
  let cards = [];

  // ── Elements ──
  const cardViewport = document.getElementById('card-viewport');
  const cardTrack = document.getElementById('card-track');
  const photoViewer = document.getElementById('photo-viewer');
  const photoViewerInner = document.getElementById('photo-viewer-inner');
  const photoViewerImg = document.getElementById('photo-viewer-img');

  // ── Scattered position generator ──
  function scatterPositions(count, areaW, areaH, itemW, itemH, seed) {
    const rng = mulberry32(seed);
    const positions = [];
    const padX = 20, padY = 60;
    const usableW = areaW - itemW - padX * 2;
    const usableH = areaH - itemH - padY - 80;

    for (let i = 0; i < count; i++) {
      let x, y, attempts = 0, ok = false;
      while (attempts < 30) {
        x = padX + rng() * usableW;
        y = padY + rng() * usableH;
        ok = true;
        for (const p of positions) {
          if (Math.abs(x - p.x) < itemW * 0.5 && Math.abs(y - p.y) < itemH * 0.5) {
            ok = false; break;
          }
        }
        if (ok) break;
        attempts++;
      }
      const rotation = (rng() - 0.5) * 20;
      positions.push({ x: x || padX, y: y || padY, rotation });
    }
    return positions;
  }

  // ── Card building ──
  function buildCards() {
    cards = [
      { type: 'cameras', title: 'my cameras' },
      { type: 'film', title: 'my film' },
    ];
  }

  function getCardDimensions() {
    return { w: window.innerWidth, h: cardViewport.offsetHeight, gap: 0 };
  }

  // ── Render cards ──
  function renderCards() {
    cardTrack.innerHTML = '';

    cards.forEach((card, idx) => {
      const el = document.createElement('div');
      el.className = 'content-card';
      el.dataset.index = idx;

      const inner = document.createElement('div');
      inner.className = 'card-inner';

      // Breadcrumbs
      if (navigationStack.length > 0) {
        const bc = document.createElement('div');
        bc.className = 'breadcrumb';
        navigationStack.forEach((item, i) => {
          const span = document.createElement('span');
          span.className = 'breadcrumb-item';
          span.textContent = item.title;
          span.addEventListener('click', () => navigateBack(i));
          bc.appendChild(span);
        });
        inner.appendChild(bc);
      }

      // Title
      if (card.title) {
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = card.title + (card.flag ? ' ' + card.flag : '');
        inner.appendChild(title);
      }

      // Content
      if (card.type === 'cameras') renderCamerasContent(inner, card);
      else if (card.type === 'film') renderFilmContent(inner, card);
      else if (card.type === 'camera-detail') renderCameraDetailContent(inner, card);
      else if (card.type === 'roll-detail') renderRollDetailContent(inner, card);

      // Add button
      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn';
      addBtn.textContent = 'add';
      setupPressFeedback(addBtn);
      inner.appendChild(addBtn);

      el.appendChild(inner);
      cardTrack.appendChild(el);
    });

    renderDots();
    positionTrack(false);
  }

  // ── Staggered enter animation ──
  function animateItemsIn(inner) {
    const items = inner.querySelectorAll('.scattered-item, .photo-stack');
    items.forEach((item, i) => {
      item.style.opacity = '0';
      item.style.transform += ' scale(0.85)';
      animate(item, { opacity: 1, scale: 1 }, {
        delay: i * 0.04,
        ...SPRING_ENTER,
      });
    });
  }

  // ── Press feedback (scale 0.97) ──
  function setupPressFeedback(el) {
    el.addEventListener('touchstart', () => {
      animate(el, { scale: 0.97 }, { duration: 0.1 });
    }, { passive: true });
    el.addEventListener('touchend', () => {
      animate(el, { scale: 1 }, SPRING_SETTLE);
    }, { passive: true });
    el.addEventListener('touchcancel', () => {
      animate(el, { scale: 1 }, SPRING_SETTLE);
    }, { passive: true });
  }

  // ── Camera content ──
  function renderCamerasContent(inner, card) {
    const rect = getCardDimensions();
    const positions = scatterPositions(CAMERAS.length, rect.w, rect.h, 140, 120, 42);

    CAMERAS.forEach((camera, i) => {
      const pos = positions[i];
      const item = document.createElement('div');
      item.className = 'scattered-item camera-obj';
      item.style.left = pos.x + 'px';
      item.style.top = pos.y + 'px';
      item.style.transform = `rotate(${pos.rotation}deg)`;

      const img = document.createElement('img');
      img.src = getCameraIcon(camera);
      img.alt = camera.name;
      img.draggable = false;
      item.appendChild(img);

      setupPressFeedback(item);
      item.addEventListener('click', () => drillIntoCamera(camera));
      inner.appendChild(item);
    });

    requestAnimationFrame(() => animateItemsIn(inner));
  }

  // ── Film content ──
  function renderFilmContent(inner, card) {
    const rect = getCardDimensions();
    const positions = scatterPositions(FILM_STOCKS.length, rect.w, rect.h, 120, 140, 77);

    FILM_STOCKS.forEach((film, i) => {
      const pos = positions[i];
      const item = document.createElement('div');
      item.className = 'scattered-item film-obj';
      item.style.left = pos.x + 'px';
      item.style.top = pos.y + 'px';
      item.style.transform = `rotate(${pos.rotation}deg)`;

      const img = document.createElement('img');
      img.src = getFilmIcon(film);
      img.alt = film.name;
      img.draggable = false;
      item.appendChild(img);

      inner.appendChild(item);
    });

    requestAnimationFrame(() => animateItemsIn(inner));
  }

  // ── Camera detail (photo stacks with drag-to-expand) ──
  function renderCameraDetailContent(inner, card) {
    const camera = card.camera;
    const rect = getCardDimensions();
    const positions = scatterPositions(camera.rolls.length, rect.w, rect.h, 180, 200, hashStr(camera.id + 'detail'));

    camera.rolls.forEach((roll, i) => {
      const pos = positions[i];
      const stack = document.createElement('div');
      stack.className = 'photo-stack';
      stack.style.left = pos.x + 'px';
      stack.style.top = pos.y + 'px';
      stack.style.transform = `rotate(${pos.rotation}deg)`;

      // Create polaroid layers for the stack
      const previewPhotos = roll.photos.slice(0, 3);
      const polaroids = [];
      previewPhotos.forEach((photo, j) => {
        const pol = document.createElement('div');
        pol.className = 'polaroid';
        pol.style.transform = `rotate(${(j - 1) * 4}deg) translate(${(j - 1) * 3}px, ${(j - 1) * 3}px)`;
        const img = document.createElement('img');
        img.src = getPhotoSrc(photo, false);
        img.alt = '';
        img.draggable = false;
        pol.appendChild(img);
        stack.appendChild(pol);
        polaroids.push(pol);
      });

      // Roll label
      const label = document.createElement('div');
      label.className = 'stack-label';
      label.textContent = roll.title + (roll.flag ? ' ' + roll.flag : '');
      stack.appendChild(label);

      // ── Drag-to-expand gesture ──
      setupDragToExpand(stack, polaroids, camera, roll, pos);

      inner.appendChild(stack);
    });

    requestAnimationFrame(() => animateItemsIn(inner));
  }

  // ── Drag-to-expand on photo stacks ──
  function setupDragToExpand(stack, polaroids, camera, roll, homePos) {
    let startX = 0, startY = 0, dx = 0, dy = 0;
    let dragging = false, locked = false, startTime = 0;
    const expandThreshold = 80; // px drag distance to trigger expand

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      dx = 0; dy = 0;
      dragging = false; locked = false;
      startTime = Date.now();
      animate(stack, { scale: 0.97 }, { duration: 0.1 });
    }

    function onTouchMove(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      dx = t.clientX - startX;
      dy = t.clientY - startY;

      if (!locked) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        locked = true;
        dragging = true;
      }

      if (dragging) {
        e.preventDefault();
        const dist = Math.sqrt(dx * dx + dy * dy);
        const progress = Math.min(dist / (expandThreshold * 2), 1);

        // Move the stack with the drag
        stack.style.transform = `translate(${dx * 0.3}px, ${dy * 0.3}px) rotate(${homePos.rotation}deg) scale(${1 + progress * 0.05})`;

        // Fan out polaroids based on drag distance
        polaroids.forEach((pol, j) => {
          const angle = ((j - (polaroids.length - 1) / 2)) * progress * 25;
          const spread = progress * 30;
          const tx = (j - (polaroids.length - 1) / 2) * spread;
          const ty = -progress * 15;
          pol.style.transform = `rotate(${angle}deg) translate(${tx}px, ${ty}px)`;
        });
      }
    }

    function onTouchEnd(e) {
      const elapsed = Date.now() - startTime;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const velocity = dist / Math.max(elapsed, 1);

      if (!dragging || (dist < 10 && elapsed < 300)) {
        // It was a tap, not a drag
        animate(stack, { scale: 1 }, SPRING_SETTLE);
        drillIntoRoll(camera, roll);
        return;
      }

      if (dist > expandThreshold || velocity > DISMISS_VELOCITY) {
        // Expand — animate fan out then drill in
        animate(stack, { scale: 1.1, opacity: 0 }, {
          duration: 0.2,
          easing: EASE_SHEET,
        });
        polaroids.forEach((pol, j) => {
          const angle = ((j - (polaroids.length - 1) / 2)) * 35;
          const tx = (j - (polaroids.length - 1) / 2) * 60;
          animate(pol, {
            transform: `rotate(${angle}deg) translate(${tx}px, -30px)`,
            opacity: 0,
          }, { duration: 0.25, easing: EASE_SHEET });
        });
        setTimeout(() => drillIntoRoll(camera, roll), 200);
      } else {
        // Snap back
        animate(stack, {
          transform: `rotate(${homePos.rotation}deg)`,
          scale: 1,
        }, SPRING_SETTLE);
        polaroids.forEach((pol, j) => {
          animate(pol, {
            transform: `rotate(${(j - 1) * 4}deg) translate(${(j - 1) * 3}px, ${(j - 1) * 3}px)`,
          }, SPRING_SETTLE);
        });
      }
      dragging = false;
    }

    stack.addEventListener('touchstart', onTouchStart, { passive: true });
    stack.addEventListener('touchmove', onTouchMove, { passive: false });
    stack.addEventListener('touchend', onTouchEnd, { passive: true });
    stack.addEventListener('touchcancel', () => {
      animate(stack, { transform: `rotate(${homePos.rotation}deg)`, scale: 1 }, SPRING_SETTLE);
      dragging = false;
    }, { passive: true });

    // Desktop click fallback
    stack.addEventListener('click', (e) => {
      if (!('ontouchstart' in window)) {
        drillIntoRoll(camera, roll);
      }
    });
  }

  // ── Roll detail (scattered polaroids) ──
  function renderRollDetailContent(inner, card) {
    const roll = card.roll;
    const rect = getCardDimensions();
    const positions = scatterPositions(roll.photos.length, rect.w, rect.h, 140, 170, hashStr(roll.id));

    roll.photos.forEach((photo, i) => {
      const pos = positions[i];
      const item = document.createElement('div');
      item.className = 'scattered-item scattered-polaroid';
      if (i % 3 === 0) item.classList.add('large');
      item.style.left = pos.x + 'px';
      item.style.top = pos.y + 'px';
      item.style.transform = `rotate(${pos.rotation}deg)`;

      const pol = document.createElement('div');
      pol.className = 'polaroid';
      const img = document.createElement('img');
      img.src = getPhotoSrc(photo, false);
      img.alt = '';
      img.draggable = false;
      pol.appendChild(img);
      item.appendChild(pol);

      setupPressFeedback(item);
      item.addEventListener('click', () => openPhotoViewer(photo, roll));
      inner.appendChild(item);
    });

    requestAnimationFrame(() => animateItemsIn(inner));
  }

  // ── Navigation ──
  function drillIntoCamera(camera) {
    navigationStack.push({ title: 'my cameras', cards: [...cards], index: currentCardIndex });
    cards = [{ type: 'camera-detail', title: camera.name, camera }];
    currentCardIndex = 0;
    renderCards();
  }

  function drillIntoRoll(camera, roll) {
    navigationStack.push({ title: camera.name, cards: [...cards], index: currentCardIndex });
    cards = [{ type: 'roll-detail', title: roll.title, flag: roll.flag, roll, camera }];
    currentCardIndex = 0;
    renderCards();
  }

  function navigateBack(toIndex) {
    const target = navigationStack[toIndex];
    navigationStack = navigationStack.slice(0, toIndex);
    cards = target.cards;
    currentCardIndex = target.index;
    renderCards();
  }

  // ── Card swipe (horizontal, spring-based) ──
  let swipeStartX = 0, swipeDx = 0, swiping = false, swipeLocked = false;

  function setupCardSwipe() {
    cardViewport.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      swipeStartX = e.touches[0].clientX;
      swipeDx = 0; swiping = false; swipeLocked = false;
    }, { passive: true });

    cardViewport.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - swipeStartX;
      const dy = e.touches[0].clientY - (e.touches[0].clientY); // not tracking Y start here

      if (!swipeLocked) {
        if (Math.abs(dx) < 5) return;
        swipeLocked = true;
        swiping = true;
      }

      if (swiping) {
        swipeDx = dx;
        // Rubber band at edges
        let adjustedDx = dx;
        if ((currentCardIndex === 0 && dx > 0) ||
            (currentCardIndex === cards.length - 1 && dx < 0)) {
          adjustedDx = dx * 0.3;
        }
        const dim = getCardDimensions();
        const offset = -currentCardIndex * dim.w + adjustedDx;
        cardTrack.style.transform = `translateX(${offset}px)`;
      }
    }, { passive: true });

    cardViewport.addEventListener('touchend', () => {
      if (!swiping) return;
      const dim = getCardDimensions();
      const threshold = dim.w * 0.2;

      if (swipeDx < -threshold && currentCardIndex < cards.length - 1) {
        currentCardIndex++;
      } else if (swipeDx > threshold && currentCardIndex > 0) {
        currentCardIndex--;
      }

      positionTrack(true);
      updateDots();
      swiping = false;
    }, { passive: true });
  }

  function positionTrack(animated) {
    const dim = getCardDimensions();
    const offset = -currentCardIndex * dim.w;
    if (animated) {
      animate(cardTrack, { transform: `translateX(${offset}px)` }, SPRING_SETTLE);
    } else {
      cardTrack.style.transform = `translateX(${offset}px)`;
    }
  }

  // ── Dots ──
  let dotsContainer = null;

  function renderDots() {
    if (dotsContainer) dotsContainer.remove();
    if (cards.length <= 1) return;

    dotsContainer = document.createElement('div');
    dotsContainer.className = 'card-dots';
    cards.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'card-dot' + (i === currentCardIndex ? ' active' : '');
      dotsContainer.appendChild(dot);
    });
    document.getElementById('app').appendChild(dotsContainer);
  }

  function updateDots() {
    if (!dotsContainer) return;
    dotsContainer.querySelectorAll('.card-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentCardIndex);
    });
  }

  // ── Photo Viewer ──
  let currentViewerPhotos = [];
  let currentViewerIndex = 0;
  let viewerDragX = 0, viewerDragY = 0;
  let viewerStartX = 0, viewerStartY = 0;
  let viewerSwiping = false, viewerLocked = false, viewerDirection = null;
  let viewerStartTime = 0;

  function openPhotoViewer(photo, roll) {
    currentViewerPhotos = roll.photos;
    currentViewerIndex = roll.photos.indexOf(photo);

    photoViewerImg.src = getPhotoSrc(photo, true);
    photoViewer.classList.add('active');

    // Animate in
    animate(photoViewerInner, { scale: [0.9, 1], opacity: [0, 1] }, SPRING_ENTER);

    setupViewerGestures();
  }

  function closePhotoViewer() {
    animate(photoViewerInner, { scale: 0.9, opacity: 0 }, {
      duration: 0.2,
      easing: EASE_SHEET,
    });
    setTimeout(() => {
      photoViewer.classList.remove('active');
      photoViewerImg.src = '';
      photoViewerInner.style.transform = '';
      photoViewerInner.style.opacity = '';
    }, 200);
  }

  function setupViewerGestures() {
    // Tap to dismiss
    const onViewerTap = (e) => {
      if (e.target === photoViewer) {
        closePhotoViewer();
      }
    };
    photoViewer.addEventListener('click', onViewerTap);

    // Touch gestures on the image
    photoViewerInner.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      viewerStartX = e.touches[0].clientX;
      viewerStartY = e.touches[0].clientY;
      viewerDragX = 0; viewerDragY = 0;
      viewerSwiping = false; viewerLocked = false; viewerDirection = null;
      viewerStartTime = Date.now();
    }, { passive: true });

    photoViewerInner.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      viewerDragX = e.touches[0].clientX - viewerStartX;
      viewerDragY = e.touches[0].clientY - viewerStartY;

      if (!viewerLocked) {
        if (Math.abs(viewerDragX) < 5 && Math.abs(viewerDragY) < 5) return;
        viewerLocked = true;
        viewerDirection = Math.abs(viewerDragX) > Math.abs(viewerDragY) ? 'h' : 'v';
        viewerSwiping = true;
      }

      if (viewerSwiping) {
        e.preventDefault();
        if (viewerDirection === 'h') {
          photoViewerInner.style.transform = `translateX(${viewerDragX}px) rotate(${viewerDragX * 0.02}deg)`;
        } else {
          const progress = Math.min(Math.abs(viewerDragY) / 300, 1);
          photoViewerInner.style.transform = `translateY(${viewerDragY}px) scale(${1 - progress * 0.15})`;
          photoViewer.style.background = `rgba(0,0,0,${0.0 * (1 - progress)})`;
        }
      }
    }, { passive: false });

    photoViewerInner.addEventListener('touchend', () => {
      if (!viewerSwiping) return;
      const elapsed = Date.now() - viewerStartTime;
      const vx = viewerDragX / Math.max(elapsed, 1) * 1000;
      const vy = viewerDragY / Math.max(elapsed, 1) * 1000;

      if (viewerDirection === 'h') {
        handleHorizontalSwipe(vx);
      } else {
        handleVerticalDismiss(vy);
      }
      viewerSwiping = false;
    }, { passive: true });
  }

  function handleHorizontalSwipe(vx) {
    const threshold = 80;
    if ((viewerDragX < -threshold || vx < -500) && currentViewerIndex < currentViewerPhotos.length - 1) {
      // Swipe left — next photo
      animate(photoViewerInner, {
        transform: `translateX(-${window.innerWidth}px) rotate(-15deg)`,
      }, { duration: 0.25, easing: EASE_SHEET });

      setTimeout(() => {
        currentViewerIndex++;
        photoViewerImg.src = getPhotoSrc(currentViewerPhotos[currentViewerIndex], true);
        photoViewerInner.style.transform = `translateX(${window.innerWidth}px) rotate(15deg)`;
        requestAnimationFrame(() => {
          animate(photoViewerInner, { transform: 'translateX(0) rotate(0deg)' }, SPRING_SETTLE);
        });
      }, 250);
    } else if ((viewerDragX > threshold || vx > 500) && currentViewerIndex > 0) {
      // Swipe right — prev photo
      animate(photoViewerInner, {
        transform: `translateX(${window.innerWidth}px) rotate(15deg)`,
      }, { duration: 0.25, easing: EASE_SHEET });

      setTimeout(() => {
        currentViewerIndex--;
        photoViewerImg.src = getPhotoSrc(currentViewerPhotos[currentViewerIndex], true);
        photoViewerInner.style.transform = `translateX(-${window.innerWidth}px) rotate(-15deg)`;
        requestAnimationFrame(() => {
          animate(photoViewerInner, { transform: 'translateX(0) rotate(0deg)' }, SPRING_SETTLE);
        });
      }, 250);
    } else {
      // Snap back
      animate(photoViewerInner, { transform: 'translateX(0) rotate(0deg)' }, SPRING_SETTLE);
    }
  }

  function handleVerticalDismiss(vy) {
    if (Math.abs(viewerDragY) > 100 || Math.abs(vy) > 500) {
      // Dismiss
      const dir = viewerDragY > 0 ? 1 : -1;
      animate(photoViewerInner, {
        transform: `translateY(${dir * window.innerHeight}px) scale(0.8)`,
        opacity: 0,
      }, { duration: 0.25, easing: EASE_SHEET });
      setTimeout(() => closePhotoViewer(), 200);
    } else {
      // Snap back
      animate(photoViewerInner, {
        transform: 'translateY(0) scale(1)',
      }, SPRING_SETTLE);
    }
  }

  // ── Init ──
  buildCards();
  renderCards();
  setupCardSwipe();

  window.addEventListener('resize', () => {
    renderCards();
  });

})();
