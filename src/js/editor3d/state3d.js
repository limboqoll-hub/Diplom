import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";

// ======================== 3D-СОСТОЯНИЕ ========================
export const state3d = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  objects3D: [],
  selectedMesh3D: null,
  currentModeView: "2d",
  loaded3DFont: null,
};

const fontLoader = new FontLoader();
fontLoader.load(
  "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json",
  (font) => {
    state3d.loaded3DFont = font;
  },
);
