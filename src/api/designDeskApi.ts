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
  theme: "light" | "dark";
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
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
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
  playWallpaperBmpVideo: (fps?: number) => Promise<DesignDeskSnapshot>;
  playBmpVideoFromFolder: (
    folderPath: string,
    fps?: number,
    overlayName?: string,
  ) => Promise<DesignDeskSnapshot>;
  playAsciiBmpVideo: (
    mode?: "plain" | "stroke",
    fps?: number,
  ) => Promise<DesignDeskSnapshot>;
  playOledExportBmpVideo: (fps?: number) => Promise<DesignDeskSnapshot>;
  stopVideoOverlay: () => DesignDeskSnapshot;
}

function getState() {
  return useProjectStore.getState();
}

function cloneSnapshot(): DesignDeskSnapshot {
  const state = getState();
  return {
    mode: state.mode,
    theme: state.theme,
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
    "3) window.SimpleGUIDesignDeskApi.toggleTheme()",
    "4) window.SimpleGUIDesignDeskApi.addWidget('list', { x: 4, y: 6 })",
    "5) window.SimpleGUIDesignDeskApi.sendSimulatorKey('enter')",
    "6) window.SimpleGUIDesignDeskApi.buildThreeLevelMenu3x3()",
    "7) window.SimpleGUIDesignDeskApi.playIkunBmpVideo(18)",
    "8) window.SimpleGUIDesignDeskApi.playWallpaperBmpVideo()",
    "9) window.SimpleGUIDesignDeskApi.playAsciiBmpVideo('plain', 12)",
    "10) window.SimpleGUIDesignDeskApi.playBmpVideoFromFolder('/ascii_frames_stroke', 12)",
    "11) window.SimpleGUIDesignDeskApi.playOledExportBmpVideo(30)",
    "12) window.SimpleGUIDesignDeskApi.startDinoGame()",
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

interface BitmapVideoManifest {
  fps?: number;
  files?: string[];
  sourceFile?: string;
  style?: string;
  generatedAt?: string;
}

type CachedBmpVideoEntry = {
  frames: MonoBitmap[];
  fps: number;
  signature: string;
};

const cachedBmpVideoByFolder = new Map<string, CachedBmpVideoEntry>();

// Legacy wallpaper cache variables kept for compatibility with existing loader function.
let cachedWallpaperFrames: MonoBitmap[] | null = null;
let cachedWallpaperFps: number | null = null;
let cachedWallpaperSignature: string | null = null;

async function loadBmpFramesWithConcurrency(
  baseUrl: string,
  files: string[],
  concurrency = 20,
  cacheTag?: string,
): Promise<MonoBitmap[]> {
  if (files.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency, files.length));
  const output: MonoBitmap[] = new Array(files.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= files.length) {
        return;
      }
      const fileName = files[current];
      const query = cacheTag ? `?v=${encodeURIComponent(cacheTag)}` : "";
      output[current] = await loadMonochromeBmpFromUrl(
        `${baseUrl}/${encodeURIComponent(fileName)}${query}`,
      );
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return output;
}

function normalizeFolderPath(folderPath: string): string {
  const trimmed = folderPath.trim();
  if (!trimmed) {
    throw new Error("BMP folder path cannot be empty.");
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlash.startsWith("/") ? withoutTrailingSlash : `/${withoutTrailingSlash}`;
}

function selectBmpFilesFromManifest(manifest: BitmapVideoManifest): string[] {
  return Array.isArray(manifest.files)
    ? manifest.files.filter((file) => typeof file === "string" && file.endsWith(".bmp"))
    : [];
}

function resolveVideoSignature(
  folderPath: string,
  manifest: BitmapVideoManifest,
  files: string[],
  fallbackFps: number,
): string {
  const generatedAt = typeof manifest.generatedAt === "string" ? manifest.generatedAt : "na";
  return `${folderPath}|${manifest.sourceFile ?? "unknown"}|${manifest.style ?? "na"}|${files.length}|${fallbackFps}|${generatedAt}`;
}

async function loadBmpVideoFromFolder(folderPath: string): Promise<{ frames: MonoBitmap[]; fps: number }> {
  const normalizedFolder = normalizeFolderPath(folderPath);
  const response = await fetch(`${normalizedFolder}/manifest.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load BMP manifest: ${normalizedFolder}/manifest.json`);
  }

  const manifest = (await response.json()) as BitmapVideoManifest;
  const files = selectBmpFilesFromManifest(manifest);
  if (files.length === 0) {
    throw new Error(`No BMP frames listed in ${normalizedFolder}/manifest.json`);
  }

  const manifestFps = Number(manifest.fps);
  const fallbackFps = Number.isFinite(manifestFps) && manifestFps > 0 ? manifestFps : 24;
  const signature = resolveVideoSignature(normalizedFolder, manifest, files, fallbackFps);
  const cached = cachedBmpVideoByFolder.get(normalizedFolder);

  if (cached && cached.signature === signature) {
    return { frames: cached.frames, fps: cached.fps };
  }

  const frames = await loadBmpFramesWithConcurrency(normalizedFolder, files, 24, signature);
  cachedBmpVideoByFolder.set(normalizedFolder, {
    frames,
    fps: fallbackFps,
    signature,
  });
  return { frames, fps: fallbackFps };
}

async function loadWallpaperFrames(): Promise<{ frames: MonoBitmap[]; fps: number }> {
  const response = await fetch("/wallpaper_frames/manifest.json");
  if (!response.ok) {
    throw new Error("加载 wallpaper manifest 失败。");
  }

  const manifest = (await response.json()) as BitmapVideoManifest;
  const files = Array.isArray(manifest.files)
    ? manifest.files.filter((file) => typeof file === "string" && file.endsWith(".bmp"))
    : [];
  if (files.length === 0) {
    throw new Error("wallpaper manifest 中没有可用的 BMP 帧。");
  }

  const manifestFps = Number(manifest.fps);
  const fallbackFps = Number.isFinite(manifestFps) && manifestFps > 0 ? manifestFps : 24;
  const generatedAt = typeof manifest.generatedAt === "string" ? manifest.generatedAt : "na";
  const signature = `${manifest.sourceFile ?? "unknown"}|${manifest.style ?? "na"}|${files.length}|${fallbackFps}|${generatedAt}`;

  if (cachedWallpaperFrames && cachedWallpaperFps && cachedWallpaperSignature === signature) {
    return { frames: cachedWallpaperFrames, fps: cachedWallpaperFps };
  }

  const frames = await loadBmpFramesWithConcurrency("/wallpaper_frames", files, 24, signature);

  cachedWallpaperFrames = frames;
  cachedWallpaperFps = fallbackFps;
  cachedWallpaperSignature = signature;
  return { frames, fps: fallbackFps };
}

function createDesignDeskApi(): DesignDeskApi {
  return {
    version: "0.6.0",
    name: "SimpleGUIDesignDeskAPI",
    help: () => helpLines(),
    snapshot: () => cloneSnapshot(),
    projectText: () => formatProjectDocument(getState().project),
    parseProjectText: (text) => parseProjectDocument(text),
    exportArtifact: (kind) => buildExportArtifact(getState().project, kind),
    setMode: (mode) => getState().setMode(mode),
    setTheme: (theme) => getState().setTheme(theme),
    toggleTheme: () => getState().toggleTheme(),
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
    playWallpaperBmpVideo: async (fps) => {
      const { frames, fps: manifestFps } = await loadWallpaperFrames();
      const playbackFps =
        typeof fps === "number" && Number.isFinite(fps) && fps > 0
          ? Math.max(1, Math.round(fps))
          : manifestFps;
      getState().loadTemplate("blank");
      getState().startVideoOverlay({
        name: "Wallpaper BMP Video",
        frames,
        fps: playbackFps,
        loop: true,
      });
      return cloneSnapshot();
    },
    playBmpVideoFromFolder: async (folderPath, fps, overlayName) => {
      const normalizedFolder = normalizeFolderPath(folderPath);
      const { frames, fps: manifestFps } = await loadBmpVideoFromFolder(normalizedFolder);
      const playbackFps =
        typeof fps === "number" && Number.isFinite(fps) && fps > 0
          ? Math.max(1, Math.round(fps))
          : manifestFps;
      const finalOverlayName =
        typeof overlayName === "string" && overlayName.trim()
          ? overlayName.trim()
          : `BMP Video ${normalizedFolder}`;
      getState().loadTemplate("blank");
      getState().startVideoOverlay({
        name: finalOverlayName,
        frames,
        fps: playbackFps,
        loop: true,
      });
      return cloneSnapshot();
    },
    playAsciiBmpVideo: async (mode = "plain", fps) => {
      const folderPath = mode === "plain" ? "/ascii_frames_plain" : "/ascii_frames_stroke";
      const { frames, fps: manifestFps } = await loadBmpVideoFromFolder(folderPath);
      const playbackFps =
        typeof fps === "number" && Number.isFinite(fps) && fps > 0
          ? Math.max(1, Math.round(fps))
          : manifestFps;
      getState().loadTemplate("blank");
      getState().startVideoOverlay({
        name: `ASCII BMP (${mode})`,
        frames,
        fps: playbackFps,
        loop: true,
      });
      return cloneSnapshot();
    },
    playOledExportBmpVideo: async (fps) => {
      const folderPath = "/oled_export_frames";
      const { frames, fps: manifestFps } = await loadBmpVideoFromFolder(folderPath);
      const playbackFps =
        typeof fps === "number" && Number.isFinite(fps) && fps > 0
          ? Math.max(1, Math.round(fps))
          : manifestFps;
      getState().loadTemplate("blank");
      getState().startVideoOverlay({
        name: "OLED Export BMP Video",
        frames,
        fps: playbackFps,
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
