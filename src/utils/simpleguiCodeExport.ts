import type { Action, ProjectDocument, RuleEvent } from "@/types/project";
import {
  buildIntermediateExportModel,
  summarizeRuleCondition,
  type IntermediateExportModel,
  type IntermediatePictureModel,
  type IntermediateRuleModel,
  type IntermediateWidgetModel,
} from "@/export/intermediateModel";

export type ExportArtifactKind = "markdown" | "ir" | "c";

export interface ExportArtifact {
  filename: string;
  mimeType: string;
  text: string;
}

function actionSkeleton(action: Action): string {
  switch (action.type) {
    case "gotoPicture":
      return `HMI_GoToScreen(${action.pictureId}, NULL);`;
    case "goBack":
      return "HMI_GoBack(NULL);";
    case "setVariable":
      return `SetVariable(${action.variableId}, ${JSON.stringify(action.value)});`;
    case "setVariableFromVariable":
      return `CopyVariable(${action.variableId}, ${action.fromVariableId});`;
    case "increaseVariable":
      return `IncreaseVariable(${action.variableId}, ${action.step});`;
    case "decreaseVariable":
      return `DecreaseVariable(${action.variableId}, ${action.step});`;
    case "addVariableFromVariable":
      return `AddVariable(${action.variableId}, ${action.fromVariableId});`;
    case "negateVariable":
      return `NegateVariable(${action.variableId});`;
    case "setWidgetProp":
      return `SetWidgetProp(${action.widgetId}, ${action.prop}, ${JSON.stringify(action.value)});`;
    case "selectNext":
      return `SelectNext(${action.widgetId});`;
    case "selectPrev":
      return `SelectPrev(${action.widgetId});`;
    case "focusNext":
      return action.widgetId ? `FocusNext(${action.widgetId});` : "FocusNext(NULL);";
    case "focusPrev":
      return action.widgetId ? `FocusPrev(${action.widgetId});` : "FocusPrev(NULL);";
    case "pushGraphValue":
      return action.valueSource === "literal"
        ? `PushGraphValue(${action.widgetId}, ${action.value ?? 0});`
        : `PushGraphValueFromVariable(${action.widgetId}, ${action.fromVariableId ?? "0"});`;
    case "clearGraphBuffer":
      return `ClearGraphBuffer(${action.widgetId});`;
    case "showNotice":
      return action.text
        ? `ShowNotice(${action.widgetId}, ${JSON.stringify(action.text)});`
        : `ShowNoticeFromVariable(${action.widgetId}, ${action.fromVariableId ?? "0"});`;
    case "hideNotice":
      return `HideNotice(${action.widgetId});`;
    case "startTimer":
      return `StartTimer(${action.timerId});`;
    case "stopTimer":
      return `StopTimer(${action.timerId});`;
    case "toggleBool":
      return `ToggleBool(${action.variableId});`;
    case "textCharNext":
      return `TextCharNext(${action.widgetId});`;
    case "textCharPrev":
      return `TextCharPrev(${action.widgetId});`;
  }
}

function summarizeEvent(event: RuleEvent): string {
  switch (event.kind) {
    case "onKeyPress":
      return `${event.key}${event.widgetId ? ` @ ${event.widgetId}` : ""}`;
    case "onTimer":
      return `timer ${event.timerId}`;
    case "onValueChange":
      return `value ${event.variableId}`;
    case "onWidgetFocus":
    case "onWidgetSelect":
    case "onWidgetConfirm":
      return `${event.kind} ${event.widgetId}`;
  }
}

function renderBindings(widget: IntermediateWidgetModel): string[] {
  if (widget.bindings.length === 0) {
    return ["- bindings: none"];
  }

  return [
    "- bindings:",
    ...widget.bindings.map(
      (binding) =>
        `  - ${binding.field}: ${binding.sourceKind}=${binding.sourceId ?? "none"} role=${binding.role}${binding.required ? " required" : ""}`,
    ),
  ];
}

function renderWidget(widget: IntermediateWidgetModel): string[] {
  return [
    `- ${widget.name} [${widget.type}]`,
    `  - family: ${widget.simpleGuiFamily}`,
    `  - category: ${widget.category}`,
    `  - rect: ${widget.rect.x},${widget.rect.y},${widget.rect.width}x${widget.rect.height}`,
    `  - state: visible=${widget.visible} enabled=${widget.enabled} focusable=${widget.focusable} z=${widget.zIndex}`,
    `  - summary: ${widget.summary}`,
    `  - runtime: ${widget.runtimeFeatures.length > 0 ? widget.runtimeFeatures.join(", ") : "none"}`,
    ...renderBindings(widget),
  ];
}

function renderPicture(picture: IntermediatePictureModel): string[] {
  return [
    `### ${picture.name}`,
    `- id: \`${picture.id}\``,
    `- title: \`${picture.title}\``,
    `- enterActions: ${picture.enterActions.length}`,
    `- leaveActions: ${picture.leaveActions.length}`,
    "- widgets:",
    ...(picture.widgets.length > 0
      ? picture.widgets.flatMap((widget) => renderWidget(widget))
      : ["- (no widgets)"]),
    "",
  ];
}

function renderRule(rule: IntermediateRuleModel): string[] {
  return [
    `- **${rule.id}**`,
    `  - event: \`${summarizeEvent(rule.event)}\``,
    `  - condition: ${summarizeRuleCondition(rule.condition)}`,
    `  - stopAfterMatch: ${rule.stopAfterMatch ? "true" : "false"}`,
    "  - actions:",
    ...rule.actions.map((action) => `    - ${action.type} | ${actionSkeleton(action)}`),
  ];
}

function renderPictureRules(model: IntermediateExportModel): string[] {
  const lines: string[] = [];
  model.pictures.forEach((picture) => {
    lines.push(`### ${picture.name}`);
    if (picture.rules.length === 0) {
      lines.push("- (no rules)", "");
      return;
    }

    picture.rules.forEach((rule) => {
      lines.push(...renderRule(rule));
    });
    lines.push("");
  });

  if (model.orphanRules.length > 0) {
    lines.push("### Orphan Rules");
    model.orphanRules.forEach((rule) => {
      lines.push(...renderRule(rule));
    });
    lines.push("");
  }

  return lines;
}

function renderContractOverview(model: IntermediateExportModel): string[] {
  const usage = new Map<string, { label: string; count: number }>();

  model.pictures.forEach((picture) => {
    picture.widgets.forEach((widget) => {
      const current = usage.get(widget.type);
      usage.set(widget.type, {
        label: widget.simpleGuiFamily,
        count: (current?.count ?? 0) + 1,
      });
    });
  });

  return [
    "## Component Contracts",
    ...Array.from(usage.entries()).map(
      ([type, info]) => `- ${type}: ${info.label} x ${info.count}`,
    ),
    "",
  ];
}

function renderExportContract(model: IntermediateExportModel): string[] {
  return [
    "## Export Pipeline",
    "- source: project.json",
    "- stage1: ProjectDocument",
    "- stage2: WidgetContract + IntermediateExportModel",
    "- stage3: Markdown / IR JSON / C skeleton / future MCU emitter",
    `- entry picture: ${model.simulator.startPictureId}`,
    "",
  ];
}

function renderMarkdown(model: IntermediateExportModel): string {
  const lines = [
    `# ${model.projectName}`,
    "",
    "## Project",
    `- screen: ${model.screen.width}x${model.screen.height}`,
    `- simulator start: \`${model.simulator.startPictureId}\``,
    `- key mode: \`${model.simulator.keyMode}\``,
    `- fps: ${model.simulator.fps}`,
    "",
    "## Variables",
    ...model.variables.map((variable) => {
      const extra =
        variable.type === "int"
          ? ` range=${variable.min}..${variable.max} step=${variable.step}`
          : variable.type === "string"
            ? ` length=${variable.length}`
            : "";
      return `- ${variable.id}: ${variable.name} (${variable.type}, readonly=${variable.readonly ? "true" : "false"}, initial=${String(variable.initial)}${extra})`;
    }),
    "",
    "## Timers",
    ...model.timers.map(
      (timer) =>
        `- ${timer.id}: ${timer.name} (${timer.intervalMs} ms, repeat=${timer.repeat ? "true" : "false"}, enabledOnStart=${timer.enabledOnStart ? "true" : "false"}, target=${timer.targetPictureId ?? "none"})`,
    ),
    "",
    "## Resources",
    ...model.resources.map(
      (resource) =>
        `- ${resource.id}: ${resource.name} (${resource.kind}, bitmap=${resource.hasBitmap ? "yes" : "no"}, source=${resource.source || "inline"})`,
    ),
    "",
    ...renderContractOverview(model),
    "## Pictures",
    ...model.pictures.flatMap((picture) => renderPicture(picture)),
    "## Rules",
    ...renderPictureRules(model),
    ...renderExportContract(model),
    "## C Skeleton",
    "```c",
    renderCSkeleton(model),
    "```",
    "",
  ];

  return lines.join("\n");
}

function sanitizeIdentifier(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

function renderPictureEnum(model: IntermediateExportModel): string[] {
  return model.pictures.map((picture, index) => {
    const suffix = index === model.pictures.length - 1 ? "" : ",";
    return `    SCREEN_${sanitizeIdentifier(picture.id).toUpperCase()} = ${index}${suffix}`;
  });
}

function renderCSkeleton(model: IntermediateExportModel): string {
  const lines: string[] = [];
  lines.push("typedef enum");
  lines.push("{");
  lines.push(...renderPictureEnum(model));
  lines.push("} HMI_SCREEN_ID;");
  lines.push("");
  lines.push("static void SGUI_LoadResources(void);");
  lines.push("static void SGUI_InitVariables(void);");
  lines.push("static void SGUI_InitScreens(void);");
  lines.push("static void SGUI_DispatchRuleEvent(void);");
  lines.push("");
  model.pictures.forEach((picture) => {
    const funcBase = sanitizeIdentifier(picture.id);
    lines.push(`static void ${funcBase}_Prepare(void);`);
    lines.push(`static void ${funcBase}_Refresh(void);`);
    lines.push(`static void ${funcBase}_ProcessEvent(void);`);
    lines.push(`static void ${funcBase}_PostProcess(void);`);
  });
  lines.push("");
  lines.push("void DemoMainProcess(void)");
  lines.push("{");
  lines.push("    SGUI_LoadResources();");
  lines.push("    SGUI_InitVariables();");
  lines.push("    SGUI_InitScreens();");
  lines.push("");
  lines.push("    while (1)");
  lines.push("    {");
  lines.push("        /* dispatch keys, timers, RTC */");
  lines.push("        SGUI_DispatchRuleEvent();");
  lines.push("    }");
  lines.push("}");
  lines.push("");
  lines.push("static void SGUI_InitVariables(void)");
  lines.push("{");
  model.variables.forEach((variable) => {
    lines.push(`    /* ${variable.id}: ${variable.name} */`);
    lines.push(`    /* initial = ${String(variable.initial)} */`);
  });
  lines.push("}");
  lines.push("");
  lines.push("static void SGUI_LoadResources(void)");
  lines.push("{");
  model.resources.forEach((resource) => {
    lines.push(`    /* ${resource.id}: kind=${resource.kind}, source=${resource.source || "inline"} */`);
  });
  lines.push("}");
  lines.push("");
  lines.push("static void SGUI_InitScreens(void)");
  lines.push("{");
  model.pictures.forEach((picture) => {
    lines.push(`    /* ${picture.id}: ${picture.widgets.length} widgets, ${picture.rules.length} rules */`);
  });
  lines.push("}");
  lines.push("");
  lines.push("static void SGUI_DispatchRuleEvent(void)");
  lines.push("{");
  lines.push("    /* TODO: map runtime events to generated picture rule handlers */");
  lines.push("}");
  lines.push("");
  model.pictures.forEach((picture) => {
    const funcBase = sanitizeIdentifier(picture.id);
    lines.push(`static void ${funcBase}_Prepare(void)`);
    lines.push("{");
    picture.enterActions.forEach((action) => {
      lines.push(`    ${actionSkeleton(action)}`);
    });
    if (picture.enterActions.length === 0) {
      lines.push("    /* no enter actions */");
    }
    lines.push("}");
    lines.push("");
    lines.push(`static void ${funcBase}_Refresh(void)`);
    lines.push("{");
    picture.widgets.forEach((widget) => {
      lines.push(`    /* draw ${widget.id}: ${widget.simpleGuiFamily} */`);
    });
    if (picture.widgets.length === 0) {
      lines.push("    /* no widgets */");
    }
    lines.push("}");
    lines.push("");
    lines.push(`static void ${funcBase}_ProcessEvent(void)`);
    lines.push("{");
    picture.rules.forEach((rule) => {
      lines.push(`    /* ${rule.id}: ${summarizeEvent(rule.event)} if ${summarizeRuleCondition(rule.condition)} */`);
      rule.actions.forEach((action) => {
        lines.push(`    /* ${actionSkeleton(action)} */`);
      });
    });
    if (picture.rules.length === 0) {
      lines.push("    /* no rules */");
    }
    lines.push("}");
    lines.push("");
    lines.push(`static void ${funcBase}_PostProcess(void)`);
    lines.push("{");
    picture.leaveActions.forEach((action) => {
      lines.push(`    ${actionSkeleton(action)}`);
    });
    if (picture.leaveActions.length === 0) {
      lines.push("    /* no leave actions */");
    }
    lines.push("}");
    lines.push("");
  });

  return lines.join("\n");
}

export function generateSimpleguiCodeMarkdown(project: ProjectDocument): string {
  return renderMarkdown(buildIntermediateExportModel(project));
}

export function generateSimpleguiIntermediateJson(project: ProjectDocument): string {
  const model = buildIntermediateExportModel(project);
  return JSON.stringify(
    {
      schema: "simplegui-intermediate-export/v1",
      generatedAt: new Date().toISOString(),
      model,
    },
    null,
    2,
  );
}

export function generateSimpleguiCSkeleton(project: ProjectDocument): string {
  return renderCSkeleton(buildIntermediateExportModel(project));
}

export function buildExportArtifact(
  project: ProjectDocument,
  kind: ExportArtifactKind,
): ExportArtifact {
  const baseName = project.project.name || "simplegui-project";

  switch (kind) {
    case "markdown":
      return {
        filename: `${baseName}-code.md`,
        mimeType: "text/markdown;charset=utf-8",
        text: generateSimpleguiCodeMarkdown(project),
      };
    case "ir":
      return {
        filename: `${baseName}-ir.json`,
        mimeType: "application/json;charset=utf-8",
        text: generateSimpleguiIntermediateJson(project),
      };
    case "c":
      return {
        filename: `${baseName}-skeleton.c`,
        mimeType: "text/x-c;charset=utf-8",
        text: generateSimpleguiCSkeleton(project),
      };
  }
}

export function downloadTextFile(filename: string, text: string, mimeType = "text/plain;charset=utf-8"): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
