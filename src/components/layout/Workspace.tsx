import { useEffect } from "react";
import { PixelScreen } from "@/components/workspace/PixelScreen";
import { VirtualKeyboard } from "@/components/workspace/VirtualKeyboard";
import { useProjectStore } from "@/stores/projectStore";

export function Workspace() {
  const mode = useProjectStore((state) => state.mode);
  const fps = useProjectStore((state) => state.project.simulator.fps);
  const tickSimulation = useProjectStore((state) => state.tickSimulation);

  useEffect(() => {
    if (mode !== "simulate") {
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
  }, [fps, mode, tickSimulation]);

  return (
    <main className="workspace panel">
      <div className="panel-header">
        <h2>{mode === "edit" ? "设计画布" : "模拟运行"}</h2>
      </div>
      <div className="workspace-body">
        <PixelScreen />
      </div>
      {mode === "simulate" && <VirtualKeyboard />}
    </main>
  );
}
