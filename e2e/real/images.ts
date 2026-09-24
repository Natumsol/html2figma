import { chromium, type Page } from "@playwright/test";
import pixelmatch from "./pixelmatch.cjs";

// Decode with public browser APIs; compare with the pinned ISC pixelmatch copy.

interface DecodedImage {
  width: number;
  height: number;
  data: number[];
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
    async compare(actual: Buffer, expected: Buffer, width: number, height: number, maxDiffPixelRatio: number) {
      assertPngHeader(actual);
      assertPngHeader(expected);
      const images = { actual: await decodeImage(page, actual), expected: await decodeImage(page, expected) };

      if (images.actual.width !== width || images.actual.height !== height) {
        throw new Error("Decoded Figma PNG dimensions mismatch");
      }
      if (images.expected.width !== width || images.expected.height !== height) {
        return { errorMessage: `Expected browser image ${width}px by ${height}px, received ${images.expected.width}px by ${images.expected.height}px.` };
      }

      const diff = new Uint8Array(width * height * 4);
      const count = pixelmatch(Uint8Array.from(images.expected.data), Uint8Array.from(images.actual.data),
        diff, width, height, { threshold: 0.2 });
      if (count <= width * height * maxDiffPixelRatio) return null;

      const diffBase64 = await page.evaluate(({ pixels, width, height }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context unavailable");
        context.putImageData(new ImageData(Uint8ClampedArray.from(pixels), width, height), 0, 0);
        return canvas.toDataURL("image/png").split(",", 2)[1]!;
      }, { pixels: Array.from(diff), width, height });
      const ratio = Math.ceil(count / (width * height) * 100) / 100;
      return { errorMessage: `${count} pixels (ratio ${ratio.toFixed(2)} of all image pixels) are different.`,
        diff: Buffer.from(diffBase64, "base64") };
    },
    close: () => browser.close()
  };
}
