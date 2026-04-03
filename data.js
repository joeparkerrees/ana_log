// ── Sample Data ──
// Placeholder images using generated color blocks with film-style tones
// In production these would be real photo URLs

function generatePlaceholder(hue, sat, light, w, h, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Base warm tone
  const rng = mulberry32(seed);
  const baseH = hue + (rng() - 0.5) * 20;
  const baseS = sat + (rng() - 0.5) * 10;
  const baseL = light + (rng() - 0.5) * 15;

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${baseH}, ${baseS}%, ${baseL}%)`);
  grad.addColorStop(0.5, `hsl(${baseH + 15}, ${baseS - 5}%, ${baseL - 8}%)`);
  grad.addColorStop(1, `hsl(${baseH + 30}, ${baseS - 10}%, ${baseL - 15}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Add some abstract shapes for visual interest
  for (let i = 0; i < 5; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = rng() * Math.min(w, h) * 0.4;
    const shapeH = baseH + (rng() - 0.5) * 40;
    const shapeL = baseL + (rng() - 0.5) * 30;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${shapeH}, ${baseS}%, ${shapeL}%, ${0.15 + rng() * 0.2})`;
    ctx.fill();
  }

  // Vignette
  const vignette = ctx.createRadialGradient(w/2, h/2, w * 0.2, w/2, h/2, w * 0.7);
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  return canvas.toDataURL('image/jpeg', 0.85);
}

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const CAMERAS = [
  {
    id: 'contax-t2',
    name: 'Contax T2',
    filmStock: 'Portra 400',
    photos: Array.from({ length: 24 }, (_, i) => ({
      id: `contax-${i}`,
      src: null, // generated lazily
      hue: 30, sat: 55, light: 55,
      seed: 1000 + i,
      caption: ['Golden hour walk', 'Corner café', 'Morning light', 'Side street', 'Market day', 'Evening haze', 'Quiet moment', 'Passing clouds', 'Window seat', 'Last frame', 'Harbour wall', 'Old doorway', 'Long shadow', 'After rain', 'Sunday park', 'Dusk', 'Flower stall', 'Bus stop', 'Alleyway', 'Rooftop view', 'Cobblestones', 'Bicycle', 'Reflection', 'End of roll'][i],
      date: 'Mar 2026',
    })),
  },
  {
    id: 'olympus-mju',
    name: 'Olympus mju II',
    filmStock: 'Superia 400',
    photos: Array.from({ length: 18 }, (_, i) => ({
      id: `olympus-${i}`,
      src: null,
      hue: 200, sat: 45, light: 50,
      seed: 2000 + i,
      caption: ['Beach walk', 'Ferry terminal', 'Rock pool', 'Ice cream', 'Windy pier', 'Sand dune', 'Shell', 'Boat house', 'Horizon', 'Lighthouse', 'Tide line', 'Cliff path', 'Sunset swim', 'Fish & chips', 'Sea wall', 'Pebbles', 'Kite', 'Gull'][i],
      date: 'Feb 2026',
    })),
  },
  {
    id: 'leica-m6',
    name: 'Leica M6',
    filmStock: 'Tri-X 400',
    photos: Array.from({ length: 36 }, (_, i) => ({
      id: `leica-${i}`,
      src: null,
      hue: 40, sat: 8, light: 45,
      seed: 3000 + i,
      caption: ['Platform 3', 'Rain on glass', 'Newspaper stand', 'Commuter', 'Bridge arch', 'Underground', 'Wet pavement', 'Phone box', 'Clock tower', 'Street musician', 'Market hall', 'Taxi rank', 'Fire escape', 'Construction', 'Puddle', 'Shadow play', 'Dog walker', 'Chimney smoke', 'Backlit', 'Crosswalk', 'Scaffolding', 'Stairwell', 'Lamppost', 'Overcast', 'Rush hour', 'Graffiti wall', 'Drain cover', 'Night bus', 'Shop front', 'Alley cat', 'Umbrella', 'Steam vent', 'Manhole', 'Billboard', 'Fire hydrant', 'Last light'][i],
      date: 'Jan 2026',
    })),
  },
  {
    id: 'pentax-k1000',
    name: 'Pentax K1000',
    filmStock: 'Ektar 100',
    photos: Array.from({ length: 12 }, (_, i) => ({
      id: `pentax-${i}`,
      src: null,
      hue: 10, sat: 60, light: 50,
      seed: 4000 + i,
      caption: ['Autumn trail', 'Red barn', 'Fallen leaves', 'Fence post', 'Misty field', 'Muddy boots', 'Old oak', 'Hay bale', 'Stream crossing', 'Pheasant', 'Gate latch', 'Wool'][i],
      date: 'Dec 2025',
    })),
  },
  {
    id: 'canon-ae1',
    name: 'Canon AE-1',
    filmStock: 'CineStill 800T',
    photos: Array.from({ length: 20 }, (_, i) => ({
      id: `canon-${i}`,
      src: null,
      hue: 220, sat: 50, light: 40,
      seed: 5000 + i,
      caption: ['Neon sign', 'Bar window', 'Taxi blur', 'Stage light', 'Vinyl shop', 'Late show', 'Marquee', 'Wet neon', 'Jukebox', 'Pool table', 'Dance floor', 'Exit sign', 'Smoke ring', 'Mic stand', 'Drum kit', 'Crowd', 'Encore', 'Last orders', 'Night walk', 'Dawn'][i],
      date: 'Nov 2025',
    })),
  },
];

// Lazy image generation
function getPhotoSrc(photo) {
  if (!photo.src) {
    photo.src = generatePlaceholder(photo.hue, photo.sat, photo.light, 600, 600, photo.seed);
  }
  return photo.src;
}

function getPhotoSrcHiRes(photo) {
  return generatePlaceholder(photo.hue, photo.sat, photo.light, 1200, 1600, photo.seed + 500);
}
