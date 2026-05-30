import { widgetCatalog } from "@/contracts/widgetContracts";
import type {
  ChoiceItem,
  Picture,
  ProjectDocument,
  ResourceDefinition,
  RuleDefinition,
  TimerDefinition,
  VariableDefinition,
  Widget,
  WidgetBase,
  WidgetPropsMap,
  WidgetType,
} from "@/types/project";

export { widgetCatalog };

const defaultChoiceItems = (base: string, count: number): ChoiceItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${base}_${index + 1}`,
    label: `${base} ${index + 1}`,
    dynamicTextVarId: null,
  }));

export function createDefaultWidgetProps<T extends WidgetType>(
  type: T,
): WidgetPropsMap[T] {
  switch (type) {
    case "list":
      return {
        title: "List",
        font: "SGUI_DEFAULT_FONT_8",
        items: defaultChoiceItems("Item", 3),
        selectedIndex: 0,
        showScrollbar: true,
      } as WidgetPropsMap[T];
    case "menu":
      return {
        font: "SGUI_DEFAULT_FONT_8",
        items: defaultChoiceItems("Menu", 2),
        selectedIndex: 0,
        frame: true,
        popupParentWidgetId: null,
      } as WidgetPropsMap[T];
    case "notice":
      return {
        text: "Notice",
        font: "SGUI_DEFAULT_FONT_8",
        iconResourceId: null,
        textOffset: 0,
        autoFit: true,
        frame: false,
      } as WidgetPropsMap[T];
    case "textLabel":
      return {
        text: "Text",
        font: "SGUI_DEFAULT_FONT_8",
        drawMode: "normal",
        multiline: false,
        align: "left",
        textVarId: null,
      } as WidgetPropsMap[T];
    case "shape":
      return {
        kind: "rect",
        fill: false,
        radius: 4,
      } as WidgetPropsMap[T];
    case "numberVariableBox":
      return {
        font: "SGUI_DEFAULT_FONT_8",
        alignment: "center",
        min: 0,
        max: 100,
        valueVarId: null,
        step: 1,
      } as WidgetPropsMap[T];
    case "textVariableBox":
      return {
        font: "SGUI_DEFAULT_FONT_12",
        textVarId: null,
        length: 8,
        charSet: "ascii",
        maskChar: null,
        focusIndex: 0,
      } as WidgetPropsMap[T];
    case "realtimeGraph":
      return {
        valueVarId: null,
        min: -100,
        max: 100,
        xStepPixel: 2,
        enableBaseline: true,
        baselineValue: 0,
        capacity: 64,
      } as WidgetPropsMap[T];
    case "processBar":
      return {
        valueVarId: null,
        maxValue: 100,
        direction: "right",
        frame: true,
      } as WidgetPropsMap[T];
    case "curve":
      return {
        xMin: -100,
        xMax: 100,
        yMin: -100,
        yMax: 100,
        points: [
          { x: -100, y: -100 },
          { x: -75, y: -100 },
          { x: 0, y: 0 },
          { x: 50, y: 25 },
          { x: 100, y: 75 },
        ],
        focusedIndex: 0,
        argumentValue: -100,
        font: "SGUI_DEFAULT_FONT_8",
        headerText: "Press TAB to change focus.",
      } as WidgetPropsMap[T];
    case "polarClock":
      return {
        timeSource: "system",
        hourVarId: null,
        minuteVarId: null,
        secondVarId: null,
        font: "SGUI_DEFAULT_FONT_12",
        dialCenterX: 31,
        dialCenterY: 31,
        radius: 28,
        textX: 75,
        textY: 25,
      } as WidgetPropsMap[T];
  }
}

const defaultRects: Record<WidgetType, Widget["rect"]> = {
  list: { x: 6, y: 6, width: 52, height: 46 },
  menu: { x: 62, y: 6, width: 60, height: 24 },
  notice: { x: 6, y: 8, width: 116, height: 20 },
  textLabel: { x: 8, y: 8, width: 112, height: 12 },
  shape: { x: 8, y: 8, width: 24, height: 12 },
  numberVariableBox: { x: 8, y: 32, width: 48, height: 10 },
  textVariableBox: { x: 8, y: 46, width: 88, height: 12 },
  realtimeGraph: { x: 0, y: 0, width: 128, height: 64 },
  processBar: { x: 8, y: 20, width: 112, height: 8 },
  curve: { x: 0, y: 0, width: 128, height: 64 },
  polarClock: { x: 0, y: 0, width: 128, height: 64 },
};

function buildWidget<T extends WidgetType>(
  type: T,
  id: string,
  name: string,
  override?: Partial<WidgetBase<T>>,
): WidgetBase<T> {
  const base: WidgetBase<T> = {
    id,
    type,
    name,
    rect: { ...defaultRects[type] },
    visible: true,
    enabled: true,
    focusable:
      type !== "processBar" &&
      type !== "realtimeGraph" &&
      type !== "notice" &&
      type !== "textLabel" &&
      type !== "shape" &&
      type !== "polarClock",
    zIndex: 0,
    props: createDefaultWidgetProps(type),
  };

  return {
    ...base,
    ...override,
    rect: {
      ...base.rect,
      ...override?.rect,
    },
    props: {
      ...base.props,
      ...(override?.props ?? {}),
    } as WidgetPropsMap[T],
  };
}

export function createWidget(
  type: WidgetType,
  id: string,
  name: string,
  override?: Partial<Widget>,
): Widget {
  switch (type) {
    case "list":
      return buildWidget(type, id, name, override as Partial<WidgetBase<"list">>);
    case "menu":
      return buildWidget(type, id, name, override as Partial<WidgetBase<"menu">>);
    case "notice":
      return buildWidget(type, id, name, override as Partial<WidgetBase<"notice">>);
    case "textLabel":
      return buildWidget(type, id, name, override as Partial<WidgetBase<"textLabel">>);
    case "shape":
      return buildWidget(type, id, name, override as Partial<WidgetBase<"shape">>);
    case "numberVariableBox":
      return buildWidget(
        type,
        id,
        name,
        override as Partial<WidgetBase<"numberVariableBox">>,
      );
    case "textVariableBox":
      return buildWidget(
        type,
        id,
        name,
        override as Partial<WidgetBase<"textVariableBox">>,
      );
    case "realtimeGraph":
      return buildWidget(
        type,
        id,
        name,
        override as Partial<WidgetBase<"realtimeGraph">>,
      );
    case "processBar":
      return buildWidget(type, id, name, override as Partial<WidgetBase<"processBar">>);
    case "curve":
      return buildWidget(type, id, name, override as Partial<WidgetBase<"curve">>);
    case "polarClock":
      return buildWidget(type, id, name, override as Partial<WidgetBase<"polarClock">>);
  }
}

export function createPicture(id: string, name: string): Picture {
  return {
    id,
    name,
    title: name,
    widgets: [],
    enterActions: [],
    leaveActions: [],
  };
}

export function createVariable(
  id: string,
  name: string,
  type: VariableDefinition["type"],
): VariableDefinition {
  switch (type) {
    case "int":
      return {
        id,
        name,
        type,
        initial: 0,
        min: 0,
        max: 100,
        step: 1,
        readonly: false,
      };
    case "bool":
      return {
        id,
        name,
        type,
        initial: false,
        readonly: false,
      };
    case "string":
      return {
        id,
        name,
        type,
        initial: "TEXT",
        length: 8,
        readonly: false,
      };
  }
}

export function createTimer(id: string, name: string, pictureId: string | null): TimerDefinition {
  return {
    id,
    name,
    intervalMs: 200,
    repeat: true,
    enabledOnStart: false,
    targetPictureId: pictureId,
  };
}

export function createResource(id: string, name: string): ResourceDefinition {
  return {
    id,
    name,
    kind: "bitmap",
    source: "",
    bitmap: null,
    threshold: 128,
  };
}

export function createRule(id: string, pictureId: string, widgetId?: string): RuleDefinition {
  return {
    id,
    pictureId,
    event: widgetId
      ? { kind: "onKeyPress", key: "enter", widgetId }
      : { kind: "onKeyPress", key: "enter" },
    actions: [],
    stopAfterMatch: true,
  };
}

export function nextId(document: ProjectDocument, prefix: string): string {
  const allIds = new Set<string>();

  document.resources.forEach((resource) => allIds.add(resource.id));
  document.variables.forEach((variable) => allIds.add(variable.id));
  document.timers.forEach((timer) => allIds.add(timer.id));
  document.pictures.forEach((picture) => {
    allIds.add(picture.id);
    picture.widgets.forEach((widget) => allIds.add(widget.id));
  });
  document.rules.forEach((rule) => allIds.add(rule.id));

  let index = 1;
  while (allIds.has(`${prefix}_${index}`)) {
    index += 1;
  }

  return `${prefix}_${index}`;
}
