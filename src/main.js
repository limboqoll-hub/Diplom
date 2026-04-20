import "bootstrap/dist/css/bootstrap.min.css";
import "./scss/fonts.css";
import "./scss/style.css";

import {
  getMousePos,
  initCanvas,
  render,
  saveHistory,
  undo,
} from "./js/canvas/render.js";
import {
  bgColorPicker,
  bgPaddingInput,
  bgTypeSelect,
  canvas,
  colorPicker,
  fontSelect,
  imageLoader,
  mainInput,
  opacityInput,
  outlinePicker,
  renderCache,
  sizeSlider,
  state,
  textOrientation,
  thicknessSlider,
  thicknessVal,
} from "./js/core/state.js";
import { settings } from "./js/core/state.js";
import { switchMode } from "./js/editor3d/controls.js";
import { init3DScene, applyGlowSettings } from "./js/editor3d/scene.js";
import {
  deleteLayer,
  exportAsImage,
  findObjectAt,
  groupSelectedObjects,
  isObjectInRect,
  moveLayer,
  ungroupSelectedObjects,
} from "./js/layers/layers.js";

// ======================== ГЛОБАЛЬНЫЕ ФУНКЦИИ (для onclick в HTML) ========================
window.switchMode = switchMode;
window.exportAsImage = exportAsImage;
window.moveLayer = moveLayer;
window.deleteLayer = deleteLayer;
window.distortBacking = () =>
  alert("Функция искривления подложки в разработке");
window.fillGaps = () => alert("Функция заливки пустот в разработке");

// Toggle glow settings (called from buttons in index.html)
window.toggleTextGlow = function toggleTextGlow() {
  settings.textGlow = !settings.textGlow;
  const btn = document.getElementById("btn-text-glow");
  if (btn) btn.innerText = settings.textGlow ? "Выкл. свечение текста" : "Вкл. свечение текста";
  // apply settings immediately (if 3D scene exists, applyGlowSettings is a no-op otherwise)
  try {
    applyGlowSettings();
  } catch (e) {
    console.error('applyGlowSettings failed:', e);
  }
};

window.toggleImageGlow = function toggleImageGlow() {
  settings.imageGlow = !settings.imageGlow;
  const btn = document.getElementById("btn-image-glow");
  if (btn) btn.innerText = settings.imageGlow ? "Выкл. свечение изображения" : "Вкл. свечение изображения";
  try {
    applyGlowSettings();
  } catch (e) {
    console.error('applyGlowSettings failed:', e);
  }
};

// ======================== ОБРАБОТЧИКИ МЫШИ НА ХОЛСТЕ ========================
canvas.addEventListener("mousedown", (e) => {
  const pos = getMousePos(e);

  if (state.currentMode === "bg-brush" || state.currentMode === "bg-eraser") {
    state.isDrawing = true;
    state.bgPath = [pos];
    return;
  }

  if (state.currentMode === "select") {
    const hit = findObjectAt(pos);
    if (hit) {
      state.selectedObjects = hit.groupId
        ? state.objects.filter((o) => o.groupId === hit.groupId)
        : [hit];
      state.selectedObj = hit;
      state.isDragging = true;
      saveHistory();

      const anchorX =
        hit.x !== undefined ? hit.x : hit.x1 !== undefined ? hit.x1 : 0;
      const anchorY =
        hit.y !== undefined ? hit.y : hit.y1 !== undefined ? hit.y1 : 0;
      state.dragOffset.x = pos.x - anchorX;
      state.dragOffset.y = pos.y - anchorY;
      render();
    } else {
      state.selectedObjects = [];
      state.selectedObj = null;
      state.isSelecting = true;
      state.selectionStart = { ...pos };
      state.selectionEnd = { ...pos };
      render();
    }
    return;
  }

  if (state.currentMode === "text") {
    saveHistory();
    state.objects.push({
      type: "text",
      content: mainInput.value,
      x: pos.x,
      y: pos.y,
      size: parseInt(sizeSlider.value),
      color: colorPicker.value,
      outlineColor: outlinePicker.value,
      font: fontSelect.value,
      thickness: parseInt(thicknessSlider.value),
      orientation: textOrientation.value,
      bgType: bgTypeSelect.value,
      bgColor: bgColorPicker.value,
      bgPadding: parseInt(bgPaddingInput.value),
      depth3d: 15,
      material3d: "neon",
      zOffset3d: 0,
    });
    render();
    return;
  }

  state.isDrawing = true;
  state.startPoint = pos;
  state.currentMousePos = pos;
});

canvas.addEventListener("mousemove", (e) => {
  const pos = getMousePos(e);
  document.getElementById("coords").innerText =
    `${Math.round(pos.x)}, ${Math.round(pos.y)}`;

  if (
    state.isDrawing &&
    (state.currentMode === "bg-brush" || state.currentMode === "bg-eraser")
  ) {
    state.bgPath.push(pos);
    render();
    return;
  }

  if (state.isDragging) {
    const toMove =
      state.selectedObjects.length > 0
        ? state.selectedObjects
        : state.selectedObj
          ? [state.selectedObj]
          : [];
    if (toMove.length === 0) return;

    const anchor = toMove[0];
    const newAnchorX = pos.x - state.dragOffset.x;
    const newAnchorY = pos.y - state.dragOffset.y;
    const currentAnchorX =
      anchor.x !== undefined
        ? anchor.x
        : anchor.x1 !== undefined
          ? anchor.x1
          : 0;
    const currentAnchorY =
      anchor.y !== undefined
        ? anchor.y
        : anchor.y1 !== undefined
          ? anchor.y1
          : 0;
    const deltaX = newAnchorX - currentAnchorX;
    const deltaY = newAnchorY - currentAnchorY;

    toMove.forEach((obj) => {
      if (obj.type === "text" || obj.type === "image") {
        obj.x += deltaX;
        obj.y += deltaY;
      } else if (
        obj.type === "rect" ||
        obj.type === "line" ||
        obj.type === "curve"
      ) {
        obj.x1 += deltaX;
        obj.y1 += deltaY;
        obj.x2 += deltaX;
        obj.y2 += deltaY;
        if (obj.cx !== undefined) obj.cx += deltaX;
        if (obj.cy !== undefined) obj.cy += deltaY;
      }
    });
    render();
  } else if (state.isSelecting) {
    state.selectionEnd = pos;
    render();
  } else if (state.isDrawing) {
    state.currentMousePos = pos;
    render();
  }
});

canvas.addEventListener("mouseup", () => {
  if (
    state.isDrawing &&
    (state.currentMode === "bg-brush" || state.currentMode === "bg-eraser")
  ) {
    saveHistory();
    state.objects.push({
      type: "bg-patch",
      mode: state.currentMode === "bg-brush" ? "add" : "erase",
      points: [...state.bgPath],
      thickness: (parseInt(bgPaddingInput.value) || 40) * 1.5,
      color: bgColorPicker.value,
    });
    state.isDrawing = false;
    state.bgPath = [];
    render();
    return;
  }

  if (state.isSelecting) {
    state.isSelecting = false;
    if (state.selectionStart && state.selectionEnd) {
      const rx = Math.min(state.selectionStart.x, state.selectionEnd.x);
      const ry = Math.min(state.selectionStart.y, state.selectionEnd.y);
      const rw = Math.abs(state.selectionEnd.x - state.selectionStart.x);
      const rh = Math.abs(state.selectionEnd.y - state.selectionStart.y);
      if (rw > 10 && rh > 10) {
        const selRect = { x: rx, y: ry, w: rw, h: rh };
        state.selectedObjects = state.objects.filter((obj) =>
          isObjectInRect(obj, selRect),
        );
        state.selectedObj =
          state.selectedObjects.length === 1 ? state.selectedObjects[0] : null;
      } else {
        state.selectedObjects = [];
        state.selectedObj = null;
      }
    }
    state.selectionStart = null;
    state.selectionEnd = null;
    render();
    return;
  }

  if (state.isDrawing) {
    const pos = state.currentMousePos;
    saveHistory();

    const sharedProps = {
      bgType: bgTypeSelect.value,
      bgColor: bgColorPicker.value,
      bgPadding: parseInt(bgPaddingInput.value),
    };

    if (state.currentMode === "line") {
      state.objects.push({
        type: "line",
        x1: state.startPoint.x,
        y1: state.startPoint.y,
        x2: pos.x,
        y2: pos.y,
        color: colorPicker.value,
        outlineColor: outlinePicker.value,
        thickness: parseInt(thicknessSlider.value),
        ...sharedProps,
        depth3d: 15,
        material3d: "neon",
        zOffset3d: 0,
      });
    } else if (state.currentMode === "rect") {
      state.objects.push({
        type: "rect",
        x1: state.startPoint.x,
        y1: state.startPoint.y,
        x2: pos.x,
        y2: pos.y,
        color: colorPicker.value,
        opacity: parseFloat(opacityInput.value) || 0.5,
        ...sharedProps,
        depth3d: 15,
        material3d: "plastic",
        zOffset3d: 0,
      });
    } else if (state.currentMode === "curve") {
      state.activeCurve = {
        type: "curve",
        x1: state.startPoint.x,
        y1: state.startPoint.y,
        x2: pos.x,
        y2: pos.y,
        cx: pos.x,
        cy: pos.y,
        color: colorPicker.value,
        outlineColor: outlinePicker.value,
        thickness: parseInt(thicknessSlider.value),
        ...sharedProps,
        depth3d: 15,
        material3d: "neon",
        zOffset3d: 0,
      };
      state.isBending = true;
    }

    state.isDrawing = false;
    render();
    return;
  }

  state.isDragging = false;
  render();
});

canvas.addEventListener("dblclick", (e) => {
  const pos = getMousePos(e);
  const obj = findObjectAt(pos);
  if (obj && obj.type === "text") {
    const newText = prompt("Изменить текст:", obj.content);
    if (newText && newText.trim() !== "") {
      saveHistory();
      obj.content = newText;
      render();
    }
  }
});

// ======================== ЗАГРУЗКА ИЗОБРАЖЕНИЯ ========================
imageLoader.addEventListener("change", (e) => {
  if (!e.target.files[0]) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      saveHistory();
      const newObj = {
        type: "image",
        id: "img_" + Date.now(),
        data: event.target.result,
        x: 100,
        y: 100,
        w: img.width * 0.6,
        h: img.height * 0.6,
        opacity: 1.0,
        bgType: bgTypeSelect.value,
        bgColor: bgColorPicker.value,
        bgPadding: parseInt(bgPaddingInput.value),
        depth3d: 10,
        material3d: "plastic",
        zOffset3d: 0,
      };
      renderCache[newObj.id] = { image: img };
      state.objects.push(newObj);
      render();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(e.target.files[0]);
  e.target.value = "";
});

// ======================== ИЗМЕНЕНИЕ СВОЙСТВ ========================
[
  sizeSlider,
  colorPicker,
  outlinePicker,
  fontSelect,
  thicknessSlider,
  opacityInput,
  bgTypeSelect,
  bgPaddingInput,
  bgColorPicker,
  textOrientation,
].forEach((el) => {
  el?.addEventListener("input", () => {
    const targets =
      state.selectedObjects.length > 0
        ? state.selectedObjects
        : state.selectedObj
          ? [state.selectedObj]
          : [];

    if (targets.length > 0 && state.currentMode === "select") {
      targets.forEach((obj) => {
        if (el === sizeSlider && obj.type === "text")
          obj.size = parseFloat(el.value);
        if (el === colorPicker) obj.color = el.value;
        if (el === outlinePicker) obj.outlineColor = el.value;
        if (el === fontSelect && obj.type === "text") obj.font = el.value;
        if (el === textOrientation && obj.type === "text")
          obj.orientation = el.value;
        if (el === thicknessSlider) {
          obj.thickness = parseFloat(el.value);
          if (thicknessVal) thicknessVal.innerText = el.value + " мм";
        }
        if (el === opacityInput) obj.opacity = parseFloat(el.value);
        if (el === bgTypeSelect) obj.bgType = el.value;
        if (el === bgPaddingInput) obj.bgPadding = parseInt(el.value);
        if (el === bgColorPicker) obj.bgColor = el.value;
      });
    }
    render();
  });
});

mainInput.addEventListener("input", () => {
  const targets =
    state.selectedObjects.length > 0
      ? state.selectedObjects
      : state.selectedObj
        ? [state.selectedObj]
        : [];
  targets.forEach((obj) => {
    if (obj.type === "text") obj.content = mainInput.value;
  });
  render();
});

// ======================== КНОПКИ ИНСТРУМЕНТОВ ========================
document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.id === "btn-clear") {
      if (confirm("Очистить всё?")) {
        saveHistory();
        state.objects = [];
        state.selectedObjects = [];
        state.selectedObj = null;
        render();
      }
      return;
    }
    if (btn.id === "btn-undo") {
      undo();
      return;
    }

    document
      .querySelectorAll(".tool-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.currentMode = btn.id.replace("btn-", "");
    state.selectedObj = null;
    state.selectedObjects = [];
    state.isBending = false;
    render();
  });
});

const groupBtn = document.getElementById("btn-group");
if (groupBtn) groupBtn.addEventListener("click", groupSelectedObjects);

const ungroupBtn = document.getElementById("btn-ungroup");
if (ungroupBtn) ungroupBtn.addEventListener("click", ungroupSelectedObjects);

window.addEventListener("resize", initCanvas);

// ======================== ЗАПУСК ========================
initCanvas();
