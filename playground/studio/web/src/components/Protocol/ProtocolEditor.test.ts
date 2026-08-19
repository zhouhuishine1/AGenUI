import { jsonLanguage } from "@codemirror/lang-json";
import { describe, expect, it } from "vitest";
import { componentIdForSelection } from "./ProtocolEditor";

const document = `{
  "updateComponents": {
    "components": [
      { "id": "headline", "component": "Text", "text": "Hello" },
      { "id": "cta", "component": "Button", "child": "headline" }
    ]
  }
}`;

function range(text: string) {
  const from = document.indexOf(text);
  return { from, to: from + text.length };
}

describe("componentIdForSelection", () => {
  const tree = jsonLanguage.parser.parse(document).topNode;

  it("finds a component for a cursor or partial selection inside it", () => {
    const cursor = document.indexOf("Hello");

    expect(componentIdForSelection(tree, document, [{ from: cursor, to: cursor }])).toBe("headline");
    expect(componentIdForSelection(tree, document, [range('"component": "Text"')])).toBe("headline");
  });

  it("rejects non-component and cross-component selections", () => {
    expect(componentIdForSelection(tree, document, [range('"updateComponents"')])).toBeNull();
    expect(componentIdForSelection(tree, document, [range('"headline", "component": "Text", "text": "Hello" },\n      { "id": "cta"')])).toBeNull();
  });

  it("rejects selections while the JSON is invalid", () => {
    const invalid = document.replace('"Hello"', '"Hello');
    const cursor = invalid.indexOf("Hello");

    expect(componentIdForSelection(jsonLanguage.parser.parse(invalid).topNode, invalid, [{ from: cursor, to: cursor }])).toBeNull();
  });
});
