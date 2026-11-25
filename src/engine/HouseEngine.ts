import * as THREE from 'three';
import {
  AERIAL_PRESET,
  EYE_H,
  ROOM_PRESETS,
  TOD_CONFIG,
  type NavMode,
  type RoomId,
  type RoomPreset,
  type TimeOfDay,
} from './constants';
import { drawMinimap } from './minimap';
import { describeLocation, type LocationInfo } from './regions';
import { buildWorld, type World } from './world';

export type WalkDirection = 'forward' | 'backward' | 'left' | 'right';

export interface EngineCallbacks {
  onModeChange: (mode: NavMode) => void;
  onLocationChange: (info: LocationInfo) => void;
  onRoofChange: (visible: boolean) => void;
}

export interface EngineOptions {
  /** View to show on startup, applied instantly (no camera fly-in). */
  initialRoom?: RoomId;
}

interface Transition {
  t: number;
  duration: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  endQuat: THREE.Quaternion;
}

/** Camera fly time when switching views, in seconds. */
const TRANSITION_SECONDS = 0.4;

/** Free-orbit limits — wide enough to go anywhere around the site. */
const ORBIT = {
  minRadius: 2,
  maxRadius: 320,
  minPhi: 0.03, // almost straight down
  maxPhi: Math.PI / 2 - 0.02, // almost level with the ground
  panMin: { x: -80, z: -80 },
  panMax: { x: 185, z: 190 },
};

/** Walk mode can leave the plot and roam the surrounding ground. */
const WALK_BOUNDS = { minX: -60, maxX: 165, minZ: -60, maxZ: 170 };

const clamp = THREE.MathUtils.clamp;

/**
 * Owns the three.js renderer, scene, camera, navigation and input for the
 * 4-plot site. React talks to it only through the public methods and callbacks.
 */
export class HouseEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sky = new THREE.Color(0xcce6f7);
  private readonly fog = new THREE.FogExp2(0xd8ebf7, 0.0017);
  private readonly hemiLight = new THREE.HemisphereLight(0xeef7ff, 0x64748b, 0.78);
  private readonly sunLight = new THREE.DirectionalLight(0xfff7e8, 1.32);
  private readonly world: World;

  private navMode: NavMode = 'orbit';
  private roofVisible = true;
  private transition: Transition | null = null;
  private readonly orbit = {
    target: new THREE.Vector3(...AERIAL_PRESET.target),
    radius: AERIAL_PRESET.radius,
    theta: AERIAL_PRESET.theta,
    phi: AERIAL_PRESET.phi,
  };
  private readonly walk = { pos: new THREE.Vector3(50, EYE_H, 54), yaw: 0.25, pitch: 0.02, bobPhase: 0 };

  /** Active pointers (mouse / each touch finger), for drag and pinch. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private dragButton = 0;
  private readonly keys = new Set<string>();
  private readonly pad: Record<WalkDirection, boolean> = { forward: false, backward: false, left: false, right: false };

  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();
  /** Ground point grabbed by a left-drag in aerial view; null when not grabbing. */
  private grabPoint: THREE.Vector3 | null = null;

  private minimapCtx: CanvasRenderingContext2D | null = null;
  private lastRoomId = '';
  private lastTime = performance.now();
  private rafId = 0;
  private readonly cleanups: (() => void)[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: EngineCallbacks,
    options: EngineOptions = {},
  ) {
    const { scene, sunLight } = this;
    scene.background = this.sky;
    scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.35, 1600);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    container.appendChild(this.renderer.domElement);

    scene.add(this.hemiLight);
    sunLight.position.set(105, 145, 95);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const cam = sunLight.shadow.camera;
    cam.near = 20;
    cam.far = 380;
    cam.left = -110;
    cam.right = 110;
    cam.top = 110;
    cam.bottom = -110;
    sunLight.shadow.bias = -0.0005;
    sunLight.target.position.set(50, 0, 52);
    scene.add(sunLight, sunLight.target);

    this.world = buildWorld(scene);

    this.bindInput();
    this.setTimeOfDay('noon');
    this.applyPreset(ROOM_PRESETS[options.initialRoom ?? 'aerial'], true);
    this.rafId = requestAnimationFrame(this.animate);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get mode(): NavMode {
    return this.navMode;
  }

  selectRoom(id: RoomId) {
    this.applyPreset(ROOM_PRESETS[id], false);
  }

  setRoofVisible(visible: boolean) {
    this.roofVisible = visible;
    this.world.roofGroup.visible = visible;
    this.callbacks.onRoofChange(visible);
  }

  setDimsVisible(visible: boolean) {
    this.world.dimsGroup.visible = visible;
  }

  setTimeOfDay(tod: TimeOfDay) {
    const c = TOD_CONFIG[tod];
    this.sky.setHex(c.sky);
    this.fog.color.setHex(c.fog);
    this.sunLight.position.set(...c.sunPos);
    this.sunLight.color.setHex(c.sunColor);
    this.sunLight.intensity = c.sunInt;
    this.hemiLight.color.setHex(c.hemiSky);
    this.hemiLight.groundColor.setHex(c.hemiGround);
    this.hemiLight.intensity = c.hemiInt;
    this.renderer.toneMappingExposure = c.exposure;
    for (const item of this.world.interiorLights) item.light.intensity = item.baseIntensity * c.interiorMul;
  }

  setWalkDirection(dir: WalkDirection, active: boolean) {
    this.pad[dir] = active;
  }

  /** Canvas the minimap is drawn into each frame; pass null to stop drawing. */
  setMinimapCanvas(canvas: HTMLCanvasElement | null) {
    this.minimapCtx = canvas?.getContext('2d') ?? null;
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    for (const off of this.cleanups) off();
    this.cleanups.length = 0;

    const materials = new Set<THREE.Material>();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (obj as THREE.Mesh | THREE.Sprite).material;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((m) => materials.add(m));
    });
    for (const m of materials) {
      const map = (m as THREE.MeshStandardMaterial).map;
      if (map) map.dispose();
      m.dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  private applyPreset(preset: RoomPreset, instant: boolean) {
    const startPos = this.camera.position.clone();
    const startQuat = this.camera.quaternion.clone();
    let endPos: THREE.Vector3;
    let endQuat: THREE.Quaternion;

    if (preset.mode === 'walk') {
      this.navMode = 'walk';
      this.walk.pos.set(...preset.pos);
      this.walk.yaw = preset.yaw;
      this.walk.pitch = preset.pitch;
      endPos = this.walk.pos.clone();
      endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(preset.pitch, preset.yaw, 0, 'YXZ'));
      if (!this.roofVisible) this.setRoofVisible(true);
    } else {
      this.navMode = 'orbit';
      this.orbit.target.set(...preset.target);
      this.orbit.radius = preset.radius;
      this.orbit.theta = preset.theta;
      this.orbit.phi = preset.phi;
      endPos = this.computeOrbitPos();
      const dummy = this.camera.clone();
      dummy.position.copy(endPos);
      dummy.lookAt(this.orbit.target);
      endQuat = dummy.quaternion.clone();
    }
    this.transition = instant ? null : { t: 0, duration: TRANSITION_SECONDS, startPos, endPos, startQuat, endQuat };
    this.callbacks.onModeChange(this.navMode);
  }

  private computeOrbitPos() {
    const { target, radius, theta, phi } = this.orbit;
    const sinPhi = Math.sin(phi);
    return new THREE.Vector3(
      target.x + radius * sinPhi * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * sinPhi * Math.cos(theta),
    );
  }

  /**
   * Zooms the orbit camera toward/away from the ground point under the screen
   * position (clientX, clientY), like a map. factor < 1 zooms in.
   */
  private zoomAt(clientX: number, clientY: number, factor: number) {
    const { orbit } = this;
    const newRadius = clamp(orbit.radius * factor, ORBIT.minRadius, ORBIT.maxRadius);
    const k = newRadius / orbit.radius;
    if (k === 1) return;

    this.syncOrbitCamera();
    const p = this.groundPointAt(clientX, clientY, this.hit);

    // Move the target toward the point by the same fraction the camera moves,
    // so the point under the cursor stays put on screen.
    if (p && p.distanceTo(orbit.target) < ORBIT.maxRadius * 2) {
      orbit.target.x += (p.x - orbit.target.x) * (1 - k);
      orbit.target.z += (p.z - orbit.target.z) * (1 - k);
      this.clampTarget();
    }
    orbit.radius = newRadius;
  }

  /** Point on the ground plane (at the orbit target's height) under a screen position, or null above the horizon. */
  private groundPointAt(clientX: number, clientY: number, out: THREE.Vector3): THREE.Vector3 | null {
    const rect = this.container.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.groundPlane.constant = -this.orbit.target.y;
    return this.raycaster.ray.intersectPlane(this.groundPlane, out);
  }

  /** Puts the camera exactly where the orbit state says, so raycasts match what's on screen. */
  private syncOrbitCamera() {
    if (this.navMode !== 'orbit' || this.transition) return;
    this.camera.position.copy(this.computeOrbitPos());
    this.camera.lookAt(this.orbit.target);
    this.camera.updateMatrixWorld();
  }

  /**
   * Map-style drag: moves the view so the ground point grabbed at pointer-down
   * stays under the cursor. Falls back to screen-space panning above the horizon.
   */
  private dragGround(clientX: number, clientY: number, dx: number, dy: number) {
    const grab = this.grabPoint;
    const p = grab && this.groundPointAt(clientX, clientY, this.hit);
    if (grab && p && p.distanceTo(this.orbit.target) < ORBIT.maxRadius * 3) {
      this.orbit.target.x += grab.x - p.x;
      this.orbit.target.z += grab.z - p.z;
      this.clampTarget();
    } else {
      this.panOrbit(dx, dy);
    }
    this.syncOrbitCamera();
  }

  private panOrbit(dx: number, dy: number) {
    const { orbit } = this;
    const panSpeed = orbit.radius * 0.0014;
    const right = new THREE.Vector3(Math.cos(orbit.theta), 0, -Math.sin(orbit.theta));
    const fwd = new THREE.Vector3(-Math.sin(orbit.theta), 0, -Math.cos(orbit.theta));
    orbit.target.addScaledVector(right, -dx * panSpeed);
    orbit.target.addScaledVector(fwd, dy * panSpeed);
    this.clampTarget();
  }

  private clampTarget() {
    const t = this.orbit.target;
    t.x = clamp(t.x, ORBIT.panMin.x, ORBIT.panMax.x);
    t.z = clamp(t.z, ORBIT.panMin.z, ORBIT.panMax.z);
  }

  private collides(x: number, z: number, r = 0.95) {
    for (const c of this.world.colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return x < WALK_BOUNDS.minX || x > WALK_BOUNDS.maxX || z < WALK_BOUNDS.minZ || z > WALK_BOUNDS.maxZ;
  }

  private moveWalker(forwardAmt: number, strafeAmt: number) {
    const { walk } = this;
    const sinY = Math.sin(walk.yaw), cosY = Math.cos(walk.yaw);
    const dx = -sinY * forwardAmt + cosY * strafeAmt;
    const dz = -cosY * forwardAmt - sinY * strafeAmt;
    let moved = false;
    if (!this.collides(walk.pos.x + dx, walk.pos.z)) { walk.pos.x += dx; moved = true; }
    if (!this.collides(walk.pos.x, walk.pos.z + dz)) { walk.pos.z += dz; moved = true; }
    if (moved) walk.bobPhase += Math.hypot(dx, dz) * 0.65;
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window,
    type: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) {
    target.addEventListener(type, handler as EventListener, options);
    this.cleanups.push(() => target.removeEventListener(type, handler as EventListener, options));
  }

  private bindInput() {
    const el = this.container;
    const { orbit, walk, pointers } = this;

    this.listen(el, 'contextmenu', (e) => e.preventDefault());

    /** Left-drag (no modifier) in aerial view grabs the ground; anything else rotates. */
    const isRotateDrag = (e: PointerEvent) => this.dragButton !== 0 || e.shiftKey || e.ctrlKey || e.altKey;

    const startGrab = (x: number, y: number) => {
      this.syncOrbitCamera();
      this.grabPoint = this.groundPointAt(x, y, new THREE.Vector3());
    };

    this.listen(el, 'pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) this.dragButton = e.button;
      this.transition = null;
      el.setPointerCapture(e.pointerId);
      if (pointers.size === 1 && this.navMode === 'orbit' && !isRotateDrag(e)) startGrab(e.clientX, e.clientY);
      else this.grabPoint = null;
    });

    this.listen(el, 'pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };

      if (pointers.size >= 2) {
        // Two fingers: pinch to zoom (toward the pinch centre) + drag to pan.
        this.grabPoint = null;
        const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
        const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
        const curDist = Math.hypot(cur.x - other.x, cur.y - other.y);
        const midX = (cur.x + other.x) / 2, midY = (cur.y + other.y) / 2;
        if (this.navMode === 'orbit') {
          if (curDist > 0 && prevDist > 0) this.zoomAt(midX, midY, prevDist / curDist);
          this.panOrbit((cur.x - prev.x) / 2, (cur.y - prev.y) / 2);
        } else {
          this.moveWalker((curDist - prevDist) * 0.08, 0);
        }
        pointers.set(e.pointerId, cur);
        return;
      }

      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      pointers.set(e.pointerId, cur);

      if (this.navMode === 'orbit') {
        if (isRotateDrag(e)) {
          // Right-drag (or Shift/Ctrl/Alt + drag): turn and tilt the view.
          this.grabPoint = null;
          orbit.theta -= dx * 0.0065;
          orbit.phi = clamp(orbit.phi - dy * 0.0065, ORBIT.minPhi, ORBIT.maxPhi);
        } else {
          // Left-drag: the ground follows the cursor — drag right, view moves right.
          if (!this.grabPoint) startGrab(prev.x, prev.y);
          this.dragGround(cur.x, cur.y, dx, dy);
        }
      } else {
        walk.yaw -= dx * 0.0042;
        walk.pitch = clamp(walk.pitch - dy * 0.0038, -1.15, 1.15);
      }
    });

    const release = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      // Lifting one finger of a pinch: re-grab under the remaining finger.
      this.grabPoint = null;
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    this.listen(el, 'pointerup', release);
    this.listen(el, 'pointercancel', release);

    this.listen(el, 'wheel', (e) => {
      e.preventDefault();
      this.transition = null;
      // Normalise line/page scrolling to pixels; trackpad pinch arrives as ctrl+wheel.
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      const delta = clamp(px, -200, 200);

      if (this.navMode === 'orbit') {
        this.zoomAt(e.clientX, e.clientY, Math.exp(delta * (e.ctrlKey ? 0.01 : 0.0015)));
      } else {
        this.moveWalker(-delta * 0.03, 0);
      }
    }, { passive: false });

    this.listen(window, 'keydown', (e) => this.keys.add(e.code));
    this.listen(window, 'keyup', (e) => this.keys.delete(e.code));
    this.listen(window, 'blur', () => this.keys.clear());

    this.listen(window, 'resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /** WASD / arrows / on-screen pad → -1..1 forward and strafe intent. */
  private moveIntent() {
    const { keys, pad } = this;
    let fwd = 0, str = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp') || pad.forward) fwd += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown') || pad.backward) fwd -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight') || pad.right) str += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft') || pad.left) str -= 1;
    return { fwd, str };
  }

  // ---------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------

  private readonly animate = (now: number) => {
    this.rafId = requestAnimationFrame(this.animate);
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const { camera, walk, orbit } = this;

    for (const fan of this.world.ceilingFans) fan.rotation.y += dt * 3.6;

    const { fwd, str } = this.moveIntent();
    if (this.transition) {
      const tr = this.transition;
      tr.t += dt / tr.duration;
      const k = Math.min(1, tr.t);
      const ease = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(tr.startPos, tr.endPos, ease);
      camera.quaternion.copy(tr.startQuat).slerp(tr.endQuat, ease);
      if (k >= 1) this.transition = null;
    } else if (this.navMode === 'orbit') {
      // WASD pans the aerial camera, speed scaled to how far out you are.
      if (fwd !== 0 || str !== 0) {
        // panOrbit scales by radius * 0.0014, so this moves ~0.9 × radius per second.
        const step = (0.9 * dt) / 0.0014;
        this.panOrbit(-str * step, fwd * step);
      }
      camera.position.copy(this.computeOrbitPos());
      camera.lookAt(orbit.target);
    } else {
      const speed = 15.5 * dt;
      if (fwd !== 0 || str !== 0) this.moveWalker(fwd * speed, str * speed);
      camera.position.set(walk.pos.x, EYE_H + Math.sin(walk.bobPhase) * 0.11, walk.pos.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(walk.pitch, walk.yaw, 0);
    }

    // Report the location only once the camera has settled, so a fly-through
    // never flashes the names of the rooms it passes over.
    if (!this.transition) {
      const isWalk = this.navMode === 'walk';
      const info = describeLocation(isWalk, camera.position.x, camera.position.z);
      if (info.id !== this.lastRoomId) {
        this.lastRoomId = info.id;
        this.callbacks.onLocationChange(info);
      }
    }

    if (this.minimapCtx) {
      drawMinimap(this.minimapCtx, this.navMode === 'walk'
        ? { x: walk.pos.x, z: walk.pos.z, yaw: walk.yaw }
        : { x: orbit.target.x, z: orbit.target.z, yaw: null });
    }

    this.renderer.render(this.scene, camera);
  };
}
