import { canvas } from "../core/state.js";
import {
  createBaseMaterial,
  createMetalMaterial,
  createNeonMaterial,
} from "./materials.js";
import { init3DScene } from "./scene.js";
import { state3d } from "./state3d.js";

function createMaterial(colorHex, type) {
  if (type === "neon") return createNeonMaterial(colorHex);
  if (type === "metal") return createMetalMaterial(colorHex);
  return createBaseMaterial(colorHex);
}

const container3d = document.getElementById("container3d");
const sidebarLeft = document.getElementById("sidebar-left");
const sidebarRight2D = document.getElementById("sidebar-right-2d");
const sidebarRight3D = document.getElementById("sidebar-right-3d");
const matTypeSelect = document.getElementById("materialType3D");
const depthSlider = document.getElementById("depth3D");
const zOffsetSlider = document.getElementById("zOffset3D");

// ======================== ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ ========================
export function switchMode(mode) {
  state3d.currentModeView = mode;
  document
    .getElementById("btn-mode-2d")
    .classList.toggle("mode-active", mode === "2d");
  document
    .getElementById("btn-mode-3d")
    .classList.toggle("mode-active", mode === "3d");

  if (mode === "3d") {
    canvas.style.display = "none";
    sidebarLeft.style.opacity = "0.5";
    sidebarLeft.style.pointerEvents = "none";
    sidebarRight2D.style.display = "none";
    container3d.style.display = "block";
    sidebarRight3D.style.display = "flex";
    document.getElementById("hint").innerText =
      "Режим 3D: Левая кнопка — вращать, правая — двигать. Клик по детали — настройки материала.";
    init3DScene();
  } else {
    container3d.style.display = "none";
    sidebarRight3D.style.display = "none";
    canvas.style.display = "block";
    sidebarLeft.style.opacity = "1";
    sidebarLeft.style.pointerEvents = "all";
    sidebarRight2D.style.display = "block";
    document.getElementById("hint").innerText = "Режим 2D: Чертеж";
    if (state3d.renderer) {
      state3d.renderer.dispose();
      container3d.innerHTML = "";
    }
  }
}

// ======================== СЛУШАТЕЛИ 3D-ПАНЕЛИ ========================
if (matTypeSelect) {
  matTypeSelect.addEventListener("change", () => {
    if (!state3d.selectedMesh3D) return;
    const obj2D = state3d.selectedMesh3D.userData.originalObj;
    if (obj2D) {
      obj2D.material3d = matTypeSelect.value;
      const color = state3d.selectedMesh3D.userData.isBackground
        ? obj2D.bgColor
        : obj2D.color;
      state3d.selectedMesh3D.material = createMaterial(
        color || "#ffcc00",
        matTypeSelect.value,
      );
    }
  });
}

if (depthSlider) {
  depthSlider.addEventListener("input", () => {
    if (!state3d.selectedMesh3D) return;
    const obj2D = state3d.selectedMesh3D.userData.originalObj;
    if (obj2D) {
      obj2D.depth3d = parseInt(depthSlider.value);
      document.getElementById("depthVal3D").innerText =
        depthSlider.value + " мм";
      init3DScene();
    }
  });
}

if (zOffsetSlider) {
  zOffsetSlider.addEventListener("input", () => {
    if (!state3d.selectedMesh3D) return;
    const obj2D = state3d.selectedMesh3D.userData.originalObj;
    if (obj2D) {
      obj2D.zOffset3d = parseInt(zOffsetSlider.value);
      const zOffsetVal = document.getElementById("zOffsetVal3D");
      if (zOffsetVal) zOffsetVal.innerText = zOffsetSlider.value + " мм";
      state3d.selectedMesh3D.position.z = obj2D.zOffset3d;
    }
  });
}
