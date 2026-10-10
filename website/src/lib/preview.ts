import { isHtml2FigmaDocument, type Html2FigmaDocument } from "html2figma";
import fontData from "../data/generated/font.json";

export interface PreviewResult {
  document: Html2FigmaDocument;
  warnings: string[];
}
export class PreviewSession {
  readonly ready: Promise<string[]>;
  private channel = crypto.randomUUID();
  private request = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: PreviewResult) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private cleanup: () => void;

  constructor(
    private frame: HTMLIFrameElement,
    html: string,
    css: string,
    width: number,
  ) {
    let readyResolve: (warnings: string[]) => void;
    let readyReject: (error: Error) => void;
    this.ready = new Promise((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });
    const timer = setTimeout(
      () => readyReject(new Error("Preview loading timed out")),
      14000,
    );
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== frame.contentWindow ||
        event.data?.channel !== this.channel
      )
        return;
      const message = event.data;
      if (message.type === "boot") this.send("init", { html, css });
      if (message.type === "ready") {
        clearTimeout(timer);
        frame.style.height = `${Math.min(1000, Math.max(250, Number(message.height) || 400))}px`;
        readyResolve(Array.isArray(message.warnings) ? message.warnings : []);
      }
      if (message.type === "error" && message.request === undefined) {
        clearTimeout(timer);
        readyReject(new Error(message.message));
      }
      const pending = this.pending.get(message.request);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.request);
      if (message.type === "result" && isHtml2FigmaDocument(message.document))
        pending.resolve({
          document: message.document,
          warnings: message.warnings || [],
        });
      else
        pending.reject(
          new Error(message.message || "Invalid conversion result"),
        );
    };
    window.addEventListener("message", onMessage);
    this.cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      readyReject(new Error("Preview replaced"));
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error("Preview replaced"));
      }
      this.pending.clear();
    };
    frame.style.width = `${width}px`;
    frame.style.minWidth = `${width}px`;
    frame.setAttribute("sandbox", "allow-scripts");
    frame.referrerPolicy = "no-referrer";
    const runner = new URL("/preview/runner.js", window.location.origin).href;
    const font = fontData.source;
    const policy = `default-src 'none'; script-src 'nonce-${this.channel}'; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; font-src https: http: data:; connect-src 'none'; form-action 'none'; base-uri 'none'`;
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>@font-face{font-family:Geist;src:url('${font}') format('woff2')}html{background:white}body{margin:0;padding:24px;box-sizing:border-box;font-family:Geist,sans-serif}</style></head><body></body><script nonce="${this.channel}" data-channel="${this.channel}" src="${runner}"></script></html>`;
  }

  private send(type: string, extra: Record<string, unknown> = {}) {
    this.frame.contentWindow?.postMessage(
      { channel: this.channel, type, ...extra },
      "*",
    );
  }

  async convert(): Promise<PreviewResult> {
    await this.ready;
    const request = ++this.request;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request);
        reject(new Error("Conversion timed out"));
      }, 10000);
      this.pending.set(request, { resolve, reject, timer });
      this.send("convert", {
        request,
        sourceUrl: window.location.href,
        viewport: {
          width: parseFloat(this.frame.style.width),
          height: parseFloat(this.frame.style.height),
        },
      });
    });
  }

  highlight(bounds?: { x: number; y: number; width: number; height: number }) {
    this.send("highlight", { bounds });
  }

  destroy() {
    this.cleanup();
  }
}

export function downloadJson(value: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([value], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
