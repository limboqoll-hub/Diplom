// ======================== ОБЩЕЕ СОСТОЯНИЕ ========================
export const state = {
  objects: [],
  history: [],
  currentMode: "select",
  isDrawing: false,
  isBending: false,
  isDragging: false,
  isSelecting: false,
  selectedObj: null,
  selectedObjects: [],
  dragOffset: { x: 0, y: 0 },
  selectionStart: null,
  selectionEnd: null,
  startPoint: null,
  currentMousePos: null,
  activeCurve: null,
  bgPath: [],
};

export const renderCache = {};

// ======================== DOM-ЭЛЕМЕНТЫ ========================
export const canvas = document.getElementById("paintCanvas");
export const ctx = canvas.getContext("2d");

export const objCountDisplay = document.getElementById("objCount");
export const mainInput = document.getElementById("mainInput");
export const textOrientation = document.getElementById("textOrientation");
export const sizeSlider = document.getElementById("sizeSlider");
export const colorPicker = document.getElementById("colorPicker");
export const outlinePicker = document.getElementById("outlinePicker");
export const fontSelect = document.getElementById("fontSelect");
export const thicknessSlider = document.getElementById("thicknessSlider");
export const thicknessVal = document.getElementById("thicknessVal");
export const imageLoader = document.getElementById("imageLoader");
export const opacityInput = document.getElementById("opacityInput");
export const bgTypeSelect = document.getElementById("bgTypeSelect");
export const bgPaddingInput = document.getElementById("bgPadding");
export const bgColorPicker = document.getElementById("bg-color-picker");
