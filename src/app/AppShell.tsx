import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightInspector } from "@/components/layout/RightInspector";
import { BottomRulePanel } from "@/components/layout/BottomRulePanel";
import { TopToolbar } from "@/components/layout/TopToolbar";
import { Workspace } from "@/components/layout/Workspace";
import { PidDebugSidebar } from "@/components/debug/PidDebugSidebar";
import { useProjectStore } from "@/stores/projectStore";

type DragKind = "left" | "right" | "bottom";

interface DragState {
  kind: DragKind;
  pointerId: number;
  startX: number;
  startY: number;
  startLeftWidth: number;
  startRightWidth: number;
  startBottomHeight: number;
}

const MIN_LEFT_WIDTH = 220;
const MAX_LEFT_WIDTH = 680;
const MIN_RIGHT_WIDTH = 240;
const MAX_RIGHT_WIDTH = 760;
const MIN_CENTER_WIDTH = 340;
const MIN_BOTTOM_HEIGHT = 96;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function AppShell() {
  const debugPanel = useProjectStore((state) => state.debugPanel);
  const theme = useProjectStore((state) => state.theme);
  const isBitmapDebug = debugPanel === "bitmap";
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(340);
  const [bottomHeight, setBottomHeight] = useState(300);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const mainLayoutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      const layoutWidth = mainLayoutRef.current?.clientWidth ?? window.innerWidth;
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      if (dragState.kind === "left") {
        const rightPaneWidth = isBitmapDebug ? 0 : dragState.startRightWidth;
        const maxByCenter = layoutWidth - rightPaneWidth - MIN_CENTER_WIDTH - 16;
        const next = clamp(
          dragState.startLeftWidth + deltaX,
          MIN_LEFT_WIDTH,
          Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, maxByCenter)),
        );
        setLeftWidth(next);
        return;
      }

      if (dragState.kind === "right") {
        const maxByCenter = layoutWidth - dragState.startLeftWidth - MIN_CENTER_WIDTH - 16;
        const next = clamp(
          dragState.startRightWidth - deltaX,
          MIN_RIGHT_WIDTH,
          Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, maxByCenter)),
        );
        setRightWidth(next);
        return;
      }

      const maxBottomHeight = Math.max(
        MIN_BOTTOM_HEIGHT,
        Math.min(window.innerHeight - 220, Math.round(window.innerHeight * 0.72)),
      );
      const next = clamp(
        dragState.startBottomHeight - deltaY,
        MIN_BOTTOM_HEIGHT,
        maxBottomHeight,
      );
      setBottomHeight(next);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return;
      }
      setDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    document.body.classList.add("is-resizing-panels");

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.classList.remove("is-resizing-panels");
    };
  }, [debugPanel, dragState, isBitmapDebug]);

  const startDrag =
    (kind: DragKind) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragState({
        kind,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeftWidth: leftWidth,
        startRightWidth: rightWidth,
        startBottomHeight: bottomHeight,
      });
    };

  return (
    <div
      className="app-shell"
      style={
        {
          "--left-pane-width": `${leftWidth}px`,
          "--right-pane-width": `${rightWidth}px`,
          "--bottom-pane-height": `${bottomHeight}px`,
        } as CSSProperties
      }
    >
      <TopToolbar />
      <div className={`app-main-resizable ${isBitmapDebug ? "is-debug" : ""}`} ref={mainLayoutRef}>
        {isBitmapDebug ? (
          <Workspace />
        ) : (
          <>
            <LeftSidebar />
            <div
              className="panel-splitter panel-splitter-vertical"
              role="separator"
              aria-label="Resize left panel"
              onPointerDown={startDrag("left")}
            />
            <Workspace />
            <div
              className="panel-splitter panel-splitter-vertical"
              role="separator"
              aria-label="Resize right panel"
              onPointerDown={startDrag("right")}
            />
            {debugPanel === "pid" ? <PidDebugSidebar /> : <RightInspector />}
          </>
        )}
      </div>
      {debugPanel === "none" ? (
        <>
          <div
            className="panel-splitter panel-splitter-horizontal"
            role="separator"
            aria-label="Resize bottom panel"
            onPointerDown={startDrag("bottom")}
          />
          <div className="bottom-rule-host">
            <BottomRulePanel />
          </div>
        </>
      ) : null}
    </div>
  );
}
