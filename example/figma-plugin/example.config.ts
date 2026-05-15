const exampleConfig = {
  pluginName: "html2figma Example",
  pluginId: "html2figma-example",
  uiDevUrl: "http://localhost:5173",
  networkAllowedDomains: ["*"],
  networkAccessReasoning:
    "The local example plugin renders imported html2figma JSON and may need to fetch image resources from the captured page.",
  uiWidth: 960,
  uiHeight: 720
} as const;

export default exampleConfig;
