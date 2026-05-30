import type { Rect } from "@/types/project";

export type ResizeDirection = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface ResizeHandleDefinition {
  direction: ResizeDirection;
  label: string;
}

export const resizeHandleDefinitions: ResizeHandleDefinition[] = [
  { direction: "nw", label: "左上" },
  { direction: "n", label: "上" },
  { direction: "ne", label: "右上" },
  { direction: "e", label: "右" },
  { direction: "se", label: "右下" },
  { direction: "s", label: "下" },
  { direction: "sw", label: "左下" },
  { direction: "w", label: "左" },
];

const MIN_WIDGET_SIZE = 1;

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

export function resizeCursorForDirection(direction: ResizeDirection): string {
  switch (direction) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
  }
}

export function buildResizedRect(
  originRect: Rect,
  deltaX: number,
  deltaY: number,
  direction: ResizeDirection,
  screen: { width: number; height: number },
): Rect {
  const left = originRect.x;
  const top = originRect.y;
  const right = originRect.x + originRect.width;
  const bottom = originRect.y + originRect.height;

  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  if (direction.includes("w")) {
    nextLeft = clamp(left + deltaX, 0, right - MIN_WIDGET_SIZE);
  } else if (direction.includes("e")) {
    nextRight = clamp(right + deltaX, left + MIN_WIDGET_SIZE, screen.width);
  }

  if (direction.includes("n")) {
    nextTop = clamp(top + deltaY, 0, bottom - MIN_WIDGET_SIZE);
  } else if (direction.includes("s")) {
    nextBottom = clamp(bottom + deltaY, top + MIN_WIDGET_SIZE, screen.height);
  }

  return {
    x: Math.round(nextLeft),
    y: Math.round(nextTop),
    width: Math.max(MIN_WIDGET_SIZE, Math.round(nextRight - nextLeft)),
    height: Math.max(MIN_WIDGET_SIZE, Math.round(nextBottom - nextTop)),
  };
}
