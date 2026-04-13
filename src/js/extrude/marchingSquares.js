// marchingSquares.js
export function marchingSquares(imageData, threshold = 128, simplifyTolerance = 1.0) {
  const { width, height, data } = imageData;
  const contours = [];

  const isInside = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
    return data[idx + 3] >= threshold;
  };

  const edgeTable = new Array(16).fill().map(() => []);
  const buildEdgeTable = () => {
    const edges = [
      [[0, 1], [0, 0]], [[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0], [1, 1]],
      [[0, 0], [1, 0]], [[0, 1], [1, 0]], [[1, 0], [0, 1]], [[0, 1], [1, 1]],
      [[0, 1], [1, 1]], [[0, 0], [1, 0]], [[0, 1], [1, 0]], [[1, 0], [1, 1]],
      [[0, 0], [1, 1]], [[0, 1], [1, 0]], [[1, 0], [0, 1]], [[0, 0], [0, 1]]
    ];
    for (let i = 0; i < 16; i++) {
      const lines = [];
      const e = edges[i];
      for (let k = 0; k < e.length; k += 2) {
        lines.push([e[k], e[k + 1]]);
      }
      edgeTable[i] = lines;
    }
  };
  buildEdgeTable();

  const segments = [];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = isInside(x, y);
      const tr = isInside(x + 1, y);
      const br = isInside(x + 1, y + 1);
      const bl = isInside(x, y + 1);

      let index = 0;
      if (tl) index |= 1;
      if (tr) index |= 2;
      if (br) index |= 4;
      if (bl) index |= 8;

      if (index === 0 || index === 15) continue;

      const lines = edgeTable[index];
      for (const line of lines) {
        const getPos = (ax, ay, bx, by) => {
          const aInside = isInside(ax, ay);
          const bInside = isInside(bx, by);
          if (aInside === bInside) return [(ax + bx) / 2, (ay + by) / 2];
          const aAlpha = data[(ay * width + ax) * 4 + 3];
          const bAlpha = data[(by * width + bx) * 4 + 3];
          const t = (threshold - aAlpha) / (bAlpha - aAlpha);
          return [ax + (bx - ax) * t, ay + (by - ay) * t];
        };

        const midPoints = [];
        const edgePairs = [
          [[x, y], [x + 1, y]],
          [[x + 1, y], [x + 1, y + 1]],
          [[x + 1, y + 1], [x, y + 1]],
          [[x, y + 1], [x, y]]
        ];
        for (let e = 0; e < 4; e++) {
          const aInside = isInside(...edgePairs[e][0]);
          const bInside = isInside(...edgePairs[e][1]);
          if (aInside !== bInside) {
            const [mx, my] = getPos(...edgePairs[e][0], ...edgePairs[e][1]);
            midPoints.push([mx, my]);
          }
        }
        if (midPoints.length === 2) {
          segments.push([midPoints[0], midPoints[1]]);
        }
      }
    }
  }

  // Сборка контуров
  const chains = [];
  const used = new Array(segments.length).fill(false);

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let chain = [segments[i][0], segments[i][1]];
    let head = segments[i][1];
    let tail = segments[i][0];

    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const s = segments[j];
        const eps = 0.001;
        if (Math.abs(s[0][0] - head[0]) < eps && Math.abs(s[0][1] - head[1]) < eps) {
          chain.push(s[1]);
          head = s[1];
          used[j] = true;
          changed = true;
          break;
        } else if (Math.abs(s[1][0] - head[0]) < eps && Math.abs(s[1][1] - head[1]) < eps) {
          chain.push(s[0]);
          head = s[0];
          used[j] = true;
          changed = true;
          break;
        } else if (Math.abs(s[0][0] - tail[0]) < eps && Math.abs(s[0][1] - tail[1]) < eps) {
          chain.unshift(s[1]);
          tail = s[1];
          used[j] = true;
          changed = true;
          break;
        } else if (Math.abs(s[1][0] - tail[0]) < eps && Math.abs(s[1][1] - tail[1]) < eps) {
          chain.unshift(s[0]);
          tail = s[0];
          used[j] = true;
          changed = true;
          break;
        }
      }
    }
    if (Math.abs(chain[0][0] - chain[chain.length - 1][0]) < 0.01 &&
        Math.abs(chain[0][1] - chain[chain.length - 1][1]) < 0.01) {
      chain.pop();
    }
    if (chain.length > 5) {
      chains.push(chain);
    }
  }

  // Упрощение Рамера-Дугласа-Пекера
  function simplify(points, epsilon) {
    if (points.length < 3) return points;
    const sqEpsilon = epsilon * epsilon;
    function distanceSqToSegment(p, v, w) {
      const l2 = (v[0] - w[0]) ** 2 + (v[1] - w[1]) ** 2;
      if (l2 === 0) return (p[0] - v[0]) ** 2 + (p[1] - v[1]) ** 2;
      let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
      t = Math.max(0, Math.min(1, t));
      const proj = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
      return (p[0] - proj[0]) ** 2 + (p[1] - proj[1]) ** 2;
    }
    function rdp(start, end) {
      let maxDist = 0;
      let index = -1;
      for (let i = start + 1; i < end; i++) {
        const d = distanceSqToSegment(points[i], points[start], points[end]);
        if (d > maxDist) {
          maxDist = d;
          index = i;
        }
      }
      if (maxDist > sqEpsilon) {
        const left = rdp(start, index);
        const right = rdp(index, end);
        return left.slice(0, -1).concat(right);
      } else {
        return [points[start], points[end]];
      }
    }
    return rdp(0, points.length - 1);
  }

  const simplifiedChains = chains.map(chain => simplify(chain, simplifyTolerance));
  return simplifiedChains;
}

export default marchingSquares;
