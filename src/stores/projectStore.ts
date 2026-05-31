import { create } from "zustand";
import { createProjectFromTemplate } from "@/schema/projectTemplates";
import {
  createPicture,
  createResource,
  createRule,
  createTimer,
  createVariable,
  createWidget,
  nextId,
} from "@/schema/factories";
import { validateProject } from "@/schema/validators";
import {
  advanceSimulatorClock,
  createSimulatorSession,
  dispatchSimulatorKey,
  setSimulatorVariableValue as applySimulatorVariableValue,
} from "@/simulator/runtime";
import { advanceDinoGame, createDinoGameOverlay, handleDinoGameKey } from "@/utils/dinoGame";
import { cloneProjectDocument, findPicture, findWidgetPicture } from "@/utils/projectFormat";
import type {
  AbstractKey,
  Action,
  ConditionItem,
  DebugPanelKind,
  DinoGameOverlay,
  EditorMode,
  Picture,
  ProjectDocument,
  RuleConditionGroup,
  RuleEvent,
  RuleEventKind,
  ScaleOption,
  SelectionTarget,
  SimulatorSession,
  ValidationIssue,
  VariableDefinition,
  VariableValue,
  VideoOverlay,
  Widget,
  WidgetType,
} from "@/types/project";

const HISTORY_LIMIT = 100;

function defaultSelection(project: ProjectDocument): SelectionTarget {
  const activePictureId = project.simulator.startPictureId || project.pictures[0]?.id;
  if (activePictureId && project.pictures.some((picture) => picture.id === activePictureId)) {
    return { kind: "picture", pictureId: activePictureId };
  }

  return { kind: "project" };
}

function resolveActivePictureId(project: ProjectDocument, current?: string): string {
  if (current && project.pictures.some((picture) => picture.id === current)) {
    return current;
  }

  return project.simulator.startPictureId && project.pictures.some((picture) => picture.id === project.simulator.startPictureId)
    ? project.simulator.startPictureId
    : project.pictures[0]?.id ?? "";
}

function normalizeSelection(
  project: ProjectDocument,
  activePictureId: string,
  selection: SelectionTarget,
): { activePictureId: string; selection: SelectionTarget } {
  const nextActivePictureId = resolveActivePictureId(project, activePictureId);

  switch (selection.kind) {
    case "project":
      return { activePictureId: nextActivePictureId, selection };
    case "picture":
      if (project.pictures.some((picture) => picture.id === selection.pictureId)) {
        return { activePictureId: selection.pictureId, selection };
      }
      return {
        activePictureId: nextActivePictureId,
        selection: nextActivePictureId ? { kind: "picture", pictureId: nextActivePictureId } : { kind: "project" },
      };
    case "widget": {
      const picture = findPicture(project, selection.pictureId);
      if (picture?.widgets.some((widget) => widget.id === selection.widgetId)) {
        return { activePictureId: selection.pictureId, selection };
      }
      return {
        activePictureId: nextActivePictureId,
        selection: nextActivePictureId ? { kind: "picture", pictureId: nextActivePictureId } : { kind: "project" },
      };
    }
    case "rule":
      if (
        project.rules.some(
          (rule) => rule.id === selection.ruleId && rule.pictureId === selection.pictureId,
        )
      ) {
        return { activePictureId: selection.pictureId, selection };
      }
      return {
        activePictureId: nextActivePictureId,
        selection: nextActivePictureId ? { kind: "picture", pictureId: nextActivePictureId } : { kind: "project" },
      };
    case "variable":
      return project.variables.some((variable) => variable.id === selection.variableId)
        ? { activePictureId: nextActivePictureId, selection }
        : { activePictureId: nextActivePictureId, selection: { kind: "project" } };
    case "timer":
      return project.timers.some((timer) => timer.id === selection.timerId)
        ? { activePictureId: nextActivePictureId, selection }
        : { activePictureId: nextActivePictureId, selection: { kind: "project" } };
    case "resource":
      return project.resources.some((resource) => resource.id === selection.resourceId)
        ? { activePictureId: nextActivePictureId, selection }
        : { activePictureId: nextActivePictureId, selection: { kind: "project" } };
  }
}

function stampProject(project: ProjectDocument): ProjectDocument {
  return {
    ...project,
    project: {
      ...project.project,
      updatedAt: new Date().toISOString(),
    },
  };
}

function clampRect(widget: Widget): Widget {
  const width = Math.max(1, Math.min(128, Math.round(widget.rect.width)));
  const height = Math.max(1, Math.min(64, Math.round(widget.rect.height)));
  const x = Math.max(0, Math.min(128 - width, Math.round(widget.rect.x)));
  const y = Math.max(0, Math.min(64 - height, Math.round(widget.rect.y)));

  return {
    ...widget,
    rect: { x, y, width, height },
  };
}

function collectAllIds(project: ProjectDocument): Set<string> {
  const ids = new Set<string>();
  project.resources.forEach((resource) => ids.add(resource.id));
  project.variables.forEach((variable) => ids.add(variable.id));
  project.timers.forEach((timer) => ids.add(timer.id));
  project.pictures.forEach((picture) => {
    ids.add(picture.id);
    picture.widgets.forEach((widget) => ids.add(widget.id));
  });
  project.rules.forEach((rule) => ids.add(rule.id));
  return ids;
}

function allocateId(reserved: Set<string>, prefix: string): string {
  let index = 1;
  while (reserved.has(`${prefix}_${index}`)) {
    index += 1;
  }
  const value = `${prefix}_${index}`;
  reserved.add(value);
  return value;
}

function createDefaultAction(actionType: Action["type"] = "gotoPicture"): Action {
  switch (actionType) {
    case "gotoPicture":
      return { type: "gotoPicture", pictureId: "pic_main" };
    case "goBack":
      return { type: "goBack" };
    case "setVariable":
      return { type: "setVariable", variableId: "var_1", value: 0 };
    case "setVariableFromVariable":
      return { type: "setVariableFromVariable", variableId: "var_1", fromVariableId: "var_2" };
    case "increaseVariable":
      return { type: "increaseVariable", variableId: "var_1", step: 1 };
    case "decreaseVariable":
      return { type: "decreaseVariable", variableId: "var_1", step: 1 };
    case "addVariableFromVariable":
      return { type: "addVariableFromVariable", variableId: "var_1", fromVariableId: "var_2" };
    case "negateVariable":
      return { type: "negateVariable", variableId: "var_1" };
    case "setWidgetProp":
      return { type: "setWidgetProp", widgetId: "w_1", prop: "visible", value: true };
    case "selectNext":
      return { type: "selectNext", widgetId: "w_1" };
    case "selectPrev":
      return { type: "selectPrev", widgetId: "w_1" };
    case "focusNext":
      return { type: "focusNext" };
    case "focusPrev":
      return { type: "focusPrev" };
    case "pushGraphValue":
      return {
        type: "pushGraphValue",
        widgetId: "w_1",
        valueSource: "literal",
        value: 0,
      };
    case "clearGraphBuffer":
      return { type: "clearGraphBuffer", widgetId: "w_1" };
    case "showNotice":
      return { type: "showNotice", widgetId: "w_1", text: "Notice" };
    case "hideNotice":
      return { type: "hideNotice", widgetId: "w_1" };
    case "startTimer":
      return { type: "startTimer", timerId: "timer_1" };
    case "stopTimer":
      return { type: "stopTimer", timerId: "timer_1" };
    case "toggleBool":
      return { type: "toggleBool", variableId: "var_1" };
    case "textCharNext":
      return { type: "textCharNext", widgetId: "w_1" };
    case "textCharPrev":
      return { type: "textCharPrev", widgetId: "w_1" };
  }
}

function findFirstWidgetId(project: ProjectDocument, pictureId: string): string | undefined {
  return project.pictures.find((picture) => picture.id === pictureId)?.widgets[0]?.id;
}

function findFirstVariableId(project: ProjectDocument): string | undefined {
  return project.variables[0]?.id;
}

function findFirstTimerId(project: ProjectDocument): string | undefined {
  return project.timers[0]?.id;
}

function defaultEventForKind(
  project: ProjectDocument,
  pictureId: string,
  kind: RuleEventKind,
): RuleEvent {
  const widgetId = findFirstWidgetId(project, pictureId);
  const timerId = findFirstTimerId(project) ?? "timer_1";
  const variableId = findFirstVariableId(project) ?? "var_1";

  switch (kind) {
    case "onKeyPress":
      return widgetId ? { kind, key: "enter", widgetId } : { kind, key: "enter" };
    case "onTimer":
      return { kind, timerId };
    case "onValueChange":
      return { kind, variableId };
    case "onWidgetFocus":
    case "onWidgetSelect":
    case "onWidgetConfirm":
      return { kind, widgetId: widgetId ?? "w_1" };
  }
}

function defaultConditionItem(
  project: ProjectDocument,
  pictureId: string,
  kind: ConditionItem["kind"] = "variableCompare",
): ConditionItem {
  const widgetId = findFirstWidgetId(project, pictureId) ?? "w_1";
  const variableId = findFirstVariableId(project) ?? "var_1";
  const timerId = findFirstTimerId(project) ?? "timer_1";

  switch (kind) {
    case "variableCompare":
      return { kind, variableId, operator: "eq", value: 0 };
    case "widgetSelected":
      return { kind, widgetId, index: 0 };
    case "widgetVisible":
      return { kind, widgetId, visible: true };
    case "timerEnabled":
      return { kind, timerId, enabled: true };
  }
}

function coerceVariableValue(
  project: ProjectDocument,
  variableId: string | undefined,
  raw: unknown,
): VariableValue {
  const variable = variableId
    ? project.variables.find((entry) => entry.id === variableId)
    : undefined;

  if (!variable) {
    if (typeof raw === "boolean" || typeof raw === "number" || typeof raw === "string") {
      return raw;
    }
    return String(raw ?? "");
  }

  switch (variable.type) {
    case "bool":
      return raw === true || raw === "true";
    case "int": {
      const numeric = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(numeric) ? numeric : 0;
    }
    case "string":
      return String(raw ?? "").slice(0, variable.length);
  }
}

interface StoreState {
  project: ProjectDocument;
  issues: ValidationIssue[];
  dirty: boolean;
  mode: EditorMode;
  debugPanel: DebugPanelKind;
  scale: ScaleOption;
  activePictureId: string;
  projectTemplateId: "blank" | "official-demo" | "custom";
  selection: SelectionTarget;
  simulator: SimulatorSession | null;
  videoOverlay: VideoOverlay | null;
  dinoGame: DinoGameOverlay | null;
  history: ProjectDocument[];
  future: ProjectDocument[];
  setMode: (mode: EditorMode) => void;
  openDebugPanel: (panel: Exclude<DebugPanelKind, "none">) => void;
  closeDebugPanel: () => void;
  setSimulatorVariableValue: (variableId: string, value: VariableValue) => void;
  setScale: (scale: ScaleOption) => void;
  selectProject: () => void;
  selectPicture: (pictureId: string) => void;
  selectWidget: (pictureId: string, widgetId: string) => void;
  selectRule: (pictureId: string, ruleId: string) => void;
  selectVariable: (variableId: string) => void;
  selectTimer: (timerId: string) => void;
  selectResource: (resourceId: string) => void;
  resetProject: () => void;
  loadTemplate: (templateId: "blank" | "official-demo") => void;
  loadProject: (project: ProjectDocument) => void;
  undo: () => void;
  redo: () => void;
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
  setResourceBitmap: (
    resourceId: string,
    source: string,
    sourceDataUrl: string | undefined,
    bitmap: NonNullable<ProjectDocument["resources"][number]["bitmap"]>,
    threshold: number,
  ) => void;
  addRule: () => void;
  duplicateRule: (ruleId: string) => void;
  deleteRule: (ruleId: string) => void;
  updateRuleField: (ruleId: string, key: string, value: unknown) => void;
  updateRuleEventField: (ruleId: string, key: string, value: unknown) => void;
  ensureRuleCondition: (ruleId: string) => void;
  clearRuleCondition: (ruleId: string) => void;
  updateRuleConditionGroupField: (ruleId: string, key: keyof RuleConditionGroup, value: unknown) => void;
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
  startVideoOverlay: (overlay: VideoOverlay) => void;
  stopVideoOverlay: () => void;
  startDinoGame: () => void;
  stopDinoGame: () => void;
  restartSimulation: () => void;
  stopSimulation: () => void;
  sendSimulatorKey: (key: AbstractKey) => void;
  tickSimulation: (wallClockMs?: number) => void;
}

function createInitialState() {
  const project = createProjectFromTemplate("official-demo");
  const activePictureId = resolveActivePictureId(project, project.simulator.startPictureId);
  return {
    project,
    issues: validateProject(project),
    dirty: false,
    mode: "edit" as EditorMode,
    debugPanel: "none" as DebugPanelKind,
    scale: 4 as ScaleOption,
    activePictureId,
    projectTemplateId: "official-demo" as const,
    selection: defaultSelection(project),
    simulator: null as SimulatorSession | null,
    videoOverlay: null as VideoOverlay | null,
    dinoGame: null as DinoGameOverlay | null,
    history: [] as ProjectDocument[],
    future: [] as ProjectDocument[],
  };
}

export const useProjectStore = create<StoreState>((set, get) => {
  const commitProject = (
    recipe: (draft: ProjectDocument) => void,
    nextSelection?: SelectionTarget,
    nextActivePictureId?: string,
  ) => {
    const state = get();
    const draft = cloneProjectDocument(state.project);
    recipe(draft);
    const project = stampProject(draft);
    const normalized = normalizeSelection(
      project,
      nextActivePictureId ?? state.activePictureId,
      nextSelection ?? state.selection,
    );

    set({
      project,
      issues: validateProject(project),
      dirty: true,
      activePictureId: normalized.activePictureId,
      projectTemplateId: "custom",
      selection: normalized.selection,
      simulator: state.mode === "simulate" ? createSimulatorSession(project) : null,
      history: [...state.history, cloneProjectDocument(state.project)].slice(-HISTORY_LIMIT),
      future: [],
    });
  };

  return {
    ...createInitialState(),
    setMode: (mode) => {
      const state = get();
      if (mode === state.mode) {
        return;
      }

      if (mode === "simulate") {
        set({
          mode,
          debugPanel: "none",
          simulator: createSimulatorSession(state.project),
          videoOverlay: null,
          dinoGame: null,
        });
        return;
      }

      const fallbackPictureId =
        state.simulator?.currentPictureId ?? state.activePictureId ?? state.project.pictures[0]?.id ?? "";

      const normalized = normalizeSelection(
        state.project,
        fallbackPictureId,
        { kind: "picture", pictureId: fallbackPictureId },
      );

      set({
        mode,
        debugPanel: "none",
        activePictureId: normalized.activePictureId,
        selection: normalized.selection,
        simulator: null,
        videoOverlay: null,
        dinoGame: null,
      });
    },
    openDebugPanel: (panel) => {
      const state = get();
      const simulator = state.simulator ?? createSimulatorSession(state.project);
      set({
        mode: "simulate",
        debugPanel: panel,
        simulator,
        videoOverlay: null,
        dinoGame: null,
      });
    },
    closeDebugPanel: () => {
      set({ debugPanel: "none" });
    },
    setSimulatorVariableValue: (variableId, value) => {
      const state = get();
      const simulator = state.simulator ?? createSimulatorSession(state.project);
      const nextSimulator = applySimulatorVariableValue(state.project, simulator, variableId, value);
      set({
        mode: "simulate",
        simulator: nextSimulator,
        videoOverlay: null,
        dinoGame: null,
      });
    },
    setScale: (scale) => {
      const next = Number.isFinite(scale) ? Math.round(scale) : 4;
      set({ scale: Math.max(1, Math.min(40, next)) });
    },
    selectProject: () => set({ selection: { kind: "project" } }),
    selectPicture: (pictureId) =>
      set({
        activePictureId: pictureId,
        selection: { kind: "picture", pictureId },
      }),
    selectWidget: (pictureId, widgetId) =>
      set({
        activePictureId: pictureId,
        selection: { kind: "widget", pictureId, widgetId },
      }),
    selectRule: (pictureId, ruleId) =>
      set({
        activePictureId: pictureId,
        selection: { kind: "rule", pictureId, ruleId },
      }),
    selectVariable: (variableId) => set({ selection: { kind: "variable", variableId } }),
    selectTimer: (timerId) => set({ selection: { kind: "timer", timerId } }),
    selectResource: (resourceId) => set({ selection: { kind: "resource", resourceId } }),
    resetProject: () => {
      get().loadTemplate("blank");
    },
    loadTemplate: (templateId) => {
      const project = createProjectFromTemplate(templateId);
      const activePictureId = resolveActivePictureId(project, project.simulator.startPictureId);
      const normalized = normalizeSelection(project, activePictureId, defaultSelection(project));
      set({
        project,
        issues: validateProject(project),
        dirty: false,
        mode: "edit",
        debugPanel: "none",
        activePictureId: normalized.activePictureId,
        projectTemplateId: templateId,
        selection: normalized.selection,
        simulator: null,
        videoOverlay: null,
        dinoGame: null,
        history: [],
        future: [],
      });
    },
    loadProject: (project) => {
      const activePictureId = resolveActivePictureId(project, project.simulator.startPictureId);
      const normalized = normalizeSelection(project, activePictureId, defaultSelection(project));
      set({
        project,
        issues: validateProject(project),
        dirty: false,
        mode: "edit",
        debugPanel: "none",
        activePictureId: normalized.activePictureId,
        projectTemplateId: "custom",
        selection: normalized.selection,
        simulator: null,
        videoOverlay: null,
        dinoGame: null,
        history: [],
        future: [],
      });
    },
    undo: () => {
      const state = get();
      const previous = state.history[state.history.length - 1];
      if (!previous) {
        return;
      }

      const history = state.history.slice(0, -1);
      const future = [cloneProjectDocument(state.project), ...state.future].slice(0, HISTORY_LIMIT);
      const normalized = normalizeSelection(previous, state.activePictureId, state.selection);

      set({
        project: previous,
        issues: validateProject(previous),
        dirty: history.length > 0 || future.length > 0,
        history,
        future,
        activePictureId: normalized.activePictureId,
        selection: normalized.selection,
        simulator: state.mode === "simulate" ? createSimulatorSession(previous) : null,
      });
    },
    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) {
        return;
      }

      const future = state.future.slice(1);
      const history = [...state.history, cloneProjectDocument(state.project)].slice(-HISTORY_LIMIT);
      const normalized = normalizeSelection(next, state.activePictureId, state.selection);

      set({
        project: next,
        issues: validateProject(next),
        dirty: true,
        history,
        future,
        activePictureId: normalized.activePictureId,
        selection: normalized.selection,
        simulator: state.mode === "simulate" ? createSimulatorSession(next) : null,
      });
    },
    addPicture: () => {
      const state = get();
      const pictureId = nextId(state.project, "pic");
      const name = `Picture ${state.project.pictures.length + 1}`;
      commitProject(
        (draft) => {
          draft.pictures.push(createPicture(pictureId, name));
        },
        { kind: "picture", pictureId },
        pictureId,
      );
    },
    duplicatePicture: (pictureId) => {
      const state = get();
      const source = findPicture(state.project, pictureId);
      if (!source) {
        return;
      }

      const reserved = collectAllIds(state.project);
      const duplicated = cloneProjectDocument({
        ...state.project,
        pictures: [source],
      }).pictures[0];
      duplicated.id = allocateId(reserved, "pic");
      duplicated.name = `${source.name} Copy`;
      duplicated.title = `${source.title} Copy`;
      duplicated.widgets = duplicated.widgets.map((widget) => ({
        ...widget,
        id: allocateId(reserved, "w"),
      }));

      commitProject(
        (draft) => {
          draft.pictures.push(duplicated);
        },
        { kind: "picture", pictureId: duplicated.id },
        duplicated.id,
      );
    },
    deletePicture: (pictureId) => {
      const state = get();
      if (state.project.pictures.length <= 1) {
        return;
      }

      commitProject((draft) => {
        draft.pictures = draft.pictures.filter((picture) => picture.id !== pictureId);
        draft.rules = draft.rules.filter((rule) => rule.pictureId !== pictureId);
        draft.timers = draft.timers.map((timer) =>
          timer.targetPictureId === pictureId ? { ...timer, targetPictureId: null } : timer,
        );
        if (draft.simulator.startPictureId === pictureId) {
          draft.simulator.startPictureId = draft.pictures[0]?.id ?? "";
        }
      });
    },
    updatePictureField: (pictureId, field, value) => {
      commitProject(
        (draft) => {
          const picture = draft.pictures.find((entry) => entry.id === pictureId);
          if (!picture) {
            return;
          }

          if (field === "id") {
            const nextPictureId = String(value);
            draft.rules.forEach((rule) => {
              if (rule.pictureId === pictureId) {
                rule.pictureId = nextPictureId;
              }
            });
            draft.timers.forEach((timer) => {
              if (timer.targetPictureId === pictureId) {
                timer.targetPictureId = nextPictureId;
              }
            });
            if (draft.simulator.startPictureId === pictureId) {
              draft.simulator.startPictureId = nextPictureId;
            }
          }

          picture[field] = value;
        },
        field === "id" ? { kind: "picture", pictureId: String(value) } : undefined,
        field === "id" ? String(value) : undefined,
      );
    },
    addWidget: (type, position) => {
      const state = get();
      const pictureId = resolveActivePictureId(state.project, state.activePictureId);
      if (!pictureId) {
        return;
      }

      const widgetId = nextId(state.project, "w");
      const widget = createWidget(type, widgetId, `${type} ${widgetId}`);
      const widgetCount =
        state.project.pictures.find((picture) => picture.id === pictureId)?.widgets.length ?? 0;
      const nextX = position
        ? Math.round(position.x - Math.floor(widget.rect.width / 2))
        : 6 + widgetCount * 4;
      const nextY = position
        ? Math.round(position.y - Math.floor(widget.rect.height / 2))
        : 6 + widgetCount * 3;
      widget.rect = {
        ...widget.rect,
        x: Math.max(0, Math.min(128 - widget.rect.width, nextX)),
        y: Math.max(0, Math.min(64 - widget.rect.height, nextY)),
      };

      commitProject(
        (draft) => {
          const picture = draft.pictures.find((entry) => entry.id === pictureId);
          if (!picture) {
            return;
          }
          picture.widgets.push(widget);
        },
        { kind: "widget", pictureId, widgetId },
        pictureId,
      );
    },
    duplicateWidget: (widgetId) => {
      const state = get();
      const picture = findWidgetPicture(state.project, widgetId);
      const source = picture?.widgets.find((widget) => widget.id === widgetId);
      if (!picture || !source) {
        return;
      }

      const duplicated = structuredClone(source) as Widget;
      duplicated.id = nextId(state.project, "w");
      duplicated.name = `${source.name} Copy`;
      duplicated.rect = {
        ...duplicated.rect,
        x: Math.min(128 - duplicated.rect.width, duplicated.rect.x + 3),
        y: Math.min(64 - duplicated.rect.height, duplicated.rect.y + 3),
      };

      commitProject(
        (draft) => {
          const targetPicture = draft.pictures.find((entry) => entry.id === picture.id);
          targetPicture?.widgets.push(duplicated);
        },
        { kind: "widget", pictureId: picture.id, widgetId: duplicated.id },
        picture.id,
      );
    },
    deleteWidget: (widgetId) => {
      const state = get();
      const picture = findWidgetPicture(state.project, widgetId);
      if (!picture) {
        return;
      }

      commitProject(
        (draft) => {
          const targetPicture = draft.pictures.find((entry) => entry.id === picture.id);
          if (!targetPicture) {
            return;
          }
          targetPicture.widgets = targetPicture.widgets.filter((widget) => widget.id !== widgetId);
          draft.rules = draft.rules.filter((rule) => {
            if ("widgetId" in rule.event && rule.event.widgetId === widgetId) {
              return false;
            }
            return !rule.actions.some(
              (action) =>
                "widgetId" in action && action.widgetId === widgetId,
            );
          });
        },
        { kind: "picture", pictureId: picture.id },
        picture.id,
      );
    },
    updateWidgetField: (widgetId, field, value) => {
      const state = get();
      commitProject(
        (draft) => {
          const picture = draft.pictures.find((entry) =>
            entry.widgets.some((widget) => widget.id === widgetId),
          );
          const widget = picture?.widgets.find((entry) => entry.id === widgetId);
          if (!widget) {
            return;
          }

          if (field === "id") {
            const nextWidgetId = String(value);
            draft.rules.forEach((rule) => {
              if ("widgetId" in rule.event && rule.event.widgetId === widgetId) {
                rule.event.widgetId = nextWidgetId;
              }
              rule.condition?.items.forEach((condition) => {
                if ("widgetId" in condition && condition.widgetId === widgetId) {
                  condition.widgetId = nextWidgetId;
                }
              });
              rule.actions.forEach((action) => {
                if ("widgetId" in action && action.widgetId === widgetId) {
                  action.widgetId = nextWidgetId;
                }
              });
            });
            draft.pictures.forEach((targetPicture) => {
              targetPicture.widgets.forEach((entry) => {
                if (entry.type === "menu" && entry.props.popupParentWidgetId === widgetId) {
                  entry.props.popupParentWidgetId = nextWidgetId;
                }
              });
            });
          }

          const nextWidget = clampRect(
            field === "rect"
              ? ({ ...widget, rect: value as Widget["rect"] } as Widget)
              : ({ ...widget, [field]: value } as Widget),
          );
          Object.assign(widget, nextWidget);
        },
        field === "id" && state.selection.kind === "widget"
          ? {
              kind: "widget",
              pictureId: state.selection.pictureId,
              widgetId: String(value),
            }
          : undefined,
      );
    },
    updateWidgetRect: (widgetId, patch) => {
      commitProject((draft) => {
        const picture = draft.pictures.find((entry) => entry.widgets.some((widget) => widget.id === widgetId));
        const widget = picture?.widgets.find((entry) => entry.id === widgetId);
        if (!widget) {
          return;
        }

        Object.assign(widget, clampRect({ ...widget, rect: { ...widget.rect, ...patch } }));
      });
    },
    updateWidgetProp: (widgetId, key, value) => {
      commitProject((draft) => {
        const picture = draft.pictures.find((entry) => entry.widgets.some((widget) => widget.id === widgetId));
        const widget = picture?.widgets.find((entry) => entry.id === widgetId);
        if (!widget) {
          return;
        }
        (widget.props as unknown as Record<string, unknown>)[key] = value;
      });
    },
    addVariable: (type) => {
      const state = get();
      const variableId = nextId(state.project, "var");
      const variable = createVariable(variableId, `${type} ${variableId}`, type);
      commitProject(
        (draft) => {
          draft.variables.push(variable);
        },
        { kind: "variable", variableId },
      );
    },
    updateVariableField: (variableId, key, value) => {
      commitProject(
        (draft) => {
          const variable = draft.variables.find((entry) => entry.id === variableId);
          if (!variable) {
            return;
          }

          if (key === "id") {
            const nextVariableId = String(value);
            draft.pictures.forEach((picture) => {
              picture.widgets.forEach((widget) => {
                switch (widget.type) {
                  case "list":
                  case "menu":
                    widget.props.items.forEach((item) => {
                      if (item.dynamicTextVarId === variableId) {
                        item.dynamicTextVarId = nextVariableId;
                      }
                    });
                    break;
                  case "notice":
                  case "shape":
                  case "curve":
                    break;
                  case "textLabel":
                    if (widget.props.textVarId === variableId) {
                      widget.props.textVarId = nextVariableId;
                    }
                    break;
                  case "numberVariableBox":
                    if (widget.props.valueVarId === variableId) {
                      widget.props.valueVarId = nextVariableId;
                    }
                    break;
                  case "textVariableBox":
                    if (widget.props.textVarId === variableId) {
                      widget.props.textVarId = nextVariableId;
                    }
                    break;
                  case "realtimeGraph":
                  case "processBar":
                    if (widget.props.valueVarId === variableId) {
                      widget.props.valueVarId = nextVariableId;
                    }
                    break;
                  case "polarClock":
                    if (widget.props.hourVarId === variableId) {
                      widget.props.hourVarId = nextVariableId;
                    }
                    if (widget.props.minuteVarId === variableId) {
                      widget.props.minuteVarId = nextVariableId;
                    }
                    if (widget.props.secondVarId === variableId) {
                      widget.props.secondVarId = nextVariableId;
                    }
                    break;
                }
              });
            });

            draft.rules.forEach((rule) => {
              if (rule.event.kind === "onValueChange" && rule.event.variableId === variableId) {
                rule.event.variableId = nextVariableId;
              }
              rule.condition?.items.forEach((condition) => {
                if (condition.kind === "variableCompare" && condition.variableId === variableId) {
                  condition.variableId = nextVariableId;
                }
              });
              rule.actions.forEach((action) => {
                if ("variableId" in action && action.variableId === variableId) {
                  action.variableId = nextVariableId;
                }
                if (action.type === "pushGraphValue" && action.fromVariableId === variableId) {
                  action.fromVariableId = nextVariableId;
                }
              });
            });
          }

          (variable as unknown as Record<string, unknown>)[key] = value;
        },
        key === "id" ? { kind: "variable", variableId: String(value) } : undefined,
      );
    },
    addTimer: () => {
      const state = get();
      const timerId = nextId(state.project, "timer");
      const timer = createTimer(timerId, `Timer ${state.project.timers.length + 1}`, state.activePictureId);
      commitProject(
        (draft) => {
          draft.timers.push(timer);
        },
        { kind: "timer", timerId },
      );
    },
    updateTimerField: (timerId, key, value) => {
      commitProject(
        (draft) => {
          const timer = draft.timers.find((entry) => entry.id === timerId);
          if (!timer) {
            return;
          }

          if (key === "id") {
            const nextTimerId = String(value);
            draft.rules.forEach((rule) => {
              if (rule.event.kind === "onTimer" && rule.event.timerId === timerId) {
                rule.event.timerId = nextTimerId;
              }
              rule.condition?.items.forEach((condition) => {
                if (condition.kind === "timerEnabled" && condition.timerId === timerId) {
                  condition.timerId = nextTimerId;
                }
              });
              rule.actions.forEach((action) => {
                if (
                  (action.type === "startTimer" || action.type === "stopTimer") &&
                  action.timerId === timerId
                ) {
                  action.timerId = nextTimerId;
                }
              });
            });
          }

          (timer as unknown as Record<string, unknown>)[key] = value;
        },
        key === "id" ? { kind: "timer", timerId: String(value) } : undefined,
      );
    },
    addResource: () => {
      const state = get();
      const resourceId = nextId(state.project, "res");
      const resource = createResource(resourceId, `Resource ${state.project.resources.length + 1}`);
      commitProject(
        (draft) => {
          draft.resources.push(resource);
        },
        { kind: "resource", resourceId },
      );
    },
    updateResourceField: (resourceId, key, value) => {
      commitProject(
        (draft) => {
          const resource = draft.resources.find((entry) => entry.id === resourceId);
          if (!resource) {
            return;
          }

          if (key === "id") {
            const nextResourceId = String(value);
            draft.pictures.forEach((picture) => {
              picture.widgets.forEach((widget) => {
                if (widget.type === "notice" && widget.props.iconResourceId === resourceId) {
                  widget.props.iconResourceId = nextResourceId;
                }
              });
            });
          }

          (resource as unknown as Record<string, unknown>)[key] = value;
        },
        key === "id" ? { kind: "resource", resourceId: String(value) } : undefined,
      );
    },
    setResourceBitmap: (resourceId, source, sourceDataUrl, bitmap, threshold) => {
      commitProject((draft) => {
        const resource = draft.resources.find((entry) => entry.id === resourceId);
        if (!resource) {
          return;
        }
        resource.source = source;
        resource.sourceDataUrl = sourceDataUrl;
        resource.bitmap = bitmap;
        resource.threshold = threshold;
      });
    },
    addRule: () => {
      const state = get();
      const pictureId = resolveActivePictureId(state.project, state.activePictureId);
      const widgetId = state.selection.kind === "widget" ? state.selection.widgetId : undefined;
      const ruleId = nextId(state.project, "rule");
      const rule = createRule(ruleId, pictureId, widgetId);
      commitProject(
        (draft) => {
          draft.rules.push(rule);
        },
        { kind: "rule", pictureId, ruleId },
        pictureId,
      );
    },
    duplicateRule: (ruleId) => {
      const state = get();
      const source = state.project.rules.find((rule) => rule.id === ruleId);
      if (!source) {
        return;
      }

      const duplicated = structuredClone(source);
      duplicated.id = nextId(state.project, "rule");
      commitProject(
        (draft) => {
          draft.rules.push(duplicated);
        },
        { kind: "rule", pictureId: duplicated.pictureId, ruleId: duplicated.id },
        duplicated.pictureId,
      );
    },
    deleteRule: (ruleId) => {
      commitProject((draft) => {
        draft.rules = draft.rules.filter((rule) => rule.id !== ruleId);
      });
    },
    updateRuleField: (ruleId, key, value) => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        if (!rule) {
          return;
        }
        (rule as unknown as Record<string, unknown>)[key] = value;
      });
    },
    updateRuleEventField: (ruleId, key, value) => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        if (!rule) {
          return;
        }

        if (key === "kind") {
          rule.event = defaultEventForKind(draft, rule.pictureId, value as RuleEventKind);
          return;
        }

        switch (rule.event.kind) {
          case "onKeyPress":
            if (key === "key") {
              rule.event.key = value as AbstractKey;
            } else if (key === "widgetId") {
              if (value) {
                rule.event.widgetId = String(value);
              } else {
                delete rule.event.widgetId;
              }
            }
            break;
          case "onTimer":
            if (key === "timerId") {
              rule.event.timerId = String(value);
            }
            break;
          case "onValueChange":
            if (key === "variableId") {
              rule.event.variableId = String(value);
            }
            break;
          case "onWidgetFocus":
          case "onWidgetSelect":
          case "onWidgetConfirm":
            if (key === "widgetId") {
              rule.event.widgetId = String(value);
            }
            break;
        }
      });
    },
    ensureRuleCondition: (ruleId) => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        if (!rule || rule.condition) {
          return;
        }
        rule.condition = {
          mode: "all",
          items: [defaultConditionItem(draft, rule.pictureId)],
        };
      });
    },
    clearRuleCondition: (ruleId) => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        if (!rule) {
          return;
        }
        delete rule.condition;
      });
    },
    updateRuleConditionGroupField: (ruleId, key, value) => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        if (!rule?.condition) {
          return;
        }
        (rule.condition as unknown as Record<string, unknown>)[key] = value;
      });
    },
    addRuleConditionItem: (ruleId, kind = "variableCompare") => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        if (!rule) {
          return;
        }

        if (!rule.condition) {
          rule.condition = { mode: "all", items: [] };
        }

        rule.condition.items.push(defaultConditionItem(draft, rule.pictureId, kind));
      });
    },
    updateRuleConditionItemField: (ruleId, conditionIndex, key, value) => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        const condition = rule?.condition?.items[conditionIndex];
        if (!rule || !condition) {
          return;
        }

        if (key === "kind") {
          rule.condition!.items[conditionIndex] = defaultConditionItem(
            draft,
            rule.pictureId,
            value as ConditionItem["kind"],
          );
          return;
        }

        switch (condition.kind) {
          case "variableCompare":
            if (key === "variableId") {
              condition.variableId = String(value);
              condition.value = coerceVariableValue(draft, condition.variableId, condition.value);
            } else if (key === "operator") {
              condition.operator = value as typeof condition.operator;
            } else if (key === "value") {
              condition.value = coerceVariableValue(draft, condition.variableId, value);
            }
            break;
          case "widgetSelected":
            if (key === "widgetId") {
              condition.widgetId = String(value);
            } else if (key === "index") {
              const numeric = typeof value === "number" ? value : Number(value);
              condition.index = Number.isFinite(numeric) ? numeric : 0;
            }
            break;
          case "widgetVisible":
            if (key === "widgetId") {
              condition.widgetId = String(value);
            } else if (key === "visible") {
              condition.visible = value === true || value === "true";
            }
            break;
          case "timerEnabled":
            if (key === "timerId") {
              condition.timerId = String(value);
            } else if (key === "enabled") {
              condition.enabled = value === true || value === "true";
            }
            break;
        }
      });
    },
    deleteRuleConditionItem: (ruleId, conditionIndex) => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        if (!rule?.condition) {
          return;
        }
        rule.condition.items = rule.condition.items.filter((_, index) => index !== conditionIndex);
        if (rule.condition.items.length === 0) {
          delete rule.condition;
        }
      });
    },
    addRuleAction: (ruleId, actionType = "gotoPicture") => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        if (!rule) {
          return;
        }
        rule.actions.push(createDefaultAction(actionType));
      });
    },
    updateRuleActionField: (ruleId, actionIndex, key, value) => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        const action = rule?.actions[actionIndex];
        if (!action) {
          return;
        }

        switch (action.type) {
          case "gotoPicture":
            if (key === "pictureId") {
              action.pictureId = String(value);
            }
            break;
          case "goBack":
            break;
          case "setVariable":
            if (key === "variableId") {
              action.variableId = String(value);
              action.value = coerceVariableValue(draft, action.variableId, action.value);
            } else if (key === "value") {
              action.value = coerceVariableValue(draft, action.variableId, value);
            }
            break;
          case "setVariableFromVariable":
            if (key === "variableId") {
              action.variableId = String(value);
            } else if (key === "fromVariableId") {
              action.fromVariableId = String(value);
            }
            break;
          case "increaseVariable":
          case "decreaseVariable":
            if (key === "variableId") {
              action.variableId = String(value);
            } else if (key === "step") {
              const numeric = typeof value === "number" ? value : Number(value);
              action.step = Number.isFinite(numeric) ? numeric : 0;
            }
            break;
          case "setWidgetProp":
            if (key === "widgetId") {
              action.widgetId = String(value);
            } else if (key === "prop") {
              action.prop = value as typeof action.prop;
            } else if (key === "value") {
              if (action.prop === "visible" || action.prop === "enabled") {
                action.value = value === true || value === "true";
              } else {
                const numeric = typeof value === "number" ? value : Number(value);
                action.value = Number.isFinite(numeric) ? numeric : 0;
              }
            }
            break;
          case "selectNext":
          case "selectPrev":
          case "showNotice":
          case "hideNotice":
          case "textCharNext":
          case "textCharPrev":
            if (key === "widgetId") {
              action.widgetId = String(value);
            } else if (action.type === "showNotice" && key === "text") {
              action.text = String(value);
            }
            break;
          case "focusNext":
          case "focusPrev":
            if (key === "widgetId") {
              if (value) {
                action.widgetId = String(value);
              } else {
                delete action.widgetId;
              }
            }
            break;
          case "pushGraphValue":
            if (key === "widgetId") {
              action.widgetId = String(value);
            } else if (key === "valueSource") {
              action.valueSource = value as typeof action.valueSource;
              if (action.valueSource === "literal") {
                delete action.fromVariableId;
                action.value = typeof action.value === "number" ? action.value : 0;
              } else {
                delete action.value;
                action.fromVariableId = findFirstVariableId(draft) ?? "var_1";
              }
            } else if (key === "value") {
              const numeric = typeof value === "number" ? value : Number(value);
              action.value = Number.isFinite(numeric) ? numeric : 0;
            } else if (key === "fromVariableId") {
              action.fromVariableId = String(value);
            }
            break;
          case "clearGraphBuffer":
            if (key === "widgetId") {
              action.widgetId = String(value);
            }
            break;
          case "startTimer":
          case "stopTimer":
            if (key === "timerId") {
              action.timerId = String(value);
            }
            break;
          case "toggleBool":
            if (key === "variableId") {
              action.variableId = String(value);
            }
            break;
        }
      });
    },
    deleteRuleAction: (ruleId, actionIndex) => {
      commitProject((draft) => {
        const rule = draft.rules.find((entry) => entry.id === ruleId);
        if (!rule) {
          return;
        }
        rule.actions = rule.actions.filter((_, index) => index !== actionIndex);
      });
    },
    updateProjectField: (key, value) => {
      commitProject((draft) => {
        (draft.project as unknown as Record<string, unknown>)[key] = value;
      });
    },
    updateScreenField: (key, value) => {
      commitProject((draft) => {
        (draft.screen as unknown as Record<string, unknown>)[key] = value;
      });
    },
    updateSimulatorField: (key, value) => {
      commitProject((draft) => {
        (draft.simulator as unknown as Record<string, unknown>)[key] = value;
      });
    },
    startVideoOverlay: (overlay) => {
      const state = get();
      set({
        mode: "simulate",
        debugPanel: "none",
        simulator: state.simulator ?? createSimulatorSession(state.project),
        videoOverlay: structuredClone(overlay),
        dinoGame: null,
      });
    },
    stopVideoOverlay: () => {
      set({
        debugPanel: "none",
        videoOverlay: null,
      });
    },
    startDinoGame: () => {
      const state = get();
      set({
        mode: "simulate",
        debugPanel: "none",
        simulator: state.simulator ?? createSimulatorSession(state.project),
        videoOverlay: null,
        dinoGame: createDinoGameOverlay(Date.now()),
      });
    },
    stopDinoGame: () => {
      set({
        debugPanel: "none",
        dinoGame: null,
      });
    },
    restartSimulation: () => {
      const state = get();
      set({
        mode: "simulate",
        debugPanel: state.debugPanel,
        simulator: createSimulatorSession(state.project),
        dinoGame: state.dinoGame ? createDinoGameOverlay(Date.now(), state.dinoGame.rngState) : null,
      });
    },
    stopSimulation: () => {
      const state = get();
      const pictureId = state.simulator?.currentPictureId ?? state.activePictureId;
      set({
        mode: "edit",
        debugPanel: "none",
        activePictureId: pictureId,
        selection: { kind: "picture", pictureId },
        simulator: null,
        videoOverlay: null,
        dinoGame: null,
      });
    },
    sendSimulatorKey: (key) => {
      const state = get();
      if (state.mode !== "simulate") {
        return;
      }

      if (state.dinoGame) {
        set({
          dinoGame: handleDinoGameKey(state.dinoGame, key),
        });
        return;
      }

      if (!state.simulator) {
        return;
      }

      set({
        simulator: dispatchSimulatorKey(state.project, state.simulator, key),
      });
    },
    tickSimulation: (wallClockMs = Date.now()) => {
      const state = get();
      if (state.mode !== "simulate") {
        return;
      }

      if (state.dinoGame) {
        set({
          dinoGame: advanceDinoGame(state.dinoGame, wallClockMs),
        });
        return;
      }

      if (!state.simulator) {
        return;
      }

      set({
        simulator: advanceSimulatorClock(state.project, state.simulator, wallClockMs),
      });
    },
  };
});
