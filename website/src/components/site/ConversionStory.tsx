import { useEffect, useRef, useState } from "react";
import type { Html2FigmaNode } from "html2figma";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { cases } from "@/data/cases";
import { link, t, type Language } from "@/lib/i18n";
import { PreviewSession } from "@/lib/preview";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { LayerList } from "./LayerList";
import { ArrowUpRight, Braces, Layers, MousePointer2 } from "lucide-react";

gsap.registerPlugin(useGSAP, ScrollTrigger);
const item = cases.find((entry) => entry.id === "icon-feature-card")!;
const sourceFragment = item.html
  .slice(
    item.html.indexOf('<p class="kicker">'),
    item.html.indexOf('<div class="tags">'),
  )
  .trim();

export function ConversionStory({ language }: { language: Language }) {
  const container = useRef<HTMLElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const session = useRef<PreviewSession | null>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const [phase, setPhase] = useState("0");
  const [nodes, setNodes] = useState<Html2FigmaNode[]>([]);
  const [selected, setSelected] = useState<Html2FigmaNode>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const steps = [
    {
      icon: MousePointer2,
      label: t(language, "The webpage", "网页输入"),
      title: t(language, "Start with what you see.", "从看得见的页面开始。"),
      description: t(
        language,
        "A real HTML and CSS example, rendered in the browser.",
        "在浏览器中渲染真实的 HTML 与 CSS 案例。",
      ),
    },
    {
      icon: Layers,
      label: t(language, "Captured layers", "捕获图层"),
      title: t(language, "Every detail has a place.", "让每个细节都有位置。"),
      description: t(
        language,
        "Select a captured node to locate its measured bounds in the webpage.",
        "选择捕获的节点，查看它在网页中的实际位置。",
      ),
    },
    {
      icon: Braces,
      label: t(language, "Portable JSON", "传递 JSON"),
      title: t(
        language,
        "A structure you can take with you.",
        "把结构带到下一步。",
      ),
      description: t(
        language,
        "The selected node is part of the document your Figma plugin receives.",
        "选中节点的真实数据，属于交给 Figma 插件的转换文档。",
      ),
    },
  ] as const;

  useEffect(() => {
    let disposed = false;
    const preview = new PreviewSession(
      frame.current!,
      item.html,
      item.css,
      item.width,
    );
    session.current = preview;
    const fit = () => {
      const iframe = frame.current!;
      const area = viewport.current!;
      const scale = Math.min(
        1,
        (area.clientWidth - 32) / item.width,
        (area.clientHeight - 32) / (parseFloat(iframe.style.height) || 450),
      );
      iframe.style.transform = `scale(${Math.max(0.1, scale)})`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(viewport.current!);
    void preview
      .convert()
      .then(({ document }) => {
        if (disposed) return;
        const captured: Html2FigmaNode[] = [];
        const collect = (node: Html2FigmaNode) => {
          if (
            node.type === "svg" ||
            (node.type === "text" && (node.style.text?.fontSize || 0) >= 14)
          )
            captured.push(node);
          node.children.forEach(collect);
        };
        collect(document.root);
        setNodes(captured.slice(0, 4));
        setSelected(
          captured.find(
            (node) =>
              node.type === "text" && (node.style.text?.fontSize || 0) >= 24,
          ) || captured[0],
        );
        setState("ready");
        fit();
      })
      .catch(() => {
        if (!disposed) setState("error");
      });
    return () => {
      disposed = true;
      observer.disconnect();
      preview.destroy();
      session.current = null;
    };
  }, []);

  useEffect(() => {
    if (state === "ready")
      session.current?.highlight(phase === "0" ? undefined : selected?.bounds);
  }, [phase, selected, state]);

  useGSAP(
    () => {
      if (state !== "ready") return;
      const media = gsap.matchMedia();
      media.add(
        "(min-width: 1024px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)",
        () => {
          const timeline = gsap.timeline({
            scrollTrigger: {
              id: "conversion-story",
              trigger: container.current,
              pin: true,
              start: () => {
                const section = container.current!;
                const reference = section.parentElement?.classList.contains(
                  "pin-spacer",
                )
                  ? section.parentElement
                  : section;
                return (
                  reference.getBoundingClientRect().top + window.scrollY - 110
                );
              },
              end: "+=1000",
              scrub: 0.4,
              invalidateOnRefresh: true,
              onUpdate: (self) =>
                setPhase(String(Math.min(2, Math.floor(self.progress * 3)))),
            },
          });
          trigger.current = timeline.scrollTrigger!;
          timeline.fromTo(
            ".story-preview-motion",
            { scale: 0.94, opacity: 0.72 },
            { scale: 1, opacity: 1, duration: 1, ease: "none" },
            0,
          );
          timeline.to(
            ".story-progress-fill",
            { scaleX: 1, duration: 3, ease: "none" },
            0,
          );
          container.current!.dataset.motion = "scroll";
          return () => {
            trigger.current = null;
            delete container.current!.dataset.motion;
          };
        },
      );
      return () => media.revert();
    },
    { scope: container, dependencies: [state], revertOnUpdate: true },
  );

  function choose(value: string) {
    setPhase(value);
    const scroll = trigger.current;
    if (scroll)
      window.scrollTo({
        top:
          scroll.start +
          ((Number(value) + 0.5) / 3) * (scroll.end - scroll.start),
        behavior: "instant",
      });
  }
  const current = steps[Number(phase)] || steps[0];
  const snippet = selected
    ? JSON.stringify(
        {
          type: selected.type,
          ...(selected.type === "text" ? { text: selected.text } : {}),
          bounds: selected.bounds,
          style: selected.style,
        },
        null,
        2,
      )
    : "";

  return (
    <section
      className="conversion-story wrap"
      ref={container}
      aria-labelledby="story-heading"
      data-story
      data-state={state}
    >
      <div className="story-heading">
        <h2 id="story-heading">
          {t(language, "There’s more to a webpage.", "看见网页的另一面。")}
        </h2>
        <p>
          {t(
            language,
            "From rendered pixels to a document you can keep building on.",
            "从渲染的页面，到可以继续创作的结构。",
          )}
        </p>
      </div>
      <Tabs value={phase} onValueChange={choose} className="story-tabs gap-0">
        <TabsList
          className="story-steps h-auto bg-transparent p-0"
          aria-label={t(language, "Conversion walkthrough", "转换过程")}
        >
          {steps.map((step, index) => (
            <TabsTrigger
              key={step.label}
              value={String(index)}
              disabled={state !== "ready" && index > 0}
              className="story-step h-auto gap-2 rounded-full border-[#dce0e7] px-5 py-3 data-[state=active]:bg-[#242933] data-[state=active]:text-white"
            >
              <step.icon size={16} strokeWidth={1.5} />
              {step.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Card className="story-stage grid gap-0 rounded-3xl border-0 p-0 shadow-none">
          <div className="story-preview" ref={viewport}>
            <div className="story-preview-motion">
              <iframe
                ref={frame}
                title={t(
                  language,
                  "Walkthrough browser input",
                  "转换演示的网页输入",
                )}
                tabIndex={-1}
                sandbox="allow-scripts"
              />
            </div>
            <span className="story-input-label">
              {t(language, "Browser input", "网页输入")}
            </span>
          </div>
          <div className="story-inspector">
            <span className="story-inspector-label">{current.label}</span>
            <h3>{current.title}</h3>
            <p className="story-description">{current.description}</p>
            <TabsContent value="0" className="story-detail">
              <pre className="story-source" aria-label="HTML" tabIndex={0}>
                {sourceFragment}
              </pre>
            </TabsContent>
            <TabsContent value="1" className="story-detail">
              <LayerList
                nodes={nodes}
                language={language}
                selectedId={selected?.id || null}
                compact
                onSelect={(node) => {
                  if (node) setSelected(node);
                }}
              />
            </TabsContent>
            <TabsContent value="2" className="story-detail">
              <pre
                className="story-json"
                tabIndex={0}
                aria-label={t(
                  language,
                  "Selected node JSON fragment",
                  "选中节点的 JSON 片段",
                )}
              >
                {snippet}
              </pre>
              <a className="story-handoff" href={link(language, "docs/plugin")}>
                {t(
                  language,
                  "Continue in the Figma plugin",
                  "在 Figma 插件中继续",
                )}
                <ArrowUpRight size={16} />
              </a>
            </TabsContent>
          </div>
          <div className="story-progress" aria-hidden="true">
            <span className="story-progress-fill" />
          </div>
        </Card>
      </Tabs>
      <div className="story-footnote">
        <p role="status">
          {state === "error"
            ? t(
                language,
                "Preview unavailable. Open the example in Playground.",
                "预览暂不可用，请在 Playground 打开案例。",
              )
            : state === "loading"
              ? t(language, "Preparing the real example…", "正在准备真实案例…")
              : t(
                  language,
                  "Actual converted nodes · browser input preview · inspect final output in Figma",
                  "真实转换节点 · 网页输入预览 · 在 Figma 中检查最终输出",
                )}
        </p>
        <a href={`${link(language, "playground")}?case=${item.id}`}>
          {t(language, "Try this example", "试试这个案例")}
          <ArrowUpRight size={14} />
        </a>
      </div>
    </section>
  );
}
