type SpriteMask = {
  width: number;
  height: number;
  pixels: Uint8Array;
};

export interface ChromeDinoSpritePack {
  trexRun: [SpriteMask, SpriteMask];
  trexJump: SpriteMask;
  trexDuck: [SpriteMask, SpriteMask];
  trexCrash: SpriteMask;
  cactusSmall: [SpriteMask, SpriteMask, SpriteMask];
  cactusLarge: [SpriteMask, SpriteMask, SpriteMask];
  pterodactyl: [SpriteMask, SpriteMask];
  cloud: SpriteMask;
  moon: SpriteMask[];
  star: SpriteMask;
}

const ATLAS_URL = "/chrome_dino/100-offline-sprite.png";
const LUMA_THRESHOLD = 210;
const BASE_SCALE = 64 / 150;

type SourceRect = { x: number; y: number; width: number; height: number };

let spritePack: ChromeDinoSpritePack | null = null;
let loadStarted = false;

function scaled(value: number, min = 1): number {
  return Math.max(min, Math.round(value * BASE_SCALE));
}

function decodeMask(
  data: Uint8ClampedArray,
  atlasWidth: number,
  src: SourceRect,
  targetWidth = scaled(src.width),
  targetHeight = scaled(src.height),
): SpriteMask {
  const width = Math.max(1, targetWidth);
  const height = Math.max(1, targetHeight);
  const pixels = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const sourceY = src.y + Math.min(src.height - 1, Math.floor((y * src.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = src.x + Math.min(src.width - 1, Math.floor((x * src.width) / width));
      const index = ((sourceY * atlasWidth) + sourceX) * 4;
      const alpha = data[index + 3] ?? 0;
      if (alpha < 16) {
        continue;
      }
      const r = data[index] ?? 255;
      const g = data[index + 1] ?? 255;
      const b = data[index + 2] ?? 255;
      const luma = (r + g + b) / 3;
      if (luma < LUMA_THRESHOLD) {
        pixels[(y * width) + x] = 1;
      }
    }
  }

  return { width, height, pixels };
}

function initPack(image: HTMLImageElement): ChromeDinoSpritePack {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create canvas context for Chrome Dino atlas.");
  }

  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const trexBaseX = 848;
  const trexBaseY = 2;
  const trexWidth = 44;
  const trexHeight = 47;
  const trexDuckWidth = 59;
  const trexDuckHeight = 47;

  const moonPhases = [140, 120, 100, 60, 40, 20, 0];

  return {
    trexRun: [
      decodeMask(data, canvas.width, { x: trexBaseX + 88, y: trexBaseY, width: trexWidth, height: trexHeight }),
      decodeMask(data, canvas.width, { x: trexBaseX + 132, y: trexBaseY, width: trexWidth, height: trexHeight }),
    ],
    trexJump: decodeMask(data, canvas.width, { x: trexBaseX, y: trexBaseY, width: trexWidth, height: trexHeight }),
    trexDuck: [
      decodeMask(data, canvas.width, { x: trexBaseX + 264, y: trexBaseY, width: trexDuckWidth, height: trexDuckHeight }),
      decodeMask(data, canvas.width, { x: trexBaseX + 323, y: trexBaseY, width: trexDuckWidth, height: trexDuckHeight }),
    ],
    trexCrash: decodeMask(data, canvas.width, { x: trexBaseX + 220, y: trexBaseY, width: trexWidth, height: trexHeight }),
    cactusSmall: [
      decodeMask(data, canvas.width, { x: 228, y: 2, width: 17, height: 35 }),
      decodeMask(data, canvas.width, { x: 245, y: 2, width: 34, height: 35 }),
      decodeMask(data, canvas.width, { x: 279, y: 2, width: 51, height: 35 }),
    ],
    cactusLarge: [
      decodeMask(data, canvas.width, { x: 332, y: 2, width: 25, height: 50 }),
      decodeMask(data, canvas.width, { x: 357, y: 2, width: 50, height: 50 }),
      decodeMask(data, canvas.width, { x: 407, y: 2, width: 75, height: 50 }),
    ],
    pterodactyl: [
      decodeMask(data, canvas.width, { x: 134, y: 2, width: 46, height: 40 }),
      decodeMask(data, canvas.width, { x: 180, y: 2, width: 46, height: 40 }),
    ],
    cloud: decodeMask(data, canvas.width, { x: 86, y: 2, width: 46, height: 14 }),
    moon: moonPhases.map((phase, index) =>
      decodeMask(
        data,
        canvas.width,
        { x: 484 + phase, y: 2, width: index === 3 ? 40 : 20, height: 40 },
      ),
    ),
    star: decodeMask(data, canvas.width, { x: 645, y: 2, width: 9, height: 9 }, scaled(9, 2), scaled(9, 2)),
  };
}

function ensureSpritePack(): void {
  if (typeof window === "undefined" || spritePack || loadStarted) {
    return;
  }

  loadStarted = true;
  const image = new Image();
  image.decoding = "async";
  image.src = ATLAS_URL;
  image.onload = () => {
    try {
      spritePack = initPack(image);
    } catch {
      spritePack = null;
    }
  };
  image.onerror = () => {
    spritePack = null;
  };
}

export function getChromeDinoSpritePack(): ChromeDinoSpritePack | null {
  ensureSpritePack();
  return spritePack;
}

export function drawSpriteMask(
  target: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  sprite: SpriteMask,
  x: number,
  y: number,
): void {
  const startX = Math.round(x);
  const startY = Math.round(y);
  for (let row = 0; row < sprite.height; row += 1) {
    const py = startY + row;
    if (py < 0 || py >= targetHeight) {
      continue;
    }
    for (let col = 0; col < sprite.width; col += 1) {
      if (!sprite.pixels[(row * sprite.width) + col]) {
        continue;
      }
      const px = startX + col;
      if (px < 0 || px >= targetWidth) {
        continue;
      }
      target[(py * targetWidth) + px] = 1;
    }
  }
}

export function drawSpriteMaskScaled(
  target: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  sprite: SpriteMask,
  x: number,
  y: number,
  outputWidth: number,
  outputHeight: number,
): void {
  const drawWidth = Math.max(1, Math.round(outputWidth));
  const drawHeight = Math.max(1, Math.round(outputHeight));
  const startX = Math.round(x);
  const startY = Math.round(y);

  for (let row = 0; row < drawHeight; row += 1) {
    const sourceY = Math.min(sprite.height - 1, Math.floor((row * sprite.height) / drawHeight));
    const py = startY + row;
    if (py < 0 || py >= targetHeight) {
      continue;
    }

    for (let col = 0; col < drawWidth; col += 1) {
      const sourceX = Math.min(sprite.width - 1, Math.floor((col * sprite.width) / drawWidth));
      if (!sprite.pixels[(sourceY * sprite.width) + sourceX]) {
        continue;
      }
      const px = startX + col;
      if (px < 0 || px >= targetWidth) {
        continue;
      }
      target[(py * targetWidth) + px] = 1;
    }
  }
}
