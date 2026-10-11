import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../ui/button";

const command = "npm install html2figma";

export function InstallCommand({ chinese }: { chinese: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(command);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
    }
  }
  return (
    <div className="install-command">
      <span className="install-prompt" aria-hidden="true">
        $
      </span>
      <code>{command}</code>
      <Button
        className="install-copy"
        variant="ghost"
        onClick={copy}
        aria-label={chinese ? "复制安装命令" : "Copy install command"}
      >
        {state === "copied" ? <Check size={16} /> : <Copy size={16} />}
        <span>
          {state === "copied"
            ? chinese
              ? "已复制"
              : "Copied"
            : chinese
              ? "复制"
              : "Copy"}
        </span>
      </Button>
      <span
        className={state === "error" ? "install-error" : "sr-only"}
        role="status"
      >
        {state === "error"
          ? chinese
            ? "请选中命令复制"
            : "Select the command to copy"
          : state === "copied"
            ? chinese
              ? "安装命令已复制"
              : "Install command copied"
            : ""}
      </span>
    </div>
  );
}
