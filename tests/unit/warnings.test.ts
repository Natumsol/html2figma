import { describe, expect, it } from "vitest";

import { createWarning } from "../../src/utils/warnings";

describe("createWarning", () => {
  it("creates a structured warning with source metadata", () => {
    const warning = createWarning(
      "unsupported-transform",
      "Transform is unsupported.",
      "warning",
      {
        nodeId: "node-1",
        cssProperty: "transform"
      }
    );

    expect(warning).toEqual({
      code: "unsupported-transform",
      message: "Transform is unsupported.",
      severity: "warning",
      nodeId: "node-1",
      cssProperty: "transform"
    });
  });
});
