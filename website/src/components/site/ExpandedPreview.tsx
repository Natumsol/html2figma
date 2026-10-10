import { useCallback, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "../ui/sheet";
import { PreviewCanvas } from "./PreviewCanvas";
import { PreviewSession } from "@/lib/preview";
import { t, type Language } from "@/lib/i18n";

export function ExpandedPreview({
  language,
  item,
  title,
}: {
  language: Language;
  item: { html: string; css: string; width: number };
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const load = useCallback(
    (frame: HTMLIFrameElement) => {
      setStatus(t(language, "Loading preview…", "正在加载预览…"));
      const session = new PreviewSession(
        frame,
        item.html,
        item.css,
        item.width,
      );
      let active = true;
      void session.ready
        .then((warnings) => {
          if (active)
            setStatus(
              warnings.length
                ? t(
                    language,
                    "Some resources could not load. Review the case notes.",
                    "部分资源未能加载，请查看案例诊断。",
                  )
                : t(
                    language,
                    "Browser input preview · zoom does not change JSON",
                    "网页输入预览 · 缩放不改变 JSON",
                  ),
            );
        })
        .catch(() => {
          if (active)
            setStatus(
              t(
                language,
                "Preview could not load. Try opening the case in Playground.",
                "预览加载失败，请在 Playground 中打开案例。",
              ),
            );
        });
      return () => {
        active = false;
        session.destroy();
      };
    },
    [item, language],
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="preview-expand rounded-full bg-white/90"
          aria-label={`${t(language, "Enlarge preview", "放大预览")} · ${title}`}
        >
          <Maximize2 strokeWidth={1.2} />
          {t(language, "Enlarge", "放大查看")}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="top"
        showCloseButton={false}
        className="expanded-preview inset-4 h-[calc(100dvh-2rem)] rounded-[var(--shell-radius)] border-0 bg-background p-5 md:inset-8 md:h-[calc(100dvh-4rem)] md:p-8"
      >
        <div className="expanded-preview-heading">
          <div>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {t(
                language,
                "Inspect at the original size, or fit the preview to your screen.",
                "按原始尺寸检查，或让预览适应屏幕宽度。",
              )}
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full"
              aria-label={t(language, "Close preview", "关闭预览")}
            >
              <X strokeWidth={1.2} />
            </Button>
          </SheetClose>
        </div>
        <PreviewCanvas language={language} title={title} onFrame={load} />
        <p className="preview-note" role="status">
          {status}
        </p>
      </SheetContent>
    </Sheet>
  );
}
