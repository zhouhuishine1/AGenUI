import { describe, expect, it } from "vitest";
import { parseStream } from "./protocolParser";

describe("parseStream", () => {
  it("parses JSON fences whose opening brace follows json on the same line", () => {
    const parsed = parseStream("```json {\"updateComponents\":{}}\n```\n```json {\"updateDataModel\":{}}\n```");

    expect(parsed.components).toBe('{"updateComponents":{}}');
    expect(parsed.datamodel).toBe('{"updateDataModel":{}}');
  });
});
