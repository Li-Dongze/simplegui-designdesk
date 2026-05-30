import { useEffect, useMemo, useState } from "react";
import {
  DESIGN_DESK_API_OPERATION_EVENT,
  DESIGN_DESK_API_READY_EVENT,
  type DesignDeskApi,
  type DesignDeskApiOperationRecord,
} from "@/api/designDeskApi";

const DEFAULT_SCRIPT = `[
  { "method": "loadTemplate", "args": ["blank"] },
  { "method": "addWidget", "args": ["list", { "x": 4, "y": 6 }] },
  { "method": "setMode", "args": ["simulate"] }
]`;

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function prettyTime(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function CollabDesignPanel() {
  const [api, setApi] = useState<DesignDeskApi | null>(() => window.SimpleGUIDesignDeskApi ?? null);
  const [open, setOpen] = useState(true);
  const [scriptText, setScriptText] = useState(DEFAULT_SCRIPT);
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [records, setRecords] = useState<DesignDeskApiOperationRecord[]>(
    () => window.SimpleGUIDesignDeskApi?.operationHistory() ?? [],
  );

  useEffect(() => {
    const readyListener = (event: Event) => {
      const detail = (event as CustomEvent<DesignDeskApi>).detail;
      if (!detail) {
        return;
      }
      setApi(detail);
      setRecords(detail.operationHistory());
    };

    const operationListener = (event: Event) => {
      const detail = (event as CustomEvent<DesignDeskApiOperationRecord>).detail;
      if (!detail) {
        return;
      }
      setRecords((prev) => [...prev, detail].slice(-200));
    };

    window.addEventListener(DESIGN_DESK_API_READY_EVENT, readyListener);
    window.addEventListener(DESIGN_DESK_API_OPERATION_EVENT, operationListener);

    if (window.SimpleGUIDesignDeskApi) {
      setApi(window.SimpleGUIDesignDeskApi);
      setRecords(window.SimpleGUIDesignDeskApi.operationHistory());
    }

    return () => {
      window.removeEventListener(DESIGN_DESK_API_READY_EVENT, readyListener);
      window.removeEventListener(DESIGN_DESK_API_OPERATION_EVENT, operationListener);
    };
  }, []);

  const latestRecords = useMemo(() => records.slice(-80).reverse(), [records]);

  const executeScript = async () => {
    if (!api) {
      setStatusText("API 尚未就绪。");
      return;
    }

    setRunning(true);
    setStatusText("正在执行脚本...");
    try {
      const results = api.runScript(scriptText);
      const pending = Array.isArray(results) ? results.filter((item) => isPromiseLike(item)) : [];
      if (pending.length > 0) {
        await Promise.all(pending);
      }
      setStatusText(`脚本执行完成，共 ${Array.isArray(results) ? results.length : 0} 条命令。`);
      setRecords(api.operationHistory());
    } catch (error) {
      setStatusText(error instanceof Error ? `执行失败: ${error.message}` : "执行失败。");
    } finally {
      setRunning(false);
    }
  };

  const clearHistory = () => {
    if (!api) {
      return;
    }
    api.clearOperationHistory();
    setRecords([]);
    setStatusText("已清空操作日志。");
  };

  return (
    <section className={`collab-panel panel ${open ? "is-open" : "is-collapsed"}`}>
      <div className="panel-header collab-panel-header">
        <h2>协作设计台</h2>
        <div className="inline-actions">
          <button
            type="button"
            className="mini-button"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? "折叠" : "展开"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="panel-body collab-panel-body">
          <div className="collab-panel-intro">
            你可以在这里看到 API 每一步操作，也可以直接编辑脚本执行。执行后画布仍可手工继续修改。
          </div>

          <label className="collab-script-box">
            <span>操作脚本（JSON 数组或逐行命令）</span>
            <textarea
              value={scriptText}
              onChange={(event) => setScriptText(event.target.value)}
              spellCheck={false}
            />
          </label>

          <div className="inline-actions">
            <button type="button" onClick={executeScript} disabled={running || !api}>
              {running ? "执行中..." : "执行脚本"}
            </button>
            <button type="button" onClick={clearHistory} disabled={!api}>
              清空日志
            </button>
            <button type="button" onClick={() => setScriptText(DEFAULT_SCRIPT)}>
              填充示例
            </button>
          </div>

          <div className="collab-status-line">{statusText || "等待操作..."}</div>

          <div className="collab-log-list">
            {latestRecords.length ? (
              latestRecords.map((record) => (
                <div
                  key={record.id}
                  className={`collab-log-item ${record.status === "error" ? "is-error" : "is-ok"}`}
                >
                  <div className="collab-log-main">
                    <strong>
                      [{prettyTime(record.timeIso)}] {record.method}
                    </strong>
                    <span>
                      args: {compactJson(record.args)}
                    </span>
                    <span>
                      {record.status === "ok"
                        ? `ok (${record.durationMs}ms) ${record.resultSummary ?? ""}`.trim()
                        : `error (${record.durationMs}ms) ${record.error ?? "未知错误"}`}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="placeholder-item">还没有操作记录。你执行一次脚本后，这里会实时显示全过程。</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
