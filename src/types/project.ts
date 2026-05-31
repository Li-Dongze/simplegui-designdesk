export type EditorMode = "edit" | "simulate";
export type DebugPanelKind = "none" | "pid";

export type ScaleOption = number;

export type WidgetType =
  | "list"
  | "menu"
  | "notice"
  | "textLabel"
  | "shape"
  | "numberVariableBox"
  | "textVariableBox"
  | "realtimeGraph"
  | "processBar"
  | "curve"
  | "polarClock";

export type VariableType = "int" | "bool" | "string";

export type AbstractKey =
  | "up"
  | "down"
  | "left"
  | "right"
  | "enter"
  | "esc"
  | "tab"
  | "space"
  | "insert"
  | "shiftInsert"
  | "delete"
  | "home"
  | "plus"
  | "minus"
  | "end";

export type Alignment = "left" | "center" | "right";

export type ProcessDirection = "right" | "left" | "up" | "down";

export type TextDrawMode = "normal" | "reverse";

export type ShapeKind = "rect" | "circle" | "roundedRect" | "hline" | "vline";

export type FontToken =
  | "SGUI_DEFAULT_FONT_MiniNum"
  | "SGUI_DEFAULT_FONT_8"
  | "SGUI_DEFAULT_FONT_12"
  | "SGUI_DEFAULT_FONT_16"
  | "GB2312_FZXS12";

export type RuleEventKind =
  | "onKeyPress"
  | "onTimer"
  | "onValueChange"
  | "onWidgetFocus"
  | "onWidgetSelect"
  | "onWidgetConfirm";

export type RuleConditionMode = "all" | "any";

export type ResourceKind = "bitmap" | "icon";

export type SimulatorKeyMode = "abstract" | "demoActions" | "dual";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProjectMeta {
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScreenConfig {
  width: 128;
  height: 64;
  foreground: string;
  background: string;
  buffered: boolean;
}

export interface ChoiceItem {
  id: string;
  label: string;
  dynamicTextVarId: string | null;
}

export interface ListWidgetProps {
  title: string;
  font: FontToken;
  items: ChoiceItem[];
  selectedIndex: number;
  showScrollbar: boolean;
}

export interface MenuWidgetProps {
  font: FontToken;
  items: ChoiceItem[];
  selectedIndex: number;
  frame: boolean;
  popupParentWidgetId: string | null;
}

export interface NoticeWidgetProps {
  text: string;
  font: FontToken;
  iconResourceId: string | null;
  textOffset: number;
  autoFit: boolean;
  frame: boolean;
}

export interface TextLabelProps {
  text: string;
  font: FontToken;
  drawMode: TextDrawMode;
  multiline: boolean;
  align: Alignment;
  textVarId: string | null;
}

export interface ShapeWidgetProps {
  kind: ShapeKind;
  fill: boolean;
  radius: number;
}

export interface NumberVariableBoxProps {
  font: FontToken;
  alignment: Alignment;
  min: number;
  max: number;
  valueVarId: string | null;
  step: number;
}

export interface TextVariableBoxProps {
  font: FontToken;
  textVarId: string | null;
  length: number;
  charSet: "ascii";
  maskChar: string | null;
  focusIndex: number;
}

export interface RealtimeGraphProps {
  valueVarId: string | null;
  min: number;
  max: number;
  xStepPixel: number;
  enableBaseline: boolean;
  baselineValue: number;
  capacity: number;
}

export interface ProcessBarProps {
  valueVarId: string | null;
  maxValue: number;
  direction: ProcessDirection;
  frame: boolean;
}

export interface CurvePointDefinition {
  x: number;
  y: number;
}

export interface CurveWidgetProps {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  points: CurvePointDefinition[];
  focusedIndex: number | null;
  argumentValue: number;
  font: FontToken;
  headerText: string;
}

export type PolarClockTimeSource = "system" | "variables";

export interface PolarClockProps {
  timeSource: PolarClockTimeSource;
  hourVarId: string | null;
  minuteVarId: string | null;
  secondVarId: string | null;
  font: FontToken;
  dialCenterX: number;
  dialCenterY: number;
  radius: number;
  textX: number;
  textY: number;
}

export interface WidgetPropsMap {
  list: ListWidgetProps;
  menu: MenuWidgetProps;
  notice: NoticeWidgetProps;
  textLabel: TextLabelProps;
  shape: ShapeWidgetProps;
  numberVariableBox: NumberVariableBoxProps;
  textVariableBox: TextVariableBoxProps;
  realtimeGraph: RealtimeGraphProps;
  processBar: ProcessBarProps;
  curve: CurveWidgetProps;
  polarClock: PolarClockProps;
}

export interface WidgetBase<T extends WidgetType> {
  id: string;
  type: T;
  name: string;
  rect: Rect;
  visible: boolean;
  enabled: boolean;
  focusable: boolean;
  zIndex: number;
  props: WidgetPropsMap[T];
}

export type Widget = {
  [K in WidgetType]: WidgetBase<K>;
}[WidgetType];

export interface Picture {
  id: string;
  name: string;
  title: string;
  widgets: Widget[];
  enterActions: Action[];
  leaveActions: Action[];
}

interface VariableBase<T extends VariableType, TValue> {
  id: string;
  name: string;
  type: T;
  initial: TValue;
  readonly: boolean;
}

export interface IntVariable extends VariableBase<"int", number> {
  min: number;
  max: number;
  step: number;
}

export interface BoolVariable extends VariableBase<"bool", boolean> {}

export interface StringVariable extends VariableBase<"string", string> {
  length: number;
}

export type VariableDefinition = IntVariable | BoolVariable | StringVariable;

export type VariableValue = number | boolean | string;

export interface TimerDefinition {
  id: string;
  name: string;
  intervalMs: number;
  repeat: boolean;
  enabledOnStart: boolean;
  targetPictureId: string | null;
}

export interface MonoBitmap {
  width: number;
  height: number;
  rows: string[];
}

export interface VideoOverlay {
  name: string;
  frames: MonoBitmap[];
  fps: number;
  loop: boolean;
}

export type DinoObstacleKind = "cactusSmall" | "cactusLarge" | "pterodactyl";

export interface DinoObstacleState {
  kind: DinoObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
  groupSize: number;
  gap: number;
  speedOffset: number;
  frame: number;
  frameElapsedMs: number;
}

export interface DinoCloudState {
  x: number;
  y: number;
  gap: number;
}

export interface DinoStarState {
  x: number;
  y: number;
}

export interface DinoGameOverlay {
  name: string;
  width: number;
  height: number;
  groundY: number;
  dinoX: number;
  dinoBottomY: number;
  dinoVy: number;
  duckingMs: number;
  obstacleX: number;
  obstacleWidth: number;
  obstacleHeight: number;
  speed: number;
  score: number;
  gameOver: boolean;
  rngState: number;
  runFrame: 0 | 1;
  runFrameElapsedMs: number;
  nextNightScore: number;
  nightActive: boolean;
  nightOpacity: number;
  moonX: number;
  moonPhase: number;
  groundOffset: number;
  obstacles: DinoObstacleState[];
  obstacleHistory: DinoObstacleKind[];
  clouds: DinoCloudState[];
  stars: DinoStarState[];
  drawStars: boolean;
  lastWallClockMs: number;
}

export interface ResourceDefinition {
  id: string;
  name: string;
  kind: ResourceKind;
  source: string;
  sourceDataUrl?: string;
  bitmap: MonoBitmap | null;
  threshold?: number;
}

export interface RuleEventKeyPress {
  kind: "onKeyPress";
  key: AbstractKey;
  widgetId?: string;
}

export interface RuleEventTimer {
  kind: "onTimer";
  timerId: string;
}

export interface RuleEventValueChange {
  kind: "onValueChange";
  variableId: string;
}

export interface RuleEventWidget {
  kind: "onWidgetFocus" | "onWidgetSelect" | "onWidgetConfirm";
  widgetId: string;
}

export type RuleEvent =
  | RuleEventKeyPress
  | RuleEventTimer
  | RuleEventValueChange
  | RuleEventWidget;

export interface VariableCompareCondition {
  kind: "variableCompare";
  variableId: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  value: VariableValue;
}

export interface WidgetSelectedCondition {
  kind: "widgetSelected";
  widgetId: string;
  index: number;
}

export interface WidgetVisibleCondition {
  kind: "widgetVisible";
  widgetId: string;
  visible: boolean;
}

export interface TimerEnabledCondition {
  kind: "timerEnabled";
  timerId: string;
  enabled: boolean;
}

export type ConditionItem =
  | VariableCompareCondition
  | WidgetSelectedCondition
  | WidgetVisibleCondition
  | TimerEnabledCondition;

export interface RuleConditionGroup {
  mode: RuleConditionMode;
  items: ConditionItem[];
}

export interface ActionGotoPicture {
  type: "gotoPicture";
  pictureId: string;
}

export interface ActionGoBack {
  type: "goBack";
}

export interface ActionSetVariable {
  type: "setVariable";
  variableId: string;
  value: VariableValue;
}

export interface ActionSetVariableFromVariable {
  type: "setVariableFromVariable";
  variableId: string;
  fromVariableId: string;
}

export interface ActionIncreaseVariable {
  type: "increaseVariable";
  variableId: string;
  step: number;
}

export interface ActionDecreaseVariable {
  type: "decreaseVariable";
  variableId: string;
  step: number;
}

export interface ActionAddVariableFromVariable {
  type: "addVariableFromVariable";
  variableId: string;
  fromVariableId: string;
}

export interface ActionNegateVariable {
  type: "negateVariable";
  variableId: string;
}

export interface ActionSetWidgetProp {
  type: "setWidgetProp";
  widgetId: string;
  prop: "visible" | "enabled" | "selectedIndex" | "focusIndex";
  value: VariableValue;
}

export interface ActionSelectNext {
  type: "selectNext";
  widgetId: string;
}

export interface ActionSelectPrev {
  type: "selectPrev";
  widgetId: string;
}

export interface ActionFocusNext {
  type: "focusNext";
  widgetId?: string;
}

export interface ActionFocusPrev {
  type: "focusPrev";
  widgetId?: string;
}

export interface ActionPushGraphValue {
  type: "pushGraphValue";
  widgetId: string;
  valueSource: "literal" | "fromVariable";
  value?: number;
  fromVariableId?: string;
}

export interface ActionClearGraphBuffer {
  type: "clearGraphBuffer";
  widgetId: string;
}

export interface ActionShowNotice {
  type: "showNotice";
  widgetId: string;
  text?: string;
  fromVariableId?: string;
}

export interface ActionHideNotice {
  type: "hideNotice";
  widgetId: string;
}

export interface ActionStartTimer {
  type: "startTimer";
  timerId: string;
}

export interface ActionStopTimer {
  type: "stopTimer";
  timerId: string;
}

export interface ActionToggleBool {
  type: "toggleBool";
  variableId: string;
}

export interface ActionTextCharNext {
  type: "textCharNext";
  widgetId: string;
}

export interface ActionTextCharPrev {
  type: "textCharPrev";
  widgetId: string;
}

export type Action =
  | ActionGotoPicture
  | ActionGoBack
  | ActionSetVariable
  | ActionSetVariableFromVariable
  | ActionIncreaseVariable
  | ActionDecreaseVariable
  | ActionAddVariableFromVariable
  | ActionNegateVariable
  | ActionSetWidgetProp
  | ActionSelectNext
  | ActionSelectPrev
  | ActionFocusNext
  | ActionFocusPrev
  | ActionPushGraphValue
  | ActionClearGraphBuffer
  | ActionShowNotice
  | ActionHideNotice
  | ActionStartTimer
  | ActionStopTimer
  | ActionToggleBool
  | ActionTextCharNext
  | ActionTextCharPrev;

export interface RuleDefinition {
  id: string;
  pictureId: string;
  event: RuleEvent;
  condition?: RuleConditionGroup;
  actions: Action[];
  stopAfterMatch: boolean;
}

export interface SimulatorConfig {
  startPictureId: string;
  keyMode: SimulatorKeyMode;
  showGrid: boolean;
  fps: number;
}

export interface ProjectDocument {
  version: 1;
  project: ProjectMeta;
  screen: ScreenConfig;
  resources: ResourceDefinition[];
  variables: VariableDefinition[];
  timers: TimerDefinition[];
  pictures: Picture[];
  rules: RuleDefinition[];
  simulator: SimulatorConfig;
}

export type SelectionTarget =
  | { kind: "project" }
  | { kind: "picture"; pictureId: string }
  | { kind: "widget"; pictureId: string; widgetId: string }
  | { kind: "rule"; pictureId: string; ruleId: string }
  | { kind: "variable"; variableId: string }
  | { kind: "timer"; timerId: string }
  | { kind: "resource"; resourceId: string };

export interface WidgetRuntimeState {
  visible: boolean;
  enabled: boolean;
  selectedIndex?: number;
  focusIndex?: number;
  textFirstVisibleIndex?: number;
  textLastVisibleIndex?: number;
  textOffset?: number;
  noticeText?: string;
  noticeCountdown?: number;
  listItems?: ChoiceItem[];
  listAppendUsed?: Record<string, boolean>;
  listLayoutIndex?: number;
  listLayoutRect?: Rect;
  curvePoints?: CurvePointDefinition[];
  curveFocusedIndex?: number | null;
  curveArgumentValue?: number;
  menuPopupRect?: Rect;
  titleOverride?: string;
}

export interface TimerRuntimeState {
  enabled: boolean;
  lastTickMs: number;
}

export interface SimulatorEventLogEntry {
  ts: number;
  label: string;
}

export interface PidServoModelState {
  initialized: boolean;
  integral: number;
  prevError: number;
  velocity: number;
}

export interface SimulatorSession {
  clockMs: number;
  lastWallClockMs: number;
  currentPictureId: string;
  pictureHistoryStack: string[];
  variableStore: Record<string, VariableValue>;
  widgetRuntimeState: Record<string, WidgetRuntimeState>;
  timerRuntimeState: Record<string, TimerRuntimeState>;
  focusedWidgetId: string | null;
  graphBuffers: Record<string, number[]>;
  eventLog: SimulatorEventLogEntry[];
  pidModelStates: Record<string, PidServoModelState>;
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  path: string;
  message: string;
}
