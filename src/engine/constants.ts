// Real-world architectural scale: exactly 1.0 three.js unit = 1.0 foot.
// North = -Z (0), South = +Z (107), West = -X (0), East = +X (103).

export const WALL_H = 10.5; // Standard 10.5 ft residential ceiling height
export const EXT_T = 0.75; // 9-inch exterior brick wall
export const INT_T = 0.42; // 5-inch interior partition wall
export const EYE_H = 5.3; // Realistic human eye level (5 ft 4 in)

export type NavMode = 'orbit' | 'walk';

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
  sky: number;
  fog: number;
  sunPos: Vec3;
  sunColor: number;
  sunInt: number;
  hemiSky: number;
  hemiGround: number;
  hemiInt: number;
  interiorMul: number;
  exposure: number;
}

export const TOD_CONFIG: Record<TimeOfDay, TimeOfDayConfig> = {
  morning: {
    sky: 0xc2e2f7, fog: 0xd8ebf7, sunPos: [140, 75, 45], sunColor: 0xffe4b5, sunInt: 1.15,
    hemiSky: 0xeaf6ff, hemiGround: 0x64748b, hemiInt: 0.68, interiorMul: 0.45, exposure: 1.05,
  },
  noon: {
    sky: 0xcce6f7, fog: 0xd8ebf7, sunPos: [105, 145, 95], sunColor: 0xfff8eb, sunInt: 1.32,
    hemiSky: 0xeef7ff, hemiGround: 0x64748b, hemiInt: 0.78, interiorMul: 0.35, exposure: 1.06,
  },
  sunset: {
    sky: 0xe89774, fog: 0xe5a485, sunPos: [-115, 42, 75], sunColor: 0xff8c42, sunInt: 1.15,
    hemiSky: 0xfdba74, hemiGround: 0x3b2f2f, hemiInt: 0.55, interiorMul: 1.15, exposure: 1.02,
  },
  night: {
    sky: 0x0b132b, fog: 0x0f172a, sunPos: [-80, 110, -70], sunColor: 0x93c5fd, sunInt: 0.25,
    hemiSky: 0x1e293b, hemiGround: 0x0f172a, hemiInt: 0.38, interiorMul: 1.85, exposure: 0.98,
  },
};
