# SimpleGUI 设计台操作 API

## 入口
- 全局对象：`window.SimpleGUIDesignDeskApi`
- 初始化事件：`simplegui-designdesk-api-ready`

## 快速示例（浏览器控制台）
```js
window.SimpleGUIDesignDeskApi.help();
window.SimpleGUIDesignDeskApi.setMode("edit");
window.SimpleGUIDesignDeskApi.setScale(12);
window.SimpleGUIDesignDeskApi.loadTemplate("blank");
window.SimpleGUIDesignDeskApi.addWidget("menu", { x: 2, y: 2 });
window.SimpleGUIDesignDeskApi.setMode("simulate");
```

## 批量执行
```js
window.SimpleGUIDesignDeskApi.run([
  { method: "loadTemplate", args: ["blank"] },
  { method: "setScale", args: [10] },
  { method: "addPicture", args: [] },
  { method: "addWidget", args: ["list", { x: 4, y: 6 }] },
  { method: "addRule", args: [] },
]);
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

## 三层菜单示例
```js
window.SimpleGUIDesignDeskApi.buildThreeLevelMenu3x3();
```

## BMP 视频示例
```js
await window.SimpleGUIDesignDeskApi.playIkunBmpVideo(18);
window.SimpleGUIDesignDeskApi.stopVideoOverlay();
```

## Google 小恐龙示例
```js
window.SimpleGUIDesignDeskApi.startDinoGame();
// 运行中按键：up/down 跳跃（down 在空中会加速下落）
window.SimpleGUIDesignDeskApi.stopDinoGame();
```

## 说明
- `setScale` 支持 `1~40`，超出会自动夹紧。
- `loadProjectText` 支持直接导入 JSON 文本。
- `run` 的 `method` 名称对应 `SimpleGUIDesignDeskApi` 上的方法名。
- `startDinoGame` 会自动切到 `simulate` 模式并加载 128x64 黑白像素小游戏。
