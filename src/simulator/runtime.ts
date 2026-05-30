import { findPicture, findWidget } from "@/utils/projectFormat";
import type {
  AbstractKey,
  Action,
  ChoiceItem,
  ConditionItem,
  Picture,
  ProjectDocument,
  RuleConditionGroup,
  RuleEvent,
  RuleEventKeyPress,
  RuleEventTimer,
  RuleEventValueChange,
  RuleEventWidget,
  SimulatorEventLogEntry,
  SimulatorSession,
  VariableDefinition,
  VariableValue,
  Widget,
  WidgetRuntimeState,
} from "@/types/project";

const MAX_EVENT_LOG = 20;
const MAX_EVENT_DEPTH = 256;
const ASCII_START = 32;
const ASCII_END = 126;
const LIST_LAYOUTS = [
  { x: 0, y: 0, width: 128, height: 64 },
  { x: 0, y: 0, width: 192, height: 96 },
  { x: 0, y: 0, width: 192, height: 128 },
] as const;

type RuntimeEvent = RuleEvent;

function logEvent(session: SimulatorSession, label: string): void {
  const entry: SimulatorEventLogEntry = { ts: session.clockMs, label };
  session.eventLog = [...session.eventLog, entry].slice(-MAX_EVENT_LOG);
}

function getVariableDefinition(
  project: ProjectDocument,
  variableId: string,
): VariableDefinition | undefined {
  return project.variables.find((variable) => variable.id === variableId);
}

function getWidgetRuntime(widget: Widget): WidgetRuntimeState {
  const base: WidgetRuntimeState = {
    visible: widget.visible,
    enabled: widget.enabled,
  };

  if (widget.type === "list" || widget.type === "menu") {
    base.selectedIndex = widget.props.selectedIndex;
    base.listItems = structuredClone(widget.props.items);
    base.listAppendUsed = {};
    base.listLayoutIndex = 1;
    base.listLayoutRect = structuredClone(widget.rect);
  }

  if (widget.type === "textVariableBox") {
    base.focusIndex = widget.props.focusIndex;
    base.textFirstVisibleIndex = 0;
    base.textLastVisibleIndex = Math.min(widget.props.length - 1, Math.max(0, widget.props.length - 1));
    base.textOffset = 0;
  }

  if (widget.type === "curve") {
    base.curvePoints = structuredClone(widget.props.points);
    base.curveFocusedIndex = widget.props.focusedIndex;
    base.curveArgumentValue = widget.props.argumentValue;
  }

  if (widget.type === "notice") {
    base.noticeText = widget.props.text;
  }

  if (widget.type === "menu") {
    base.menuPopupRect = widget.props.popupParentWidgetId ? structuredClone(widget.rect) : undefined;
  }

  return base;
}

function getCurrentPictureWidgetMap(project: ProjectDocument, pictureId: string) {
  const picture = findPicture(project, pictureId);
  return new Map((picture?.widgets ?? []).map((widget) => [widget.id, widget]));
}

function syncPolarClockVariables(
  project: ProjectDocument,
  session: SimulatorSession,
  queue: RuntimeEvent[],
) {
  const now = new Date();
  setVariable(project, session, "var_clock_hour", now.getHours(), queue);
  setVariable(project, session, "var_clock_minute", now.getMinutes(), queue);
  setVariable(project, session, "var_clock_second", now.getSeconds(), queue);
}

function setVariableBoxHelpState(
  project: ProjectDocument,
  session: SimulatorSession,
  visible: boolean,
) {
  if (session.currentPictureId !== "pic_variable_box") {
    return;
  }

  const widgetMap = getCurrentPictureWidgetMap(project, session.currentPictureId);
  const notice = widgetMap.get("w_var_notice");
  const numberBox = widgetMap.get("w_var_number");
  const textBox = widgetMap.get("w_var_text");

  if (notice) {
    session.widgetRuntimeState[notice.id].visible = visible;
  }
  if (numberBox) {
    session.widgetRuntimeState[numberBox.id].enabled = !visible;
  }
  if (textBox) {
    session.widgetRuntimeState[textBox.id].enabled = !visible;
  }
}

function setTextViewport(
  widget: Extract<Widget, { type: "textVariableBox" }>,
  runtime: WidgetRuntimeState,
) {
  const halfWidth =
    widget.props.font === "SGUI_DEFAULT_FONT_12"
      ? 6
      : widget.props.font === "SGUI_DEFAULT_FONT_16"
        ? 8
        : widget.props.font === "SGUI_DEFAULT_FONT_MiniNum"
          ? 4
          : 6;
  const visibleCharNum = Math.max(1, Math.floor((widget.rect.width - 1) / halfWidth) + 1);
  const length = widget.props.length;
  const focusIndex = Math.max(0, Math.min(length - 1, runtime.focusIndex ?? widget.props.focusIndex));

  let firstVisibleIndex = runtime.textFirstVisibleIndex ?? 0;
  let lastVisibleIndex = runtime.textLastVisibleIndex ?? Math.min(length - 1, visibleCharNum - 1);

  if (focusIndex > lastVisibleIndex) {
    lastVisibleIndex = focusIndex;
    firstVisibleIndex = Math.max(0, lastVisibleIndex - visibleCharNum + 1);
  } else if (focusIndex < firstVisibleIndex) {
    firstVisibleIndex = focusIndex;
    lastVisibleIndex = Math.min(length - 1, firstVisibleIndex + visibleCharNum - 1);
  }

  const textOffset =
    length < visibleCharNum
      ? 0
      : focusIndex === lastVisibleIndex
        ? ((widget.rect.width % halfWidth) - halfWidth) % halfWidth
        : 0;

  runtime.focusIndex = focusIndex;
  runtime.textFirstVisibleIndex = firstVisibleIndex;
  runtime.textLastVisibleIndex = lastVisibleIndex;
  runtime.textOffset = textOffset;
}

function getPictureWidgetsInOrder(picture: Picture): Widget[] {
  return [...picture.widgets].sort((left, right) => {
    if (left.zIndex !== right.zIndex) {
      return left.zIndex - right.zIndex;
    }

    return picture.widgets.indexOf(left) - picture.widgets.indexOf(right);
  });
}

function isWidgetFocusable(session: SimulatorSession, widget: Widget): boolean {
  const runtime = session.widgetRuntimeState[widget.id];
  return (
    widget.focusable &&
    (runtime?.visible ?? widget.visible) &&
    (runtime?.enabled ?? widget.enabled)
  );
}

function firstFocusableWidgetId(project: ProjectDocument, session: SimulatorSession, pictureId: string): string | null {
  const picture = findPicture(project, pictureId);
  if (!picture) {
    return null;
  }

  return (
    getPictureWidgetsInOrder(picture).find((widget) => isWidgetFocusable(session, widget))?.id ?? null
  );
}

function cycleFocus(
  project: ProjectDocument,
  session: SimulatorSession,
  direction: 1 | -1,
): string | null {
  const picture = findPicture(project, session.currentPictureId);
  if (!picture) {
    return null;
  }

  const widgets = getPictureWidgetsInOrder(picture).filter((widget) =>
    isWidgetFocusable(session, widget),
  );

  if (widgets.length === 0) {
    return null;
  }

  if (!session.focusedWidgetId) {
    return widgets[0].id;
  }

  const currentIndex = widgets.findIndex((widget) => widget.id === session.focusedWidgetId);
  if (currentIndex < 0) {
    return widgets[0].id;
  }

  const nextIndex = (currentIndex + direction + widgets.length) % widgets.length;
  return widgets[nextIndex]?.id ?? null;
}

function pushEvent(queue: RuntimeEvent[], event: RuntimeEvent) {
  queue.push(event);
}

function normalizeStringValue(variable: VariableDefinition, value: string): string {
  if (variable.type !== "string") {
    return value;
  }
  return value.slice(0, variable.length).padEnd(Math.min(variable.length, value.length), " ");
}

function setVariable(
  project: ProjectDocument,
  session: SimulatorSession,
  variableId: string,
  value: VariableValue,
  queue: RuntimeEvent[],
) {
  const variable = getVariableDefinition(project, variableId);
  if (!variable || variable.readonly) {
    return;
  }

  let nextValue: VariableValue = value;

  if (variable.type === "int" && typeof value === "number") {
    nextValue = Math.max(variable.min, Math.min(variable.max, Math.round(value)));
  }

  if (variable.type === "bool") {
    nextValue = Boolean(value);
  }

  if (variable.type === "string") {
    nextValue = normalizeStringValue(variable, String(value));
  }

  if (session.variableStore[variableId] !== nextValue) {
    session.variableStore[variableId] = nextValue;
    pushEvent(queue, { kind: "onValueChange", variableId });
    logEvent(session, `set ${variableId}=${String(nextValue)}`);
  }
}

function updateSelectedIndex(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
  delta: number,
  queue: RuntimeEvent[],
): boolean {
  const widget = findWidget(project, widgetId);
  if (!widget || (widget.type !== "list" && widget.type !== "menu")) {
    return false;
  }

  const runtime = session.widgetRuntimeState[widget.id];
  const items = runtime.listItems ?? widget.props.items;
  const maxIndex = Math.max(0, items.length - 1);
  const current = runtime.selectedIndex ?? widget.props.selectedIndex;
  const next = Math.max(0, Math.min(maxIndex, current + delta));

  if (next !== current) {
    runtime.selectedIndex = next;
    pushEvent(queue, { kind: "onWidgetSelect", widgetId });
    logEvent(session, `${widgetId}.selectedIndex=${next}`);
    return true;
  }

  return false;
}

function computeMenuPopupRect(
  project: ProjectDocument,
  session: SimulatorSession,
  widget: Extract<Widget, { type: "menu" }>,
): { x: number; y: number; width: number; height: number } {
  const runtime = session.widgetRuntimeState[widget.id];
  const items = runtime.listItems ?? widget.props.items;
  const selectedIndex = runtime.selectedIndex ?? widget.props.selectedIndex;
  const itemHeight = 5 + 2;
  const itemCount = items.length;
  const fullHeight = (itemCount * itemHeight) + 6;
  const parentWidget = widget.props.popupParentWidgetId
    ? findWidget(project, widget.props.popupParentWidgetId)
    : undefined;
  const parentRuntime = parentWidget ? session.widgetRuntimeState[parentWidget.id] : undefined;
  const parentRect = parentRuntime?.menuPopupRect ?? parentWidget?.rect ?? widget.rect;
  const parentItemRect = {
    x: parentRect.x,
    y: parentRect.y + 3 + (selectedIndex * itemHeight),
    width: parentRect.width,
    height: itemHeight,
  };

  const x = parentItemRect.x + parentItemRect.width + 1;
  const visibleHeight = project.screen.height - parentItemRect.y - 1;
  let y = parentItemRect.y;
  if ((visibleHeight < fullHeight) && (parentItemRect.y > (project.screen.height / 2))) {
    const adjustedVisibleHeight = parentItemRect.y + parentItemRect.height + 1;
    y = Math.max(0, adjustedVisibleHeight - fullHeight - 1);
  }

  return {
    x,
    y,
    width: parentItemRect.width + 2,
    height: Math.min(fullHeight, visibleHeight),
  };
}

export function resolveListLayoutRect(listLayoutIndex: number): { x: number; y: number; width: number; height: number } {
  return structuredClone(LIST_LAYOUTS[Math.max(0, Math.min(LIST_LAYOUTS.length - 1, listLayoutIndex))]);
}

function getListRuntimeState(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
) {
  const widget = findWidget(project, widgetId);
  if (!widget || widget.type !== "list") {
    return null;
  }

  const runtime = session.widgetRuntimeState[widgetId];
  runtime.listItems = structuredClone(runtime.listItems ?? widget.props.items);
  runtime.listAppendUsed = { ...(runtime.listAppendUsed ?? {}) };
  runtime.listLayoutIndex = runtime.listLayoutIndex ?? 1;
  runtime.listLayoutRect = runtime.listLayoutRect ?? resolveListLayoutRect(runtime.listLayoutIndex);

  return { widget, runtime };
}

function insertListItem(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
  position: "before" | "start" | "end",
): boolean {
  const payload = getListRuntimeState(project, session, widgetId);
  if (!payload) {
    return false;
  }

  const { widget, runtime } = payload;
  const items = structuredClone(runtime.listItems ?? widget.props.items) as ChoiceItem[];
  const used = { ...(runtime.listAppendUsed ?? {}) };
  const pool = [
    { id: "item_append_1", label: "Add item 1", dynamicTextVarId: null },
    { id: "item_append_2", label: "Add item 2", dynamicTextVarId: null },
    { id: "item_append_3", label: "Add item 3", dynamicTextVarId: null },
    { id: "item_append_4", label: "Add item 4", dynamicTextVarId: null },
    { id: "item_append_5", label: "Add item 5", dynamicTextVarId: null },
    { id: "item_append_6", label: "Add item 6", dynamicTextVarId: null },
  ] satisfies ChoiceItem[];
  const nextChoice = pool.find((entry) => !used[entry.id]);
  if (!nextChoice) {
    return false;
  }

  const insertIndex =
    position === "start"
      ? 0
      : position === "end"
        ? items.length
        : Math.max(0, runtime.selectedIndex ?? widget.props.selectedIndex);
  items.splice(insertIndex, 0, nextChoice);
  used[nextChoice.id] = true;
  runtime.listItems = items;
  runtime.listAppendUsed = used;
  if (runtime.selectedIndex !== undefined && position === "start") {
    runtime.selectedIndex += 1;
  } else if (position === "before" && runtime.selectedIndex !== undefined && insertIndex <= runtime.selectedIndex) {
    runtime.selectedIndex += 1;
  } else if (runtime.selectedIndex === undefined) {
    runtime.selectedIndex = 0;
  }
  return true;
}

function removeListItem(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
): boolean {
  const payload = getListRuntimeState(project, session, widgetId);
  if (!payload) {
    return false;
  }

  const { widget, runtime } = payload;
  const items = structuredClone(runtime.listItems ?? widget.props.items) as ChoiceItem[];
  if (items.length === 0) {
    return false;
  }

  const index = Math.max(0, Math.min(items.length - 1, runtime.selectedIndex ?? widget.props.selectedIndex));
  const [removed] = items.splice(index, 1);
  if (!removed) {
    return false;
  }

  const used = { ...(runtime.listAppendUsed ?? {}) };
  delete used[removed.id];
  runtime.listItems = items;
  runtime.listAppendUsed = used;
  runtime.selectedIndex = items.length === 0 ? 0 : Math.max(0, Math.min(index, items.length - 1));
  return true;
}

function updateTextFocus(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
  delta: number,
  queue: RuntimeEvent[],
) {
  const widget = findWidget(project, widgetId);
  if (!widget || widget.type !== "textVariableBox") {
    return;
  }

  const runtime = session.widgetRuntimeState[widgetId];
  const current = runtime.focusIndex ?? widget.props.focusIndex;
  const next = Math.max(0, Math.min(widget.props.length - 1, current + delta));

  if (next !== current) {
    runtime.focusIndex = next;
    setTextViewport(widget, runtime);
    pushEvent(queue, { kind: "onWidgetFocus", widgetId });
    logEvent(session, `${widgetId}.focusIndex=${next}`);
  }
}

function rotateTextCharacter(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
  delta: number,
  queue: RuntimeEvent[],
) {
  const widget = findWidget(project, widgetId);
  if (!widget || widget.type !== "textVariableBox" || !widget.props.textVarId) {
    return;
  }

  const variable = getVariableDefinition(project, widget.props.textVarId);
  const currentValue = session.variableStore[widget.props.textVarId];
  if (!variable || variable.type !== "string" || typeof currentValue !== "string") {
    return;
  }

  const runtime = session.widgetRuntimeState[widgetId];
  const focusIndex = Math.max(
    0,
    Math.min(widget.props.length - 1, runtime.focusIndex ?? widget.props.focusIndex),
  );
  runtime.focusIndex = focusIndex;
  setTextViewport(widget, runtime);
  const chars = currentValue.padEnd(variable.length, " ").slice(0, variable.length).split("");
  const currentCode = chars[focusIndex]?.charCodeAt(0) ?? ASCII_START;
  let nextCode = currentCode + delta;

  if (nextCode > ASCII_END) {
    nextCode = ASCII_START;
  }
  if (nextCode < ASCII_START) {
    nextCode = ASCII_END;
  }

  chars[focusIndex] = String.fromCharCode(nextCode);
  setVariable(project, session, variable.id, chars.join(""), queue);
}

function getCurveRuntimeState(project: ProjectDocument, session: SimulatorSession, widgetId: string) {
  const widget = findWidget(project, widgetId);
  if (!widget || widget.type !== "curve") {
    return null;
  }

  const runtime = session.widgetRuntimeState[widgetId];
  runtime.curvePoints = runtime.curvePoints ?? structuredClone(widget.props.points);
  runtime.curveFocusedIndex =
    runtime.curveFocusedIndex === undefined ? widget.props.focusedIndex : runtime.curveFocusedIndex;
  runtime.curveArgumentValue =
    runtime.curveArgumentValue === undefined
      ? widget.props.argumentValue
      : runtime.curveArgumentValue;

  return { widget, runtime };
}

function cycleCurveFocus(project: ProjectDocument, session: SimulatorSession, widgetId: string) {
  const payload = getCurveRuntimeState(project, session, widgetId);
  if (!payload) {
    return false;
  }

  const { runtime } = payload;
  const points = runtime.curvePoints ?? [];
  if (points.length === 0) {
    return false;
  }

  if (runtime.curveFocusedIndex === null || runtime.curveFocusedIndex === undefined) {
    runtime.curveFocusedIndex = 0;
    return true;
  }

  runtime.curveFocusedIndex += 1;
  if (runtime.curveFocusedIndex >= points.length) {
    runtime.curveFocusedIndex = null;
  }

  return true;
}

function insertCurvePoint(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
  before: boolean,
) {
  const payload = getCurveRuntimeState(project, session, widgetId);
  if (!payload) {
    return false;
  }

  const { widget, runtime } = payload;
  const points = runtime.curvePoints ?? [];
  const focusedIndex = runtime.curveFocusedIndex;
  const newPoint = { x: 0, y: widget.props.yMin };
  const insertIndex =
    focusedIndex === null || focusedIndex === undefined
      ? points.length
      : before
        ? focusedIndex
        : focusedIndex + 1;

  if (before && (focusedIndex === null || focusedIndex === undefined || focusedIndex === 0)) {
    return false;
  }
  if (!before && (focusedIndex === null || focusedIndex === undefined || focusedIndex >= points.length - 1)) {
    return false;
  }

  points.splice(Math.max(0, Math.min(points.length, insertIndex)), 0, newPoint);
  runtime.curvePoints = points;
  return true;
}

function deleteCurvePoint(project: ProjectDocument, session: SimulatorSession, widgetId: string) {
  const payload = getCurveRuntimeState(project, session, widgetId);
  if (!payload) {
    return false;
  }

  const { runtime } = payload;
  const points = runtime.curvePoints ?? [];
  const focusedIndex = runtime.curveFocusedIndex;
  if (focusedIndex === null || focusedIndex === undefined || points.length <= 2) {
    return false;
  }

  points.splice(focusedIndex, 1);
  runtime.curvePoints = points;
  runtime.curveFocusedIndex = null;
  return true;
}

function moveCurvePoint(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
  deltaX: number,
  deltaY: number,
) {
  const payload = getCurveRuntimeState(project, session, widgetId);
  if (!payload) {
    return false;
  }

  const { widget, runtime } = payload;
  const focusedIndex = runtime.curveFocusedIndex;
  if (focusedIndex === null || focusedIndex === undefined) {
    return false;
  }

  const points = runtime.curvePoints ?? [];
  const point = points[focusedIndex];
  if (!point) {
    return false;
  }

  let nextX = point.x;
  if (focusedIndex !== 0 && focusedIndex !== points.length - 1) {
    nextX = Math.max(widget.props.xMin, Math.min(widget.props.xMax, point.x + deltaX));
  }
  let nextY = Math.max(widget.props.yMin, Math.min(widget.props.yMax, point.y + deltaY));

  if (focusedIndex > 0) {
    nextX = Math.max(nextX, points[focusedIndex - 1].x + 1);
  }

  if (focusedIndex < points.length - 1) {
    nextX = Math.min(nextX, points[focusedIndex + 1].x - 1);
  }

  point.x = nextX;
  point.y = nextY;
  return true;
}

function moveCurveArgument(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
  delta: number,
) {
  const payload = getCurveRuntimeState(project, session, widgetId);
  if (!payload) {
    return false;
  }

  const { runtime } = payload;
  const points = runtime.curvePoints ?? [];
  if ((runtime.curveFocusedIndex ?? null) !== null || points.length === 0) {
    return false;
  }

  const minimum = points[0].x;
  const maximum = points[points.length - 1].x;
  runtime.curveArgumentValue = Math.max(
    minimum,
    Math.min(maximum, (runtime.curveArgumentValue ?? minimum) + delta),
  );
  return true;
}

export function getVisibleItemMetrics(
  widget: Extract<Widget, { type: "list" | "menu" }>,
  runtime: WidgetRuntimeState,
) {
  const items = runtime.listItems ?? widget.props.items;
  const layout = widget.type === "menu"
    ? (runtime.menuPopupRect ?? runtime.listLayoutRect ?? widget.rect)
    : (runtime.listLayoutRect ?? widget.rect);
  const fontHeight = widget.props.font === "SGUI_DEFAULT_FONT_MiniNum"
    ? 5
    : widget.props.font === "SGUI_DEFAULT_FONT_8"
      ? 8
      : widget.props.font === "SGUI_DEFAULT_FONT_12"
        ? 12
        : widget.props.font === "SGUI_DEFAULT_FONT_16"
          ? 16
          : 12;
  const itemHeight = fontHeight + 2;
  const isList = widget.type === "list";
  const headerHeight = isList ? (fontHeight + 2) : 8;
  const innerHeight = Math.max(1, layout.height - headerHeight - (isList ? 3 : 0));
  const visibleCount = Math.max(1, Math.floor((innerHeight - 1) / itemHeight) + 1);
  const maxStartIndex = Math.max(0, items.length - visibleCount);
  const selectedIndex = runtime.selectedIndex ?? widget.props.selectedIndex;
  const startIndex = Math.min(maxStartIndex, Math.max(0, selectedIndex - visibleCount + 1));
  const endIndex = Math.min(items.length - 1, startIndex + visibleCount - 1);
  const offset = selectedIndex === endIndex
    ? (((innerHeight % itemHeight) - itemHeight) % itemHeight)
    : 0;
  const itemsX = layout.x + (isList ? 2 : 1);
  const itemsY = layout.y + (isList ? headerHeight + 2 : 4);
  const itemsWidth = Math.max(1, layout.width - (isList ? 4 : 2) - (isList && widget.props.showScrollbar ? 5 : 0));
  const itemsHeight = innerHeight;

  return {
    items,
    layout,
    itemHeight,
    visibleCount,
    startIndex,
    endIndex,
    offset,
    selectedIndex,
    itemsX,
    itemsY,
    itemsWidth,
    itemsHeight,
    showScrollbar: isList ? widget.props.showScrollbar : false,
  };
}

function cycleListLayout(
  project: ProjectDocument,
  session: SimulatorSession,
  widgetId: string,
  direction: 1 | -1,
) {
  const payload = getListRuntimeState(project, session, widgetId);
  if (!payload) {
    return false;
  }

  const { runtime } = payload;
  const current = runtime.listLayoutIndex ?? 1;
  const next = (current + direction + LIST_LAYOUTS.length) % LIST_LAYOUTS.length;
  runtime.listLayoutIndex = next;
  runtime.listLayoutRect = resolveListLayoutRect(next);
  return true;
}

function getVisibleMenuWidgets(
  project: ProjectDocument,
  session: SimulatorSession,
): Extract<Widget, { type: "menu" }>[] {
  const picture = findPicture(project, session.currentPictureId);
  if (!picture) {
    return [];
  }

  return getPictureWidgetsInOrder(picture).filter((widget): widget is Extract<Widget, { type: "menu" }> => {
    if (widget.type !== "menu") {
      return false;
    }
    const runtime = session.widgetRuntimeState[widget.id];
    return (runtime?.visible ?? widget.visible) && (runtime?.enabled ?? widget.enabled);
  });
}

function getActiveMenuWidget(
  project: ProjectDocument,
  session: SimulatorSession,
): Extract<Widget, { type: "menu" }> | null {
  const popupMenus = getVisibleMenuWidgets(project, session).filter(
    (widget) => widget.props.popupParentWidgetId,
  );

  if (popupMenus.length > 0) {
    return popupMenus[popupMenus.length - 1] ?? null;
  }

  const focusedWidget = session.focusedWidgetId ? findWidget(project, session.focusedWidgetId) : undefined;
  if (focusedWidget?.type === "menu") {
    return focusedWidget;
  }

  return null;
}

function openMenuChild(
  project: ProjectDocument,
  session: SimulatorSession,
  parentMenu: Extract<Widget, { type: "menu" }>,
): boolean {
  const picture = findPicture(project, session.currentPictureId);
  if (!picture) {
    return false;
  }

  const child = getPictureWidgetsInOrder(picture).find(
    (widget): widget is Extract<Widget, { type: "menu" }> =>
      widget.type === "menu" && widget.props.popupParentWidgetId === parentMenu.id,
  );
  if (!child) {
    return false;
  }

  const runtime = session.widgetRuntimeState[child.id];
  runtime.visible = true;
  runtime.enabled = true;
  runtime.selectedIndex = runtime.selectedIndex ?? child.props.selectedIndex;
  runtime.menuPopupRect = computeMenuPopupRect(project, session, child);
  session.focusedWidgetId = child.id;
  logEvent(session, `menu open ${child.id}`);
  return true;
}

function closeMenuPopup(
  project: ProjectDocument,
  session: SimulatorSession,
  menuWidget: Extract<Widget, { type: "menu" }>,
): boolean {
  const runtime = session.widgetRuntimeState[menuWidget.id];
  if (!runtime) {
    return false;
  }

  runtime.visible = false;
  runtime.enabled = false;
  runtime.menuPopupRect = undefined;

  const parentMenu = menuWidget.props.popupParentWidgetId
    ? findWidget(project, menuWidget.props.popupParentWidgetId)
    : undefined;
  if (parentMenu?.type === "menu") {
    session.focusedWidgetId = parentMenu.id;
  }

  logEvent(session, `menu close ${menuWidget.id}`);
  return true;
}

function pushGraphValue(
  project: ProjectDocument,
  session: SimulatorSession,
  action: Extract<Action, { type: "pushGraphValue" }>,
) {
  const widget = findWidget(project, action.widgetId);
  if (!widget || widget.type !== "realtimeGraph") {
    return;
  }

  let value = 0;
  if (action.valueSource === "literal") {
    value = typeof action.value === "number" ? action.value : 0;
  } else if (action.fromVariableId) {
    const variableValue = session.variableStore[action.fromVariableId];
    value = typeof variableValue === "number" ? variableValue : 0;
  }

  const buffer = session.graphBuffers[widget.id] ?? [];
  const next = [...buffer, value].slice(-widget.props.capacity);
  session.graphBuffers[widget.id] = next;
  logEvent(session, `graph ${widget.id} <= ${value}`);
}

function applyWidgetProp(
  project: ProjectDocument,
  session: SimulatorSession,
  action: Extract<Action, { type: "setWidgetProp" }>,
  queue: RuntimeEvent[],
) {
  const widget = findWidget(project, action.widgetId);
  if (!widget) {
    return;
  }

  const runtime = session.widgetRuntimeState[widget.id];

  switch (action.prop) {
    case "visible":
      runtime.visible = Boolean(action.value);
      if (widget.type === "menu") {
        if (runtime.visible && widget.props.popupParentWidgetId) {
          runtime.menuPopupRect = computeMenuPopupRect(project, session, widget);
        } else {
          runtime.menuPopupRect = structuredClone(widget.rect);
        }
      }
      break;
    case "enabled":
      runtime.enabled = Boolean(action.value);
      break;
    case "selectedIndex":
      if (widget.type === "list" || widget.type === "menu") {
        runtime.selectedIndex = Number(action.value) || 0;
        pushEvent(queue, { kind: "onWidgetSelect", widgetId: widget.id });
        if (widget.type === "menu") {
          const picture = findPicture(project, session.currentPictureId);
          picture?.widgets.forEach((entry) => {
            if (entry.type !== "menu" || entry.props.popupParentWidgetId !== widget.id) {
              return;
            }

            const childRuntime = session.widgetRuntimeState[entry.id];
            if (childRuntime?.visible ?? entry.visible) {
              childRuntime.menuPopupRect = computeMenuPopupRect(project, session, entry);
            }
          });
        }
      }
      break;
    case "focusIndex":
      if (widget.type === "textVariableBox") {
        runtime.focusIndex = Number(action.value) || 0;
        setTextViewport(widget, runtime);
        pushEvent(queue, { kind: "onWidgetFocus", widgetId: widget.id });
      }
      break;
  }
}

function evaluateConditionItem(
  project: ProjectDocument,
  session: SimulatorSession,
  condition: ConditionItem,
): boolean {
  switch (condition.kind) {
    case "variableCompare": {
      const current = session.variableStore[condition.variableId];
      switch (condition.operator) {
        case "eq":
          return current === condition.value;
        case "neq":
          return current !== condition.value;
        case "gt":
          return Number(current) > Number(condition.value);
        case "gte":
          return Number(current) >= Number(condition.value);
        case "lt":
          return Number(current) < Number(condition.value);
        case "lte":
          return Number(current) <= Number(condition.value);
      }
      break;
    }
    case "widgetSelected": {
      const widget = findWidget(project, condition.widgetId);
      if (!widget || (widget.type !== "list" && widget.type !== "menu")) {
        return false;
      }
      const runtime = session.widgetRuntimeState[widget.id];
      return (runtime.selectedIndex ?? widget.props.selectedIndex) === condition.index;
    }
    case "widgetVisible": {
      const widget = findWidget(project, condition.widgetId);
      if (!widget) {
        return false;
      }
      return (session.widgetRuntimeState[widget.id]?.visible ?? widget.visible) === condition.visible;
    }
    case "timerEnabled":
      return (session.timerRuntimeState[condition.timerId]?.enabled ?? false) === condition.enabled;
  }
}

function evaluateCondition(
  project: ProjectDocument,
  session: SimulatorSession,
  condition?: RuleConditionGroup,
): boolean {
  if (!condition || condition.items.length === 0) {
    return true;
  }

  if (condition.mode === "all") {
    return condition.items.every((item) => evaluateConditionItem(project, session, item));
  }

  return condition.items.some((item) => evaluateConditionItem(project, session, item));
}

function matchEvent(event: RuleEvent, runtimeEvent: RuntimeEvent): boolean {
  if (event.kind !== runtimeEvent.kind) {
    return false;
  }

  switch (event.kind) {
    case "onKeyPress": {
      const nextEvent = runtimeEvent as RuleEventKeyPress;
      return (
        event.key === nextEvent.key &&
        (!event.widgetId || event.widgetId === nextEvent.widgetId)
      );
    }
    case "onTimer":
      return event.timerId === (runtimeEvent as RuleEventTimer).timerId;
    case "onValueChange":
      return event.variableId === (runtimeEvent as RuleEventValueChange).variableId;
    case "onWidgetFocus":
    case "onWidgetSelect":
    case "onWidgetConfirm":
      return event.widgetId === (runtimeEvent as RuleEventWidget).widgetId;
  }
}

function executeTransition(
  project: ProjectDocument,
  session: SimulatorSession,
  targetPictureId: string,
  queue: RuntimeEvent[],
  useBackStack: boolean,
) {
  const currentPicture = findPicture(project, session.currentPictureId);
  const targetPicture = findPicture(project, targetPictureId);
  if (!targetPicture) {
    return;
  }

  if (currentPicture) {
    executeActions(project, session, currentPicture.leaveActions, queue);
  }

  if (useBackStack && session.currentPictureId !== targetPictureId) {
    session.pictureHistoryStack = [...session.pictureHistoryStack, session.currentPictureId];
  }

  session.currentPictureId = targetPictureId;
  session.focusedWidgetId = firstFocusableWidgetId(project, session, targetPictureId);
  logEvent(session, `goto ${targetPictureId}`);

  if (targetPictureId === "pic_variable_box") {
    const widgetMap = getCurrentPictureWidgetMap(project, targetPictureId);
    const notice = widgetMap.get("w_var_notice");
    const title = widgetMap.get("w_var_title");
    const textBox = widgetMap.get("w_var_text");
    if (notice) {
      const runtime = session.widgetRuntimeState[notice.id];
      runtime.noticeCountdown = 5;
      runtime.noticeText = notice.type === "notice" ? notice.props.text : runtime.noticeText;
    }
    if (title) {
      session.widgetRuntimeState[title.id].titleOverride =
        title.type === "textLabel" ? title.props.text : undefined;
    }
    if (textBox?.type === "textVariableBox") {
      const textRuntime = session.widgetRuntimeState[textBox.id];
      textRuntime.focusIndex = 0;
      setTextViewport(textBox, textRuntime);
    }
    setVariableBoxHelpState(project, session, true);
  }

  if (targetPictureId === "pic_polar_coordinates") {
    syncPolarClockVariables(project, session, queue);
  }

  executeActions(project, session, targetPicture.enterActions, queue);
}

function executeActions(
  project: ProjectDocument,
  session: SimulatorSession,
  actions: Action[],
  queue: RuntimeEvent[],
) {
  for (const action of actions) {
    switch (action.type) {
      case "gotoPicture":
        executeTransition(project, session, action.pictureId, queue, true);
        return;
      case "goBack": {
        const previousPictureId = session.pictureHistoryStack[session.pictureHistoryStack.length - 1];
        if (!previousPictureId) {
          return;
        }

        const currentPicture = findPicture(project, session.currentPictureId);
        if (currentPicture) {
          executeActions(project, session, currentPicture.leaveActions, queue);
        }

        session.pictureHistoryStack = session.pictureHistoryStack.slice(0, -1);
        session.currentPictureId = previousPictureId;
        session.focusedWidgetId = firstFocusableWidgetId(project, session, previousPictureId);
        logEvent(session, `back ${previousPictureId}`);

        const targetPicture = findPicture(project, previousPictureId);
        if (targetPicture) {
          executeActions(project, session, targetPicture.enterActions, queue);
        }
        return;
      }
      case "setVariable":
        setVariable(project, session, action.variableId, action.value, queue);
        break;
      case "setVariableFromVariable": {
        const source = session.variableStore[action.fromVariableId];
        setVariable(project, session, action.variableId, source, queue);
        break;
      }
      case "increaseVariable": {
        const current = session.variableStore[action.variableId];
        setVariable(project, session, action.variableId, Number(current) + action.step, queue);
        break;
      }
      case "decreaseVariable": {
        const current = session.variableStore[action.variableId];
        setVariable(project, session, action.variableId, Number(current) - action.step, queue);
        break;
      }
      case "addVariableFromVariable": {
        const current = session.variableStore[action.variableId];
        const delta = session.variableStore[action.fromVariableId];
        setVariable(
          project,
          session,
          action.variableId,
          Number(current) + Number(delta),
          queue,
        );
        break;
      }
      case "negateVariable": {
        const current = session.variableStore[action.variableId];
        setVariable(project, session, action.variableId, -Number(current), queue);
        break;
      }
      case "setWidgetProp":
        applyWidgetProp(project, session, action, queue);
        break;
      case "selectNext":
        updateSelectedIndex(project, session, action.widgetId, 1, queue);
        break;
      case "selectPrev":
        updateSelectedIndex(project, session, action.widgetId, -1, queue);
        break;
      case "focusNext":
        if (action.widgetId) {
          updateTextFocus(project, session, action.widgetId, 1, queue);
        } else {
          const nextFocusId = cycleFocus(project, session, 1);
          if (nextFocusId && nextFocusId !== session.focusedWidgetId) {
            session.focusedWidgetId = nextFocusId;
            pushEvent(queue, { kind: "onWidgetFocus", widgetId: nextFocusId });
            logEvent(session, `focus ${nextFocusId}`);
          }
        }
        break;
      case "focusPrev":
        if (action.widgetId) {
          updateTextFocus(project, session, action.widgetId, -1, queue);
        } else {
          const nextFocusId = cycleFocus(project, session, -1);
          if (nextFocusId && nextFocusId !== session.focusedWidgetId) {
            session.focusedWidgetId = nextFocusId;
            pushEvent(queue, { kind: "onWidgetFocus", widgetId: nextFocusId });
            logEvent(session, `focus ${nextFocusId}`);
          }
        }
        break;
      case "pushGraphValue":
        pushGraphValue(project, session, action);
        break;
      case "clearGraphBuffer":
        if (session.graphBuffers[action.widgetId]) {
          session.graphBuffers[action.widgetId] = [];
          logEvent(session, `clear graph ${action.widgetId}`);
        }
        break;
      case "showNotice": {
        const runtime = session.widgetRuntimeState[action.widgetId];
        if (runtime) {
          runtime.visible = true;
          if (typeof action.text === "string") {
            runtime.noticeText = action.text;
          } else if (action.fromVariableId) {
            runtime.noticeText = String(session.variableStore[action.fromVariableId] ?? "");
          }
        }
        break;
      }
      case "hideNotice": {
        const runtime = session.widgetRuntimeState[action.widgetId];
        if (runtime) {
          runtime.visible = false;
        }
        break;
      }
      case "startTimer":
        if (session.timerRuntimeState[action.timerId]) {
          session.timerRuntimeState[action.timerId].enabled = true;
          session.timerRuntimeState[action.timerId].lastTickMs = session.clockMs;
        }
        break;
      case "stopTimer":
        if (session.timerRuntimeState[action.timerId]) {
          session.timerRuntimeState[action.timerId].enabled = false;
        }
        break;
      case "toggleBool": {
        const current = session.variableStore[action.variableId];
        setVariable(project, session, action.variableId, !Boolean(current), queue);
        break;
      }
      case "textCharNext":
        rotateTextCharacter(project, session, action.widgetId, 1, queue);
        break;
      case "textCharPrev":
        rotateTextCharacter(project, session, action.widgetId, -1, queue);
        break;
    }
  }
}

function processEventQueue(
  project: ProjectDocument,
  session: SimulatorSession,
  seedEvents: RuntimeEvent[],
): SimulatorSession {
  const next = structuredClone(session) as SimulatorSession;
  const queue = [...seedEvents];
  let depth = 0;

  while (queue.length > 0 && depth < MAX_EVENT_DEPTH) {
    const runtimeEvent = queue.shift()!;
    depth += 1;
    logEvent(next, runtimeEvent.kind);

    const rules = project.rules.filter((rule) => rule.pictureId === next.currentPictureId);
    for (const rule of rules) {
      if (!matchEvent(rule.event, runtimeEvent)) {
        continue;
      }

      if (!evaluateCondition(project, next, rule.condition)) {
        continue;
      }

      logEvent(next, `rule ${rule.id}`);
      executeActions(project, next, rule.actions, queue);

      if (rule.stopAfterMatch) {
        break;
      }
    }
  }

  return next;
}

function initialVariableStore(project: ProjectDocument): Record<string, VariableValue> {
  return Object.fromEntries(
    project.variables.map((variable) => [variable.id, variable.initial]),
  );
}

function initialWidgetRuntimeState(project: ProjectDocument): SimulatorSession["widgetRuntimeState"] {
  const state: SimulatorSession["widgetRuntimeState"] = {};
  project.pictures.forEach((picture) => {
    picture.widgets.forEach((widget) => {
      state[widget.id] = getWidgetRuntime(widget);
      if (widget.type === "textVariableBox") {
        setTextViewport(widget, state[widget.id]);
      }
    });
  });
  return state;
}

function handleVariableBoxKey(
  project: ProjectDocument,
  session: SimulatorSession,
  key: AbstractKey,
): boolean {
  if (session.currentPictureId !== "pic_variable_box") {
    return false;
  }

  const widgetMap = getCurrentPictureWidgetMap(project, session.currentPictureId);
  const notice = widgetMap.get("w_var_notice");
  const title = widgetMap.get("w_var_title");
  const textBox = widgetMap.get("w_var_text");
  if (!notice) {
    return false;
  }

  const noticeRuntime = session.widgetRuntimeState[notice.id];
  const countdown = noticeRuntime.noticeCountdown ?? 0;
  if (countdown > 0) {
    if (key === "space") {
      noticeRuntime.noticeCountdown = 0;
      setVariableBoxHelpState(project, session, false);
      return true;
    }

    return false;
  }

  if (key === "enter" && session.focusedWidgetId === textBox?.id && title?.type === "textLabel" && textBox?.type === "textVariableBox") {
    const text = String(session.variableStore[textBox.props.textVarId ?? ""] ?? title.props.text);
    session.widgetRuntimeState[title.id].titleOverride = text;
    return true;
  }

  return false;
}

function initialTimerRuntimeState(project: ProjectDocument): SimulatorSession["timerRuntimeState"] {
  return Object.fromEntries(
    project.timers.map((timer) => [
      timer.id,
      { enabled: timer.enabledOnStart, lastTickMs: 0 },
    ]),
  );
}

export function createSimulatorSession(project: ProjectDocument, wallClockMs = Date.now()): SimulatorSession {
  const startPictureId =
    findPicture(project, project.simulator.startPictureId)?.id ?? project.pictures[0]?.id ?? "";

  const seed: SimulatorSession = {
    clockMs: 0,
    lastWallClockMs: wallClockMs,
    currentPictureId: startPictureId,
    pictureHistoryStack: [],
    variableStore: initialVariableStore(project),
    widgetRuntimeState: initialWidgetRuntimeState(project),
    timerRuntimeState: initialTimerRuntimeState(project),
    focusedWidgetId: null,
    graphBuffers: {},
    eventLog: [],
  };

  seed.focusedWidgetId = firstFocusableWidgetId(project, seed, startPictureId);
  const picture = findPicture(project, startPictureId);
  if (picture) {
    const queue: RuntimeEvent[] = [];
    const next = structuredClone(seed) as SimulatorSession;
    executeActions(project, next, picture.enterActions, queue);
    return processEventQueue(project, next, queue);
  }

  return seed;
}

export function dispatchSimulatorKey(
  project: ProjectDocument,
  session: SimulatorSession,
  key: AbstractKey,
): SimulatorSession {
  const picture = findPicture(project, session.currentPictureId);
  const next = structuredClone(session) as SimulatorSession;
  const queue: RuntimeEvent[] = [];

  const focusedWidget = next.focusedWidgetId ? findWidget(project, next.focusedWidgetId) : undefined;
  const widgetId = next.focusedWidgetId ?? undefined;

  if (handleVariableBoxKey(project, next, key)) {
    return next;
  }

  if (focusedWidget?.type === "curve") {
    let handled = false;

    switch (key) {
      case "tab":
        handled = cycleCurveFocus(project, next, focusedWidget.id);
        break;
      case "up":
        handled = moveCurvePoint(project, next, focusedWidget.id, 0, 1);
        break;
      case "down":
        handled = moveCurvePoint(project, next, focusedWidget.id, 0, -1);
        break;
      case "left":
        handled =
          moveCurvePoint(project, next, focusedWidget.id, -1, 0) ||
          moveCurveArgument(project, next, focusedWidget.id, -1);
        break;
      case "right":
        handled =
          moveCurvePoint(project, next, focusedWidget.id, 1, 0) ||
          moveCurveArgument(project, next, focusedWidget.id, 1);
        break;
      case "insert":
        handled = insertCurvePoint(project, next, focusedWidget.id, false);
        break;
      case "delete":
        handled = deleteCurvePoint(project, next, focusedWidget.id);
        break;
      case "shiftInsert":
        handled = insertCurvePoint(project, next, focusedWidget.id, true);
        break;
      default:
        break;
    }

    if (handled) {
      return next;
    }
  }

  if (focusedWidget?.type === "list") {
    let handled = false;

    switch (key) {
      case "plus":
        handled = cycleListLayout(project, next, focusedWidget.id, 1);
        break;
      case "minus":
        handled = cycleListLayout(project, next, focusedWidget.id, -1);
        break;
      case "insert":
        handled = insertListItem(project, next, focusedWidget.id, "before");
        break;
      case "home":
        handled = insertListItem(project, next, focusedWidget.id, "start");
        break;
      case "end":
        handled = insertListItem(project, next, focusedWidget.id, "end");
        break;
      case "delete":
        handled = removeListItem(project, next, focusedWidget.id);
        break;
      default:
        break;
    }

    if (handled) {
      return next;
    }
  }

  const activeMenu = getActiveMenuWidget(project, next);
  if (activeMenu) {
    let handled = false;

    switch (key) {
      case "up":
        handled = updateSelectedIndex(project, next, activeMenu.id, -1, queue);
        break;
      case "down":
        handled = updateSelectedIndex(project, next, activeMenu.id, 1, queue);
        break;
      case "enter":
        handled = openMenuChild(project, next, activeMenu);
        break;
      case "esc":
        handled = activeMenu.props.popupParentWidgetId
          ? closeMenuPopup(project, next, activeMenu)
          : false;
        break;
      default:
        break;
    }

    if (handled) {
      return next;
    }
  }

  pushEvent(queue, { kind: "onKeyPress", key, widgetId });

  if (key === "enter" && widgetId) {
    pushEvent(queue, { kind: "onWidgetConfirm", widgetId });
  }

  if (key === "tab" && !widgetId && picture) {
    const fallbackFocusId = firstFocusableWidgetId(project, next, picture.id);
    if (fallbackFocusId) {
      pushEvent(queue, { kind: "onWidgetFocus", widgetId: fallbackFocusId });
    }
  }

  return processEventQueue(project, next, queue);
}

export function advanceSimulatorClock(
  project: ProjectDocument,
  session: SimulatorSession,
  wallClockMs: number,
): SimulatorSession {
  const elapsed = Math.max(0, wallClockMs - session.lastWallClockMs);
  const next = structuredClone(session) as SimulatorSession;
  next.lastWallClockMs = wallClockMs;
  next.clockMs += elapsed;

  const queue: RuntimeEvent[] = [];

  project.timers.forEach((timer) => {
    const runtime = next.timerRuntimeState[timer.id];
    if (!runtime?.enabled) {
      return;
    }

    if (timer.targetPictureId && timer.targetPictureId !== next.currentPictureId) {
      return;
    }

    while (next.clockMs - runtime.lastTickMs >= timer.intervalMs) {
      runtime.lastTickMs += timer.intervalMs;
      pushEvent(queue, { kind: "onTimer", timerId: timer.id });
      if (!timer.repeat) {
        runtime.enabled = false;
        break;
      }
    }
  });

  if (next.currentPictureId === "pic_variable_box") {
    const widgetMap = getCurrentPictureWidgetMap(project, next.currentPictureId);
    const notice = widgetMap.get("w_var_notice");
    if (notice) {
      const runtime = next.widgetRuntimeState[notice.id];
      const countdown = runtime.noticeCountdown ?? 0;
      if (countdown > 0) {
        const elapsedSeconds = Math.floor(next.clockMs / 1000) - Math.floor(session.clockMs / 1000);
        if (elapsedSeconds > 0) {
          runtime.noticeCountdown = Math.max(0, countdown - elapsedSeconds);
          if (runtime.noticeCountdown === 0) {
            setVariableBoxHelpState(project, next, false);
          }
        }
      }
    }
  }

  if (next.currentPictureId === "pic_polar_coordinates") {
    const previousSecond = Math.floor(session.clockMs / 1000);
    const currentSecond = Math.floor(next.clockMs / 1000);
    if (currentSecond !== previousSecond) {
      syncPolarClockVariables(project, next, queue);
    }
  }

  if (queue.length === 0) {
    return next;
  }

  return processEventQueue(project, next, queue);
}
