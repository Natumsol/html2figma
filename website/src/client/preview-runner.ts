import { convert } from "html2figma/convert";

const channel = (document.currentScript as HTMLScriptElement).dataset.channel;
let root: HTMLElement | undefined;
let resourceWarnings: string[] = [];
let hasContent = false;
let highlight: HTMLDivElement | undefined;

function send(type: string, extra: Record<string, unknown> = {}) {
  window.parent.postMessage({ channel, type, ...extra }, "*");
}

async function waitForViewport(viewport: { width: number; height: number }) {
  if (
    !viewport ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height)
  )
    throw new Error("Invalid preview viewport.");
  // The parent's height update can reach the iframe after its convert message.
  // Wait for the actual viewport; a layout read alone cannot apply that resize.
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      Math.abs(innerWidth - viewport.width) < 1 &&
      Math.abs(innerHeight - viewport.height) < 1
    )
      return;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Preview viewport did not settle. Please retry conversion.");
}

function sanitize(html: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed
    .querySelectorAll(
      "script, iframe, frame, frameset, object, embed, base, meta, noscript, template",
    )
    .forEach((element) => element.remove());
  for (const element of parsed.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      if (
        /^on/i.test(attribute.name) ||
        [
          "nonce",
          "srcdoc",
          "formaction",
          "action",
          "target",
          "autofocus",
        ].includes(attribute.name.toLowerCase())
      )
        element.removeAttribute(attribute.name);
      if (
        ["href", "src", "xlink:href"].includes(attribute.name.toLowerCase()) &&
        /^\s*(javascript|vbscript):/i.test(attribute.value)
      )
        element.removeAttribute(attribute.name);
    }
    if (element.localName.toLowerCase() === "a") {
      element.removeAttribute("href");
      element.removeAttribute("xlink:href");
    }
    if (
      element.tagName === "LINK" &&
      (element as HTMLLinkElement).rel !== "stylesheet"
    )
      element.remove();
  }
  const fragment = document.createDocumentFragment();
  // Preserve embedded styles and stylesheet links from full HTML documents.
  parsed.head
    .querySelectorAll('style, link[rel="stylesheet"]')
    .forEach((element) => fragment.append(element));
  fragment.append(...Array.from(parsed.body.childNodes));
  return fragment;
}

async function loadPreview(html: string, css: string) {
  const stage = document.createElement("div");
  stage.id = "h2f-stage";
  stage.style.display = "flow-root";
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  stage.append(sanitize(html));
  document.body.replaceChildren(stage);
  const failures = new Set<string>();
  const resources: Promise<unknown>[] = Array.from(document.images).map(
    (image) => {
      const name = image.getAttribute("src") || "image";
      if (image.complete) {
        if (!image.naturalWidth) failures.add(name);
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener(
          "error",
          () => {
            failures.add(name);
            resolve();
          },
          { once: true },
        );
      });
    },
  );
  for (const sheet of stage.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]',
  )) {
    resources.push(
      new Promise<void>((resolve) => {
        if (sheet.sheet) {
          resolve();
          return;
        }
        sheet.addEventListener("load", () => resolve(), { once: true });
        sheet.addEventListener(
          "error",
          () => {
            failures.add(sheet.href);
            resolve();
          },
          { once: true },
        );
      }),
    );
  }
  const timeout = async (promise: Promise<unknown>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      promise,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          failures.add("Resource loading timed out (5s)");
          resolve();
        }, 5000);
      }),
    ]);
    clearTimeout(timer);
  };
  await timeout(Promise.all(resources));
  await timeout(document.fonts.ready);
  for (const face of document.fonts)
    if (face.status === "error")
      failures.add(`Font failed to load: ${face.family}`);
  // Offscreen cross-origin frames can pause rAF indefinitely. Geometry reads
  // during conversion flush layout; yield once without depending on visibility.
  await new Promise<void>((resolve) => setTimeout(resolve, 30));
  resourceWarnings = Array.from(failures);
  const children = Array.from(stage.children).filter(
    (element) => !["STYLE", "LINK"].includes(element.tagName),
  );
  hasContent =
    children.length > 0 ||
    Array.from(stage.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );
  root =
    children.length === 1 && children[0] instanceof HTMLElement
      ? children[0]
      : stage;
  send("ready", {
    warnings: resourceWarnings,
    height: Math.min(1000, Math.max(250, document.body.scrollHeight)),
  });
}

window.addEventListener("message", async (event) => {
  if (event.source !== window.parent || event.data?.channel !== channel) return;
  try {
    if (event.data.type === "init") {
      await loadPreview(String(event.data.html), String(event.data.css));
    } else if (event.data.type === "highlight" && root) {
      highlight?.remove();
      highlight = undefined;
      const bounds = event.data.bounds;
      if (
        bounds &&
        [bounds.x, bounds.y, bounds.width, bounds.height].every(
          Number.isFinite,
        ) &&
        bounds.width > 0 &&
        bounds.height > 0
      ) {
        highlight = document.createElement("div");
        highlight.dataset.previewHighlight = "";
        highlight.setAttribute("aria-hidden", "true");
        Object.assign(highlight.style, {
          position: "absolute",
          pointerEvents: "none",
          left: `${bounds.x}px`,
          top: `${bounds.y}px`,
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
          outline: "2px solid #874fff",
          outlineOffset: "3px",
          borderRadius: "2px",
          zIndex: "1",
        });
        // Outside the converted root: selection never becomes a captured layer.
        document.body.append(highlight);
      }
    } else if (event.data.type === "convert" && root) {
      if (!hasContent) throw new Error("No content to convert.");
      await waitForViewport(event.data.viewport);
      const result = convert(root);
      result.metadata.sourceUrl = event.data.sourceUrl;
      send("result", {
        document: result,
        request: event.data.request,
        warnings: resourceWarnings,
      });
    }
  } catch (error) {
    send("error", {
      message: error instanceof Error ? error.message : "Conversion failed",
      request: event.data.request,
    });
  }
});
send("boot");
