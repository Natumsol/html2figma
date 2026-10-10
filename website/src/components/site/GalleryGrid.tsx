import { useEffect } from "react";
import { cases, caseText, caseFeatures } from "@/data/cases";
import { labels, link, t, type Language } from "@/lib/i18n";
import { initGallery } from "@/client/gallery";
import { ExpandedPreview } from "./ExpandedPreview";
import { BrandButton } from "./BrandButton";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../ui/accordion";
import { ArrowUpRight } from "lucide-react";

export function GalleryGrid({ language }: { language: Language }) {
  const l = labels(language);
  useEffect(() => initGallery(), []);
  return (
    <section className="gallery-grid wrap" data-gallery>
      {cases.map((item, index) => (
        <article
          key={item.id}
          className="shell gallery-card reveal"
          data-case={item.id}
          style={
            { "--reveal-delay": `${(index % 2) * 60}ms` } as React.CSSProperties
          }
        >
          <Card
            className={`core block gap-0 rounded-[calc(var(--shell-radius)-var(--shell-inset))] border-0 p-0 shadow-none ${index === 0 || index === cases.length - 1 ? "md:grid" : ""}`}
          >
            <div className="gallery-preview">
              <ExpandedPreview
                language={language}
                item={item}
                title={caseText(item.id, language).title}
              />
              <iframe
                title={caseText(item.id, language).title}
                sandbox="allow-scripts"
              />
            </div>
            <div className="gallery-body">
              <div className="gallery-title">
                <span className="mono gallery-number">0{index + 1}</span>
                <h2>{caseText(item.id, language).title}</h2>
              </div>
              <p>{caseText(item.id, language).description}</p>
              <div className="feature-tags">
                {caseFeatures[item.id]?.map((feature) => (
                  <Badge
                    key={feature}
                    variant="secondary"
                    className="rounded-none border-0 bg-transparent p-0 font-mono text-[10px] font-normal text-[#9299a6]"
                  >
                    {feature}
                  </Badge>
                ))}
              </div>
              <div className="gallery-actions">
                <BrandButton
                  tone="dark"
                  data-copy
                  disabled
                  label={l.copy}
                  className="min-h-10 px-4 py-2 text-xs"
                />
                <a
                  className="text-link"
                  href={`${link(language, "playground")}?case=${item.id}`}
                >
                  {t(language, "Edit example", "编辑案例")}{" "}
                  <ArrowUpRight strokeWidth={1.2} />
                </a>
              </div>
              <p className="gallery-status" role="status" data-status>
                {l.loading}
              </p>
              <p className="copy-next-step">
                <a href={link(language, "docs/plugin")}>
                  {t(language, "Figma plugin guide", "Figma 插件指引")} →
                </a>
              </p>
              <Accordion
                type="single"
                collapsible
                className="gallery-diagnostics"
                hidden
              >
                <AccordionItem value="notes" className="border-0">
                  <AccordionTrigger className="py-2 text-xs font-normal text-[#986849]">
                    <span data-diagnostics-label>
                      {t(language, "Conversion notes", "转换说明")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent forceMount>
                    <div data-diagnostics />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </Card>
        </article>
      ))}
    </section>
  );
}
