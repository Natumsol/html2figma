import { describe, expect, it } from "vitest";
import { parseOptionalPx, parsePx } from "../../src/utils/length";

describe("parsePx", () => {
  it("parses px lengths", () => {
    expect(parsePx("12px")).toBe(12);
    expect(parsePx("0px")).toBe(0);
  });
});

describe("parseOptionalPx", () => {
  it("returns fallback for non-px CSS lengths", () => {
    expect(parseOptionalPx("auto", 7)).toBe(7);
    expect(parseOptionalPx("calc(100% - 4px)", 3)).toBe(3);
  });
});
