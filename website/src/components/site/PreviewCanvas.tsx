import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { t, type Language } from "@/lib/i18n";

/** Zoom changes only the presentation. The iframe keeps its capture dimensions. */
export function PreviewCanvas({
  language,
  id,
  title,
  onFrame,
}: {
  language: Language;
  id?: string;
  title: string;
  onFrame?: (frame: HTMLIFrameElement) => () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"fit" | "actual">("fit");
  const [percent, setPercent] = useState(100);
  useEffect(() => {
    if (!frame.current || !onFrame) return;
    return onFrame(frame.current);
  }, [onFrame]);
  useEffect(() => {
    const iframe = frame.current!;
    const scroll = viewport.current!;
    const canvas = stage.current!;
    const fit = () => {
      const width = parseFloat(iframe.style.width) || 640;
      const height = parseFloat(iframe.style.height) || 450;
      const scale =
        mode === "actual"
          ? 1
          : Math.min(1, Math.max(0.1, (scroll.clientWidth - 24) / width));
      iframe.style.transform = `scale(${scale})`;
      canvas.style.width = `${width * scale}px`;
      canvas.style.height = `${height * scale}px`;
      setPercent(Math.round(scale * 100));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(scroll);
    observer.observe(iframe);
    fit();
    return () => observer.disconnect();
  }, [mode]);
  return (
    <div className="preview-canvas">
      <div className="preview-controls">
        <div role="group" aria-label={t(language, "Preview zoom", "预览缩放")}>
          <Button
            className="text-xs"
            variant="ghost"
            size="sm"
            aria-pressed={mode === "fit"}
            onClick={() => setMode("fit")}
          >
            {t(language, "Fit width", "适应宽度")}
          </Button>
          <Button
            className="text-xs"
            variant="ghost"
            size="sm"
            aria-pressed={mode === "actual"}
            onClick={() => setMode("actual")}
          >
            100%
          </Button>
        </div>
        <span className="mono" aria-live="polite">
          {percent}%
        </span>
      </div>
      <div
        className="preview-scroll"
        ref={viewport}
        tabIndex={0}
        aria-label={t(language, "Scrollable browser preview", "可滚动网页预览")}
      >
        <div className="preview-stage" ref={stage}>
          <iframe ref={frame} id={id} title={title} sandbox="allow-scripts" />
        </div>
      </div>
    </div>
  );
}
