import { describe, expect, test } from "vitest";

import { createBorderRectangleBounds } from "../../src/convert/borders";

describe("createBorderRectangleBounds", () => {
  const bounds = { x: 10, y: 20, width: 100, height: 50 };

  test("creates top border bounds", () => {
    expect(createBorderRectangleBounds("top", bounds, 2)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 2
    });
  });

  test("creates right border bounds", () => {
    expect(createBorderRectangleBounds("right", bounds, 3)).toEqual({
      x: 107,
      y: 20,
      width: 3,
      height: 50
    });
  });
});
