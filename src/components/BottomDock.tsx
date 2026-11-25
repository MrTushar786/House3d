import { Footprints, Gamepad2 } from 'lucide-react';
import type { NavMode, RoomId } from '../engine/constants';

const ROOMS: { id: RoomId; label: string }[] = [
  { id: 'aerial', label: 'Aerial' },
  { id: 'badaRasta', label: 'Bada Rasta' },
  { id: 'chotaRasta', label: 'Chota Rasta' },
  { id: 'courtyard', label: 'Courtyard' },
  { id: 'guestRoom', label: 'Guest Room' },
  { id: 'plot1', label: 'House 1 (39×23)' },
  { id: 'plot2', label: 'House 2 (40×26)' },
  { id: 'plot3', label: 'House 3 (927)' },
  { id: 'plot4', label: 'House 4 (22.5×51)' },
];

interface Props {
  mode: NavMode;
  activeRoom: RoomId;
  onToggleMode: () => void;
  onPlay: () => void;
  onSelectRoom: (id: RoomId) => void;
}

export function BottomDock({ mode, activeRoom, onToggleMode, onPlay, onSelectRoom }: Props) {
  const isWalk = mode === 'walk';
  const isPlaying = mode === 'character';
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100vw-24px)] max-w-4xl flex flex-col items-center gap-1.5 pointer-events-none">
      <div className="glass rounded-full px-3 py-1 text-[11px] text-slate-300 pointer-events-auto text-center">
        {isPlaying ? (
          <>
            <span className="text-amber-300 font-semibold">Click ground to walk (double-click: run) • WASD to move</span> • Drag to look • Scroll to zoom
          </>
        ) : isWalk ? (
          <>
            <span className="text-emerald-300 font-semibold">Scroll / WASD</span> to walk • Drag to look 360°
          </>
        ) : (
          <>
            <span className="text-emerald-300 font-semibold">Drag to move • Scroll to zoom</span> • Right-drag to rotate • WASD to pan
          </>
        )}
      </div>

      <div className="glass rounded-2xl p-1.5 flex items-center gap-1.5 max-w-full overflow-x-auto no-scrollbar pointer-events-auto">
        <button
          type="button"
          onClick={onToggleMode}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition"
        >
          <Footprints className="w-4 h-4" />
          <span>{mode === 'orbit' ? 'Enter Inside' : 'Exit to Aerial'}</span>
        </button>

        <button
          type="button"
          onClick={onPlay}
          title="Play as a 3D character (third-person)"
          className={`shrink-0 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
            isPlaying
              ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/30'
              : 'bg-white/10 text-amber-200 hover:bg-amber-400/20'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>Play</span>
        </button>

        <div className="w-px h-6 bg-white/15 shrink-0" />

        {ROOMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelectRoom(id)}
            className={`room-btn shrink-0 px-2.5 py-1.5 rounded-xl text-xs text-slate-200 hover:bg-white/10 ${id === activeRoom ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
