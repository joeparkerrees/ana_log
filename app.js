// ── ana_log App ──

(function () {
  'use strict';

  // ── State ──
  let currentCardIndex = 0;
  let navigationStack = []; // breadcrumb trail
  let cardSwipeHandler = null;
  let viewerSwipeHandler = null;
  let cards = []; // array of card data objects

  // ── Elements ──
  const cardViewport = document.getElementById('card-viewport');
  const cardTrack = document.getElementById('card-track');
  const photoViewer = document.getElementById('photo-viewer');
  const photoViewerCard = document.getElementById('photo-viewer-card');
  const photoViewerImg = document.getElementById('photo-viewer-img');
  const photoViewerImgWrap = document.getElementById('photo-viewer-img-wrap');

  // ── Scattered position generator ──
  function scatterPositions(count, areaW, areaH, itemW, itemH, seed) {
    const rng = mulberry32(seed);
    const positions = [];
    const padX = 20, padY = 60;
    const usableW = areaW - itemW - padX * 2;
    const usableH = areaH - itemH - padY - 80; // leave room for "add" at bottom

    for (let i = 0; i < count; i++) {
      let x, y, attempts = 0, ok = false;
      while (attempts < 30) {
        x = padX + rng() * usableW;
        y = padY + rng() * usableH;
        // Check overlap with existing
        ok = true;
        for (const p of positions) {
          if (Math.abs(x - p.x) < itemW * 0.5 && Math.abs(y - p.y) < itemH * 0.5) {
            ok = false;
            break;
          }
        }
        if (ok) break;
        attempts++;
      }
      const rotation = (rng() - 0.5) * 20; // -10 to +10 degrees
      positions.push({ x: x || padX, y: y || padY, rotation });
    }
    return positions;
  }

  // ── Card rendering ──

  function buildCards() {
    // Two main cards: "my cameras" and "my film"
    cards = [
      { type: 'cameras', title: 'my cameras' },
      { type: 'film', title: 'my film' },
    ];
  }

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
      if (card.type === 'cameras') {
        renderCamerasContent(inner, card);
      } else if (card.type === 'film') {
        renderFilmContent(inner, card);
      } else if (card.type === 'camera-detail') {
        renderCameraDetailContent(inner, card);
      } else if (card.type === 'roll-detail') {
        renderRollDetailContent(inner, card);
      }

      // Add button
      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn';
      addBtn.textContent = 'add';
      inner.appendChild(addBtn);

      el.appendChild(inner);
      cardTrack.appendChild(el);
    });

    renderDots();
    positionTrack(false);
  }

  function renderCamerasContent(inner, card) {
    const rect = getCardDimensions();
    const positions = scatterPositions(CAMERAS.length, rect.w, rect.h, 140, 120, 42);

    CAMERAS.forEach((camera, i) => {
      const pos = positions[i];
      const item = document.createElement('div');
      item.className = 'scattered-item camera-obj';
      item.style.left = pos.x + 'px';
      item.style.top = pos.y + 'px';
      item.style.setProperty('--item-rotate', `rotate(${pos.rotation}deg)`);
      item.style.transform = `rotate(${pos.rotation}deg)`;

      const img = document.createElement('img');
      img.src = getCameraIcon(camera);
      img.alt = camera.name;
      img.draggable = false;
      item.appendChild(img);

      item.addEventListener('click', () => drillIntoCamera(camera));
      inner.appendChild(item);
    });
  }

  function renderFilmContent(inner, card) {
    const rect = getCardDimensions();
    const positions = scatterPositions(FILM_STOCKS.length, rect.w, rect.h, 120, 140, 77);

    FILM_STOCKS.forEach((film, i) => {
      const pos = positions[i];
      const item = document.createElement('div');
      item.className = 'scattered-item film-obj';
      item.style.left = pos.x + 'px';
      item.style.top = pos.y + 'px';
      item.style.setProperty('--item-rotate', `rotate(${pos.rotation}deg)`);
      item.style.transform = `rotate(${pos.rotation}deg)`;

      const img = document.createElement('img');
      img.src = getFilmIcon(film);
      img.alt = film.name;
      img.draggable = false;
      item.appendChild(img);

      inner.appendChild(item);
    });
  }

  function renderCameraDetailContent(inner, card) {
    const camera = card.camera;
    const rect = getCardDimensions();
    const positions = scatterPositions(camera.rolls.length, rect.w, rect.h, 180, 200, hashStr(camera.id + 'detail'));

    camera.rolls.forEach((roll, i) => {
      const pos = positions[i];
      const stack = document.createElement('div');
      stack.className = 'scattered-item polaroid-stack';
      stack.style.left = pos.x + 'px';
      stack.style.top = pos.y + 'px';
      stack.style.setProperty('--item-rotate', `rotate(${pos.rotation}deg)`);
      stack.style.transform = `rotate(${pos.rotation}deg)`;

      // Show up to 3 photos stacked
      const previewPhotos = roll.photos.slice(0, 3);
      previewPhotos.forEach((photo) => {
        const pol = document.createElement('div');
        pol.className = 'polaroid';
        const img = document.createElement('img');
        img.src = getPhotoSrc(photo, false);
        img.alt = '';
        img.draggable = false;
        pol.appendChild(img);
        stack.appendChild(pol);
      });

      stack.addEventListener('click', () => drillIntoRoll(camera, roll));
      inner.appendChild(stack);
    });
  }

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
      item.style.setProperty('--item-rotate', `rotate(${pos.rotation}deg)`);
      item.style.transform = `rotate(${pos.rotation}deg)`;

      const pol = document.createElement('div');
      pol.className = 'polaroid';
      const img = document.createElement('img');
      img.src = getPhotoSrc(photo, false);
      img.alt = '';
      img.draggable = false;
      pol.appendChild(img);
      item.appendChild(pol);

      item.addEventListener('click', () => openPhotoViewer(photo, roll));
      inner.appendChild(item);
    });
  }

  // ── Navigation ──

  function drillIntoCamera(camera) {
    navigationStack.push({ title: 'my cameras', cards: [...cards], index: currentCardIndex });
    cards = [{
      type: 'camera-detail',
      title: camera.name,
      camera: camera,
    }];
    currentCardIndex = 0;
    renderCards();
  }

  function drillIntoRoll(camera, roll) {
    navigationStack.push({ title: camera.name, cards: [...cards], index: currentCardIndex });
    cards = [{
      type: 'roll-detail',
      title: roll.title,
      flag: roll.flag,
      roll: roll,
      camera: camera,
    }];
    currentCardIndex = 0;
    renderCards();
  }

  function navigateBack(toIndex) {
    // Pop stack back to the target index
    const target = navigationStack[toIndex];
    navigationStack = navigationStack.slice(0, toIndex);
    cards = target.cards;
    currentCardIndex = target.index;
    renderCards();
  }

  // ── Card swipe ──

  function getCardDimensions() {
    const vw = window.innerWidth;
    return {
      w: vw,
      h: cardViewport.offsetHeight,
      gap: 0,
    };
  }

  function setupCardSwipe() {
    if (cardSwipeHandler) cardSwipeHandler.destroy();

    cardSwipeHandler = new SwipeHandler(cardViewport, {
      direction: 'horizontal',
      onStart() {
        cardTrack.classList.add('dragging');
      },
      onMove(dx) {
        const dim = getCardDimensions();
        const cardW = dim.w + dim.gap;
        let adjustedDx = dx;

        // Rubber band at edges
        if ((currentCardIndex === 0 && dx > 0) ||
            (currentCardIndex === cards.length - 1 && dx < 0)) {
          adjustedDx = dx * 0.3;
        }

        const offset = -currentCardIndex * cardW + adjustedDx;
        cardTrack.style.transform = `translateX(${offset}px)`;
      },
      onEnd(dx, dy, vx) {
        cardTrack.classList.remove('dragging');
        const dim = getCardDimensions();
        const threshold = dim.w * 0.2;

        if ((dx < -threshold || vx < -600) && currentCardIndex < cards.length - 1) {
          currentCardIndex++;
        } else if ((dx > threshold || vx > 600) && currentCardIndex > 0) {
          currentCardIndex--;
        }

        positionTrack(true);
        updateDots();
      }
    });
  }

  function positionTrack(animate) {
    const dim = getCardDimensions();
    const cardW = dim.w + dim.gap;
    const offset = -currentCardIndex * cardW;

    if (!animate) cardTrack.classList.add('dragging');
    cardTrack.style.transform = `translateX(${offset}px)`;
    if (!animate) requestAnimationFrame(() => cardTrack.classList.remove('dragging'));
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

  function openPhotoViewer(photo, roll) {
    currentViewerPhotos = roll.photos;
    currentViewerIndex = roll.photos.indexOf(photo);

    photoViewerImg.src = getPhotoSrc(photo, true);
    photoViewer.classList.add('active');

    setupViewerGestures();
  }

  function closePhotoViewer() {
    photoViewer.classList.add('dismissing');
    setTimeout(() => {
      photoViewer.classList.remove('active', 'dismissing');
      photoViewerImg.src = '';
      if (viewerSwipeHandler) {
        viewerSwipeHandler.destroy();
        viewerSwipeHandler = null;
      }
    }, 250);
  }

  function setupViewerGestures() {
    if (viewerSwipeHandler) viewerSwipeHandler.destroy();

    // Tap to dismiss
    new TapHandler(photoViewer, {
      onTap() {
        closePhotoViewer();
      }
    });

    // Horizontal swipe between photos
    viewerSwipeHandler = new SwipeHandler(photoViewerImgWrap, {
      direction: 'horizontal',
      onStart() {
        photoViewerImg.classList.add('dragging');
      },
      onMove(dx) {
        photoViewerImg.style.transform = `translateX(${dx}px) rotate(${dx * 0.02}deg)`;
      },
      onEnd(dx, dy, vx) {
        photoViewerImg.classList.remove('dragging');
        const threshold = 80;

        if ((dx < -threshold || vx < -500) && currentViewerIndex < currentViewerPhotos.length - 1) {
          // Animate out left
          photoViewerImg.style.transition = 'transform 0.25s ease';
          photoViewerImg.style.transform = `translateX(-${window.innerWidth}px) rotate(-15deg)`;
          setTimeout(() => {
            currentViewerIndex++;
            photoViewerImg.src = getPhotoSrc(currentViewerPhotos[currentViewerIndex], true);
            photoViewerImg.style.transition = 'none';
            photoViewerImg.style.transform = `translateX(${window.innerWidth}px) rotate(15deg)`;
            requestAnimationFrame(() => {
              photoViewerImg.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
              photoViewerImg.style.transform = '';
            });
          }, 250);
        } else if ((dx > threshold || vx > 500) && currentViewerIndex > 0) {
          // Animate out right
          photoViewerImg.style.transition = 'transform 0.25s ease';
          photoViewerImg.style.transform = `translateX(${window.innerWidth}px) rotate(15deg)`;
          setTimeout(() => {
            currentViewerIndex--;
            photoViewerImg.src = getPhotoSrc(currentViewerPhotos[currentViewerIndex], true);
            photoViewerImg.style.transition = 'none';
            photoViewerImg.style.transform = `translateX(-${window.innerWidth}px) rotate(-15deg)`;
            requestAnimationFrame(() => {
              photoViewerImg.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
              photoViewerImg.style.transform = '';
            });
          }, 250);
        } else {
          // Snap back
          photoViewerImg.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
          photoViewerImg.style.transform = '';
        }

        setTimeout(() => {
          photoViewerImg.style.transition = '';
        }, 350);
      }
    });

    // Vertical flick to dismiss
    new SwipeHandler(photoViewerImgWrap, {
      direction: 'vertical',
      onStart() {
        photoViewerImg.classList.add('dragging');
      },
      onMove(dx, dy) {
        const progress = Math.min(Math.abs(dy) / 300, 1);
        photoViewerImg.style.transform = `translateY(${dy}px) scale(${1 - progress * 0.15})`;
        photoViewerCard.style.opacity = 1 - progress * 0.4;
      },
      onEnd(dx, dy, vx, vy) {
        photoViewerImg.classList.remove('dragging');
        if (Math.abs(dy) > 100 || Math.abs(vy) > 500) {
          const dir = dy > 0 ? 1 : -1;
          photoViewerImg.style.transition = 'transform 0.25s ease';
          photoViewerImg.style.transform = `translateY(${dir * window.innerHeight}px) scale(0.8)`;
          setTimeout(() => {
            closePhotoViewer();
            photoViewerImg.style.transition = '';
            photoViewerImg.style.transform = '';
            photoViewerCard.style.opacity = '';
          }, 200);
        } else {
          photoViewerImg.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
          photoViewerImg.style.transform = '';
          photoViewerCard.style.opacity = '';
          setTimeout(() => {
            photoViewerImg.style.transition = '';
          }, 300);
        }
      }
    });
  }

  // ── Init ──
  buildCards();
  renderCards();
  setupCardSwipe();

  window.addEventListener('resize', () => {
    renderCards();
    setupCardSwipe();
  });

})();
