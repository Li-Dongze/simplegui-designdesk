import type {
  Action,
  ConditionItem,
  Picture,
  ProjectDocument,
  ValidationIssue,
  VariableDefinition,
  Widget,
} from "@/types/project";

const pushIssue = (
  issues: ValidationIssue[],
  level: ValidationIssue["level"],
  code: string,
  path: string,
  message: string,
) => {
  issues.push({ level, code, path, message });
};

function duplicateIds(items: Array<{ id: string }>, pathPrefix: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, number>();

  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      pushIssue(
        issues,
        "error",
        "duplicate-id",
        `${pathPrefix}[${index}].id`,
        `Duplicate id "${item.id}" detected.`,
      );
    } else {
      seen.set(item.id, index);
    }
  });

  return issues;
}

function widgetVariableRefs(widget: Widget): Array<{ value: string | null; path: string }> {
  switch (widget.type) {
    case "list":
      return widget.props.items.map((item, index) => ({
        value: item.dynamicTextVarId,
        path: `props.items[${index}].dynamicTextVarId`,
      }));
    case "menu":
      return widget.props.items.map((item, index) => ({
        value: item.dynamicTextVarId,
        path: `props.items[${index}].dynamicTextVarId`,
      }));
    case "notice":
      return [];
    case "textLabel":
      return [{ value: widget.props.textVarId, path: "props.textVarId" }];
    case "shape":
      return [];
    case "numberVariableBox":
      return [{ value: widget.props.valueVarId, path: "props.valueVarId" }];
    case "textVariableBox":
      return [{ value: widget.props.textVarId, path: "props.textVarId" }];
    case "realtimeGraph":
      return [{ value: widget.props.valueVarId, path: "props.valueVarId" }];
    case "processBar":
      return [{ value: widget.props.valueVarId, path: "props.valueVarId" }];
    case "curve":
      return [];
    case "polarClock":
      return [
        { value: widget.props.hourVarId, path: "props.hourVarId" },
        { value: widget.props.minuteVarId, path: "props.minuteVarId" },
        { value: widget.props.secondVarId, path: "props.secondVarId" },
      ];
  }
}

function validateRect(widget: Widget, issues: ValidationIssue[], picturePath: string) {
  const { x, y, width, height } = widget.rect;

  if (width <= 0 || height <= 0) {
    pushIssue(
      issues,
      "error",
      "invalid-rect",
      `${picturePath}.${widget.id}.rect`,
      `Widget "${widget.id}" must have a positive width and height.`,
    );
  }

  if (x < 0 || y < 0 || x + width > 128 || y + height > 64) {
    pushIssue(
      issues,
      "error",
      "out-of-bounds",
      `${picturePath}.${widget.id}.rect`,
      `Widget "${widget.id}" is outside the 128x64 screen bounds.`,
    );
  }

  if (widget.type === "notice" && widget.props.text.length > 24) {
    pushIssue(
      issues,
      "warning",
      "notice-length",
      `${picturePath}.${widget.id}.props.text`,
      `Notice text may overflow on the 128x64 screen.`,
    );
  }

  if (widget.type === "realtimeGraph" && (width < 24 || height < 16)) {
    pushIssue(
      issues,
      "warning",
      "graph-small",
      `${picturePath}.${widget.id}.rect`,
      `RealtimeGraph is very small and may be hard to read.`,
    );
  }
}

function validateWidgetRefs(
  picture: Picture,
  variables: Map<string, VariableDefinition>,
  issues: ValidationIssue[],
  pictureIndex: number,
) {
  picture.widgets.forEach((widget, widgetIndex) => {
    validateRect(widget, issues, `pictures[${pictureIndex}].widgets[${widgetIndex}]`);

    widgetVariableRefs(widget).forEach((ref) => {
      if (ref.value && !variables.has(ref.value)) {
        pushIssue(
          issues,
          "error",
          "missing-variable",
          `pictures[${pictureIndex}].widgets[${widgetIndex}].${ref.path}`,
          `Widget "${widget.id}" references missing variable "${ref.value}".`,
        );
      }
    });
  });
}

function validateCondition(
  condition: ConditionItem,
  project: ProjectDocument,
  path: string,
  issues: ValidationIssue[],
) {
  switch (condition.kind) {
    case "variableCompare":
      if (!project.variables.some((variable) => variable.id === condition.variableId)) {
        pushIssue(
          issues,
          "error",
          "missing-variable",
          path,
          `Condition references missing variable "${condition.variableId}".`,
        );
      }
      break;
    case "widgetSelected":
    case "widgetVisible":
      if (!project.pictures.some((picture) => picture.widgets.some((widget) => widget.id === condition.widgetId))) {
        pushIssue(
          issues,
          "error",
          "missing-widget",
          path,
          `Condition references missing widget "${condition.widgetId}".`,
        );
      }
      break;
    case "timerEnabled":
      if (!project.timers.some((timer) => timer.id === condition.timerId)) {
        pushIssue(
          issues,
          "error",
          "missing-timer",
          path,
          `Condition references missing timer "${condition.timerId}".`,
        );
      }
      break;
  }
}

function validateAction(action: Action, project: ProjectDocument, path: string, issues: ValidationIssue[]) {
  const widgetExists = (widgetId: string) =>
    project.pictures.some((picture) => picture.widgets.some((widget) => widget.id === widgetId));
  const variableExists = (variableId: string) =>
    project.variables.some((variable) => variable.id === variableId);
  const timerExists = (timerId: string) => project.timers.some((timer) => timer.id === timerId);
  const pictureExists = (pictureId: string) => project.pictures.some((picture) => picture.id === pictureId);

  switch (action.type) {
    case "gotoPicture":
      if (!pictureExists(action.pictureId)) {
        pushIssue(issues, "error", "missing-picture", path, `Missing picture "${action.pictureId}".`);
      }
      break;
    case "setVariable":
    case "increaseVariable":
    case "decreaseVariable":
    case "toggleBool":
    case "negateVariable":
      if (!variableExists(action.variableId)) {
        pushIssue(
          issues,
          "error",
          "missing-variable",
          path,
          `Action references missing variable "${action.variableId}".`,
        );
      }
      break;
    case "addVariableFromVariable":
      if (!variableExists(action.variableId)) {
        pushIssue(
          issues,
          "error",
          "missing-variable",
          path,
          `Action references missing variable "${action.variableId}".`,
        );
      }
      if (!variableExists(action.fromVariableId)) {
        pushIssue(
          issues,
          "error",
          "missing-variable",
          path,
          `Action references missing variable "${action.fromVariableId}".`,
        );
      }
      break;
    case "setWidgetProp":
    case "selectNext":
    case "selectPrev":
    case "showNotice":
    case "hideNotice":
    case "clearGraphBuffer":
    case "textCharNext":
    case "textCharPrev":
      if (!widgetExists(action.widgetId)) {
        pushIssue(
          issues,
          "error",
          "missing-widget",
          path,
          `Action references missing widget "${action.widgetId}".`,
        );
      }
      break;
    case "pushGraphValue":
      if (!widgetExists(action.widgetId)) {
        pushIssue(
          issues,
          "error",
          "missing-widget",
          path,
          `Action references missing widget "${action.widgetId}".`,
        );
      }
      if (action.valueSource === "fromVariable" && action.fromVariableId && !variableExists(action.fromVariableId)) {
        pushIssue(
          issues,
          "error",
          "missing-variable",
          path,
          `Graph action references missing variable "${action.fromVariableId}".`,
        );
      }
      break;
    case "startTimer":
    case "stopTimer":
      if (!timerExists(action.timerId)) {
        pushIssue(issues, "error", "missing-timer", path, `Missing timer "${action.timerId}".`);
      }
      break;
    case "focusNext":
    case "focusPrev":
      if (action.widgetId && !widgetExists(action.widgetId)) {
        pushIssue(
          issues,
          "error",
          "missing-widget",
          path,
          `Action references missing widget "${action.widgetId}".`,
        );
      }
      break;
    case "goBack":
      break;
  }
}

export function validateProject(project: ProjectDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  issues.push(...duplicateIds(project.resources, "resources"));
  issues.push(...duplicateIds(project.variables, "variables"));
  issues.push(...duplicateIds(project.timers, "timers"));
  issues.push(...duplicateIds(project.pictures, "pictures"));
  issues.push(...duplicateIds(project.rules, "rules"));

  const variableMap = new Map(project.variables.map((variable) => [variable.id, variable]));

  project.pictures.forEach((picture, pictureIndex) => {
    issues.push(...duplicateIds(picture.widgets, `pictures[${pictureIndex}].widgets`));
    validateWidgetRefs(picture, variableMap, issues, pictureIndex);
  });

  if (!project.pictures.some((picture) => picture.id === project.simulator.startPictureId)) {
    pushIssue(
      issues,
      "error",
      "invalid-start-picture",
      "simulator.startPictureId",
      `Start picture "${project.simulator.startPictureId}" does not exist.`,
    );
  }

  project.timers.forEach((timer, index) => {
    if (
      timer.targetPictureId &&
      !project.pictures.some((picture) => picture.id === timer.targetPictureId)
    ) {
      pushIssue(
        issues,
        "error",
        "missing-picture",
        `timers[${index}].targetPictureId`,
        `Timer "${timer.id}" references missing picture "${timer.targetPictureId}".`,
      );
    }
  });

  project.rules.forEach((rule, ruleIndex) => {
    if (!project.pictures.some((picture) => picture.id === rule.pictureId)) {
      pushIssue(
        issues,
        "error",
        "missing-picture",
        `rules[${ruleIndex}].pictureId`,
        `Rule "${rule.id}" references missing picture "${rule.pictureId}".`,
      );
    }

    if (rule.actions.length > 8) {
      pushIssue(
        issues,
        "warning",
        "too-many-actions",
        `rules[${ruleIndex}].actions`,
        `Rule "${rule.id}" contains more than 8 actions.`,
      );
    }

    if (rule.condition) {
      rule.condition.items.forEach((condition, conditionIndex) => {
        validateCondition(
          condition,
          project,
          `rules[${ruleIndex}].condition.items[${conditionIndex}]`,
          issues,
        );
      });
    }

    rule.actions.forEach((action, actionIndex) => {
      validateAction(action, project, `rules[${ruleIndex}].actions[${actionIndex}]`, issues);
    });
  });

  return issues;
}
