# SimpleGUI Design Desk V1 规格与实现思路

## 1. 文档目的

本文档用于约束 `SimpleGUI Design Desk` 的 `v1` 版本设计目标、工程文件格式、编辑器交互、模拟器运行语义与实现思路。

项目路径：

- `F:\002-Programming_File\codex\mspm0g3507\simplegui_designdesk`

本文档面向两个目标：

- 为网页设计台前端实现提供统一规格。
- 为后续将设计文件转化为 `MSPM0G3507 + SimpleGUI` 工程代码提供稳定输入格式。

## 2. 背景与依据

本设计台面向的不是通用 GUI 库，而是工作区中的 `SimpleGUI` 开源工程：

- `F:\002-Programming_File\codex\mspm0g3507\lcd_ui\simplegui`

本规格主要参考以下资料：

- `F:\002-Programming_File\codex\mspm0g3507\lcd_ui\simplegui\README.md`
- `F:\002-Programming_File\codex\mspm0g3507\lcd_ui\simplegui\Documents\01-快速开始SimpleGUI.md`
- `F:\002-Programming_File\codex\mspm0g3507\lcd_ui\simplegui\Documents\02-移植演示程序.md`
- `F:\002-Programming_File\codex\mspm0g3507\lcd_ui\simplegui\Documents\03-SimpleGUI的简单应用.md`
- `F:\002-Programming_File\codex\mspm0g3507\lcd_ui\simplegui\Documents\SimpleGUI user manual.md`
- `F:\002-Programming_File\codex\mspm0g3507\lcd_ui\simplegui\GUI\inc\SGUI_Typedef.h`
- `F:\002-Programming_File\codex\mspm0g3507\lcd_ui\simplegui\HMI\inc\HMI_Engine.h`
- `F:\002-Programming_File\codex\mspm0g3507\lcd_ui\simplegui\DemoProc\src\DemoProc.c`

## 3. SimpleGUI 能力抽象

`SimpleGUI` 的核心结构可抽象为四层：

1. 显示设备抽象层
2. 基础绘图层
3. 控件层
4. HMI 交互引擎层

对设计台来说，最关键的建模对象不是“窗口”和“图层”，而是：

- `Screen`
- `Picture`
- `Widget`
- `Variable`
- `Timer`
- `Rule`
- `Resource`

## 4. V1 产品定位

`v1` 的定位是：

- 本地网页应用
- 可视化界面编辑器
- 可视化交互逻辑编辑器
- 单色屏实时模拟器
- 单文件 JSON 工程保存与加载

`v1` 明确不做：

- C 代码自动生成
- MSPM0 工程自动生成
- 多分辨率支持
- 自定义脚本引擎
- 通用自由绘图编辑器

## 5. V1 范围

### 5.1 固定目标屏幕

- 宽度：`128`
- 高度：`64`
- 单色

### 5.2 支持控件

`v1` 仅支持以下控件：

- `List`
- `Menu`
- `Notice`
- `NumberVariableBox`
- `TextVariableBox`
- `RealtimeGraph`
- `ProcessBar`

### 5.3 支持交互来源

- 抽象按键：`up/down/left/right/enter/esc/tab/space`
- 原始键码：兼容 `DemoActions.h`
- 周期定时器
- 变量变化
- 控件焦点变化
- 控件选中变化
- 控件确认事件

### 5.4 支持资源

- `png`
- `bmp`
- `svg`

导入后统一转单色位图。

## 6. 核心数据模型

### 6.1 Screen

表示整个设备显示配置。

字段：

- `width`
- `height`
- `foreground`
- `background`
- `buffered`

### 6.2 Picture

对应一个 HMI 画面对象。

字段：

- `id`
- `name`
- `title`
- `widgets`
- `enterActions`
- `leaveActions`

### 6.3 Widget

对应一个控件实例。

公共字段：

- `id`
- `type`
- `name`
- `rect`
- `visible`
- `enabled`
- `focusable`
- `zIndex`
- `props`

### 6.4 Variable

表示控件和逻辑使用的数据。

字段：

- `id`
- `name`
- `type`
- `initial`
- `min`
- `max`
- `step`
- `length`
- `readonly`

### 6.5 Timer

表示模拟器定时事件源。

字段：

- `id`
- `name`
- `intervalMs`
- `repeat`
- `enabledOnStart`
- `targetPictureId`

### 6.6 Rule

表示无代码交互逻辑。

字段：

- `id`
- `pictureId`
- `event`
- `condition`
- `actions`
- `stopAfterMatch`

### 6.7 Resource

表示位图和图标资源。

字段：

- `id`
- `name`
- `kind`
- `source`
- `bitmap`

## 7. JSON 工程文件格式

### 7.1 顶层结构

```json
{
  "version": 1,
  "project": {},
  "screen": {},
  "resources": [],
  "variables": [],
  "timers": [],
  "pictures": [],
  "rules": [],
  "simulator": {}
}
```

### 7.2 顶层字段说明

- `version`
  - 当前固定为 `1`
- `project`
  - 工程元数据
- `screen`
  - 目标屏幕配置
- `resources`
  - 资源表
- `variables`
  - 变量表
- `timers`
  - 定时器表
- `pictures`
  - 画面表
- `rules`
  - 规则表
- `simulator`
  - 模拟器配置

### 7.3 基础约束

- 所有 `id` 在自身作用域内必须唯一
- `screen.width` 固定为 `128`
- `screen.height` 固定为 `64`
- 所有控件矩形必须完整落在屏幕内
- `startPictureId` 必须指向现有画面

## 8. 7 个控件的属性模型

### 8.1 List

字段：

- `title`
- `font`
- `items`
- `selectedIndex`
- `showScrollbar`

默认值：

```json
{
  "title": "List",
  "font": "SGUI_DEFAULT_FONT_8",
  "items": [
    { "id": "item_1", "label": "Item 1", "dynamicTextVarId": null },
    { "id": "item_2", "label": "Item 2", "dynamicTextVarId": null },
    { "id": "item_3", "label": "Item 3", "dynamicTextVarId": null }
  ],
  "selectedIndex": 0,
  "showScrollbar": true
}
```

### 8.2 Menu

字段：

- `font`
- `items`
- `selectedIndex`
- `frame`

默认值：

```json
{
  "font": "SGUI_DEFAULT_FONT_8",
  "items": [
    { "id": "menu_1", "label": "Menu 1", "dynamicTextVarId": null },
    { "id": "menu_2", "label": "Menu 2", "dynamicTextVarId": null }
  ],
  "selectedIndex": 0,
  "frame": true
}
```

说明：

- `v1` 不做内嵌层级菜单。
- 子菜单通过第二个 `Menu` 控件和规则控制实现。

### 8.3 Notice

字段：

- `text`
- `font`
- `iconResourceId`
- `textOffset`
- `autoFit`

默认值：

```json
{
  "text": "Notice",
  "font": "SGUI_DEFAULT_FONT_8",
  "iconResourceId": null,
  "textOffset": 0,
  "autoFit": true
}
```

### 8.4 NumberVariableBox

字段：

- `font`
- `alignment`
- `min`
- `max`
- `valueVarId`
- `step`

默认值：

```json
{
  "font": "SGUI_DEFAULT_FONT_8",
  "alignment": "center",
  "min": 0,
  "max": 100,
  "valueVarId": "var_number_1",
  "step": 1
}
```

### 8.5 TextVariableBox

字段：

- `font`
- `textVarId`
- `length`
- `charSet`
- `maskChar`
- `focusIndex`

默认值：

```json
{
  "font": "SGUI_DEFAULT_FONT_12",
  "textVarId": "var_text_1",
  "length": 8,
  "charSet": "ascii",
  "maskChar": null,
  "focusIndex": 0
}
```

### 8.6 RealtimeGraph

字段：

- `valueVarId`
- `min`
- `max`
- `xStepPixel`
- `enableBaseline`
- `baselineValue`
- `capacity`

默认值：

```json
{
  "valueVarId": null,
  "min": -100,
  "max": 100,
  "xStepPixel": 2,
  "enableBaseline": true,
  "baselineValue": 0,
  "capacity": 64
}
```

### 8.7 ProcessBar

字段：

- `valueVarId`
- `maxValue`
- `direction`
- `frame`

默认值：

```json
{
  "valueVarId": "var_progress_1",
  "maxValue": 100,
  "direction": "right",
  "frame": true
}
```

## 9. Rule 规则模型

### 9.1 规则结构

每条规则固定表达为：

```text
当 Event 发生
如果 Condition 成立
就执行 Actions
```

### 9.2 Event 类型

支持：

- `onKeyPress`
- `onTimer`
- `onValueChange`
- `onWidgetFocus`
- `onWidgetSelect`
- `onWidgetConfirm`

### 9.3 Condition 类型

支持：

- `variableCompare`
- `widgetSelected`
- `widgetVisible`
- `timerEnabled`

条件组合仅支持：

- `all`
- `any`

### 9.4 Action 类型

支持：

- `gotoPicture`
- `goBack`
- `setVariable`
- `increaseVariable`
- `decreaseVariable`
- `setWidgetProp`
- `selectNext`
- `selectPrev`
- `focusNext`
- `focusPrev`
- `pushGraphValue`
- `showNotice`
- `hideNotice`
- `startTimer`
- `stopTimer`
- `toggleBool`

建议补充的文本框编辑动作：

- `textCharNext`
- `textCharPrev`

说明：

- 这两个动作在当前讨论中已被认为非常有必要。
- 若后续实现时采用“控件专用模板动作”的形式，也可先作为内部编辑器动作存在，再决定是否正式入 schema。

### 9.5 Rule 执行约束

- 一条规则最多 `8` 个动作
- 一个画面最多 `40` 条规则
- 动作按顺序执行
- `gotoPicture` 和 `goBack` 为终止动作
- `stopAfterMatch=true` 时，本事件不再继续匹配当前画面的后续规则

## 10. 编辑器交互细节规范

### 10.1 编辑模式与模拟模式

设计台固定两种模式：

- `Edit Mode`
- `Simulate Mode`

规则：

- `Edit Mode` 用于编辑工程定义
- `Simulate Mode` 用于运行时预览
- 进入模拟模式时，从 `startPictureId` 冷启动
- 退出模拟模式时，运行时状态丢弃

### 10.2 画布

- 逻辑分辨率固定 `128x64`
- 默认显示缩放 `4x`
- 可选缩放：`2x/4x/6x/8x`
- 坐标始终按逻辑像素保存
- 不允许控件超出画布

### 10.3 控件操作

`v1` 只支持单选。

支持操作：

- 点击选中
- 拖动移动
- 拖拽缩放
- 删除
- 复制
- 粘贴
- 复制一份
- 属性编辑

键盘微调：

- 方向键：移动 `1px`
- `Shift + 方向键`：移动 `4px`

### 10.4 层级

- 使用 `zIndex`
- 当前画面控件列表支持上移下移顺序
- 绘制顺序：`zIndex` 升序，然后按数组顺序

### 10.5 Undo / Redo

- `Ctrl+Z`
- `Ctrl+Y`
- 最少支持 `100` 步历史
- 模拟时不记录历史

### 10.6 校验

错误级别：

- `Error`
- `Warning`

`Error` 示例：

- 重复 `id`
- 引用不存在
- 绑定类型错误
- 尺寸非法
- 画面起始 ID 无效

`Warning` 示例：

- 文字过长可能显示不全
- 图形区域过小
- 可见项目过多

## 11. 模拟器运行语义

### 11.1 运行时状态

模拟器运行时维护：

- `currentPictureId`
- `pictureHistoryStack`
- `variableStore`
- `widgetRuntimeState`
- `timerRuntimeState`
- `eventQueue`
- `focusedWidgetId`
- `graphBuffers`

### 11.2 冷启动

启动时：

- 读取 `startPictureId`
- 变量重置为 `initial`
- 控件状态重置
- 定时器按 `enabledOnStart` 初始化
- 执行画面 `enterActions`

### 11.3 画面切换

`gotoPicture`：

- 执行当前画面 `leaveActions`
- 当前画面压栈
- 切换到目标画面
- 设置焦点
- 执行目标画面 `enterActions`

`goBack`：

- 若历史栈为空则忽略
- 执行当前画面 `leaveActions`
- 弹出上一画面
- 恢复焦点
- 执行进入动作

### 11.4 焦点规则

一个控件可获得焦点需要满足：

- `visible=true`
- `enabled=true`
- `focusable=true`

进入画面时：

- 优先恢复上次焦点
- 否则取第一个可聚焦控件
- 若无可聚焦控件，则焦点为空

### 11.5 输入事件顺序

当收到一个按键时，按如下顺序处理：

1. 生成 `onKeyPress`
2. 规则匹配执行
3. 如为 `enter` 且有焦点控件，生成 `onWidgetConfirm`
4. 焦点变化时生成 `onWidgetFocus`
5. 选中变化时生成 `onWidgetSelect`
6. 变量变化时生成 `onValueChange`

所有后继事件进入事件队列顺序处理。

### 11.6 控件运行语义

#### List

- `selectNext/selectPrev` 修改 `selectedIndex`
- 选中变化触发 `onWidgetSelect`
- `enter` 只表示确认，不自动跳转

#### Menu

- 基本同 `List`
- 不内建层级语义
- 子菜单显示隐藏由规则控制

#### Notice

- 默认非模态
- `showNotice` 设为可见
- `hideNotice` 设为不可见

#### NumberVariableBox

- 显示来自变量
- 常用通过规则控制增减

#### TextVariableBox

- 运行时维护 `focusIndex`
- 左右移动焦点
- 上下修改当前字符
- `maskChar` 只影响显示

#### RealtimeGraph

- 运行时维护点缓冲
- 新值从尾部进入
- 超出容量丢弃最旧点

#### ProcessBar

- 从变量读取值
- 绘制前做范围裁剪
- 不参与焦点与确认

### 11.7 Timer

运行时属性：

- `enabled`
- `lastTickTs`

触发规则：

- `enabled=true`
- 到达 `intervalMs`
- `targetPictureId` 为当前画面或为空

## 12. 实现思路

### 12.1 技术栈建议

建议：

- `Vite`
- `React`
- `TypeScript`
- `Canvas`

原因：

- 开发快
- 类型清晰
- 适合做状态驱动的编辑器
- 后续便于接入 `Wasm`

### 12.2 前端模块划分建议

建议划分如下：

- `app`
  - 入口、路由、全局状态
- `editor`
  - 画布、选中、拖拽、缩放、历史栈
- `simulator`
  - 运行时、事件队列、定时器、渲染
- `schema`
  - JSON schema、默认值、校验器
- `widgets`
  - 7 个控件的编辑定义与渲染逻辑
- `rules`
  - 规则模型、模板、摘要生成
- `resources`
  - 图片导入与单色化
- `storage`
  - 打开、保存、草稿

### 12.3 渲染策略

`v1` 推荐：

- 前端直接维护 1bit 逻辑帧缓冲
- 再映射到 canvas 放大显示
- 每轮事件处理完成后统一重绘

### 12.4 运行时策略

`v1` 推荐：

- 使用前端自研轻量运行时
- 显式实现 `Picture + Widget + Rule + Timer`
- 先不直接复用 C 代码

后续可演进：

- 复用 `SimpleGUI GUI/HMI` 的 C 代码
- 通过 `Wasm` 在浏览器执行真实绘制与事件处理

### 12.5 资源处理策略

导入资源时：

- 统一读取为像素矩阵
- 转灰度
- 二值化
- 存为 `monoBitmap.rows`

### 12.6 需求表达用途

虽然 `v1` 不做代码生成，但工程 JSON 必须尽量贴近后续人工落地：

- 我后续可读取 `pictures`
- 读取 `widgets`
- 读取 `variables`
- 读取 `rules`
- 再手工映射为 `SimpleGUI + HMI + MSPM0G3507` 工程代码

## 13. 后续建议

当前建议的后续实施顺序：

1. 先按本文档搭建前端工程骨架
2. 落地 JSON schema 与默认工程模板
3. 实现编辑器基础能力
4. 实现 7 个控件的编辑与预览
5. 实现规则编辑器
6. 实现模拟器运行时
7. 以示例工程进行联调

## 14. 当前状态说明

本文档已覆盖：

- `v1` 目标边界
- 数据模型
- 工程文件格式
- 控件模型
- 规则模型
- 编辑器交互规范
- 模拟器运行语义
- 实现思路

后续若继续推进，可在本目录继续补充：

- `simplegui_designdesk_frontend_architecture.md`
- `simplegui_designdesk_json_examples.md`
- `simplegui_designdesk_task_breakdown.md`

当前已补充：

- `simplegui_designdesk_frontend_architecture.md`
- `simplegui_designdesk_json_examples.md`
- `simplegui_designdesk_task_breakdown.md`
