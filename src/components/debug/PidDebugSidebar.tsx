import { useEffect, useMemo, useState } from "react";
import { SidebarSection } from "@/components/layout/SidebarSection";
import { useProjectStore } from "@/stores/projectStore";
import type { IntVariable } from "@/types/project";
import { getVariableMap } from "@/utils/viewModel";

type PidRoleKey = "sp" | "pv" | "kp" | "ki" | "kd" | "err" | "u";
type RoleBindings = Record<PidRoleKey, string>;

const roleLabels: Record<PidRoleKey, string> = {
  sp: "SP 目标值",
  pv: "PV 采集值",
  kp: "Kp",
  ki: "Ki",
  kd: "Kd",
  err: "ERR 误差",
  u: "U 控制输出",
};

const roleKeywords: Record<PidRoleKey, string[]> = {
  sp: ["var_sp", "sp", "setpoint", "target", "goal", "ref"],
  pv: ["var_pv", "pv", "current", "actual", "feedback", "measure"],
  kp: ["var_kp", "kp"],
  ki: ["var_ki", "ki"],
  kd: ["var_kd", "kd"],
  err: ["var_err", "err", "error"],
  u: ["var_u", "u", "output", "control"],
};

const inputRoles: PidRoleKey[] = ["sp", "pv", "kp", "ki", "kd"];
const statusRoles: PidRoleKey[] = ["err", "u"];
const unconstrainedRoles = new Set<PidRoleKey>(["kp", "ki", "kd"]);

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "");
}

function pickRoleVariableId(role: PidRoleKey, variables: IntVariable[]): string {
  const keywords = roleKeywords[role].map(normalizeForMatch);

  for (const variable of variables) {
    const idToken = normalizeForMatch(variable.id);
    if (keywords.includes(idToken)) {
      return variable.id;
    }
  }

  for (const variable of variables) {
    const nameToken = normalizeForMatch(variable.name);
    if (keywords.includes(nameToken)) {
      return variable.id;
    }
  }

  for (const variable of variables) {
    const idToken = normalizeForMatch(variable.id);
    const nameToken = normalizeForMatch(variable.name);
    if (keywords.some((keyword) => idToken.includes(keyword) || nameToken.includes(keyword))) {
      return variable.id;
    }
  }

  return "";
}

function buildDefaultBindings(variables: IntVariable[]): RoleBindings {
  return {
    sp: pickRoleVariableId("sp", variables),
    pv: pickRoleVariableId("pv", variables),
    kp: pickRoleVariableId("kp", variables),
    ki: pickRoleVariableId("ki", variables),
    kd: pickRoleVariableId("kd", variables),
    err: pickRoleVariableId("err", variables),
    u: pickRoleVariableId("u", variables),
  };
}

function normalizeWriteValue(role: PidRoleKey, value: number, variable: IntVariable): number {
  const rounded = Math.round(value);
  if (unconstrainedRoles.has(role)) {
    return rounded;
  }

  return Math.max(variable.min, Math.min(variable.max, rounded));
}

interface ValueEditorProps {
  role: PidRoleKey;
  variable?: IntVariable;
  value: number;
  onWrite: (value: number) => void;
  withSlider?: boolean;
  unconstrained?: boolean;
}

function ValueEditor({
  role,
  variable,
  value,
  onWrite,
  withSlider = false,
  unconstrained = false,
}: ValueEditorProps) {
  const step = variable && variable.step > 0 ? variable.step : 1;
  const disabled = !variable;

  return (
    <div className="pid-value-card">
      <div className="pid-value-head">
        <strong>{roleLabels[role]}</strong>
        <span className="entity-meta">{variable?.id ?? "未映射"}</span>
      </div>
      <div className="pid-value-input-row">
        <button type="button" className="mini-button" onClick={() => onWrite(value - step)} disabled={disabled}>
          -
        </button>
        <input
          type="number"
          value={value}
          min={unconstrained ? undefined : variable?.min}
          max={unconstrained ? undefined : variable?.max}
          step={step}
          disabled={disabled}
          onChange={(event) => onWrite(Number(event.target.value))}
        />
        <button type="button" className="mini-button" onClick={() => onWrite(value + step)} disabled={disabled}>
          +
        </button>
      </div>
      {withSlider ? (
        <input
          type="range"
          value={value}
          min={variable?.min}
          max={variable?.max}
          step={step}
          disabled={disabled}
          onChange={(event) => onWrite(Number(event.target.value))}
        />
      ) : null}
    </div>
  );
}

export function PidDebugSidebar() {
  const project = useProjectStore((state) => state.project);
  const simulator = useProjectStore((state) => state.simulator);
  const restartSimulation = useProjectStore((state) => state.restartSimulation);
  const closeDebugPanel = useProjectStore((state) => state.closeDebugPanel);
  const setSimulatorVariableValue = useProjectStore((state) => state.setSimulatorVariableValue);

  const intVariables = useMemo(
    () => project.variables.filter((variable): variable is IntVariable => variable.type === "int"),
    [project.variables],
  );
  const variableMap = useMemo(() => getVariableMap(project, simulator), [project, simulator]);
  const [bindings, setBindings] = useState<RoleBindings>(() => buildDefaultBindings(intVariables));

  useEffect(() => {
    const validIds = new Set(intVariables.map((variable) => variable.id));
    setBindings((current) => {
      const defaults = buildDefaultBindings(intVariables);
      const next: RoleBindings = { ...current };
      (Object.keys(next) as PidRoleKey[]).forEach((role) => {
        if (!next[role] || !validIds.has(next[role])) {
          next[role] = defaults[role];
        }
      });
      return next;
    });
  }, [intVariables]);

  const resetBinding = () => {
    setBindings(buildDefaultBindings(intVariables));
  };

  const findVarByRole = (role: PidRoleKey): IntVariable | undefined =>
    intVariables.find((variable) => variable.id === bindings[role]);

  const readRoleValue = (role: PidRoleKey): number => {
    const variable = findVarByRole(role);
    if (!variable) {
      return 0;
    }

    const raw = variableMap.get(variable.id);
    const numeric = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const writeRoleValue = (role: PidRoleKey, value: number) => {
    const variable = findVarByRole(role);
    if (!variable || !Number.isFinite(value)) {
      return;
    }

    setSimulatorVariableValue(variable.id, normalizeWriteValue(role, value, variable));
  };

  return (
    <aside className="right-inspector panel pid-debug-sidebar">
      <SidebarSection title="PID 外部输入调试">
        <div className="stack-list compact-list">
          <div className="entity-meta">在这里调目标值、采集值，实时观察中间模拟器变化。</div>
          <div className="inline-actions">
            <button type="button" className="mini-button" onClick={resetBinding}>
              自动映射
            </button>
            <button type="button" className="mini-button" onClick={restartSimulation}>
              重启仿真
            </button>
            <button type="button" className="mini-button" onClick={closeDebugPanel}>
              退出PID调试
            </button>
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="变量映射">
        <div className="stack-list compact-list">
          {(Object.keys(roleLabels) as PidRoleKey[]).map((role) => (
            <label key={role} className="field-row">
              <span>{roleLabels[role]}</span>
              <select
                value={bindings[role]}
                onChange={(event) =>
                  setBindings((current) => ({
                    ...current,
                    [role]: event.target.value,
                  }))
                }
              >
                <option value="">未映射</option>
                {intVariables.map((variable) => (
                  <option key={variable.id} value={variable.id}>
                    {variable.name} ({variable.id})
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection title="外部输入项">
        <div className="stack-list compact-list">
          {inputRoles.map((role) => (
            <ValueEditor
              key={role}
              role={role}
              variable={findVarByRole(role)}
              value={readRoleValue(role)}
              onWrite={(value) => writeRoleValue(role, value)}
              withSlider={role === "sp" || role === "pv"}
              unconstrained={unconstrainedRoles.has(role)}
            />
          ))}
        </div>
      </SidebarSection>

      <SidebarSection title="实时状态">
        <div className="pid-status-grid">
          {statusRoles.map((role) => (
            <div key={role} className="pid-status-card">
              <strong>{roleLabels[role]}</strong>
              <span className="entity-meta">{findVarByRole(role)?.id ?? "未映射"}</span>
              <span className="pid-status-value">{readRoleValue(role)}</span>
            </div>
          ))}
        </div>
      </SidebarSection>
    </aside>
  );
}
