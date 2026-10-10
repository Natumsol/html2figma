import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { CodeCopy } from "../components/site/CodeCopy";
for (const pre of document.querySelectorAll<HTMLPreElement>(
  ".prose pre:not([data-managed-code]), .code-example pre, .integration-code pre",
)) {
  const wrapper = document.createElement("div");
  wrapper.className = "code-block";
  const toolbar = document.createElement("div");
  toolbar.className = "code-block-bar";
  createRoot(toolbar).render(
    createElement(CodeCopy, {
      code: pre.querySelector("code")?.textContent || "",
      language:
        pre
          .querySelector("code")
          ?.className.match(/language-(\w+)/)?.[1]
          ?.toUpperCase() ||
        (pre.textContent?.includes("npm ") ? "TERMINAL" : "TYPESCRIPT"),
      chinese: document.documentElement.lang !== "en",
    }),
  );
  pre.before(wrapper);
  wrapper.append(toolbar, pre);
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
  document.querySelectorAll(".reveal").forEach((element) => {
    element.classList.add("will-reveal");
    observer.observe(element);
  });
}
