import { describe, expect, it } from "vitest";
import { buildPreviewProtocol } from "./previewProtocol";

describe("buildPreviewProtocol", () => {
  it("builds the official create/update/data event sequence", () => {
    const preview = buildPreviewProtocol(
      { updateComponents: { surfaceId: "preview", components: [{ id: "text", type: "Text", text: "Hello" }] } },
      { updateDataModel: { surfaceId: "preview", path: "/", value: { greeting: "Hello" } } },
    );

    expect(preview.surfaceId).toBe("preview");
    expect(preview.messages).toHaveLength(3);
    expect(preview.messages[1].updateComponents?.components[0].component).toBe("Text");
    expect(preview.messages[2].updateDataModel?.value).toEqual({ greeting: "Hello" });
  });

  it("rejects incomplete or cross-surface payloads", () => {
    expect(() => buildPreviewProtocol({ updateComponents: { components: [] } }, null)).toThrow("surfaceId");
    expect(() => buildPreviewProtocol(
      { updateComponents: { surfaceId: "a", components: [] } },
      { updateDataModel: { surfaceId: "b", value: {} } },
    )).toThrow("does not match");
  });

  it("normalises native type fields for the official renderer", () => {
    const preview = buildPreviewProtocol(
      { updateComponents: { surfaceId: "native", components: [{ id: "chart", type: "Chart" }] } },
      null,
    );
    expect(preview.messages[1].updateComponents?.components[0]).toMatchObject({ component: "Chart" });
  });
});
