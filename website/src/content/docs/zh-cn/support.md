---
title: 支持范围与限制
description: 了解哪些浏览器特性能转换为图层，哪些会回退或丢失。
order: 6
---

## 能力范围

转换器读取渲染后的固定尺寸与受支持的计算样式，渲染器生成可编辑文本、形状、图片和部分布局。它不会重新实现浏览器引擎或响应式行为。

| 特性 | 支持范围 |
| --- | --- |
| 普通可见元素 | Frame、Rectangle 与子文本。 |
| 文本 | 可编辑，但换行与字体度量可能不同。 |
| 纯色背景、透明度、圆角 | 支持对应计算值。 |
| 实线边框 | 均匀描边直接映射，不对称边框使用辅助矩形，存在限制。 |
| RGB/RGBA 外阴影 | 支持解析后的外阴影，跳过内阴影与无法解析的阴影。 |
| 图片 | 读取 currentSrc，支持 cover 和 contain，其他适配与定位可能不同。 |
| 内联 SVG | 序列化向量，展开本地 use 引用，复杂 SVG 无法保证。 |
| Canvas | 静态 PNG，绘图元素不可编辑。 |
| Video | 静态 poster，没有 poster 时生成 Frame 并警告。 |
| 简单不换行 Flex | 参数与测量位置匹配时创建固定尺寸 Auto Layout，否则回退为绝对位置。 |
| 开放 Shadow DOM | 遍历可访问的根，关闭的根不可访问。 |

## 不支持与部分支持

CSS Grid 与 transform 没有对应的布局或变换渲染。渐变、多层背景、滤镜、混合模式、伪元素、动画、遮罩、表格布局和响应式 Figma 约束无法忠实还原。

Iframe 内容、原生表单控件外观和媒体播放不在忠实转换范围。能遍历 HTML 结构不代表完整支持该元素的语义与外观。

Flex 换行、反向排列、重排或定位子节点、外边距与布局不匹配时，可能回退到测量后的绝对位置。

## 阅读诊断

常见代码包括 `unsupported-css-grid`、`unsupported-transform`、`unsupported-background-image`、`unsupported-border-style`、`flex-layout-fallback`、`canvas-export-failed`、`video-poster-missing`、`font-load-failed`。

警告描述已知回退。部分未支持特性不会产生警告，零警告不代表输出与网页完全一致。

## Playground 边界

仅支持 HTML/CSS。移除用户脚本、内嵌浏览环境和事件处理器。允许公开图片与字体 URL，但仍受加载和插件访问限制。首期不提供网页 URL 导入、本地文件上传、登录、在线服务转换或云端项目保存。

预设案例使用固定尺寸，改变视口宽度不会自动让 CSS 响应式适配。输入超过视口宽度时，预览区域可以滚动。
