---
title: 故障排查
description: 解决预览、剪贴板、资源与 Figma 导入问题。
order: 7
---

## 无法复制 JSON

等待预览就绪，然后点击转换。编辑 HTML、CSS 或视口宽度后，旧结果会失效，需要重新转换。Gallery 中的复制按钮在对应案例转换成功后启用。

剪贴板不可用时，可在 Playground 下载 JSON，或选中结果文本手动复制。剪贴板需要安全站点环境或 localhost。

## 预览为空

输入可见 HTML，检查 `display: none`、`visibility: hidden`、零尺寸容器与外部资源。用户 JavaScript 被禁用，请直接提供目标 HTML 结构。

每项输入限 200 KB。外部资源失败或超时后，诊断区域展示资源警告。公开图片和字体服务器也可能拒绝跨域或匿名请求。

## Figma 拒绝 JSON

复制完整文档，包括 `version`、`root`、`resources`、`warnings`、`metadata`。不要只复制节点子树。配套插件与站点使用同一库版本，并校验所有输入文档。

## 文本显示不同

检查渲染警告是否包含 `font-load-failed`。在 Figma 可访问的环境中安装所需字体。即使字体可用，浏览器与 Figma 的换行或文本度量仍可能不同。

## 图片缺失

检查 URL 是否公开且能由插件访问。相对路径需要指向可访问的站点，不能只在本地开发服务器可用。浏览器 Cookie 不会传给 Figma。内嵌 data URL 有助于传递完整图片。

## 布局显示不同

查看转换警告和[支持表](/zh-cn/docs/support/)。Grid、transform、换行和复杂行内布局可能不同。库捕获固定视口，不生成响应式约束。

## 提交可复现问题

在 [GitHub Issue](https://github.com/Natumsol/html2figma/issues) 中提供库版本、最小 HTML/CSS、视口尺寸，以及转换和渲染警告。共享 JSON 前删除私人内容与凭据。
