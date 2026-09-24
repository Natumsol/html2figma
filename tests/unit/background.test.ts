import { describe, expect, test } from "vitest";

import { imageMimeType, parseBackgroundImage } from "../../src/utils/background";

describe("parseBackgroundImage", () => {
  test("parses a single url background image", () => {
    expect(parseBackgroundImage('url("https://example.com/card.png")')).toEqual({
      kind: "url",
      url: "https://example.com/card.png"
    });
  });

  test("parses url background images with CSS spacing", () => {
    expect(parseBackgroundImage('url( "a.png" )')).toEqual({
      kind: "url",
      url: "a.png"
    });
  });

  test("rejects gradients", () => {
    expect(parseBackgroundImage("linear-gradient(red, blue)")).toEqual({
      kind: "unsupported",
      reason: "gradient"
    });
  });

  test("rejects multiple background layers", () => {
    expect(parseBackgroundImage('url("a.png"), url("b.png")')).toEqual({
      kind: "unsupported",
      reason: "multiple"
    });
  });
});

test("recognizes embedded image MIME types", () => {
  expect(imageMimeType("data:image/png;base64,AAAA")).toBe("image/png");
  expect(imageMimeType("data:image/jpeg;base64,AAAA")).toBe("image/jpeg");
});
