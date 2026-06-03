import type { MonoBitmap } from "@/types/project";

export type BitmapFitMode = "stretch" | "contain" | "cover";
export type BitmapInterpolation = "nearest" | "bilinear";

export interface BitmapProcessingOptions {
  width: number;
  height: number;
  fitMode: BitmapFitMode;
  interpolation: BitmapInterpolation;
  threshold: number;
  invert: boolean;
  contrast: number;
  gamma: number;
  horizontalGap: number;
  verticalGap: number;
  diagonalGap: number;
  gapFillPasses: number;
  bridgeDistance: number;
  reinforceMinRun: number;
  reinforceRadius: number;
  dilateIterations: number;
  despeckleMinArea: number;
}

export interface BitmapProcessingResult {
  sourceBitmap: MonoBitmap;
  outputBitmap: MonoBitmap;
  litPixels: number;
  density: number;
}

interface BinaryComponent {
  label: number;
  pixels: number[];
  boundaries: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface BridgeCandidate {
  leftLabel: number;
  rightLabel: number;
  distance: number;
  leftIndex: number;
  rightIndex: number;
}

const EIGHT_NEIGHBORS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

const DIAGONAL_DIRECTIONS = [
  [1, 1],
  [1, -1],
] as const;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toBinaryRows(buffer: Uint8Array, width: number, height: number): string[] {
  const rows: string[] = new Array(height);
  for (let y = 0; y < height; y += 1) {
    let row = "";
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      row += buffer[rowOffset + x] > 0 ? "1" : "0";
    }
    rows[y] = row;
  }
  return rows;
}

function toMonoBitmap(buffer: Uint8Array, width: number, height: number): MonoBitmap {
  return {
    width,
    height,
    rows: toBinaryRows(buffer, width, height),
  };
}

function drawImageToCanvas(
  image: HTMLImageElement,
  width: number,
  height: number,
  fitMode: BitmapFitMode,
  interpolation: BitmapInterpolation,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建 Canvas 2D 上下文。");
  }

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = interpolation === "bilinear";

  if (fitMode === "stretch") {
    ctx.drawImage(image, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  }

  const srcWidth = Math.max(1, image.naturalWidth || image.width);
  const srcHeight = Math.max(1, image.naturalHeight || image.height);
  const srcRatio = srcWidth / srcHeight;
  const dstRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (fitMode === "contain") {
    if (srcRatio > dstRatio) {
      drawWidth = width;
      drawHeight = Math.max(1, Math.round(width / srcRatio));
    } else {
      drawHeight = height;
      drawWidth = Math.max(1, Math.round(height * srcRatio));
    }
    offsetX = Math.floor((width - drawWidth) / 2);
    offsetY = Math.floor((height - drawHeight) / 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    return ctx.getImageData(0, 0, width, height);
  }

  if (srcRatio > dstRatio) {
    drawHeight = height;
    drawWidth = Math.max(1, Math.round(height * srcRatio));
  } else {
    drawWidth = width;
    drawHeight = Math.max(1, Math.round(width / srcRatio));
  }
  offsetX = Math.floor((width - drawWidth) / 2);
  offsetY = Math.floor((height - drawHeight) / 2);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return ctx.getImageData(0, 0, width, height);
}

function thresholdImageData(
  imageData: ImageData,
  threshold: number,
  invert: boolean,
  contrast: number,
  gamma: number,
): Uint8Array {
  const { width, height, data } = imageData;
  const output = new Uint8Array(width * height);
  const darkMask = new Uint8Array(width * height);
  const brightMask = new Uint8Array(width * height);
  const clippedThreshold = clampInt(threshold, 0, 255);
  const safeContrast = Number.isFinite(contrast) ? Math.max(0.1, Math.min(4, contrast)) : 1;
  const safeGamma = Number.isFinite(gamma) ? Math.max(0.1, Math.min(4, gamma)) : 1;
  let darkCount = 0;
  let brightCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width) + x;
      const index = offset * 4;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const a = data[index + 3] ?? 255;

      let luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      luminance = Math.pow(Math.max(0, Math.min(1, luminance / 255)), safeGamma) * 255;
      luminance = ((luminance - 127.5) * safeContrast) + 127.5;
      luminance = Math.max(0, Math.min(255, luminance));

      if (a < 32) {
        darkMask[offset] = 0;
        brightMask[offset] = 0;
        continue;
      }

      if (luminance < clippedThreshold) {
        darkMask[offset] = 1;
        darkCount += 1;
      }
      if (luminance > 255 - clippedThreshold) {
        brightMask[offset] = 1;
        brightCount += 1;
      }
    }
  }

  const useDarkAsForeground =
    darkCount > 0 && (brightCount === 0 || darkCount <= brightCount);
  const sourceMask = useDarkAsForeground ? darkMask : brightMask;
  output.set(sourceMask);

  if (invert) {
    for (let i = 0; i < output.length; i += 1) {
      output[i] = output[i] > 0 ? 0 : 1;
    }
  }

  return output;
}

function collectLineStarts(
  width: number,
  height: number,
  dx: 0 | 1,
  dy: -1 | 0 | 1,
): Array<{ x: number; y: number }> {
  const starts: Array<{ x: number; y: number }> = [];

  if (dx === 0 && dy === 1) {
    for (let x = 0; x < width; x += 1) {
      starts.push({ x, y: 0 });
    }
    return starts;
  }

  if (dy === 0) {
    for (let y = 0; y < height; y += 1) {
      starts.push({ x: 0, y });
    }
    return starts;
  }

  if (dy === 1) {
    for (let x = 0; x < width; x += 1) {
      starts.push({ x, y: 0 });
    }
    for (let y = 1; y < height; y += 1) {
      starts.push({ x: 0, y });
    }
    return starts;
  }

  for (let x = 0; x < width; x += 1) {
    starts.push({ x, y: height - 1 });
  }
  for (let y = 0; y < height - 1; y += 1) {
    starts.push({ x: 0, y });
  }

  return starts;
}

function fillGapsOnLine(
  buffer: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  dx: 0 | 1,
  dy: -1 | 0 | 1,
  maxGap: number,
): void {
  let x = startX;
  let y = startY;
  let step = 0;
  let lastOnStep = -1;

  while (x >= 0 && x < width && y >= 0 && y < height) {
    const offset = (y * width) + x;
    if (buffer[offset] > 0) {
      const gapLength = lastOnStep >= 0 ? step - lastOnStep - 1 : 0;
      if (lastOnStep >= 0 && gapLength > 0 && gapLength <= maxGap) {
        for (let fillStep = lastOnStep + 1; fillStep < step; fillStep += 1) {
          const fillX = startX + (fillStep * dx);
          const fillY = startY + (fillStep * dy);
          buffer[(fillY * width) + fillX] = 1;
        }
      }
      lastOnStep = step;
    }

    x += dx;
    y += dy;
    step += 1;
  }
}

function fillSmallGaps(
  buffer: Uint8Array,
  width: number,
  height: number,
  maxGap: number,
  directions: ReadonlyArray<readonly [0 | 1, -1 | 0 | 1]>,
): void {
  if (maxGap <= 0) {
    return;
  }

  directions.forEach(([dx, dy]) => {
    collectLineStarts(width, height, dx, dy).forEach((start) => {
      fillGapsOnLine(buffer, width, height, start.x, start.y, dx, dy, maxGap);
    });
  });
}

function dilateBinary(buffer: Uint8Array, width: number, height: number, iterations: number): Uint8Array {
  let current = buffer;
  const loop = Math.max(0, clampInt(iterations, 0, 8));
  for (let pass = 0; pass < loop; pass += 1) {
    const next = current.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (current[(y * width) + x] === 0) {
          continue;
        }
        for (let ny = y - 1; ny <= y + 1; ny += 1) {
          if (ny < 0 || ny >= height) {
            continue;
          }
          for (let nx = x - 1; nx <= x + 1; nx += 1) {
            if (nx < 0 || nx >= width) {
              continue;
            }
            next[(ny * width) + nx] = 1;
          }
        }
      }
    }
    current = next;
  }
  return current;
}

function detectComponents(buffer: Uint8Array, width: number, height: number): BinaryComponent[] {
  const labels = new Int32Array(width * height);
  labels.fill(-1);
  const components: BinaryComponent[] = [];

  let labelCounter = 0;
  const queue = new Int32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const seedIndex = (y * width) + x;
      if (buffer[seedIndex] === 0 || labels[seedIndex] >= 0) {
        continue;
      }

      let head = 0;
      let tail = 0;
      queue[tail] = seedIndex;
      tail += 1;
      labels[seedIndex] = labelCounter;

      const pixels: number[] = [];
      const boundaries: number[] = [];
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;

      while (head < tail) {
        const current = queue[head];
        head += 1;
        pixels.push(current);

        const cy = Math.floor(current / width);
        const cx = current - (cy * width);

        if (cx < minX) {
          minX = cx;
        }
        if (cy < minY) {
          minY = cy;
        }
        if (cx > maxX) {
          maxX = cx;
        }
        if (cy > maxY) {
          maxY = cy;
        }

        let isBoundary = false;

        for (let i = 0; i < EIGHT_NEIGHBORS.length; i += 1) {
          const [dx, dy] = EIGHT_NEIGHBORS[i];
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            isBoundary = true;
            continue;
          }
          const nextIndex = (ny * width) + nx;
          if (buffer[nextIndex] === 0) {
            isBoundary = true;
            continue;
          }
          if (labels[nextIndex] >= 0) {
            continue;
          }
          labels[nextIndex] = labelCounter;
          queue[tail] = nextIndex;
          tail += 1;
        }

        if (isBoundary) {
          boundaries.push(current);
        }
      }

      components.push({
        label: labelCounter,
        pixels,
        boundaries: boundaries.length > 0 ? boundaries : pixels,
        minX,
        minY,
        maxX,
        maxY,
      });
      labelCounter += 1;
    }
  }

  return components;
}

function boxChebyshevDistance(left: BinaryComponent, right: BinaryComponent): number {
  const dx =
    left.maxX < right.minX ? right.minX - left.maxX - 1 : right.maxX < left.minX ? left.minX - right.maxX - 1 : 0;
  const dy =
    left.maxY < right.minY ? right.minY - left.maxY - 1 : right.maxY < left.minY ? left.minY - right.maxY - 1 : 0;
  return Math.max(dx, dy);
}

function nearestBoundaryPair(
  left: BinaryComponent,
  right: BinaryComponent,
  width: number,
  maxDistance: number,
): { distance: number; leftIndex: number; rightIndex: number } | null {
  const maxDistanceSquared = maxDistance * maxDistance;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let bestLeftIndex = -1;
  let bestRightIndex = -1;

  for (let i = 0; i < left.boundaries.length; i += 1) {
    const leftIndex = left.boundaries[i];
    const ly = Math.floor(leftIndex / width);
    const lx = leftIndex - (ly * width);

    for (let j = 0; j < right.boundaries.length; j += 1) {
      const rightIndex = right.boundaries[j];
      const ry = Math.floor(rightIndex / width);
      const rx = rightIndex - (ry * width);
      const dx = lx - rx;
      const dy = ly - ry;
      const distanceSquared = (dx * dx) + (dy * dy);
      if (distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        bestLeftIndex = leftIndex;
        bestRightIndex = rightIndex;
      }
      if (distanceSquared === 0) {
        break;
      }
    }
  }

  if (!Number.isFinite(bestDistanceSquared) || bestDistanceSquared > maxDistanceSquared) {
    return null;
  }

  return {
    distance: Math.sqrt(bestDistanceSquared),
    leftIndex: bestLeftIndex,
    rightIndex: bestRightIndex,
  };
}

function createUnionFind(size: number): { find: (index: number) => number; union: (a: number, b: number) => void } {
  const parents = Array.from({ length: size }, (_, index) => index);
  const ranks = new Int32Array(size);

  const find = (index: number): number => {
    let node = index;
    while (parents[node] !== node) {
      parents[node] = parents[parents[node]];
      node = parents[node];
    }
    return node;
  };

  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) {
      return;
    }

    if (ranks[leftRoot] < ranks[rightRoot]) {
      parents[leftRoot] = rightRoot;
      return;
    }
    if (ranks[leftRoot] > ranks[rightRoot]) {
      parents[rightRoot] = leftRoot;
      return;
    }
    parents[rightRoot] = leftRoot;
    ranks[leftRoot] += 1;
  };

  return { find, union };
}

function drawBresenhamLine(
  buffer: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx - dy;

  while (true) {
    buffer[(cy * width) + cx] = 1;
    if (cx === x1 && cy === y1) {
      break;
    }
    const twice = error * 2;
    if (twice > -dy) {
      error -= dy;
      cx += sx;
    }
    if (twice < dx) {
      error += dx;
      cy += sy;
    }
  }
}

function bridgeNearbyComponents(
  buffer: Uint8Array,
  width: number,
  height: number,
  maxDistance: number,
): void {
  if (maxDistance <= 0) {
    return;
  }

  const components = detectComponents(buffer, width, height);
  if (components.length <= 1) {
    return;
  }

  const candidates: BridgeCandidate[] = [];
  for (let i = 0; i < components.length; i += 1) {
    for (let j = i + 1; j < components.length; j += 1) {
      const left = components[i];
      const right = components[j];
      if (boxChebyshevDistance(left, right) > maxDistance) {
        continue;
      }
      const nearest = nearestBoundaryPair(left, right, width, maxDistance);
      if (!nearest) {
        continue;
      }
      candidates.push({
        leftLabel: left.label,
        rightLabel: right.label,
        distance: nearest.distance,
        leftIndex: nearest.leftIndex,
        rightIndex: nearest.rightIndex,
      });
    }
  }

  candidates.sort((left, right) => left.distance - right.distance);
  const unionFind = createUnionFind(components.length);
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const leftRoot = unionFind.find(candidate.leftLabel);
    const rightRoot = unionFind.find(candidate.rightLabel);
    if (leftRoot === rightRoot) {
      continue;
    }
    const leftY = Math.floor(candidate.leftIndex / width);
    const leftX = candidate.leftIndex - (leftY * width);
    const rightY = Math.floor(candidate.rightIndex / width);
    const rightX = candidate.rightIndex - (rightY * width);
    drawBresenhamLine(buffer, width, leftX, leftY, rightX, rightY);
    unionFind.union(candidate.leftLabel, candidate.rightLabel);
  }
}

function stampSquare(
  buffer: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  const left = Math.max(0, centerX - radius);
  const right = Math.min(width - 1, centerX + radius);
  const top = Math.max(0, centerY - radius);
  const bottom = Math.min(height - 1, centerY + radius);
  for (let y = top; y <= bottom; y += 1) {
    const rowOffset = y * width;
    for (let x = left; x <= right; x += 1) {
      buffer[rowOffset + x] = 1;
    }
  }
}

function reinforceRuns(
  buffer: Uint8Array,
  width: number,
  height: number,
  minRun: number,
  radius: number,
): Uint8Array {
  if (minRun <= 1 || radius <= 0) {
    return buffer;
  }

  const out = buffer.slice();

  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      if (buffer[(y * width) + x] === 0) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < width && buffer[(y * width) + x] > 0) {
        x += 1;
      }
      const runLength = x - start;
      if (runLength >= minRun) {
        for (let px = start; px < x; px += 1) {
          stampSquare(out, width, height, px, y, radius);
        }
      }
    }
  }

  for (let x = 0; x < width; x += 1) {
    let y = 0;
    while (y < height) {
      if (buffer[(y * width) + x] === 0) {
        y += 1;
        continue;
      }
      const start = y;
      while (y < height && buffer[(y * width) + x] > 0) {
        y += 1;
      }
      const runLength = y - start;
      if (runLength >= minRun) {
        for (let py = start; py < y; py += 1) {
          stampSquare(out, width, height, x, py, radius);
        }
      }
    }
  }

  return out;
}

function removeSpeckles(buffer: Uint8Array, width: number, height: number, minArea: number): Uint8Array {
  if (minArea <= 1) {
    return buffer;
  }

  const components = detectComponents(buffer, width, height);
  if (components.length === 0) {
    return buffer;
  }

  const out = buffer.slice();
  for (let i = 0; i < components.length; i += 1) {
    const component = components[i];
    if (component.pixels.length >= minArea) {
      continue;
    }
    for (let p = 0; p < component.pixels.length; p += 1) {
      out[component.pixels[p]] = 0;
    }
  }
  return out;
}

function countLitPixels(buffer: Uint8Array): number {
  let total = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    total += buffer[i] > 0 ? 1 : 0;
  }
  return total;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`无法读取图片: ${file.name}`));
    };
    image.src = objectUrl;
  });
}

export async function processImageFileToBitmap(
  file: File,
  options: BitmapProcessingOptions,
): Promise<BitmapProcessingResult> {
  const image = await loadImageFromFile(file);
  return processImageElementToBitmap(image, options);
}

export function processImageElementToBitmap(
  image: HTMLImageElement,
  options: BitmapProcessingOptions,
): BitmapProcessingResult {
  const width = clampInt(options.width, 1, 512);
  const height = clampInt(options.height, 1, 512);
  const resizedData = drawImageToCanvas(
    image,
    width,
    height,
    options.fitMode,
    options.interpolation,
  );

  const thresholdRaw = clampInt(options.threshold, 0, 510);
  const thresholdBase = Math.min(255, thresholdRaw);
  const thresholdBoost = Math.max(0, thresholdRaw - 255);

  const binary = thresholdImageData(
    resizedData,
    thresholdBase,
    options.invert,
    options.contrast,
    options.gamma,
  );
  const sourceBinary = binary.slice();

  // Extended threshold segment (256-510): progressively reinforce line continuity.
  const boostGapBonus = Math.floor(thresholdBoost / 96);
  const boostBridgeBonus = Math.floor(thresholdBoost / 64);
  const boostDilateBonus = Math.floor(thresholdBoost / 128);

  const gapFillPasses = clampInt(options.gapFillPasses + boostGapBonus, 0, 8);
  const horizontalGap = clampInt(options.horizontalGap + boostGapBonus, 0, width);
  const verticalGap = clampInt(options.verticalGap + boostGapBonus, 0, height);
  const diagonalGap = clampInt(options.diagonalGap + boostGapBonus, 0, Math.max(width, height));

  for (let pass = 0; pass < gapFillPasses; pass += 1) {
    if (horizontalGap > 0) {
      fillSmallGaps(binary, width, height, horizontalGap, [[1, 0]]);
    }
    if (verticalGap > 0) {
      fillSmallGaps(binary, width, height, verticalGap, [[0, 1]]);
    }
    if (diagonalGap > 0) {
      fillSmallGaps(binary, width, height, diagonalGap, DIAGONAL_DIRECTIONS);
    }
  }

  bridgeNearbyComponents(
    binary,
    width,
    height,
    clampInt(options.bridgeDistance + boostBridgeBonus, 0, Math.max(width, height)),
  );

  let processed = reinforceRuns(
    binary,
    width,
    height,
    clampInt(options.reinforceMinRun, 0, Math.max(width, height)),
    clampInt(options.reinforceRadius, 0, 8),
  );

  processed = dilateBinary(
    processed,
    width,
    height,
    clampInt(options.dilateIterations + boostDilateBonus, 0, 8),
  );
  processed = removeSpeckles(
    processed,
    width,
    height,
    clampInt(options.despeckleMinArea, 0, width * height),
  );

  const litPixels = countLitPixels(processed);
  const outputBitmap = toMonoBitmap(processed, width, height);
  const sourceBitmap = toMonoBitmap(sourceBinary, width, height);

  return {
    sourceBitmap,
    outputBitmap,
    litPixels,
    density: processed.length > 0 ? litPixels / processed.length : 0,
  };
}

export function monoBitmapToBmpBytes(bitmap: MonoBitmap): Uint8Array {
  const width = clampInt(bitmap.width, 1, 2048);
  const height = clampInt(bitmap.height, 1, 2048);
  const rowStride = Math.ceil(width / 8);
  const paddedStride = Math.ceil(rowStride / 4) * 4;
  const pixelBytes = paddedStride * height;
  const headerSize = 14 + 40 + 8;
  const fileSize = headerSize + pixelBytes;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const output = new Uint8Array(buffer);

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, headerSize, true);

  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 1, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelBytes, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 2, true);
  view.setUint32(50, 2, true);

  view.setUint8(54, 0);
  view.setUint8(55, 0);
  view.setUint8(56, 0);
  view.setUint8(57, 0);
  view.setUint8(58, 255);
  view.setUint8(59, 255);
  view.setUint8(60, 255);
  view.setUint8(61, 0);

  let offset = headerSize;
  for (let y = height - 1; y >= 0; y -= 1) {
    const row = bitmap.rows[y] ?? "";
    for (let byteIndex = 0; byteIndex < rowStride; byteIndex += 1) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = (byteIndex * 8) + bit;
        if (x >= width) {
          break;
        }
        if (row[x] === "1") {
          byte |= 0x80 >> bit;
        }
      }
      output[offset + byteIndex] = byte;
    }
    offset += rowStride;
    for (let pad = rowStride; pad < paddedStride; pad += 1) {
      output[offset] = 0;
      offset += 1;
    }
  }

  return output;
}

export function monoBitmapToBmpBlob(bitmap: MonoBitmap): Blob {
  const bytes = monoBitmapToBmpBytes(bitmap);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: "image/bmp" });
}
