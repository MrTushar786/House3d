import { Compass } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { RoomId } from '../engine/constants';
import { MINIMAP_HEIGHT, MINIMAP_WIDTH, minimapToWorld } from '../engine/minimap';
import { regionAt } from '../engine/regions';

interface Props {
  canvasRef: (canvas: HTMLCanvasElement | null) => void;
  onSelect: (id: RoomId) => void;
}

export function Minimap({ canvasRef, onSelect }: Props) {
  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    const [wx, wz] = minimapToWorld(
      (e.clientX - r.left) * (canvas.width / r.width),
      (e.clientY - r.top) * (canvas.height / r.height),
    );
    const id = regionAt(wx, wz);
    if (id) onSelect(id);
  };

  return (
    <div className="fixed bottom-24 right-3 z-20 glass rounded-2xl p-2.5 w-48 sm:w-56 transition-all duration-200">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1">
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          Plot Map (Click to Visit)
        </span>
        <span className="text-[10px] font-bold text-amber-300">N ↑</span>
      </div>
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        onClick={handleClick}
        className="w-full h-auto rounded-xl bg-slate-950/90 border border-white/10 cursor-pointer"
      />
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-0.5">
        <span>H1: 897 • H2: 1,040</span>
        <span>H3: 927 • H4: 1,147</span>
      </div>
    </div>
  );
}
