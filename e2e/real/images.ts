import { chromium, type Page } from "@playwright/test";
import pixelmatch from "./pixelmatch.cjs";

// Decode with public browser APIs; compare with the pinned ISC pixelmatch copy.

interface DecodedImage {
  width: number;
  height: number;
  data: number[];
}

interface Comparison {
  passed: boolean;
  differentPixels: number | null;
  actualDiffPixelRatio: number | null;
  textRegionDifferentPixels?: number;
  textRegionDiffPixelRatio?: number;
  textInkRetention?: number;
  errorMessage?: string;
  diff?: Buffer;
}

interface Focus {
  region: { x: number; y: number; width: number; height: number };
  maxDiffPixelRatio: number;
  inkColors: Array<[number, number, number]>;
  minInkRetention: number;
}

function cropPixels(pixels: number[], imageWidth: number, region: Focus["region"]): Uint8Array {
  const cropped = new Uint8Array(region.width * region.height * 4);
  for (let row = 0; row < region.height; row++) {
    const source = ((region.y + row) * imageWidth + region.x) * 4;
    cropped.set(pixels.slice(source, source + region.width * 4), row * region.width * 4);
  }
  return cropped;
}

function countInkPixels(pixels: Uint8Array, colors: Focus["inkColors"]): number {
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (colors.some(([red, green, blue]) =>
      (pixels[index]! - red) ** 2 + (pixels[index + 1]! - green) ** 2 +
      (pixels[index + 2]! - blue) ** 2 <= 40 ** 2)) count++;
  }
  return count;
}

function assertPngHeader(bytes: Buffer): void {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Invalid PNG signature");
  }
}

async function decodeImage(page: Page, bytes: Buffer): Promise<DecodedImage> {
  return page.evaluate(async (base64) => {
    const response = await fetch(`data:image/png;base64,${base64}`);
    const bitmap = await createImageBitmap(await response.blob(), {
      colorSpaceConversion: "none",
      premultiplyAlpha: "none"
    });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return { width: canvas.width, height: canvas.height,
      data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
  }, bytes.toString("base64"));
}

export async function createImageComparator() {
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  let page: Awaited<ReturnType<typeof browser.newPage>>;
  try {
    page = await browser.newPage();
  } catch (error) {
    await browser.close();
    throw error;
  }

  return {
    async compare(actual: Buffer, expected: Buffer, width: number, height: number,
      maxDiffPixelRatio: number, focus?: Focus): Promise<Comparison> {
      assertPngHeader(actual);
      assertPngHeader(expected);
      const images = { actual: await decodeImage(page, actual), expected: await decodeImage(page, expected) };

      if (images.actual.width !== width || images.actual.height !== height) {
        throw new Error("Decoded Figma PNG dimensions mismatch");
      }
      if (images.expected.width !== width || images.expected.height !== height) {
        return { passed: false, differentPixels: null, actualDiffPixelRatio: null,
          errorMessage: `Expected browser image ${width}px by ${height}px, received ${images.expected.width}px by ${images.expected.height}px.` };
      }

      const diff = new Uint8Array(width * height * 4);
      const count = pixelmatch(Uint8Array.from(images.expected.data), Uint8Array.from(images.actual.data),
        diff, width, height, { threshold: 0.2 });
      const actualDiffPixelRatio = count / (width * height);
      let textRegionDifferentPixels: number | undefined;
      let textRegionDiffPixelRatio: number | undefined;
      let textInkRetention: number | undefined;
      if (focus) {
        const { region } = focus;
        if (![region.x, region.y, region.width, region.height].every(Number.isInteger) ||
            region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 ||
            region.x + region.width > width || region.y + region.height > height) {
          throw new Error("Invalid text comparison region");
        }
        const expectedPixels = cropPixels(images.expected.data, width, region);
        const actualPixels = cropPixels(images.actual.data, width, region);
        textRegionDifferentPixels = pixelmatch(
          expectedPixels, actualPixels,
          new Uint8Array(region.width * region.height * 4),
          region.width, region.height, { threshold: 0.2 });
        textRegionDiffPixelRatio = textRegionDifferentPixels / (region.width * region.height);
        const expectedInk = countInkPixels(expectedPixels, focus.inkColors);
        if (!expectedInk) throw new Error("Text reference has no visible ink pixels");
        textInkRetention = countInkPixels(actualPixels, focus.inkColors) / expectedInk;
      }
      const passed = actualDiffPixelRatio <= maxDiffPixelRatio &&
        (textRegionDiffPixelRatio === undefined || textRegionDiffPixelRatio <= focus!.maxDiffPixelRatio) &&
        (textInkRetention === undefined || textInkRetention >= focus!.minInkRetention);
      if (passed) {
        return { passed, differentPixels: count, actualDiffPixelRatio,
          textRegionDifferentPixels, textRegionDiffPixelRatio, textInkRetention };
      }

      const diffBase64 = await page.evaluate(({ pixels, width, height }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context unavailable");
        context.putImageData(new ImageData(Uint8ClampedArray.from(pixels), width, height), 0, 0);
        return canvas.toDataURL("image/png").split(",", 2)[1]!;
      }, { pixels: Array.from(diff), width, height });
      const focusMessage = textRegionDiffPixelRatio === undefined ? "" :
        ` Text region: ${textRegionDifferentPixels} pixels (${textRegionDiffPixelRatio.toFixed(4)} ratio, limit ${focus!.maxDiffPixelRatio});` +
        ` ink retention ${textInkRetention?.toFixed(4)} (minimum ${focus!.minInkRetention}).`;
      return { passed: false, differentPixels: count, actualDiffPixelRatio,
        textRegionDifferentPixels, textRegionDiffPixelRatio, textInkRetention,
        errorMessage: `${count} pixels (ratio ${actualDiffPixelRatio.toFixed(4)} of all image pixels) are different.${focusMessage}`,
        diff: Buffer.from(diffBase64, "base64") };
    },
    close: () => browser.close()
  };
}
