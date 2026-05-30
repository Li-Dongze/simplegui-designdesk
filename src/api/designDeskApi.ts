import { useProjectStore } from "@/stores/projectStore";
import { createBlankProject } from "@/schema/projectTemplates";
import { loadMonochromeBmpFromUrl } from "@/utils/bmpDecoder";
import { formatProjectDocument, parseProjectDocument } from "@/utils/projectFormat";
import { buildExportArtifact, type ExportArtifactKind } from "@/utils/simpleguiCodeExport";
import type {
  AbstractKey,
  Action,
  ChoiceItem,
  ConditionItem,
  EditorMode,
  MonoBitmap,
  Picture,
  ProjectDocument,
  RuleConditionGroup,
  RuleDefinition,
  RuleEventKind,
  ScaleOption,
  SelectionTarget,
  VariableDefinition,
  Widget,
  WidgetType,
} from "@/types/project";

export interface DesignDeskSnapshot {
  mode: EditorMode;
  scale: number;
  activePictureId: string;
  selection: SelectionTarget;
  dirty: boolean;
  projectTemplateId: "blank" | "official-demo" | "custom";
  issues: ReturnType<typeof useProjectStore.getState>["issues"];
  project: ProjectDocument;
  simulator: ReturnType<typeof useProjectStore.getState>["simulator"];
  videoOverlay: ReturnType<typeof useProjectStore.getState>["videoOverlay"];
  dinoGame: ReturnType<typeof useProjectStore.getState>["dinoGame"];
}

export interface DesignDeskApi {
  readonly version: string;
  readonly name: "SimpleGUIDesignDeskAPI";
  help: () => string[];
  snapshot: () => DesignDeskSnapshot;
  projectText: () => string;
  parseProjectText: (text: string) => ProjectDocument;
  exportArtifact: (kind: ExportArtifactKind) => ReturnType<typeof buildExportArtifact>;
  setMode: (mode: EditorMode) => void;
  setScale: (scale: number) => void;
  undo: () => void;
  redo: () => void;
  resetProject: () => void;
  loadTemplate: (templateId: "blank" | "official-demo") => void;
  loadProject: (project: ProjectDocument) => void;
  loadProjectText: (text: string) => void;
  selectProject: () => void;
  selectPicture: (pictureId: string) => void;
  selectWidget: (pictureId: string, widgetId: string) => void;
  selectRule: (pictureId: string, ruleId: string) => void;
  selectVariable: (variableId: string) => void;
  selectTimer: (timerId: string) => void;
  selectResource: (resourceId: string) => void;
  addPicture: () => void;
  duplicatePicture: (pictureId: string) => void;
  deletePicture: (pictureId: string) => void;
  updatePictureField: <K extends keyof Picture>(pictureId: string, field: K, value: Picture[K]) => void;
  addWidget: (type: WidgetType, position?: { x: number; y: number }) => void;
  duplicateWidget: (widgetId: string) => void;
  deleteWidget: (widgetId: string) => void;
  updateWidgetField: <K extends keyof Widget>(widgetId: string, field: K, value: Widget[K]) => void;
  updateWidgetRect: (widgetId: string, patch: Partial<Widget["rect"]>) => void;
  updateWidgetProp: (widgetId: string, key: string, value: unknown) => void;
  addVariable: (type: VariableDefinition["type"]) => void;
  updateVariableField: (variableId: string, key: string, value: unknown) => void;
  addTimer: () => void;
  updateTimerField: (timerId: string, key: string, value: unknown) => void;
  addResource: () => void;
  updateResourceField: (resourceId: string, key: string, value: unknown) => void;
  addRule: () => void;
  duplicateRule: (ruleId: string) => void;
  deleteRule: (ruleId: string) => void;
  updateRuleField: (ruleId: string, key: string, value: unknown) => void;
  updateRuleEventField: (ruleId: string, key: string, value: unknown) => void;
  ensureRuleCondition: (ruleId: string) => void;
  clearRuleCondition: (ruleId: string) => void;
  updateRuleConditionGroupField: (
    ruleId: string,
    key: keyof RuleConditionGroup,
    value: unknown,
  ) => void;
  addRuleConditionItem: (ruleId: string, kind?: ConditionItem["kind"]) => void;
  updateRuleConditionItemField: (
    ruleId: string,
    conditionIndex: number,
    key: string,
    value: unknown,
  ) => void;
  deleteRuleConditionItem: (ruleId: string, conditionIndex: number) => void;
  addRuleAction: (ruleId: string, actionType?: Action["type"]) => void;
  updateRuleActionField: (ruleId: string, actionIndex: number, key: string, value: unknown) => void;
  deleteRuleAction: (ruleId: string, actionIndex: number) => void;
  updateProjectField: (key: string, value: unknown) => void;
  updateScreenField: (key: string, value: unknown) => void;
  updateSimulatorField: (key: string, value: unknown) => void;
  restartSimulation: () => void;
  stopSimulation: () => void;
  sendSimulatorKey: (key: AbstractKey) => void;
  tickSimulation: (wallClockMs?: number) => void;
  startDinoGame: () => DesignDeskSnapshot;
  stopDinoGame: () => DesignDeskSnapshot;
  setRuleEventKind: (ruleId: string, kind: RuleEventKind) => void;
  buildThreeLevelMenu3x3: () => DesignDeskSnapshot;
  playIkunBmpVideo: (fps?: number) => Promise<DesignDeskSnapshot>;
  stopVideoOverlay: () => DesignDeskSnapshot;
}

function getState() {
  return useProjectStore.getState();
}

function cloneSnapshot(): DesignDeskSnapshot {
  const state = getState();
  return {
    mode: state.mode,
    scale: state.scale,
    activePictureId: state.activePictureId,
    selection: structuredClone(state.selection),
    dirty: state.dirty,
    projectTemplateId: state.projectTemplateId,
    issues: structuredClone(state.issues),
    project: structuredClone(state.project),
    simulator: state.simulator ? structuredClone(state.simulator) : null,
    videoOverlay: state.videoOverlay ? structuredClone(state.videoOverlay) : null,
    dinoGame: state.dinoGame ? structuredClone(state.dinoGame) : null,
  };
}

function helpLines(): string[] {
  return [
    "SimpleGUIDesignDeskAPI usage:",
    "1) window.SimpleGUIDesignDeskApi.snapshot()",
    "2) window.SimpleGUIDesignDeskApi.setMode('simulate')",
    "3) window.SimpleGUIDesignDeskApi.addWidget('list', { x: 4, y: 6 })",
    "4) window.SimpleGUIDesignDeskApi.sendSimulatorKey('enter')",
    "5) window.SimpleGUIDesignDeskApi.buildThreeLevelMenu3x3()",
    "6) window.SimpleGUIDesignDeskApi.playIkunBmpVideo(18)",
    "7) window.SimpleGUIDesignDeskApi.startDinoGame()",
  ];
}

function createMenuItems(baseId: string, prefix: string): ChoiceItem[] {
  return [1, 2, 3].map((index) => ({
    id: `${baseId}_${index}`,
    label: `${prefix}${index}`,
    dynamicTextVarId: null,
  }));
}

function createListPicture(
  id: string,
  name: string,
  title: string,
  itemPrefix: string,
): Picture {
  return {
    id,
    name,
    title,
    widgets: [
      {
        id: `w_${id}`,
        type: "list",
        name,
        rect: { x: 0, y: 0, width: 128, height: 64 },
        visible: true,
        enabled: true,
        focusable: true,
        zIndex: 0,
        props: {
          title,
          font: "GB2312_FZXS12",
          items: createMenuItems(`${id}_item`, itemPrefix),
          selectedIndex: 0,
          showScrollbar: false,
        },
      },
    ],
    enterActions: [],
    leaveActions: [],
  };
}

function createUpDownRules(rulePrefix: string, pictureId: string, widgetId: string): RuleDefinition[] {
  return [
    {
      id: `r_${rulePrefix}_up`,
      pictureId,
      event: { kind: "onKeyPress", key: "up", widgetId },
      actions: [{ type: "selectPrev", widgetId }],
      stopAfterMatch: true,
    },
    {
      id: `r_${rulePrefix}_down`,
      pictureId,
      event: { kind: "onKeyPress", key: "down", widgetId },
      actions: [{ type: "selectNext", widgetId }],
      stopAfterMatch: true,
    },
  ];
}

function createGotoRules(
  rulePrefix: string,
  pictureId: string,
  widgetId: string,
  targets: string[],
): RuleDefinition[] {
  return targets.map((targetPictureId, index) => ({
    id: `r_${rulePrefix}_enter_${index + 1}`,
    pictureId,
    event: { kind: "onWidgetConfirm", widgetId },
    condition: {
      mode: "all",
      items: [{ kind: "widgetSelected", widgetId, index }],
    },
    actions: [{ type: "gotoPicture", pictureId: targetPictureId }],
    stopAfterMatch: true,
  }));
}

function createBackRule(rulePrefix: string, pictureId: string): RuleDefinition {
  return {
    id: `r_${rulePrefix}_back`,
    pictureId,
    event: { kind: "onKeyPress", key: "esc" },
    actions: [{ type: "goBack" }],
    stopAfterMatch: true,
  };
}

function buildThreeLevelMenu3x3Project(): ProjectDocument {
  const project = createBlankProject();
  project.project.name = "SimpleGUI 三级菜单 3x3";
  project.resources = [];
  project.variables = [];
  project.timers = [];
  project.rules = [];
  project.pictures = [];

  const rootPictureId = "pic_l1_main";
  const rootWidgetId = `w_${rootPictureId}`;
  const level2PictureIds = [1, 2, 3].map((index) => `pic_l2_${index}`);

  project.pictures.push(
    createListPicture(rootPictureId, "Level 1 Menu", "Level 1 Menu", "L1-Item "),
  );
  project.rules.push(...createUpDownRules("l1_main", rootPictureId, rootWidgetId));
  project.rules.push(...createGotoRules("l1_main", rootPictureId, rootWidgetId, level2PictureIds));

  for (let level2Index = 1; level2Index <= 3; level2Index += 1) {
    const level2PictureId = `pic_l2_${level2Index}`;
    const level2WidgetId = `w_${level2PictureId}`;
    const level3PictureIds = [1, 2, 3].map((level3Index) => `pic_l3_${level2Index}_${level3Index}`);

    project.pictures.push(
      createListPicture(
        level2PictureId,
        `Level 2 Menu ${level2Index}`,
        `Level 2 Menu ${level2Index}`,
        `L2-${level2Index}-Item `,
      ),
    );
    project.rules.push(...createUpDownRules(`l2_${level2Index}`, level2PictureId, level2WidgetId));
    project.rules.push(createBackRule(`l2_${level2Index}`, level2PictureId));
    project.rules.push(...createGotoRules(`l2_${level2Index}`, level2PictureId, level2WidgetId, level3PictureIds));

    for (let level3Index = 1; level3Index <= 3; level3Index += 1) {
      const level3PictureId = `pic_l3_${level2Index}_${level3Index}`;
      const level3WidgetId = `w_${level3PictureId}`;
      project.pictures.push(
        createListPicture(
          level3PictureId,
          `Level 3 Menu ${level2Index}-${level3Index}`,
          `Level 3 Menu ${level2Index}-${level3Index}`,
          `L3-${level2Index}-${level3Index}-Item `,
        ),
      );
      project.rules.push(...createUpDownRules(`l3_${level2Index}_${level3Index}`, level3PictureId, level3WidgetId));
      project.rules.push(createBackRule(`l3_${level2Index}_${level3Index}`, level3PictureId));
    }
  }

  project.simulator.startPictureId = rootPictureId;
  project.simulator.keyMode = "dual";
  project.simulator.showGrid = true;
  project.simulator.fps = 20;
  project.project.updatedAt = new Date().toISOString();
  return project;
}

const IKUN_BMP_NAMES = Array.from(
  { length: 24 },
  (_, index) => `坤坤跳舞分解${String(index + 1).padStart(2, "0")}.bmp`,
);
let cachedIkunFrames: MonoBitmap[] | null = null;

async function loadIkunDanceFrames(): Promise<MonoBitmap[]> {
  if (cachedIkunFrames) {
    return cachedIkunFrames;
  }

  const frames = await Promise.all(
    IKUN_BMP_NAMES.map((fileName) =>
      loadMonochromeBmpFromUrl(`/ikun_frames/${encodeURIComponent(fileName)}`),
    ),
  );

  cachedIkunFrames = frames;
  return frames;
}

function createDesignDeskApi(): DesignDeskApi {
  return {
    version: "0.4.0",
    name: "SimpleGUIDesignDeskAPI",
    help: () => helpLines(),
    snapshot: () => cloneSnapshot(),
    projectText: () => formatProjectDocument(getState().project),
    parseProjectText: (text) => parseProjectDocument(text),
    exportArtifact: (kind) => buildExportArtifact(getState().project, kind),
    setMode: (mode) => getState().setMode(mode),
    setScale: (scale) => getState().setScale(scale as ScaleOption),
    undo: () => getState().undo(),
    redo: () => getState().redo(),
    resetProject: () => getState().resetProject(),
    loadTemplate: (templateId) => getState().loadTemplate(templateId),
    loadProject: (project) => getState().loadProject(project),
    loadProjectText: (text) => getState().loadProject(parseProjectDocument(text)),
    selectProject: () => getState().selectProject(),
    selectPicture: (pictureId) => getState().selectPicture(pictureId),
    selectWidget: (pictureId, widgetId) => getState().selectWidget(pictureId, widgetId),
    selectRule: (pictureId, ruleId) => getState().selectRule(pictureId, ruleId),
    selectVariable: (variableId) => getState().selectVariable(variableId),
    selectTimer: (timerId) => getState().selectTimer(timerId),
    selectResource: (resourceId) => getState().selectResource(resourceId),
    addPicture: () => getState().addPicture(),
    duplicatePicture: (pictureId) => getState().duplicatePicture(pictureId),
    deletePicture: (pictureId) => getState().deletePicture(pictureId),
    updatePictureField: (pictureId, field, value) => getState().updatePictureField(pictureId, field, value),
    addWidget: (type, position) => getState().addWidget(type, position),
    duplicateWidget: (widgetId) => getState().duplicateWidget(widgetId),
    deleteWidget: (widgetId) => getState().deleteWidget(widgetId),
    updateWidgetField: (widgetId, field, value) => getState().updateWidgetField(widgetId, field, value),
    updateWidgetRect: (widgetId, patch) => getState().updateWidgetRect(widgetId, patch),
    updateWidgetProp: (widgetId, key, value) => getState().updateWidgetProp(widgetId, key, value),
    addVariable: (type) => getState().addVariable(type),
    updateVariableField: (variableId, key, value) => getState().updateVariableField(variableId, key, value),
    addTimer: () => getState().addTimer(),
    updateTimerField: (timerId, key, value) => getState().updateTimerField(timerId, key, value),
    addResource: () => getState().addResource(),
    updateResourceField: (resourceId, key, value) => getState().updateResourceField(resourceId, key, value),
    addRule: () => getState().addRule(),
    duplicateRule: (ruleId) => getState().duplicateRule(ruleId),
    deleteRule: (ruleId) => getState().deleteRule(ruleId),
    updateRuleField: (ruleId, key, value) => getState().updateRuleField(ruleId, key, value),
    updateRuleEventField: (ruleId, key, value) => getState().updateRuleEventField(ruleId, key, value),
    ensureRuleCondition: (ruleId) => getState().ensureRuleCondition(ruleId),
    clearRuleCondition: (ruleId) => getState().clearRuleCondition(ruleId),
    updateRuleConditionGroupField: (ruleId, key, value) =>
      getState().updateRuleConditionGroupField(ruleId, key, value),
    addRuleConditionItem: (ruleId, kind) => getState().addRuleConditionItem(ruleId, kind),
    updateRuleConditionItemField: (ruleId, conditionIndex, key, value) =>
      getState().updateRuleConditionItemField(ruleId, conditionIndex, key, value),
    deleteRuleConditionItem: (ruleId, conditionIndex) =>
      getState().deleteRuleConditionItem(ruleId, conditionIndex),
    addRuleAction: (ruleId, actionType) => getState().addRuleAction(ruleId, actionType),
    updateRuleActionField: (ruleId, actionIndex, key, value) =>
      getState().updateRuleActionField(ruleId, actionIndex, key, value),
    deleteRuleAction: (ruleId, actionIndex) => getState().deleteRuleAction(ruleId, actionIndex),
    updateProjectField: (key, value) => getState().updateProjectField(key, value),
    updateScreenField: (key, value) => getState().updateScreenField(key, value),
    updateSimulatorField: (key, value) => getState().updateSimulatorField(key, value),
    restartSimulation: () => getState().restartSimulation(),
    stopSimulation: () => getState().stopSimulation(),
    sendSimulatorKey: (key) => getState().sendSimulatorKey(key),
    tickSimulation: (wallClockMs) => getState().tickSimulation(wallClockMs),
    startDinoGame: () => {
      getState().startDinoGame();
      return cloneSnapshot();
    },
    stopDinoGame: () => {
      getState().stopDinoGame();
      return cloneSnapshot();
    },
    setRuleEventKind: (ruleId, kind) => getState().updateRuleEventField(ruleId, "kind", kind),
    buildThreeLevelMenu3x3: () => {
      const project = buildThreeLevelMenu3x3Project();
      getState().loadProject(project);
      getState().setMode("simulate");
      return cloneSnapshot();
    },
    playIkunBmpVideo: async (fps = 18) => {
      const frames = await loadIkunDanceFrames();
      getState().loadTemplate("blank");
      getState().startVideoOverlay({
        name: "IKUN BMP Dance",
        frames,
        fps: Math.max(1, Math.round(fps)),
        loop: true,
      });
      return cloneSnapshot();
    },
    stopVideoOverlay: () => {
      getState().stopVideoOverlay();
      return cloneSnapshot();
    },
  };
}

const api = createDesignDeskApi();

export function installDesignDeskApi(): void {
  window.SimpleGUIDesignDeskApi = api;
}

declare global {
  interface Window {
    SimpleGUIDesignDeskApi: DesignDeskApi;
  }
}
