import type { A2uiPayload } from "@/types";

export interface PreviewMessage {
  version: "v0.9";
  createSurface?: { surfaceId: string; catalogId: string };
  updateComponents?: { surfaceId: string; components: Record<string, unknown>[] };
  updateDataModel?: { surfaceId: string; path?: string; value?: unknown };
}

const catalogId = "https://a2ui.org/specification/v0_9/basic_catalog.json";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function buildPreviewProtocol(components: A2uiPayload, datamodel: A2uiPayload | null) {
  const update = asObject(components.updateComponents) ?? components;
  const surfaceId = update.surfaceId;
  if (typeof surfaceId !== "string" || !surfaceId) throw new Error("updateComponents.surfaceId is required");
  if (!Array.isArray(update.components)) throw new Error("updateComponents.components must be an array");
  const nodes = update.components.map((node, index) => {
    const record = asObject(node);
    const name = record?.component ?? record?.type;
    if (!record || typeof name !== "string") throw new Error("Component " + (index + 1) + " is missing component/type");
    return { ...record, component: name };
  });
  const messages: PreviewMessage[] = [
    { version: "v0.9", createSurface: { surfaceId, catalogId } },
    { version: "v0.9", updateComponents: { surfaceId, components: nodes } },
  ];
  if (datamodel) {
    const updateData = asObject(datamodel.updateDataModel) ?? datamodel;
    if (updateData.surfaceId !== undefined && updateData.surfaceId !== surfaceId) throw new Error("Data-model surfaceId does not match");
    messages.push({ version: "v0.9", updateDataModel: { surfaceId, path: typeof updateData.path === "string" ? updateData.path : "/", value: updateData.value ?? updateData } });
  }
  return { surfaceId, messages };
}
