export type Language = 'en' | 'zh-cn';
export const languages: Language[] = ['en', 'zh-cn'];
export const t = (language: Language, en: string, zh: string): string => language === 'en' ? en : zh;
export const link = (language: Language, path = ''): string => `/${language === 'en' ? '' : 'zh-cn/'}${path ? `${path}/` : ''}`;
export const labels = (language: Language) => ({
  docs: t(language, 'Documentation', '文档'),
  gallery: t(language, 'Gallery', '案例集'),
  playground: 'Playground',
  start: t(language, 'Get started', '快速开始'),
  copy: t(language, 'Copy JSON', '复制 JSON'),
  copied: t(language, 'Copied', '已复制'),
  download: t(language, 'Download JSON', '下载 JSON'),
  edit: t(language, 'Open in Playground', '在 Playground 中编辑'),
  plugin: t(language, 'Get the plugin', '获取插件'),
  convert: t(language, 'Convert to JSON', '转换为 JSON'),
  preview: t(language, 'Browser preview', '网页预览'),
  loading: t(language, 'Loading preview…', '正在加载预览…'),
  ready: t(language, 'Preview ready. Convert when you’re ready.', '预览已就绪，可以开始转换。'),
  stale: t(language, 'Input changed. Convert again to update JSON.', '输入已变更，请重新转换以更新 JSON。'),
  converting: t(language, 'Converting…', '正在转换…'),
  failed: t(language, 'Preview failed. Check your input or retry.', '预览失败，请检查输入或重试。'),
  empty: t(language, 'Add some HTML before converting.', '请先输入 HTML 内容。'),
  result: t(language, 'JSON ready. Paste it into the plugin’s Import JSON tab.', 'JSON 已生成，请粘贴到插件的 Import JSON 页签。'),
  clipboard: t(language, 'Clipboard unavailable. Download the JSON instead.', '剪贴板不可用，请改为下载 JSON。')
});
