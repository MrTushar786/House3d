import { BATHROOMS } from './constants';

export const MINIMAP_WIDTH = 220;
export const MINIMAP_HEIGHT = 230;

const MM_SCALE = 1.92;
const MM_OX = 11;
const MM_OY = 12;

function toMM(x: number, z: number): [number, number] {
  return [MM_OX + x * MM_SCALE, MM_OY + z * MM_SCALE];
}

/** Converts a canvas-pixel position back to world feet. */
export function minimapToWorld(px: number, py: number): [number, number] {
  return [(px - MM_OX) / MM_SCALE, (py - MM_OY) / MM_SCALE];
}

export interface MinimapViewer {
  x: number;
  z: number;
  /** Walk-mode yaw; when set, a view cone is drawn. */
  yaw: number | null;
}

export function drawMinimap(ctx: CanvasRenderingContext2D, viewer: MinimapViewer) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const rect = (x1: number, z1: number, x2: number, z2: number, fill: string, stroke = '#0f2922') => {
    const [px, pz] = toMM(x1, z1);
    const w = (x2 - x1) * MM_SCALE, h = (z2 - z1) * MM_SCALE;
    ctx.fillStyle = fill;
    ctx.fillRect(px, pz, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, pz, w, h);
  };

  // Courtyard
  rect(22.5, 34, 64, 51, '#78b83d', '#5c942a');
  rect(40, 51, 64, 68, '#78b83d', '#5c942a');
  rect(64, 45, 75, 68, '#78b83d', '#5c942a');
  // Bada Rasta
  rect(58.5, 68, 75, 107, '#64748b', '#334155');
  // Common guest room
  rect(40, 68, 58.5, 88, '#ece4ff');
  // Chota Patla Rasta
  rect(0, 77, 6.5, 107, '#94a3b8', '#475569');
  // 4 brothers' houses
  rect(0, 0, 22.5, 51, '#fdf2e1');
  rect(22.5, 0, 42, 34, '#dbeeff');
  rect(42, 22, 64, 34, '#dbeeff');
  rect(64, 22, 103, 45, '#fce1e4');
  rect(0, 51, 40, 77, '#ddf7e3');
  // Toilet + bathrooms
  for (const [x1, z1, x2, z2] of BATHROOMS) rect(x1, z1, x2, z2, '#9fd3f0', '#3b82a6');

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels: [string, number, number][] = [['4', 11.2, 25], ['3', 32, 17], ['1', 83, 33.5], ['2 (40ft)', 20, 64], ['Guest', 49.25, 78]];
  for (const [txt, lx, lz] of labels) {
    const [px, pz] = toMM(lx, lz);
    ctx.fillText(txt, px, pz);
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 8px Inter, sans-serif';
  const [brx, brz] = toMM(66.5, 88);
  ctx.fillText('BADA', brx, brz - 4);
  ctx.fillText('RASTA', brx, brz + 5);

  const [px, pz] = toMM(viewer.x, viewer.z);

  if (viewer.yaw !== null) {
    const dirAngle = -viewer.yaw - Math.PI / 2;
    ctx.save();
    ctx.translate(px, pz);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 17, dirAngle - 0.45, dirAngle + 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(px, pz, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#10b981';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.stroke();
}
