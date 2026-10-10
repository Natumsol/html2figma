# html2figma 官方站点设计草案

状态：用户于 2026-10-10 确认完整方案。站点实现、本地验证与 Vercel 部署已完成；当前网络阻止公网域名复查。

## 已确认范围

- 在当前工程新增独立文件夹承载站点，技术栈采用 Astro。
- 首期面向集成开发者，后续扩展到设计师。
- 包含品牌宣传、使用说明、API 文档、Playground 和 Gallery。
- 首期提供英文与简体中文。
- 部署到 Vercel。
- Playground 支持自由编辑 HTML/CSS，并提供预设案例。
- 首期不执行用户 JavaScript，也不通过 URL 导入远程网页。
- 允许使用公开外链图片和字体，说明加载失败和 Figma 字体回退限制。
- 站内仅展示网页预览和转换 JSON；真实图层效果由用户在 Figma 中验证。
- 预设案例和 Gallery 提供可复制的转换 JSON。
- 用户将 JSON 粘贴到配套 Figma 插件中生成图层。
- 首期提供可下载的插件构建包与开发插件安装指引。
- 后续提供 Figma Community 发布版本的安装入口。
- 使用项目现有 LOGO。
- 使用 high-end-visual-design 技能指导视觉设计。
- 配色参考 Figma 品牌配色。
- 正式站点只维护最新正式发布版本；文档、Playground 与插件构建包统一版本并标注版本号。

## 已确认的完整方案

### 目录与站点组织

- 新增根目录 `website/`，使用独立 package.json、锁文件和构建输出。
- 使用 Astro 静态页面承载品牌与文档，浏览器客户端代码承载 Playground。
- Markdown 内容与双语界面文案分开组织，案例数据供 Playground 与 Gallery 共用。
- 英文为默认语言，简体中文有独立路径，语言切换保留对应页面。
- 保留库现有包入口、浏览器/Figma 运行时边界和 npm 发布内容。

### 页面与文档

- 首页：产品主张、转换流程、代码示例、案例入口、能力边界；主要操作为快速开始和 Playground。
- 使用说明：安装、浏览器转换、插件渲染、JSON 传递、插件安装、资源与字体、支持范围和故障排查。
- API 文档：convert、render、JSON 校验方法、公开类型、选项、返回值与警告。签名以发布版本为依据，示例在构建验证中检查。
- 文档包含侧栏、页内目录与代码复制。
- Playground 与 Gallery 提供插件下载和安装说明入口。

### Playground

- HTML/CSS 编辑、预设案例切换、网页预览与预览宽度设置。
- 点击转换后生成 JSON，展示警告；支持复制 JSON 与下载 JSON。
- 输入变动后标记旧结果，成功重新转换后才恢复最新结果的复制操作。
- 预览禁止用户脚本，隔离用户样式和内容；等待资源加载，并对失败或超时给出提示。
- 展示明确的操作引导：复制 JSON → 在插件 Import JSON 中粘贴 → 生成 Figma 图层。
- 不承诺外链资源与网页字体一定能在 Figma 中加载。

### Gallery

- 首期建议精选六类案例：Hero、功能卡片、定价卡片、个人资料卡片、图片卡片、统计面板。
- 官网维护独立的 shadcn/ui 案例组件，构建时导出 HTML/CSS；逐项核对最新发布版本支持范围。
- 每个案例提供网页预览、双语介绍、适用能力与限制、复制 JSON 和在 Playground 中编辑入口。
- JSON 与页面预览使用同一案例输入及转换版本，避免维护不对应的静态结果。
- 首期不提供 Figma 截图对比、用户投稿、登录或服务器端保存。

### 视觉与交互

- 使用现有 LOGO；参考 Figma 品牌配色，不复制 Figma 商标或 LOGO。
- 首页采用宽松留白、非对称构图与细致交互，文档与编辑器采用适合阅读和操作的密度。
- 遵循 high-end-visual-design 的字体、层次、容器与交互规范，具体样式在实现阶段验证。
- 支持窄屏布局、键盘操作、可见焦点及减少动态效果偏好。

### 版本与部署

- 正式站点基于最新发布版本构建，插件包与 Playground 使用同一库版本。
- 开发预览允许验证仓库代码，必须区分预览版本与正式版本。
- 插件构建包作为构建产物提供下载，包含 manifest 和运行所需文件，不将生成 dist 提交到仓库。
- 准备 Vercel 构建配置和部署说明，首期使用 Vercel 默认域名，自定义域名后续配置。
- 正式发布不得因普通未发布源码变动而切换转换行为。
- 后续 Community 入口可替换主要插件安装入口，保留开发安装指引。

### 验收

- 双语页面、语言切换、页面链接及代码复制可用。
- HTML/CSS 编辑 → 网页预览 → 转换 → 复制/下载 JSON 可用，警告及失败提示可见。
- 六类案例可浏览、编辑、转换和复制；结果通过公共 JSON 校验。
- 插件构建包可下载并导入，至少验证一个站点 JSON 在实际插件中生成图层。
- 运行站点类型检查、构建和关键浏览器流程测试。
- 按仓库约定运行 `npm run verify:all`，报告实际结果和任何未完成的验收。

## 文档依据

使用 ctx7 解析 `/withastro/docs` 并查询站点组织方式。官方文档说明 Astro 可处理 TypeScript 客户端脚本，但构建本身不执行类型检查，需要单独检查。

- https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/imports.mdx
- https://github.com/withastro/docs/blob/main/src/content/docs/en/basics/layouts.mdx

## 待确认

当前无需额外产品决策。Community 发布版本按已确认的后续计划处理。

## 实际交付与验收

- 实现位于 `website/`，共构建 21 个静态页面，包括双语首页、Gallery、Playground、14 个文档页面与 404。
- 使用固定 npm 发布包 `html2figma@1.0.2`，从同一依赖生成转换器、插件与完整格式声明。
- 使用现有 LOGO 与品牌色，主界面采用 Geist / Geist Mono，支持手机布局、键盘操作和减少动态效果偏好。
- 预览使用隔离 iframe 和受控脚本；编辑后立即清除旧 JSON，六类案例均可复制合法文档。
- 站点类型检查、14 个文档 TypeScript 示例检查、构建及 10 项浏览器测试通过。
- 根工程 `npm run verify:all` 通过。
- 下载插件包的真实渲染处理器在 Figma 中处理站点 Hero JSON，创建 9 个节点，其中 4 个为可编辑文本，0 条警告。测试替代 UI/通知接口，图层创建使用真实 API；截图检查后移除了临时验收容器。
- 桌面与手机截图检查通过；截图及实际转换文档保存在忽略的 `website/.artifacts/`。
- Vercel 已返回正式部署 READY，地址为 https://html2figma-one.vercel.app 。正式构建的 canonical 使用此地址。
- 直接 HTTP、浏览器和 Vercel CLI 域名请求均被当前网络重置，公网端到端流程尚未复查；这与 Vercel 构建 READY、以及本地流程验证分别记录。
- 尚未连接 Git 自动部署。`website/README.md` 提供完整仓库导入、根目录和共享资源包含设置。
- Figma 桌面导入插件菜单未自动操作，插件安装指引与独立 ZIP 已交付。

## 设计评审后的修订

- 首页移除绝对定位的模拟 Figma 卡片，改为真实案例预览、实际节点树、节点数量与可复制的校验 JSON。
- 首屏与后续内容使用正常文档流，390/768/1024/1440 px 中英文布局无横向溢出或区块重叠。
- 统一导航、正文与代码字号，中文标题使用独立字距，降低外层容器对比度。
- Playground 使用 CodeMirror 与源码/结果页签，转换和复制按钮放入持续可见的工具栏，诊断采用可读说明。
- Gallery 明确案例名称、支持特性与示例数据性质，移除演示中的虚构准确率，支持展开诊断。
- 文档代码块的复制按钮位于独立栏，不覆盖第一行代码。
- 手机菜单使背景不可交互，并支持焦点循环、Escape 关闭及焦点恢复。
- 站点完整验证与根工程 `npm run verify:all` 再次通过；本轮截图保存于 `website/.artifacts/screenshots/`。

## 案例系列与组件库修订

- 站点采用 Astro + React islands + Tailwind CSS 4 + shadcn/ui。
- 使用官方 CLI 获取 Button、Card、Badge、NativeSelect、Tabs、Sheet、NavigationMenu、Accordion、Alert、Textarea。
- 六个案例也通过 shadcn/ui 组件组合，并在构建时导出为可编辑 HTML/CSS。
- 案例采用统一的白色、浅紫与紫色主色，橙、蓝、绿用于局部点缀；头像和画布插画使用同一配色。
- 官网拥有独立案例源文件，不再通过替换字符串修改插件测试区块；首页、Gallery 与 Playground 共用导出内容。
