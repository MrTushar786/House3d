import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, type LucideIcon } from 'lucide-react';
import type { WalkDirection } from '../engine/HouseEngine';

interface Props {
  onDirection: (dir: WalkDirection, active: boolean) => void;
}

function PadButton({ dir, title, Icon, onDirection }: Props & { dir: WalkDirection; title: string; Icon: LucideIcon }) {
  const stop = () => onDirection(dir, false);
  return (
    <button
      type="button"
      title={title}
      className="w-10 h-9 rounded-lg bg-white/10 hover:bg-emerald-500/30 active:bg-emerald-500/50 flex items-center justify-center"
      onPointerDown={(e) => {
        e.preventDefault();
        onDirection(dir, true);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

export function WalkPad({ onDirection }: Props) {
  return (
    <div className="fixed bottom-24 left-3 z-20 glass rounded-2xl p-2 flex flex-col items-center gap-1">
      <PadButton dir="forward" title="Walk Forward (W / Scroll Up)" Icon={ChevronUp} onDirection={onDirection} />
      <div className="flex items-center gap-1">
        <PadButton dir="left" title="Strafe Left (A)" Icon={ChevronLeft} onDirection={onDirection} />
        <PadButton dir="backward" title="Walk Back (S / Scroll Down)" Icon={ChevronDown} onDirection={onDirection} />
        <PadButton dir="right" title="Strafe Right (D)" Icon={ChevronRight} onDirection={onDirection} />
      </div>
    </div>
  );
}
