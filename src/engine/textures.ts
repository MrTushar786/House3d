import * as THREE from 'three';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export function makeCanvasTex(w: number, h: number, draw: Draw, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function gridTile(base: string, line: string): Draw {
  return (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    for (let i = 0; i <= w; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
  };
}

/**
 * Natural-looking surface noise. Small sizes become pixel grain; larger sizes
 * become soft, feathered patches (no hard edges, so nothing reads as "dots").
 * Patches are drawn wrapped around the edges so the texture tiles seamlessly.
 */
function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, size: number, colors: string[]) {
  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    const x = Math.random() * w, y = Math.random() * h;
    if (size < 3) {
      ctx.fillStyle = color;
      const s = Math.random() < 0.7 ? 1 : 2;
      ctx.fillRect(Math.floor(x), Math.floor(y), s, s);
      continue;
    }
    const r = size * (0.5 + Math.random());
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        const cx = x + ox, cy = y + oy;
        if (cx + r < 0 || cx - r > w || cy + r < 0 || cy - r > h) continue;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
  }
}

/** Square ceramic tiles with grout lines; `tilesPerSide` tiles across the texture. */
function ceramicTiles(base: string, alt: string, grout: string, tilesPerSide: number): Draw {
  return (ctx, w, h) => {
    const s = w / tilesPerSide;
    for (let r = 0; r < tilesPerSide; r++) {
      for (let c = 0; c < tilesPerSide; c++) {
        ctx.fillStyle = (r + c) % 3 === 0 ? alt : base;
        ctx.fillRect(c * s, r * s, s, s);
      }
    }
    speckle(ctx, w, h, 400, 1.2, ['rgba(0,0,0,0.03)', 'rgba(255,255,255,0.05)']);
    ctx.strokeStyle = grout;
    ctx.lineWidth = 3;
    for (let i = 0; i <= tilesPerSide; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke();
    }
  };
}

/** All procedural textures, scaled to real feet. */
export function createTextures() {
  return {
    /** Bare earth with patches of dry grass — the ground around the plot (~15 ft per tile). */
    soil: makeCanvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#a89d80';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 90, 70, ['rgba(120,134,78,0.22)', 'rgba(150,158,98,0.18)', 'rgba(184,170,134,0.22)']);
      speckle(ctx, w, h, 160, 22, ['rgba(110,124,70,0.18)', 'rgba(140,126,98,0.16)']);
      speckle(ctx, w, h, 14000, 1, ['rgba(80,70,52,0.22)', 'rgba(220,210,182,0.2)', 'rgba(104,120,66,0.22)']);
    }, 120, 120),

    /** Cast-in-place RCC roof concrete: near-white so the per-house tint shows true. */
    concrete: makeCanvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f2f2f0';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 60, 22, ['rgba(0,0,0,0.012)', 'rgba(255,255,255,0.02)']);
      speckle(ctx, w, h, 2500, 1.4, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.06)']);
    }, 4, 4),

    /** 1 ft glazed wall tiles for bathrooms (texture = 4 ft). */
    bathWallTile: makeCanvasTex(256, 256, ceramicTiles('#eef3f6', '#e4ebef', '#c3ccd2', 4), 1, 1),
    /** 1 ft matte anti-skid floor tiles (texture = 4 ft). */
    bathFloorTile: makeCanvasTex(256, 256, ceramicTiles('#9aa3a8', '#8d969b', '#6b7378', 4), 1, 1),

    /** Grey value noise, used as a bump map for plaster and asphalt. */
    bumpNoise: makeCanvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 3500, 1.6, ['#6a6a6a', '#979797', '#757575', '#8c8c8c']);
    }, 6, 6),

    courtyardGrass: makeCanvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#6eb13f';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3600; i++) {
        ctx.fillStyle = i % 3 === 0 ? '#7fc44c' : i % 3 === 1 ? '#5e9e33' : '#88cf55';
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 4);
      }
    }, 8, 8),

    roadAsphalt: makeCanvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3200; i++) {
        const v = 58 + Math.floor(Math.random() * 28);
        ctx.fillStyle = `rgb(${v},${v + 5},${v + 12})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, 6, 10),

    paverLane: makeCanvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#b9b2a7';
      ctx.fillRect(0, 0, w, h);
      const rows = 8, cols = 4, rw = w / cols, rh = h / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (rw / 2);
        for (let c = -1; c <= cols; c++) {
          const v = 172 + Math.floor(Math.random() * 22);
          ctx.fillStyle = `rgb(${v},${v - 5},${v - 12})`;
          ctx.fillRect(c * rw + off + 2, r * rh + 2, rw - 4, rh - 4);
        }
      }
    }, 2, 10),

    wood: makeCanvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#b9895b';
      ctx.fillRect(0, 0, w, h);
      const ph = h / 8;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#be8e5f' : '#b08052';
        ctx.fillRect(0, i * ph, w, ph - 1);
        ctx.fillStyle = '#8b5e36';
        ctx.fillRect(0, (i + 1) * ph - 1, w, 1);
      }
    }, 8, 12),

    marble: makeCanvasTex(256, 256, gridTile('#f1f5f9', '#cbd5e1'), 8, 8),
    warmTile: makeCanvasTex(256, 256, gridTile('#f5e8dc', '#d8c5b2'), 8, 6),

    stucco: makeCanvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, 4, 2),
  };
}
