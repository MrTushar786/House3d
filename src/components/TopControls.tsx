import { Layers, Map as MapIcon, Ruler } from 'lucide-react';
import type { TimeOfDay } from '../engine/constants';

const TIMES: { id: TimeOfDay; label: string; title: string }[] = [
  { id: 'morning', label: 'Morning', title: 'Morning Sunlight' },
  { id: 'noon', label: 'Noon', title: 'Midday Sun' },
  { id: 'sunset', label: 'Sunset', title: 'Sunset Light' },
  { id: 'night', label: 'Night', title: 'Night Lights' },
];

interface Props {
  timeOfDay: TimeOfDay;
  roofVisible: boolean;
  dimsVisible: boolean;
  onTimeOfDay: (tod: TimeOfDay) => void;
  onToggleRoof: () => void;
  onToggleDims: () => void;
  onToggleMap: () => void;
}

const pillBtn = 'glass rounded-xl px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-800/80 transition';

export function TopControls({ timeOfDay, roofVisible, dimsVisible, onTimeOfDay, onToggleRoof, onToggleDims, onToggleMap }: Props) {
  return (
    <div className="fixed top-3 right-3 z-20 flex flex-wrap justify-end gap-1.5 max-w-[62vw] sm:max-w-lg">
      <div className="glass rounded-xl p-1 flex items-center gap-0.5">
        {TIMES.map(({ id, label, title }) => (
          <button
            key={id}
            type="button"
            title={title}
            onClick={() => onTimeOfDay(id)}
            className={
              id === timeOfDay
                ? 'px-2 py-1 rounded-lg text-[11px] bg-amber-400 text-slate-950 font-semibold transition'
                : 'px-2 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white transition'
            }
          >
            {label}
          </button>
        ))}
      </div>

      <button type="button" className={pillBtn} title="Toggle Roof On / Cutaway" onClick={onToggleRoof}>
        <Layers className="w-3.5 h-3.5 text-amber-300" />
        <span>{roofVisible ? 'Roof: On' : 'Roof: Cutaway'}</span>
      </button>

      <button type="button" className={pillBtn} title="Show/Hide Feet Dimensions" onClick={onToggleDims}>
        <Ruler className="w-3.5 h-3.5 text-sky-300" />
        <span>{dimsVisible ? 'Dims: On' : 'Dims: Off'}</span>
      </button>

      <button type="button" className={pillBtn} title="Show/Hide 2D Map" onClick={onToggleMap}>
        <MapIcon className="w-3.5 h-3.5 text-emerald-300" />
        <span className="hidden sm:inline">Map</span>
      </button>
    </div>
  );
}
