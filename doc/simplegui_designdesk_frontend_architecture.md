# SimpleGUI Design Desk 前端架构设计

## 1. 文档目的

本文档用于定义 `SimpleGUI Design Desk` 的前端实现结构，作为：

- 页面与组件拆分依据
- 状态管理拆分依据
- 画布编辑器与模拟器实现依据
- 后续接入 `Wasm` 的预留架构依据

项目路径：

- `F:\002-Programming_File\codex\mspm0g3507\simplegui_designdesk`

## 2. 技术栈建议

建议采用：

- `Vite`
- `React`
- `TypeScript`
- `Zustand`
- `Canvas`

建议理由：

- `Vite` 适合快速迭代本地工具型项目
- `React` 适合状态驱动的编辑器 UI
- `TypeScript` 适合约束 JSON schema、控件属性和规则模型
- `Zustand` 足够轻量，适合拆分编辑态和模拟态状态
- `Canvas` 适合单色屏像素模拟

## 3. 前端整体结构

建议整体采用“单页应用 + 模块化状态 + 双运行模式”：

- `Edit Mode`
- `Simulate Mode`

其中：

- `Edit Mode` 负责编辑工程定义
- `Simulate Mode` 负责运行时预览

两者共享同一份工程数据模型，但不共享运行时状态。

## 4. 页面布局

建议采用固定工作台布局：

### 4.1 左侧栏

用于工程导航：

- `Pictures`
- `Widgets`
- `Variables`
- `Timers`
- `Resources`

### 4.2 中央工作区

用于画布编辑与模拟：

- 顶部工具栏
- 中部 `128x64` 预览画布
- 底部虚拟按键和运行调试条

### 4.3 右侧栏

用于属性编辑：

- `Common`
- `Layout`
- `Props`
- `References`

### 4.4 底部规则面板

用于当前画面的规则列表和规则编辑器。

## 5. 推荐目录结构

建议目录结构如下：

```text
simplegui_designdesk
├─ doc
├─ src
│  ├─ app
│  ├─ components
│  ├─ editor
│  ├─ simulator
│  ├─ schema
│  ├─ stores
│  ├─ widgets
│  ├─ rules
│  ├─ resources
│  ├─ utils
│  ├─ styles
│  ├─ types
│  └─ main.tsx
├─ public
└─ package.json
```

各目录建议职责如下：

- `app`
  - 应用外壳、模式切换、整体布局
- `components`
  - 通用 UI 组件
- `editor`
  - 画布编辑、选择、拖拽、缩放、吸附、历史栈
- `simulator`
  - 运行时、事件队列、定时器、重绘
- `schema`
  - JSON schema、默认工程模板、校验器
- `stores`
  - 前端状态管理
- `widgets`
  - 7 个控件的配置面板与预览绘制器
- `rules`
  - 规则编辑 UI、规则模板、规则摘要
- `resources`
  - 图片导入、二值化、单色位图转换
- `utils`
  - 通用工具函数
- `styles`
  - 全局样式与主题
- `types`
  - TypeScript 类型定义

## 6. 组件拆分建议

### 6.1 应用外壳组件

- `AppShell`
- `TopToolbar`
- `LeftSidebar`
- `RightInspector`
- `BottomRulePanel`
- `StatusBar`

### 6.2 左侧栏组件

- `PictureTree`
- `WidgetList`
- `VariableList`
- `TimerList`
- `ResourceList`

### 6.3 中央编辑器组件

- `CanvasViewport`
- `PixelScreen`
- `SelectionOverlay`
- `ResizeHandles`
- `AlignmentGuides`
- `VirtualKeyboard`

### 6.4 右侧属性面板组件

- `CommonPropsPanel`
- `LayoutPropsPanel`
- `WidgetPropsPanel`
- `ReferencePanel`

### 6.5 规则编辑组件

- `RuleList`
- `RuleCard`
- `RuleEditor`
- `EventEditor`
- `ConditionEditor`
- `ActionEditor`
- `RuleTemplatePicker`

## 7. 状态管理拆分建议

建议拆成 4 个 store：

### 7.1 `projectStore`

负责保存工程定义本身：

- `project`
- `screen`
- `resources`
- `variables`
- `timers`
- `pictures`
- `rules`
- `simulator`

典型动作：

- `loadProject`
- `replaceProject`
- `updatePicture`
- `updateWidget`
- `updateVariable`
- `updateRule`
- `deleteReferenceAware`
- `exportProject`

### 7.2 `editorStore`

负责编辑态上下文：

- 当前模式
- 当前选中的 `pictureId`
- 当前选中的 `widgetId`
- 当前选中的 `ruleId`
- 当前缩放倍数
- 画布滚动偏移
- 历史栈

典型动作：

- `selectPicture`
- `selectWidget`
- `selectRule`
- `setZoom`
- `pushHistory`
- `undo`
- `redo`

### 7.3 `simulatorStore`

负责运行时状态：

- `currentPictureId`
- `pictureHistoryStack`
- `variableStore`
- `widgetRuntimeState`
- `timerRuntimeState`
- `eventQueue`
- `focusedWidgetId`
- `graphBuffers`
- `logs`

典型动作：

- `boot`
- `shutdown`
- `dispatchKey`
- `dispatchTimer`
- `runLoop`
- `executeRule`
- `executeAction`
- `repaint`

### 7.4 `uiStore`

负责不进入工程文件的本地 UI 状态：

- 左右栏折叠
- 面板标签页
- 临时导入预览
- 对话框开关
- Toast

## 8. 数据流设计

### 8.1 编辑态数据流

```text
用户操作
-> 编辑器组件
-> editorStore / projectStore
-> schema 校验
-> 重新渲染画布与属性面板
```

### 8.2 模拟态数据流

```text
键盘/虚拟按键/定时器
-> simulatorStore.eventQueue
-> 匹配 rules
-> 执行 actions
-> 更新运行时变量与控件状态
-> 统一 repaint
```

### 8.3 保存与加载数据流

```text
projectStore
-> 序列化 JSON
-> 下载/写入本地

本地 JSON
-> 解析
-> schema 校验
-> replaceProject
```

## 9. Canvas 画布架构

建议将画布拆成三层逻辑：

### 9.1 基础像素层

负责单色逻辑帧缓冲渲染：

- 背景
- 像素点
- 可选网格

### 9.2 控件渲染层

负责当前画面中所有控件的预览绘制。

### 9.3 编辑辅助层

负责：

- 选中框
- 拖拽手柄
- 吸附线
- 焦点提示

说明：

- 编辑辅助层只在 `Edit Mode` 显示
- 模拟器焦点框只在 `Simulate Mode` 显示

## 10. 7 个控件的前端落地方式

建议每个控件都拆成一组文件：

```text
widgets/list
├─ list.defaults.ts
├─ list.types.ts
├─ list.renderer.ts
├─ list.inspector.tsx
└─ list.runtime.ts
```

每个控件都包含：

- 默认值定义
- 属性类型定义
- 编辑态渲染器
- 属性面板
- 模拟态运行逻辑

## 11. 规则系统前端落地方式

建议规则系统拆成三层：

### 11.1 规则数据层

负责：

- 规则结构
- 条件结构
- 动作结构
- 规则模板

### 11.2 规则编辑层

负责：

- 规则表单编辑
- 条件增删
- 动作增删
- 规则顺序调整

### 11.3 规则执行层

负责：

- 事件匹配
- 条件求值
- 动作执行
- 队列调度

## 12. 资源导入模块设计

导入流程建议如下：

1. 读取原始文件
2. 解码图片
3. 按目标逻辑尺寸预览
4. 灰度化
5. 二值化
6. 生成单色位图
7. 写入 `resource.bitmap.rows`

建议支持：

- 阈值调节
- 反色
- 裁剪
- 等比缩放

`v1` 不建议支持：

- 手工逐像素编辑
- 图层混合

## 13. 校验系统设计

建议校验分两层：

### 13.1 即时校验

在编辑过程中即时给出错误和警告：

- 非法尺寸
- 类型不匹配
- 重复 ID
- 引用丢失

### 13.2 保存前完整校验

在导出工程前运行完整校验：

- 所有引用有效
- 所有必填字段完整
- 所有控件属性满足 schema
- 起始画面有效

## 14. 历史栈设计

建议采用快照型历史栈，先保证可靠性。

优点：

- 实现简单
- 容易调试
- 对 `v1` 足够稳定

建议策略：

- 每次完成一个原子编辑动作后写入历史
- 拖动过程中不连续写入
- 进入模拟模式不记录历史

后续若性能不足，再切增量 patch 历史。

## 15. 模拟器与编辑器解耦原则

必须坚持以下原则：

- 编辑器不直接改运行时状态
- 模拟器不反写工程定义
- 同一控件在编辑态和模拟态有不同职责
- 所有运行时数据都放在 `simulatorStore`

这样后续接入 `Wasm` 时，替换的只会是模拟态执行层和渲染层，不会推翻整个编辑器。

## 16. Wasm 预留点

虽然 `v1` 不直接上 `Wasm`，但应预留：

- 统一的运行时接口
- 统一的像素设备接口
- 统一的键盘事件接口
- 统一的重绘请求接口

建议抽象一个接口层：

```ts
interface DesignDeskRuntime {
  boot(project: ProjectData): void;
  shutdown(): void;
  dispatchKey(key: RuntimeKey): void;
  tick(ms: number): void;
  getFrameBuffer(): Uint8Array;
  getLogs(): RuntimeLog[];
}
```

`v1` 先由 TypeScript 实现此接口。
后续可由 `Wasm` 实现相同接口。

## 17. 推荐的最小实现顺序

建议按照以下顺序落地：

1. 搭建 `Vite + React + TypeScript`
2. 定义 `types` 和默认工程模板
3. 搭建页面骨架
4. 实现 `projectStore` 与 `editorStore`
5. 实现画布、选中、移动、缩放
6. 实现 7 个控件编辑态渲染
7. 实现变量、资源、定时器编辑
8. 实现规则编辑器
9. 实现 `simulatorStore`
10. 联调示例工程

## 18. 当前文档与其他文档关系

建议与以下文档配合使用：

- `simplegui_designdesk_v1_spec.md`
- `simplegui_designdesk_json_examples.md`
- `simplegui_designdesk_task_breakdown.md`

