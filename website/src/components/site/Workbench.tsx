import { useEffect, useState } from "react";
import { labels, link, t, type Language } from "@/lib/i18n";
import { cases, caseText } from "@/data/cases";
import { initPlayground } from "@/client/playground";
import { BrandButton } from "./BrandButton";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { Download } from "lucide-react";
import { PreviewCanvas } from "./PreviewCanvas";
const frameClass =
  "shell block gap-0 rounded-[var(--shell-radius)] border-0 bg-[var(--shell-surface)] p-[var(--shell-inset)] shadow-none";
const tabClass =
  "h-auto flex-none border-0 px-3 py-2 text-[13px] shadow-none data-[state=active]:bg-accent data-[state=active]:text-accent-foreground";
const refreshEditors = () =>
  window.dispatchEvent(new Event("h2f:refresh-editors"));
export function Workbench({ language }: { language: Language }) {
  const l = labels(language);
  const [view, setView] = useState("preview");
  useEffect(() => {
    refreshEditors();
  }, [view]);
  useEffect(() => {
    const converted = () => {
      if (matchMedia("(max-width: 767px)").matches) setView("preview");
    };
    window.addEventListener("h2f:converted", converted);
    const desktop = matchMedia("(min-width: 768px)");
    const restoreSplit = () => {
      if (desktop.matches)
        setView((current) => (current === "source" ? "preview" : current));
    };
    desktop.addEventListener("change", restoreSplit);
    return () => {
      window.removeEventListener("h2f:converted", converted);
      desktop.removeEventListener("change", restoreSplit);
    };
  }, []);
  useEffect(() => initPlayground(), []);
  return (
    <>
      <section className="workspace-heading wrap">
        <div>
          <p className="eyebrow">HTML → JSON → FIGMA</p>
          <h1>
            Playground<span className="violet-text">.</span>
          </h1>
        </div>
        <p>
          {t(
            language,
            "Edit the source. Inspect the document. Take it to Figma.",
            "编辑源码，检查转换文档，然后带入 Figma。",
          )}
        </p>
      </section>
      <section className="workbench wrap" data-playground>
        <div className="workbench-toolbar">
          <div className="source-options">
            <label htmlFor="case-select">
              {t(language, "Example", "案例")}
            </label>
            <NativeSelect
              id="case-select"
              className="h-auto rounded-xl border-0 bg-white py-2.5 pr-9 shadow-none"
            >
              {cases.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {caseText(item.id, language).title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <label htmlFor="viewport">{t(language, "Viewport", "视口")}</label>
            <NativeSelect
              id="viewport"
              className="h-auto rounded-xl border-0 bg-white py-2.5 pr-9 shadow-none"
            >
              <NativeSelectOption value="640">640 px</NativeSelectOption>
              <NativeSelectOption value="375">375 px</NativeSelectOption>
              <NativeSelectOption value="1024">1024 px</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="toolbar-actions">
            <BrandButton
              id="convert"
              className="max-md:min-w-0 max-md:flex-1 max-md:gap-2 max-md:px-3 max-md:text-xs"
              disabled
              label={l.convert}
              arrow
            />
            <BrandButton
              id="copy-json"
              className="max-md:min-w-0 max-md:flex-1 max-md:px-3 max-md:text-xs"
              tone="dark"
              disabled
              label={l.copy}
            />
            <Button
              id="download-json"
              variant="secondary"
              size="icon"
              className="icon-button size-11 rounded-full"
              disabled
              aria-label={l.download}
              title={l.download}
            >
              <Download strokeWidth={1.2} />
            </Button>
          </div>
          <div className="workbench-status" data-state="loading">
            <span className="status-dot" />
            <p id="playground-status" role="status" aria-live="polite">
              {l.loading}
            </p>
            <span id="result-summary" />
          </div>
        </div>
        <div className="copy-next-step">
          <span>
            {t(
              language,
              "Copy JSON, then continue in Figma.",
              "复制 JSON 后，在 Figma 中继续。",
            )}
          </span>
          <a className="text-link" href={link(language, "docs/plugin")}>
            {l.plugin} →
          </a>
        </div>
        <Tabs
          value={view}
          onValueChange={setView}
          className="workspace-views gap-0"
        >
          <TabsList
            className="mobile-workspace-tabs hidden h-auto w-full bg-white p-1 max-md:flex"
            aria-label={t(language, "Workspace views", "工作台视图")}
          >
            <TabsTrigger value="source" id="source-view-tab">
              {t(language, "Source", "源码")}
            </TabsTrigger>
            <TabsTrigger value="preview">
              {t(language, "Preview", "预览")}
            </TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="diagnostics">
              {t(language, "Notes", "诊断")}
            </TabsTrigger>
          </TabsList>
          <div className="workspace-grid" data-view={view}>
            <TabsContent
              forceMount
              value="source"
              className="source-workspace m-0"
              aria-labelledby="source-view-tab"
            >
              <Card className={`${frameClass} editor-panel`}>
                <CardContent className="core p-0">
                  <Tabs
                    defaultValue="html"
                    className="gap-0"
                    onValueChange={refreshEditors}
                  >
                    <div className="panel-bar">
                      <TabsList
                        className="tabs h-auto bg-transparent p-0"
                        aria-label={t(language, "Source language", "源码语言")}
                      >
                        <TabsTrigger
                          className={`${tabClass} text-[#a8b0c0] hover:text-[#e0d5fc] data-[state=active]:bg-[#3b3550] data-[state=active]:text-[#e0d5fc]`}
                          value="html"
                          id="html-tab"
                          aria-controls="html-panel"
                        >
                          HTML
                        </TabsTrigger>
                        <TabsTrigger
                          className={`${tabClass} text-[#a8b0c0] hover:text-[#e0d5fc] data-[state=active]:bg-[#3b3550] data-[state=active]:text-[#e0d5fc]`}
                          value="css"
                          id="css-tab"
                          aria-controls="css-panel"
                        >
                          CSS
                        </TabsTrigger>
                      </TabsList>
                      <span className="panel-caption">
                        {t(language, "SOURCE", "源码")}
                      </span>
                    </div>
                    <TabsContent
                      forceMount
                      value="html"
                      id="html-panel"
                      aria-labelledby="html-tab"
                      className="m-0 data-[state=inactive]:hidden"
                    >
                      <Textarea
                        id="html-input"
                        spellCheck={false}
                        aria-label="HTML"
                        aria-describedby="input-policy"
                      />
                    </TabsContent>
                    <TabsContent
                      forceMount
                      value="css"
                      id="css-panel"
                      aria-labelledby="css-tab"
                      className="m-0 data-[state=inactive]:hidden"
                    >
                      <Textarea
                        id="css-input"
                        spellCheck={false}
                        aria-label="CSS"
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
            <Card
              className={`${frameClass} output-panel`}
              data-mobile-active={view !== "source"}
            >
              <CardContent className="core p-0">
                <div className="panel-bar desktop-output-tabs">
                  <TabsList
                    className="tabs h-auto bg-transparent p-0"
                    aria-label={t(language, "Output views", "输出视图")}
                  >
                    <TabsTrigger
                      className={tabClass}
                      value="preview"
                      id="preview-tab"
                      aria-controls="preview-panel"
                    >
                      {t(language, "Preview", "预览")}
                    </TabsTrigger>
                    <TabsTrigger
                      className={tabClass}
                      value="json"
                      id="json-tab"
                      aria-controls="json-panel"
                    >
                      JSON
                    </TabsTrigger>
                    <TabsTrigger
                      className={tabClass}
                      value="diagnostics"
                      id="diagnostics-tab"
                      aria-controls="diagnostics-panel"
                    >
                      {t(language, "Diagnostics", "诊断")}
                      <span id="warning-count" hidden />
                    </TabsTrigger>
                  </TabsList>
                  <span className="panel-caption">
                    {t(language, "INSPECT", "检查")}
                  </span>
                </div>
                <TabsContent
                  forceMount
                  value="preview"
                  id="preview-panel"
                  aria-labelledby="preview-tab"
                  className="m-0 data-[state=inactive]:hidden"
                >
                  <PreviewCanvas
                    language={language}
                    id="preview-frame"
                    title={l.preview}
                  />
                  <div className="preview-note">
                    {t(
                      language,
                      "Browser input preview · inspect editable output in Figma",
                      "网页输入预览 · 在 Figma 中检查可编辑输出",
                    )}
                  </div>
                </TabsContent>
                <TabsContent
                  forceMount
                  value="json"
                  id="json-panel"
                  aria-labelledby="json-tab"
                  className="m-0 data-[state=inactive]:hidden"
                >
                  <Textarea
                    id="json-output"
                    readOnly
                    spellCheck={false}
                    aria-label="JSON output"
                    placeholder={t(
                      language,
                      "Convert your source to inspect JSON here.",
                      "转换源码后，在这里检查 JSON。",
                    )}
                  />
                </TabsContent>
                <TabsContent
                  forceMount
                  value="diagnostics"
                  id="diagnostics-panel"
                  aria-labelledby="diagnostics-tab"
                  className="m-0 data-[state=inactive]:hidden"
                >
                  <div className="diagnostic-heading">
                    <h2>{t(language, "Conversion notes", "转换说明")}</h2>
                    <p>
                      {t(
                        language,
                        "Known fallbacks and resource loading issues.",
                        "查看已知回退与资源加载问题。",
                      )}
                    </p>
                  </div>
                  <div id="warnings-output" />
                </TabsContent>
              </CardContent>
            </Card>
          </div>
        </Tabs>
        <div className="workspace-footnote">
          <p id="input-policy">
            {t(
              language,
              "HTML + CSS · public image/font URLs · 200 KB per input · user scripts disabled",
              "HTML + CSS · 公开图片与字体 URL · 每项输入限 200 KB · 禁用用户脚本",
            )}
          </p>
          <a href={link(language, "docs/support")}>
            {t(language, "Support & limitations", "支持范围与限制")} ↗
          </a>
        </div>
        <div className="plugin-handoff">
          <div>
            <span className="eyebrow">
              {t(language, "THE NEXT STEP", "下一步")}
            </span>
            <h2>
              {t(language, "Finish on your canvas.", "在你的画布上继续。")}
            </h2>
            <p>
              {t(
                language,
                "Copy JSON → paste into the plugin → Render to Figma.",
                "复制 JSON → 粘贴到插件 → Render to Figma。",
              )}
            </p>
          </div>
          <BrandButton
            tone="secondary"
            href={link(language, "docs/plugin")}
            label={l.plugin}
            arrow
          />
        </div>
      </section>
    </>
  );
}
