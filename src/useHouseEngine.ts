import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROOM_PRESETS, type NavMode, type RoomId, type TimeOfDay } from './engine/constants';
import { HouseEngine, type WalkDirection } from './engine/HouseEngine';
import { AERIAL_LOCATION, type LocationInfo } from './engine/regions';
import { navigateToRoom, replaceRoom, roomFromHash } from './routes';

const APP_TITLE = '4 Brothers 3D House Plots';

/**
 * Creates the three.js engine inside `containerRef`, mirrors its state
 * (mode, location, roof) into React, and keeps the view in sync with the URL
 * hash so every view is a shareable, back/forward-able SPA route.
 */
export function useHouseEngine() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HouseEngine | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<NavMode>('orbit');
  const [location, setLocation] = useState<LocationInfo>(AERIAL_LOCATION);
  const [activeRoom, setActiveRoom] = useState<RoomId>(() => roomFromHash());
  const [roofVisible, setRoofVisibleState] = useState(true);
  const [dimsVisible, setDimsVisibleState] = useState(true);
  const [timeOfDay, setTimeOfDayState] = useState<TimeOfDay>('noon');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new HouseEngine(
      container,
      {
        onModeChange: setMode,
        onLocationChange: (info) => {
          setLocation(info);
          setActiveRoom(info.id);
          // Reflect where you actually are (e.g. after walking into another
          // house) without piling up history entries.
          replaceRoom(info.id);
        },
        onRoofChange: setRoofVisibleState,
      },
      { initialRoom: roomFromHash() },
    );
    engine.setMinimapCanvas(minimapCanvasRef.current);
    engineRef.current = engine;

    // Back/forward buttons and pasted links.
    const onHashChange = () => {
      const id = roomFromHash();
      engine.selectRoom(id);
      setActiveRoom(id);
    };
    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.title = activeRoom === 'aerial' ? APP_TITLE : `${ROOM_PRESETS[activeRoom].name} · ${APP_TITLE}`;
  }, [activeRoom]);

  const attachMinimap = useCallback((canvas: HTMLCanvasElement | null) => {
    minimapCanvasRef.current = canvas;
    engineRef.current?.setMinimapCanvas(canvas);
  }, []);

  const actions = useMemo(() => {
    const selectRoom = (id: RoomId) => {
      setActiveRoom(id);
      if (roomFromHash() === id) {
        // Same URL (e.g. re-clicking the current view): no hashchange will fire.
        engineRef.current?.selectRoom(id);
      } else {
        navigateToRoom(id); // → hashchange → engine.selectRoom
      }
    };
    return {
      selectRoom,
      toggleMode() {
        selectRoom(engineRef.current?.mode === 'walk' ? 'aerial' : 'courtyard');
      },
      setRoofVisible(visible: boolean) {
        engineRef.current?.setRoofVisible(visible);
      },
      setDimsVisible(visible: boolean) {
        engineRef.current?.setDimsVisible(visible);
        setDimsVisibleState(visible);
      },
      setTimeOfDay(tod: TimeOfDay) {
        engineRef.current?.setTimeOfDay(tod);
        setTimeOfDayState(tod);
      },
      setWalkDirection(dir: WalkDirection, active: boolean) {
        engineRef.current?.setWalkDirection(dir, active);
      },
    };
  }, []);

  return {
    containerRef,
    attachMinimap,
    state: { mode, location, activeRoom, roofVisible, dimsVisible, timeOfDay },
    actions,
  };
}

export type HouseActions = ReturnType<typeof useHouseEngine>['actions'];
