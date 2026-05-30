# SimpleGUI Design Desk JSON 示例

## 1. 文档目的

本文档用于提供 `SimpleGUI Design Desk v1` 的工程 JSON 示例，方便：

- 前端开发时做默认工程和联调数据
- 设计台使用时快速理解字段结构
- 后续将 JSON 作为需求输入给代码实现阶段

## 2. 示例一：最小空白工程

适用于：

- 新建工程默认模板
- schema 验证联调

```json
{
  "version": 1,
  "project": {
    "name": "blank-project"
  },
  "screen": {
    "width": 128,
    "height": 64,
    "foreground": "#111111",
    "background": "#D7F06A",
    "buffered": true
  },
  "resources": [],
  "variables": [],
  "timers": [],
  "pictures": [
    {
      "id": "pic_main",
      "name": "Main",
      "title": "Main",
      "widgets": [],
      "enterActions": [],
      "leaveActions": []
    }
  ],
  "rules": [],
  "simulator": {
    "startPictureId": "pic_main",
    "keyMode": "dual",
    "showGrid": false,
    "fps": 20
  }
}
```

## 3. 示例二：主菜单 + 设置页 + 曲线页

适用于：

- 设计台联调
- 交互规则验证
- 多画面切换验证

```json
{
  "version": 1,
  "project": {
    "name": "simplegui-demo-v1",
    "createdAt": "2026-05-26T12:00:00+08:00",
    "updatedAt": "2026-05-26T12:00:00+08:00"
  },
  "screen": {
    "width": 128,
    "height": 64,
    "foreground": "#111111",
    "background": "#D7F06A",
    "buffered": true
  },
  "resources": [],
  "variables": [
    {
      "id": "var_main_select",
      "name": "Main Select",
      "type": "int",
      "initial": 0,
      "min": 0,
      "max": 2,
      "step": 1,
      "readonly": false
    },
    {
      "id": "var_speed",
      "name": "Speed",
      "type": "int",
      "initial": 30,
      "min": 0,
      "max": 100,
      "step": 1,
      "readonly": false
    },
    {
      "id": "var_name",
      "name": "Device Name",
      "type": "string",
      "initial": "MSPM0",
      "length": 8,
      "readonly": false
    },
    {
      "id": "var_graph_input",
      "name": "Graph Input",
      "type": "int",
      "initial": 0,
      "min": -100,
      "max": 100,
      "step": 1,
      "readonly": false
    },
    {
      "id": "var_tick",
      "name": "Tick",
      "type": "int",
      "initial": 0,
      "min": 0,
      "max": 9999,
      "step": 1,
      "readonly": false
    }
  ],
  "timers": [
    {
      "id": "timer_graph",
      "name": "Graph Timer",
      "intervalMs": 200,
      "repeat": true,
      "enabledOnStart": false,
      "targetPictureId": "pic_graph"
    }
  ],
  "pictures": [
    {
      "id": "pic_main",
      "name": "Main Menu",
      "title": "Main",
      "widgets": [
        {
          "id": "w_main_list",
          "type": "list",
          "name": "Main List",
          "rect": { "x": 0, "y": 0, "width": 128, "height": 64 },
          "visible": true,
          "enabled": true,
          "focusable": true,
          "zIndex": 0,
          "props": {
            "title": "Main",
            "font": "SGUI_DEFAULT_FONT_8",
            "items": [
              { "id": "item_settings", "label": "Settings", "dynamicTextVarId": null },
              { "id": "item_graph", "label": "Graph", "dynamicTextVarId": null },
              { "id": "item_about", "label": "About", "dynamicTextVarId": null }
            ],
            "selectedIndex": 0,
            "showScrollbar": true
          }
        }
      ],
      "enterActions": [],
      "leaveActions": []
    },
    {
      "id": "pic_settings",
      "name": "Settings",
      "title": "Settings",
      "widgets": [
        {
          "id": "w_speed_box",
          "type": "numberVariableBox",
          "name": "Speed Box",
          "rect": { "x": 10, "y": 14, "width": 108, "height": 8 },
          "visible": true,
          "enabled": true,
          "focusable": true,
          "zIndex": 0,
          "props": {
            "font": "SGUI_DEFAULT_FONT_8",
            "alignment": "center",
            "min": 0,
            "max": 100,
            "valueVarId": "var_speed",
            "step": 1
          }
        },
        {
          "id": "w_speed_bar",
          "type": "processBar",
          "name": "Speed Bar",
          "rect": { "x": 10, "y": 28, "width": 108, "height": 8 },
          "visible": true,
          "enabled": true,
          "focusable": false,
          "zIndex": 0,
          "props": {
            "valueVarId": "var_speed",
            "maxValue": 100,
            "direction": "right",
            "frame": true
          }
        },
        {
          "id": "w_name_box",
          "type": "textVariableBox",
          "name": "Name Box",
          "rect": { "x": 10, "y": 42, "width": 108, "height": 12 },
          "visible": true,
          "enabled": true,
          "focusable": true,
          "zIndex": 0,
          "props": {
            "font": "SGUI_DEFAULT_FONT_12",
            "textVarId": "var_name",
            "length": 8,
            "charSet": "ascii",
            "maskChar": null,
            "focusIndex": 0
          }
        }
      ],
      "enterActions": [],
      "leaveActions": []
    },
    {
      "id": "pic_graph",
      "name": "Graph",
      "title": "Graph",
      "widgets": [
        {
          "id": "w_graph",
          "type": "realtimeGraph",
          "name": "Realtime Graph",
          "rect": { "x": 0, "y": 0, "width": 128, "height": 64 },
          "visible": true,
          "enabled": true,
          "focusable": false,
          "zIndex": 0,
          "props": {
            "valueVarId": "var_graph_input",
            "min": -100,
            "max": 100,
            "xStepPixel": 2,
            "enableBaseline": true,
            "baselineValue": 0,
            "capacity": 64
          }
        }
      ],
      "enterActions": [
        { "type": "startTimer", "timerId": "timer_graph" }
      ],
      "leaveActions": [
        { "type": "stopTimer", "timerId": "timer_graph" }
      ]
    },
    {
      "id": "pic_about",
      "name": "About",
      "title": "About",
      "widgets": [
        {
          "id": "w_about_notice",
          "type": "notice",
          "name": "About Notice",
          "rect": { "x": 8, "y": 16, "width": 112, "height": 32 },
          "visible": true,
          "enabled": true,
          "focusable": false,
          "zIndex": 0,
          "props": {
            "text": "SimpleGUI Demo",
            "font": "SGUI_DEFAULT_FONT_8",
            "iconResourceId": null,
            "textOffset": 0,
            "autoFit": true
          }
        }
      ],
      "enterActions": [],
      "leaveActions": []
    }
  ],
  "rules": [
    {
      "id": "r_main_up",
      "pictureId": "pic_main",
      "event": { "kind": "onKeyPress", "key": "up", "widgetId": "w_main_list" },
      "actions": [
        { "type": "selectPrev", "widgetId": "w_main_list" }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_main_down",
      "pictureId": "pic_main",
      "event": { "kind": "onKeyPress", "key": "down", "widgetId": "w_main_list" },
      "actions": [
        { "type": "selectNext", "widgetId": "w_main_list" }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_main_enter_settings",
      "pictureId": "pic_main",
      "event": { "kind": "onWidgetConfirm", "widgetId": "w_main_list" },
      "condition": {
        "mode": "all",
        "items": [
          { "kind": "widgetSelected", "widgetId": "w_main_list", "index": 0 }
        ]
      },
      "actions": [
        { "type": "gotoPicture", "pictureId": "pic_settings" }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_main_enter_graph",
      "pictureId": "pic_main",
      "event": { "kind": "onWidgetConfirm", "widgetId": "w_main_list" },
      "condition": {
        "mode": "all",
        "items": [
          { "kind": "widgetSelected", "widgetId": "w_main_list", "index": 1 }
        ]
      },
      "actions": [
        { "type": "gotoPicture", "pictureId": "pic_graph" }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_main_enter_about",
      "pictureId": "pic_main",
      "event": { "kind": "onWidgetConfirm", "widgetId": "w_main_list" },
      "condition": {
        "mode": "all",
        "items": [
          { "kind": "widgetSelected", "widgetId": "w_main_list", "index": 2 }
        ]
      },
      "actions": [
        { "type": "gotoPicture", "pictureId": "pic_about" }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_settings_esc",
      "pictureId": "pic_settings",
      "event": { "kind": "onKeyPress", "key": "esc" },
      "actions": [
        { "type": "goBack" }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_speed_up",
      "pictureId": "pic_settings",
      "event": { "kind": "onKeyPress", "key": "up", "widgetId": "w_speed_box" },
      "actions": [
        { "type": "increaseVariable", "variableId": "var_speed", "step": 1 }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_speed_down",
      "pictureId": "pic_settings",
      "event": { "kind": "onKeyPress", "key": "down", "widgetId": "w_speed_box" },
      "actions": [
        { "type": "decreaseVariable", "variableId": "var_speed", "step": 1 }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_name_left",
      "pictureId": "pic_settings",
      "event": { "kind": "onKeyPress", "key": "left", "widgetId": "w_name_box" },
      "actions": [
        { "type": "focusPrev", "widgetId": "w_name_box" }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_name_right",
      "pictureId": "pic_settings",
      "event": { "kind": "onKeyPress", "key": "right", "widgetId": "w_name_box" },
      "actions": [
        { "type": "focusNext", "widgetId": "w_name_box" }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_graph_tick_counter",
      "pictureId": "pic_graph",
      "event": { "kind": "onTimer", "timerId": "timer_graph" },
      "actions": [
        { "type": "increaseVariable", "variableId": "var_tick", "step": 1 }
      ],
      "stopAfterMatch": false
    },
    {
      "id": "r_graph_tick_wave",
      "pictureId": "pic_graph",
      "event": { "kind": "onTimer", "timerId": "timer_graph" },
      "actions": [
        { "type": "setVariable", "variableId": "var_graph_input", "value": 40 },
        { "type": "pushGraphValue", "widgetId": "w_graph", "valueSource": "fromVariable", "fromVariableId": "var_graph_input" }
      ],
      "stopAfterMatch": false
    },
    {
      "id": "r_graph_esc",
      "pictureId": "pic_graph",
      "event": { "kind": "onKeyPress", "key": "esc" },
      "actions": [
        { "type": "goBack" }
      ],
      "stopAfterMatch": true
    },
    {
      "id": "r_about_exit",
      "pictureId": "pic_about",
      "event": { "kind": "onKeyPress", "key": "enter" },
      "actions": [
        { "type": "goBack" }
      ],
      "stopAfterMatch": true
    }
  ],
  "simulator": {
    "startPictureId": "pic_main",
    "keyMode": "dual",
    "showGrid": false,
    "fps": 20
  }
}
```

## 4. 常用规则片段

### 4.1 列表上移

```json
{
  "id": "r_list_up",
  "pictureId": "pic_main",
  "event": { "kind": "onKeyPress", "key": "up", "widgetId": "w_list" },
  "actions": [
    { "type": "selectPrev", "widgetId": "w_list" }
  ],
  "stopAfterMatch": true
}
```

### 4.2 列表下移

```json
{
  "id": "r_list_down",
  "pictureId": "pic_main",
  "event": { "kind": "onKeyPress", "key": "down", "widgetId": "w_list" },
  "actions": [
    { "type": "selectNext", "widgetId": "w_list" }
  ],
  "stopAfterMatch": true
}
```

### 4.3 确认后跳转

```json
{
  "id": "r_confirm_jump",
  "pictureId": "pic_main",
  "event": { "kind": "onWidgetConfirm", "widgetId": "w_list" },
  "condition": {
    "mode": "all",
    "items": [
      { "kind": "widgetSelected", "widgetId": "w_list", "index": 1 }
    ]
  },
  "actions": [
    { "type": "gotoPicture", "pictureId": "pic_next" }
  ],
  "stopAfterMatch": true
}
```

### 4.4 数值增减

```json
{
  "id": "r_num_up",
  "pictureId": "pic_settings",
  "event": { "kind": "onKeyPress", "key": "up", "widgetId": "w_num" },
  "actions": [
    { "type": "increaseVariable", "variableId": "var_speed", "step": 1 }
  ],
  "stopAfterMatch": true
}
```

```json
{
  "id": "r_num_down",
  "pictureId": "pic_settings",
  "event": { "kind": "onKeyPress", "key": "down", "widgetId": "w_num" },
  "actions": [
    { "type": "decreaseVariable", "variableId": "var_speed", "step": 1 }
  ],
  "stopAfterMatch": true
}
```

### 4.5 进度条联动

说明：

- 进度条本身不需要规则。
- 只要它绑定了和数值框相同的变量，重绘时就会联动。

### 4.6 通知框显示

```json
{
  "id": "r_notice_show",
  "pictureId": "pic_main",
  "event": { "kind": "onKeyPress", "key": "enter" },
  "actions": [
    { "type": "showNotice", "widgetId": "w_notice", "text": "Saved" }
  ],
  "stopAfterMatch": true
}
```

### 4.7 定时器驱动曲线

```json
{
  "id": "r_graph_tick",
  "pictureId": "pic_graph",
  "event": { "kind": "onTimer", "timerId": "timer_graph" },
  "actions": [
    { "type": "pushGraphValue", "widgetId": "w_graph", "valueSource": "fromVariable", "fromVariableId": "var_graph_input" }
  ],
  "stopAfterMatch": false
}
```

## 5. 推荐的新建工程默认内容

建议新建工程时自动带上：

- `pic_main`
- 一个空 `List`
- 常用变量模板
- `simulator.startPictureId = pic_main`

这样用户第一次打开设计台就能立刻看到可编辑内容。

## 6. 使用建议

当设计文件主要用于向后续代码实现表达需求时，建议优先保证：

- 画面数量清晰
- 控件命名稳定
- 变量命名有业务含义
- 规则尽量拆小
- 每个画面的返回路径明确

这样后续把 JSON 发给实现侧时，更容易直接落成 `SimpleGUI + HMI` 代码。

