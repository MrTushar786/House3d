// Real-world architectural scale: exactly 1.0 three.js unit = 1.0 foot.
// North = -Z (0), South = +Z (107), West = -X (0), East = +X (103).

export const WALL_H = 10.5; // Standard 10.5 ft residential ceiling height
export const EXT_T = 0.75; // 9-inch exterior brick wall
export const INT_T = 0.42; // 5-inch interior partition wall
export const EYE_H = 5.3; // Realistic human eye level (5 ft 4 in)

/** orbit = aerial view, walk = first-person, character = third-person game character. */
export type NavMode = 'orbit' | 'walk' | 'character';

export type RoomId =
  | 'aerial'
  | 'badaRasta'
  | 'chotaRasta'
  | 'courtyard'
  | 'guestRoom'
  | 'plot1'
  | 'plot2'
  | 'plot3'
  | 'plot4';

type Vec3 = readonly [number, number, number];

export interface OrbitPreset {
  name: string;
  area: string;
  mode: 'orbit';
  target: Vec3;
  radius: number;
  theta: number;
  phi: number;
}

export interface WalkPreset {
  name: string;
  area: string;
  mode: 'walk';
  pos: Vec3;
  yaw: number;
  pitch: number;
}

export type RoomPreset = OrbitPreset | WalkPreset;

export const AERIAL_PRESET: OrbitPreset = {
  name: 'Aerial View • 4 Plots & 2 Raste',
  area: '4,011 sq ft total',
  mode: 'orbit',
  target: [48, 3, 52],
  radius: 130,
  theta: 0.56,
  phi: 0.88,
};

export const ROOM_PRESETS: Record<RoomId, RoomPreset> = {
  aerial: AERIAL_PRESET,
  badaRasta: {
    name: 'Bada Rasta (Main Wide Road)',
    area: 'Main Entry Road',
    mode: 'walk',
    pos: [64, EYE_H, 101],
    yaw: 0.22,
    pitch: 0.02,
  },
  chotaRasta: {
    name: 'Chota Patla Rasta (30 × 6.5 ft)',
    area: 'Side Narrow Lane',
    mode: 'walk',
    pos: [3.25, EYE_H, 102],
    yaw: 0.0,
    pitch: 0.02,
  },
  courtyard: {
    name: 'Central Open Courtyard',
    area: 'Shared Green Area',
    mode: 'walk',
    pos: [50, EYE_H, 54],
    yaw: 0.25,
    pitch: 0.02,
  },
  guestRoom: {
    name: 'Common Guest Room (Shared by All 4)',
    area: '370 sq ft (18.5 × 20 ft)',
    mode: 'walk',
    pos: [54.25, EYE_H, 70.5],
    yaw: Math.PI - 0.35,
    pitch: -0.02,
  },
  plot1: {
    name: 'House 1 — Brother 1 (2BHK Terracotta Villa)',
    area: '897 sq ft (39 × 23 ft)',
    mode: 'walk',
    pos: [69.5, EYE_H, 38],
    yaw: -1.35,
    pitch: -0.02,
  },
  plot2: {
    name: 'House 2 — Brother 2 (2BHK Courtyard Home)',
    area: '1,040 sq ft (40 × 26 ft)',
    mode: 'walk',
    pos: [26, EYE_H, 57.5],
    yaw: 0.55,
    pitch: -0.02,
  },
  plot3: {
    name: 'House 3 — Brother 3 (2BHK L-Shaped Home)',
    area: '927 sq ft (19.5×34 + 22×12)',
    mode: 'walk',
    pos: [31.5, EYE_H, 29],
    yaw: -0.35,
    pitch: -0.02,
  },
  plot4: {
    name: 'House 4 — Brother 4 (2BHK Sandstone Villa)',
    area: '1,147 sq ft (22.5 × 51 ft)',
    mode: 'walk',
    pos: [16.5, EYE_H, 42],
    yaw: 0.45,
    pitch: -0.02,
  },
};

export type TimeOfDay = 'morning' | 'noon' | 'sunset' | 'night';

export interface TimeOfDayConfig {
  /** Sky colour straight up. */
  skyTop: number;
  /** Sky colour at the horizon; distance fog fades into this. */
  skyHorizon: number;
  /** Colour of the (unseen) ground below the horizon, for environment reflections. */
  skyGround: number;
  sunPos: Vec3;
  sunColor: number;
  sunInt: number;
  hemiSky: number;
  hemiGround: number;
  hemiInt: number;
  /** Strength of sky reflections / image-based ambient light. */
  envInt: number;
  interiorMul: number;
  exposure: number;
}

export const TOD_CONFIG: Record<TimeOfDay, TimeOfDayConfig> = {
  morning: {
    skyTop: 0x5f9bd6, skyHorizon: 0xf0dcc4, skyGround: 0x8a7f6c,
    sunPos: [140, 75, 45], sunColor: 0xffe2b8, sunInt: 1.9,
    hemiSky: 0xdcebff, hemiGround: 0x7a6e5c, hemiInt: 0.35, envInt: 0.7, interiorMul: 0.45, exposure: 0.74,
  },
  noon: {
    skyTop: 0x3f86d4, skyHorizon: 0xd3e5f3, skyGround: 0x8f8673,
    sunPos: [105, 145, 95], sunColor: 0xfff6e6, sunInt: 2.2,
    hemiSky: 0xe4f0ff, hemiGround: 0x7d7262, hemiInt: 0.4, envInt: 0.75, interiorMul: 0.35, exposure: 0.68,
  },
  sunset: {
    skyTop: 0x34457a, skyHorizon: 0xf2a267, skyGround: 0x5e4636,
    sunPos: [-115, 42, 75], sunColor: 0xff9248, sunInt: 1.9,
    hemiSky: 0xf7b98a, hemiGround: 0x3b2f2f, hemiInt: 0.3, envInt: 0.65, interiorMul: 1.15, exposure: 0.8,
  },
  night: {
    skyTop: 0x03060f, skyHorizon: 0x16203a, skyGround: 0x0b0d12,
    sunPos: [-80, 110, -70], sunColor: 0x9db8e8, sunInt: 0.22,
    hemiSky: 0x1e293b, hemiGround: 0x0f172a, hemiInt: 0.22, envInt: 0.5, interiorMul: 1.85, exposure: 1.05,
  },
};

/** Toilet + bathroom footprints [x1, z1, x2, z2] in feet, one per house plus the guest room. */
export const BATHROOMS: readonly (readonly [number, number, number, number])[] = [
  [87, 22, 93, 27.5], // House 1
  [10, 51, 16, 56.5], // House 2
  [36, 0, 42, 6.5], // House 3
  [16.5, 0, 22.5, 6.5], // House 4
  [52.5, 82, 58.5, 88], // Guest room
];
