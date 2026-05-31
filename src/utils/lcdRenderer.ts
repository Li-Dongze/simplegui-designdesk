import { simpleGuiDemoResourceSource } from "@/utils/simpleguiDemoResourceSource";
import { simpleGuiFontSource } from "@/utils/simpleguiFontSource";
import {
  getGraphBuffer,
  getWidgetFocusIndex,
  getWidgetRuntime,
  getWidgetVisible,
  readWidgetVariableValue,
  resolveChoiceLabel,
  sortWidgets,
} from "@/utils/viewModel";
import { getVisibleItemMetrics } from "@/simulator/runtime";
import type {
  CurvePointDefinition,
  FontToken,
  MonoBitmap,
  NoticeWidgetProps,
  PolarClockProps,
  Picture,
  ProcessBarProps,
  ProjectDocument,
  RealtimeGraphProps,
  ShapeWidgetProps,
  SimulatorSession,
  TextLabelProps,
  VariableValue,
  Widget,
} from "@/types/project";

type RenderState = {
  project: ProjectDocument;
  picture: Picture;
  simulator: SimulatorSession | null;
  variableMap: Map<string, VariableValue>;
  scale: number;
};

type FontGlyph = {
  width: number;
  height: number;
  columns: number[];
};

type FontDefinition = {
  halfWidth: number;
  fullWidth: number;
  height: number;
  rawBytes: number[];
  fallbackGlyphIndex: number;
  resolveGlyphIndex: (codePoint: number) => number;
};

const ASCII_START = 0x20;
const ASCII_END = 0x7e;
const MINI_NUM_FALLBACK_GLYPH_INDEX = 17;
const FALLBACK_GLYPH_INDEX = 95;
const FULL_WIDTH_GLYPH_START = 97;
const GB2312_SYMBOL_GLYPH_START = 95;
const GB2312_CHINESE_GLYPH_START = 1787;
const FONT_METRICS: Record<FontToken, { halfWidth: number; fullWidth: number; height: number; sourceName: string; sourceText: string }> = {
  SGUI_DEFAULT_FONT_MiniNum: {
    halfWidth: 4,
    fullWidth: 0,
    height: 5,
    sourceName: "SGUI_FONT_H6",
    sourceText: simpleGuiFontSource,
  },
  SGUI_DEFAULT_FONT_8: {
    halfWidth: 6,
    fullWidth: 0,
    height: 8,
    sourceName: "SGUI_FONT_H8",
    sourceText: simpleGuiFontSource,
  },
  SGUI_DEFAULT_FONT_12: {
    halfWidth: 6,
    fullWidth: 0,
    height: 12,
    sourceName: "SGUI_FONT_H12",
    sourceText: simpleGuiFontSource,
  },
  SGUI_DEFAULT_FONT_16: {
    halfWidth: 8,
    fullWidth: 16,
    height: 16,
    sourceName: "SGUI_FONT_H16",
    sourceText: simpleGuiFontSource,
  },
  GB2312_FZXS12: {
    halfWidth: 6,
    fullWidth: 12,
    height: 12,
    sourceName: "GB2312_H12",
    sourceText: simpleGuiDemoResourceSource,
  },
};
const UNICODE_TABLE = parseUnicodeTable(simpleGuiFontSource);
let gb2312UnicodeToCodeMap: Map<number, number> | null = null;
const FONT_DEFINITIONS: Record<FontToken, FontDefinition> = {
  SGUI_DEFAULT_FONT_MiniNum: buildFontDefinition("SGUI_DEFAULT_FONT_MiniNum"),
  SGUI_DEFAULT_FONT_8: buildFontDefinition("SGUI_DEFAULT_FONT_8"),
  SGUI_DEFAULT_FONT_12: buildFontDefinition("SGUI_DEFAULT_FONT_12"),
  SGUI_DEFAULT_FONT_16: buildFontDefinition("SGUI_DEFAULT_FONT_16"),
  GB2312_FZXS12: buildFontDefinition("GB2312_FZXS12"),
};

function parseByteArray(source: string, symbolName: string): number[] {
  const arrayPattern = new RegExp(`const\\s+SGUI_BYTE\\s+${symbolName}\\[\\]\\s*=\\s*\\{([\\s\\S]*?)\\};`);
  const match = source.match(arrayPattern);
  if (!match?.[1]) {
    throw new Error(`Unable to find ${symbolName} in SimpleGUI font source.`);
  }

  const cleaned = match[1]
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
  const tokens = cleaned
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens
    .map((token) => Number.parseInt(token, 16))
    .filter((value) => Number.isFinite(value));
}

function parseUnicodeTable(source: string): number[] {
  const match = source.match(/static\s+const\s+SGUI_UINT32\s+s_arrUnicodeTable\[\]\s*=\s*\{([\s\S]*?)\};/);
  if (!match?.[1]) {
    return [];
  }

  const cleaned = match[1].replace(/\/\/.*$/gm, " ");
  return cleaned
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => Number.parseInt(token, 16));
}

function getGbkDecoder(): TextDecoder {
  try {
    return new TextDecoder("gbk");
  } catch {
    return new TextDecoder("gb18030");
  }
}

function buildGb2312UnicodeToCodeMap(): Map<number, number> {
  const decoder = getGbkDecoder();
  const map = new Map<number, number>();
  const appendRange = (highStart: number, highEnd: number) => {
    for (let high = highStart; high <= highEnd; high += 1) {
      for (let low = 0xa1; low <= 0xfe; low += 1) {
        const text = decoder.decode(Uint8Array.from([high, low]));
        if (text.length !== 1) {
          continue;
        }

        const codePoint = text.codePointAt(0);
        if (!codePoint || codePoint === 0xfffd || map.has(codePoint)) {
          continue;
        }

        map.set(codePoint, (high << 8) | low);
      }
    }
  };

  appendRange(0xa1, 0xa9);
  appendRange(0xb0, 0xf7);
  return map;
}

function getGb2312UnicodeToCodeMap(): Map<number, number> {
  if (!gb2312UnicodeToCodeMap) {
    gb2312UnicodeToCodeMap = buildGb2312UnicodeToCodeMap();
  }

  return gb2312UnicodeToCodeMap;
}

function getDefaultGlyphIndex(codePoint: number): number {
  if (codePoint >= ASCII_START && codePoint <= ASCII_END) {
    return codePoint - ASCII_START;
  }

  const unicodeIndex = UNICODE_TABLE.indexOf(codePoint);
  if (unicodeIndex >= 0) {
    return FULL_WIDTH_GLYPH_START + unicodeIndex * 2;
  }

  return FALLBACK_GLYPH_INDEX;
}

function getMiniNumGlyphIndex(codePoint: number): number {
  if (codePoint >= 0x30 && codePoint <= 0x39) {
    return codePoint - 0x30;
  }

  switch (String.fromCodePoint(codePoint)) {
    case ".":
      return 10;
    case "+":
      return 11;
    case "-":
      return 12;
    case "*":
      return 13;
    case "/":
      return 14;
    case "(":
      return 15;
    case ")":
      return 16;
    case " ":
      return 17;
    case "%":
      return 18;
    case "=":
      return 19;
    default:
      return MINI_NUM_FALLBACK_GLYPH_INDEX;
  }
}

function getGb2312GlyphIndex(codePoint: number): number {
  if (codePoint >= ASCII_START && codePoint <= ASCII_END) {
    return codePoint - ASCII_START;
  }

  const gb2312Code = getGb2312UnicodeToCodeMap().get(codePoint);
  if (!gb2312Code) {
    return FALLBACK_GLYPH_INDEX;
  }

  const lowByte = gb2312Code & 0xff;
  const highByte = (gb2312Code >> 8) & 0xff;

  if (gb2312Code > 0xa1a0 && gb2312Code < 0xa9ff) {
    return (((highByte - 0xa1) * 94 + (lowByte - 0xa1)) * 2) + GB2312_SYMBOL_GLYPH_START;
  }

  if (gb2312Code > 0xb0a0 && gb2312Code < 0xf7ff) {
    return (((highByte - 0xb0) * 94 + (lowByte - 0xa1)) * 2) + GB2312_CHINESE_GLYPH_START;
  }

  return FALLBACK_GLYPH_INDEX;
}

function buildFontDefinition(fontToken: FontToken): FontDefinition {
  const metrics = FONT_METRICS[fontToken];
  let fallbackGlyphIndex = FALLBACK_GLYPH_INDEX;
  let resolveGlyphIndex = getDefaultGlyphIndex;

  if (fontToken === "SGUI_DEFAULT_FONT_MiniNum") {
    fallbackGlyphIndex = MINI_NUM_FALLBACK_GLYPH_INDEX;
    resolveGlyphIndex = getMiniNumGlyphIndex;
  }

  if (fontToken === "GB2312_FZXS12") {
    resolveGlyphIndex = getGb2312GlyphIndex;
  }

  return {
    halfWidth: metrics.halfWidth,
    fullWidth: metrics.fullWidth,
    height: metrics.height,
    rawBytes: parseByteArray(metrics.sourceText, metrics.sourceName),
    fallbackGlyphIndex,
    resolveGlyphIndex,
  };
}

function getFontDefinition(fontToken: FontToken): FontDefinition {
  return FONT_DEFINITIONS[fontToken];
}

function decodeText(text: string): number[] {
  return Array.from(text).map((char) => char.codePointAt(0) ?? 0);
}

function getGlyph(fontToken: FontToken, codePoint: number): FontGlyph {
  const definition = getFontDefinition(fontToken);
  const glyphIndex = definition.resolveGlyphIndex(codePoint);
  const isFullWidth = codePoint > 0x7f && definition.fullWidth > 0;
  const width = isFullWidth ? definition.fullWidth : definition.halfWidth;
  const pageCount = Math.ceil(definition.height / 8);
  const halfGlyphByteCount = definition.halfWidth * pageCount;
  const byteCount = width * pageCount;
  const byteOffset = glyphIndex * halfGlyphByteCount;
  const columns = definition.rawBytes.slice(byteOffset, byteOffset + byteCount);
  const fallbackOffset = definition.fallbackGlyphIndex * halfGlyphByteCount;
  const fallbackColumns = definition.rawBytes.slice(
    fallbackOffset,
    fallbackOffset + definition.halfWidth * pageCount,
  );

  return {
    width: columns.length === byteCount ? width : definition.halfWidth,
    height: definition.height,
    columns: columns.length === byteCount ? columns : fallbackColumns,
  };
}

function measureText(text: string, fontToken: FontToken): number {
  const definition = getFontDefinition(fontToken);
  return decodeText(text).reduce((width, codePoint) => {
    const glyph = getGlyph(fontToken, codePoint);
    return width + (glyph?.width ?? definition.halfWidth);
  }, 0);
}

function getLineHeight(fontToken: FontToken): number {
  return getFontDefinition(fontToken).height;
}

function putPixel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillRect(x, y, 1, 1);
}

function strokeFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) {
    return;
  }

  ctx.fillRect(x, y, width, 1);
  ctx.fillRect(x, y + height - 1, width, 1);
  ctx.fillRect(x, y, 1, height);
  ctx.fillRect(x + width - 1, y, 1, height);
}

function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
) {
  const start = Math.min(x1, x2);
  const end = Math.max(x1, x2);
  ctx.fillRect(start, y, end - start + 1, 1);
}

function drawVerticalLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y1: number,
  y2: number,
) {
  const start = Math.min(y1, y2);
  const end = Math.max(y1, y2);
  ctx.fillRect(x, start, 1, end - start + 1);
}

function fillRectPixels(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) {
    return;
  }

  ctx.fillRect(x, y, width, height);
}

function drawCircleOutline(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
) {
  let x = radius;
  let y = 0;
  let decision = 1 - x;

  while (y <= x) {
    putPixel(ctx, centerX + x, centerY + y);
    putPixel(ctx, centerX + y, centerY + x);
    putPixel(ctx, centerX - y, centerY + x);
    putPixel(ctx, centerX - x, centerY + y);
    putPixel(ctx, centerX - x, centerY - y);
    putPixel(ctx, centerX - y, centerY - x);
    putPixel(ctx, centerX + y, centerY - x);
    putPixel(ctx, centerX + x, centerY - y);

    y += 1;
    if (decision <= 0) {
      decision += (2 * y) + 1;
    } else {
      x -= 1;
      decision += (2 * (y - x)) + 1;
    }
  }
}

function fillCircle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
) {
  for (let y = -radius; y <= radius; y += 1) {
    const span = Math.floor(Math.sqrt((radius * radius) - (y * y)));
    drawHorizontalLine(ctx, centerX - span, centerX + span, centerY + y);
  }
}

function clearCircle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  fillCircle(ctx, centerX, centerY, radius);
  ctx.restore();
}

function drawRoundedRectOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, Math.floor(Math.min(width, height) / 2)));
  if (safeRadius === 0) {
    strokeFrame(ctx, x, y, width, height);
    return;
  }

  drawHorizontalLine(ctx, x + safeRadius, x + width - safeRadius - 1, y);
  drawHorizontalLine(ctx, x + safeRadius, x + width - safeRadius - 1, y + height - 1);
  drawVerticalLine(ctx, x, y + safeRadius, y + height - safeRadius - 1);
  drawVerticalLine(ctx, x + width - 1, y + safeRadius, y + height - safeRadius - 1);

  for (let dy = 0; dy <= safeRadius; dy += 1) {
    const dx = Math.round(Math.sqrt((safeRadius * safeRadius) - (dy * dy)));
    putPixel(ctx, x + safeRadius - dx, y + safeRadius - dy);
    putPixel(ctx, x + width - safeRadius - 1 + dx, y + safeRadius - dy);
    putPixel(ctx, x + safeRadius - dx, y + height - safeRadius - 1 + dy);
    putPixel(ctx, x + width - safeRadius - 1 + dx, y + height - safeRadius - 1 + dy);
  }
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, Math.floor(Math.min(width, height) / 2)));
  if (safeRadius === 0) {
    fillRectPixels(ctx, x, y, width, height);
    return;
  }

  fillRectPixels(ctx, x + safeRadius, y, width - (safeRadius * 2), height);
  for (let dy = 0; dy < safeRadius; dy += 1) {
    const dx = Math.floor(Math.sqrt((safeRadius * safeRadius) - ((safeRadius - dy) * (safeRadius - dy))));
    drawHorizontalLine(ctx, x + safeRadius - dx, x + width - safeRadius + dx - 1, y + dy);
    drawHorizontalLine(
      ctx,
      x + safeRadius - dx,
      x + width - safeRadius + dx - 1,
      y + height - dy - 1,
    );
  }
}

function drawPolarLine(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  angleDeg: number,
  innerRadius: number,
  outerRadius: number,
) {
  const radians = (angleDeg * Math.PI) / 180;
  const startX = centerX + Math.round(Math.cos(radians) * innerRadius);
  const startY = centerY - Math.round(Math.sin(radians) * innerRadius);
  const endX = centerX + Math.round(Math.cos(radians) * outerRadius);
  const endY = centerY - Math.round(Math.sin(radians) * outerRadius);

  const dx = Math.abs(endX - startX);
  const dy = Math.abs(endY - startY);
  const stepX = startX < endX ? 1 : -1;
  const stepY = startY < endY ? 1 : -1;
  let error = dx - dy;
  let x = startX;
  let y = startY;

  while (true) {
    putPixel(ctx, x, y);
    if (x === endX && y === endY) {
      break;
    }
    const nextError = error * 2;
    if (nextError > -dy) {
      error -= dy;
      x += stepX;
    }
    if (nextError < dx) {
      error += dx;
      y += stepY;
    }
  }
}

function clipToWidget(ctx: CanvasRenderingContext2D, widget: Widget) {
  ctx.beginPath();
  ctx.rect(widget.rect.x, widget.rect.y, widget.rect.width, widget.rect.height);
  ctx.clip();
}

function clipToWidgetRect(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }) {
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
}

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: FontGlyph,
  x: number,
  y: number,
) {
  const pageCount = Math.ceil(glyph.height / 8);
  for (let column = 0; column < glyph.width; column += 1) {
    for (let page = 0; page < pageCount; page += 1) {
      const byte = glyph.columns[column + page * glyph.width] ?? 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const pixelY = page * 8 + bit;
        if (pixelY >= glyph.height) {
          continue;
        }
        if ((byte & (1 << bit)) !== 0) {
          putPixel(ctx, x + column, y + pixelY);
        }
      }
    }
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontToken: FontToken,
) {
  let cursorX = x;
  for (const codePoint of decodeText(text)) {
    const glyph = getGlyph(fontToken, codePoint);
    drawGlyph(ctx, glyph, cursorX, y);
    cursorX += glyph.width;
  }
}

function wrapTextLines(text: string, fontToken: FontToken, maxWidth: number): string[] {
  if (maxWidth <= 0) {
    return [text];
  }

  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = "";
    for (const char of Array.from(paragraph)) {
      const nextLine = `${currentLine}${char}`;
      if (currentLine && measureText(nextLine, fontToken) > maxWidth) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = nextLine;
      }
    }

    lines.push(currentLine);
  }

  return lines;
}

function drawInvertedTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontToken: FontToken,
) {
  ctx.save();
  ctx.fillRect(x, y, width, height);
  ctx.globalCompositeOperation = "destination-out";
  drawText(ctx, text, x + 1, y, fontToken);
  ctx.restore();
}

function drawBitmap(
  ctx: CanvasRenderingContext2D,
  bitmap: MonoBitmap,
  x: number,
  y: number,
) {
  for (let rowIndex = 0; rowIndex < bitmap.rows.length; rowIndex += 1) {
    const row = bitmap.rows[rowIndex] ?? "";
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      if (row[columnIndex] === "1") {
        putPixel(ctx, x + columnIndex, y + rowIndex);
      }
    }
  }
}

function alignTextX(
  widgetX: number,
  widgetWidth: number,
  textWidth: number,
  align: "left" | "center" | "right",
) {
  if (align === "center") {
    return widgetX + Math.max(0, Math.floor((widgetWidth - textWidth) / 2));
  }

  if (align === "right") {
    return widgetX + Math.max(0, widgetWidth - textWidth);
  }

  return widgetX;
}

function resolveTextLabelText(
  props: TextLabelProps,
  variableMap: Map<string, VariableValue>,
) {
  if (!props.textVarId) {
    return props.text;
  }

  const dynamicValue = variableMap.get(props.textVarId);
  return dynamicValue === undefined ? props.text : String(dynamicValue);
}

function drawListWidget(ctx: CanvasRenderingContext2D, widget: Extract<Widget, { type: "list" }>, state: RenderState) {
  const runtime = getWidgetRuntime(widget, state.simulator);
  const metrics = getVisibleItemMetrics(widget, runtime ?? { visible: true, enabled: true });
  const selectedIndex = metrics.selectedIndex;
  const layout = metrics.layout;

  ctx.save();
  clipToWidgetRect(ctx, layout);
  strokeFrame(ctx, layout.x, layout.y, layout.width, layout.height);
  drawText(ctx, widget.props.title, layout.x + 1, layout.y + 1, widget.props.font);

  const itemStartY = layout.y + getLineHeight(widget.props.font) + 2;
  metrics.items.slice(metrics.startIndex, metrics.startIndex + metrics.visibleCount).forEach((item: typeof metrics.items[number], index: number) => {
    const itemIndex = metrics.startIndex + index;
    const label = resolveChoiceLabel(item.label, item.dynamicTextVarId, state.variableMap);
    const lineY = itemStartY + (index * metrics.itemHeight) + metrics.offset;
    const lineText = `${selectedIndex === itemIndex ? ">" : " "} ${label}`;
    if (selectedIndex === itemIndex) {
      drawInvertedTextLine(
        ctx,
        lineText,
        layout.x + 1,
        lineY,
        metrics.itemsWidth,
        metrics.itemHeight,
        widget.props.font,
      );
    } else {
      drawText(ctx, lineText, layout.x + 1, lineY, widget.props.font);
    }
  });

  if (metrics.showScrollbar) {
    const trackX = layout.x + layout.width - 5;
    const trackY = layout.y + getLineHeight(widget.props.font) + 2;
    const trackHeight = Math.max(1, layout.height - getLineHeight(widget.props.font) - 4);
    strokeFrame(ctx, trackX, trackY, 4, trackHeight);
    const thumbHeight = Math.max(3, Math.floor(trackHeight * Math.min(1, metrics.visibleCount / Math.max(1, metrics.items.length))));
    const thumbTop = trackY + Math.floor(((trackHeight - thumbHeight) * metrics.startIndex) / Math.max(1, metrics.items.length - metrics.visibleCount));
    fillRectPixels(ctx, trackX + 1, thumbTop, 2, thumbHeight);
  }
  ctx.restore();
}

function drawMenuWidget(ctx: CanvasRenderingContext2D, widget: Extract<Widget, { type: "menu" }>, state: RenderState) {
  const runtime = getWidgetRuntime(widget, state.simulator);
  const metrics = getVisibleItemMetrics(widget, runtime ?? { visible: true, enabled: true });
  const selectedIndex = metrics.selectedIndex;
  const layout = metrics.layout;

  ctx.save();
  clipToWidgetRect(ctx, layout);

  if (widget.props.frame) {
    strokeFrame(ctx, layout.x, layout.y, layout.width, layout.height);
  }

  metrics.items.slice(metrics.startIndex, metrics.startIndex + metrics.visibleCount).forEach((item: typeof metrics.items[number], index: number) => {
    const itemIndex = metrics.startIndex + index;
    const label = resolveChoiceLabel(item.label, item.dynamicTextVarId, state.variableMap);
    const lineY = metrics.itemsY + (index * metrics.itemHeight) + metrics.offset;
    const text = ` ${label}`;

    if (selectedIndex === itemIndex) {
      drawInvertedTextLine(ctx, text, metrics.itemsX, lineY, metrics.itemsWidth, metrics.itemHeight, widget.props.font);
    } else {
      drawText(ctx, text, metrics.itemsX, lineY, widget.props.font);
    }
  });

  if (metrics.showScrollbar) {
    const trackX = layout.x + layout.width - 5;
    const trackY = metrics.itemsY;
    const trackHeight = Math.max(1, metrics.itemsHeight);
    strokeFrame(ctx, trackX, trackY, 4, trackHeight);
    const thumbHeight = Math.max(3, Math.floor(trackHeight * Math.min(1, metrics.visibleCount / Math.max(1, metrics.items.length))));
    const thumbTop = trackY + Math.floor(((trackHeight - thumbHeight) * metrics.startIndex) / Math.max(1, metrics.items.length - metrics.visibleCount));
    fillRectPixels(ctx, trackX + 1, thumbTop, 2, thumbHeight);
  }

  if (widget.props.popupParentWidgetId) {
    const arrowX = layout.x - 2;
    const arrowY = layout.y + 2;
    drawText(ctx, ">", arrowX, arrowY, widget.props.font);
  }

  ctx.restore();
}

function drawNoticeWidget(
  ctx: CanvasRenderingContext2D,
  widget: Extract<Widget, { type: "notice" }>,
  state: RenderState,
) {
  const props: NoticeWidgetProps = widget.props;
  const runtimeText = getWidgetRuntime(widget, state.simulator)?.noticeText;
  const resource = props.iconResourceId
    ? state.project.resources.find((entry) => entry.id === props.iconResourceId)
    : undefined;
  const iconWidth = resource?.bitmap?.width ?? 0;
  const text = runtimeText ?? props.text;
  const layout = widget.rect;

  ctx.save();
  clipToWidgetRect(ctx, layout);

  if (props.frame) {
    strokeFrame(ctx, layout.x, layout.y, layout.width, layout.height);
  }

  if (resource?.bitmap) {
    const iconY = layout.y + 2;
    drawBitmap(ctx, resource.bitmap, layout.x + 2, iconY);
  }

  const textHeight = getLineHeight(props.font);
  const textX = resource?.bitmap ? layout.x + iconWidth + 4 : layout.x + 2;
  const textWidth = resource?.bitmap ? Math.max(1, layout.width - iconWidth - 6) : Math.max(1, layout.width - 4);
  const lines = wrapTextLines(text, props.font, textWidth);
  const textY = layout.y + 2 + props.textOffset;

  lines.forEach((line, index) => {
    drawText(ctx, line, textX, textY + index * textHeight, props.font);
  });
  ctx.restore();
}

function drawTextLabelWidget(
  ctx: CanvasRenderingContext2D,
  widget: Extract<Widget, { type: "textLabel" }>,
  state: RenderState,
) {
  const props = widget.props;
  const runtime = getWidgetRuntime(widget, state.simulator);
  const text = runtime?.titleOverride ?? resolveTextLabelText(props, state.variableMap);
  const lineHeight = getLineHeight(props.font);
  const lines = props.multiline ? wrapTextLines(text, props.font, widget.rect.width) : text.split("\n");

  ctx.save();
  clipToWidget(ctx, widget);
  lines.forEach((line, index) => {
    const lineWidth = measureText(line, props.font);
    const lineX = alignTextX(widget.rect.x, widget.rect.width, lineWidth, props.align);
    const lineY = widget.rect.y + index * lineHeight;
    if (props.drawMode === "reverse") {
      drawInvertedTextLine(ctx, line, lineX, lineY, Math.max(lineWidth + 2, widget.rect.width), lineHeight, props.font);
    } else {
      drawText(ctx, line, lineX, lineY, props.font);
    }
  });
  ctx.restore();
}

function drawShapeWidget(
  ctx: CanvasRenderingContext2D,
  widget: Extract<Widget, { type: "shape" }>,
) {
  const props: ShapeWidgetProps = widget.props;
  const { x, y, width, height } = widget.rect;

  switch (props.kind) {
    case "rect":
      if (props.fill) {
        fillRectPixels(ctx, x, y, width, height);
      } else {
        strokeFrame(ctx, x, y, width, height);
      }
      break;
    case "circle": {
      const radius = Math.max(0, Math.min(Math.floor(width / 2), Math.floor(height / 2)) - 1);
      const centerX = x + Math.floor(width / 2);
      const centerY = y + Math.floor(height / 2);
      if (props.fill) {
        fillCircle(ctx, centerX, centerY, radius);
      } else {
        drawCircleOutline(ctx, centerX, centerY, radius);
      }
      break;
    }
    case "roundedRect":
      if (props.fill) {
        fillRoundedRect(ctx, x, y, width, height, props.radius);
      } else {
        drawRoundedRectOutline(ctx, x, y, width, height, props.radius);
      }
      break;
    case "hline":
      drawHorizontalLine(ctx, x, x + width - 1, y);
      break;
    case "vline":
      drawVerticalLine(ctx, x, y, y + height - 1);
      break;
  }
}

function drawNumberWidget(
  ctx: CanvasRenderingContext2D,
  widget: Extract<Widget, { type: "numberVariableBox" }>,
  state: RenderState,
) {
  const text = readWidgetVariableValue(widget, state.variableMap);
  const textWidth = measureText(text, widget.props.font);
  const textHeight = getLineHeight(widget.props.font);
  const runtime = getWidgetRuntime(widget, state.simulator);
  let textX = widget.rect.x + 1;

  if (widget.props.alignment === "center") {
    textX = widget.rect.x + Math.max(1, Math.floor((widget.rect.width - textWidth) / 2));
  }
  if (widget.props.alignment === "right") {
    textX = widget.rect.x + Math.max(1, widget.rect.width - textWidth - 1);
  }

  const textY = widget.rect.y + Math.max(0, Math.floor((widget.rect.height - textHeight) / 2));
  strokeFrame(ctx, widget.rect.x, widget.rect.y, widget.rect.width, widget.rect.height);
  if (runtime?.visible && runtime.enabled && state.simulator?.focusedWidgetId === widget.id) {
    drawInvertedTextLine(ctx, text, widget.rect.x, widget.rect.y, widget.rect.width, widget.rect.height, widget.props.font);
  } else {
    drawText(ctx, text, textX, textY, widget.props.font);
  }
}

function drawTextVariableWidget(
  ctx: CanvasRenderingContext2D,
  widget: Extract<Widget, { type: "textVariableBox" }>,
  state: RenderState,
) {
  const current = readWidgetVariableValue(widget, state.variableMap)
    .padEnd(widget.props.length, " ")
    .slice(0, widget.props.length);
  const runtime = getWidgetRuntime(widget, state.simulator);
  const fallbackWidth = getFontDefinition(widget.props.font).halfWidth;
  const focusIndex = getWidgetFocusIndex(widget, state.simulator);
  const firstVisibleIndex = runtime?.textFirstVisibleIndex ?? 0;
  const lastVisibleIndex = runtime?.textLastVisibleIndex ?? Math.min(widget.props.length - 1, Math.max(0, widget.props.length - 1));
  const textOffset = runtime?.textOffset ?? 0;
  const textY = widget.rect.y;

  strokeFrame(ctx, widget.rect.x, widget.rect.y, widget.rect.width, widget.rect.height);

  for (let index = firstVisibleIndex; index <= lastVisibleIndex; index += 1) {
    const char = current[index] ?? " ";
    const displayChar = widget.props.maskChar ? (index === focusIndex ? char : widget.props.maskChar) : char;
    const cellX = widget.rect.x + textOffset + ((index - firstVisibleIndex) * fallbackWidth);
    const isFocused = focusIndex === index && state.simulator?.focusedWidgetId === widget.id;
    if (isFocused && runtime?.enabled && runtime.visible) {
      drawInvertedTextLine(ctx, displayChar, cellX, widget.rect.y, fallbackWidth, widget.rect.height, widget.props.font);
    } else {
      drawText(ctx, displayChar, cellX, textY, widget.props.font);
    }
  }
}

function drawGraphWidget(
  ctx: CanvasRenderingContext2D,
  widget: Extract<Widget, { type: "realtimeGraph" }>,
  state: RenderState,
) {
  const props: RealtimeGraphProps = widget.props;
  const values = getGraphBuffer(widget.id, state.simulator);
  ctx.save();
  clipToWidget(ctx, widget);

  if (props.enableBaseline) {
    const ratio = (props.baselineValue - props.min) / Math.max(1, props.max - props.min);
    const y = widget.rect.y + widget.rect.height - 1 - Math.round(ratio * (widget.rect.height - 1));
    ctx.fillRect(widget.rect.x, y, widget.rect.width, 1);
  }

  if (values.length >= 2) {
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = widget.rect.x + Math.min(widget.rect.width - 1, index * Math.max(1, props.xStepPixel));
      const ratio = (value - props.min) / Math.max(1, props.max - props.min);
      const y = widget.rect.y + widget.rect.height - 1 - Math.round(ratio * (widget.rect.height - 1));
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }

  ctx.restore();
}

function drawProcessBarWidget(
  ctx: CanvasRenderingContext2D,
  widget: Extract<Widget, { type: "processBar" }>,
  state: RenderState,
) {
  const props: ProcessBarProps = widget.props;
  const raw = Number(readWidgetVariableValue(widget, state.variableMap));
  const ratio = Number.isFinite(raw)
    ? Math.max(0, Math.min(1, raw / Math.max(1, props.maxValue)))
    : 0;

  if (props.frame) {
    strokeFrame(ctx, widget.rect.x, widget.rect.y, widget.rect.width, widget.rect.height);
  }

  const innerX = widget.rect.x + (props.frame ? 1 : 0);
  const innerY = widget.rect.y + (props.frame ? 1 : 0);
  const innerWidth = widget.rect.width - (props.frame ? 2 : 0);
  const innerHeight = widget.rect.height - (props.frame ? 2 : 0);

  switch (props.direction) {
    case "right":
      ctx.fillRect(innerX, innerY, Math.round(innerWidth * ratio), innerHeight);
      break;
    case "left": {
      const width = Math.round(innerWidth * ratio);
      ctx.fillRect(innerX + innerWidth - width, innerY, width, innerHeight);
      break;
    }
    case "up": {
      const height = Math.round(innerHeight * ratio);
      ctx.fillRect(innerX, innerY + innerHeight - height, innerWidth, height);
      break;
    }
    case "down":
      ctx.fillRect(innerX, innerY, innerWidth, Math.round(innerHeight * ratio));
      break;
  }
}

function getCurvePoints(
  widget: Extract<Widget, { type: "curve" }>,
  simulator: SimulatorSession | null,
): CurvePointDefinition[] {
  return simulator?.widgetRuntimeState[widget.id]?.curvePoints ?? widget.props.points;
}

function getCurveFocusedIndex(
  widget: Extract<Widget, { type: "curve" }>,
  simulator: SimulatorSession | null,
): number | null {
  const runtimeValue = simulator?.widgetRuntimeState[widget.id]?.curveFocusedIndex;
  return runtimeValue === undefined ? widget.props.focusedIndex : runtimeValue;
}

function getCurveArgumentValue(
  widget: Extract<Widget, { type: "curve" }>,
  simulator: SimulatorSession | null,
): number {
  return simulator?.widgetRuntimeState[widget.id]?.curveArgumentValue ?? widget.props.argumentValue;
}

function mapCurvePoint(
  widget: Extract<Widget, { type: "curve" }>,
  point: CurvePointDefinition,
) {
  const graphLeft = widget.rect.x + 1;
  const graphTop = widget.rect.y + 10;
  const graphWidth = widget.rect.width - 2;
  const graphHeight = widget.rect.height - 20;
  const xRatio =
    (point.x - widget.props.xMin) / Math.max(1, widget.props.xMax - widget.props.xMin);
  const yRatio =
    (point.y - widget.props.yMin) / Math.max(1, widget.props.yMax - widget.props.yMin);

  return {
    x: graphLeft + Math.round(xRatio * Math.max(0, graphWidth - 1)),
    y: graphTop + graphHeight - 1 - Math.round(yRatio * Math.max(0, graphHeight - 1)),
    graphLeft,
    graphTop,
    graphWidth,
    graphHeight,
  };
}

function interpolateCurveValue(
  points: CurvePointDefinition[],
  x: number,
) {
  if (points.length === 0) {
    return 0;
  }

  if (x <= points[0].x) {
    return points[0].y;
  }

  if (x >= points[points.length - 1].x) {
    return points[points.length - 1].y;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (x < left.x || x > right.x) {
      continue;
    }

    const ratio = (x - left.x) / Math.max(1, right.x - left.x);
    return Math.round(left.y + ((right.y - left.y) * ratio));
  }

  return points[points.length - 1].y;
}

function drawCurveWidget(
  ctx: CanvasRenderingContext2D,
  widget: Extract<Widget, { type: "curve" }>,
  state: RenderState,
) {
  const points = [...getCurvePoints(widget, state.simulator)].sort((left, right) => left.x - right.x);
  const focusedIndex = getCurveFocusedIndex(widget, state.simulator);
  const argumentValue = getCurveArgumentValue(widget, state.simulator);
  const lineHeight = getLineHeight(widget.props.font);

  strokeFrame(ctx, widget.rect.x, widget.rect.y, widget.rect.width, widget.rect.height);
  drawHorizontalLine(ctx, widget.rect.x + 1, widget.rect.x + widget.rect.width - 2, widget.rect.y + 9);
  drawHorizontalLine(
    ctx,
    widget.rect.x + 1,
    widget.rect.x + widget.rect.width - 2,
    widget.rect.y + widget.rect.height - 10,
  );
  drawText(ctx, widget.props.headerText, widget.rect.x + 1, widget.rect.y + 1, widget.props.font);

  if (points.length >= 2) {
    ctx.beginPath();
    points.forEach((point, index) => {
      const mapped = mapCurvePoint(widget, point);
      if (index === 0) {
        ctx.moveTo(mapped.x, mapped.y);
      } else {
        ctx.lineTo(mapped.x, mapped.y);
      }
    });
    ctx.stroke();
  }

  points.forEach((point, index) => {
    const mapped = mapCurvePoint(widget, point);
    fillRectPixels(ctx, mapped.x - 1, mapped.y - 1, 3, 3);
    if (focusedIndex === index) {
      strokeFrame(ctx, mapped.x - 2, mapped.y - 2, 5, 5);
    }
  });

  let footerText = "";
  if (focusedIndex !== null && points[focusedIndex]) {
    footerText = `${points[focusedIndex].x},${points[focusedIndex].y}`;
  } else {
    const dependentValue = interpolateCurveValue(points, argumentValue);
    const mapped = mapCurvePoint(widget, { x: argumentValue, y: dependentValue });
    drawVerticalLine(ctx, mapped.x, mapped.graphTop, mapped.graphTop + mapped.graphHeight - 1);
    footerText = `${argumentValue},${dependentValue}`;
  }

  drawText(
    ctx,
    footerText,
    widget.rect.x + 1,
    widget.rect.y + widget.rect.height - lineHeight - 1,
    widget.props.font,
  );
}

function resolvePolarClockTime(
  widget: Extract<Widget, { type: "polarClock" }>,
  state: RenderState,
) {
  const props: PolarClockProps = widget.props;
  if (props.timeSource === "variables") {
    return {
      hour: Number(state.variableMap.get(props.hourVarId ?? "")) || 0,
      minute: Number(state.variableMap.get(props.minuteVarId ?? "")) || 0,
      second: Number(state.variableMap.get(props.secondVarId ?? "")) || 0,
    };
  }

  const now = new Date();
  return {
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  };
}

function drawPolarClockWidget(
  ctx: CanvasRenderingContext2D,
  widget: Extract<Widget, { type: "polarClock" }>,
  state: RenderState,
) {
  const props = widget.props;
  const { hour, minute, second } = resolvePolarClockTime(widget, state);

  drawCircleOutline(ctx, props.dialCenterX, props.dialCenterY, props.radius + 3);
  clearCircle(ctx, props.dialCenterX, props.dialCenterY, props.radius);
  drawCircleOutline(ctx, props.dialCenterX, props.dialCenterY, props.radius);

  for (let angle = 90; angle <= 450; angle += 30) {
    drawPolarLine(ctx, props.dialCenterX, props.dialCenterY, angle, props.radius - 3, props.radius - 1);
  }

  const minuteAngle = 450 - ((minute % 60) * 6);
  const secondAngle = 450 - ((second % 60) * 6);
  const hourAngle = 450 - ((((hour % 12) * 30) + Math.floor(minute / 2)) - 1);

  drawPolarLine(ctx, props.dialCenterX, props.dialCenterY, minuteAngle, 0, props.radius - 9);
  drawPolarLine(ctx, props.dialCenterX, props.dialCenterY, secondAngle, 0, props.radius - 5);
  drawPolarLine(ctx, props.dialCenterX, props.dialCenterY, hourAngle, 0, props.radius - 18);
  drawText(
    ctx,
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
    props.textX,
    props.textY,
    props.font,
  );
}

function drawWidget(ctx: CanvasRenderingContext2D, widget: Widget, state: RenderState) {
  switch (widget.type) {
    case "list":
      drawListWidget(ctx, widget, state);
      break;
    case "menu":
      drawMenuWidget(ctx, widget, state);
      break;
    case "notice":
      drawNoticeWidget(ctx, widget, state);
      break;
    case "textLabel":
      drawTextLabelWidget(ctx, widget, state);
      break;
    case "shape":
      drawShapeWidget(ctx, widget);
      break;
    case "numberVariableBox":
      drawNumberWidget(ctx, widget, state);
      break;
    case "textVariableBox":
      drawTextVariableWidget(ctx, widget, state);
      break;
    case "realtimeGraph":
      drawGraphWidget(ctx, widget, state);
      break;
    case "processBar":
      drawProcessBarWidget(ctx, widget, state);
      break;
    case "curve":
      drawCurveWidget(ctx, widget, state);
      break;
    case "polarClock":
      drawPolarClockWidget(ctx, widget, state);
      break;
  }
}

function createMonochromeBuffer(state: RenderState): HTMLCanvasElement {
  const width = state.project.screen.width;
  const height = state.project.screen.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.imageSmoothingEnabled = false;

  sortWidgets(state.picture.widgets).forEach((widget) => {
    if (getWidgetVisible(widget, state.simulator)) {
      drawWidget(ctx, widget, state);
    }
  });

  return canvas;
}

export function paintLcdScreen(
  canvas: HTMLCanvasElement,
  state: Omit<RenderState, "scale"> & { scale: number; showPixelGrid: boolean },
) {
  const width = state.project.screen.width;
  const height = state.project.screen.height;
  const pitch = Math.max(2, Math.round(state.scale));
  const showGrid = state.showPixelGrid && pitch >= 3;
  const outputWidth = width * pitch;
  const outputHeight = height * pitch;

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, outputWidth, outputHeight);
  ctx.imageSmoothingEnabled = false;

  const buffer = createMonochromeBuffer({ ...state, scale: 1 });
  const bufferCtx = buffer.getContext("2d");
  if (!bufferCtx) {
    return;
  }

  const imageData = bufferCtx.getImageData(0, 0, width, height).data;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const brightness =
        (imageData[index] ?? 0) + (imageData[index + 1] ?? 0) + (imageData[index + 2] ?? 0);
      const alpha = imageData[index + 3] ?? 0;
      const isLit = alpha > 0 && brightness > 20;
      ctx.fillStyle = isLit ? "#000000" : "#ffffff";
      ctx.fillRect(x * pitch, y * pitch, pitch, pitch);
    }
  }

  if (showGrid) {
    ctx.fillStyle = "#e7e7e7";

    for (let x = 1; x < width; x += 1) {
      ctx.fillRect(x * pitch - 1, 0, 1, outputHeight);
    }

    for (let y = 1; y < height; y += 1) {
      ctx.fillRect(0, y * pitch - 1, outputWidth, 1);
    }
  }
}

export function paintLcdBitmapScreen(
  canvas: HTMLCanvasElement,
  bitmap: MonoBitmap,
  options: { scale: number; showPixelGrid: boolean },
) {
  const width = bitmap.width;
  const height = bitmap.height;
  const pitch = Math.max(2, Math.round(options.scale));
  const showGrid = options.showPixelGrid && pitch >= 3;
  const outputWidth = width * pitch;
  const outputHeight = height * pitch;

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, outputWidth, outputHeight);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  for (let y = 0; y < height; y += 1) {
    const row = bitmap.rows[y] ?? "";
    for (let x = 0; x < width; x += 1) {
      const isLit = row[x] === "1";
      ctx.fillStyle = isLit ? "#000000" : "#ffffff";
      ctx.fillRect(x * pitch, y * pitch, pitch, pitch);
    }
  }

  if (showGrid) {
    ctx.fillStyle = "#e7e7e7";

    for (let x = 1; x < width; x += 1) {
      ctx.fillRect(x * pitch - 1, 0, 1, outputHeight);
    }

    for (let y = 1; y < height; y += 1) {
      ctx.fillRect(0, y * pitch - 1, outputWidth, 1);
    }
  }
}
