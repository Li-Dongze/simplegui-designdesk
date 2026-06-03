import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useProjectStore } from "@/stores/projectStore";
import type { MonoBitmap } from "@/types/project";
import {
  monoBitmapToBmpBlob,
  processImageFileToBitmap,
  type BitmapProcessingOptions,
} from "@/utils/bitmapWorkbench";
import { paintLcdBitmapScreen } from "@/utils/lcdRenderer";

const LCD_WIDTH = 128;
const LCD_HEIGHT = 64;
const THRESHOLD_MAX = 510;

const MIN_TOP_HEIGHT = 120;
const MAX_TOP_HEIGHT = 320;
const MIN_LIST_WIDTH = 200;
const MAX_LIST_WIDTH = 620;
const MIN_PARAM_WIDTH = 260;
const MAX_PARAM_WIDTH = 760;
const MIN_PREVIEW_WIDTH = 320;
const MIN_BOTTOM_HEIGHT = 200;

const DEFAULT_OPTIONS: BitmapProcessingOptions = {
  width: LCD_WIDTH,
  height: LCD_HEIGHT,
  fitMode: "cover",
  interpolation: "nearest",
  threshold: 96,
  invert: false,
  contrast: 1,
  gamma: 1,
  horizontalGap: 0,
  verticalGap: 0,
  diagonalGap: 0,
  gapFillPasses: 0,
  bridgeDistance: 0,
  reinforceMinRun: 0,
  reinforceRadius: 0,
  dilateIterations: 0,
  despeckleMinArea: 0,
};

type LogLevel = "info" | "error";
type PixelValue = "0" | "1";

interface ImportedImageItem {
  id: string;
  displayName: string;
  file: File;
}

interface BitmapWorkbenchLog {
  id: string;
  time: string;
  level: LogLevel;
  text: string;
}

interface BatchProgress {
  done: number;
  total: number;
  failed: number;
  currentName: string;
}

type SplitDragKind = "top" | "left" | "right";

interface SplitDragState {
  kind: SplitDragKind;
  pointerId: number;
  startX: number;
  startY: number;
  startTopHeight: number;
  startListWidth: number;
  startParamWidth: number;
}

interface ProcessedImageEntry {
  sourceBitmap: MonoBitmap;
  outputBitmap: MonoBitmap;
  editedBitmap: MonoBitmap;
  litPixels: number;
  density: number;
  optionsHash: string;
}

interface PixelPoint {
  x: number;
  y: number;
}

interface PixelEditDragState {
  pointerId: number;
  value: PixelValue;
  lastX: number;
  lastY: number;
}

interface FileSystemWritableFileStreamLike {
  write(data: Blob | ArrayBufferView | ArrayBuffer | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

interface FileSystemDirectoryHandleLike {
  name?: string;
  getFileHandle(
    name: string,
    options?: {
      create?: boolean;
    },
  ): Promise<FileSystemFileHandleLike>;
}

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildOptionsHash(options: BitmapProcessingOptions): string {
  return JSON.stringify(options);
}

function countLitPixels(bitmap: MonoBitmap): number {
  let lit = 0;
  for (let y = 0; y < bitmap.height; y += 1) {
    const row = bitmap.rows[y] ?? "";
    for (let x = 0; x < bitmap.width; x += 1) {
      if (row[x] === "1") {
        lit += 1;
      }
    }
  }
  return lit;
}

function densityFromBitmap(bitmap: MonoBitmap, litPixels: number): number {
  const total = Math.max(1, bitmap.width * bitmap.height);
  return litPixels / total;
}

function isImageFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    file.type.startsWith("image/") ||
    lowerName.endsWith(".bmp") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp")
  );
}

function makeBmpName(sourceName: string, index: number): string {
  const baseName = sourceName
    .replace(/\.[^/.]+$/, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  const safe = baseName.length > 0 ? baseName : `frame_${String(index).padStart(4, "0")}`;
  return `${safe}.bmp`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function writeBlobToDirectory(
  dirHandle: FileSystemDirectoryHandleLike,
  fileName: string,
  blob: Blob,
): Promise<void> {
  const handle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function normalizeRow(row: string, width: number): string {
  if (row.length === width) {
    return row;
  }
  if (row.length > width) {
    return row.slice(0, width);
  }
  return `${row}${"0".repeat(width - row.length)}`;
}

function rasterLine(from: PixelPoint, to: PixelPoint): PixelPoint[] {
  const points: PixelPoint[] = [];
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const doubled = err * 2;
    if (doubled > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (doubled < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return points;
}

function applyLineToBitmap(
  bitmap: MonoBitmap,
  from: PixelPoint,
  to: PixelPoint,
  value: PixelValue,
): MonoBitmap {
  const width = bitmap.width;
  const height = bitmap.height;
  const rows = bitmap.rows.slice(0, height).map((row) => normalizeRow(row, width));
  let changed = false;

  const points = rasterLine(from, to);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point) {
      continue;
    }
    if (point.x < 0 || point.x >= width || point.y < 0 || point.y >= height) {
      continue;
    }
    const row = rows[point.y] ?? "0".repeat(width);
    if (row[point.x] !== value) {
      rows[point.y] = `${row.slice(0, point.x)}${value}${row.slice(point.x + 1)}`;
      changed = true;
    }
  }

  if (!changed) {
    return bitmap;
  }

  return {
    width,
    height,
    rows,
  };
}

function getPixelFromPointer(
  event: ReactPointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  pitch: number,
  width: number,
  height: number,
): PixelPoint | null {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / pitch);
  const y = Math.floor((event.clientY - rect.top) / pitch);
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return null;
  }
  return { x, y };
}

export function BitmapWorkbenchPage() {
  const theme = useProjectStore((state) => state.theme);
  const closeDebugPanel = useProjectStore((state) => state.closeDebugPanel);
  const openDebugPanel = useProjectStore((state) => state.openDebugPanel);

  const [options, setOptions] = useState<BitmapProcessingOptions>(DEFAULT_OPTIONS);
  const [sourceFolderLabel, setSourceFolderLabel] = useState("未加载");
  const [images, setImages] = useState<ImportedImageItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [previewScale, setPreviewScale] = useState(4);
  const [exportFps, setExportFps] = useState(30);
  const [outputFolderLabel, setOutputFolderLabel] = useState("未选择（将使用浏览器下载）");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    done: 0,
    total: 0,
    failed: 0,
    currentName: "",
  });
  const [logs, setLogs] = useState<BitmapWorkbenchLog[]>([]);
  const [topHeight, setTopHeight] = useState(178);
  const [listWidth, setListWidth] = useState(280);
  const [paramWidth, setParamWidth] = useState(370);
  const [splitDragState, setSplitDragState] = useState<SplitDragState | null>(null);
  const [processedById, setProcessedById] = useState<Record<string, ProcessedImageEntry>>({});
  const [selectedSourceUrl, setSelectedSourceUrl] = useState("");
  const [, setSelectedSourceImage] = useState<HTMLImageElement | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const outputDirRef = useRef<FileSystemDirectoryHandleLike | null>(null);
  const processedPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelEditDragRef = useRef<PixelEditDragState | null>(null);

  const selectedFile = useMemo(
    () => images.find((item) => item.id === selectedImageId) ?? null,
    [images, selectedImageId],
  );

  const selectedProcessed = useMemo(() => {
    if (!selectedFile) {
      return null;
    }
    return processedById[selectedFile.id] ?? null;
  }, [processedById, selectedFile]);

  const optionsHash = useMemo(() => buildOptionsHash(options), [options]);

  const appendLog = useCallback((level: LogLevel, text: string) => {
    setLogs((previous) => {
      const next = previous.slice(-199);
      next.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toLocaleTimeString(),
        level,
        text,
      });
      return next;
    });
  }, []);

  const updateOption = useCallback(
    <K extends keyof BitmapProcessingOptions>(key: K, value: BitmapProcessingOptions[K]) => {
      setOptions((previous) => ({ ...previous, [key]: value }));
    },
    [],
  );

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }
    inputRef.current.setAttribute("webkitdirectory", "");
    inputRef.current.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (!splitDragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== splitDragState.pointerId) {
        return;
      }

      const deltaX = event.clientX - splitDragState.startX;
      const deltaY = event.clientY - splitDragState.startY;
      const rootWidth = rootRef.current?.clientWidth ?? window.innerWidth;
      const rootHeight = rootRef.current?.clientHeight ?? window.innerHeight;

      if (splitDragState.kind === "left") {
        const maxByPreview = rootWidth - splitDragState.startParamWidth - MIN_PREVIEW_WIDTH - 16;
        const next = clamp(
          splitDragState.startListWidth + deltaX,
          MIN_LIST_WIDTH,
          Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, maxByPreview)),
        );
        setListWidth(next);
        return;
      }

      if (splitDragState.kind === "right") {
        const maxByPreview = rootWidth - splitDragState.startListWidth - MIN_PREVIEW_WIDTH - 16;
        const next = clamp(
          splitDragState.startParamWidth - deltaX,
          MIN_PARAM_WIDTH,
          Math.min(MAX_PARAM_WIDTH, Math.max(MIN_PARAM_WIDTH, maxByPreview)),
        );
        setParamWidth(next);
        return;
      }

      const maxTop = Math.max(MIN_TOP_HEIGHT, Math.min(MAX_TOP_HEIGHT, rootHeight - MIN_BOTTOM_HEIGHT - 8));
      const next = clamp(splitDragState.startTopHeight + deltaY, MIN_TOP_HEIGHT, maxTop);
      setTopHeight(next);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== splitDragState.pointerId) {
        return;
      }
      setSplitDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    document.body.classList.add("is-resizing-panels");

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.classList.remove("is-resizing-panels");
    };
  }, [splitDragState]);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedSourceUrl("");
      setSelectedSourceImage(null);
      return;
    }

    let cancelled = false;
    const objectUrl = URL.createObjectURL(selectedFile.file);
    setSelectedSourceUrl(objectUrl);
    const image = new Image();

    image.onload = () => {
      if (!cancelled) {
        setSelectedSourceImage(image);
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setSelectedSourceUrl("");
        setSelectedSourceImage(null);
        setPreviewError("无法加载原图预览。");
      }
    };

    image.src = objectUrl;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) {
      setIsPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    let cancelled = false;

    const processSelected = async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        const result = await processImageFileToBitmap(selectedFile.file, options);
        if (cancelled) {
          return;
        }

        setProcessedById((previous) => {
          const existing = previous[selectedFile.id];
          const preserveEdited = existing && existing.optionsHash === optionsHash;
          const editedBitmap = preserveEdited ? existing.editedBitmap : result.outputBitmap;
          const litPixels = countLitPixels(editedBitmap);
          const density = densityFromBitmap(editedBitmap, litPixels);
          return {
            ...previous,
            [selectedFile.id]: {
              sourceBitmap: result.sourceBitmap,
              outputBitmap: result.outputBitmap,
              editedBitmap,
              litPixels,
              density,
              optionsHash,
            },
          };
        });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "处理失败。";
          setPreviewError(message);
          appendLog("error", `预览失败：${selectedFile.displayName}（${message}）`);
        }
      } finally {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      }
    };

    void processSelected();

    return () => {
      cancelled = true;
    };
  }, [appendLog, options, optionsHash, selectedFile]);

  useEffect(() => {
    if (!processedPreviewCanvasRef.current || !selectedProcessed) {
      return;
    }
    paintLcdBitmapScreen(processedPreviewCanvasRef.current, selectedProcessed.editedBitmap, {
      scale: previewScale,
      showPixelGrid: true,
      theme,
    });
  }, [previewScale, selectedProcessed, theme]);

  const handleSplitterPointerDown =
    (kind: SplitDragKind) =>
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      event.preventDefault();
      setSplitDragState({
        kind,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTopHeight: topHeight,
        startListWidth: listWidth,
        startParamWidth: paramWidth,
      });
    };

  const handleSelectInputFolder = (): void => {
    inputRef.current?.click();
  };

  const handleImportFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []).filter(isImageFile);
    if (files.length === 0) {
      appendLog("error", "未发现可处理的图片文件。");
      event.target.value = "";
      return;
    }

    const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
    const sorted = files.sort((left, right) =>
      collator.compare(left.webkitRelativePath || left.name, right.webkitRelativePath || right.name),
    );

    const imported = sorted.map((file, index) => ({
      id: `${Date.now()}_${index}`,
      displayName: file.webkitRelativePath || file.name,
      file,
    }));

    const firstPath = sorted[0]?.webkitRelativePath ?? "";
    const guessedFolder = firstPath.includes("/") ? firstPath.split("/")[0] : "已选择图片";

    setImages(imported);
    setSelectedImageId(imported[0]?.id ?? "");
    setSourceFolderLabel(guessedFolder);
    setProcessedById({});
    setPreviewError(null);
    setBatchProgress({ done: 0, total: imported.length, failed: 0, currentName: "" });
    appendLog("info", `已导入 ${imported.length} 张图片，来源：${guessedFolder}。`);

    event.target.value = "";
  };

  const handlePickOutputDirectory = async (): Promise<void> => {
    const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
    if (!picker) {
      window.alert("当前浏览器不支持目录写入，将使用浏览器下载导出。建议使用 Chrome 或 Edge。");
      return;
    }
    try {
      const dirHandle = await picker();
      outputDirRef.current = dirHandle;
      setOutputFolderLabel(dirHandle.name?.trim() || "已选择目录");
      appendLog("info", `输出目录已选择：${dirHandle.name?.trim() || "未命名目录"}。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "选择目录失败。";
      appendLog("error", message);
    }
  };

  const handleExportCurrent = async (): Promise<void> => {
    if (!selectedFile || !selectedProcessed) {
      return;
    }

    const fileName = makeBmpName(selectedFile.file.name, 1);
    const blob = monoBitmapToBmpBlob(selectedProcessed.editedBitmap);

    try {
      if (outputDirRef.current) {
        await writeBlobToDirectory(outputDirRef.current, fileName, blob);
        appendLog("info", `当前图片已写入目录：${fileName}`);
      } else {
        downloadBlob(blob, fileName);
        appendLog("info", `当前图片已下载：${fileName}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "导出当前图片失败。";
      appendLog("error", message);
    }
  };

  const handleBatchExport = async (): Promise<void> => {
    if (images.length === 0 || isBatchRunning) {
      return;
    }

    setIsBatchRunning(true);
    setBatchProgress({
      done: 0,
      total: images.length,
      failed: 0,
      currentName: "",
    });
    appendLog("info", `开始批量处理，共 ${images.length} 张。`);

    let failed = 0;
    const exportedNames: string[] = [];

    try {
      for (let index = 0; index < images.length; index += 1) {
        const item = images[index];
        if (!item) {
          continue;
        }
        setBatchProgress((previous) => ({ ...previous, currentName: item.displayName }));

        try {
          let bitmapToExport: MonoBitmap;
          const cached = processedById[item.id];

          if (cached && cached.optionsHash === optionsHash) {
            bitmapToExport = cached.editedBitmap;
          } else {
            const result = await processImageFileToBitmap(item.file, options);
            bitmapToExport = result.outputBitmap;

            const litPixels = countLitPixels(bitmapToExport);
            const density = densityFromBitmap(bitmapToExport, litPixels);
            setProcessedById((previous) => ({
              ...previous,
              [item.id]: {
                sourceBitmap: result.sourceBitmap,
                outputBitmap: result.outputBitmap,
                editedBitmap: result.outputBitmap,
                litPixels,
                density,
                optionsHash,
              },
            }));
          }

          const fileName = makeBmpName(item.file.name, index + 1);
          const blob = monoBitmapToBmpBlob(bitmapToExport);

          if (outputDirRef.current) {
            await writeBlobToDirectory(outputDirRef.current, fileName, blob);
          } else {
            downloadBlob(blob, fileName);
            await sleep(20);
          }

          exportedNames.push(fileName);
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : "处理失败。";
          appendLog("error", `${item.displayName} 导出失败：${message}`);
        } finally {
          const done = index + 1;
          setBatchProgress((previous) => ({ ...previous, done, failed }));
        }
      }

      const manifest = {
        sourceFolder: sourceFolderLabel,
        generatedAt: new Date().toISOString(),
        width: LCD_WIDTH,
        height: LCD_HEIGHT,
        fps: Math.max(1, Math.round(exportFps)),
        frameCount: exportedNames.length,
        failedCount: failed,
        files: exportedNames,
        processingOptions: options,
      };
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
        type: "application/json",
      });

      if (outputDirRef.current) {
        await writeBlobToDirectory(outputDirRef.current, "manifest.json", manifestBlob);
      } else {
        downloadBlob(manifestBlob, "manifest.json");
      }

      appendLog("info", `批量处理完成：成功 ${exportedNames.length}，失败 ${failed}。`);
      setBatchProgress((previous) => ({ ...previous, currentName: "" }));
    } finally {
      setIsBatchRunning(false);
    }
  };

  const applyEditLine = useCallback(
    (from: PixelPoint, to: PixelPoint, value: PixelValue) => {
      if (!selectedFile) {
        return;
      }

      setProcessedById((previous) => {
        const entry = previous[selectedFile.id];
        if (!entry) {
          return previous;
        }
        const nextBitmap = applyLineToBitmap(entry.editedBitmap, from, to, value);
        if (nextBitmap === entry.editedBitmap) {
          return previous;
        }
        const litPixels = countLitPixels(nextBitmap);
        const density = densityFromBitmap(nextBitmap, litPixels);
        return {
          ...previous,
          [selectedFile.id]: {
            ...entry,
            editedBitmap: nextBitmap,
            litPixels,
            density,
          },
        };
      });
    },
    [selectedFile],
  );

  const handleResetCurrentEdits = (): void => {
    if (!selectedFile) {
      return;
    }
    setProcessedById((previous) => {
      const entry = previous[selectedFile.id];
      if (!entry) {
        return previous;
      }
      const litPixels = countLitPixels(entry.outputBitmap);
      const density = densityFromBitmap(entry.outputBitmap, litPixels);
      return {
        ...previous,
        [selectedFile.id]: {
          ...entry,
          editedBitmap: entry.outputBitmap,
          litPixels,
          density,
        },
      };
    });
    appendLog("info", "当前图片已重置为取模结果。");
  };

  const handleProcessedCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!selectedProcessed || !processedPreviewCanvasRef.current) {
      return;
    }

    event.preventDefault();
    const pitch = Math.max(2, Math.round(previewScale));
    const point = getPixelFromPointer(
      event,
      processedPreviewCanvasRef.current,
      pitch,
      selectedProcessed.editedBitmap.width,
      selectedProcessed.editedBitmap.height,
    );
    if (!point) {
      return;
    }

    const row = selectedProcessed.editedBitmap.rows[point.y] ?? "";
    const nextValue: PixelValue = row[point.x] === "1" ? "0" : "1";

    pixelEditDragRef.current = {
      pointerId: event.pointerId,
      value: nextValue,
      lastX: point.x,
      lastY: point.y,
    };
    applyEditLine(point, point, nextValue);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleProcessedCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const dragState = pixelEditDragRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId || !selectedProcessed || !processedPreviewCanvasRef.current) {
      return;
    }

    event.preventDefault();
    const pitch = Math.max(2, Math.round(previewScale));
    const point = getPixelFromPointer(
      event,
      processedPreviewCanvasRef.current,
      pitch,
      selectedProcessed.editedBitmap.width,
      selectedProcessed.editedBitmap.height,
    );
    if (!point) {
      return;
    }

    const from = { x: dragState.lastX, y: dragState.lastY };
    applyEditLine(from, point, dragState.value);
    pixelEditDragRef.current = { ...dragState, lastX: point.x, lastY: point.y };
  };

  const handleProcessedCanvasPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const dragState = pixelEditDragRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pixelEditDragRef.current = null;
  };

  const handleProcessedCanvasPointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pixelEditDragRef.current = null;
  };

  return (
    <div
      ref={rootRef}
      className="bitmap-workbench-page"
      style={
        {
          "--bitmap-top-height": `${topHeight}px`,
          "--bitmap-list-width": `${listWidth}px`,
          "--bitmap-param-width": `${paramWidth}px`,
        } as CSSProperties
      }
    >
      <section className="panel bitmap-workbench-top">
        <div className="panel-body bitmap-workbench-top-body">
          <div className="bitmap-workbench-header">
            <div>
              <h3>图片取模工作台</h3>
              <p>批量导入图片文件夹，实时预览 128x64 LCD 取模，并支持逐像素手工修图。</p>
            </div>
            <div className="bitmap-workbench-header-actions">
              <button type="button" className="mini-button" onClick={() => openDebugPanel("pid")}>
                切换到 PID 调试
              </button>
              <button type="button" className="mini-button" onClick={closeDebugPanel}>
                返回普通模式
              </button>
            </div>
          </div>

          <div className="bitmap-workbench-toolbar">
            <button type="button" onClick={handleSelectInputFolder}>
              导入图片文件夹
            </button>
            <button type="button" onClick={handlePickOutputDirectory}>
              选择输出目录
            </button>
            <button type="button" onClick={handleExportCurrent} disabled={!selectedFile || !selectedProcessed}>
              导出当前 BMP
            </button>
            <button type="button" onClick={handleBatchExport} disabled={images.length === 0 || isBatchRunning}>
              {isBatchRunning ? "批量处理中..." : "批量导出 BMP"}
            </button>
            <button type="button" className="mini-button" onClick={handleResetCurrentEdits} disabled={!selectedProcessed}>
              重置当前手工修改
            </button>
            <label className="bitmap-inline-field">
              <span>输出 FPS</span>
              <input
                type="number"
                min={1}
                max={120}
                step={1}
                value={exportFps}
                onChange={(event) =>
                  setExportFps(clamp(Number(event.target.value) || 30, 1, 120))
                }
              />
            </label>
            <label className="bitmap-inline-field">
              <span>预览缩放</span>
              <input
                type="number"
                min={2}
                max={20}
                step={1}
                value={previewScale}
                onChange={(event) =>
                  setPreviewScale(clamp(Number(event.target.value) || 4, 2, 20))
                }
              />
            </label>
          </div>

          <div className="bitmap-workbench-summary">
            <span>输入目录：{sourceFolderLabel}</span>
            <span>输出目录：{outputFolderLabel}</span>
            <span>图片数量：{images.length}</span>
            <span>
              批量进度：{batchProgress.done}/{batchProgress.total}
              {batchProgress.currentName ? `（${batchProgress.currentName}）` : ""}
              {batchProgress.failed > 0 ? `，失败 ${batchProgress.failed}` : ""}
            </span>
          </div>
        </div>
      </section>

      <div
        className="bitmap-workbench-splitter bitmap-workbench-splitter-horizontal"
        role="separator"
        aria-label="Resize top panel"
        onPointerDown={handleSplitterPointerDown("top")}
      />

      <div className="bitmap-workbench-bottom">
        <section className="panel bitmap-image-list">
          <div className="panel-header">
            <h2>图片列表</h2>
          </div>
          <div className="panel-body bitmap-list-panel-body">
            <div className="bitmap-list-scroll">
              <div className="stack-list compact-list">
                {images.length > 0 ? (
                  images.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`list-button ${item.id === selectedImageId ? "is-selected" : ""}`}
                      onClick={() => setSelectedImageId(item.id)}
                    >
                      <span>{item.displayName}</span>
                    </button>
                  ))
                ) : (
                  <div className="placeholder-item">请先导入图片文件夹。</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div
          className="bitmap-workbench-splitter bitmap-workbench-splitter-vertical"
          role="separator"
          aria-label="Resize image list panel"
          onPointerDown={handleSplitterPointerDown("left")}
        />

        <section className="panel bitmap-preview-panel">
          <div className="panel-header">
            <h2>实时预览（128x64）</h2>
          </div>
          <div className="panel-body bitmap-preview-body">
            {selectedFile ? (
              <>
                <div className="bitmap-preview-compare">
                  <div className="bitmap-lcd-card">
                    <strong>原图</strong>
                    {selectedSourceUrl ? (
                      <img
                        src={selectedSourceUrl}
                        alt={selectedFile.displayName}
                        className="bitmap-original-image"
                      />
                    ) : (
                      <div className="placeholder-item">原图加载中...</div>
                    )}
                  </div>
                  <div className="bitmap-lcd-card">
                    <strong>处理后 LCD（可编辑）</strong>
                    <canvas
                      ref={processedPreviewCanvasRef}
                      className="bitmap-preview-canvas bitmap-preview-canvas-editable"
                      onPointerDown={handleProcessedCanvasPointerDown}
                      onPointerMove={handleProcessedCanvasPointerMove}
                      onPointerUp={handleProcessedCanvasPointerUp}
                      onPointerCancel={handleProcessedCanvasPointerCancel}
                      onContextMenu={(event) => event.preventDefault()}
                    />
                    <span className="entity-meta">
                      鼠标单击可翻转像素，按住拖动可连续补线。
                    </span>
                  </div>
                </div>
                <div className="bitmap-preview-status">
                  <span>当前图片：{selectedFile.displayName}</span>
                  <span>亮点数：{selectedProcessed?.litPixels ?? 0}</span>
                  <span>填充率：{((selectedProcessed?.density ?? 0) * 100).toFixed(2)}%</span>
                  {isPreviewLoading ? <span>正在更新预览...</span> : null}
                  {previewError ? <span className="bitmap-error-text">{previewError}</span> : null}
                </div>
              </>
            ) : (
              <div className="placeholder-item">选择一张图片后可查看原图与 LCD 对照预览。</div>
            )}
          </div>
        </section>

        <div
          className="bitmap-workbench-splitter bitmap-workbench-splitter-vertical"
          role="separator"
          aria-label="Resize parameter panel"
          onPointerDown={handleSplitterPointerDown("right")}
        />

        <section className="panel bitmap-controls-panel">
          <div className="panel-header">
            <h2>取模参数</h2>
          </div>
          <div className="panel-body bitmap-controls-body bitmap-params-panel-body">
            <div className="bitmap-params-scroll">
              <div className="bitmap-control-group">
                <h4>基础参数</h4>
                <label className="field-row">
                  <span>适配模式</span>
                  <select
                    value={options.fitMode}
                    onChange={(event) => updateOption("fitMode", event.target.value as BitmapProcessingOptions["fitMode"])}
                  >
                    <option value="cover">cover（裁剪铺满）</option>
                    <option value="contain">contain（完整显示）</option>
                    <option value="stretch">stretch（拉伸）</option>
                  </select>
                </label>
                <label className="field-row">
                  <span>缩放插值</span>
                  <select
                    value={options.interpolation}
                    onChange={(event) =>
                      updateOption("interpolation", event.target.value as BitmapProcessingOptions["interpolation"])
                    }
                  >
                    <option value="nearest">nearest（最近邻）</option>
                    <option value="bilinear">bilinear（双线性）</option>
                  </select>
                </label>
                <div className="bitmap-threshold-block">
                  <label className="field-row">
                    <span>二值化阈值</span>
                    <input
                      type="number"
                      min={0}
                      max={THRESHOLD_MAX}
                      step={1}
                      value={options.threshold}
                      onChange={(event) =>
                        updateOption(
                          "threshold",
                          clamp(Number(event.target.value) || 0, 0, THRESHOLD_MAX),
                        )
                      }
                    />
                  </label>
                  <div className="bitmap-threshold-slider-row">
                    <input
                      type="range"
                      min={0}
                      max={THRESHOLD_MAX}
                      step={1}
                      value={options.threshold}
                      onChange={(event) =>
                        updateOption(
                          "threshold",
                          clamp(Number(event.target.value) || 0, 0, THRESHOLD_MAX),
                        )
                      }
                    />
                    <strong>{options.threshold}</strong>
                  </div>
                  <div className="entity-meta">
                    自动极性已启用：会自动选择“暗线”或“亮线”作为前景。阈值 256-510 会逐步增强补线与连通。
                  </div>
                </div>
                <label className="field-row">
                  <span>对比度</span>
                  <input
                    type="number"
                    min={0.1}
                    max={4}
                    step={0.05}
                    value={options.contrast}
                    onChange={(event) =>
                      updateOption("contrast", clamp(Number(event.target.value) || 1, 0.1, 4))
                    }
                  />
                </label>
                <label className="field-row">
                  <span>Gamma</span>
                  <input
                    type="number"
                    min={0.1}
                    max={4}
                    step={0.05}
                    value={options.gamma}
                    onChange={(event) => updateOption("gamma", clamp(Number(event.target.value) || 1, 0.1, 4))}
                  />
                </label>
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={options.invert}
                    onChange={(event) => updateOption("invert", event.target.checked)}
                  />
                  <span>黑白反相</span>
                </label>
              </div>

              <div className="bitmap-control-group">
                <h4>补线与连通</h4>
                <label className="field-row">
                  <span>水平补线</span>
                  <input
                    type="number"
                    min={0}
                    max={32}
                    step={1}
                    value={options.horizontalGap}
                    onChange={(event) =>
                      updateOption("horizontalGap", clamp(Number(event.target.value) || 0, 0, 32))
                    }
                  />
                </label>
                <label className="field-row">
                  <span>垂直补线</span>
                  <input
                    type="number"
                    min={0}
                    max={32}
                    step={1}
                    value={options.verticalGap}
                    onChange={(event) =>
                      updateOption("verticalGap", clamp(Number(event.target.value) || 0, 0, 32))
                    }
                  />
                </label>
                <label className="field-row">
                  <span>斜向补线</span>
                  <input
                    type="number"
                    min={0}
                    max={32}
                    step={1}
                    value={options.diagonalGap}
                    onChange={(event) =>
                      updateOption("diagonalGap", clamp(Number(event.target.value) || 0, 0, 32))
                    }
                  />
                </label>
                <label className="field-row">
                  <span>补线轮次</span>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    step={1}
                    value={options.gapFillPasses}
                    onChange={(event) =>
                      updateOption("gapFillPasses", clamp(Number(event.target.value) || 0, 0, 8))
                    }
                  />
                </label>
                <label className="field-row">
                  <span>连通桥接距离</span>
                  <input
                    type="number"
                    min={0}
                    max={32}
                    step={1}
                    value={options.bridgeDistance}
                    onChange={(event) =>
                      updateOption("bridgeDistance", clamp(Number(event.target.value) || 0, 0, 32))
                    }
                  />
                </label>
              </div>

              <div className="bitmap-control-group">
                <h4>增强与清理</h4>
                <label className="field-row">
                  <span>直线最小长度</span>
                  <input
                    type="number"
                    min={0}
                    max={128}
                    step={1}
                    value={options.reinforceMinRun}
                    onChange={(event) =>
                      updateOption("reinforceMinRun", clamp(Number(event.target.value) || 0, 0, 128))
                    }
                  />
                </label>
                <label className="field-row">
                  <span>扩线半径</span>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    step={1}
                    value={options.reinforceRadius}
                    onChange={(event) =>
                      updateOption("reinforceRadius", clamp(Number(event.target.value) || 0, 0, 6))
                    }
                  />
                </label>
                <label className="field-row">
                  <span>膨胀次数</span>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    step={1}
                    value={options.dilateIterations}
                    onChange={(event) =>
                      updateOption("dilateIterations", clamp(Number(event.target.value) || 0, 0, 8))
                    }
                  />
                </label>
                <label className="field-row">
                  <span>去噪面积阈值</span>
                  <input
                    type="number"
                    min={0}
                    max={128}
                    step={1}
                    value={options.despeckleMinArea}
                    onChange={(event) =>
                      updateOption("despeckleMinArea", clamp(Number(event.target.value) || 0, 0, 128))
                    }
                  />
                </label>
              </div>

              <div className="bitmap-control-group">
                <h4>操作日志</h4>
                <div className="bitmap-log-list">
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <div key={log.id} className={`bitmap-log-item ${log.level === "error" ? "is-error" : ""}`}>
                        <span>[{log.time}]</span>
                        <span>{log.text}</span>
                      </div>
                    ))
                  ) : (
                    <div className="placeholder-item">导入图片后会显示处理日志。</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".bmp,.png,.jpg,.jpeg,.webp,image/*"
        multiple
        onChange={handleImportFiles}
      />
    </div>
  );
}
