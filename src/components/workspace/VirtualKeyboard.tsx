import { useEffect } from "react";
import type { AbstractKey } from "@/types/project";
import { useProjectStore } from "@/stores/projectStore";

const keys: Array<{ key: AbstractKey; label: string }> = [
  { key: "up", label: "↑" },
  { key: "down", label: "↓" },
  { key: "left", label: "←" },
  { key: "right", label: "→" },
  { key: "enter", label: "Enter" },
  { key: "esc", label: "Esc" },
  { key: "tab", label: "Tab" },
  { key: "space", label: "Space" },
  { key: "insert", label: "Ins" },
  { key: "shiftInsert", label: "S-Ins" },
  { key: "delete", label: "Del" },
  { key: "home", label: "Home" },
  { key: "end", label: "End" },
  { key: "plus", label: "+" },
  { key: "minus", label: "-" },
];

export function VirtualKeyboard() {
  const mode = useProjectStore((state) => state.mode);
  const sendSimulatorKey = useProjectStore((state) => state.sendSimulatorKey);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (mode !== "simulate") {
        return;
      }

      const keyMap: Record<string, AbstractKey> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        Enter: "enter",
        Escape: "esc",
        Tab: "tab",
        " ": "space",
        Insert: event.shiftKey ? "shiftInsert" : "insert",
        Delete: "delete",
        Home: "home",
        End: "end",
        "+": "plus",
        "-": "minus",
      };

      const mapped = keyMap[event.key];
      if (!mapped) {
        return;
      }

      event.preventDefault();
      sendSimulatorKey(mapped);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, sendSimulatorKey]);

  return (
    <div className="virtual-keyboard">
      {keys.map((entry) => (
        <button
          key={entry.key}
          type="button"
          className="key-button"
          onClick={() => sendSimulatorKey(entry.key)}
          disabled={mode !== "simulate"}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
