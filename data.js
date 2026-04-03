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

function generateCameraIcon(color1, color2, accent, w, h, seed, style) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Drop shadow under camera
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 6;

  if (style === 'compact') {
    // Canon Sure Shot style — rounded body, big red grip, prominent lens ring
    const bx = w*0.08, by = h*0.22, bw = w*0.84, bh = h*0.52;
    ctx.fillStyle = color1;
    roundRect(ctx, bx, by, bw, bh, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // Grip
    ctx.fillStyle = accent || '#c4392f';
    roundRect(ctx, bx, by + bh*0.15, bw*0.28, bh*0.85, 10);
    ctx.fill();
    // Lens barrel
    const cx = w*0.55, cy = h*0.46;
    ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI*2);
    ctx.fillStyle = '#222'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI*2);
    ctx.fillStyle = '#c41010'; ctx.fill(); // red ring
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI*2);
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2);
    ctx.fillStyle = '#1a3a5c'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx-4, cy-4, 3, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
    // Viewfinder
    ctx.fillStyle = '#333';
    roundRect(ctx, w*0.56, h*0.14, w*0.18, h*0.1, 3);
    ctx.fill();
    // Flash
    ctx.fillStyle = '#ccc';
    roundRect(ctx, w*0.72, h*0.18, w*0.12, h*0.08, 2);
    ctx.fill();
    // Label
    ctx.fillStyle = '#888';
    ctx.font = `bold 8px 'SF Pro Display', -apple-system, sans-serif`;
    ctx.fillText('Canon', w*0.38, h*0.30);
  } else if (style === 'slim') {
    // Fuji Gardia Mini — compact silver body
    const bx = w*0.1, by = h*0.25, bw = w*0.78, bh = h*0.48;
    ctx.fillStyle = color1;
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // Dark top strip
    ctx.fillStyle = '#333';
    roundRect(ctx, bx, by, bw, bh*0.2, 10);
    ctx.fill();
    ctx.fillStyle = color1;
    roundRect(ctx, bx, by + bh*0.15, bw, bh*0.1, 0);
    ctx.fill();
    // Lens
    const cx = w*0.38, cy = h*0.48;
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI*2);
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2);
    ctx.fillStyle = '#1a3a5c'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx-3, cy-3, 3, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
    // Flash
    ctx.fillStyle = '#aaa';
    roundRect(ctx, w*0.6, by + 4, w*0.08, bh*0.15, 2);
    ctx.fill();
    // Label
    ctx.fillStyle = '#666';
    ctx.font = `bold 7px 'SF Pro Display', -apple-system, sans-serif`;
    ctx.fillText('FUJI', w*0.55, h*0.50);
  } else if (style === 'rangefinder') {
    // Ricoh GR1 — black, boxy, serious
    const bx = w*0.06, by = h*0.22, bw = w*0.88, bh = h*0.5;
    ctx.fillStyle = color1;
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // Top plate
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, bx, by, bw, bh*0.22, 8);
    ctx.fill();
    // Lens
    const cx = w*0.38, cy = h*0.50;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI*2);
    ctx.fillStyle = '#0a0a0a'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI*2);
    ctx.fillStyle = '#1a3a60'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx-3, cy-3, 3, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    // Viewfinder window
    ctx.fillStyle = '#334';
    roundRect(ctx, w*0.58, h*0.24, w*0.14, h*0.07, 2);
    ctx.fill();
    // Flash
    ctx.fillStyle = '#444';
    roundRect(ctx, w*0.76, h*0.24, w*0.1, h*0.07, 2);
    ctx.fill();
  } else if (style === 'half-frame') {
    // Kodak Ektar H35 — orange/tan, playful
    const bx = w*0.08, by = h*0.2, bw = w*0.82, bh = h*0.55;
    ctx.fillStyle = accent || '#e0a030';
    roundRect(ctx, bx, by, bw, bh, 14);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // Silver face plate
    ctx.fillStyle = '#d0ccc0';
    roundRect(ctx, bx + bw*0.3, by, bw*0.7, bh, 14);
    ctx.fill();
    // Lens
    const cx = w*0.58, cy = h*0.46;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI*2);
    ctx.fillStyle = '#222'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI*2);
    ctx.fillStyle = '#1a3a5c'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx-3, cy-3, 3, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
    // Viewfinder
    ctx.fillStyle = '#555';
    roundRect(ctx, w*0.62, h*0.15, w*0.12, h*0.08, 2);
    ctx.fill();
    // Screen/window
    ctx.fillStyle = '#6ab';
    roundRect(ctx, w*0.38, h*0.15, w*0.14, h*0.08, 2);
    ctx.fill();
  }

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
    iconStyle: 'compact',
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
    iconColors: ['#888', '#666', null],
    iconStyle: 'slim',
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
    iconStyle: 'rangefinder',
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
    iconStyle: 'half-frame',
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
    camera.icon = generateCameraIcon(c1, c2, acc, 200, 160, hashStr(camera.id), camera.iconStyle);
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
