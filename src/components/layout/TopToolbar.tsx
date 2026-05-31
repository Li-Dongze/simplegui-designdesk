import { useMemo, useRef, type ChangeEvent } from "react";
import { projectTemplates } from "@/schema/projectTemplates";
import { useProjectStore } from "@/stores/projectStore";
import { formatProjectDocument, parseProjectDocument } from "@/utils/projectFormat";
import { buildExportArtifact, downloadTextFile } from "@/utils/simpleguiCodeExport";

const modeLabels = {
  edit: "编辑",
  simulate: "模拟",
} as const;

export function TopToolbar() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const mode = useProjectStore((state) => state.mode);
  const debugPanel = useProjectStore((state) => state.debugPanel);
  const scale = useProjectStore((state) => state.scale);
  const templateId = useProjectStore((state) => state.projectTemplateId);
  const setMode = useProjectStore((state) => state.setMode);
  const openDebugPanel = useProjectStore((state) => state.openDebugPanel);
  const closeDebugPanel = useProjectStore((state) => state.closeDebugPanel);
  const setScale = useProjectStore((state) => state.setScale);
  const loadProject = useProjectStore((state) => state.loadProject);
  const loadTemplate = useProjectStore((state) => state.loadTemplate);
  const resetProject = useProjectStore((state) => state.resetProject);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const history = useProjectStore((state) => state.history);
  const future = useProjectStore((state) => state.future);

  const activeTemplate = useMemo(
    () => projectTemplates.find((entry) => entry.id === templateId),
    [templateId],
  );

  const handleOpenClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      loadProject(parseProjectDocument(text));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "打开工程文件失败。");
    } finally {
      event.target.value = "";
    }
  };

  const handleSave = () => {
    const text = formatProjectDocument(project);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.project.name || "simplegui-project"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (kind: "markdown" | "ir" | "c") => {
    const artifact = buildExportArtifact(project, kind);
    downloadTextFile(artifact.filename, artifact.text, artifact.mimeType);
  };

  const handleTogglePidDebug = () => {
    if (debugPanel === "pid") {
      closeDebugPanel();
      return;
    }
    openDebugPanel("pid");
  };

  return (
    <header className="top-toolbar panel">
      <div className="toolbar-title">
        <strong>SimpleGUI 设计台</strong>
        <span className="toolbar-subtitle">
          {project.project.name}
          {dirty ? " · 未保存" : " · 已保存"}
          {" · "}
          {modeLabels[mode]}
          {debugPanel === "pid" ? " · PID调试页" : ""}
          {activeTemplate ? ` · ${activeTemplate.label}` : ""}
        </span>
      </div>

      <div className="toolbar-template-switcher" aria-label="工程模板">
        {projectTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={templateId === template.id ? "is-active" : undefined}
            onClick={() => loadTemplate(template.id)}
            title={template.description}
          >
            {template.label}
          </button>
        ))}
        <button type="button" onClick={resetProject} title="重新创建一个空白工程">
          空白新建
        </button>
      </div>

      <div className="toolbar-actions">
        <button
          type="button"
          className={mode === "edit" ? "is-active" : undefined}
          onClick={() => setMode("edit")}
        >
          编辑
        </button>
        <button
          type="button"
          className={mode === "simulate" && debugPanel === "none" ? "is-active" : undefined}
          onClick={() => setMode("simulate")}
        >
          模拟
        </button>
        <button
          type="button"
          className={debugPanel === "pid" ? "is-active" : undefined}
          onClick={handleTogglePidDebug}
        >
          PID调试
        </button>
        <label className="toolbar-scale-input">
          <span>缩放</span>
          <input
            aria-label="画布缩放"
            type="number"
            min={1}
            max={40}
            step={1}
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          />
        </label>
        <button type="button" onClick={undo} disabled={history.length === 0}>
          撤销
        </button>
        <button type="button" onClick={redo} disabled={future.length === 0}>
          重做
        </button>
        <button type="button" onClick={handleOpenClick}>
          打开
        </button>
        <button type="button" onClick={handleSave}>
          保存
        </button>
        <button type="button" onClick={() => handleExport("markdown")}>
          导出说明
        </button>
        <button type="button" onClick={() => handleExport("ir")}>
          导出IR
        </button>
        <button type="button" onClick={() => handleExport("c")}>
          导出C骨架
        </button>
      </div>

      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
      />
    </header>
  );
}
