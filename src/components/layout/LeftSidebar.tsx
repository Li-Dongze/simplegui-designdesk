import type { DragEvent } from "react";
import { SidebarSection } from "@/components/layout/SidebarSection";
import { widgetCatalog, widgetCategoryLabels, widgetCategoryOrder } from "@/contracts/widgetContracts";
import { useProjectStore } from "@/stores/projectStore";
import { summarizeRule } from "@/utils/viewModel";

function typeLabel(type: string): string {
  return widgetCatalog.find((entry) => entry.type === type)?.label ?? type;
}

export function LeftSidebar() {
  const project = useProjectStore((state) => state.project);
  const activePictureId = useProjectStore((state) => state.activePictureId);
  const selection = useProjectStore((state) => state.selection);
  const selectPicture = useProjectStore((state) => state.selectPicture);
  const selectWidget = useProjectStore((state) => state.selectWidget);
  const selectVariable = useProjectStore((state) => state.selectVariable);
  const selectTimer = useProjectStore((state) => state.selectTimer);
  const selectResource = useProjectStore((state) => state.selectResource);
  const addPicture = useProjectStore((state) => state.addPicture);
  const duplicatePicture = useProjectStore((state) => state.duplicatePicture);
  const deletePicture = useProjectStore((state) => state.deletePicture);
  const addWidget = useProjectStore((state) => state.addWidget);
  const duplicateWidget = useProjectStore((state) => state.duplicateWidget);
  const deleteWidget = useProjectStore((state) => state.deleteWidget);
  const addVariable = useProjectStore((state) => state.addVariable);
  const addTimer = useProjectStore((state) => state.addTimer);
  const addResource = useProjectStore((state) => state.addResource);

  const activePicture =
    project.pictures.find((picture) => picture.id === activePictureId) ?? project.pictures[0];

  const groupedWidgets = widgetCategoryOrder.map((category) => ({
    category,
    label: widgetCategoryLabels[category],
    items: widgetCatalog.filter((entry) => entry.category === category),
  }));

  const handleWidgetDragStart = (event: DragEvent<HTMLButtonElement>, type: string) => {
    event.dataTransfer.setData("application/simplegui-widget-type", type);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className="left-sidebar panel">
      <SidebarSection
        title="页面树"
        action={
          <button type="button" className="mini-button" onClick={addPicture}>
            + 页面
          </button>
        }
      >
        <div className="stack-list">
          {project.pictures.map((picture) => {
            const isSelected =
              (selection.kind === "picture" && selection.pictureId === picture.id) ||
              activePictureId === picture.id;
            return (
              <div
                key={picture.id}
                className={`entity-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => selectPicture(picture.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectPicture(picture.id);
                  }
                }}
              >
                <div>
                  <strong>{picture.name}</strong>
                  <div className="entity-meta">
                    {picture.id} · {picture.widgets.length} 个控件
                  </div>
                </div>
                <div className="entity-actions">
                  <button
                    type="button"
                    className="mini-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      duplicatePicture(picture.id);
                    }}
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    className="mini-button danger-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deletePicture(picture.id);
                    }}
                    disabled={project.pictures.length <= 1}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SidebarSection>

      <SidebarSection title="组件库">
        <div className="widget-catalog">
          {groupedWidgets.map((group) => (
            <div key={group.category} className="widget-catalog-group">
              <div className="widget-catalog-title">
                <strong>{group.label}</strong>
                <span>{group.items.length} 项</span>
              </div>
              <div className="widget-add-grid">
                {group.items.map((entry) => (
                  <button
                    key={entry.type}
                    type="button"
                    className="mini-button widget-palette-item"
                    draggable
                    title={entry.summary}
                    onDragStart={(event) => handleWidgetDragStart(event, entry.type)}
                    onClick={() => addWidget(entry.type)}
                    disabled={!activePicture}
                  >
                    <span>{entry.label}</span>
                    <small>{entry.family}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection title="当前页面控件">
        <div className="stack-list">
          {activePicture?.widgets.length ? (
            activePicture.widgets.map((widget) => {
              const isSelected =
                selection.kind === "widget" &&
                selection.pictureId === activePicture.id &&
                selection.widgetId === widget.id;
              return (
                <div
                  key={widget.id}
                  className={`entity-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => selectWidget(activePicture.id, widget.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectWidget(activePicture.id, widget.id);
                    }
                  }}
                >
                  <div>
                    <strong>{widget.name}</strong>
                    <div className="entity-meta">
                      {widget.id} · {typeLabel(widget.type)}
                    </div>
                  </div>
                  <div className="entity-actions">
                    <button
                      type="button"
                      className="mini-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        duplicateWidget(widget.id);
                      }}
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      className="mini-button danger-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteWidget(widget.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="placeholder-item">当前页面还没有控件，先从组件库拖一个进来。</div>
          )}
        </div>
      </SidebarSection>

      <SidebarSection
        title="变量"
        action={
          <div className="inline-actions">
            <button type="button" className="mini-button" onClick={() => addVariable("int")}>
              + 整数
            </button>
            <button type="button" className="mini-button" onClick={() => addVariable("string")}>
              + 文本
            </button>
            <button type="button" className="mini-button" onClick={() => addVariable("bool")}>
              + 布尔
            </button>
          </div>
        }
      >
        <div className="stack-list compact-list">
          {project.variables.map((variable) => {
            const isSelected = selection.kind === "variable" && selection.variableId === variable.id;
            return (
              <button
                key={variable.id}
                type="button"
                className={`list-button ${isSelected ? "is-selected" : ""}`}
                onClick={() => selectVariable(variable.id)}
              >
                <span>{variable.name}</span>
                <span className="entity-meta">{variable.type}</span>
              </button>
            );
          })}
        </div>
      </SidebarSection>

      <SidebarSection
        title="定时器"
        action={
          <button type="button" className="mini-button" onClick={addTimer}>
            + 定时器
          </button>
        }
      >
        <div className="stack-list compact-list">
          {project.timers.map((timer) => {
            const isSelected = selection.kind === "timer" && selection.timerId === timer.id;
            return (
              <button
                key={timer.id}
                type="button"
                className={`list-button ${isSelected ? "is-selected" : ""}`}
                onClick={() => selectTimer(timer.id)}
              >
                <span>{timer.name}</span>
                <span className="entity-meta">{timer.intervalMs} ms</span>
              </button>
            );
          })}
        </div>
      </SidebarSection>

      <SidebarSection
        title="资源"
        action={
          <button type="button" className="mini-button" onClick={addResource}>
            + 资源
          </button>
        }
      >
        <div className="stack-list compact-list">
          {project.resources.length ? (
            project.resources.map((resource) => {
              const isSelected =
                selection.kind === "resource" && selection.resourceId === resource.id;
              return (
                <button
                  key={resource.id}
                  type="button"
                  className={`list-button ${isSelected ? "is-selected" : ""}`}
                  onClick={() => selectResource(resource.id)}
                >
                  <span>{resource.name}</span>
                  <span className="entity-meta">{resource.kind}</span>
                </button>
              );
            })
          ) : (
            <div className="placeholder-item">资源还没有导入，可以先创建资源条目再绑定。</div>
          )}
        </div>
      </SidebarSection>

      <SidebarSection title="当前页面规则">
        <div className="stack-list compact-list">
          {project.rules
            .filter((rule) => rule.pictureId === activePictureId)
            .map((rule) => (
              <div key={rule.id} className="rule-snippet">
                <strong>{rule.id}</strong>
                <span>{summarizeRule(rule)}</span>
              </div>
            ))}
        </div>
      </SidebarSection>
    </aside>
  );
}
