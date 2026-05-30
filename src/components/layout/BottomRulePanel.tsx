import { useMemo, type ReactNode } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { summarizeRule } from "@/utils/viewModel";
import type {
  Action,
  AbstractKey,
  ConditionItem,
  RuleConditionMode,
  RuleEventKind,
  VariableDefinition,
} from "@/types/project";

const eventKinds: RuleEventKind[] = [
  "onKeyPress",
  "onTimer",
  "onValueChange",
  "onWidgetFocus",
  "onWidgetSelect",
  "onWidgetConfirm",
];

const conditionKinds: ConditionItem["kind"][] = [
  "variableCompare",
  "widgetSelected",
  "widgetVisible",
  "timerEnabled",
];

const actionTypes: Action["type"][] = [
  "gotoPicture",
  "goBack",
  "setVariable",
  "setVariableFromVariable",
  "increaseVariable",
  "decreaseVariable",
  "addVariableFromVariable",
  "negateVariable",
  "setWidgetProp",
  "selectNext",
  "selectPrev",
  "focusNext",
  "focusPrev",
  "pushGraphValue",
  "clearGraphBuffer",
  "showNotice",
  "hideNotice",
  "startTimer",
  "stopTimer",
  "toggleBool",
  "textCharNext",
  "textCharPrev",
];

const keyOptions: AbstractKey[] = [
  "up",
  "down",
  "left",
  "right",
  "enter",
  "esc",
  "tab",
  "space",
  "insert",
  "shiftInsert",
  "delete",
  "home",
  "end",
  "plus",
  "minus",
];
const conditionModes: RuleConditionMode[] = ["all", "any"];

function FieldRow(props: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field-row">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

function BoolInput(props: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={props.value}
      onChange={(event) => props.onChange(event.target.checked)}
    />
  );
}

function NumberInput(props: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(props.value) ? props.value : 0}
      onChange={(event) => props.onChange(Number(event.target.value))}
    />
  );
}

function VariableValueInput(props: {
  variable: VariableDefinition | undefined;
  value: unknown;
  onChange: (value: string | number | boolean) => void;
}) {
  if (props.variable?.type === "bool") {
    return (
      <select
        value={String(Boolean(props.value))}
        onChange={(event) => props.onChange(event.target.value === "true")}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (props.variable?.type === "int") {
    return (
      <NumberInput
        value={typeof props.value === "number" ? props.value : Number(props.value ?? 0)}
        onChange={props.onChange}
      />
    );
  }

  return (
    <input
      value={String(props.value ?? "")}
      onChange={(event) => props.onChange(event.target.value)}
    />
  );
}

export function BottomRulePanel() {
  const store = useProjectStore();
  const {
    project,
    activePictureId,
    selection,
    selectRule,
    addRule,
    duplicateRule,
    deleteRule,
    updateRuleField,
    updateRuleEventField,
    ensureRuleCondition,
    clearRuleCondition,
    updateRuleConditionGroupField,
    addRuleConditionItem,
    updateRuleConditionItemField,
    deleteRuleConditionItem,
    addRuleAction,
    updateRuleActionField,
    deleteRuleAction,
  } = store;

  const rules = useMemo(
    () => project.rules.filter((rule) => rule.pictureId === activePictureId),
    [project.rules, activePictureId],
  );

  const selectedRule =
    selection.kind === "rule"
      ? project.rules.find((rule) => rule.id === selection.ruleId)
      : rules[0];

  const selectedPicture = selectedRule
    ? project.pictures.find((picture) => picture.id === selectedRule.pictureId)
    : undefined;

  const widgetOptions = selectedPicture?.widgets ?? [];
  const variableOptions = project.variables;
  const boolVariableOptions = project.variables.filter((variable) => variable.type === "bool");
  const timerOptions = project.timers;

  return (
    <section className="bottom-rule-panel panel">
      <div className="panel-header">
        <h2>规则</h2>
        <button type="button" className="mini-button" onClick={addRule}>
          + 规则
        </button>
      </div>
      <div className="panel-body rule-panel-layout">
        <div className="rule-list">
          {rules.length ? (
            rules.map((rule) => {
              const isSelected =
                selection.kind === "rule" &&
                selection.pictureId === rule.pictureId &&
                selection.ruleId === rule.id;
              return (
                <div
                  key={rule.id}
                  className={`rule-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => selectRule(rule.pictureId, rule.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectRule(rule.pictureId, rule.id);
                    }
                  }}
                >
                  <div className="rule-card-main">
                    <strong>{rule.id}</strong>
                    <span>{summarizeRule(rule)}</span>
                  </div>
                  <div className="entity-actions">
                    <button
                      type="button"
                      className="mini-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        duplicateRule(rule.id);
                      }}
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      className="mini-button danger-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteRule(rule.id);
                      }}
                    >
                      删
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="placeholder-item">当前页面还没有规则，先新增一条规则。</div>
          )}
        </div>

        <div className="rule-editor">
          {selectedRule ? (
            <>
              <div className="rule-editor-grid">
                <FieldRow label="规则标识">
                  <input
                    value={selectedRule.id}
                    onChange={(event) => updateRuleField(selectedRule.id, "id", event.target.value)}
                  />
                </FieldRow>
                <FieldRow label="页面">
                  <select
                    value={selectedRule.pictureId}
                    onChange={(event) =>
                      updateRuleField(selectedRule.id, "pictureId", event.target.value)
                    }
                  >
                    {project.pictures.map((picture) => (
                      <option key={picture.id} value={picture.id}>
                        {picture.name}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow label="事件">
                  <select
                    value={selectedRule.event.kind}
                    onChange={(event) =>
                      updateRuleEventField(selectedRule.id, "kind", event.target.value)
                    }
                  >
                    {eventKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                {"key" in selectedRule.event && (
                  <FieldRow label="按键">
                    <select
                      value={selectedRule.event.key}
                      onChange={(event) =>
                        updateRuleEventField(selectedRule.id, "key", event.target.value)
                      }
                    >
                      {keyOptions.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                )}
                {"timerId" in selectedRule.event && (
                  <FieldRow label="定时器">
                    <select
                      value={selectedRule.event.timerId}
                      onChange={(event) =>
                        updateRuleEventField(selectedRule.id, "timerId", event.target.value)
                      }
                    >
                      {timerOptions.map((timer) => (
                        <option key={timer.id} value={timer.id}>
                          {timer.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                )}
                {"variableId" in selectedRule.event && (
                  <FieldRow label="变量">
                    <select
                      value={selectedRule.event.variableId}
                      onChange={(event) =>
                        updateRuleEventField(selectedRule.id, "variableId", event.target.value)
                      }
                    >
                      {variableOptions.map((variable) => (
                        <option key={variable.id} value={variable.id}>
                          {variable.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                )}
                {"widgetId" in selectedRule.event && (
                  <FieldRow label="控件">
                    <select
                      value={selectedRule.event.widgetId}
                      onChange={(event) =>
                        updateRuleEventField(selectedRule.id, "widgetId", event.target.value)
                      }
                    >
                      {widgetOptions.map((widget) => (
                        <option key={widget.id} value={widget.id}>
                          {widget.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                )}
                <label className="field-check">
                  <BoolInput
                    value={selectedRule.stopAfterMatch}
                    onChange={(value) =>
                      updateRuleField(selectedRule.id, "stopAfterMatch", value)
                    }
                  />
                  <span>命中后停止</span>
                </label>
              </div>

              <div className="rule-actions-head">
                <strong>条件</strong>
                <div className="inline-actions">
                  {selectedRule.condition ? (
                    <>
                      <select
                        value="variableCompare"
                        onChange={(event) => {
                          addRuleConditionItem(
                            selectedRule.id,
                            event.target.value as ConditionItem["kind"],
                          );
                        }}
                      >
                        {conditionKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => clearRuleCondition(selectedRule.id)}
                      >
                        清空
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => ensureRuleCondition(selectedRule.id)}
                    >
                      + 条件
                    </button>
                  )}
                </div>
              </div>

              {selectedRule.condition ? (
                <div className="stack-list compact-list">
                  <FieldRow label="条件模式">
                    <select
                      value={selectedRule.condition.mode}
                      onChange={(event) =>
                        updateRuleConditionGroupField(
                          selectedRule.id,
                          "mode",
                          event.target.value as RuleConditionMode,
                        )
                      }
                    >
                      {conditionModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </FieldRow>

                  {selectedRule.condition.items.map((condition, index) => {
                    const conditionVariable =
                      condition.kind === "variableCompare"
                        ? variableOptions.find((variable) => variable.id === condition.variableId)
                        : undefined;

                    return (
                      <div key={`${selectedRule.id}-condition-${index}`} className="action-editor-card">
                        <FieldRow label="类型">
                          <select
                            value={condition.kind}
                            onChange={(event) =>
                              updateRuleConditionItemField(
                                selectedRule.id,
                                index,
                                "kind",
                                event.target.value,
                              )
                            }
                          >
                            {conditionKinds.map((kind) => (
                              <option key={kind} value={kind}>
                                {kind}
                              </option>
                            ))}
                          </select>
                        </FieldRow>

                        {condition.kind === "variableCompare" && (
                          <>
                            <FieldRow label="变量">
                              <select
                                value={condition.variableId}
                                onChange={(event) =>
                                  updateRuleConditionItemField(
                                    selectedRule.id,
                                    index,
                                    "variableId",
                                    event.target.value,
                                  )
                                }
                              >
                                {variableOptions.map((variable) => (
                                  <option key={variable.id} value={variable.id}>
                                    {variable.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="运算符">
                              <select
                                value={condition.operator}
                                onChange={(event) =>
                                  updateRuleConditionItemField(
                                    selectedRule.id,
                                    index,
                                    "operator",
                                    event.target.value,
                                  )
                                }
                              >
                                {["eq", "neq", "gt", "gte", "lt", "lte"].map((operator) => (
                                  <option key={operator} value={operator}>
                                    {operator}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="比较值">
                              <VariableValueInput
                                variable={conditionVariable}
                                value={condition.value}
                                onChange={(value) =>
                                  updateRuleConditionItemField(selectedRule.id, index, "value", value)
                                }
                              />
                            </FieldRow>
                          </>
                        )}

                        {condition.kind === "widgetSelected" && (
                          <>
                            <FieldRow label="控件">
                              <select
                                value={condition.widgetId}
                                onChange={(event) =>
                                  updateRuleConditionItemField(
                                    selectedRule.id,
                                    index,
                                    "widgetId",
                                    event.target.value,
                                  )
                                }
                              >
                                {widgetOptions.map((widget) => (
                                  <option key={widget.id} value={widget.id}>
                                    {widget.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="索引">
                              <NumberInput
                                value={condition.index}
                                onChange={(value) =>
                                  updateRuleConditionItemField(selectedRule.id, index, "index", value)
                                }
                              />
                            </FieldRow>
                          </>
                        )}

                        {condition.kind === "widgetVisible" && (
                          <>
                            <FieldRow label="控件">
                              <select
                                value={condition.widgetId}
                                onChange={(event) =>
                                  updateRuleConditionItemField(
                                    selectedRule.id,
                                    index,
                                    "widgetId",
                                    event.target.value,
                                  )
                                }
                              >
                                {widgetOptions.map((widget) => (
                                  <option key={widget.id} value={widget.id}>
                                    {widget.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="可见">
                              <select
                                value={String(condition.visible)}
                                onChange={(event) =>
                                  updateRuleConditionItemField(
                                    selectedRule.id,
                                    index,
                                    "visible",
                                    event.target.value === "true",
                                  )
                                }
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            </FieldRow>
                          </>
                        )}

                        {condition.kind === "timerEnabled" && (
                          <>
                            <FieldRow label="定时器">
                              <select
                                value={condition.timerId}
                                onChange={(event) =>
                                  updateRuleConditionItemField(
                                    selectedRule.id,
                                    index,
                                    "timerId",
                                    event.target.value,
                                  )
                                }
                              >
                                {timerOptions.map((timer) => (
                                  <option key={timer.id} value={timer.id}>
                                    {timer.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="启用">
                              <select
                                value={String(condition.enabled)}
                                onChange={(event) =>
                                  updateRuleConditionItemField(
                                    selectedRule.id,
                                    index,
                                    "enabled",
                                    event.target.value === "true",
                                  )
                                }
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            </FieldRow>
                          </>
                        )}

                        <div className="entity-actions">
                          <button
                            type="button"
                            className="mini-button danger-button"
                            onClick={() => deleteRuleConditionItem(selectedRule.id, index)}
                          >
                            删除条件
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="placeholder-item">没有条件。该规则会在事件触发时直接命中。</div>
              )}

              <div className="rule-actions-head">
                <strong>动作</strong>
                <div className="inline-actions">
                  <select
                    value="gotoPicture"
                    onChange={(event) =>
                      addRuleAction(selectedRule.id, event.target.value as Action["type"])
                    }
                  >
                    {actionTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="stack-list compact-list">
                {selectedRule.actions.length ? (
                  selectedRule.actions.map((action, index) => {
                    const actionVariable =
                      "variableId" in action
                        ? variableOptions.find((variable) => variable.id === action.variableId)
                        : undefined;

                    return (
                      <div key={`${selectedRule.id}-${index}`} className="action-editor-card">
                        <FieldRow label="类型">
                          <input readOnly value={action.type} />
                        </FieldRow>

                        {action.type === "gotoPicture" && (
                          <FieldRow label="页面">
                            <select
                              value={action.pictureId}
                              onChange={(event) =>
                                updateRuleActionField(selectedRule.id, index, "pictureId", event.target.value)
                              }
                            >
                              {project.pictures.map((picture) => (
                                <option key={picture.id} value={picture.id}>
                                  {picture.name}
                                </option>
                              ))}
                            </select>
                          </FieldRow>
                        )}

                        {action.type === "setVariable" && (
                          <>
                            <FieldRow label="变量">
                              <select
                                value={action.variableId}
                                onChange={(event) =>
                                  updateRuleActionField(selectedRule.id, index, "variableId", event.target.value)
                                }
                              >
                                {variableOptions.map((variable) => (
                                  <option key={variable.id} value={variable.id}>
                                    {variable.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="值">
                              <VariableValueInput
                                variable={actionVariable}
                                value={action.value}
                                onChange={(value) =>
                                  updateRuleActionField(selectedRule.id, index, "value", value)
                                }
                              />
                            </FieldRow>
                          </>
                        )}

                        {(action.type === "setVariableFromVariable" ||
                          action.type === "addVariableFromVariable") && (
                          <>
                            <FieldRow label="变量">
                              <select
                                value={action.variableId}
                                onChange={(event) =>
                                  updateRuleActionField(selectedRule.id, index, "variableId", event.target.value)
                                }
                              >
                                {variableOptions.map((variable) => (
                                  <option key={variable.id} value={variable.id}>
                                    {variable.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="来源变量">
                              <select
                                value={action.fromVariableId}
                                onChange={(event) =>
                                  updateRuleActionField(selectedRule.id, index, "fromVariableId", event.target.value)
                                }
                              >
                                {variableOptions.map((variable) => (
                                  <option key={variable.id} value={variable.id}>
                                    {variable.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                          </>
                        )}

                        {(action.type === "increaseVariable" || action.type === "decreaseVariable") && (
                          <>
                            <FieldRow label="变量">
                              <select
                                value={action.variableId}
                                onChange={(event) =>
                                  updateRuleActionField(selectedRule.id, index, "variableId", event.target.value)
                                }
                              >
                                {variableOptions.map((variable) => (
                                  <option key={variable.id} value={variable.id}>
                                    {variable.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="步进">
                              <NumberInput
                                value={action.step}
                                onChange={(value) =>
                                  updateRuleActionField(selectedRule.id, index, "step", value)
                                }
                              />
                            </FieldRow>
                          </>
                        )}

                        {action.type === "setWidgetProp" && (
                          <>
                            <FieldRow label="控件">
                              <select
                                value={action.widgetId}
                                onChange={(event) =>
                                  updateRuleActionField(selectedRule.id, index, "widgetId", event.target.value)
                                }
                              >
                                {widgetOptions.map((widget) => (
                                  <option key={widget.id} value={widget.id}>
                                    {widget.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="属性">
                              <select
                                value={action.prop}
                                onChange={(event) =>
                                  updateRuleActionField(selectedRule.id, index, "prop", event.target.value)
                                }
                              >
                                {["visible", "enabled", "selectedIndex", "focusIndex"].map((prop) => (
                                  <option key={prop} value={prop}>
                                    {prop}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="值">
                              {action.prop === "visible" || action.prop === "enabled" ? (
                                <select
                                  value={String(action.value)}
                                  onChange={(event) =>
                                    updateRuleActionField(
                                      selectedRule.id,
                                      index,
                                      "value",
                                      event.target.value === "true",
                                    )
                                  }
                                >
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : (
                                <NumberInput
                                  value={typeof action.value === "number" ? action.value : Number(action.value ?? 0)}
                                  onChange={(value) =>
                                    updateRuleActionField(selectedRule.id, index, "value", value)
                                  }
                                />
                              )}
                            </FieldRow>
                          </>
                        )}

                        {(action.type === "selectNext" ||
                          action.type === "selectPrev" ||
                          action.type === "showNotice" ||
                          action.type === "hideNotice" ||
                          action.type === "textCharNext" ||
                          action.type === "textCharPrev") && (
                          <FieldRow label="控件">
                            <select
                              value={action.widgetId}
                              onChange={(event) =>
                                updateRuleActionField(selectedRule.id, index, "widgetId", event.target.value)
                              }
                            >
                              {widgetOptions.map((widget) => (
                                <option key={widget.id} value={widget.id}>
                                  {widget.name}
                                </option>
                              ))}
                            </select>
                          </FieldRow>
                        )}

                        {action.type === "negateVariable" && (
                          <FieldRow label="变量">
                            <select
                              value={action.variableId}
                              onChange={(event) =>
                                updateRuleActionField(selectedRule.id, index, "variableId", event.target.value)
                              }
                            >
                              {variableOptions.map((variable) => (
                                <option key={variable.id} value={variable.id}>
                                  {variable.name}
                                </option>
                              ))}
                            </select>
                          </FieldRow>
                        )}

                        {action.type === "showNotice" && (
                          <FieldRow label="文本">
                            <input
                              value={action.text ?? ""}
                              onChange={(event) =>
                                updateRuleActionField(selectedRule.id, index, "text", event.target.value)
                              }
                            />
                          </FieldRow>
                        )}

                        {(action.type === "focusNext" || action.type === "focusPrev") && (
                          <FieldRow label="控件">
                            <select
                              value={action.widgetId ?? ""}
                              onChange={(event) =>
                                updateRuleActionField(selectedRule.id, index, "widgetId", event.target.value)
                              }
                            >
                              <option value="">全局焦点循环</option>
                              {widgetOptions.map((widget) => (
                                <option key={widget.id} value={widget.id}>
                                  {widget.name}
                                </option>
                              ))}
                            </select>
                          </FieldRow>
                        )}

                        {action.type === "pushGraphValue" && (
                          <>
                            <FieldRow label="控件">
                              <select
                                value={action.widgetId}
                                onChange={(event) =>
                                  updateRuleActionField(selectedRule.id, index, "widgetId", event.target.value)
                                }
                              >
                                {widgetOptions.map((widget) => (
                                  <option key={widget.id} value={widget.id}>
                                    {widget.name}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                            <FieldRow label="来源">
                              <select
                                value={action.valueSource}
                                onChange={(event) =>
                                  updateRuleActionField(
                                    selectedRule.id,
                                    index,
                                    "valueSource",
                                    event.target.value,
                                  )
                                }
                              >
                                <option value="literal">固定值</option>
                                <option value="fromVariable">变量值</option>
                              </select>
                            </FieldRow>
                            {action.valueSource === "literal" ? (
                              <FieldRow label="值">
                                <NumberInput
                                  value={action.value ?? 0}
                                  onChange={(value) =>
                                    updateRuleActionField(selectedRule.id, index, "value", value)
                                  }
                                />
                              </FieldRow>
                            ) : (
                              <FieldRow label="变量">
                                <select
                                  value={action.fromVariableId ?? ""}
                                  onChange={(event) =>
                                    updateRuleActionField(
                                      selectedRule.id,
                                      index,
                                      "fromVariableId",
                                      event.target.value,
                                    )
                                  }
                                >
                                  {variableOptions.map((variable) => (
                                    <option key={variable.id} value={variable.id}>
                                      {variable.name}
                                    </option>
                                  ))}
                                </select>
                              </FieldRow>
                            )}
                          </>
                        )}

                        {action.type === "clearGraphBuffer" && (
                          <FieldRow label="控件">
                            <select
                              value={action.widgetId}
                              onChange={(event) =>
                                updateRuleActionField(selectedRule.id, index, "widgetId", event.target.value)
                              }
                            >
                              {widgetOptions.map((widget) => (
                                <option key={widget.id} value={widget.id}>
                                  {widget.name}
                                </option>
                              ))}
                            </select>
                          </FieldRow>
                        )}

                        {(action.type === "startTimer" || action.type === "stopTimer") && (
                          <FieldRow label="定时器">
                            <select
                              value={action.timerId}
                              onChange={(event) =>
                                updateRuleActionField(selectedRule.id, index, "timerId", event.target.value)
                              }
                            >
                              {timerOptions.map((timer) => (
                                <option key={timer.id} value={timer.id}>
                                  {timer.name}
                                </option>
                              ))}
                            </select>
                          </FieldRow>
                        )}

                        {action.type === "toggleBool" && (
                          <FieldRow label="变量">
                            <select
                              value={action.variableId}
                              onChange={(event) =>
                                updateRuleActionField(selectedRule.id, index, "variableId", event.target.value)
                              }
                            >
                              {boolVariableOptions.map((variable) => (
                                <option key={variable.id} value={variable.id}>
                                  {variable.name}
                                </option>
                              ))}
                            </select>
                          </FieldRow>
                        )}

                        <div className="entity-actions">
                          <button
                            type="button"
                            className="mini-button danger-button"
                            onClick={() => deleteRuleAction(selectedRule.id, index)}
                          >
                            删除动作
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="placeholder-item">该规则还没有动作。</div>
                )}
              </div>
            </>
          ) : (
            <div className="placeholder-item">请选择一条规则来编辑事件、条件和动作。</div>
          )}
        </div>
      </div>
    </section>
  );
}
