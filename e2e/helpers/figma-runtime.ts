import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import type { Html2FigmaDocument } from "../../src/schema/types";

export interface SceneNodeRecord {
  type: string;
  name: string;
  width: number;
  height: number;
  children: SceneNodeRecord[];
  characters?: string;
  fills: Array<{ type: string; imageHash?: string }>;
  layoutMode?: string;
  layoutPositioning?: string;
  [property: string]: unknown;
}

export interface PluginMessage {
  type: "render-block" | "render-json";
  blockId?: string;
  source?: "paste" | "file";
  document: Html2FigmaDocument;
}

export async function createFigmaRuntime() {
  const state = {
    shell: "",
    messages: [] as PluginMessage[],
    notifications: [] as string[],
    fonts: [] as FontName[],
    images: [] as Uint8Array[],
    svgs: [] as string[],
    zoomedNodes: [] as SceneNodeRecord[],
    errors: [] as string[]
  };

  const parents = new WeakMap<SceneNodeRecord, SceneNodeRecord>();

  function createNode(type: string): SceneNodeRecord {
    let positioning = "AUTO";
    const node: SceneNodeRecord = {
      type, name: "", width: 0, height: 0, children: [], fills: [],
      resize(width: number, height: number) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
          throw new Error("Invalid node dimensions");
        }
        node.width = width;
        node.height = height;
      },
      appendChild(child: SceneNodeRecord) {
        node.children.push(child);
        parents.set(child, node);
      },
      get layoutPositioning() { return positioning; },
      set layoutPositioning(value: string) {
        const parent = parents.get(node);
        if (value === "ABSOLUTE" && (!parent?.layoutMode || parent.layoutMode === "NONE")) {
          throw new Error("Absolute positioning requires an Auto Layout parent");
        }
        positioning = value;
      }
    };
    return node;
  }

  const currentPage = Object.assign(createNode("PAGE"), {
    selection: [] as SceneNodeRecord[]
  });
  const api = {
    currentPage,
    ui: { onmessage: undefined as ((message: unknown) => Promise<void>) | undefined },
    showUI(html: string) { state.shell = html; },
    createFrame: () => createNode("FRAME"),
    createRectangle: () => createNode("RECTANGLE"),
    createText: () => createNode("TEXT"),
    createNodeFromSvg(svg: string) {
      state.svgs.push(svg);
      return createNode("FRAME");
    },
    async loadFontAsync(font: FontName) { state.fonts.push(font); },
    createImage(bytes: Uint8Array) {
      if (!bytes.byteLength) throw new Error("Empty image");
      state.images.push(bytes);
      return { hash: `image-${state.images.length}` };
    },
    viewport: {
      scrollAndZoomIntoView(nodes: SceneNodeRecord[]) { state.zoomedNodes = nodes; }
    },
    notify(message: string) { state.notifications.push(message); }
  };

  const bundle = await readFile(
    new URL("../../example/figma-plugin/dist/plugin/main.js", import.meta.url), "utf8"
  );
  // The actual built plugin runs without browser globals, just as in Figma.
  runInNewContext(bundle, {
    figma: api, fetch, Uint8Array,
    console: { error: (...args: unknown[]) => state.errors.push(args.map(String).join(" ")) }
  }, { filename: "figma-plugin/main.js", timeout: 5_000 });

  if (!state.shell || !api.ui.onmessage) {
    throw new Error("Built plugin did not initialize its UI and message handler");
  }

  return {
    state,
    currentPage,
    async deliver(message: PluginMessage) {
      state.messages.push(message);
      await api.ui.onmessage!(message);
    }
  };
}

export function flattenScene(node: SceneNodeRecord): SceneNodeRecord[] {
  return [node, ...node.children.flatMap(flattenScene)];
}
