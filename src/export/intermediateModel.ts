import type {
  Action,
  ConditionItem,
  ProjectDocument,
  ResourceDefinition,
  RuleDefinition,
  RuleEvent,
  VariableDefinition,
  Widget,
} from "@/types/project";
import {
  collectWidgetBindings,
  describeWidgetContract,
  getWidgetContract,
  type WidgetBindingDescriptor,
} from "@/contracts/widgetContracts";

export interface IntermediateVariableModel {
  id: string;
  name: string;
  type: VariableDefinition["type"];
  readonly: boolean;
  initial: VariableDefinition["initial"];
  min?: number;
  max?: number;
  step?: number;
  length?: number;
}

export interface IntermediateTimerModel {
  id: string;
  name: string;
  intervalMs: number;
  repeat: boolean;
  enabledOnStart: boolean;
  targetPictureId: string | null;
}

export interface IntermediateResourceModel {
  id: string;
  name: string;
  kind: ResourceDefinition["kind"];
  source: string;
  hasBitmap: boolean;
}

export interface IntermediateRuleModel {
  id: string;
  pictureId: string;
  event: RuleEvent;
  condition: RuleDefinition["condition"];
  actions: Action[];
  stopAfterMatch: boolean;
}

export interface IntermediateWidgetModel {
  id: string;
  name: string;
  type: Widget["type"];
  category: ReturnType<typeof getWidgetContract>["category"];
  simpleGuiFamily: string;
  rect: Widget["rect"];
  visible: boolean;
  enabled: boolean;
  focusable: boolean;
  zIndex: number;
  props: Widget["props"];
  bindings: WidgetBindingDescriptor[];
  runtimeFeatures: string[];
  summary: string;
}

export interface IntermediatePictureModel {
  id: string;
  name: string;
  title: string;
  widgets: IntermediateWidgetModel[];
  enterActions: Action[];
  leaveActions: Action[];
  rules: IntermediateRuleModel[];
}

export interface IntermediateExportModel {
  projectName: string;
  screen: ProjectDocument["screen"];
  simulator: ProjectDocument["simulator"];
  variables: IntermediateVariableModel[];
  timers: IntermediateTimerModel[];
  resources: IntermediateResourceModel[];
  pictures: IntermediatePictureModel[];
  orphanRules: IntermediateRuleModel[];
}

function buildWidgetModel(widget: Widget): IntermediateWidgetModel {
  const contract = getWidgetContract(widget.type);
  return {
    id: widget.id,
    name: widget.name,
    type: widget.type,
    category: contract.category,
    simpleGuiFamily: contract.simpleGuiFamily,
    rect: widget.rect,
    visible: widget.visible,
    enabled: widget.enabled,
    focusable: widget.focusable,
    zIndex: widget.zIndex,
    props: widget.props,
    bindings: collectWidgetBindings(widget),
    runtimeFeatures: contract.runtimeFeatures,
    summary: describeWidgetContract(widget),
  };
}

function buildRuleModel(rule: RuleDefinition): IntermediateRuleModel {
  return {
    id: rule.id,
    pictureId: rule.pictureId,
    event: rule.event,
    condition: rule.condition,
    actions: rule.actions,
    stopAfterMatch: rule.stopAfterMatch,
  };
}

function serializeConditionItem(item: ConditionItem): string {
  switch (item.kind) {
    case "variableCompare":
      return `${item.variableId} ${item.operator} ${String(item.value)}`;
    case "widgetSelected":
      return `${item.widgetId}.selectedIndex == ${item.index}`;
    case "widgetVisible":
      return `${item.widgetId}.visible == ${item.visible ? "true" : "false"}`;
    case "timerEnabled":
      return `${item.timerId}.enabled == ${item.enabled ? "true" : "false"}`;
  }
}

export function summarizeRuleCondition(condition: RuleDefinition["condition"]): string {
  if (!condition || condition.items.length === 0) {
    return "always";
  }

  const separator = condition.mode === "all" ? " && " : " || ";
  return condition.items.map((item) => serializeConditionItem(item)).join(separator);
}

export function buildIntermediateExportModel(project: ProjectDocument): IntermediateExportModel {
  const rulesByPicture = new Map<string, IntermediateRuleModel[]>();
  const orphanRules: IntermediateRuleModel[] = [];

  project.rules.forEach((rule) => {
    const normalized = buildRuleModel(rule);
    const pictureExists = project.pictures.some((picture) => picture.id === rule.pictureId);
    if (!pictureExists) {
      orphanRules.push(normalized);
      return;
    }

    const collection = rulesByPicture.get(rule.pictureId) ?? [];
    collection.push(normalized);
    rulesByPicture.set(rule.pictureId, collection);
  });

  return {
    projectName: project.project.name,
    screen: project.screen,
    simulator: project.simulator,
    variables: project.variables.map((variable) => ({
      id: variable.id,
      name: variable.name,
      type: variable.type,
      readonly: variable.readonly,
      initial: variable.initial,
      min: variable.type === "int" ? variable.min : undefined,
      max: variable.type === "int" ? variable.max : undefined,
      step: variable.type === "int" ? variable.step : undefined,
      length: variable.type === "string" ? variable.length : undefined,
    })),
    timers: project.timers.map((timer) => ({
      id: timer.id,
      name: timer.name,
      intervalMs: timer.intervalMs,
      repeat: timer.repeat,
      enabledOnStart: timer.enabledOnStart,
      targetPictureId: timer.targetPictureId,
    })),
    resources: project.resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      kind: resource.kind,
      source: resource.source,
      hasBitmap: resource.bitmap !== null,
    })),
    pictures: project.pictures.map((picture) => ({
      id: picture.id,
      name: picture.name,
      title: picture.title,
      widgets: picture.widgets.map((widget) => buildWidgetModel(widget)),
      enterActions: picture.enterActions,
      leaveActions: picture.leaveActions,
      rules: rulesByPicture.get(picture.id) ?? [],
    })),
    orphanRules,
  };
}
