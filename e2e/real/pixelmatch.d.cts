declare function pixelmatch(
  expected: Uint8Array,
  actual: Uint8Array,
  diff: Uint8Array,
  width: number,
  height: number,
  options: { threshold: number }
): number;

export = pixelmatch;
