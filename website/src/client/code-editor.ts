import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "#222631", color: "#e6e8ef", height: "100%" },
    ".cm-scroller": {
      fontFamily: '"Geist Mono", monospace',
      fontSize: "13px",
      lineHeight: "1.85",
      overflow: "auto",
    },
    ".cm-content": { padding: "20px 0", caretColor: "#d3b7ff" },
    ".cm-line": { padding: "0 20px 0 12px" },
    ".cm-gutters": {
      backgroundColor: "#222631",
      color: "#70798c",
      border: "none",
      padding: "0 0 0 10px",
    },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "#ffffff05" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "#d3b7ff" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "#874fff40",
    },
  },
  { dark: true },
);
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.tagName], color: "#c9b5ff" },
  { tag: [tags.string, tags.attributeValue], color: "#b6d7c7" },
  { tag: [tags.propertyName, tags.attributeName], color: "#abd4f0" },
  { tag: [tags.number, tags.bool, tags.null], color: "#ffc3a0" },
  { tag: [tags.comment], color: "#8a96aa" },
  { tag: [tags.punctuation, tags.bracket], color: "#b6bdcc" },
]);

export function createCodeEditor(
  textarea: HTMLTextAreaElement,
  language: "html" | "css" | "json",
  onChange?: () => void,
) {
  const parent = document.createElement("div");
  parent.className = "code-editor";
  textarea.before(parent);
  textarea.hidden = true;
  textarea.setAttribute("aria-hidden", "true");
  let external = false;
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: textarea.value,
      extensions: [
        basicSetup,
        language === "html" ? html() : language === "css" ? css() : json(),
        theme,
        syntaxHighlighting(highlight),
        EditorView.contentAttributes.of({
          "aria-label":
            language === "json" ? "JSON output" : language.toUpperCase(),
          spellcheck: "false",
          tabindex: "0",
        }),
        ...(textarea.readOnly
          ? [
              EditorState.readOnly.of(true),
              EditorView.editable.of(false),
              placeholder(textarea.placeholder),
            ]
          : []),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          textarea.value = update.state.doc.toString();
          if (!external) onChange?.();
        }),
      ],
    }),
  });
  return {
    setValue(value: string) {
      external = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
      textarea.value = value;
      external = false;
    },
    refresh() {
      view.requestMeasure();
    },
    destroy() {
      view.destroy();
    },
  };
}
