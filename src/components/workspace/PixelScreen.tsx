import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { renderDinoGameBitmap } from "@/utils/dinoGame";
import { paintLcdBitmapScreen, paintLcdScreen } from "@/utils/lcdRenderer";
import { getPictureForView, getVariableMap, getWidgetEnabled, getWidgetVisible, sortWidgets } from "@/utils/viewModel";
import { buildResizedRect, resizeHandleDefinitions, resizeCursorForDirection } from "@/utils/widgetResize";
import type { Widget } from "@/types/project";

export function PixelScreen() {
  const project = useProjectStore((state) => state.project);
  const scale = useProjectStore((state) => state.scale);
  const theme = useProjectStore((state) => state.theme);
  const mode = useProjectStore((state) => state.mode);
  const activePictureId = useProjectStore((state) => state.activePictureId);
  const selection = useProjectStore((state) => state.selection);
  const simulator = useProjectStore((state) => state.simulator);
  const videoOverlay = useProjectStore((state) => state.videoOverlay);
  const dinoGame = useProjectStore((state) => state.dinoGame);
  const selectWidget = useProjectStore((state) => state.selectWidget);
  const selectPicture = useProjectStore((state) => state.selectPicture);
  const updateWidgetRect = useProjectStore((state) => state.updateWidgetRect);

  const picture = getPictureForView(project, activePictureId, simulator);
  const variableMap = useMemo(() => getVariableMap(project, simulator), [project, simulator]);
  const lcdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fitZoneRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    widgetId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeRef = useRef<{
    widgetId: string;
    direction: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
    startX: number;
    startY: number;
    originRect: Widget["rect"];
  } | null>(null);
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);
  const addWidget = useProjectStore((state) => state.addWidget);

  const videoFrame = useMemo(() => {
    if (mode !== "simulate" || !videoOverlay || videoOverlay.frames.length === 0) {
      return null;
    }

    const frameDurationMs = 1000 / Math.max(1, videoOverlay.fps);
    const frameCount = videoOverlay.frames.length;
    const elapsedMs = simulator?.clockMs ?? 0;
    const frameStep = Math.floor(elapsedMs / frameDurationMs);
    const frameIndex = videoOverlay.loop
      ? frameStep % frameCount
      : Math.min(frameCount - 1, frameStep);

    return videoOverlay.frames[frameIndex] ?? null;
  }, [mode, simulator?.clockMs, videoOverlay]);

  const dinoFrame = useMemo(() => {
    if (mode !== "simulate" || !dinoGame) {
      return null;
    }
    return renderDinoGameBitmap(dinoGame);
  }, [dinoGame, mode]);

  const screenWidth = dinoFrame?.width ?? videoFrame?.width ?? project.screen.width;
  const screenHeight = dinoFrame?.height ?? videoFrame?.height ?? project.screen.height;
  const widgets = picture ? sortWidgets(picture.widgets) : [];
  const currentPictureId = dinoGame
    ? `${dinoGame.name} (${dinoGame.gameOver ? "GAME OVER" : "RUN"})`
    : videoOverlay
      ? `${videoOverlay.name} (${videoFrame ? "Playing" : "Ready"})`
      : simulator?.currentPictureId ?? picture?.id ?? activePictureId;
  const effectiveScale = Math.max(1, Math.round(scale));
  const overlayWidth = screenWidth * effectiveScale;
  const overlayHeight = screenHeight * effectiveScale;

  const releaseCapturedPointer = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    if (!lcdCanvasRef.current) {
      return;
    }

    if (dinoFrame) {
      paintLcdBitmapScreen(lcdCanvasRef.current, dinoFrame, {
        scale: effectiveScale,
        showPixelGrid: project.simulator.showGrid,
        theme,
      });
      return;
    }

    if (videoFrame) {
      paintLcdBitmapScreen(lcdCanvasRef.current, videoFrame, {
        scale: effectiveScale,
        showPixelGrid: project.simulator.showGrid,
        theme,
      });
      return;
    }

    if (!picture) {
      return;
    }

    paintLcdScreen(lcdCanvasRef.current, {
      project,
      picture,
      simulator,
      variableMap,
      scale: effectiveScale,
      showPixelGrid: project.simulator.showGrid,
      theme,
    });
  }, [dinoFrame, effectiveScale, picture, project, simulator, theme, variableMap, videoFrame]);

  useEffect(() => {
    const element = fitZoneRef.current;
    if (!element) {
      return;
    }

    const centerScroll = () => {
      const left = Math.max(0, (element.scrollWidth - element.clientWidth) / 2);
      const top = Math.max(0, (element.scrollHeight - element.clientHeight) / 2);
      element.scrollLeft = left;
      element.scrollTop = top;
    };

    const initialFrame = window.requestAnimationFrame(centerScroll);
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(centerScroll);
    });
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      observer.disconnect();
    };
  }, [overlayHeight, overlayWidth]);

  const handlePointerDown = (widget: Widget, event: React.PointerEvent<HTMLDivElement>) => {
    if (!picture) {
      return;
    }

    event.stopPropagation();
    selectWidget(picture.id, widget.id);

    if (mode !== "edit") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragRef.current = {
      widgetId: widget.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: widget.rect.x,
      originY: widget.rect.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleWidgetClick = (widget: Widget, event: React.MouseEvent<HTMLDivElement>) => {
    if (!picture) {
      return;
    }

    event.stopPropagation();
    selectWidget(picture.id, widget.id);
  };

  const handleScreenShellClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!picture) {
      return;
    }

    if (event.target !== event.currentTarget) {
      return;
    }

    selectPicture(picture.id);
  };

  const handleResizePointerDown = (
    widget: Widget,
    direction: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w",
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!picture || mode !== "edit") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    selectWidget(picture.id, widget.id);
    resizeRef.current = {
      widgetId: widget.id,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      originRect: { ...widget.rect },
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current && mode === "edit") {
      const deltaX = Math.round((event.clientX - resizeRef.current.startX) / effectiveScale);
      const deltaY = Math.round((event.clientY - resizeRef.current.startY) / effectiveScale);
      updateWidgetRect(
        resizeRef.current.widgetId,
        buildResizedRect(
          resizeRef.current.originRect,
          deltaX,
          deltaY,
          resizeRef.current.direction,
          project.screen,
        ),
      );
      return;
    }

    if (!dragRef.current || mode !== "edit") {
      return;
    }

    const deltaX = Math.round((event.clientX - dragRef.current.startX) / effectiveScale);
    const deltaY = Math.round((event.clientY - dragRef.current.startY) / effectiveScale);

    updateWidgetRect(dragRef.current.widgetId, {
      x: dragRef.current.originX + deltaX,
      y: dragRef.current.originY + deltaY,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    releaseCapturedPointer(event);
    resizeRef.current = null;
    dragRef.current = null;
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!picture || mode !== "edit") {
      return;
    }

    const type = event.dataTransfer.getData("application/simplegui-widget-type");
    if (!type) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(project.screen.width - 1, Math.round((event.clientX - rect.left) / effectiveScale)));
    const y = Math.max(0, Math.min(project.screen.height - 1, Math.round((event.clientY - rect.top) / effectiveScale)));
    addWidget(type as never, { x, y });
  };

  return (
    <div className="pixel-screen-wrap">
      <div className="pixel-screen lcd-chassis">
        <div className="pixel-frame-meta">
          <span>{currentPictureId || "未选择页面"}</span>
          <span>{project.screen.width}x{project.screen.height} @{effectiveScale}x</span>
        </div>
        <div className="lcd-bezel">
          <div className="lcd-fit-zone" ref={fitZoneRef}>
            <div className="lcd-fit-content">
              <div
                className={`lcd-screen-shell ${mode === "simulate" ? "is-simulate" : "is-edit"}`}
                style={{
                  width: `${overlayWidth}px`,
                  height: `${overlayHeight}px`,
                }}
                onClick={handleScreenShellClick}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                {picture || videoFrame || dinoFrame ? (
                  <>
                    <canvas
                      ref={lcdCanvasRef}
                      className="lcd-pixel-canvas"
                      width={overlayWidth}
                      height={overlayHeight}
                    />
                    <div
                      className={`lcd-overlay ${mode === "simulate" ? "is-simulate" : "is-edit"}`}
                      style={{
                        width: `${overlayWidth}px`,
                        height: `${overlayHeight}px`,
                      }}
                    >
                      {picture && !videoFrame && !dinoFrame
                        ? widgets.map((widget) => {
                          const visible = getWidgetVisible(widget, simulator);
                          if (!visible) {
                            return null;
                          }

                          const enabled = getWidgetEnabled(widget, simulator);
                          const isSelected =
                            selection.kind === "widget" &&
                            selection.pictureId === picture.id &&
                            selection.widgetId === widget.id;

                          return (
                            <div
                              key={widget.id}
                              className={[
                                "lcd-widget-hitbox",
                                isSelected ? "is-selected" : "",
                                !enabled ? "is-disabled" : "",
                                hoveredWidgetId === widget.id ? "is-hovered" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              style={{
                                left: `${widget.rect.x * effectiveScale}px`,
                                top: `${widget.rect.y * effectiveScale}px`,
                                width: `${widget.rect.width * effectiveScale}px`,
                                height: `${widget.rect.height * effectiveScale}px`,
                                zIndex: widget.zIndex + 1,
                              }}
                              onPointerDown={(event) => handlePointerDown(widget, event)}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                              onPointerCancel={handlePointerUp}
                              onClick={(event) => handleWidgetClick(widget, event)}
                              onMouseEnter={() => setHoveredWidgetId(widget.id)}
                              onMouseLeave={() =>
                                setHoveredWidgetId((current) => (current === widget.id ? null : current))
                              }
                            >
                              {mode === "edit" && (
                                <>
                                  <div className="lcd-widget-outline" />
                                  <div className="lcd-widget-tag">
                                    <span>{widget.name}</span>
                                    <span>{widget.type}</span>
                                  </div>
                                  <div className="lcd-widget-resize-layer" aria-hidden="true">
                                    {resizeHandleDefinitions.map((handle) => (
                                      <button
                                        key={`${widget.id}-${handle.direction}`}
                                        type="button"
                                        className={`lcd-widget-resize-handle handle-${handle.direction}`}
                                        aria-label={`${widget.name} ${handle.label}`}
                                        style={{
                                          cursor: resizeCursorForDirection(handle.direction),
                                        }}
                                        onPointerDown={(event) => handleResizePointerDown(widget, handle.direction, event)}
                                        onPointerUp={handlePointerUp}
                                        onPointerCancel={handlePointerUp}
                                      />
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                        : null}
                    </div>
                  </>
                ) : (
                  <div className="screen-empty">请先创建页面，或加载已有工程。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
