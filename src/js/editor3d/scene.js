import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { canvas, state, settings } from "../core/state.js";
import { generate3DBackground, generate3DObject } from "./objects.js";
import { state3d } from "./state3d.js";

const container3d = document.getElementById("container3d");
const matTypeSelect = document.getElementById("materialType3D");
const depthSlider = document.getElementById("depth3D");
const zOffsetSlider = document.getElementById("zOffset3D");

// ======================== ИНИЦИАЛИЗАЦИЯ 3D-СЦЕНЫ ========================
export function init3DScene() {
  state3d.objects3D = [];
  container3d.innerHTML = "";

  state3d.scene = new THREE.Scene();
  state3d.scene.background = new THREE.Color(0x111122);

  const rect = container3d.getBoundingClientRect();
  state3d.camera = new THREE.PerspectiveCamera(
    45,
    rect.width / rect.height,
    1,
    5000,
  );
  state3d.camera.position.set(0, -200, 600);
  state3d.camera.lookAt(0, 0, 0);

  state3d.renderer = new THREE.WebGLRenderer({ antialias: true });
  state3d.renderer.setSize(rect.width, rect.height);
  state3d.renderer.shadowMap.enabled = true;
  container3d.appendChild(state3d.renderer.domElement);

  state3d.controls = new OrbitControls(
    state3d.camera,
    state3d.renderer.domElement,
  );
  state3d.controls.enableDamping = true;
  state3d.controls.dampingFactor = 0.05;
  state3d.controls.autoRotate = false;
  state3d.controls.enableZoom = true;
  state3d.controls.target.set(0, 0, 0);

  state3d.scene.add(new THREE.AmbientLight(0x404060));

  const mainLight = new THREE.DirectionalLight(0xffffff, 1);
  mainLight.position.set(1, 2, 1);
  mainLight.castShadow = true;
  state3d.scene.add(mainLight);

  const fillLight = new THREE.PointLight(0x4466cc, 0.3);
  fillLight.position.set(0, 1, 2);
  state3d.scene.add(fillLight);

  const backLight = new THREE.PointLight(0xffaa66, 0.2);
  backLight.position.set(0, 0, -1);
  state3d.scene.add(backLight);

  const gridHelper = new THREE.GridHelper(1000, 20, 0x888888, 0x444444);
  gridHelper.position.y = -250;
  state3d.scene.add(gridHelper);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  state.objects.forEach((obj, index) => {
    if (obj.bgType && obj.bgType !== "none")
      generate3DBackground(obj, centerX, centerY, index);
    generate3DObject(obj, centerX, centerY, index);
  });

  state3d.renderer.domElement.addEventListener("click", onMouseClick3D);
  window.addEventListener("resize", onWindowResize3D);

  animate3D();
}

// ======================== ВЗАИМОДЕЙСТВИЕ 3D ========================
const raycaster = new THREE.Raycaster();
const mouse3D = new THREE.Vector2();

function onMouseClick3D(event) {
  const rect = container3d.getBoundingClientRect();
  mouse3D.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse3D.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse3D, state3d.camera);
  const intersects = raycaster.intersectObjects(state3d.objects3D);

  if (intersects.length > 0) {
    state3d.selectedMesh3D = intersects[0].object;
    update3DUI(state3d.selectedMesh3D);

    if (state3d.selectedMesh3D.material.emissive) {
      state3d.selectedMesh3D.material.emissiveIntensity = 1.5;
      setTimeout(() => {
        if (state3d.selectedMesh3D && state3d.selectedMesh3D.material)
          state3d.selectedMesh3D.material.emissiveIntensity = 0.8;
      }, 200);
    }
  }
}

function update3DUI(mesh) {
  const obj2D = mesh.userData.originalObj;
  if (!obj2D) return;
  matTypeSelect.value = obj2D.material3d || "neon";
  depthSlider.value = obj2D.depth3d || 15;
  document.getElementById("depthVal3D").innerText = depthSlider.value + " мм";
  zOffsetSlider.value = obj2D.zOffset3d || 0;
  const zOffsetVal = document.getElementById("zOffsetVal3D");
  if (zOffsetVal) zOffsetVal.innerText = zOffsetSlider.value + " мм";
}

// ======================== АНИМАЦИЯ И РЕСАЙЗ ========================
export function animate3D() {
  if (state3d.currentModeView !== "3d" || !state3d.renderer) return;
  requestAnimationFrame(animate3D);
  if (state3d.controls) state3d.controls.update();
  if (state3d.renderer && state3d.scene && state3d.camera) {
    try {
      state3d.renderer.render(state3d.scene, state3d.camera);
    } catch (err) {
      console.error("animate3D render error:", err);
      try {
        if (state3d.objects3D && state3d.objects3D.length) {
          let found = false;
          for (let i = 0; i < state3d.objects3D.length && !found; i++) {
            const m = state3d.objects3D[i];
            try {
              if (!m || !m.material) continue;
              const info = {
                idx: i,
                userData: m.userData && m.userData.originalObj ? m.userData.originalObj.type : null,
                materialType: m.material.type || null,
              };
              // if material has uniforms, check for undefined values
              if (m.material.uniforms) {
                for (const k of Object.keys(m.material.uniforms)) {
                  const u = m.material.uniforms[k];
                  if (!u || typeof u.value === "undefined") {
                    console.error("Found material uniform with undefined value:", k, "mesh idx:", i, info);
                    found = true;
                    break;
                  }
                }
              }
              if (!found) console.log("mesh:", info);
            } catch (e) {
              console.error("error inspecting mesh", i, e);
            }
          }
        }
      } catch (e) {}
    }
  }
}

export function onWindowResize3D() {
  if (state3d.currentModeView !== "3d" || !container3d) return;
  const rect = container3d.getBoundingClientRect();
  if (state3d.camera) {
    state3d.camera.aspect = rect.width / rect.height;
    state3d.camera.updateProjectionMatrix();
  }
  if (state3d.renderer) state3d.renderer.setSize(rect.width, rect.height);
}

// Apply glow/brightness settings to existing 3D meshes immediately
export function applyGlowSettings() {
  if (!state3d.scene || !state3d.objects3D) return;
  for (const mesh of state3d.objects3D) {
    if (!mesh || !mesh.userData) continue;
    const obj = mesh.userData.originalObj;
    if (!obj) continue;

    // remove previous helper glow light if present
    if (mesh.userData._glowLight) {
      try {
        mesh.remove(mesh.userData._glowLight);
      } catch (e) {}
      delete mesh.userData._glowLight;
    }

    // Images: use emissiveMap for brightness
    if (obj.type === "image") {
      // skip background meshes (contour/rect) to avoid occluding the image
      if (mesh.userData && mesh.userData.isBackground) continue;
      try {
        if (mesh.material && mesh.material.isMeshStandardMaterial) {
          if (settings.imageGlow) {
            // use existing map as emissiveMap so colors brighten
            mesh.material.emissiveMap = mesh.material.map || null;
            mesh.material.emissive = new THREE.Color(0xffffff);
            mesh.material.emissiveIntensity = 1.2;
          } else {
            mesh.material.emissiveMap = null;
            mesh.material.emissiveIntensity = 0;
          }
          mesh.material.needsUpdate = true;
        }
      } catch (e) {}
    }

    // Text: set emissive color to text color
    if (obj.type === "text") {
      try {
        if (mesh.material && mesh.material.isMeshStandardMaterial) {
          if (settings.textGlow) {
            mesh.material.emissive = new THREE.Color(obj.color || "#ffcc00");
            mesh.material.emissiveIntensity = 1.0;
            // add small point light so glow is visible in scene
            const l = new THREE.PointLight(obj.color || "#ffcc00", 0.6, 200);
            mesh.add(l);
            mesh.userData._glowLight = l;
          } else {
            mesh.material.emissiveIntensity = 0;
          }
          mesh.material.needsUpdate = true;
        }
      } catch (e) {}
    }
  }
}
