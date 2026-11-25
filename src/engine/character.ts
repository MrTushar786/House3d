import * as THREE from 'three';

/** Real-world height of the character in feet (≈ 1.65 m), to scale with 7 ft doors. */
export const CHARACTER_HEIGHT = 5.4;
export const WALK_SPEED = 5; // ft/s — a normal walking pace
export const RUN_SPEED = 12; // ft/s — a jog/run

const SKIN = 0xd9a27a;
const HAIR = 0x2b1d14;
const SHIRT = 0x2f7dd1;
const PANTS = 0x2a3442;
const SHOES = 0x1b1f27;

/** A limb segment hanging down from a pivot at its top (rotate the pivot to swing it). */
function limb(radiusTop: number, radiusBottom: number, length: number, mat: THREE.Material) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 12), mat);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

/**
 * A simple, friendly human figure built from primitives — no download, no
 * guesswork about which way it faces: the face is on the -Z side, which is
 * "forward" at yaw 0 (the same convention as walk mode).
 *
 * The root group sits at the character's feet; rotation.y is its facing yaw.
 * Walking / running is a procedural cycle: legs and arms swing in opposition,
 * knees and elbows bend, the body bobs and leans into a run.
 */
export class Character {
  readonly root = new THREE.Group();
  /** Facing yaw; forward is (-sin yaw, -cos yaw). */
  yaw = 0;

  private readonly body = new THREE.Group(); // everything above the feet, for bob/lean
  private readonly hips: THREE.Group[] = [];
  private readonly knees: THREE.Group[] = [];
  private readonly shoulders: THREE.Group[] = [];
  private readonly elbows: THREE.Group[] = [];
  private phase = 0;
  /** Smoothed 0 (idle) → 1 (walk) → 2 (run) gait amount, so starts/stops blend. */
  private gait = 0;
  private time = 0;

  constructor() {
    const mat = (color: number, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness });
    const skin = mat(SKIN, 0.6), hair = mat(HAIR, 0.9), shirt = mat(SHIRT), pants = mat(PANTS), shoes = mat(SHOES, 0.5);

    const hipY = 2.6, shoulderY = 4.35;
    this.root.add(this.body);

    // Legs: thigh + shin (bending knee) + shoe that points forward (-Z)
    for (const side of [-1, 1]) {
      const hip = limb(0.22, 0.19, 1.3, pants);
      hip.position.set(side * 0.27, hipY, 0);
      const knee = limb(0.18, 0.15, 1.15, pants);
      knee.position.y = -1.3;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.72), shoes);
      shoe.position.set(0, -1.22, -0.14);
      shoe.castShadow = true;
      knee.add(shoe);
      hip.add(knee);
      this.body.add(hip);
      this.hips.push(hip);
      this.knees.push(knee);
    }

    // Pelvis + torso (slightly flattened front-to-back) + neck
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.5, 16), pants);
    pelvis.position.y = hipY + 0.1;
    pelvis.scale.z = 0.65;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.48, 1.65, 16), shirt);
    torso.position.y = hipY + 1.05;
    torso.scale.z = 0.62;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.3, 10), skin);
    neck.position.y = shoulderY + 0.12;
    for (const m of [pelvis, torso, neck]) { m.castShadow = true; this.body.add(m); }

    // Head: face, hair (cap on top/back), eyes and nose on the -Z side so the facing is obvious
    const head = new THREE.Group();
    head.position.y = shoulderY + 0.62;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), skin);
    skull.scale.set(0.92, 1.08, 1);
    skull.castShadow = true;
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.385, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.set(0, 0.05, 0.04);
    hairCap.rotation.x = -0.35; // sweeps down the back of the head, leaves the face clear
    const eyeMat = mat(0x111111, 0.3);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
      eye.position.set(side * 0.12, 0.04, -0.32);
      head.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), skin);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, -0.04, -0.37);
    head.add(skull, hairCap, nose);
    this.body.add(head);

    // Arms: upper arm (shirt sleeve) + forearm (bending elbow) + hand
    for (const side of [-1, 1]) {
      const shoulder = limb(0.15, 0.13, 0.95, shirt);
      shoulder.position.set(side * 0.68, shoulderY - 0.05, 0);
      shoulder.rotation.z = side * 0.08; // arms hang slightly away from the body
      const elbow = limb(0.12, 0.1, 0.9, skin);
      elbow.position.y = -0.95;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), skin);
      hand.position.y = -0.95;
      elbow.add(hand);
      shoulder.add(elbow);
      this.body.add(shoulder);
      this.shoulders.push(shoulder);
      this.elbows.push(elbow);
    }

    this.root.visible = false;
  }

  /**
   * @param moveX, moveZ world-space move direction (zero when standing still)
   * @param running whether the run gait is used
   */
  update(dt: number, moveX: number, moveZ: number, running: boolean) {
    this.time += dt;
    const moving = moveX !== 0 || moveZ !== 0;
    if (moving) {
      const target = Math.atan2(-moveX, -moveZ);
      const diff = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw)); // shortest way round
      this.yaw += diff * Math.min(1, dt * 12);
    }
    this.root.rotation.y = this.yaw;

    const targetGait = moving ? (running ? 2 : 1) : 0;
    this.gait += (targetGait - this.gait) * Math.min(1, dt * 8);
    const run = Math.max(0, this.gait - 1); // 0..1 how much of a run
    const walk = Math.min(1, this.gait); // 0..1 how much of a walk

    // Steps per second rise with speed; the cycle stops advancing when idle.
    this.phase += dt * (walk * 7 + run * 4.5);
    const s = Math.sin(this.phase);
    const legAmp = walk * 0.55 + run * 0.35;
    const armAmp = walk * 0.45 + run * 0.55;

    for (let i = 0; i < 2; i++) {
      const dir = i === 0 ? 1 : -1; // left and right legs/arms move in opposition
      this.hips[i].rotation.x = dir * s * legAmp;
      // Knee bends while the leg swings back and lifts
      this.knees[i].rotation.x = -Math.max(0, -dir * s) * (walk * 0.7 + run * 0.7) - run * 0.25;
      this.shoulders[i].rotation.x = -dir * s * armAmp;
      this.elbows[i].rotation.x = walk * 0.25 + run * 0.9; // elbows bend more when running
    }

    // Body bob with each step, lean into a run, gentle breathing when idle
    this.body.position.y = Math.abs(Math.cos(this.phase)) * (walk * 0.08 + run * 0.12) + Math.sin(this.time * 2) * 0.015 * (1 - walk);
    this.body.rotation.x = -run * 0.18;
  }
}
