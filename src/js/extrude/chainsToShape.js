import * as THREE from 'three';

export function chainsToShape(chains, imgWidth, imgHeight) {
  const scale = 2 / Math.max(imgWidth, imgHeight);
  const offsetX = -imgWidth / 2 * scale;
  const offsetY = -imgHeight / 2 * scale;

  const shapes = [];
  for (const chain of chains) {
    const points = chain.map(p => new THREE.Vector2(
      p[0] * scale + offsetX,
      (imgHeight - p[1]) * scale + offsetY
    ));
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      area += (p2.x - p1.x) * (p2.y + p1.y);
    }
    if (area > 0) {
      points.reverse();
    }
    if (points.length > 2) {
      shapes.push(new THREE.Shape(points));
    }
  }
  return shapes.length > 0 ? shapes[0] : null;
}

export default chainsToShape;
