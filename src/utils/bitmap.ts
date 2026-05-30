import type { MonoBitmap } from "@/types/project";

export function imageDataToMonoBitmap(imageData: ImageData, threshold = 128): MonoBitmap {
  const { width, height, data } = imageData;
  const rows: string[] = [];

  for (let y = 0; y < height; y += 1) {
    let row = "";
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const a = data[index + 3] ?? 255;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const bit = a < 64 ? 0 : luminance < threshold ? 1 : 0;
      row += bit ? "1" : "0";
    }
    rows.push(row);
  }

  return { width, height, rows };
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = url;
  });
}

export function imageElementToMonoBitmap(image: HTMLImageElement, threshold = 128): MonoBitmap {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  context.drawImage(image, 0, 0);
  return imageDataToMonoBitmap(
    context.getImageData(0, 0, canvas.width, canvas.height),
    threshold,
  );
}

export function scaleMonoBitmap(bitmap: MonoBitmap, scale = 2): string {
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;

  const rects = bitmap.rows.flatMap((row, y) =>
    row.split("").flatMap((bit, x) => {
      if (bit !== "1") {
        return [];
      }

      return [
        `<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" />`,
      ];
    }),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}
