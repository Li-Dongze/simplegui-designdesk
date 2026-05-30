import { findPicture, findWidget } from "@/utils/projectFormat";
import type {
  Action,
  Picture,
  ProjectDocument,
  RuleDefinition,
  SimulatorSession,
  VariableDefinition,
  VariableValue,
  Widget,
  WidgetRuntimeState,
} from "@/types/project";

export function sortWidgets(widgets: Widget[]): Widget[] {
  return [...widgets].sort((left, right) => {
    if (left.zIndex !== right.zIndex) {
      return left.zIndex - right.zIndex;
    }
    return widgets.indexOf(left) - widgets.indexOf(right);
  });
}

export function getPictureForView(
  project: ProjectDocument,
  activePictureId: string,
  simulator: SimulatorSession | null,
): Picture | undefined {
  const pictureId = simulator?.currentPictureId ?? activePictureId;
  return findPicture(project, pictureId);
}

export function getVariableMap(
  project: ProjectDocument,
  simulator: SimulatorSession | null,
): Map<string, VariableValue> {
  if (simulator) {
    return new Map(Object.entries(simulator.variableStore));
  }

  return new Map(project.variables.map((variable) => [variable.id, variable.initial]));
}

export function getVariableDefinitionMap(project: ProjectDocument): Map<string, VariableDefinition> {
  return new Map(project.variables.map((variable) => [variable.id, variable]));
}

export function getWidgetRuntime(
  widget: Widget,
  simulator: SimulatorSession | null,
): WidgetRuntimeState | undefined {
  return simulator?.widgetRuntimeState[widget.id];
}

export function getWidgetVisible(widget: Widget, simulator: SimulatorSession | null): boolean {
  return getWidgetRuntime(widget, simulator)?.visible ?? widget.visible;
}

export function getWidgetEnabled(widget: Widget, simulator: SimulatorSession | null): boolean {
  return getWidgetRuntime(widget, simulator)?.enabled ?? widget.enabled;
}

export function getWidgetSelectedIndex(widget: Widget, simulator: SimulatorSession | null): number {
  const runtime = getWidgetRuntime(widget, simulator);
  if (widget.type === "list" || widget.type === "menu") {
    return runtime?.selectedIndex ?? widget.props.selectedIndex;
  }
  return 0;
}

export function getListItems(
  widget: Extract<Widget, { type: "list" | "menu" }>,
  simulator: SimulatorSession | null,
): typeof widget.props.items {
  return simulator?.widgetRuntimeState[widget.id]?.listItems ?? widget.props.items;
}

export function getWidgetFocusIndex(widget: Widget, simulator: SimulatorSession | null): number {
  const runtime = getWidgetRuntime(widget, simulator);
  if (widget.type === "textVariableBox") {
    return runtime?.focusIndex ?? widget.props.focusIndex;
  }
  return 0;
}

export function readWidgetVariableValue(
  widget: Widget,
  variableMap: Map<string, VariableValue>,
): string {
  const read = (variableId: string | null | undefined): string => {
    if (!variableId) {
      return "--";
    }
    const value = variableMap.get(variableId);
    return value === undefined ? "--" : String(value);
  };

  switch (widget.type) {
    case "numberVariableBox":
      return read(widget.props.valueVarId);
    case "textVariableBox":
      return read(widget.props.textVarId);
    case "textLabel":
      return read(widget.props.textVarId);
    case "processBar":
      return read(widget.props.valueVarId);
    case "realtimeGraph":
      return read(widget.props.valueVarId);
    default:
      return "";
  }
}

export function resolveChoiceLabel(
  label: string,
  dynamicTextVarId: string | null,
  variableMap: Map<string, VariableValue>,
): string {
  if (!dynamicTextVarId) {
    return label;
  }

  const value = variableMap.get(dynamicTextVarId);
  return value === undefined ? label : String(value);
}

export function getGraphBuffer(widgetId: string, simulator: SimulatorSession | null): number[] {
  return simulator?.graphBuffers[widgetId] ?? [];
}

export function summarizeAction(action: Action): string {
  switch (action.type) {
    case "gotoPicture":
      return `goto ${action.pictureId}`;
    case "goBack":
      return "goBack";
    case "setVariable":
      return `set ${action.variableId}=${String(action.value)}`;
    case "setVariableFromVariable":
      return `set ${action.variableId}<=${action.fromVariableId}`;
    case "increaseVariable":
      return `inc ${action.variableId} by ${action.step}`;
    case "decreaseVariable":
      return `dec ${action.variableId} by ${action.step}`;
    case "addVariableFromVariable":
      return `add ${action.variableId}+=${action.fromVariableId}`;
    case "negateVariable":
      return `negate ${action.variableId}`;
    case "setWidgetProp":
      return `set ${action.widgetId}.${action.prop}`;
    case "selectNext":
      return `selectNext ${action.widgetId}`;
    case "selectPrev":
      return `selectPrev ${action.widgetId}`;
    case "focusNext":
      return action.widgetId ? `focusNext ${action.widgetId}` : "focusNext";
    case "focusPrev":
      return action.widgetId ? `focusPrev ${action.widgetId}` : "focusPrev";
    case "pushGraphValue":
      return `pushGraph ${action.widgetId}`;
    case "clearGraphBuffer":
      return `clearGraph ${action.widgetId}`;
    case "showNotice":
      return `showNotice ${action.widgetId}`;
    case "hideNotice":
      return `hideNotice ${action.widgetId}`;
    case "startTimer":
      return `startTimer ${action.timerId}`;
    case "stopTimer":
      return `stopTimer ${action.timerId}`;
    case "toggleBool":
      return `toggle ${action.variableId}`;
    case "textCharNext":
      return `textCharNext ${action.widgetId}`;
    case "textCharPrev":
      return `textCharPrev ${action.widgetId}`;
  }
  return "";
}

export function summarizeRule(rule: RuleDefinition): string {
  const actionSummary = rule.actions.map(summarizeAction).join(" -> ") || "no actions";

  switch (rule.event.kind) {
    case "onKeyPress":
      return `${rule.event.key}${rule.event.widgetId ? ` @ ${rule.event.widgetId}` : ""} -> ${actionSummary}`;
    case "onTimer":
      return `${rule.event.timerId} -> ${actionSummary}`;
    case "onValueChange":
      return `${rule.event.variableId} changed -> ${actionSummary}`;
    case "onWidgetFocus":
    case "onWidgetSelect":
    case "onWidgetConfirm":
      return `${rule.event.kind} ${rule.event.widgetId} -> ${actionSummary}`;
  }
  return actionSummary;
}

export function selectionLabel(
  project: ProjectDocument,
  selectionKind: string,
  selectionId?: string,
): string {
  if (selectionKind === "widget" && selectionId) {
    const widget = findWidget(project, selectionId);
    return widget ? `${widget.name} (${widget.type})` : "Widget";
  }

  if (selectionKind === "picture" && selectionId) {
    const picture = findPicture(project, selectionId);
    return picture ? picture.name : "Picture";
  }

  return selectionKind;
}
