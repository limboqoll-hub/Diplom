import { getTextMetrics, render, saveHistory } from "../canvas/render.js";
import { state } from "../core/state.js";

// ======================== ПОИСК И ВЫДЕЛЕНИЕ ========================
export function findObjectAt(pos) {
  for (let i = state.objects.length - 1; i >= 0; i--) {
    const obj = state.objects[i];
    if (obj.type === "bg-patch") continue;

    if (obj.type === "text") {
      const { w, h } = getTextMetrics(obj);
      if (
        pos.x >= obj.x - w / 2 &&
        pos.x <= obj.x + w / 2 &&
        pos.y >= obj.y - h / 2 &&
        pos.y <= obj.y + h / 2
      )
        return obj;
    } else if (obj.type === "image") {
      if (
        pos.x >= obj.x &&
        pos.x <= obj.x + obj.w &&
        pos.y >= obj.y &&
        pos.y <= obj.y + obj.h
      )
        return obj;
    } else if (obj.type === "rect") {
      const x = Math.min(obj.x1, obj.x2),
        y = Math.min(obj.y1, obj.y2);
      const w = Math.abs(obj.x2 - obj.x1),
        h = Math.abs(obj.y2 - obj.y1);
      if (pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h)
        return obj;
    } else if (obj.type === "line" || obj.type === "curve") {
      const minX = Math.min(obj.x1, obj.x2) - 10,
        maxX = Math.max(obj.x1, obj.x2) + 10;
      const minY = Math.min(obj.y1, obj.y2) - 10,
        maxY = Math.max(obj.y1, obj.y2) + 10;
      if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY)
        return obj;
    }
  }
  return null;
}

export function isObjectInRect(obj, rect) {
  if (!obj || !rect || rect.w <= 0 || rect.h <= 0) return false;
  let bx, by, bw, bh;
  if (obj.type === "text") {
    const { w, h } = getTextMetrics(obj);
    bx = obj.x - w / 2;
    by = obj.y - h / 2;
    bw = w;
    bh = h;
  } else if (obj.type === "image") {
    bx = obj.x;
    by = obj.y;
    bw = obj.w;
    bh = obj.h;
  } else if (obj.type === "rect") {
    bx = Math.min(obj.x1, obj.x2);
    by = Math.min(obj.y1, obj.y2);
    bw = Math.abs(obj.x2 - obj.x1);
    bh = Math.abs(obj.y2 - obj.y1);
  } else if (obj.type === "line" || obj.type === "curve") {
    bx = Math.min(obj.x1, obj.x2);
    by = Math.min(obj.y1, obj.y2);
    bw = Math.abs(obj.x2 - obj.x1);
    bh = Math.abs(obj.y2 - obj.y1);
  } else return false;
  return !(
    bx + bw < rect.x ||
    bx > rect.x + rect.w ||
    by + bh < rect.y ||
    by > rect.y + rect.h
  );
}

// ======================== ГРУППИРОВКА ========================
export function groupSelectedObjects() {
  if (state.selectedObjects.length < 2) return;
  const groupId = "group_" + Date.now();
  saveHistory();
  const nonGrouped = state.objects.filter(
    (o) => !state.selectedObjects.includes(o),
  );
  state.selectedObjects.forEach((obj) => (obj.groupId = groupId));
  state.objects = [...nonGrouped, ...state.selectedObjects];
  state.selectedObjects = state.objects.filter((o) => o.groupId === groupId);
  state.selectedObj = state.selectedObjects[0];
  render();
}

export function ungroupSelectedObjects() {
  if (state.selectedObjects.length === 0 || !state.selectedObjects[0].groupId)
    return;
  saveHistory();
  const gId = state.selectedObjects[0].groupId;
  state.objects.forEach((o) => {
    if (o.groupId === gId) delete o.groupId;
  });
  render();
}

// ======================== ОПЕРАЦИИ СО СЛОЯМИ ========================
export function moveLayer(targetId, isGroup, direction) {
  saveHistory();
  let workArray = [...state.objects];

  const targetIndices = [];
  workArray.forEach((o, i) => {
    if ((isGroup && o.groupId === targetId) || (!isGroup && o.id === targetId))
      targetIndices.push(i);
  });

  if (targetIndices.length === 0) return;

  const minIdx = Math.min(...targetIndices);
  const maxIdx = Math.max(...targetIndices);

  if (direction === 1 && maxIdx >= workArray.length - 1) return;
  if (direction === -1 && minIdx <= 0) return;

  const extracted = workArray.filter((_, i) => targetIndices.includes(i));
  workArray = workArray.filter((_, i) => !targetIndices.includes(i));

  const newInsertPos = direction === 1 ? minIdx + 1 : minIdx - 1;
  workArray.splice(newInsertPos, 0, ...extracted);
  state.objects = workArray;
  render();
}

export function deleteLayer(targetId, isGroup) {
  saveHistory();
  state.objects = state.objects.filter((o) => {
    if (isGroup) return o.groupId !== targetId;
    return o.id !== targetId;
  });
  state.selectedObj = null;
  state.selectedObjects = [];
  render();
}

// ======================== ЭКСПОРТ ========================
export function exportAsImage() {
  const link = document.createElement("a");
  link.download = "neon_sign.png";
  link.href = document.getElementById("paintCanvas").toDataURL("image/png");
  link.click();
}
