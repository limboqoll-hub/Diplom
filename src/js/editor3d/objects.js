import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { ctx, renderCache, settings } from "../core/state.js";
import {
  createBaseMaterial,
  createMetalMaterial,
  createNeonMaterial,
} from "./materials.js";
import { state3d } from "./state3d.js";

function createMaterial(colorHex, type) {
  if (type === "neon") return createNeonMaterial(colorHex);
  if (type === "metal") return createMetalMaterial(colorHex);
  return createBaseMaterial(colorHex);
}

// Compute average color of an image (returns CSS rgb string)
function getImageAverageColor(img) {
  try {
    const size = 16;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const cx = c.getContext("2d");
    cx.clearRect(0, 0, size, size);
    cx.drawImage(img, 0, 0, size, size);
    const data = cx.getImageData(0, 0, size, size).data;
    let r = 0,
      g = 0,
      b = 0,
      count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha === 0) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (count === 0) return "#ffffff";
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    return `rgb(${r}, ${g}, ${b})`;
  } catch (e) {
    return "#ffffff";
  }
}

// ======================== ПОДЛОЖКА В 3D ========================
export function generate3DBackground(obj, cx, cy) {
  if (!obj.bgType || obj.bgType === "none") return;

  const padding = obj.bgPadding || 40;
  const depth = (obj.depth3d || 15) * 0.3;
  let shape = new THREE.Shape();

  if (obj.type === "text") {
    // If contour background requested, generate contour canvas-based background
    if (obj.bgType === "contour") {
      generate3DTextContour(obj, cx, cy, padding, depth);
      return;
    }

    let w, h;
    if (obj._3dTextSize) {
      w = obj._3dTextSize.w + padding * 2;
      h = obj._3dTextSize.h + padding * 2;
    } else {
      ctx.font = `bold ${obj.size}px "${obj.font || "Montserrat"}"`;
      w = ctx.measureText(obj.content).width + padding * 2;
      h = parseInt(obj.size) + padding * 2;
    }
    const x = obj.x - w / 2,
      y = obj.y - h / 2;
    const radius = Math.min(30, w / 5, h / 5);
    buildRoundedShape(shape, x - cx, -(y - cy), w, h, radius);
  } else if (obj.type === "image") {
    if (obj.bgType === "contour") {
      generate3DImageContour(obj, cx, cy, padding, depth);
      return;
    }
    const w = obj.w + padding * 2,
      h = obj.h + padding * 2;
    const x = obj.x - padding,
      y = obj.y - padding;
    const radius = Math.min(20, w / 5, h / 5);
    buildRoundedShape(shape, x - cx, -(y - cy), w, h, radius);
  } else if (obj.type === "line" || obj.type === "curve") {
    const thickness = (obj.thickness || 10) + padding * 2;
    const x1 = obj.x1 - cx,
      y1 = -(obj.y1 - cy);
    const x2 = obj.x2 - cx,
      y2 = -(obj.y2 - cy);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const perpX = (Math.sin(angle) * thickness) / 2;
    const perpY = (-Math.cos(angle) * thickness) / 2;
    shape.moveTo(x1 + perpX, y1 + perpY);
    shape.lineTo(x1 - perpX, y1 - perpY);
    shape.lineTo(x2 - perpX, y2 - perpY);
    shape.lineTo(x2 + perpX, y2 + perpY);
    shape.lineTo(x1 + perpX, y1 + perpY);
  } else if (obj.type === "rect") {
    const w = Math.abs(obj.x2 - obj.x1) + padding * 2;
    const h = Math.abs(obj.y2 - obj.y1) + padding * 2;
    const x = Math.min(obj.x1, obj.x2) - padding;
    const y = Math.min(obj.y1, obj.y2) - padding;
    const radius = Math.min(15, w / 5, h / 5);
    buildRoundedShape(shape, x - cx, -(y - cy), w, h, radius);
  } else {
    return;
  }

  const extrudeSettings = {
    steps: 1,
    depth,
    bevelEnabled: true,
    bevelThickness: 2,
    bevelSize: 1.5,
    bevelSegments: 4,
  };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.computeVertexNormals();
  geometry.center();

  const material = new THREE.MeshStandardMaterial({
    color: obj.bgColor || "#222222",
    roughness: 0.5,
    metalness: 0.1,
    transparent: obj.bgType !== "contour",
    opacity: obj.bgType === "contour" ? 1 : 0.85,
  });

  const mesh = new THREE.Mesh(geometry, material);
  // compute position depending on object type so background aligns with 2D
  let posX = obj.x - cx;
  let posY = -(obj.y - cy);
  if (obj.type === "image") {
    posX = obj.x - cx + (obj.w || 0) / 2;
    
  } else if (obj.type === "rect") {
    const centerX = (obj.x1 + obj.x2) / 2;
    const centerY = (obj.y1 + obj.y2) / 2;
    posX = centerX - cx;
    posY = -(centerY - cy);
  }
  mesh.position.set(posX, posY, -depth);
  mesh.castShadow = true;
  mesh.userData = { originalObj: obj, isBackground: true };
  state3d.scene.add(mesh);
  state3d.objects3D.push(mesh);
}

function buildRoundedShape(shape, x, y, w, h, r) {
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y - r);
  shape.lineTo(x + w, y - h + r);
  shape.quadraticCurveTo(x + w, y - h, x + w - r, y - h);
  shape.lineTo(x + r, y - h);
  shape.quadraticCurveTo(x, y - h, x, y - h + r);
  shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x + r, y);
}
// ======================== 3D-ОБВОДКА ИЗОБРАЖЕНИЯ ПО КОНТУРУ ========================
function generate3DImageContour(obj, cx, cy, padding, depth) {
  const cached = renderCache[obj.id];
  if (!cached || !cached.image) return;
  const bgColor = obj.bgColor || "#000000";
  const cacheKey = `${padding}_${bgColor}_${obj.w}_${obj.h}`;

  if (!cached.contourCanvas || cached.contourKey !== cacheKey) {
    const pw = obj.w + padding * 2;
    const ph = obj.h + padding * 2;
    const cCanvas = document.createElement("canvas");
    cCanvas.width = pw;
    cCanvas.height = ph;
    const cCtx = cCanvas.getContext("2d");

    const tCanvas = document.createElement("canvas");
    tCanvas.width = obj.w;
    tCanvas.height = obj.h;
    const tCtx = tCanvas.getContext("2d");
    tCtx.clearRect(0, 0, obj.w, obj.h);
    tCtx.drawImage(cached.image, 0, 0, obj.w, obj.h);
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

    cached.contourCanvas = cCanvas;
    cached.contourKey = cacheKey;
  }

  const pw = obj.w + padding * 2;
  const ph = obj.h + padding * 2;
  const texture = new THREE.CanvasTexture(cached.contourCanvas);
  texture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(pw, ph);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    opacity: obj.bgType === "contour" ? 1 : 0.85,
    side: THREE.DoubleSide,
    alphaTest: 0.05,
    depthWrite: false,
    depthTest: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // ensure background is rendered before main objects
  mesh.renderOrder = 0;
  mesh.position.set(
    obj.x - cx + obj.w / 2,
    -(obj.y - cy + obj.h / 2),
    -depth * 0.3,
  );
  mesh.userData = { originalObj: obj, isBackground: true };
  state3d.scene.add(mesh);
  state3d.objects3D.push(mesh);
}

// ======================== 3D-КОНТУР ДЛЯ ТЕКСТА ========================
function generate3DTextContour(obj, cx, cy, padding, depth) {
  const fontName = obj.font || "Montserrat";
  const fontSize = parseInt(obj.size) || 60;
  const lines = obj.orientation === "vertical" ? (obj.content || "").split("") : (obj.content || "").split("\n");
  const lh = Math.ceil(fontSize * 1.2);

  const doCreate = () => {
    // Determine text canvas size
    const tmpCtx = ctx; // reuse global 2D context for measurements
    tmpCtx.save();
    tmpCtx.font = `bold ${fontSize}px "${fontName}"`;
    let maxW = 0;
    for (const l of lines) {
      const m = tmpCtx.measureText(l).width;
      if (m > maxW) maxW = m;
    }
    tmpCtx.restore();

    const textW = Math.ceil(maxW) + 20;
    const textH = Math.ceil(lines.length * lh) + 20;

    const pw = textW + padding * 2;
    const ph = textH + padding * 2;

    const cCanvas = document.createElement("canvas");
    cCanvas.width = pw;
    cCanvas.height = ph;
    const cCtx = cCanvas.getContext("2d");

    const tCanvas = document.createElement("canvas");
    tCanvas.width = textW;
    tCanvas.height = textH;
    const tCtx = tCanvas.getContext("2d");
    tCtx.clearRect(0, 0, textW, textH);
    tCtx.font = `bold ${fontSize}px "${fontName}"`;
    tCtx.textAlign = "center";
    tCtx.textBaseline = "middle";

    // draw mask text (white) to tCanvas
    const startY = textH / 2 - (lines.length - 1) * (lh / 2);
    tCtx.fillStyle = "#ffffff";
    for (let i = 0; i < lines.length; i++) {
      tCtx.fillText(lines[i], textW / 2, startY + i * lh);
    }

    // colorize mask with bgColor
    tCtx.globalCompositeOperation = "source-in";
    tCtx.fillStyle = obj.bgColor || "#000000";
    tCtx.fillRect(0, 0, textW, textH);

    // grow the mask by drawing shifted copies into cCtx
    const steps = Math.max(36, Math.round(padding * 1.5));
    const stepAngle = (Math.PI * 2) / steps;
    for (let i = 0; i < steps; i++) {
      const dx = Math.cos(i * stepAngle) * padding;
      const dy = Math.sin(i * stepAngle) * padding;
      cCtx.drawImage(tCanvas, padding + dx, padding + dy);
    }
    // main copy
    cCtx.drawImage(tCanvas, padding, padding);

    const texture = new THREE.CanvasTexture(cCanvas);
    texture.needsUpdate = true;

    const geometry = new THREE.PlaneGeometry(pw, ph);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    // text obj.x/obj.y are centers (unlike images), position plane by center
    mesh.position.set(obj.x - cx, -(obj.y - cy), -depth * 0.3);
    mesh.userData = { originalObj: obj, isBackground: true };
    state3d.scene.add(mesh);
    state3d.objects3D.push(mesh);
  };

  if (document.fonts && document.fonts.load) {
    document.fonts
      .load(`${fontSize}px "${fontName}"`)
      .then(() => doCreate())
      .catch(() => doCreate());
  } else {
    doCreate();
  }
}

// ======================== 3D-ОБЪЕКТЫ ========================
export function generate3DObject(obj, cx, cy) {
  const depth = obj.depth3d || 15;
  const matType = obj.material3d || "neon";
  let mesh = null;

  if (obj.type === "image") {
    const cached = renderCache[obj.id];
    if (cached && cached.image) {
      const canvas2D = document.createElement("canvas");
      canvas2D.width = obj.w;
      canvas2D.height = obj.h;
      const ctx2D = canvas2D.getContext("2d");
      ctx2D.clearRect(0, 0, obj.w, obj.h);
      ctx2D.drawImage(cached.image, 0, 0, obj.w, obj.h);

      const texture = new THREE.CanvasTexture(canvas2D);
      texture.needsUpdate = true;

      const geometry = new THREE.PlaneGeometry(obj.w, obj.h);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.1,
      });
      mesh = new THREE.Mesh(geometry, material);
      // make sure main image is drawn after background
      mesh.renderOrder = 10;
      mesh.position.set(
        obj.x - cx + obj.w / 2,
        -(obj.y - cy + obj.h / 2),
        depth / 2,
      );
      mesh.castShadow = true;
      // if image-brightness toggle enabled, use the image as an emissiveMap
      // so the texture appears brighter while preserving its colors
      if (settings.imageGlow) {
        try {
          if (material && material.emissiveMap !== undefined) {
            material.emissiveMap = texture;
            material.emissive = new THREE.Color(0xffffff);
            material.emissiveIntensity = 1.2; // brightness factor
            material.needsUpdate = true;
          }
        } catch (e) {}
      }
    }
  } else if (obj.type === "text") {
    // If text contains Cyrillic, many three.js typeface JSON fonts (e.g. Helvetiker)
    // won't have glyphs. Fallback to drawing text on a canvas and use a
    // CanvasTexture mapped to a plane. For Latin-only text, use TextGeometry
    // when a proper 3D font is loaded.
    const containsCyr = /[\u0400-\u04FF]/.test(obj.content);
    // By default render text to a canvas so webfonts (selected fonts) are used
    // If user explicitly sets `use3dFont` and a three.js font is loaded, use TextGeometry
    if (obj.use3dFont && !containsCyr && state3d.loaded3DFont) {
      const material = createMaterial(obj.color || "#ffcc00", matType);
      const textGeo = new TextGeometry(obj.content, {
        font: state3d.loaded3DFont,
        size: parseInt(obj.size),
        height: depth,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 1.5,
        bevelSize: 0.8,
        bevelSegments: 4,
      });
      textGeo.computeBoundingBox();
      const box = textGeo.boundingBox;
      const cxOff = (box.min.x + box.max.x) / 2;
      const cyOff = (box.min.y + box.max.y) / 2;
      mesh = new THREE.Mesh(textGeo, material);
      mesh.position.set(obj.x - cx - cxOff, -(obj.y - cy) - cyOff, depth / 2);
      mesh.castShadow = true;
        // apply glow for TextGeometry if enabled
        if (settings.textGlow) {
          try {
            if (material && material.emissive !== undefined) {
              material.emissive = new THREE.Color(obj.color || "#ffcc00");
              material.emissiveIntensity = 1.2;
            }
          } catch (e) {}
          const light = new THREE.PointLight(obj.color || "#ffcc00", 0.8, 200);
          mesh.add(light);
        }
        if (obj._3dTextSize) delete obj._3dTextSize;
    } else {
      // Render text to canvas to support Cyrillic and arbitrary fonts.
      const fontName = obj.font || "Montserrat";
      const fontSize = parseInt(obj.size) || 60;

      const createTextMesh = () => {
        // measure using a temporary context and handle vertical orientation
        const tmp = ctx;
        tmp.save();
        tmp.font = `bold ${fontSize}px "${fontName}"`;
        const lineHeight = Math.ceil(fontSize * 1.2);
        let textLines = (obj.content || "").split("\n");
        if (obj.orientation === "vertical") textLines = obj.content.split("");
        let maxLineW = 0;
        for (const l of textLines) {
          const m = tmp.measureText(l).width;
          if (m > maxLineW) maxLineW = m;
        }
        tmp.restore();

        const textW = Math.ceil(maxLineW) + 20;
        const textH = Math.ceil(textLines.length * lineHeight) + 20;

        const canvas2D = document.createElement("canvas");
        const ratio = window.devicePixelRatio || 1;
        canvas2D.width = textW * ratio;
        canvas2D.height = textH * ratio;
        canvas2D.style.width = `${textW}px`;
        canvas2D.style.height = `${textH}px`;
        const ctx2D = canvas2D.getContext("2d");
        ctx2D.scale(ratio, ratio);
        ctx2D.clearRect(0, 0, textW, textH);
        ctx2D.font = `bold ${fontSize}px "${fontName}"`;
        ctx2D.textAlign = "center";
        ctx2D.textBaseline = "middle";

        // Support explicit line breaks and vertical orientation (reuse measured lines)
        // draw filled lines/chars
        ctx2D.fillStyle = obj.color || "#ffcc00";
        const startY = textH / 2 - (textLines.length - 1) * (lineHeight / 2);
        for (let i = 0; i < textLines.length; i++) {
          ctx2D.fillText(textLines[i], textW / 2, startY + i * lineHeight);
        }

        const texture = new THREE.CanvasTexture(canvas2D);
        texture.needsUpdate = true;

        const geometry = new THREE.PlaneGeometry(textW, textH);
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const textMesh = new THREE.Mesh(geometry, material);
        textMesh.position.set(obj.x - cx, -(obj.y - cy), depth / 2);
        textMesh.castShadow = true;
        textMesh.userData = { originalObj: obj, isBackground: false };
        state3d.scene.add(textMesh);
        state3d.objects3D.push(textMesh);
        // apply glow for canvas-based text
        if (settings.textGlow) {
          try {
            if (material && material.emissive !== undefined) {
              material.emissive = new THREE.Color(obj.color || "#ffcc00");
              material.emissiveIntensity = 1.0;
            }
          } catch (e) {}
          const light = new THREE.PointLight(obj.color || "#ffcc00", 0.6, 200);
          textMesh.add(light);
        }
        // Store rendered canvas text size so background generator can match it
        obj._3dTextSize = { w: textW, h: textH };
        if (matType === "neon") {
          const light = new THREE.PointLight(obj.color || "#ffcc00", 0.6, 150);
          textMesh.add(light);
        }
      };

      if (document.fonts && document.fonts.load) {
        document.fonts.load(`${fontSize}px "${fontName}"`).then(createTextMesh).catch(createTextMesh);
      } else {
        createTextMesh();
      }
    }
  } else if (obj.type === "line") {
    const material = createMaterial(obj.color || "#ffcc00", matType);
    const points = [
      new THREE.Vector3(obj.x1 - cx, -(obj.y1 - cy), 0),
      new THREE.Vector3(obj.x2 - cx, -(obj.y2 - cy), 0),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(
      curve,
      20,
      (obj.thickness || 10) / 2,
      16,
      false,
    );
    mesh = new THREE.Mesh(tubeGeo, material);
    mesh.castShadow = true;
  } else if (obj.type === "rect") {
    const material = createMaterial(obj.color || "#ffcc00", matType);
    const w = Math.abs(obj.x2 - obj.x1),
      h = Math.abs(obj.y2 - obj.y1);
    const boxGeo = new THREE.BoxGeometry(w, h, depth);
    mesh = new THREE.Mesh(boxGeo, material);
    mesh.position.set(
      Math.min(obj.x1, obj.x2) - cx + w / 2,
      -(Math.min(obj.y1, obj.y2) - cy + h / 2),
      depth / 2,
    );
    mesh.castShadow = true;
  }
  else if (obj.type === "paint") {
    // Render paint stroke to a canvas and map it to a plane texture
    if (obj.points && obj.points.length > 0) {
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
      const padding = (obj.size || 10) * 1.5;
      const w = Math.max(1, Math.ceil(maxX - minX + padding * 2));
      const h = Math.max(1, Math.ceil(maxY - minY + padding * 2));

      const canvas2D = document.createElement("canvas");
      const ratio = window.devicePixelRatio || 1;
      canvas2D.width = Math.ceil(w * ratio);
      canvas2D.height = Math.ceil(h * ratio);
      canvas2D.style.width = `${w}px`;
      canvas2D.style.height = `${h}px`;
      const ctx2D = canvas2D.getContext("2d");
      ctx2D.scale(ratio, ratio);
      ctx2D.clearRect(0, 0, w, h);

      ctx2D.lineCap = "round";
      ctx2D.lineJoin = "round";
      ctx2D.strokeStyle = obj.color || "#000";
      ctx2D.globalAlpha = obj.opacity !== undefined ? obj.opacity : 1;
      ctx2D.lineWidth = obj.size || 10;
      if (obj.brushType === "soft") {
        // soft brush approximation: draw multiple semi-transparent strokes
        ctx2D.shadowColor = obj.color || "#000";
        ctx2D.shadowBlur = Math.max(1, (obj.size || 10) / 2);
      }

      ctx2D.beginPath();
      // draw relative to top-left (minX - padding, minY - padding)
      const offX = -minX + padding;
      const offY = -minY + padding;
      ctx2D.moveTo(obj.points[0].x + offX, obj.points[0].y + offY);
      for (let i = 1; i < obj.points.length; i++) {
        const p = obj.points[i];
        ctx2D.lineTo(p.x + offX, p.y + offY);
      }
      ctx2D.stroke();

      const texture = new THREE.CanvasTexture(canvas2D);
      texture.needsUpdate = true;

      const geometry = new THREE.PlaneGeometry(w, h);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      mesh = new THREE.Mesh(geometry, material);
      // position: center of bbox
      const centerX = minX + (maxX - minX) / 2;
      const centerY = minY + (maxY - minY) / 2;
      mesh.position.set(centerX - cx, -(centerY - cy), depth / 2);
      mesh.castShadow = true;
    }
  }

  if (mesh) {
    mesh.userData = { originalObj: obj, isBackground: false };
    state3d.scene.add(mesh);
    state3d.objects3D.push(mesh);

    if (matType === "neon" && (obj.type === "line" || obj.type === "text")) {
      const light = new THREE.PointLight(obj.color || "#ffcc00", 0.6, 150);
      mesh.add(light);
    }
  }
}
