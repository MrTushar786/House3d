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

/** All procedural textures, scaled to real feet. */
export function createTextures() {
  return {
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
