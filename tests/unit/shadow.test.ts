import { describe, expect, it } from "vitest";
import { parseBoxShadow } from "../../src/utils/shadow";

describe("parseBoxShadow", () => {
  it("parses rgba drop shadows", () => {
    expect(parseBoxShadow("rgba(0, 0, 0, 0.25) 0px 4px 12px 0px")).toEqual([
      {
        type: "drop-shadow",
        color: {
          r: 0,
          g: 0,
          b: 0
        },
        opacity: 0.25,
        offsetX: 0,
        offsetY: 4,
        blur: 12,
        spread: 0
      }
    ]);
  });

  it("ignores inset shadows", () => {
    expect(parseBoxShadow("inset rgba(0, 0, 0, 0.25) 0px 4px 12px 0px")).toEqual([]);
  });

  it("rejects shadows with non-px length tokens", () => {
    expect(parseBoxShadow("rgba(0, 0, 0, 0.2) 0px auto 12px")).toEqual([]);
  });
});
