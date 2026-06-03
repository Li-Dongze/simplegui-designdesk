import { useEffect } from "react";
import { BitmapWorkbenchPage } from "@/components/debug/BitmapWorkbenchPage";
import { PixelScreen } from "@/components/workspace/PixelScreen";
import { VirtualKeyboard } from "@/components/workspace/VirtualKeyboard";
import { useProjectStore } from "@/stores/projectStore";

export function Workspace() {
  const mode = useProjectStore((state) => state.mode);
  const debugPanel = useProjectStore((state) => state.debugPanel);
  const fps = useProjectStore((state) => state.project.simulator.fps);
  const tickSimulation = useProjectStore((state) => state.tickSimulation);
  const isBitmapDebug = debugPanel === "bitmap";

  useEffect(() => {
    if (mode !== "simulate" || isBitmapDebug) {
      return;
    }

    const intervalMs = Math.max(16, Math.round(1000 / Math.max(1, fps)));
    let timer = 0;
    const loop = () => {
      tickSimulation(Date.now());
      timer = window.setTimeout(loop, intervalMs);
    };

    timer = window.setTimeout(loop, intervalMs);
    return () => window.clearTimeout(timer);
  }, [fps, isBitmapDebug, mode, tickSimulation]);

  return (
    <main className={`workspace panel ${isBitmapDebug ? "workspace-debug" : ""}`}>
      <div className="panel-header">
        <h2>
          {isBitmapDebug
            ? "图片取模"
            : mode === "edit"
              ? "设计画布"
              : "模拟运行"}
        </h2>
      </div>
      <div className="workspace-body">
        {isBitmapDebug ? <BitmapWorkbenchPage /> : <PixelScreen />}
      </div>
      {mode === "simulate" && !isBitmapDebug && <VirtualKeyboard />}
    </main>
  );
}
