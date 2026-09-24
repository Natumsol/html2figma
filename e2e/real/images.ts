import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Reuse the exact decoder/comparator used by the existing Playwright snapshots.
// Keep this dependency on Playwright's internal packaging in one place.
const require = createRequire(import.meta.url);
const playwright = dirname(require.resolve("playwright-core/package.json"));
const { PNG } = require(join(playwright, "lib/utilsBundle.js")) as {
  PNG: { sync: { read(bytes: Buffer): { width: number; height: number } } };
};
const { getComparator } = require(join(playwright, "lib/server/utils/comparators.js")) as {
  getComparator(type: string): (actual: Buffer, expected: Buffer, options: {
    threshold: number; maxDiffPixelRatio: number;
  }) => { errorMessage: string; diff?: Buffer } | null;
};

export function decodePng(bytes: Buffer, width: number, height: number): void {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) {
    throw new Error("PNG signature or dimensions mismatch");
  }
  const decoded = PNG.sync.read(bytes);
  if (decoded.width !== width || decoded.height !== height) throw new Error("Decoded dimensions mismatch");
}

export function compareVisual(actual: Buffer, expected: Buffer, maxDiffPixelRatio: number) {
  return getComparator("image/png")(actual, expected, { threshold: 0.2, maxDiffPixelRatio });
}
