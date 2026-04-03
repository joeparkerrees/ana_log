// ── ana_log App ──

(function () {
  'use strict';

  // ── State ──
  let currentCamera = null;
  let currentPhotoIndex = 0;
  let viewerSwipe = null;
  let viewerPinch = null;
  let viewerDismissSwipe = null;
  let chromeVisible = true;

  // ── Elements ──
  const homeScreen = document.getElementById('home-screen');
  const cameraScreen = document.getElementById('camera-screen');
  const viewerScreen = document.getElementById('viewer-screen');
  const cameraList = document.getElementById('camera-list');
  const photoGrid = document.getElementById('photo-grid');
  const cameraTitle = document.getElementById('camera-title');
  const cameraSubtitle = document.getElementById('camera-subtitle');
  const cameraBackBtn = document.getElementById('camera-back-btn');
  const viewerCloseBtn = document.getElementById('viewer-close-btn');
  const viewerTrack = document.getElementById('viewer-track');
  const viewerContainer = document.getElementById('viewer-container');
  const viewerMeta = document.getElementById('viewer-meta');
  const viewerCaption = document.getElementById('viewer-caption');
  const viewerCounter = document.getElementById('viewer-counter');
  const viewerHeader = document.getElementById('viewer-header');
  const viewerFooter = document.getElementById('viewer-footer');

  // ── Render Home ──
  function renderHome() {
    cameraList.innerHTML = '';
    CAMERAS.forEach(camera => {
      const card = document.createElement('div');
      card.className = 'camera-card';
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${camera.name} — ${camera.photos.length} photos`);

      // Preview: first 3 photos
      const previewPhotos = camera.photos.slice(0, 3);
      const previewHTML = previewPhotos.map(p =>
        `<img class="preview-img" src="${getPhotoSrc(p)}" alt="" loading="lazy">`
      ).join('');

      card.innerHTML = `
        <div class="camera-card-preview">${previewHTML}</div>
        <div class="camera-card-info">
          <div>
            <div class="camera-card-name">${camera.name}</div>
          </div>
          <div class="camera-card-meta">
            <span class="camera-card-count">${camera.photos.length} frames</span>
            <span class="camera-card-film">${camera.filmStock}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => openCamera(camera));
      cameraList.appendChild(card);
    });
  }

  // ── Screen Navigation ──
  function navigateTo(target, from) {
    from.classList.remove('active');
    from.classList.add('exit-left');
    target.classList.add('active');

    setTimeout(() => {
      from.classList.remove('exit-left');
    }, 400);
  }

  function navigateBack(target, from) {
    from.classList.remove('active');
    target.classList.remove('exit-left');
    target.classList.add('active');

    setTimeout(() => {
      from.style.transform = '';
    }, 400);
  }

  // ── Camera Screen ──
  function openCamera(camera) {
    currentCamera = camera;
    cameraTitle.textContent = camera.name;
    cameraSubtitle.textContent = `${camera.photos.length} frames · ${camera.filmStock}`;
    renderPhotoGrid(camera);
    navigateTo(cameraScreen, homeScreen);
    cameraScreen.scrollTop = 0;
  }

  function renderPhotoGrid(camera) {
    photoGrid.innerHTML = '';
    camera.photos.forEach((photo, idx) => {
      const item = document.createElement('div');
      item.className = 'photo-grid-item';
      item.innerHTML = `<img src="${getPhotoSrc(photo)}" alt="${photo.caption}" loading="lazy">`;
      item.addEventListener('click', () => openViewer(idx));
      photoGrid.appendChild(item);
    });
  }

  cameraBackBtn.addEventListener('click', () => {
    navigateBack(homeScreen, cameraScreen);
    currentCamera = null;
  });

  // ── Edge-swipe back gesture on camera screen ──
  new SwipeHandler(cameraScreen, {
    direction: 'horizontal',
    onStart() {},
    onMove(dx) {
      if (dx > 0) {
        const progress = Math.min(dx / window.innerWidth, 1);
        cameraScreen.style.transform = `translateX(${dx}px)`;
        cameraScreen.style.opacity = 1 - progress * 0.3;
        homeScreen.style.transform = `translateX(${-30 + progress * 30}%)`;
        homeScreen.style.opacity = 0.5 + progress * 0.5;
      }
    },
    onEnd(dx, dy, vx) {
      if (dx > 80 || vx > 500) {
        // Complete the back gesture
        cameraScreen.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        cameraScreen.style.transform = 'translateX(100%)';
        cameraScreen.style.opacity = '0';
        homeScreen.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        homeScreen.style.transform = 'translateX(0)';
        homeScreen.style.opacity = '1';
        homeScreen.classList.add('active');

        setTimeout(() => {
          cameraScreen.classList.remove('active');
          cameraScreen.style.transition = '';
          cameraScreen.style.transform = '';
          cameraScreen.style.opacity = '';
          homeScreen.style.transition = '';
          homeScreen.style.transform = '';
          homeScreen.style.opacity = '';
          currentCamera = null;
        }, 300);
      } else {
        // Snap back
        cameraScreen.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        cameraScreen.style.transform = 'translateX(0)';
        cameraScreen.style.opacity = '1';
        homeScreen.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        homeScreen.style.transform = 'translateX(-30%)';
        homeScreen.style.opacity = '0.5';

        setTimeout(() => {
          cameraScreen.style.transition = '';
          homeScreen.style.transition = '';
        }, 300);
      }
    }
  });

  // ── Photo Viewer ──
  function openViewer(index) {
    currentPhotoIndex = index;
    chromeVisible = true;
    viewerHeader.classList.remove('hidden');
    viewerFooter.classList.remove('hidden');

    renderViewerSlides();
    updateViewerChrome();
    positionTrack(false);

    viewerScreen.classList.add('active');

    setupViewerGestures();
  }

  function renderViewerSlides() {
    viewerTrack.innerHTML = '';
    currentCamera.photos.forEach((photo, idx) => {
      const slide = document.createElement('div');
      slide.className = 'viewer-slide';
      slide.dataset.index = idx;
      const img = document.createElement('img');
      img.src = getPhotoSrcHiRes(photo);
      img.alt = photo.caption;
      img.draggable = false;
      slide.appendChild(img);
      viewerTrack.appendChild(slide);
    });
  }

  function positionTrack(animate = true) {
    if (!animate) viewerTrack.classList.add('dragging');
    viewerTrack.style.transform = `translateX(-${currentPhotoIndex * 100}%)`;
    if (!animate) {
      requestAnimationFrame(() => viewerTrack.classList.remove('dragging'));
    }
  }

  function updateViewerChrome() {
    const photo = currentCamera.photos[currentPhotoIndex];
    viewerMeta.innerHTML = `
      <div class="viewer-meta-camera">${currentCamera.name}</div>
      <div class="viewer-meta-film">${currentCamera.filmStock} · ${photo.date}</div>
    `;
    viewerCaption.textContent = photo.caption;
    viewerCounter.textContent = `${currentPhotoIndex + 1} / ${currentCamera.photos.length}`;
  }

  function toggleChrome() {
    chromeVisible = !chromeVisible;
    viewerHeader.classList.toggle('hidden', !chromeVisible);
    viewerFooter.classList.toggle('hidden', !chromeVisible);
  }

  function closeViewer() {
    viewerScreen.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    viewerScreen.style.opacity = '0';
    viewerScreen.style.transform = 'scale(0.95)';

    setTimeout(() => {
      viewerScreen.classList.remove('active');
      viewerScreen.style.transition = '';
      viewerScreen.style.opacity = '';
      viewerScreen.style.transform = '';
      viewerTrack.innerHTML = '';
      cleanupViewerGestures();
    }, 300);
  }

  viewerCloseBtn.addEventListener('click', closeViewer);

  // ── Viewer Gestures ──
  function setupViewerGestures() {
    cleanupViewerGestures();

    const totalSlides = currentCamera.photos.length;

    // Horizontal swipe between photos
    viewerSwipe = new SwipeHandler(viewerContainer, {
      direction: 'horizontal',
      onStart() {
        viewerTrack.classList.add('dragging');
        // Reset zoom on swipe start
        if (viewerPinch && viewerPinch.scale > 1) {
          viewerPinch.resetZoom();
          resetSlideTransforms();
        }
      },
      onMove(dx) {
        // Add resistance at edges
        let adjustedDx = dx;
        if ((currentPhotoIndex === 0 && dx > 0) ||
            (currentPhotoIndex === totalSlides - 1 && dx < 0)) {
          adjustedDx = dx * 0.3; // rubber band
        }
        const offset = -currentPhotoIndex * viewerContainer.offsetWidth + adjustedDx;
        viewerTrack.style.transform = `translateX(${offset}px)`;
      },
      onEnd(dx, dy, vx) {
        viewerTrack.classList.remove('dragging');
        const threshold = viewerContainer.offsetWidth * 0.25;

        if ((dx < -threshold || vx < -800) && currentPhotoIndex < totalSlides - 1) {
          currentPhotoIndex++;
          updateViewerChrome();
        } else if ((dx > threshold || vx > 800) && currentPhotoIndex > 0) {
          currentPhotoIndex--;
          updateViewerChrome();
        }

        positionTrack(true);
      }
    });

    // Vertical flick to dismiss
    viewerDismissSwipe = new SwipeHandler(viewerContainer, {
      direction: 'vertical',
      onStart() {
        if (viewerPinch && viewerPinch.scale > 1) return;
      },
      onMove(dx, dy) {
        if (viewerPinch && viewerPinch.scale > 1) return;
        const absDy = Math.abs(dy);
        const progress = Math.min(absDy / 300, 1);
        viewerScreen.style.background = `rgba(0,0,0,${1 - progress * 0.6})`;

        const currentSlide = viewerTrack.children[currentPhotoIndex];
        if (currentSlide) {
          const img = currentSlide.querySelector('img');
          img.style.transition = 'none';
          img.style.transform = `translateY(${dy}px) scale(${1 - progress * 0.15})`;
        }
      },
      onEnd(dx, dy, vx, vy) {
        if (viewerPinch && viewerPinch.scale > 1) return;
        const absDy = Math.abs(dy);
        const absVy = Math.abs(vy);

        if (absDy > 120 || absVy > 600) {
          // Dismiss
          const currentSlide = viewerTrack.children[currentPhotoIndex];
          if (currentSlide) {
            const img = currentSlide.querySelector('img');
            const direction = dy > 0 ? 1 : -1;
            img.style.transition = 'transform 0.3s ease';
            img.style.transform = `translateY(${direction * window.innerHeight}px) scale(0.8)`;
          }
          viewerScreen.style.transition = 'background 0.3s ease';
          viewerScreen.style.background = 'rgba(0,0,0,0)';

          setTimeout(() => {
            closeViewer();
            viewerScreen.style.background = '';
            viewerScreen.style.transition = '';
            resetSlideTransforms();
          }, 250);
        } else {
          // Snap back
          viewerScreen.style.transition = 'background 0.3s ease';
          viewerScreen.style.background = '#000';
          const currentSlide = viewerTrack.children[currentPhotoIndex];
          if (currentSlide) {
            const img = currentSlide.querySelector('img');
            img.style.transition = 'transform 0.25s ease';
            img.style.transform = '';
          }
          setTimeout(() => {
            viewerScreen.style.transition = '';
          }, 300);
        }
      }
    });

    // Pinch zoom + double-tap + tap-to-toggle
    const slides = viewerTrack.querySelectorAll('.viewer-slide');
    slides.forEach((slide) => {
      const img = slide.querySelector('img');

      const handler = new PinchZoomHandler(slide, {
        onZoomChange(scale, tx, ty, panning) {
          if (panning) {
            img.classList.add('zooming');
          } else {
            img.classList.remove('zooming');
          }
          img.style.transform = `scale(${scale}) translate(${tx / scale}px, ${ty / scale}px)`;
        },
        onDoubleTap(x, y) {
          // Visual feedback ring
          const ring = document.createElement('div');
          ring.className = 'zoom-ring';
          ring.style.left = (x - 40) + 'px';
          ring.style.top = (y - 40) + 'px';
          slide.appendChild(ring);
          setTimeout(() => ring.remove(), 400);
        },
        onTap() {
          toggleChrome();
        }
      });

      // Store reference for cleanup
      slide._pinchHandler = handler;
    });

    viewerPinch = slides[currentPhotoIndex]?._pinchHandler;
  }

  function resetSlideTransforms() {
    viewerTrack.querySelectorAll('.viewer-slide img').forEach(img => {
      img.style.transform = '';
      img.style.transition = '';
      img.classList.remove('zooming');
    });
  }

  function cleanupViewerGestures() {
    viewerSwipe = null;
    viewerDismissSwipe = null;
    viewerPinch = null;
  }

  // ── Init ──
  renderHome();

})();
