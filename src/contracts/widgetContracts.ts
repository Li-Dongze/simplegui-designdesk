import type { ChoiceItem, Widget, WidgetType } from "@/types/project";

export type WidgetContractCategory =
  | "navigation"
  | "display"
  | "input"
  | "graphics"
  | "data";

export type WidgetInspectorSelectSource =
  | "fonts"
  | "alignments"
  | "drawModes"
  | "shapeKinds"
  | "directions"
  | "timeSources"
  | "charSets"
  | "pictures"
  | "variables"
  | "resources"
  | "widgets";

export type WidgetBindingSourceKind = "variable" | "resource" | "widget";

export interface WidgetBindingDescriptor {
  field: string;
  role: string;
  sourceKind: WidgetBindingSourceKind;
  sourceId: string | null;
  required: boolean;
}

export interface WidgetInspectorGroup {
  title: string;
  description?: string;
  fields: WidgetInspectorField[];
}

export interface WidgetInspectorTextField {
  kind: "text";
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
}

export interface WidgetInspectorNumberField {
  kind: "number";
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
}

export interface WidgetInspectorBooleanField {
  kind: "boolean";
  key: string;
  label: string;
  help?: string;
}

export interface WidgetInspectorSelectField {
  kind: "select";
  key: string;
  label: string;
  source: WidgetInspectorSelectSource;
  allowEmpty?: boolean;
  emptyLabel?: string;
  help?: string;
}

export interface WidgetInspectorReadonlyField {
  kind: "readonly";
  key: string;
  label: string;
  format?: "text" | "json";
  help?: string;
}

export interface WidgetInspectorChoiceItemsField {
  kind: "choice-items";
  key: "items";
  label: string;
  help?: string;
}

export interface WidgetInspectorCurvePointsField {
  kind: "curve-points";
  key: "points";
  label: string;
  help?: string;
}

export type WidgetInspectorField =
  | WidgetInspectorTextField
  | WidgetInspectorNumberField
  | WidgetInspectorBooleanField
  | WidgetInspectorSelectField
  | WidgetInspectorReadonlyField
  | WidgetInspectorChoiceItemsField
  | WidgetInspectorCurvePointsField;

export interface WidgetContract<T extends WidgetType = WidgetType> {
  type: T;
  label: string;
  summary: string;
  category: WidgetContractCategory;
  simpleGuiFamily: string;
  runtimeFeatures: string[];
  collectBindings: (widget: Extract<Widget, { type: T }>) => WidgetBindingDescriptor[];
  describe: (widget: Extract<Widget, { type: T }>) => string;
  inspectorGroups: (widget: Extract<Widget, { type: T }>) => WidgetInspectorGroup[];
}

type WidgetOf<T extends WidgetType> = Extract<Widget, { type: T }>;
type WidgetContractMap = { [K in WidgetType]: WidgetContract<K> };

function variableBinding(
  field: string,
  role: string,
  sourceId: string | null,
  required: boolean,
): WidgetBindingDescriptor {
  return {
    field,
    role,
    sourceKind: "variable",
    sourceId,
    required,
  };
}

function resourceBinding(
  field: string,
  role: string,
  sourceId: string | null,
  required: boolean,
): WidgetBindingDescriptor {
  return {
    field,
    role,
    sourceKind: "resource",
    sourceId,
    required,
  };
}

function widgetBinding(
  field: string,
  role: string,
  sourceId: string | null,
  required: boolean,
): WidgetBindingDescriptor {
  return {
    field,
    role,
    sourceKind: "widget",
    sourceId,
    required,
  };
}

function collectDynamicTextBindings(items: ChoiceItem[], fieldPrefix: string): WidgetBindingDescriptor[] {
  return items.flatMap((item, index) =>
    item.dynamicTextVarId
      ? [
          variableBinding(
            `${fieldPrefix}[${index}].dynamicTextVarId`,
            "dynamicText",
            item.dynamicTextVarId,
            false,
          ),
        ]
      : [],
  );
}

function section(title: string, fields: WidgetInspectorField[], description?: string): WidgetInspectorGroup {
  return { title, description, fields };
}

function textField(
  key: string,
  label: string,
  options?: Pick<WidgetInspectorTextField, "placeholder" | "help">,
): WidgetInspectorTextField {
  return { kind: "text", key, label, ...options };
}

function numberField(
  key: string,
  label: string,
  options?: Pick<WidgetInspectorNumberField, "min" | "max" | "step" | "help">,
): WidgetInspectorNumberField {
  return { kind: "number", key, label, ...options };
}

function booleanField(
  key: string,
  label: string,
  options?: Pick<WidgetInspectorBooleanField, "help">,
): WidgetInspectorBooleanField {
  return { kind: "boolean", key, label, ...options };
}

function selectField(
  key: string,
  label: string,
  source: WidgetInspectorSelectSource,
  options?: Pick<WidgetInspectorSelectField, "allowEmpty" | "emptyLabel" | "help">,
): WidgetInspectorSelectField {
  return { kind: "select", key, label, source, ...options };
}

function choiceItemsField(
  key: "items",
  label: string,
  options?: Pick<WidgetInspectorChoiceItemsField, "help">,
): WidgetInspectorChoiceItemsField {
  return { kind: "choice-items", key, label, ...options };
}

function curvePointsField(
  key: "points",
  label: string,
  options?: Pick<WidgetInspectorCurvePointsField, "help">,
): WidgetInspectorCurvePointsField {
  return { kind: "curve-points", key, label, ...options };
}

const widgetContractMap = {
  list: {
    type: "list",
    label: "列表",
    summary: "可滚动的选项列表，支持动态文本绑定。",
    category: "navigation",
    simpleGuiFamily: "SGUI_List",
    runtimeFeatures: ["selectedIndex", "runtimeItems", "layoutRect"],
    collectBindings(widget: WidgetOf<"list">) {
      return collectDynamicTextBindings(widget.props.items, "items");
    },
    describe(widget: WidgetOf<"list">) {
      return `title="${widget.props.title}" items=${widget.props.items.length} scrollbar=${widget.props.showScrollbar ? "on" : "off"}`;
    },
    inspectorGroups() {
      return [
        section("基础", [
          textField("title", "标题"),
          selectField("font", "字体", "fonts"),
          numberField("selectedIndex", "默认选中", { min: 0 }),
          booleanField("showScrollbar", "显示滚动条"),
        ]),
        section("条目", [choiceItemsField("items", "列表项", { help: "可直接编辑条目文本，也可绑定变量动态显示。" })]),
      ];
    },
  },
  menu: {
    type: "menu",
    label: "菜单",
    summary: "弹出式菜单，支持父级菜单关联。",
    category: "navigation",
    simpleGuiFamily: "SGUI_Menu",
    runtimeFeatures: ["selectedIndex", "runtimeItems", "popupRect"],
    collectBindings(widget: WidgetOf<"menu">) {
      return [
        ...collectDynamicTextBindings(widget.props.items, "items"),
        widgetBinding("popupParentWidgetId", "popupParent", widget.props.popupParentWidgetId, false),
      ];
    },
    describe(widget: WidgetOf<"menu">) {
      return `items=${widget.props.items.length} frame=${widget.props.frame ? "on" : "off"} popup=${widget.props.popupParentWidgetId ? "child" : "root"}`;
    },
    inspectorGroups() {
      return [
        section("基础", [
          selectField("font", "字体", "fonts"),
          numberField("selectedIndex", "默认选中", { min: 0 }),
          booleanField("frame", "显示边框"),
          selectField("popupParentWidgetId", "父级控件", "widgets", {
            allowEmpty: true,
            emptyLabel: "无父级",
          }),
        ]),
        section("条目", [choiceItemsField("items", "菜单项", { help: "菜单支持动态文本绑定，适合做多级菜单。" })]),
      ];
    },
  },
  notice: {
    type: "notice",
    label: "提示框",
    summary: "用于显示图标与提示文案的弹窗控件。",
    category: "display",
    simpleGuiFamily: "SGUI_Notice",
    runtimeFeatures: ["visible", "noticeText", "countdown"],
    collectBindings(widget: WidgetOf<"notice">) {
      return [resourceBinding("iconResourceId", "icon", widget.props.iconResourceId, false)];
    },
    describe(widget: WidgetOf<"notice">) {
      return `text="${widget.props.text}" icon=${widget.props.iconResourceId ?? "none"} autoFit=${widget.props.autoFit ? "on" : "off"}`;
    },
    inspectorGroups() {
      return [
        section("内容", [
          textField("text", "提示文案"),
          selectField("font", "字体", "fonts"),
          numberField("textOffset", "文本偏移", { min: -32, max: 32, step: 1 }),
          booleanField("autoFit", "自动适配"),
          booleanField("frame", "显示边框"),
        ]),
        section("图标绑定", [
          selectField("iconResourceId", "图标资源", "resources", {
            allowEmpty: true,
            emptyLabel: "未绑定图标",
          }),
        ]),
      ];
    },
  },
  textLabel: {
    type: "textLabel",
    label: "文本",
    summary: "静态或变量驱动的文本显示控件。",
    category: "display",
    simpleGuiFamily: "SGUI_Text",
    runtimeFeatures: ["titleOverride"],
    collectBindings(widget: WidgetOf<"textLabel">) {
      return [variableBinding("textVarId", "text", widget.props.textVarId, false)];
    },
    describe(widget: WidgetOf<"textLabel">) {
      return `text="${widget.props.text}" font=${widget.props.font} mode=${widget.props.drawMode}`;
    },
    inspectorGroups() {
      return [
        section("文本", [
          textField("text", "文本内容"),
          selectField("font", "字体", "fonts"),
          selectField("drawMode", "绘制模式", "drawModes"),
          booleanField("multiline", "多行显示"),
          selectField("align", "对齐", "alignments"),
          selectField("textVarId", "文本变量", "variables", {
            allowEmpty: true,
            emptyLabel: "不绑定变量",
          }),
        ]),
      ];
    },
  },
  shape: {
    type: "shape",
    label: "图形",
    summary: "基础图元，适合矩形、圆形和线段。",
    category: "graphics",
    simpleGuiFamily: "SGUI_Basic",
    runtimeFeatures: [],
    collectBindings() {
      return [];
    },
    describe(widget: WidgetOf<"shape">) {
      return `kind=${widget.props.kind} fill=${widget.props.fill ? "on" : "off"} radius=${widget.props.radius}`;
    },
    inspectorGroups() {
      return [
        section("图形", [
          selectField("kind", "形状", "shapeKinds"),
          booleanField("fill", "填充"),
          numberField("radius", "圆角半径", { min: 0, max: 32, step: 1 }),
        ]),
      ];
    },
  },
  numberVariableBox: {
    type: "numberVariableBox",
    label: "数值框",
    summary: "支持与变量绑定的数字输入框。",
    category: "input",
    simpleGuiFamily: "SGUI_NumberVariableBox",
    runtimeFeatures: ["focusInvert", "valueBinding"],
    collectBindings(widget: WidgetOf<"numberVariableBox">) {
      return [variableBinding("valueVarId", "value", widget.props.valueVarId, false)];
    },
    describe(widget: WidgetOf<"numberVariableBox">) {
      return `var=${widget.props.valueVarId ?? "none"} range=${widget.props.min}..${widget.props.max} step=${widget.props.step}`;
    },
    inspectorGroups() {
      return [
        section("输入", [
          selectField("valueVarId", "绑定变量", "variables", {
            allowEmpty: true,
            emptyLabel: "未绑定变量",
          }),
          selectField("font", "字体", "fonts"),
          selectField("alignment", "对齐", "alignments"),
          numberField("min", "最小值"),
          numberField("max", "最大值"),
          numberField("step", "步进", { min: 1, step: 1 }),
        ]),
      ];
    },
  },
  textVariableBox: {
    type: "textVariableBox",
    label: "文本框",
    summary: "按字符编辑的文本输入框。",
    category: "input",
    simpleGuiFamily: "SGUI_TextVariableBox",
    runtimeFeatures: ["focusIndex", "textViewport", "maskChar"],
    collectBindings(widget: WidgetOf<"textVariableBox">) {
      return [variableBinding("textVarId", "text", widget.props.textVarId, false)];
    },
    describe(widget: WidgetOf<"textVariableBox">) {
      return `var=${widget.props.textVarId ?? "none"} length=${widget.props.length} mask=${widget.props.maskChar ?? "none"}`;
    },
    inspectorGroups() {
      return [
        section("输入", [
          selectField("textVarId", "绑定变量", "variables", {
            allowEmpty: true,
            emptyLabel: "未绑定变量",
          }),
          selectField("font", "字体", "fonts"),
          numberField("length", "长度", { min: 1, max: 64, step: 1 }),
          selectField("charSet", "字符集", "charSets"),
          textField("maskChar", "掩码字符", { placeholder: "*" }),
          numberField("focusIndex", "焦点位置", { min: 0, max: 63, step: 1 }),
        ]),
      ];
    },
  },
  realtimeGraph: {
    type: "realtimeGraph",
    label: "实时曲线",
    summary: "实时采样数据折线图。",
    category: "data",
    simpleGuiFamily: "SGUI_RealtimeGraph",
    runtimeFeatures: ["graphBuffer", "baseline"],
    collectBindings(widget: WidgetOf<"realtimeGraph">) {
      return [variableBinding("valueVarId", "value", widget.props.valueVarId, false)];
    },
    describe(widget: WidgetOf<"realtimeGraph">) {
      return `var=${widget.props.valueVarId ?? "none"} range=${widget.props.min}..${widget.props.max} capacity=${widget.props.capacity}`;
    },
    inspectorGroups() {
      return [
        section("数据", [
          selectField("valueVarId", "绑定变量", "variables", {
            allowEmpty: true,
            emptyLabel: "未绑定变量",
          }),
          numberField("min", "最小值"),
          numberField("max", "最大值"),
          numberField("xStepPixel", "每步像素", { min: 1, max: 16, step: 1 }),
          booleanField("enableBaseline", "显示基准线"),
          numberField("baselineValue", "基准值"),
          numberField("capacity", "缓存容量", { min: 4, max: 256, step: 1 }),
        ]),
      ];
    },
  },
  processBar: {
    type: "processBar",
    label: "进度条",
    summary: "可横向或纵向显示进度的条形控件。",
    category: "data",
    simpleGuiFamily: "SGUI_ProcessBar",
    runtimeFeatures: ["valueBinding"],
    collectBindings(widget: WidgetOf<"processBar">) {
      return [variableBinding("valueVarId", "value", widget.props.valueVarId, false)];
    },
    describe(widget: WidgetOf<"processBar">) {
      return `var=${widget.props.valueVarId ?? "none"} max=${widget.props.maxValue} direction=${widget.props.direction}`;
    },
    inspectorGroups() {
      return [
        section("数据", [
          selectField("valueVarId", "绑定变量", "variables", {
            allowEmpty: true,
            emptyLabel: "未绑定变量",
          }),
          numberField("maxValue", "最大值", { min: 1, max: 10000, step: 1 }),
          selectField("direction", "方向", "directions"),
          booleanField("frame", "显示边框"),
        ]),
      ];
    },
  },
  curve: {
    type: "curve",
    label: "调节曲线",
    summary: "可编辑采样点的函数曲线控件。",
    category: "data",
    simpleGuiFamily: "SGUI_Curve",
    runtimeFeatures: ["curvePoints", "curveFocusedIndex", "curveArgumentValue"],
    collectBindings() {
      return [];
    },
    describe(widget: WidgetOf<"curve">) {
      return `points=${widget.props.points.length} x=${widget.props.xMin}..${widget.props.xMax} y=${widget.props.yMin}..${widget.props.yMax}`;
    },
    inspectorGroups() {
      return [
        section("坐标轴", [
          numberField("xMin", "X 最小值"),
          numberField("xMax", "X 最大值"),
          numberField("yMin", "Y 最小值"),
          numberField("yMax", "Y 最大值"),
          selectField("font", "字体", "fonts"),
          textField("headerText", "标题"),
          numberField("argumentValue", "当前参数值"),
        ]),
        section("曲线点", [
          curvePointsField("points", "采样点", { help: "拖动数值即可实时改变曲线形状。" }),
        ]),
      ];
    },
  },
  polarClock: {
    type: "polarClock",
    label: "极坐标时钟",
    summary: "极坐标样式的时钟显示，支持变量驱动。",
    category: "graphics",
    simpleGuiFamily: "SGUI_PolarCoordinates",
    runtimeFeatures: ["rtc", "timerDriven"],
    collectBindings(widget: WidgetOf<"polarClock">) {
      if (widget.props.timeSource !== "variables") {
        return [];
      }

      return [
        variableBinding("hourVarId", "hour", widget.props.hourVarId, true),
        variableBinding("minuteVarId", "minute", widget.props.minuteVarId, true),
        variableBinding("secondVarId", "second", widget.props.secondVarId, true),
      ];
    },
    describe(widget: WidgetOf<"polarClock">) {
      return `timeSource=${widget.props.timeSource} center=${widget.props.dialCenterX},${widget.props.dialCenterY} radius=${widget.props.radius}`;
    },
    inspectorGroups() {
      return [
        section("时钟源", [
          selectField("timeSource", "时间来源", "timeSources"),
          selectField("hourVarId", "小时变量", "variables", {
            allowEmpty: true,
            emptyLabel: "未绑定",
          }),
          selectField("minuteVarId", "分钟变量", "variables", {
            allowEmpty: true,
            emptyLabel: "未绑定",
          }),
          selectField("secondVarId", "秒变量", "variables", {
            allowEmpty: true,
            emptyLabel: "未绑定",
          }),
        ]),
        section("布局", [
          selectField("font", "字体", "fonts"),
          numberField("dialCenterX", "表盘中心 X", { min: 0, max: 127, step: 1 }),
          numberField("dialCenterY", "表盘中心 Y", { min: 0, max: 63, step: 1 }),
          numberField("radius", "半径", { min: 4, max: 64, step: 1 }),
          numberField("textX", "文字 X", { min: 0, max: 127, step: 1 }),
          numberField("textY", "文字 Y", { min: 0, max: 63, step: 1 }),
        ]),
      ];
    },
  },
} satisfies WidgetContractMap;

export const widgetCategoryLabels: Record<WidgetContractCategory, string> = {
  navigation: "导航",
  display: "显示",
  input: "输入",
  graphics: "图形",
  data: "数据",
};

export const widgetCategoryOrder: WidgetContractCategory[] = [
  "navigation",
  "display",
  "input",
  "graphics",
  "data",
];

export interface WidgetCatalogEntry {
  type: WidgetType;
  label: string;
  category: WidgetContractCategory;
  family: string;
  summary: string;
}

export const widgetCatalog: WidgetCatalogEntry[] = (
  Object.values(widgetContractMap) as WidgetContract[]
).map((contract) => ({
  type: contract.type,
  label: contract.label,
  category: contract.category,
  family: contract.simpleGuiFamily,
  summary: contract.summary,
}));

export function listWidgetContracts(): WidgetContract[] {
  return Object.values(widgetContractMap) as WidgetContract[];
}

export function getWidgetContract<T extends WidgetType>(type: T): WidgetContract<T> {
  return widgetContractMap[type] as unknown as WidgetContract<T>;
}

export function describeWidgetContract(widget: Widget): string {
  return getWidgetContract(widget.type).describe(widget as never);
}

export function collectWidgetBindings(widget: Widget): WidgetBindingDescriptor[] {
  return getWidgetContract(widget.type).collectBindings(widget as never);
}
