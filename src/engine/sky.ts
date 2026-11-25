import * as THREE from 'three';

const SKY_RADIUS = 1400;

/**
 * Gradient sky dome (zenith → horizon → ground) that follows the camera, plus
 * a prefiltered environment map of the same sky so glass, steel, tiles and
 * marble reflect it and pick up soft image-based ambient light.
 */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.SphereGeometry(1, 48, 24);
  private readonly material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly envScene = new THREE.Scene();
  private readonly pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    const count = this.geometry.attributes.position.count;
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.scale.setScalar(SKY_RADIUS);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;

    const envMesh = new THREE.Mesh(this.geometry, this.material);
    envMesh.scale.setScalar(100);
    this.envScene.add(envMesh);

    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  /**
   * Repaints the sky (colours given as sRGB hex) and returns a fresh
   * environment map for `scene.environment`.
   */
  update(top: number, horizon: number, ground: number): THREE.Texture {
    const cTop = new THREE.Color(top).convertSRGBToLinear();
    const cHorizon = new THREE.Color(horizon).convertSRGBToLinear();
    const cGround = new THREE.Color(ground).convertSRGBToLinear();
    const pos = this.geometry.attributes.position;
    const col = this.geometry.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y >= 0) c.copy(cHorizon).lerp(cTop, Math.pow(y, 0.55));
      else c.copy(cHorizon).lerp(cGround, Math.min(1, -y * 5));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;

    this.envTarget?.dispose();
    this.envTarget = this.pmrem.fromScene(this.envScene, 0.04);
    return this.envTarget.texture;
  }

  follow(camera: THREE.Camera) {
    this.mesh.position.copy(camera.position);
  }

  dispose() {
    this.envTarget?.dispose();
    this.pmrem.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
