import type { MonoBitmap } from "@/types/project";

function readAscii(view: DataView, offset: number, length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

export function decodeMonochromeBmp(buffer: ArrayBuffer): MonoBitmap {
  const view = new DataView(buffer);
  if (readAscii(view, 0, 2) !== "BM") {
    throw new Error("不是 BMP 文件。");
  }

  const pixelOffset = view.getUint32(10, true);
  const width = view.getInt32(18, true);
  const heightRaw = view.getInt32(22, true);
  const planes = view.getUint16(26, true);
  const bitsPerPixel = view.getUint16(28, true);
  const compression = view.getUint32(30, true);

  if (planes !== 1 || bitsPerPixel !== 1 || compression !== 0) {
    throw new Error("仅支持未压缩 1bit BMP。");
  }

  if (width <= 0 || heightRaw === 0) {
    throw new Error("BMP 尺寸非法。");
  }

  const height = Math.abs(heightRaw);
  const topDown = heightRaw < 0;
  const rowStride = Math.floor(((bitsPerPixel * width) + 31) / 32) * 4;
  const rows: string[] = [];

  for (let y = 0; y < height; y += 1) {
    const sourceY = topDown ? y : (height - 1 - y);
    const rowStart = pixelOffset + (sourceY * rowStride);
    let rowBits = "";

    for (let x = 0; x < width; x += 1) {
      const byte = view.getUint8(rowStart + Math.floor(x / 8));
      const mask = 0x80 >> (x % 8);
      rowBits += (byte & mask) !== 0 ? "1" : "0";
    }

    rows.push(rowBits);
  }

  return { width, height, rows };
}

export async function loadMonochromeBmpFromUrl(url: string): Promise<MonoBitmap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`加载 BMP 失败: ${url}`);
  }
  return decodeMonochromeBmp(await response.arrayBuffer());
}

