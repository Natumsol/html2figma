import { useEffect, useRef } from "react";
import { cases } from "@/data/cases";
import { PreviewSession } from "@/lib/preview";

export function ExampleThumbnail({ id, title }: { id: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const item = cases.find((item) => item.id === id)!;
    const iframe = frame.current!;
    const container = viewport.current!;
    const session = new PreviewSession(iframe, item.html, item.css, item.width);
    const fit = () => {
      const scale = Math.min(
        0.9,
        Math.max(0.1, (container.clientWidth - 32) / item.width),
        Math.max(
          0.1,
          (container.clientHeight - 32) /
            (parseFloat(iframe.style.height) || 450),
        ),
      );
      iframe.style.transform = `scale(${scale})`;
      container.dataset.state = "ready";
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    void session.ready.then(fit).catch(() => {
      container.dataset.state = "error";
    });
    return () => {
      observer.disconnect();
      session.destroy();
    };
  }, [id]);
  return (
    <div className="example-thumbnail" ref={viewport} data-example={id}>
      <div className="thumbnail-motion">
        <iframe
          ref={frame}
          title={title}
          tabIndex={-1}
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}
