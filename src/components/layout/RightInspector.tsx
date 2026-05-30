import { useRef, type ChangeEvent } from "react";
import { SidebarSection } from "@/components/layout/SidebarSection";
import { ResourceBitmapPreview } from "@/components/resource/ResourceBitmapPreview";
import {
  collectWidgetBindings,
  getWidgetContract,
  widgetCategoryLabels,
  type WidgetInspectorField,
  type WidgetInspectorSelectSource,
} from "@/contracts/widgetContracts";
import { useProjectStore } from "@/stores/projectStore";
import { imageElementToMonoBitmap, loadImageFromUrl } from "@/utils/bitmap";
import { findPicture, findWidget } from "@/utils/projectFormat";
import { selectionLabel } from "@/utils/viewModel";
import type { ChoiceItem, CurvePointDefinition, Widget } from "@/types/project";

type ProjectData = ReturnType<typeof useProjectStore.getState>["project"];

const fontOptions = [
  "SGUI_DEFAULT_FONT_MiniNum",
  "SGUI_DEFAULT_FONT_8",
  "SGUI_DEFAULT_FONT_12",
  "SGUI_DEFAULT_FONT_16",
  "GB2312_FZXS12",
];

const alignOptions = ["left", "center", "right"];
const drawModeOptions = ["normal", "reverse"];
const shapeKindOptions = ["rect", "circle", "roundedRect", "hline", "vline"];
const directionOptions = ["right", "left", "up", "down"];
const timeSourceOptions = ["system", "variables"];
const charSetOptions = ["ascii"];

function TextField(props: {
  label: string;
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-row">
      <span>{props.label}</span>
      <input
        value={props.value}
        readOnly={props.readOnly}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  readOnly?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field-row">
      <span>{props.label}</span>
      <input
        type="number"
        value={Number.isFinite(props.value) ? props.value : 0}
        readOnly={props.readOnly}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  );
}

function CheckboxField(props: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="field-check">
      <input
        type="checkbox"
        checked={props.value}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  allowEmpty?: boolean;
  emptyLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-row">
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.allowEmpty && <option value="">{props.emptyLabel ?? "未选择"}</option>}
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadonlyBlock(props: {
  title: string;
  value: string;
  format?: "json" | "text";
}) {
  return (
    <div className="readonly-block">
      <strong>{props.title}</strong>
      {props.format === "json" ? <pre>{props.value}</pre> : <div>{props.value}</div>}
    </div>
  );
}

function resolveSelectOptions(source: WidgetInspectorSelectSource, project: ProjectData) {
  switch (source) {
    case "fonts":
      return fontOptions.map((value) => ({ value, label: value }));
    case "alignments":
      return alignOptions.map((value) => ({ value, label: value }));
    case "drawModes":
      return drawModeOptions.map((value) => ({ value, label: value }));
    case "shapeKinds":
      return shapeKindOptions.map((value) => ({ value, label: value }));
    case "directions":
      return directionOptions.map((value) => ({ value, label: value }));
    case "timeSources":
      return timeSourceOptions.map((value) => ({ value, label: value }));
    case "charSets":
      return charSetOptions.map((value) => ({ value, label: value }));
    case "pictures":
      return project.pictures.map((picture) => ({ value: picture.id, label: picture.name }));
    case "variables":
      return project.variables.map((variable) => ({ value: variable.id, label: variable.name }));
    case "resources":
      return project.resources.map((resource) => ({ value: resource.id, label: resource.name }));
    case "widgets":
      return project.pictures.flatMap((picture) =>
        picture.widgets.map((widget) => ({
          value: widget.id,
          label: `${picture.name} / ${widget.name}`,
        })),
      );
    default:
      return [];
  }
}

function emptySourceLabel(source: WidgetInspectorSelectSource) {
  switch (source) {
    case "fonts":
      return "未选择字体";
    case "alignments":
      return "未选择对齐";
    case "drawModes":
      return "未选择绘制模式";
    case "shapeKinds":
      return "未选择形状";
    case "directions":
      return "未选择方向";
    case "timeSources":
      return "未选择时间来源";
    case "charSets":
      return "未选择字符集";
    case "pictures":
      return "未绑定页面";
    case "variables":
      return "未绑定变量";
    case "resources":
      return "未绑定资源";
    case "widgets":
      return "未绑定控件";
    default:
      return "未选择";
  }
}

function renderInspectorField(
  widget: Widget,
  field: WidgetInspectorField,
  project: ProjectData,
  updateWidgetProp: (key: string, value: unknown) => void,
) {
  if (field.kind === "choice-items") {
    const items = ((widget.props as { items?: ChoiceItem[] }).items ?? []) as ChoiceItem[];
    const variableOptions = resolveSelectOptions("variables", project);
    const updateItems = (next: ChoiceItem[]) => updateWidgetProp(field.key, next);

    return (
      <div className="array-editor" key={field.key}>
        <div className="array-editor-head">
          <div>
            <strong>{field.label}</strong>
            {field.help ? <span className="entity-meta">{field.help}</span> : null}
          </div>
          <button
            type="button"
            className="mini-button"
            onClick={() =>
              updateItems([
                ...items,
                {
                  id: `item_${items.length + 1}`,
                  label: `Item ${items.length + 1}`,
                  dynamicTextVarId: null,
                },
              ])
            }
          >
            + 条目
          </button>
        </div>
        <div className="stack-list compact-list">
          {items.map((item, index) => (
            <div key={`${item.id}-${index}`} className="array-row">
              <TextField
                label="ID"
                value={item.id}
                onChange={(value) => {
                  const next = items.slice();
                  next[index] = { ...item, id: value };
                  updateItems(next);
                }}
              />
              <TextField
                label="文本"
                value={item.label}
                onChange={(value) => {
                  const next = items.slice();
                  next[index] = { ...item, label: value };
                  updateItems(next);
                }}
              />
              <SelectField
                label="动态变量"
                value={item.dynamicTextVarId ?? ""}
                options={variableOptions}
                allowEmpty
                emptyLabel="不绑定变量"
                onChange={(value) => {
                  const next = items.slice();
                  next[index] = { ...item, dynamicTextVarId: value || null };
                  updateItems(next);
                }}
              />
              <div className="array-row-actions">
                <button
                  type="button"
                  className="mini-button danger-button"
                  onClick={() => updateItems(items.filter((_, itemIndex) => itemIndex !== index))}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === "curve-points") {
    const points = ((widget.props as { points?: CurvePointDefinition[] }).points ?? []) as CurvePointDefinition[];
    const updatePoints = (next: CurvePointDefinition[]) => updateWidgetProp(field.key, next);

    return (
      <div className="array-editor" key={field.key}>
        <div className="array-editor-head">
          <div>
            <strong>{field.label}</strong>
            {field.help ? <span className="entity-meta">{field.help}</span> : null}
          </div>
          <button
            type="button"
            className="mini-button"
            onClick={() => updatePoints([...points, { x: 0, y: 0 }])}
          >
            + 点
          </button>
        </div>
        <div className="stack-list compact-list">
          {points.map((point, index) => (
            <div key={`${index}-${point.x}-${point.y}`} className="array-row">
              <NumberField
                label="X"
                value={point.x}
                onChange={(value) => {
                  const next = points.slice();
                  next[index] = { ...point, x: value };
                  updatePoints(next);
                }}
              />
              <NumberField
                label="Y"
                value={point.y}
                onChange={(value) => {
                  const next = points.slice();
                  next[index] = { ...point, y: value };
                  updatePoints(next);
                }}
              />
              <div className="array-row-actions">
                <button
                  type="button"
                  className="mini-button danger-button"
                  onClick={() => updatePoints(points.filter((_, pointIndex) => pointIndex !== index))}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const value = (widget.props as unknown as Record<string, unknown>)[field.key];

  if (field.kind === "text") {
    return (
      <TextField
        key={field.key}
        label={field.label}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(next) => updateWidgetProp(field.key, next)}
      />
    );
  }

  if (field.kind === "number") {
    return (
      <NumberField
        key={field.key}
        label={field.label}
        value={typeof value === "number" ? value : Number(value ?? 0)}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(next) => updateWidgetProp(field.key, next)}
      />
    );
  }

  if (field.kind === "boolean") {
    return (
      <CheckboxField
        key={field.key}
        label={field.label}
        value={Boolean(value)}
        onChange={(next) => updateWidgetProp(field.key, next)}
      />
    );
  }

  if (field.kind === "select") {
    return (
      <SelectField
        key={field.key}
        label={field.label}
        value={String(value ?? "")}
        options={resolveSelectOptions(field.source, project)}
        allowEmpty={field.allowEmpty}
        emptyLabel={field.emptyLabel ?? emptySourceLabel(field.source)}
        onChange={(next) => updateWidgetProp(field.key, next || null)}
      />
    );
  }

  if (field.kind === "readonly") {
    return (
      <ReadonlyBlock
        key={field.key}
        title={field.label}
        value={field.format === "json" ? JSON.stringify(value, null, 2) : String(value ?? "")}
        format={field.format}
      />
    );
  }

  return null;
}

function CommonWidgetSection(props: {
  widget: Widget;
  updateWidgetField: (field: keyof Widget, value: unknown) => void;
  updateWidgetRect: (patch: Partial<Widget["rect"]>) => void;
}) {
  const { widget, updateWidgetField, updateWidgetRect } = props;

  return (
    <SidebarSection title="通用属性">
      <TextField label="标识" value={widget.id} onChange={(value) => updateWidgetField("id", value)} />
      <TextField label="名称" value={widget.name} onChange={(value) => updateWidgetField("name", value)} />
      <TextField label="类型" value={widget.type} readOnly onChange={() => undefined} />
      <NumberField label="Z 层" value={widget.zIndex} onChange={(value) => updateWidgetField("zIndex", value)} />
      <CheckboxField label="可见" value={widget.visible} onChange={(value) => updateWidgetField("visible", value)} />
      <CheckboxField label="启用" value={widget.enabled} onChange={(value) => updateWidgetField("enabled", value)} />
      <CheckboxField
        label="可聚焦"
        value={widget.focusable}
        onChange={(value) => updateWidgetField("focusable", value)}
      />
      <div className="inspector-grid-2">
        <NumberField label="X" value={widget.rect.x} onChange={(value) => updateWidgetRect({ x: value })} />
        <NumberField label="Y" value={widget.rect.y} onChange={(value) => updateWidgetRect({ y: value })} />
        <NumberField
          label="宽度"
          value={widget.rect.width}
          onChange={(value) => updateWidgetRect({ width: value })}
        />
        <NumberField
          label="高度"
          value={widget.rect.height}
          onChange={(value) => updateWidgetRect({ height: value })}
        />
      </div>
    </SidebarSection>
  );
}

export function RightInspector() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const store = useProjectStore();
  const { project, selection, issues } = store;

  const selectedPicture =
    selection.kind === "picture"
      ? findPicture(project, selection.pictureId)
      : selection.kind === "widget" || selection.kind === "rule"
        ? findPicture(project, selection.pictureId)
        : undefined;

  const selectedWidget =
    selection.kind === "widget" ? findWidget(project, selection.widgetId) : undefined;
  const selectedRule =
    selection.kind === "rule"
      ? project.rules.find((rule) => rule.id === selection.ruleId)
      : undefined;
  const selectedVariable =
    selection.kind === "variable"
      ? project.variables.find((variable) => variable.id === selection.variableId)
      : undefined;
  const selectedTimer =
    selection.kind === "timer"
      ? project.timers.find((timer) => timer.id === selection.timerId)
      : undefined;
  const selectedResource =
    selection.kind === "resource"
      ? project.resources.find((resource) => resource.id === selection.resourceId)
      : undefined;

  const selectionTitle = (() => {
    switch (selection.kind) {
      case "widget":
        return selectionLabel(project, selection.kind, selection.widgetId);
      case "picture":
        return selectionLabel(project, selection.kind, selection.pictureId);
      default:
        return selection.kind === "project" ? "工程" : selection.kind;
    }
  })();

  const handleResourceImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedResource) {
      return;
    }

    try {
      const sourceDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("读取图片文件失败。"));
        reader.readAsDataURL(file);
      });

      const threshold = selectedResource.threshold ?? 128;
      const image = await loadImageFromUrl(sourceDataUrl);
      const bitmap = imageElementToMonoBitmap(image, threshold);
      store.setResourceBitmap(selectedResource.id, file.name, sourceDataUrl, bitmap, threshold);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "导入资源失败。");
    } finally {
      event.target.value = "";
    }
  };

  const handleThresholdChange = async (resourceId: string, threshold: number) => {
    if (!selectedResource?.sourceDataUrl) {
      store.updateResourceField(resourceId, "threshold", threshold);
      return;
    }

    try {
      const image = await loadImageFromUrl(selectedResource.sourceDataUrl);
      const bitmap = imageElementToMonoBitmap(image, threshold);
      store.setResourceBitmap(
        resourceId,
        selectedResource.source,
        selectedResource.sourceDataUrl,
        bitmap,
        threshold,
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "重新生成位图失败。");
    }
  };

  return (
    <aside className="right-inspector panel">
      <SidebarSection title="当前选择">
        <div className="inspector-summary">
          <strong>{selectionTitle}</strong>
          <span className="entity-meta">
            {selection.kind === "project" ? "工程根节点" : selection.kind}
          </span>
        </div>
      </SidebarSection>

      {selection.kind === "project" && (
        <>
          <SidebarSection title="工程">
            <TextField
              label="名称"
              value={project.project.name}
              onChange={(value) => store.updateProjectField("name", value)}
            />
          </SidebarSection>
          <SidebarSection title="屏幕">
            <NumberField label="宽度" value={project.screen.width} onChange={() => undefined} readOnly />
            <NumberField label="高度" value={project.screen.height} onChange={() => undefined} readOnly />
            <TextField
              label="前景色"
              value={project.screen.foreground}
              onChange={(value) => store.updateScreenField("foreground", value)}
            />
            <TextField
              label="背景色"
              value={project.screen.background}
              onChange={(value) => store.updateScreenField("background", value)}
            />
            <CheckboxField
              label="启用缓存"
              value={project.screen.buffered}
              onChange={(value) => store.updateScreenField("buffered", value)}
            />
          </SidebarSection>
          <SidebarSection title="模拟器">
            <SelectField
              label="起始页面"
              value={project.simulator.startPictureId}
              options={project.pictures.map((picture) => ({ value: picture.id, label: picture.name }))}
              onChange={(value) => store.updateSimulatorField("startPictureId", value)}
            />
            <NumberField
              label="刷新帧率"
              value={project.simulator.fps}
              onChange={(value) => store.updateSimulatorField("fps", value)}
            />
            <CheckboxField
              label="显示像素网格"
              value={project.simulator.showGrid}
              onChange={(value) => store.updateSimulatorField("showGrid", value)}
            />
          </SidebarSection>
        </>
      )}

      {selectedPicture && selection.kind === "picture" && (
        <SidebarSection title="页面">
          <TextField
            label="标识"
            value={selectedPicture.id}
            onChange={(value) => store.updatePictureField(selectedPicture.id, "id", value)}
          />
          <TextField
            label="名称"
            value={selectedPicture.name}
            onChange={(value) => store.updatePictureField(selectedPicture.id, "name", value)}
          />
          <TextField
            label="标题"
            value={selectedPicture.title}
            onChange={(value) => store.updatePictureField(selectedPicture.id, "title", value)}
          />
        </SidebarSection>
      )}

      {selectedWidget && selection.kind === "widget" && (() => {
        const contract = getWidgetContract(selectedWidget.type);
        const bindings = collectWidgetBindings(selectedWidget);
        const groups = contract.inspectorGroups(selectedWidget as never);

        return (
          <>
            <SidebarSection title="控件概览">
              <div className="contract-summary">
                <strong>{contract.label}</strong>
                <span className="entity-meta">{contract.summary}</span>
                <span className="entity-meta">
                  {widgetCategoryLabels[contract.category]} / {contract.simpleGuiFamily}
                </span>
                <div className="binding-chip-list">
                  {contract.runtimeFeatures.map((feature) => (
                    <span key={feature} className="binding-chip">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </SidebarSection>

            <CommonWidgetSection
              widget={selectedWidget}
              updateWidgetField={(field, value) => store.updateWidgetField(selectedWidget.id, field, value as never)}
              updateWidgetRect={(patch) => store.updateWidgetRect(selectedWidget.id, patch)}
            />

            {groups.map((group) => (
              <SidebarSection key={group.title} title={group.title}>
                {group.description ? <div className="section-hint">{group.description}</div> : null}
                <div className="stack-list compact-list">
                  {group.fields.map((field) =>
                    renderInspectorField(
                      selectedWidget,
                      field,
                      project,
                      (key, value) => store.updateWidgetProp(selectedWidget.id, key, value),
                    ),
                  )}
                </div>
              </SidebarSection>
            ))}

            <SidebarSection title="绑定信息">
              <div className="stack-list compact-list">
                {bindings.length ? (
                  bindings.map((binding) => (
                    <div key={`${binding.field}-${binding.role}`} className="rule-snippet">
                      <strong>{binding.field}</strong>
                      <span>
                        {binding.role} / {binding.sourceKind} / {binding.sourceId ?? "none"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="placeholder-item">这个控件没有额外绑定项。</div>
                )}
              </div>
            </SidebarSection>
          </>
        );
      })()}

      {selectedVariable && selection.kind === "variable" && (
        <SidebarSection title="变量">
          <TextField
            label="标识"
            value={selectedVariable.id}
            onChange={(value) => store.updateVariableField(selectedVariable.id, "id", value)}
          />
          <TextField
            label="名称"
            value={selectedVariable.name}
            onChange={(value) => store.updateVariableField(selectedVariable.id, "name", value)}
          />
          <TextField label="类型" value={selectedVariable.type} readOnly onChange={() => undefined} />
          {selectedVariable.type === "int" && (
            <>
              <NumberField
                label="初始值"
                value={selectedVariable.initial}
                onChange={(value) => store.updateVariableField(selectedVariable.id, "initial", value)}
              />
              <NumberField
                label="最小值"
                value={selectedVariable.min}
                onChange={(value) => store.updateVariableField(selectedVariable.id, "min", value)}
              />
              <NumberField
                label="最大值"
                value={selectedVariable.max}
                onChange={(value) => store.updateVariableField(selectedVariable.id, "max", value)}
              />
              <NumberField
                label="步进"
                value={selectedVariable.step}
                onChange={(value) => store.updateVariableField(selectedVariable.id, "step", value)}
              />
            </>
          )}
          {selectedVariable.type === "string" && (
            <>
              <TextField
                label="初始值"
                value={selectedVariable.initial}
                onChange={(value) => store.updateVariableField(selectedVariable.id, "initial", value)}
              />
              <NumberField
                label="长度"
                value={selectedVariable.length}
                onChange={(value) => store.updateVariableField(selectedVariable.id, "length", value)}
              />
            </>
          )}
          {selectedVariable.type === "bool" && (
            <CheckboxField
              label="初始值"
              value={selectedVariable.initial}
              onChange={(value) => store.updateVariableField(selectedVariable.id, "initial", value)}
            />
          )}
          <CheckboxField
            label="只读"
            value={selectedVariable.readonly}
            onChange={(value) => store.updateVariableField(selectedVariable.id, "readonly", value)}
          />
        </SidebarSection>
      )}

      {selectedTimer && selection.kind === "timer" && (
        <SidebarSection title="定时器">
          <TextField
            label="标识"
            value={selectedTimer.id}
            onChange={(value) => store.updateTimerField(selectedTimer.id, "id", value)}
          />
          <TextField
            label="名称"
            value={selectedTimer.name}
            onChange={(value) => store.updateTimerField(selectedTimer.id, "name", value)}
          />
          <NumberField
            label="周期"
            value={selectedTimer.intervalMs}
            onChange={(value) => store.updateTimerField(selectedTimer.id, "intervalMs", value)}
          />
          <SelectField
            label="目标页面"
            value={selectedTimer.targetPictureId ?? ""}
            options={project.pictures.map((picture) => ({ value: picture.id, label: picture.name }))}
            allowEmpty
            emptyLabel="无目标页面"
            onChange={(value) =>
              store.updateTimerField(selectedTimer.id, "targetPictureId", value || null)
            }
          />
          <CheckboxField
            label="重复触发"
            value={selectedTimer.repeat}
            onChange={(value) => store.updateTimerField(selectedTimer.id, "repeat", value)}
          />
          <CheckboxField
            label="启动即启用"
            value={selectedTimer.enabledOnStart}
            onChange={(value) => store.updateTimerField(selectedTimer.id, "enabledOnStart", value)}
          />
        </SidebarSection>
      )}

      {selectedResource && selection.kind === "resource" && (
        <>
          <SidebarSection
            title="资源"
            action={
              <button
                type="button"
                className="mini-button"
                onClick={() => fileInputRef.current?.click()}
              >
                导入
              </button>
            }
          >
            <TextField
              label="标识"
              value={selectedResource.id}
              onChange={(value) => store.updateResourceField(selectedResource.id, "id", value)}
            />
            <TextField
              label="名称"
              value={selectedResource.name}
              onChange={(value) => store.updateResourceField(selectedResource.id, "name", value)}
            />
            <SelectField
              label="类型"
              value={selectedResource.kind}
              options={[
                { value: "bitmap", label: "bitmap" },
                { value: "icon", label: "icon" },
              ]}
              onChange={(value) => store.updateResourceField(selectedResource.id, "kind", value)}
            />
            <TextField
              label="来源"
              value={selectedResource.source}
              onChange={(value) => store.updateResourceField(selectedResource.id, "source", value)}
            />
            <NumberField
              label="阈值"
              value={selectedResource.threshold ?? 128}
              min={0}
              max={255}
              onChange={(value) => handleThresholdChange(selectedResource.id, value)}
            />
            <input
              ref={fileInputRef}
              hidden
              type="file"
              accept=".png,.bmp,.svg,image/png,image/bmp,image/svg+xml"
              onChange={handleResourceImport}
            />
          </SidebarSection>
          <SidebarSection title="单色预览">
            <ResourceBitmapPreview bitmap={selectedResource.bitmap} />
          </SidebarSection>
        </>
      )}

      {selectedRule && selection.kind === "rule" && (
        <SidebarSection title="规则">
          <TextField
            label="标识"
            value={selectedRule.id}
            onChange={(value) => store.updateRuleField(selectedRule.id, "id", value)}
          />
          <SelectField
            label="所属页面"
            value={selectedRule.pictureId}
            options={project.pictures.map((picture) => ({ value: picture.id, label: picture.name }))}
            onChange={(value) => store.updateRuleField(selectedRule.id, "pictureId", value)}
          />
          <CheckboxField
            label="命中后停止"
            value={selectedRule.stopAfterMatch}
            onChange={(value) => store.updateRuleField(selectedRule.id, "stopAfterMatch", value)}
          />
          <ReadonlyBlock title="事件" value={JSON.stringify(selectedRule.event, null, 2)} format="json" />
          <ReadonlyBlock
            title="条件"
            value={JSON.stringify(selectedRule.condition ?? null, null, 2)}
            format="json"
          />
          <ReadonlyBlock title="动作" value={JSON.stringify(selectedRule.actions, null, 2)} format="json" />
        </SidebarSection>
      )}

      <SidebarSection title="校验结果">
        <div className="stack-list compact-list">
          {issues.length ? (
            issues.map((issue, index) => (
              <div key={`${issue.code}-${index}`} className={`issue-card issue-${issue.level}`}>
                <strong>{issue.level.toUpperCase()}</strong>
                <span>{issue.message}</span>
                <span className="entity-meta">{issue.path}</span>
              </div>
            ))
          ) : (
            <div className="placeholder-item">当前没有校验问题。</div>
          )}
        </div>
      </SidebarSection>
    </aside>
  );
}
