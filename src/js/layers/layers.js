import { getTextMetrics, render, saveHistory } from "../canvas/render.js";
import { state, renderCache } from "../core/state.js";

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
    } else if (obj.type === "paint") {
      if (!obj.points || obj.points.length === 0) continue;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of obj.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = (obj.size || 10) / 2 + 4;
      if (pos.x >= minX - pad && pos.x <= maxX + pad && pos.y >= minY - pad && pos.y <= maxY + pad)
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
  } else if (obj.type === "paint") {
    if (!obj.points || obj.points.length === 0) return false;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of obj.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = (obj.size || 10) / 2 + 4;
    bx = minX - pad;
    by = minY - pad;
    bw = maxX - minX + pad * 2;
    bh = maxY - minY + pad * 2;
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
  const nonGrouped = state.objects.filter((o) => !state.selectedObjects.includes(o));
  state.selectedObjects.forEach((obj) => (obj.groupId = groupId));
  state.objects = [...nonGrouped, ...state.selectedObjects];
  const newGroup = state.objects.filter((o) => o.groupId === groupId);
  setSelection(newGroup);
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

// ======================== ПОИСК ПО ПОЛИГОНУ (ЛАССО) ========================
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function bboxForObject(obj) {
  if (!obj) return null;
  if (obj.type === "text") {
    const { w, h } = getTextMetrics(obj);
    return { x: obj.x - w / 2, y: obj.y - h / 2, w, h };
  }
  if (obj.type === "image") return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
  if (obj.type === "rect")
    return { x: Math.min(obj.x1, obj.x2), y: Math.min(obj.y1, obj.y2), w: Math.abs(obj.x2 - obj.x1), h: Math.abs(obj.y2 - obj.y1) };
  if (obj.type === "line" || obj.type === "curve")
    return { x: Math.min(obj.x1, obj.x2), y: Math.min(obj.y1, obj.y2), w: Math.abs(obj.x2 - obj.x1), h: Math.abs(obj.y2 - obj.y1) };
  if (obj.type === "paint") {
    if (!obj.points || obj.points.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of obj.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = (obj.size || 10) / 2 + 4;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  return null;
}

export function selectByPoints(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return;
  const selected = [];
  for (let i = state.objects.length - 1; i >= 0; i--) {
    const obj = state.objects[i];
    if (!obj || obj.type === "bg-patch" || obj.hidden) continue;
    const bbox = bboxForObject(obj);
    if (!bbox) continue;
    // quick bbox center test
    const cx = bbox.x + bbox.w / 2;
    const cy = bbox.y + bbox.h / 2;
    if (pointInPolygon(cx, cy, polygon)) {
      selected.push(obj);
      continue;
    }
    // for paint, also test any stroke point
    if (obj.type === "paint") {
      for (const p of obj.points) {
        if (pointInPolygon(p.x, p.y, polygon)) {
          selected.push(obj);
          break;
        }
      }
    }
  }
  setSelection(selected);
}

export function clearSelection() {
  if (state.selectedObjects && state.selectedObjects.length) {
    state.selectedObjects.forEach((o) => {
      if (o && o._selected) delete o._selected;
    });
  }
  state.selectedObjects = [];
  state.selectedObj = null;
  render();
}

export function setSelection(objs) {
  clearSelection();
  if (!objs || objs.length === 0) return;
  const arr = Array.isArray(objs) ? objs : [objs];
  arr.forEach((o) => {
    if (o) o._selected = true;
  });
  state.selectedObjects = arr;
  state.selectedObj = arr.length === 1 ? arr[0] : null;
  render();
}

// ======================== ВЫРЕЗАТЬ (НЕ УДАЛЯЯ) ========================
export function cutSelectedObjects() {
  if (!state.selectedObjects || state.selectedObjects.length === 0) return;
  saveHistory();
  const copies = [];
  for (const obj of state.selectedObjects) {
    const oldId = obj.id || ('obj_' + Date.now());
    const newId = `${oldId}_cut_${Date.now()}`;
    let copy = null;
    // Build explicit copy per type to avoid losing important runtime data (images, points etc.)
    if (obj.type === 'image') {
      copy = {
        type: 'image',
        id: newId,
        data: obj.data,
        x: obj.x,
        y: obj.y,
        w: obj.w,
        h: obj.h,
        opacity: obj.opacity,
        bgType: obj.bgType,
        bgColor: obj.bgColor,
        bgPadding: obj.bgPadding,
        depth3d: obj.depth3d,
        material3d: obj.material3d,
        zOffset3d: obj.zOffset3d,
      };
      // preserve render cache entry (Image element)
      try { if (renderCache && renderCache[obj.id]) renderCache[copy.id] = renderCache[obj.id]; } catch(e) {}
    } else if (obj.type === 'paint') {
      copy = {
        type: 'paint',
        id: newId,
        points: obj.points ? obj.points.map(p => ({ x: p.x, y: p.y })) : [],
        color: obj.color,
        size: obj.size,
        opacity: obj.opacity,
        brushType: obj.brushType,
        bgType: obj.bgType,
        bgColor: obj.bgColor,
        bgPadding: obj.bgPadding,
      };
    } else if (obj.type === 'text') {
      copy = {
        type: 'text',
        id: newId,
        content: obj.content,
        x: obj.x,
        y: obj.y,
        size: obj.size,
        color: obj.color,
        outlineColor: obj.outlineColor,
        font: obj.font,
        thickness: obj.thickness,
        orientation: obj.orientation,
        bgType: obj.bgType,
        bgColor: obj.bgColor,
        bgPadding: obj.bgPadding,
        depth3d: obj.depth3d,
        material3d: obj.material3d,
        zOffset3d: obj.zOffset3d,
      };
    } else if (obj.type === 'rect' || obj.type === 'line' || obj.type === 'curve') {
      copy = Object.assign({ id: newId }, obj);
      // ensure arrays/objects are cloned where necessary
      if (obj.points) copy.points = obj.points.map(p => ({ x: p.x, y: p.y }));
    } else {
      // generic shallow copy fallback
      copy = Object.assign({}, obj, { id: newId });
    }
    // ensure copy is visible and not grouped with original unless wanted
    if (copy.groupId) delete copy.groupId;
    if (copy.hidden) delete copy.hidden;
    copies.push(copy);
    // hide original instead of deleting
    obj.hidden = true;
  }
  // append copies to top
  state.objects = [...state.objects, ...copies];
  // select newly created copies
  setSelection(copies);
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
  clearSelection();
  render();
}

// ======================== ЭКСПОРТ ========================
export function exportAsImage() {
  const link = document.createElement("a");
  link.download = "neon_sign.png";
  link.href = document.getElementById("paintCanvas").toDataURL("image/png");
  link.click();
}
