import type { RoomId } from './constants';

export interface LocationInfo {
  id: RoomId;
  name: string;
  area: string;
}

/** Which plot / road / courtyard a ground-plane point (in feet) falls in, or null if none. */
export function regionAt(x: number, z: number): Exclude<RoomId, 'aerial'> | null {
  if (x >= 0 && x <= 22.5 && z >= 0 && z <= 51) return 'plot4';
  if ((x >= 22.5 && x <= 42 && z >= 0 && z <= 34) || (x >= 42 && x <= 64 && z >= 22 && z <= 34)) return 'plot3';
  if (x >= 64 && x <= 103 && z >= 22 && z <= 45) return 'plot1';
  if (x >= 0 && x <= 40 && z >= 51 && z <= 77) return 'plot2';
  if (x >= 0 && x <= 6.5 && z >= 77 && z <= 107) return 'chotaRasta';
  if (x >= 40 && x <= 58.5 && z >= 68 && z <= 88) return 'guestRoom';
  if (x >= 58.5 && x <= 75 && z >= 68 && z <= 107) return 'badaRasta';
  if (x >= 22.5 && x <= 75 && z >= 34 && z <= 68) return 'courtyard';
  return null;
}

const WALK_LABELS: Record<Exclude<RoomId, 'aerial'>, Omit<LocationInfo, 'id'>> = {
  plot4: { name: 'House 4 — Brother 4 (Sandstone Villa)', area: '1,147 sq ft' },
  plot3: { name: 'House 3 — Brother 3 (L-Shaped Home)', area: '927 sq ft' },
  plot1: { name: 'House 1 — Brother 1 (Terracotta Villa)', area: '897 sq ft' },
  plot2: { name: 'House 2 — Brother 2 (40 × 26 ft)', area: '1,040 sq ft' },
  guestRoom: { name: 'Common Guest Room (Shared)', area: '370 sq ft' },
  chotaRasta: { name: 'Chota Patla Rasta (30 × 6.5 ft)', area: 'Side Narrow Lane' },
  badaRasta: { name: 'Bada Rasta (Main Wide Road)', area: 'Main Entry Road' },
  courtyard: { name: 'Central Open Courtyard', area: 'Shared Green Area' },
};

export const AERIAL_LOCATION: LocationInfo = {
  id: 'aerial',
  name: 'Aerial View • 4 Plots & 2 Raste',
  area: '1:1 Feet Scale',
};

export function describeLocation(isWalk: boolean, x: number, z: number): LocationInfo {
  if (!isWalk) return AERIAL_LOCATION;
  const id = regionAt(x, z);
  if (!id) return { id: 'badaRasta', name: 'Plot Entry Boundary', area: '1:1 Feet Scale' };
  return { id, ...WALK_LABELS[id] };
}
