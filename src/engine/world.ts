import * as THREE from 'three';
import { EXT_T, INT_T, WALL_H } from './constants';
import { createTextures, makeCanvasTex } from './textures';

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface InteriorLight {
  light: THREE.PointLight;
  baseIntensity: number;
}

export interface Floor {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  top: number;
}

export interface World {
  roofGroup: THREE.Group;
  dimsGroup: THREE.Group;
  colliders: Collider[];
  interiorLights: InteriorLight[];
  ceilingFans: THREE.Group[];
  /** Walkable floor slabs (houses, road, lawn, lane) with their top height in feet. */
  floors: Floor[];
}

interface Opening {
  offset: number;
  width: number;
  type: 'door' | 'window' | 'arch';
  glass?: boolean;
  swing?: number;
  leaf?: boolean;
  doorMat?: THREE.Material;
}

type Parent = THREE.Object3D;

/**
 * Builds the full 1:1-feet site — 2 roads, central courtyard and 4 houses with
 * real-scale furniture — into `scene`.
 */
export function buildWorld(scene: THREE.Scene): World {
  const tex = createTextures();
  const colliders: Collider[] = [];
  const interiorLights: InteriorLight[] = [];
  const ceilingFans: THREE.Group[] = [];
  const floors: Floor[] = [];

  // ---------------------------------------------------------------------------
  // Materials — distinct palette for each of the 4 brothers' houses
  // ---------------------------------------------------------------------------
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);

  // Exterior plaster gets a fine bump so walls catch light like real sand-faced render.
  const plaster = (color: number) =>
    std({ map: tex.stucco, color, roughness: 0.86, bumpMap: tex.bumpNoise, bumpScale: 0.012 });
  const paint = (color: number) => std({ color, roughness: 0.9, bumpMap: tex.bumpNoise, bumpScale: 0.004 });

  const matH1Ext = plaster(0xfaf0eb);
  const matH1Int = paint(0xfdf7f4);
  const matH1Accent = std({ color: 0xb8523d, roughness: 0.6 });

  const matH2Ext = plaster(0xedf6ee);
  const matH2Int = paint(0xf5fbf6);

  const matH3Ext = plaster(0xeef5fc);
  const matH3Int = paint(0xf6fafe);
  const matH3Accent = std({ color: 0x2c4c70, roughness: 0.55 });

  const matH4Ext = plaster(0xf7ecd9);
  const matH4Int = paint(0xfcf6ec);

  const matDarkFrame = std({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 });
  const matWoodDoor = std({ map: tex.wood, color: 0x9a6a44, roughness: 0.55 });
  const matPvcDoor = std({ color: 0xe9ecef, roughness: 0.45 });
  // Clear float glass: mostly reflection of the sky, slightly tinted.
  const matGlass = std({
    color: 0xa9c4d6, roughness: 0.04, metalness: 0.4, transparent: true, opacity: 0.32, envMapIntensity: 2.2,
  });
  const matCeiling = std({ color: 0xfafaf9, roughness: 0.9 });
  // One flat roof colour per house (muted version of each house's theme)
  const ROOF_COLORS = {
    h1: 0xb5654b, // terracotta
    h2: 0x5c8c77, // sage green
    h3: 0x5f80aa, // slate blue
    h4: 0xc0965c, // sandstone
    guest: 0x8f7fc0, // lavender
  };
  const matRoofDivider = std({ color: 0x2f3542, roughness: 0.7 });
  const matTeak = std({ color: 0x6b4226, roughness: 0.55 });
  const matWalnut = std({ color: 0x4a2e1b, roughness: 0.5 });
  const matCreamFabric = std({ color: 0xf1ece1, roughness: 0.9 });
  const matGranite = std({ color: 0x1e293b, roughness: 0.2, metalness: 0.25 });
  const matSteel = std({ color: 0xd4d8dd, roughness: 0.18, metalness: 0.95 });
  const matPorcelain = std({ color: 0xfbfbfa, roughness: 0.12, envMapIntensity: 1.3 });
  const matMirror = std({ color: 0xffffff, roughness: 0.02, metalness: 1.0, envMapIntensity: 1.6 });
  const matShowerGlass = std({
    color: 0xd6e6ee, roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.22, envMapIntensity: 2,
  });
  const matLightPanel = std({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.0, roughness: 0.4 });
  const matScreen = std({ color: 0x090d16, roughness: 0.15, metalness: 0.5 });
  const leafMats = [
    std({ color: 0x2d6a32, roughness: 0.85 }),
    std({ color: 0x3b7d3c, roughness: 0.85 }),
    std({ color: 0x4c9142, roughness: 0.85 }),
  ];

  // ---------------------------------------------------------------------------
  // Ground: bare earth with dry grass patches around the plot
  // ---------------------------------------------------------------------------
  const basePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1800, 1800),
    std({ map: tex.soil, roughness: 0.97, bumpMap: tex.soil, bumpScale: 0.03, envMapIntensity: 0.4 }),
  );
  basePlane.rotation.x = -Math.PI / 2;
  basePlane.position.set(50, -0.05, 53);
  basePlane.receiveShadow = true;
  scene.add(basePlane);

  // ---------------------------------------------------------------------------
  // Primitive helpers
  // ---------------------------------------------------------------------------
  /** Ceiling light: a point light plus the visible flush-mount fitting it comes from. */
  function addWarmLight(x: number, y: number, z: number, color: number, intensity: number, distance: number) {
    const pl = new THREE.PointLight(color, intensity, distance, 1.6);
    pl.position.set(x, y, z);
    scene.add(pl);
    interiorLights.push({ light: pl, baseIntensity: intensity });
    const fitting = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 24), matLightPanel);
    fitting.position.set(x, WALL_H - 0.36, z);
    roofGroup.add(fitting); // hidden with the ceiling in roof-cutaway mode
  }

  function addBox(
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    mat: THREE.Material, parent: Parent = scene,
    castShadow = true, receiveShadow = true,
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = castShadow;
    m.receiveShadow = receiveShadow;
    parent.add(m);
    return m;
  }

  function buildWall(
    x1: number, z1: number, x2: number, z2: number,
    thickness: number, mat: THREE.Material,
    openings: Opening[] = [], parent: Parent = scene, wallH = WALL_H,
  ) {
    const isHoriz = Math.abs(z2 - z1) < 0.01;
    const len = isHoriz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const startX = Math.min(x1, x2);
    const startZ = Math.min(z1, z2);
    const sorted = [...openings].sort((a, b) => a.offset - b.offset);
    let cursor = 0;

    function emitSolid(from: number, to: number, yBot: number, yTop: number, addCol: boolean) {
      const segLen = to - from;
      if (segLen <= 0.05) return;
      const h = yTop - yBot;
      const cx = isHoriz ? startX + from + segLen / 2 : startX;
      const cz = isHoriz ? startZ : startZ + from + segLen / 2;
      const w = isHoriz ? segLen : thickness;
      const d = isHoriz ? thickness : segLen;
      addBox(w, h, d, cx, yBot + h / 2, cz, mat, parent, true, true);
      if (addCol) colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    }

    for (const op of sorted) {
      const oStart = Math.max(cursor, op.offset);
      const oEnd = Math.min(len, op.offset + op.width);
      if (oStart > cursor) emitSolid(cursor, oStart, 0, wallH, true);

      const cx = isHoriz ? startX + (oStart + oEnd) / 2 : startX;
      const cz = isHoriz ? startZ : startZ + (oStart + oEnd) / 2;
      const ow = oEnd - oStart;

      if (op.type === 'door' || op.type === 'arch') {
        const doorH = op.type === 'arch' ? 7.8 : 7.0; // Real 7 ft door height
        emitSolid(oStart, oEnd, doorH, wallH, false);
        const fT = 0.2, fD = thickness + 0.14;
        if (isHoriz) {
          addBox(fT, doorH, fD, startX + oStart + fT / 2, doorH / 2, startZ, matDarkFrame, parent);
          addBox(fT, doorH, fD, startX + oEnd - fT / 2, doorH / 2, startZ, matDarkFrame, parent);
          addBox(ow, fT, fD, cx, doorH - fT / 2, startZ, matDarkFrame, parent);
        } else {
          addBox(fD, doorH, fT, startX, doorH / 2, startZ + oStart + fT / 2, matDarkFrame, parent);
          addBox(fD, doorH, fT, startX, doorH / 2, startZ + oEnd - fT / 2, matDarkFrame, parent);
          addBox(fD, fT, ow, startX, doorH - fT / 2, cz, matDarkFrame, parent);
        }
        if (op.type === 'door' && op.leaf !== false) {
          const leafW = Math.min(ow * 0.85, 2.8);
          const pivot = new THREE.Group();
          const doorMat = op.glass ? matGlass : op.doorMat ?? matWoodDoor;
          if (isHoriz) {
            pivot.position.set(startX + oStart + 0.2, 0, startZ);
            const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, doorH - 0.18, 0.14), doorMat);
            leaf.position.set(leafW / 2, (doorH - 0.18) / 2, 0);
            leaf.castShadow = true;
            pivot.add(leaf);
            for (const side of [-0.13, 0.13]) addBox(0.5, 0.07, 0.07, leafW - 0.45, 3.4, side, matSteel, pivot, false, false);
            pivot.rotation.y = op.swing || 1.25;
          } else {
            pivot.position.set(startX, 0, startZ + oStart + 0.2);
            const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.14, doorH - 0.18, leafW), doorMat);
            leaf.position.set(0, (doorH - 0.18) / 2, leafW / 2);
            leaf.castShadow = true;
            pivot.add(leaf);
            for (const side of [-0.13, 0.13]) addBox(0.07, 0.07, 0.5, side, 3.4, leafW - 0.45, matSteel, pivot, false, false);
            pivot.rotation.y = op.swing || -1.25;
          }
          parent.add(pivot);
        }
      } else if (op.type === 'window') {
        const sill = 3.0, lintel = 7.5; // Real 4.5 ft tall window
        emitSolid(oStart, oEnd, 0, sill, true);
        emitSolid(oStart, oEnd, lintel, wallH, false);
        const winH = lintel - sill, winY = sill + winH / 2, fD = thickness + 0.18;
        if (isHoriz) {
          addBox(ow, 0.18, fD, cx, sill + 0.09, startZ, matDarkFrame, parent);
          addBox(ow, 0.18, fD, cx, lintel - 0.09, startZ, matDarkFrame, parent);
          addBox(0.18, winH, fD, startX + oStart + 0.09, winY, startZ, matDarkFrame, parent);
          addBox(0.18, winH, fD, startX + oEnd - 0.09, winY, startZ, matDarkFrame, parent);
          addBox(0.1, winH, 0.2, cx, winY, startZ, matDarkFrame, parent);
          addBox(ow - 0.28, winH - 0.28, 0.06, cx, winY, startZ, matGlass, parent, false, false);
        } else {
          addBox(fD, 0.18, ow, startX, sill + 0.09, cz, matDarkFrame, parent);
          addBox(fD, 0.18, ow, startX, lintel - 0.09, cz, matDarkFrame, parent);
          addBox(fD, winH, 0.18, startX, winY, startZ + oStart + 0.09, matDarkFrame, parent);
          addBox(fD, winH, 0.18, startX, winY, startZ + oEnd - 0.09, matDarkFrame, parent);
          addBox(0.2, winH, 0.1, startX, winY, cz, matDarkFrame, parent);
          addBox(0.06, winH - 0.28, ow - 0.28, startX, winY, cz, matGlass, parent, false, false);
        }
      }
      cursor = oEnd;
    }
    if (cursor < len) emitSolid(cursor, len, 0, wallH, true);
  }

  // ---------------------------------------------------------------------------
  // The 2 raste (roads) & central green courtyard
  // ---------------------------------------------------------------------------
  const siteGroup = new THREE.Group();
  scene.add(siteGroup);

  function addSlab(x1: number, z1: number, x2: number, z2: number, mat: THREE.Material, yTop = 0.4, parent: Parent = siteGroup) {
    const w = x2 - x1, d = z2 - z1;
    addBox(w, yTop, d, x1 + w / 2, yTop / 2, z1 + d / 2, mat, parent, false, true);
    floors.push({ x1, z1, x2, z2, top: yTop });
  }

  // 1) Bada Rasta (main wide road, south-east)
  const matRoad = std({ map: tex.roadAsphalt, roughness: 0.88 });
  const matCurb = std({ color: 0xcbd5e1, roughness: 0.75 });
  const matLaneMark = std({ color: 0xf8fafc, roughness: 0.5 });

  addSlab(58.5, 68, 75, 107, matRoad, 0.22);

  addBox(0.55, 0.4, 19, 58.78, 0.2, 97.5, matCurb, siteGroup);
  addBox(0.55, 0.4, 39, 74.72, 0.2, 87.5, matCurb, siteGroup);
  for (let lz = 72; lz <= 103; lz += 6.5) {
    addBox(0.4, 0.04, 3.0, 66.75, 0.24, lz, matLaneMark, siteGroup, false, false);
  }

  // 2) Chota Patla Rasta (narrow side lane — 30 × 6.5 ft, x=0..6.5, z=77..107)
  //    Part of House 2: full-height side walls + green roof (added in the House 2 section)
  const matSmallRoad = std({ map: tex.paverLane, roughness: 0.82 });
  addSlab(0, 77, 6.5, 107, matSmallRoad, 0.24);
  buildWall(0, 77, 0, 107, 0.55, matH2Ext, [], siteGroup);
  buildWall(6.5, 77, 6.5, 107, 0.55, matH2Ext, [], siteGroup);

  // 3) Central green courtyard
  const matLawn = std({ map: tex.courtyardGrass, roughness: 0.92 });
  addSlab(22.5, 34, 64, 51, matLawn, 0.16);
  addSlab(40, 51, 64, 68, matLawn, 0.16);
  addSlab(64, 45, 75, 68, matLawn, 0.16);
  buildWall(75, 45, 75, 68, 0.65, matH1Ext, [], siteGroup, 6.0);

  // Stone walkways connecting Bada Rasta to all 4 houses' main doors
  const matPath = std({ color: 0xe2dcd2, roughness: 0.8 });
  addBox(4.5, 0.07, 22, 54, 0.18, 57, matPath, siteGroup, false, true);
  addBox(38, 0.07, 3.6, 43, 0.18, 41, matPath, siteGroup, false, true);
  addBox(3.6, 0.07, 11, 29, 0.18, 45.5, matPath, siteGroup, false, true);

  // Shrubs & small blossoms
  const flowerColors = [0xfef08a, 0xffffff, 0xf9a8d4];
  const shrubs: [number, number][] = [[24.8, 48.5], [42.5, 56.5], [61.5, 44.5], [61.5, 47.5], [71.8, 64.5]];
  shrubs.forEach(([bx, bz], i) => {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 1), leafMats[i % leafMats.length]);
    b.position.set(bx, 1.0, bz);
    b.scale.y = 0.75;
    b.castShadow = true;
    siteGroup.add(b);
  });
  const flowers: [number, number][] = [[47, 51], [48.2, 52], [53, 58], [54.2, 57]];
  flowers.forEach(([fx, fz], i) => {
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 6, 6),
      new THREE.MeshBasicMaterial({ color: flowerColors[i % flowerColors.length] }),
    );
    f.position.set(fx, 0.32, fz);
    siteGroup.add(f);
  });

  // ---------------------------------------------------------------------------
  // True 1:1 real-world feet furniture factory
  //   Double bed 6.0 × 6.5 ft | 3-seater sofa 6.5 × 2.8 ft | 2-seater 4.8 × 2.8 ft
  //   6-seater dining 5.5 × 3.2 ft | kitchen counter 2.0 ft deep × 2.8 ft high
  //   Wardrobe 6.0 × 2.0 × 7.0 ft | ceiling fan 4.0 ft dia
  // ---------------------------------------------------------------------------
  const furnGroup = new THREE.Group();
  const roofGroup = new THREE.Group();
  const dimsGroup = new THREE.Group();
  scene.add(furnGroup, roofGroup, dimsGroup);

  function furniture(x: number, z: number, rotY: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0.4, z);
    g.rotation.y = rotY;
    furnGroup.add(g);
    return g;
  }

  function addCeilingFan(x: number, z: number, h = WALL_H) {
    const g = new THREE.Group();
    g.position.set(x, h - 1.0, z);
    addBox(0.16, 0.9, 0.16, 0, 0.45, 0, matDarkFrame, g);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.22, 12), matDarkFrame));
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 0.34), matTeak);
      const a = (i * Math.PI * 2) / 3;
      b.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
      b.rotation.y = -a;
      g.add(b);
    }
    roofGroup.add(g);
    ceilingFans.push(g);
  }

  function addDoubleBed(x: number, z: number, rotY = 0, duvetColor = 0x3b82f6) {
    const g = furniture(x, z, rotY);
    addBox(6.0, 0.95, 6.5, 0, 0.48, 0, matWalnut, g); // Frame
    addBox(5.8, 0.65, 6.3, 0, 1.28, 0, matCreamFabric, g); // Mattress
    addBox(5.9, 0.22, 4.2, 0, 1.66, 0.95, std({ color: duvetColor, roughness: 0.85 }), g); // Duvet
    addBox(6.1, 3.4, 0.32, 0, 1.7, -3.2, matTeak, g); // Headboard
    addBox(2.1, 0.35, 1.3, -1.35, 1.75, -2.2, matCreamFabric, g); // Pillows
    addBox(2.1, 0.35, 1.3, 1.35, 1.75, -2.2, matCreamFabric, g);
    for (const sx of [-3.95, 3.95]) {
      addBox(1.5, 1.7, 1.5, sx, 0.85, -2.35, matTeak, g); // Side tables
      addBox(0.65, 0.7, 0.65, sx, 2.15, -2.35, std({ color: 0xfef3c7, emissive: 0xf59e0b, emissiveIntensity: 0.35 }), g);
    }
  }

  function addSofa(x: number, z: number, len = 6.5, rotY = 0, color = 0x334155) {
    const g = furniture(x, z, rotY);
    const m = std({ color, roughness: 0.85 });
    addBox(len, 1.15, 2.8, 0, 0.75, 0, m, g);
    addBox(len, 1.8, 0.55, 0, 1.7, -1.12, m, g);
    addBox(0.55, 1.55, 2.8, -len / 2 + 0.28, 1.15, 0, m, g);
    addBox(0.55, 1.55, 2.8, len / 2 - 0.28, 1.15, 0, m, g);
  }

  function addCoffeeTable(x: number, z: number, rotY = 0) {
    const g = furniture(x, z, rotY);
    addBox(3.5, 0.16, 2.0, 0, 1.32, 0, matTeak, g);
    for (const lx of [-1.5, 1.5]) {
      for (const lz of [-0.75, 0.75]) addBox(0.18, 1.25, 0.18, lx, 0.62, lz, matDarkFrame, g);
    }
  }

  function addDiningSet(x: number, z: number, rotY = 0) {
    const g = furniture(x, z, rotY);
    addBox(5.5, 0.22, 3.2, 0, 2.45, 0, matTeak, g);
    for (const lx of [-2.4, 2.4]) {
      for (const lz of [-1.25, 1.25]) addBox(0.22, 2.35, 0.22, lx, 1.18, lz, matWalnut, g);
    }
    for (const cx of [-1.75, 0, 1.75]) {
      addBox(1.4, 0.18, 1.4, cx, 1.45, -2.05, matCreamFabric, g); // North chairs
      addBox(1.4, 1.45, 0.18, cx, 2.2, -2.68, matTeak, g);
      addBox(1.4, 0.18, 1.4, cx, 1.45, 2.05, matCreamFabric, g); // South chairs
      addBox(1.4, 1.45, 0.18, cx, 2.2, 2.68, matTeak, g);
    }
  }

  function addWardrobe(x: number, z: number, rotY = 0, width = 6.0) {
    const g = furniture(x, z, rotY);
    addBox(width, 7.0, 2.0, 0, 3.5, 0, matWalnut, g);
    addBox(0.08, 6.6, 0.08, 0, 3.5, 1.02, matSteel, g);
  }

  function addStudyDesk(x: number, z: number, rotY = 0) {
    const g = furniture(x, z, rotY);
    addBox(4.0, 0.16, 2.0, 0, 2.45, 0, matTeak, g);
    addBox(0.18, 2.4, 1.8, -1.85, 1.2, 0, matDarkFrame, g);
    addBox(0.18, 2.4, 1.8, 1.85, 1.2, 0, matDarkFrame, g);
    addBox(1.5, 1.4, 1.5, 0, 0.85, 1.65, matDarkFrame, g);
  }

  function addTVWall(x: number, z: number, rotY = 0) {
    const g = furniture(x, z, rotY);
    addBox(5.5, 1.6, 1.4, 0, 0.8, 0, matWalnut, g);
    addBox(4.2, 2.4, 0.16, 0, 3.6, -0.45, matScreen, g);
  }

  function addKitchenUnit(x: number, z: number, length = 8.0, rotY = 0) {
    const g = furniture(x, z, rotY);
    addBox(length, 2.8, 2.0, 0, 1.4, 0, matGranite, g);
    addBox(1.8, 0.1, 1.3, -length * 0.25, 2.84, 0, matSteel, g); // Sink
    addBox(2.2, 0.1, 1.4, length * 0.2, 2.84, 0, matDarkFrame, g); // 4-burner hob
    addBox(length, 2.2, 1.2, 0, 6.6, -0.4, matTeak, g); // Upper cabinets
    addBox(2.2, 5.6, 2.2, length / 2 + 1.3, 2.8, 0.1, matSteel, g); // Fridge
  }

  /**
   * Plain flat RCC roof: one single-colour slab resting on the walls with a
   * small overhang, plus the interior ceiling. Pass `{ east: false }` etc. to
   * drop the overhang on a side where the roof meets a neighbour's roof.
   */
  const ROOF_T = 0.6;
  const ROOF_OVERHANG = 0.5;
  function addFlatRoof(
    x1: number, z1: number, x2: number, z2: number,
    color: number,
    overhang: Partial<Record<'north' | 'south' | 'east' | 'west', boolean>> = {},
  ) {
    const oh = (side: keyof typeof overhang) => (overhang[side] === false ? 0 : ROOF_OVERHANG);
    addBox(x2 - x1, 0.3, z2 - z1, (x1 + x2) / 2, WALL_H - 0.15, (z1 + z2) / 2, matCeiling, roofGroup, false, false);
    const rx1 = x1 - oh('west'), rx2 = x2 + oh('east');
    const rz1 = z1 - oh('north'), rz2 = z2 + oh('south');
    const mat = std({ map: tex.concrete, color, roughness: 0.88, bumpMap: tex.bumpNoise, bumpScale: 0.003 });
    addBox(rx2 - rx1, ROOF_T, rz2 - rz1, (rx1 + rx2) / 2, WALL_H + ROOF_T / 2, (rz1 + rz2) / 2, mat, roofGroup);
  }

  /** Raised dark strip on the roof along the boundary line between two brothers' houses. */
  const DIVIDER_W = 0.6;
  const DIVIDER_H = 0.45;
  function addRoofDivider(x1: number, z1: number, x2: number, z2: number) {
    const isHoriz = Math.abs(z2 - z1) < 0.01;
    const len = isHoriz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    addBox(
      isHoriz ? len : DIVIDER_W, DIVIDER_H, isHoriz ? DIVIDER_W : len,
      (x1 + x2) / 2, WALL_H + ROOF_T + DIVIDER_H / 2, (z1 + z2) / 2,
      matRoofDivider, roofGroup,
    );
  }

  // ---------------------------------------------------------------------------
  // Toilet + bathroom: western WC, shower with glass partition and geyser,
  // washbasin vanity with mirror, 7 ft wall tiles, anti-skid floor, light.
  //
  // Laid out in a local frame anchored on the back wall: u runs along the back
  // wall (left → right as seen from the door), v runs from the back wall toward
  // the door, which is always on the front wall.
  //   back wall:  [ WC ]............[ shower ]
  //   left wall:  basin + mirror near the door
  // ---------------------------------------------------------------------------
  type Side = 'north' | 'south' | 'east' | 'west';
  const BATH_FRAME: Record<Side, { rot: number; left: Side; right: Side; front: Side }> = {
    north: { rot: 0, left: 'west', right: 'east', front: 'south' },
    south: { rot: Math.PI, left: 'east', right: 'west', front: 'north' },
    west: { rot: Math.PI / 2, left: 'south', right: 'north', front: 'east' },
    east: { rot: -Math.PI / 2, left: 'north', right: 'south', front: 'west' },
  };

  /** Clones a 4 ft tile texture so it repeats at true scale over a w × h ft surface. */
  function tiledMat(base: THREE.Texture, w: number, h: number, params: THREE.MeshStandardMaterialParameters) {
    const t = base.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 4, h / 4);
    return std({ ...params, map: t });
  }

  function addBathroom(b: {
    x1: number; z1: number; x2: number; z2: number;
    /** Wall the WC and shower stand against (the door is on the opposite wall). */
    back: Side;
    /** Thickness of each surrounding wall, so fittings sit flush on the inner faces. */
    walls: Record<Side, number>;
  }) {
    const f = BATH_FRAME[b.back];
    const alongX = b.back === 'north' || b.back === 'south';
    const W = alongX ? b.x2 - b.x1 : b.z2 - b.z1;
    const D = alongX ? b.z2 - b.z1 : b.x2 - b.x1;
    const cx = (b.x1 + b.x2) / 2, cz = (b.z1 + b.z2) / 2;

    const g = new THREE.Group();
    g.rotation.y = f.rot;
    g.position.set(
      b.back === 'west' ? b.x1 : b.back === 'east' ? b.x2 : cx,
      0.4,
      b.back === 'north' ? b.z1 : b.back === 'south' ? b.z2 : cz,
    );
    furnGroup.add(g);

    const v0 = b.walls[b.back] / 2, vF = D - b.walls[f.front] / 2;
    const uL = -W / 2 + b.walls[f.left] / 2, uR = W / 2 - b.walls[f.right] / 2;
    const iw = uR - uL, id = vF - v0, uMid = (uL + uR) / 2, vMid = (v0 + vF) / 2;
    const box = (w: number, h: number, d: number, u: number, y: number, v: number, m: THREE.Material, cast = true) =>
      addBox(w, h, d, u, y, v, m, g, cast, true);
    const cyl = (rt: number, rb: number, h: number, u: number, y: number, v: number, m: THREE.Material, sz = 1) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 24), m);
      mesh.position.set(u, y, v);
      mesh.scale.z = sz;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };

    // Floor + wall tiles (7 ft dado) on the back and side walls
    const TILE_H = 7, TT = 0.04;
    box(iw, 0.04, id, uMid, 0.02, vMid, tiledMat(tex.bathFloorTile, iw, id, { roughness: 0.7 }), false);
    box(iw, TILE_H, TT, uMid, TILE_H / 2, v0 + TT / 2, tiledMat(tex.bathWallTile, iw, TILE_H, { roughness: 0.18 }), false);
    const sideTile = tiledMat(tex.bathWallTile, id, TILE_H, { roughness: 0.18 });
    box(TT, TILE_H, id, uL + TT / 2, TILE_H / 2, vMid, sideTile, false);
    box(TT, TILE_H, id, uR - TT / 2, TILE_H / 2, vMid, sideTile, false);

    // Shower corner (right end of the back wall)
    const showerW = Math.min(3, iw - 2.6);
    const sU = uR - showerW / 2, sDepth = 3;
    box(showerW, 0.12, sDepth, sU, 0.06, v0 + sDepth / 2, std({ color: 0xdfe4e7, roughness: 0.5 }), false);
    cyl(0.12, 0.12, 0.02, sU, 0.13, v0 + 1.5, matDarkFrame); // floor drain
    const glass = new THREE.Mesh(new THREE.BoxGeometry(TT, 6.4, sDepth - 0.3), matShowerGlass);
    glass.position.set(uR - showerW, 0.12 + 3.2, v0 + (sDepth - 0.3) / 2);
    g.add(glass);
    box(0.06, 0.06, sDepth - 0.3, uR - showerW, 6.35, v0 + (sDepth - 0.3) / 2, matSteel, false); // glass top rail
    cyl(0.05, 0.05, 3.4, sU, 4.9, v0 + TT + 0.08, matSteel); // riser pipe
    box(0.07, 0.07, 0.6, sU, 6.6, v0 + 0.4, matSteel, false); // shower arm
    cyl(0.33, 0.33, 0.06, sU, 6.56, v0 + 0.7, matSteel); // rain head
    box(0.45, 0.32, 0.12, sU, 3.6, v0 + TT + 0.06, matSteel); // mixer
    cyl(0.55, 0.55, 1.5, sU, 8.35, v0 + 0.62, matPorcelain); // geyser
    cyl(0.08, 0.08, 0.04, sU, 8.35, v0 + 1.18, matDarkFrame).rotation.x = Math.PI / 2; // geyser dial

    // Western WC (left end of the back wall)
    const wcU = uL + 1.2;
    box(1.5, 1.35, 0.55, wcU, 2.08, v0 + TT + 0.3, matPorcelain); // cistern
    cyl(0.1, 0.1, 0.04, wcU, 2.78, v0 + 0.35, matSteel); // flush button
    box(0.55, 0.45, 0.5, wcU, 1.1, v0 + 0.65, matPorcelain); // trap
    cyl(0.62, 0.42, 1.3, wcU, 0.65, v0 + 1.4, matPorcelain, 1.25); // bowl
    cyl(0.66, 0.66, 0.08, wcU, 1.34, v0 + 1.4, matPorcelain, 1.25); // seat
    box(0.12, 0.12, 0.35, wcU - 1.0, 2.9, v0 + 0.25, matSteel, false); // health-faucet holder

    // Washbasin vanity + mirror (left wall, near the door)
    const bv = vF - 1.2;
    box(1.55, 2.5, 2.0, uL + TT + 0.78, 1.25, bv, matTeak); // vanity cabinet
    box(1.7, 0.1, 2.15, uL + TT + 0.85, 2.55, bv, matGranite); // counter
    cyl(0.48, 0.36, 0.24, uL + TT + 0.85, 2.72, bv, matPorcelain); // basin bowl
    box(0.08, 0.36, 0.08, uL + TT + 0.25, 2.78, bv, matSteel, false); // tap body
    box(0.36, 0.06, 0.06, uL + TT + 0.42, 2.94, bv, matSteel, false); // spout
    box(0.04, 2.3, 1.9, uL + TT + 0.03, 4.55, bv, matMirror, false); // mirror

    // Towel rail + towel on the right wall, outside the shower
    if (id - sDepth > 1.6) {
      const tv = v0 + sDepth + (id - sDepth) / 2;
      box(0.1, 0.06, 1.5, uR - TT - 0.12, 4.7, tv, matSteel, false);
      box(0.05, 1.5, 1.1, uR - TT - 0.16, 4.0, tv, std({ color: 0x5b8fb9, roughness: 0.95 }), false);
    }

    // Exhaust fan above the WC + ceiling light
    box(0.9, 0.9, 0.12, wcU, 8.5, v0 + TT + 0.06, std({ color: 0xcfd4d8, roughness: 0.5 }), false);
    addWarmLight(cx, 9.4, cz, 0xf3f6ff, 0.4, 12);
  }

  function addRug(x: number, z: number, w: number, d: number, color: number) {
    addBox(w, 0.04, d, x, 0.42, z, std({ color, roughness: 0.95 }), furnGroup, false, true);
  }

  function addHouseSign(text: string, x: number, y: number, z: number, rotY: number, bgHex: string) {
    const signTex = makeCanvasTex(256, 76, (ctx, w, h) => {
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.5, 0.2), std({ map: signTex, roughness: 0.5 }));
    sign.position.set(x, y, z);
    sign.rotation.y = rotY;
    siteGroup.add(sign);
  }

  function addDimBadge(text: string, x: number, y: number, z: number) {
    const badgeTex = makeCanvasTex(256, 72, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(4, 4, w - 8, h - 8);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 30px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex, transparent: true }));
    sp.position.set(x, y, z);
    sp.scale.set(9.5, 2.7, 1);
    dimsGroup.add(sp);
  }

  addDimBadge('22.5 ft (H4)', 11.25, 15.8, -2.5);
  addDimBadge('19.5 ft (H3)', 32.25, 14.5, -2.5);
  addDimBadge('51 ft', -4.2, 13.5, 25.5);
  addDimBadge('26 ft', -4.2, 13.5, 64);
  addDimBadge('40 ft (H2)', 20, 13.8, 79.5);
  addDimBadge('30 × 6.5 ft', -4.2, 13.5, 92);
  addDimBadge('39 ft (H1)', 83.5, 14.5, 19.5);
  addDimBadge('23 ft', 107.2, 13.5, 33.5);
  addDimBadge('BADA RASTA', 66.5, 5.5, 94);

  // ===========================================================================
  // HOUSE 1 — Brother 1 (39 × 23 ft = 897 sq ft | x: 64..103, z: 22..45)
  // 2BHK modern minimalist terracotta villa
  // ===========================================================================
  addSlab(64, 22, 103, 45, std({ map: tex.warmTile, roughness: 0.4 }), 0.4);

  buildWall(64, 22, 103, 22, EXT_T, matH1Ext, [], siteGroup);
  buildWall(103, 22, 103, 45, EXT_T, matH1Ext, [], siteGroup);
  buildWall(64, 45, 103, 45, EXT_T, matH1Ext, [
    { offset: 3.5, width: 4.5, type: 'door', glass: true, swing: 1.2 },
  ], siteGroup);
  buildWall(64, 22, 64, 34, EXT_T, matH1Ext, [], siteGroup); // Solid dividing wall with House 3
  buildWall(64, 34, 64, 45, EXT_T, matH1Ext, [{ offset: 3.0, width: 4.5, type: 'door', glass: true, swing: -1.2 }], siteGroup);

  // 10 ft wooden louver screen at x=74, z=22..32
  for (let sz = 22.8; sz <= 31.6; sz += 1.0) {
    addBox(0.28, WALL_H - 0.4, 0.22, 74, (WALL_H - 0.4) / 2, sz, matH1Accent, siteGroup);
  }
  colliders.push({ minX: 73.7, maxX: 74.3, minZ: 22, maxZ: 32 });
  // Bedroom wall at x=87 with doors into master bed & bed 2
  buildWall(87, 22, 87, 45, INT_T, matH1Int, [
    { offset: 6.5, width: 3.4, type: 'door', swing: 1.2 },
    { offset: 13.5, width: 3.4, type: 'door', swing: -1.2 },
  ], siteGroup);
  buildWall(87, 33.5, 103, 33.5, INT_T, matH1Int, [], siteGroup);
  // Attached toilet + bath in the master bedroom's north-west corner (6 × 5.5 ft)
  buildWall(93, 22, 93, 27.5, INT_T, matH1Int, [], siteGroup);
  buildWall(87, 27.5, 93, 27.5, INT_T, matH1Int, [
    { offset: 2.8, width: 2.6, type: 'door', swing: -1.2, doorMat: matPvcDoor },
  ], siteGroup);
  addBathroom({ x1: 87, z1: 22, x2: 93, z2: 27.5, back: 'north', walls: { north: EXT_T, south: INT_T, west: INT_T, east: INT_T } });

  addFlatRoof(64, 22, 103, 45, ROOF_COLORS.h1, { west: false });
  addHouseSign('HOUSE 1', 63.4, 8.9, 39.5, -Math.PI / 2, '#b8523d');

  addKitchenUnit(68.2, 23.4, 6.2, 0);
  addRug(78.5, 38.5, 8.5, 7.0, 0xfecdd3);
  addSofa(78.5, 42.2, 6.5, Math.PI, 0x7c2d12);
  addSofa(74.2, 37.8, 4.8, Math.PI / 2, 0x9a3412);
  addCoffeeTable(78.5, 38.2, 0);
  addTVWall(85.8, 38.5, -Math.PI / 2);
  addDiningSet(79.5, 27.5, 0);
  // Master bedroom (87..103, 22..33.5)
  addDoubleBed(97.0, 27.5, -Math.PI / 2, 0x9f1239);
  addWardrobe(92.2, 32.4, Math.PI, 5.5);
  // Bedroom 2 (87..103, 33.5..45)
  addDoubleBed(96.5, 39.2, -Math.PI / 2, 0xbe123c);
  addWardrobe(91.5, 43.6, Math.PI, 5.5);
  addCeilingFan(78.5, 36.5);
  addCeilingFan(95.0, 27.5);
  addCeilingFan(95.0, 39.2);
  addWarmLight(78.5, 9.2, 34, 0xffebd6, 0.7, 36);
  addWarmLight(95, 9.2, 28, 0xffebd6, 0.55, 26);
  addWarmLight(95, 9.2, 39, 0xffebd6, 0.55, 26);

  // ===========================================================================
  // HOUSE 2 — Brother 2 (40 × 26 ft = 1,040 sq ft | x: 0..40, z: 51..77)
  // 2BHK courtyard home
  // ===========================================================================
  addSlab(0, 51, 40, 77, std({ map: tex.wood, roughness: 0.58 }), 0.4);

  buildWall(0, 51, 0, 77, EXT_T, matH2Ext, [], siteGroup);
  buildWall(0, 51, 22.5, 51, EXT_T, matH2Ext, [], siteGroup); // Solid wall with House 4
  buildWall(22.5, 51, 40, 51, EXT_T, matH2Ext, [
    { offset: 2.0, width: 5.5, type: 'door', glass: true, swing: 1.2 },
    { offset: 10.5, width: 5.0, type: 'window' },
  ], siteGroup);
  buildWall(40, 51, 40, 77, EXT_T, matH2Ext, [
    { offset: 4, width: 5.5, type: 'window' },
  ], siteGroup);
  buildWall(0, 77, 40, 77, EXT_T, matH2Ext, [
    { offset: 1.2, width: 4.0, type: 'door', swing: 1.2 },
  ], siteGroup);

  buildWall(16, 51, 16, 65, INT_T, matH2Int, [{ offset: 8.5, width: 3.4, type: 'door', swing: 1.2 }], siteGroup);
  buildWall(0, 64, 16, 64, INT_T, matH2Int, [], siteGroup);
  buildWall(7, 64, 7, 77, INT_T, matH2Int, [{ offset: 1.5, width: 3.4, type: 'door', swing: -1.2 }], siteGroup);
  buildWall(7, 64, 23, 64, INT_T, matH2Int, [{ offset: 11.5, width: 3.4, type: 'door', swing: 1.2 }], siteGroup);
  buildWall(23, 64, 23, 77, INT_T, matH2Int, [], siteGroup);
  buildWall(28, 65, 28, 77, INT_T, matH2Int, [{ offset: 1.5, width: 5.5, type: 'arch', leaf: false }], siteGroup);
  // Attached toilet + bath in the master bedroom's north-east corner (6 × 5.5 ft)
  buildWall(10, 51, 10, 56.5, INT_T, matH2Int, [], siteGroup);
  buildWall(10, 56.5, 16, 56.5, INT_T, matH2Int, [
    { offset: 2.4, width: 2.6, type: 'door', swing: -1.2, doorMat: matPvcDoor },
  ], siteGroup);
  addBathroom({ x1: 10, z1: 51, x2: 16, z2: 56.5, back: 'north', walls: { north: EXT_T, south: INT_T, west: INT_T, east: INT_T } });

  addFlatRoof(0, 51, 40, 77, ROOF_COLORS.h2, { north: false, east: false });
  // Chota Rasta is House 2's covered side passage — same green roof, open at the south end
  addFlatRoof(0, 77, 6.5, 107, ROOF_COLORS.h2, { north: false });
  addHouseSign('HOUSE 2', 30, 8.9, 50.4, 0, '#1e5245');

  // Living & dining hall (x=16..40, z=51..64)
  addRug(24, 57.5, 8.5, 7.0, 0xbbf7d0);
  addSofa(24, 61.2, 6.5, Math.PI, 0x065f46);
  addSofa(19.5, 57.2, 4.8, Math.PI / 2, 0x334155);
  addCoffeeTable(24, 57.5, 0);
  addDiningSet(34.2, 57.5, 0);
  // Modular kitchen (x=28..40, z=65..77)
  addKitchenUnit(34.2, 75.6, 7.5, Math.PI);
  // Master bedroom (x=0..16, z=51..64)
  addDoubleBed(5.8, 57.5, Math.PI / 2, 0x047857);
  addWardrobe(7.0, 62.9, Math.PI, 5.5);
  addStudyDesk(12.5, 62.2, Math.PI);
  // Bedroom 2 (x=7..23, z=64..77)
  addDoubleBed(15, 72.2, Math.PI, 0x0f766e);
  addWardrobe(8.4, 70.5, Math.PI / 2, 5.5);
  addCeilingFan(24, 57.5);
  addCeilingFan(8.5, 57.5);
  addCeilingFan(15, 70.5);
  addWarmLight(26, 9.2, 58, 0xfff3db, 0.72, 38);
  addWarmLight(9, 9.2, 57.5, 0xfff3db, 0.55, 26);
  addWarmLight(15, 9.2, 70.5, 0xfff3db, 0.55, 26);
  addWarmLight(34, 9.2, 71, 0xffffff, 0.6, 24);

  // ===========================================================================
  // HOUSE 3 — Brother 3 (927 sq ft | 22.5..42 × 0..34 + 42..64 × 22..34)
  // 2BHK L-shaped urban slate-blue bungalow
  // ===========================================================================
  const h3Floor = std({ map: tex.marble, roughness: 0.28 });
  addSlab(22.5, 0, 42, 34, h3Floor, 0.4);
  addSlab(42, 22, 64, 34, h3Floor, 0.4);

  buildWall(22.5, 0, 42, 0, EXT_T, matH3Ext, [], siteGroup);
  buildWall(22.5, 0, 22.5, 34, EXT_T, matH3Ext, [], siteGroup); // Solid wall with House 4
  buildWall(42, 0, 42, 22, EXT_T, matH3Ext, [], siteGroup);
  buildWall(42, 22, 64, 22, EXT_T, matH3Ext, [], siteGroup);
  buildWall(22.5, 34, 64, 34, EXT_T, matH3Ext, [
    { offset: 6.0, width: 5.5, type: 'door', glass: true, swing: 1.2 },
    { offset: 25, width: 6.5, type: 'window' },
  ], siteGroup);

  // Partition at x=42, z=22..34 (slate columns + overhead beam)
  addBox(0.65, 1.2, 12, 42, WALL_H - 0.6, 28, matH3Accent, siteGroup);
  addBox(0.75, WALL_H, 0.75, 42, WALL_H / 2, 22.8, matH3Accent, siteGroup);
  addBox(0.75, WALL_H, 0.75, 42, WALL_H / 2, 33.2, matH3Accent, siteGroup);

  buildWall(22.5, 11.5, 42, 11.5, INT_T, matH3Int, [{ offset: 14.5, width: 3.4, type: 'door', swing: -1.2 }], siteGroup);
  buildWall(22.5, 22.5, 36.5, 22.5, INT_T, matH3Int, [], siteGroup);
  buildWall(36.5, 11.5, 36.5, 22.5, INT_T, matH3Int, [{ offset: 5.5, width: 3.4, type: 'door', swing: 1.2 }], siteGroup);
  // Attached toilet + bath in the master bedroom's north-east corner (6 × 6.5 ft)
  buildWall(36, 0, 36, 6.5, INT_T, matH3Int, [], siteGroup);
  buildWall(36, 6.5, 42, 6.5, INT_T, matH3Int, [
    { offset: 2.6, width: 2.6, type: 'door', swing: -1.2, doorMat: matPvcDoor },
  ], siteGroup);
  addBathroom({ x1: 36, z1: 0, x2: 42, z2: 6.5, back: 'north', walls: { north: EXT_T, south: INT_T, west: INT_T, east: EXT_T } });

  // L-shaped: two slabs that meet at x=42 without overlapping
  addFlatRoof(22.5, 0, 42, 34, ROOF_COLORS.h3, { east: false, west: false });
  addFlatRoof(42, 22, 64, 34, ROOF_COLORS.h3, { west: false, east: false });
  addHouseSign('HOUSE 3', 31.2, 8.9, 34.6, 0, '#2c4c70');

  // Living hall (22.5..42, 22.5..34)
  addRug(30.5, 28.2, 8.5, 6.5, 0xbfdbfe);
  addSofa(30.5, 24.4, 6.5, 0, 0x1e3a5f);
  addCoffeeTable(30.5, 28.0, 0);
  addTVWall(23.8, 28.2, Math.PI / 2);
  // East wing dining & kitchen (42..64, 22..34)
  addDiningSet(48.5, 28.0, 0);
  addKitchenUnit(58.2, 23.4, 6.5, 0);
  // Master bedroom (22.5..42, 0..11.5)
  addDoubleBed(28.5, 5.8, Math.PI / 2, 0x1d4ed8);
  addWardrobe(31, 10.4, Math.PI, 5.5);
  // Bedroom 2 (22.5..36.5, 11.5..22.5)
  addDoubleBed(27.5, 17.0, Math.PI / 2, 0x2563eb);
  addStudyDesk(33.5, 20.8, Math.PI);
  addCeilingFan(31.5, 28.2);
  addCeilingFan(52, 28);
  addCeilingFan(32, 5.8);
  addWarmLight(31.5, 9.2, 28, 0xfff4e0, 0.7, 34);
  addWarmLight(53, 9.2, 28, 0xffe8c2, 0.65, 32);
  addWarmLight(31, 9.2, 6, 0xfff4e0, 0.55, 28);

  // ===========================================================================
  // HOUSE 4 — Brother 4 (22.5 × 51 ft = 1,147 sq ft | x: 0..22.5, z: 0..51)
  // 2BHK + dining sandstone villa
  // ===========================================================================
  addSlab(0, 0, 22.5, 51, std({ map: tex.wood, color: 0xf5e9da, roughness: 0.55 }), 0.4);

  buildWall(0, 0, 22.5, 0, EXT_T, matH4Ext, [], siteGroup);
  buildWall(0, 0, 0, 51, EXT_T, matH4Ext, [], siteGroup);
  buildWall(22.5, 34, 22.5, 51, EXT_T, matH4Ext, [
    { offset: 3.5, width: 5.0, type: 'door', glass: true, swing: 1.2 },
    { offset: 11, width: 4.0, type: 'window' },
  ], siteGroup);

  buildWall(0, 12, 22.5, 12, INT_T, matH4Int, [{ offset: 17.2, width: 3.4, type: 'door', swing: -1.2 }], siteGroup);
  buildWall(0, 23.5, 16.5, 23.5, INT_T, matH4Int, [], siteGroup);
  buildWall(16.5, 12, 16.5, 23.5, INT_T, matH4Int, [{ offset: 6.5, width: 3.4, type: 'door', swing: 1.2 }], siteGroup);
  buildWall(0, 35, 10, 35, INT_T, matH4Int, [], siteGroup);
  // Attached toilet + bath in the master bedroom's north-east corner (6 × 6.5 ft)
  buildWall(16.5, 0, 16.5, 6.5, INT_T, matH4Int, [], siteGroup);
  buildWall(16.5, 6.5, 22.5, 6.5, INT_T, matH4Int, [
    { offset: 2.6, width: 2.6, type: 'door', swing: -1.2, doorMat: matPvcDoor },
  ], siteGroup);
  addBathroom({ x1: 16.5, z1: 0, x2: 22.5, z2: 6.5, back: 'north', walls: { north: EXT_T, south: INT_T, west: INT_T, east: EXT_T } });

  addFlatRoof(0, 0, 22.5, 51, ROOF_COLORS.h4, { east: false, south: false });

  // Roof dividers on every boundary where two brothers' roofs meet
  addRoofDivider(22.5, 0, 22.5, 34); // House 4 | House 3
  addRoofDivider(0, 51, 22.5, 51); // House 4 | House 2
  addRoofDivider(64, 22, 64, 34); // House 3 | House 1
  addHouseSign('HOUSE 4', 23.1, 8.9, 41.5, Math.PI / 2, '#6e472b');

  // Front living room (z=35..51)
  addRug(10.5, 43, 9.0, 7.5, 0xd6c7b2);
  addSofa(10.5, 48.2, 6.5, Math.PI, 0x57534e);
  addSofa(16.2, 44.0, 4.8, -Math.PI / 2, 0x78716c);
  addCoffeeTable(10.5, 43.2, 0);
  addTVWall(1.4, 43.0, Math.PI / 2);
  // Mid dining & kitchen (z=23.5..35)
  addKitchenUnit(1.8, 28.5, 7.2, Math.PI / 2);
  addDiningSet(14.5, 29.2, 0);
  // Bedroom 2 (x=0..16.5, z=12..23.5)
  addDoubleBed(5.8, 17.8, Math.PI / 2, 0xb45309);
  addWardrobe(12.2, 13.4, 0, 5.5);
  // Master bedroom (z=0..12)
  addDoubleBed(11.2, 4.8, 0, 0x92400e);
  addWardrobe(1.8, 6.0, Math.PI / 2, 6.0);
  addCeilingFan(11.2, 43);
  addCeilingFan(14.5, 29.2);
  addCeilingFan(11.2, 6.0);
  addWarmLight(11.2, 9.2, 43, 0xfff0d4, 0.7, 36);
  addWarmLight(12, 9.2, 29, 0xfff0d4, 0.6, 30);
  addWarmLight(11.2, 9.2, 6, 0xfff0d4, 0.6, 30);

  // ===========================================================================
  // COMMON GUEST ROOM — shared by all 4 brothers
  // (18.5 × 20 ft = 370 sq ft | x: 40..58.5, z: 68..88)
  // Built right up against House 2 so there is no gap between them.
  // ===========================================================================
  const matGuestExt = std({ map: tex.stucco, color: 0xf3eefa, roughness: 0.8 });
  addSlab(40, 68, 58.5, 88, std({ map: tex.marble, roughness: 0.3 }), 0.4);

  // North wall faces the courtyard — main door lines up with the stone walkway
  buildWall(40, 68, 58.5, 68, EXT_T, matGuestExt, [
    { offset: 2, width: 5, type: 'window' },
    { offset: 12, width: 4.5, type: 'door', glass: true, swing: 1.2 },
  ], siteGroup);
  // East wall faces Bada Rasta — side door straight onto the road
  buildWall(58.5, 68, 58.5, 88, EXT_T, matGuestExt, [
    { offset: 1.5, width: 4, type: 'door', swing: -1.2 },
    { offset: 9, width: 5, type: 'window' },
  ], siteGroup);
  // West wall: z=68..77 is House 2's east wall (shared); only z=77..88 is new
  buildWall(40, 77, 40, 88, EXT_T, matGuestExt, [], siteGroup);
  buildWall(40, 88, 58.5, 88, EXT_T, matGuestExt, [], siteGroup);
  // Attached toilet + bath in the south-east corner (6 × 6 ft)
  const matGuestInt = paint(0xf8f6fb);
  buildWall(52.5, 82, 52.5, 88, INT_T, matGuestInt, [], siteGroup);
  buildWall(52.5, 82, 58.5, 82, INT_T, matGuestInt, [
    { offset: 0.5, width: 2.6, type: 'door', swing: 1.2, doorMat: matPvcDoor },
  ], siteGroup);
  addBathroom({ x1: 52.5, z1: 82, x2: 58.5, z2: 88, back: 'south', walls: { north: INT_T, south: EXT_T, west: INT_T, east: EXT_T } });

  addFlatRoof(40, 68, 58.5, 88, ROOF_COLORS.guest, { west: false });
  addRoofDivider(40, 68, 40, 77); // House 2 | Guest Room
  addHouseSign('GUEST ROOM', 54.25, 8.9, 67.4, 0, '#5b4b8a');
  addDimBadge('18.5 × 20 ft', 49.25, 13.5, 90.5);

  // Sitting area (north half) + sleeping area (south half)
  addRug(46, 74, 7.5, 7.0, 0xddd6fe);
  addSofa(42, 74, 6.5, Math.PI / 2, 0x4c1d95);
  addCoffeeTable(45.8, 74, Math.PI / 2);
  addDoubleBed(47.5, 84.3, Math.PI, 0x6d28d9);
  addCeilingFan(49.25, 77);
  addWarmLight(49.25, 9.2, 77, 0xfff1e0, 0.65, 30);

  return { roofGroup, dimsGroup, colliders, interiorLights, ceilingFans, floors };
}
