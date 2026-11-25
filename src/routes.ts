import type { RoomId } from './engine/constants';

/**
 * Hash routes for every view, e.g. `#/house-1`. Hash routing works on any
 * static host (GitHub Pages, Netlify, a plain file server) without rewrite rules.
 */
export const ROOM_ROUTES: Record<RoomId, string> = {
  aerial: '/',
  badaRasta: '/bada-rasta',
  chotaRasta: '/chota-rasta',
  courtyard: '/courtyard',
  guestRoom: '/guest-room',
  plot1: '/house-1',
  plot2: '/house-2',
  plot3: '/house-3',
  plot4: '/house-4',
};

const ROUTE_TO_ROOM = new Map<string, RoomId>(
  Object.entries(ROOM_ROUTES).map(([id, path]) => [path, id as RoomId]),
);

export function roomFromHash(hash: string = window.location.hash): RoomId {
  const path = hash.replace(/^#/, '') || '/';
  return ROUTE_TO_ROOM.get(path) ?? 'aerial';
}

export function hashForRoom(id: RoomId): string {
  return `#${ROOM_ROUTES[id]}`;
}

/** Adds a history entry for `id` (fires `hashchange`). */
export function navigateToRoom(id: RoomId) {
  window.location.hash = ROOM_ROUTES[id];
}

/** Updates the URL to `id` without adding history or firing `hashchange`. */
export function replaceRoom(id: RoomId) {
  if (roomFromHash() === id) return;
  window.history.replaceState(window.history.state, '', hashForRoom(id));
}
