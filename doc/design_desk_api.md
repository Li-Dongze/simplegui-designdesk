# SimpleGUI 设计台 API（精简版）

## 入口

- 全局对象：`window.SimpleGUIDesignDeskApi`

## 快速示例（浏览器控制台）

```js
window.SimpleGUIDesignDeskApi.help();
window.SimpleGUIDesignDeskApi.setMode("edit");
window.SimpleGUIDesignDeskApi.setScale(12);
window.SimpleGUIDesignDeskApi.loadTemplate("blank");
window.SimpleGUIDesignDeskApi.addWidget("menu", { x: 2, y: 2 });
window.SimpleGUIDesignDeskApi.setMode("simulate");
```

## 常用读取接口

```js
const snap = window.SimpleGUIDesignDeskApi.snapshot();
const text = window.SimpleGUIDesignDeskApi.projectText();
const ir = window.SimpleGUIDesignDeskApi.exportArtifact("ir");
```

## 模拟器接口

```js
window.SimpleGUIDesignDeskApi.restartSimulation();
window.SimpleGUIDesignDeskApi.sendSimulatorKey("down");
window.SimpleGUIDesignDeskApi.sendSimulatorKey("enter");
window.SimpleGUIDesignDeskApi.tickSimulation(Date.now());
```

## 示例能力

```js
window.SimpleGUIDesignDeskApi.buildThreeLevelMenu3x3();
await window.SimpleGUIDesignDeskApi.playIkunBmpVideo(18);
window.SimpleGUIDesignDeskApi.startDinoGame();
window.SimpleGUIDesignDeskApi.stopDinoGame();
```

## 说明

- 不再包含协作面板脚本执行与操作日志相关接口。
- `setScale` 支持 `1~40`，超出范围会被自动夹紧。
- `loadProjectText` 支持直接导入项目 JSON 字符串。
