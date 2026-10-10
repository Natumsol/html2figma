---
title: 配套 Figma 插件
description: 下载独立插件，粘贴 JSON，生成可编辑图层。
order: 5
---

## 安装开发插件

点击上方按钮下载 ZIP，包含 `manifest.json`、`main.js`、说明文件与 MIT 许可证。界面已打包进 `main.js`，不需要本地网页服务器。

1. 解压到长期保留的本地目录。
2. 在 Figma 桌面应用中打开 Design 文件。
3. 选择「插件 → 开发 → 从 manifest 导入插件」，选择 `manifest.json`。
4. 在开发插件列表中运行「html2figma 1.0.2」。

菜单名称随语言和版本可能不同。这是开发插件，当前尚非 Community 发布版本；你的 Figma 环境需要允许使用开发插件。

## 导入站点 JSON

1. 在[案例集](/zh-cn/gallery/)选择案例，或在 [Playground](/zh-cn/playground/) 转换 HTML/CSS。
2. 点击「复制 JSON」。
3. 粘贴到插件的「Import JSON」输入框。
4. 点击「Render to Figma」。插件校验 JSON、生成图层、选中结果并移动视口。

插件展示渲染警告。再次渲染会创建另一组图层，不会更新上次结果。

## 图片与字体

配套插件允许访问外部网络，用于加载 JSON 中引用的公开图片。请求失败可能导致填充缺失，并产生警告。需要独立传递图片时，可使用 data URL。

确保 Figma 可以访问所需字体。缺失字体回退到 Inter。Gallery 预览使用 Geist，安装 Geist 可减少文字度量差异；网页 CSS 的字体不会由插件自动安装。

## 更新插件

站点采用新的库版本后，下载对应插件包，必要时重新导入 manifest。让插件版本与站点版本一致。

## Community 版本

后续会提供 Community 安装入口。当前使用独立开发插件，不展示尚未验证的 Community 链接。
