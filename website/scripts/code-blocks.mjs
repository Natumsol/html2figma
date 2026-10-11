const element = (tagName, properties, children) => ({
  type: "element",
  tagName,
  properties,
  children,
});
const text = (value) => ({ type: "text", value });

/** Complete code blocks are rendered before the browser paints the document. */
export const codeBlocks = {
  name: "site-code-blocks",
  element: {
    filter: ["pre"],
    visit(node, context) {
      const chinese = context.fileURL?.pathname.includes("/zh-cn/") || false;
      const code = node.children?.find((child) => child.tagName === "code");
      const classes = code?.properties?.className || [];
      const name =
        node.properties?.dataLanguage ||
        classes.find((value) => value.startsWith("language-"))?.slice(9);
      const names = {
        ts: "TYPESCRIPT",
        js: "JAVASCRIPT",
        sh: "TERMINAL",
        bash: "TERMINAL",
      };
      const language = name
        ? names[name] || name.toUpperCase()
        : context.textContent(node).includes("npm ")
          ? "TERMINAL"
          : "TYPESCRIPT";
      return element("div", { className: ["code-block"] }, [
        element("div", { className: ["code-block-bar"] }, [
          element("span", {}, [text(language)]),
          element("button", { className: ["copy-code"], type: "button" }, [
            text(chinese ? "复制代码" : "Copy code"),
          ]),
        ]),
        node,
      ]);
    },
  },
};
