import * as THREE from 'three';
import { marchingSquares } from './marchingSquares.js';
import { chainsToShape } from './chainsToShape.js';

/**
 * Создаёт экструдированный 3D-объект из существующего canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} extrudeSettings
 */
export function createExtrudedFromCanvas(canvas, extrudeSettings = { depth: 0.5, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05 }) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const width = canvas.width, height = canvas.height;
  const chains = marchingSquares(imageData, 128, 1.5);
  const shape = chainsToShape(chains, width, height);
  if (!shape) throw new Error('Не удалось создать форму из изображения');

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    side: THREE.DoubleSide,
    roughness: 0.4,
    metalness: 0.1
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

export default createExtrudedFromCanvas;
