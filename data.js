// ── Sample Data ──
// Generate placeholder images that look like film photos

function generateFilmPhoto(hue, sat, light, w, h, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);

  // Sky/background gradient
  const baseH = hue + (rng() - 0.5) * 25;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `hsl(${baseH}, ${sat}%, ${light + 15}%)`);
  grad.addColorStop(0.4, `hsl(${baseH + 10}, ${sat - 5}%, ${light + 5}%)`);
  grad.addColorStop(1, `hsl(${baseH + 20}, ${sat + 10}%, ${light - 20}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Horizon line / ground
  const horizonY = h * (0.45 + rng() * 0.2);
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  groundGrad.addColorStop(0, `hsl(${baseH + 30}, ${sat - 15}%, ${light - 10}%)`);
  groundGrad.addColorStop(1, `hsl(${baseH + 40}, ${sat - 10}%, ${light - 25}%)`);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // Structures / shapes
  const numShapes = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < numShapes; i++) {
    const sx = rng() * w;
    const sw = 30 + rng() * 100;
    const sh = 50 + rng() * 150;
    const sy = horizonY - sh + rng() * 30;
    const shapeH = baseH + (rng() - 0.5) * 50;
    ctx.fillStyle = `hsla(${shapeH}, ${sat * 0.6}%, ${light - 15 + rng() * 10}%, ${0.4 + rng() * 0.4})`;
    ctx.fillRect(sx, sy, sw, sh);
  }

  // Film grain look
  for (let i = 0; i < 800; i++) {
    const gx = rng() * w;
    const gy = rng() * h;
    const ga = rng() * 0.08;
    ctx.fillStyle = rng() > 0.5 ? `rgba(255,255,255,${ga})` : `rgba(0,0,0,${ga})`;
    ctx.fillRect(gx, gy, 1, 1);
  }

  // Vignette
  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.7);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  return canvas.toDataURL('image/jpeg', 0.88);
}

function generateCameraIcon(color1, color2, accent, w, h, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);

  // Camera body
  const bx = w * 0.1, by = h * 0.2, bw = w * 0.8, bh = h * 0.55;
  ctx.fillStyle = color1;
  roundRect(ctx, bx, by, bw, bh, 12);
  ctx.fill();

  // Lens
  const cx = w * 0.5, cy = h * 0.45, lr = Math.min(bw, bh) * 0.28;
  ctx.beginPath();
  ctx.arc(cx, cy, lr, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, lr * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${210 + rng() * 30}, 60%, 35%)`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, lr * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  // Lens highlight
  ctx.beginPath();
  ctx.arc(cx - lr * 0.15, cy - lr * 0.15, lr * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();

  // Viewfinder bump
  ctx.fillStyle = color2 || color1;
  roundRect(ctx, w * 0.35, h * 0.1, w * 0.2, h * 0.15, 4);
  ctx.fill();

  // Flash
  ctx.fillStyle = '#ddd';
  roundRect(ctx, w * 0.68, h * 0.12, w * 0.12, h * 0.1, 3);
  ctx.fill();

  // Accent detail
  if (accent) {
    ctx.fillStyle = accent;
    roundRect(ctx, bx, by + bh * 0.6, bw * 0.25, bh * 0.4, 6);
    ctx.fill();
  }

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 5;

  return canvas.toDataURL('image/png');
}

function generateFilmCanister(color, label, w, h, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);

  // Canister body
  ctx.fillStyle = '#222';
  roundRect(ctx, w * 0.2, h * 0.1, w * 0.55, h * 0.8, 6);
  ctx.fill();

  // Spool top
  ctx.beginPath();
  ctx.arc(w * 0.47, h * 0.15, w * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#333';
  ctx.fill();

  // Label
  ctx.fillStyle = color;
  roundRect(ctx, w * 0.22, h * 0.3, w * 0.51, h * 0.4, 3);
  ctx.fill();

  // Label text
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(w * 0.1)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, w * 0.47, h * 0.55);

  // Film leader
  ctx.fillStyle = '#444';
  ctx.fillRect(w * 0.72, h * 0.4, w * 0.2, h * 0.08);

  return canvas.toDataURL('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Camera Data ──
const CAMERAS = [
  {
    id: 'canon-sure-shot',
    name: 'canon sure shot',
    icon: null,
    iconColors: ['#e8ddd0', '#c4392f', '#c4392f'],
    rolls: [
      {
        id: 'bali-2024',
        title: 'bali 2024',
        flag: '\u{1F1EE}\u{1F1E9}',
        photos: Array.from({ length: 8 }, (_, i) => ({
          id: `canon-bali-${i}`,
          src: null,
          hue: 140, sat: 50, light: 55,
          seed: 1000 + i,
        })),
      },
      {
        id: 'london-2024',
        title: 'london 2024',
        flag: '\u{1F1EC}\u{1F1E7}',
        photos: Array.from({ length: 12 }, (_, i) => ({
          id: `canon-london-${i}`,
          src: null,
          hue: 210, sat: 30, light: 48,
          seed: 1100 + i,
        })),
      },
    ],
  },
  {
    id: 'fuji-gardia-mini',
    name: 'fuji gardia mini',
    icon: null,
    iconColors: ['#555', '#444', null],
    rolls: [
      {
        id: 'thailand-2024',
        title: 'thailand 2024',
        flag: '\u{1F1F9}\u{1F1ED}',
        photos: Array.from({ length: 6 }, (_, i) => ({
          id: `fuji-thai-${i}`,
          src: null,
          hue: 30, sat: 45, light: 50,
          seed: 2000 + i,
        })),
      },
    ],
  },
  {
    id: 'ricoh-gr1',
    name: 'ricoh gr1',
    icon: null,
    iconColors: ['#2a2a2a', '#222', null],
    rolls: [
      {
        id: 'tokyo-2025',
        title: 'tokyo 2025',
        flag: '\u{1F1EF}\u{1F1F5}',
        photos: Array.from({ length: 10 }, (_, i) => ({
          id: `ricoh-tokyo-${i}`,
          src: null,
          hue: 260, sat: 25, light: 42,
          seed: 3000 + i,
        })),
      },
      {
        id: 'home-2025',
        title: 'home 2025',
        flag: '\u{1F3E0}',
        photos: Array.from({ length: 5 }, (_, i) => ({
          id: `ricoh-home-${i}`,
          src: null,
          hue: 45, sat: 40, light: 55,
          seed: 3100 + i,
        })),
      },
    ],
  },
  {
    id: 'kodak-ektar-h35',
    name: 'kodak ektar h35',
    icon: null,
    iconColors: ['#e0a030', '#c08020', '#e0a030'],
    rolls: [
      {
        id: 'new-york-2024',
        title: 'new york 2024',
        flag: '\u{1F1FA}\u{1F1F8}',
        photos: Array.from({ length: 9 }, (_, i) => ({
          id: `kodak-ny-${i}`,
          src: null,
          hue: 15, sat: 35, light: 45,
          seed: 4000 + i,
        })),
      },
    ],
  },
];

const FILM_STOCKS = [
  { id: 'tmax-400', name: 'T-Max 400', color: '#d4a020', label: 'T400' },
  { id: 'portra-160', name: 'Portra 160', color: '#c4703f', label: 'P160' },
  { id: 'superia-400', name: 'Superia 400', color: '#2e7d32', label: 'S400' },
  { id: 'cinestill-800t', name: 'CineStill 800T', color: '#1565c0', label: 'C800' },
];

// ── Lazy generation ──
function getPhotoSrc(photo, hiRes) {
  const key = hiRes ? '_srcHi' : '_src';
  if (!photo[key]) {
    const w = hiRes ? 800 : 300;
    const h = hiRes ? 1000 : 380;
    photo[key] = generateFilmPhoto(photo.hue, photo.sat, photo.light, w, h, photo.seed + (hiRes ? 500 : 0));
  }
  return photo[key];
}

function getCameraIcon(camera) {
  if (!camera.icon) {
    const [c1, c2, acc] = camera.iconColors;
    camera.icon = generateCameraIcon(c1, c2, acc, 200, 160, hashStr(camera.id));
  }
  return camera.icon;
}

function getFilmIcon(film) {
  if (!film.icon) {
    film.icon = generateFilmCanister(film.color, film.label, 160, 180, hashStr(film.id));
  }
  return film.icon;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
