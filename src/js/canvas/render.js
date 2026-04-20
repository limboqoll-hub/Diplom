import {
  bgColorPicker,
  bgPaddingInput,
  bgTypeSelect,
  canvas,
  colorPicker,
  ctx,
  fontSelect,
  mainInput,
  objCountDisplay,
  opacityInput,
  outlinePicker,
  renderCache,
  sizeSlider,
  state,
  textOrientation,
  thicknessSlider,
  thicknessVal,
} from "../core/state.js";

// ======================== ИНИЦИАЛИЗАЦИЯ ХОЛСТА ========================
export function initCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height - 30;
  // initialize view offset to center canvas
  state.view.offsetX = 0;
  state.view.offsetY = 0;
  state.view.scale = 1;

  // wheel zoom
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const prevScale = state.view.scale;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    let newScale = prevScale * zoomFactor;
    newScale = Math.max(0.2, Math.min(5, newScale));
    // adjust offset so zoom centers on mouse
    state.view.offsetX = localX - (localX - state.view.offsetX) * (newScale / prevScale);
    state.view.offsetY = localY - (localY - state.view.offsetY) * (newScale / prevScale);
    state.view.scale = newScale;
    render();
  });
  render();
}

export function saveHistory() {
  state.history.push(JSON.stringify(state.objects));
  if (state.history.length > 30) state.history.shift();
}

export function undo() {
  if (state.history.length > 0) {
    state.objects = JSON.parse(state.history.pop());
    state.selectedObj = null;
    state.selectedObjects = [];
    render();
  }
}

export function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  // convert screen coords to world coords considering view transform
  const localX = e.clientX - rect.left;
  const localY = e.clientY - rect.top;
  const x = (localX - state.view.offsetX) / state.view.scale;
  const y = (localY - state.view.offsetY) / state.view.scale;
  return { x, y };
}

// ======================== ХЕЛПЕРЫ ДЛЯ ТЕКСТА ========================
export function getTextMetrics(obj) {
  ctx.save();
  ctx.font = `bold ${obj.size}px "${obj.font || "Montserrat"}"`;
  let w = 0,
    h = parseInt(obj.size) || 60;

  if (obj.orientation === "vertical") {
    const chars = obj.content.split("");
    const lh = obj.size * 1.1;
    h = chars.length * lh;
    chars.forEach((c) => {
      w = Math.max(w, ctx.measureText(c).width);
    });
  } else {
    w = ctx.measureText(obj.content).width;
  }
  ctx.restore();
  return { w, h };
}

export function drawTextContent(obj, drawFn) {
  ctx.font = `bold ${obj.size}px "${obj.font || "Montserrat"}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (obj.orientation === "vertical") {
    const chars = obj.content.split("");
    const lh = obj.size * 1.1;
    const totalHeight = chars.length * lh;
    let currentY = obj.y - totalHeight / 2 + lh / 2;
    chars.forEach((char) => {
      drawFn(char, obj.x, currentY);
      currentY += lh;
    });
  } else {
    drawFn(obj.content, obj.x, obj.y);
  }
}

// ======================== ИДЕАЛЬНАЯ ОБВОДКА ПО КОНТУРУ ========================
function drawImageContour(obj, padding, bgColor) {
  if (!renderCache[obj.id]) return;
  const cache = renderCache[obj.id];
  if (!cache.image.complete) return;

  const cacheKey = `${padding}_${bgColor}_${obj.w}_${obj.h}`;

  if (!cache.contourCanvas || cache.contourKey !== cacheKey) {
    const cCanvas = document.createElement("canvas");
    cCanvas.width = obj.w + padding * 2;
    cCanvas.height = obj.h + padding * 2;
    const cCtx = cCanvas.getContext("2d");

    const tCanvas = document.createElement("canvas");
    tCanvas.width = obj.w;
    tCanvas.height = obj.h;
    const tCtx = tCanvas.getContext("2d");

    tCtx.drawImage(cache.image, 0, 0, obj.w, obj.h);
    tCtx.globalCompositeOperation = "source-in";
    tCtx.fillStyle = bgColor;
    tCtx.fillRect(0, 0, obj.w, obj.h);

    const steps = Math.max(36, padding * 1.5);
    const stepAngle = (Math.PI * 2) / steps;

    for (let i = 0; i < steps; i++) {
      const dx = Math.cos(i * stepAngle) * padding;
      const dy = Math.sin(i * stepAngle) * padding;
      cCtx.drawImage(tCanvas, padding + dx, padding + dy);
    }
    cCtx.drawImage(tCanvas, padding, padding);

    cache.contourCanvas = cCanvas;
    cache.contourKey = cacheKey;
  }

  ctx.drawImage(cache.contourCanvas, obj.x - padding, obj.y - padding);
}

// ======================== ПОДЛОЖКА ========================
function drawObjectBackground(obj) {
  if (!obj.bgType || obj.bgType === "none") return;

  const padding = obj.bgPadding || 40;
  const bgColor = obj.bgColor || "#000000";

  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = bgColor;

  if (obj.bgType === "contour") {
    if (obj.type === "text") {
      ctx.lineWidth = padding * 2;
      ctx.lineJoin = "round";
      drawTextContent(obj, (text, x, y) => ctx.strokeText(text, x, y));
    } else if (obj.type === "image") {
      drawImageContour(obj, padding, bgColor);
    } else if (obj.type === "line" || obj.type === "curve") {
      ctx.lineWidth = (obj.thickness || 10) + padding * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      drawPath(obj);
    }
  } else if (obj.bgType === "rect") {
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
    } else if (obj.type === "line" || obj.type === "curve") {
      let minX = Math.min(obj.x1, obj.x2),
        maxX = Math.max(obj.x1, obj.x2);
      let minY = Math.min(obj.y1, obj.y2),
        maxY = Math.max(obj.y1, obj.y2);
      if (obj.type === "curve") {
        minX = Math.min(minX, obj.cx);
        maxX = Math.max(maxX, obj.cx);
        minY = Math.min(minY, obj.cy);
        maxY = Math.max(maxY, obj.cy);
      }
      bx = minX;
      by = minY;
      bw = maxX - minX;
      bh = maxY - minY;
    }
    if (bx !== undefined) {
      drawRoundedRect(
        bx - padding,
        by - padding,
        bw + padding * 2,
        bh + padding * 2,
        20,
      );
    }
  }
  ctx.restore();
}

function drawObject(obj) {
  if (obj.type === "bg-patch") {
    ctx.beginPath();
    ctx.strokeStyle = obj.mode === "erase" ? "#f5f5f5" : obj.color || "#000000";
    ctx.lineWidth = obj.thickness || 60;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (obj.points && obj.points.length > 0) {
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      for (let i = 1; i < obj.points.length; i++)
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
      ctx.stroke();
    }
    return;
  }

  drawObjectBackground(obj);

  if (obj.type === "image") {
    ctx.globalAlpha = obj.opacity || 1;
    if (renderCache[obj.id] && renderCache[obj.id].image.complete) {
      ctx.drawImage(renderCache[obj.id].image, obj.x, obj.y, obj.w, obj.h);
    } else {
      const img = new Image();
      img.src = obj.data;
      ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h);
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (obj.type === "rect") {
    ctx.globalAlpha = obj.opacity || 0.5;
    ctx.fillStyle = obj.color;
    const x = Math.min(obj.x1, obj.x2);
    const y = Math.min(obj.y1, obj.y2);
    ctx.fillRect(x, y, Math.abs(obj.x2 - obj.x1), Math.abs(obj.y2 - obj.y1));
    ctx.globalAlpha = 1;
    return;
  }

  const thick = parseInt(obj.thickness || 10);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (obj.type === "line" || obj.type === "curve") {
    ctx.strokeStyle = obj.outlineColor || "#000";
    ctx.lineWidth = thick + 6;
    drawPath(obj);
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = thick;
    drawPath(obj);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = thick / 3;
    ctx.globalAlpha = 0.4;
    drawPath(obj);
    ctx.globalAlpha = 1;
  } else if (obj.type === "text") {
    ctx.strokeStyle = obj.outlineColor || "#000";
    ctx.lineWidth = 8;
    drawTextContent(obj, (text, x, y) => ctx.strokeText(text, x, y));
    ctx.fillStyle = obj.color;
    drawTextContent(obj, (text, x, y) => ctx.fillText(text, x, y));
  }
}

export function drawPath(obj) {
  ctx.beginPath();
  ctx.moveTo(obj.x1, obj.y1);
  if (obj.type === "line") ctx.lineTo(obj.x2, obj.y2);
  else ctx.quadraticCurveTo(obj.cx, obj.cy, obj.x2, obj.y2);
  ctx.stroke();
}

function drawRoundedRect(x, y, width, height, radius) {
  if (width <= 0 || height <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// ======================== РЕНДЕР ========================
export function render() {
  // reset transform to clear full canvas
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // apply view transform (scale and pan)
  ctx.setTransform(state.view.scale, 0, 0, state.view.scale, state.view.offsetX, state.view.offsetY);

  if (objCountDisplay) objCountDisplay.innerText = state.objects.length;

  state.objects.forEach(drawObject);

  if (state.currentMode === "select") renderSelectionFrames();

  if (state.isDrawing && state.startPoint && state.currentMousePos) {
    ctx.save();
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = Math.max(3, parseInt(thicknessSlider.value) || 10);
    ctx.lineCap = "round";
    ctx.shadowColor = colorPicker.value;
    ctx.shadowBlur = 8;

    if (state.currentMode === "line") {
      ctx.beginPath();
      ctx.moveTo(state.startPoint.x, state.startPoint.y);
      ctx.lineTo(state.currentMousePos.x, state.currentMousePos.y);
      ctx.stroke();
    } else if (state.currentMode === "rect") {
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        Math.min(state.startPoint.x, state.currentMousePos.x),
        Math.min(state.startPoint.y, state.currentMousePos.y),
        Math.abs(state.currentMousePos.x - state.startPoint.x),
        Math.abs(state.currentMousePos.y - state.startPoint.y),
      );
    } else if (state.currentMode === "curve") {
      ctx.beginPath();
      ctx.moveTo(state.startPoint.x, state.startPoint.y);
      ctx.quadraticCurveTo(
        state.currentMousePos.x,
        state.currentMousePos.y,
        state.currentMousePos.x,
        state.currentMousePos.y,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  if (state.isBending && state.activeCurve) {
    drawObject(state.activeCurve);
    ctx.fillStyle = "#ffcc00";
    ctx.beginPath();
    ctx.arc(state.activeCurve.cx, state.activeCurve.cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.isSelecting && state.selectionStart && state.selectionEnd) {
    const rx = Math.min(state.selectionStart.x, state.selectionEnd.x);
    const ry = Math.min(state.selectionStart.y, state.selectionEnd.y);
    const rw = Math.abs(state.selectionEnd.x - state.selectionStart.x);
    const rh = Math.abs(state.selectionEnd.y - state.selectionStart.y);
    ctx.save();
    ctx.strokeStyle = "#007bff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }

  updateLayersPanel();
  updateSelectionUI();
}

export function updateSelectionUI() {
  const btnGroup = document.getElementById("btn-group");
  const btnUngroup = document.getElementById("btn-ungroup");

  if (btnGroup && btnUngroup) {
    if (state.selectedObjects.length > 0 && state.selectedObjects[0].groupId) {
      btnGroup.style.display = "none";
      btnUngroup.style.display = "block";
    } else {
      btnGroup.style.display = "block";
      btnUngroup.style.display = "none";
      if (state.selectedObjects.length < 2) {
        btnGroup.disabled = true;
        btnGroup.classList.replace("btn-success", "btn-secondary");
      } else {
        btnGroup.disabled = false;
        btnGroup.classList.replace("btn-secondary", "btn-success");
      }
    }
  }

  const target =
    state.selectedObjects.length > 0
      ? state.selectedObjects[0]
      : state.selectedObj;
  if (target) {
    bgTypeSelect.value = target.bgType || "none";
    bgPaddingInput.value = target.bgPadding || 40;
    bgColorPicker.value = target.bgColor || "#000000";

    if (target.type === "text") {
      mainInput.value = target.content;
      sizeSlider.value = target.size;
      fontSelect.value = target.font || "Montserrat";
      textOrientation.value = target.orientation || "horizontal";
    }
    if (target.color) colorPicker.value = target.color;
    if (target.outlineColor) outlinePicker.value = target.outlineColor;
    if (target.thickness) {
      thicknessSlider.value = target.thickness;
      if (thicknessVal) thicknessVal.innerText = target.thickness + " мм";
    }
    if (target.opacity !== undefined) opacityInput.value = target.opacity;
  }
}

export function renderSelectionFrames() {
  ctx.save();
  ctx.strokeStyle = "#007bff";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);

  const targets =
    state.selectedObjects.length > 0
      ? state.selectedObjects
      : state.selectedObj
        ? [state.selectedObj]
        : [];
  targets.forEach((obj) => {
    if (!obj) return;

    if (obj.type === "bg-patch") {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      obj.points.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
      return;
    }

    if (obj.type === "text") {
      const { w, h } = getTextMetrics(obj);
      ctx.strokeRect(obj.x - w / 2 - 10, obj.y - h / 2 - 10, w + 20, h + 20);
    } else if (obj.type === "image") {
      ctx.strokeRect(obj.x - 5, obj.y - 5, obj.w + 10, obj.h + 10);
    } else if (obj.type === "rect") {
      const x = Math.min(obj.x1, obj.x2),
        y = Math.min(obj.y1, obj.y2);
      const w = Math.abs(obj.x2 - obj.x1),
        h = Math.abs(obj.y2 - obj.y1);
      ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
    } else if (obj.type === "line" || obj.type === "curve") {
      let minX = Math.min(obj.x1, obj.x2),
        maxX = Math.max(obj.x1, obj.x2);
      let minY = Math.min(obj.y1, obj.y2),
        maxY = Math.max(obj.y1, obj.y2);
      if (obj.type === "curve") {
        minX = Math.min(minX, obj.cx);
        maxX = Math.max(maxX, obj.cx);
        minY = Math.min(minY, obj.cy);
        maxY = Math.max(maxY, obj.cy);
      }
      ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
    }
  });
  ctx.restore();
}

// ======================== МЕНЕДЖЕР СЛОЁВ (рендер панели) ========================
export function updateLayersPanel() {
  const panel = document.getElementById("layersPanel");
  if (!panel) return;
  panel.innerHTML = "";

  state.objects.forEach((obj, i) => {
    if (!obj.id) obj.id = "obj_" + Date.now() + "_" + i;
  });

  let logicalLayers = [];
  let processedGroups = new Set();

  for (let i = state.objects.length - 1; i >= 0; i--) {
    const obj = state.objects[i];
    if (obj.type === "bg-patch") {
      logicalLayers.push({
        isGroup: false,
        id: obj.id,
        name: obj.mode === "erase" ? "✂️ Ластик" : "🖌️ Мазок подложки",
      });
      continue;
    }
    if (obj.groupId) {
      if (processedGroups.has(obj.groupId)) continue;
      processedGroups.add(obj.groupId);
      logicalLayers.push({
        isGroup: true,
        id: obj.groupId,
        name: "Сгруппировано",
      });
    } else {
      let name = "Объект";
      if (obj.type === "text")
        name = `Текст: ${obj.content.substring(0, 8)}...`;
      else if (obj.type === "image") name = "🖼️ Картинка";
      else if (obj.type === "rect") name = "🟩 Прямоугольник";
      else if (obj.type === "curve") name = "〰️ Неон (кривая)";
      else if (obj.type === "line") name = "📏 Неон (линия)";
      logicalLayers.push({ isGroup: false, id: obj.id, name });
    }
  }

  logicalLayers.forEach((layer, idx) => {
    const div = document.createElement("div");
    div.className = `layer-item d-flex justify-content-between align-items-center rounded mb-1 px-2 py-1 ${state.selectedObj && (state.selectedObj.id === layer.id || state.selectedObj.groupId === layer.id) ? "active" : ""}`;
    div.innerHTML = `
            <span>${layer.isGroup ? "🔗 " : ""}${layer.name}</span>
            <div class="layer-actions">
                <button title="Поднять выше" onclick="moveLayer('${layer.id}', ${layer.isGroup}, 1)"><i class="fas fa-chevron-up"></i></button>
                <button title="Опустить ниже" onclick="moveLayer('${layer.id}', ${layer.isGroup}, -1)"><i class="fas fa-chevron-down"></i></button>
                <button class="btn-delete" title="Удалить" onclick="deleteLayer('${layer.id}', ${layer.isGroup})"><i class="fas fa-trash"></i></button>
            </div>
        `;

    // Enable native drag & drop on layer items
    div.setAttribute("draggable", "true");
    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ id: layer.id, isGroup: layer.isGroup, srcIndex: idx }),
      );
      e.dataTransfer.effectAllowed = "move";
      div.classList.add("dragging");
    });

    div.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      div.classList.add("drag-over");
    });

    div.addEventListener("dragleave", () => div.classList.remove("drag-over"));

    div.addEventListener("drop", (e) => {
      e.preventDefault();
      div.classList.remove("drag-over");
      let data;
      try {
        data = JSON.parse(e.dataTransfer.getData("text/plain"));
      } catch (err) {
        return;
      }
      const srcIdx = data.srcIndex;
      const destIdx = idx;
      if (srcIdx === destIdx) return;

      // Reorder logicalLayers according to drag result
      const newLogical = [...logicalLayers];
      const [moved] = newLogical.splice(srcIdx, 1);
      newLogical.splice(destIdx, 0, moved);

      // Rebuild state.objects from new logical order (bottom -> top)
      const newObjects = [];
      for (let j = newLogical.length - 1; j >= 0; j--) {
        const L = newLogical[j];
        if (L.isGroup) {
          state.objects.forEach((o) => {
            if (o.groupId === L.id) newObjects.push(o);
          });
        } else {
          state.objects.forEach((o) => {
            if (o.id === L.id) newObjects.push(o);
          });
        }
      }

      saveHistory();
      state.objects = newObjects;
      state.selectedObj = null;
      state.selectedObjects = [];
      render();
    });

    div.addEventListener("dragend", () => div.classList.remove("dragging"));

    div.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      if (layer.isGroup) {
        state.selectedObjects = state.objects.filter((o) => o.groupId === layer.id);
        state.selectedObj = state.selectedObjects[0];
      } else {
        state.selectedObj = state.objects.find((o) => o.id === layer.id);
        state.selectedObjects = [state.selectedObj];
      }
      render();
    });

    panel.appendChild(div);
  });
}
