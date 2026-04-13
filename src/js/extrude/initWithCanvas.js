import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createExtrudedFromCanvas } from './createExtrudedFromCanvas.js';

/**
 * Инициализация сцены и добавление экструдированного меша из canvas.
 * @param {HTMLCanvasElement} existingCanvas
 * @param {Object} options - { container, cameraPos, extrudeSettings }
 * @returns {{scene, camera, renderer, controls}}
 */
export function initWithCanvas(existingCanvas, options = {}) {
  const container = options.container || document.getElementById('container3d') || document.body;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111122);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  const camPos = options.cameraPos || { x: 3, y: 2, z: 5 };
  camera.position.set(camPos.x, camPos.y, camPos.z);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x404060);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(2, 5, 3);
  dirLight.castShadow = true;
  scene.add(dirLight);
  const backLight = new THREE.PointLight(0x4466ff, 0.5);
  backLight.position.set(-2, 1, -2);
  scene.add(backLight);

  const gridHelper = new THREE.GridHelper(10, 20);
  scene.add(gridHelper);

  try {
    const mesh = createExtrudedFromCanvas(existingCanvas, options.extrudeSettings || { depth: 0.3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03 });
    scene.add(mesh);
  } catch (err) {
    console.error(err);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { scene, camera, renderer, controls };
}

export default initWithCanvas;
