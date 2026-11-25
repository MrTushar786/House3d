import { House } from 'lucide-react';
import type { LocationInfo } from '../engine/regions';

export function LocationBadge({ location }: { location: LocationInfo }) {
  return (
    <div className="fixed top-3 left-3 z-20 flex flex-col gap-2 max-w-[calc(100vw-24px)] sm:max-w-xs pointer-events-none">
      <div className="glass rounded-2xl px-3.5 py-2.5 pointer-events-auto flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
          <House className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wide text-emerald-300 uppercase">4 Brothers • Exact 1:1 Feet Scale</div>
          <div className="text-sm font-bold text-white truncate">4,011 sq ft • 4 Independent Homes</div>
        </div>
      </div>

      <div className="glass rounded-xl px-3 py-1.5 pointer-events-auto inline-flex items-center gap-2 self-start">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-medium text-slate-100">{location.name}</span>
        <span className="text-[11px] text-emerald-300 font-semibold hidden sm:inline">{location.area}</span>
      </div>
    </div>
  );
}
