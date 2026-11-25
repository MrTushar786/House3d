import { useState } from 'react';
import { BottomDock } from './components/BottomDock';
import { LocationBadge } from './components/LocationBadge';
import { Minimap } from './components/Minimap';
import { TopControls } from './components/TopControls';
import { WalkPad } from './components/WalkPad';
import { useHouseEngine } from './useHouseEngine';

export default function App() {
  const { containerRef, attachMinimap, state, actions } = useHouseEngine();
  const [mapVisible, setMapVisible] = useState(true);

  return (
    <>
      <div ref={containerRef} className="scene-container" />

      <LocationBadge location={state.location} />

      <TopControls
        timeOfDay={state.timeOfDay}
        roofVisible={state.roofVisible}
        dimsVisible={state.dimsVisible}
        onTimeOfDay={actions.setTimeOfDay}
        onToggleRoof={() => actions.setRoofVisible(!state.roofVisible)}
        onToggleDims={() => actions.setDimsVisible(!state.dimsVisible)}
        onToggleMap={() => setMapVisible((v) => !v)}
      />

      {mapVisible && <Minimap canvasRef={attachMinimap} onSelect={actions.selectRoom} />}

      {state.mode !== 'orbit' && <WalkPad onDirection={actions.setWalkDirection} />}

      <BottomDock
        mode={state.mode}
        activeRoom={state.activeRoom}
        onToggleMode={actions.toggleMode}
        onPlay={actions.playCharacter}
        onSelectRoom={actions.selectRoom}
      />
    </>
  );
}
