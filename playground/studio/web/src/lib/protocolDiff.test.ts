import { describe, expect, it } from "vitest";
import { protocolChangeSummary } from "./protocolDiff";

describe("protocolChangeSummary", () => {
  it("reports changed component IDs and data paths", () => {
    const before = {
      components: { updateComponents: { components: [{ id: "root", component: "Column" }, { id: "card_body", component: "Text", text: "before" }] } },
      datamodel: { updateDataModel: { path: "/", value: { userInfo: { labels: { name: "before" } } } } },
    };
    const after = {
      components: { updateComponents: { components: [{ id: "root", component: "Column", styles: { padding: "8px" } }, { id: "card_body", component: "Text", text: "after" }] } },
      datamodel: { updateDataModel: { path: "/", value: { userInfo: { labels: { name: "after" } } } } },
    };
    expect(protocolChangeSummary(before, after)).toEqual({ componentIds: ["root", "card_body"], dataPaths: ["/userInfo/labels/name"] });
  });

  it("reports no changes for identical payloads", () => {
    const payload = { components: { updateComponents: { components: [{ id: "root", component: "Column" }] } }, datamodel: null };
    expect(protocolChangeSummary(payload, payload)).toEqual({ componentIds: [], dataPaths: [] });
  });
});
