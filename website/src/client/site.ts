import { createElement } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { CodeCopy } from "../components/site/CodeCopy";
for (const pre of document.querySelectorAll<HTMLPreElement>(
  ".prose pre:not([data-managed-code]), .code-example pre, .integration-code pre",
)) {
  const existing = pre.closest<HTMLDivElement>(".code-block");
  const wrapper = existing || document.createElement("div");
  wrapper.className = "code-block";
  const toolbar =
    existing?.querySelector<HTMLDivElement>(".code-block-bar") ||
    document.createElement("div");
  toolbar.className = "code-block-bar";
  const component = createElement(CodeCopy, {
    code: pre.querySelector("code")?.textContent || "",
    language:
      toolbar.querySelector("span")?.textContent ||
      pre
        .querySelector("code")
        ?.className.match(/language-(\w+)/)?.[1]
        ?.toUpperCase() ||
      (pre.textContent?.includes("npm ") ? "TERMINAL" : "TYPESCRIPT"),
    chinese: document.documentElement.lang !== "en",
  });
  if (existing) {
    hydrateRoot(toolbar, component);
  } else {
    createRoot(toolbar).render(component);
    pre.before(wrapper);
    wrapper.append(toolbar, pre);
  }
}
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
    },
    { threshold: 0.06 },
  );
  const siblings = new Map<Element, number>();
  document.querySelectorAll<HTMLElement>(".reveal").forEach((element) => {
    const parent = element.parentElement!;
    const index = siblings.get(parent) || 0;
    siblings.set(parent, index + 1);
    element.style.setProperty(
      "--reveal-delay",
      `${Math.min(index, 2) * 100}ms`,
    );
    element.classList.add("will-reveal");
    observer.observe(element);
  });
}
