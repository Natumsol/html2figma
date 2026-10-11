import { useState } from "react";
export function CodeCopy({
  code,
  language,
  chinese,
}: {
  code: string;
  language: string;
  chinese: boolean;
}) {
  const label = chinese ? "复制代码" : "Copy code";
  const [text, setText] = useState(label);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setText(chinese ? "已复制" : "Copied");
      setTimeout(() => setText(label), 2000);
    } catch {
      setText(chinese ? "请选中代码复制" : "Select code to copy");
    }
  }
  return (
    <>
      <span>{language}</span>
      <button type="button" className="copy-code" onClick={copy}>
        {text}
      </button>
    </>
  );
}
