# SimpleGUI Design Desk

基于 `simplegui` 的 Web 设计台，支持：

- 128x64 黑白像素 LCD 设计画布与模拟器
- 控件拖拽、属性编辑、交互规则配置
- 官方示例与空白工程切换
- 设计台操作 API（方便 AI/脚本驱动）
- Chrome Dino、BMP 序列帧等示例场景

## 本地运行

```bash
npm install
npm run dev
```

Windows 也可以直接双击：

`launch_designdesk.bat`

## GitHub Pages 自动部署

本仓库已配置工作流：

- `.github/workflows/deploy-pages.yml`

触发方式：

- 推送到 `main` 分支
- 或在 Actions 页面手动执行

部署成功后访问：

[https://li-dongze.github.io/simplegui-designdesk/](https://li-dongze.github.io/simplegui-designdesk/)

如果首次访问是 404，请在仓库 `Settings -> Pages` 中确认 `Source` 为 `GitHub Actions`，然后等待 Actions 完成一次部署。
