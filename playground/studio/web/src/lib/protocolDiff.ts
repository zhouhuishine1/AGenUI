import type { A2uiPayload } from "@/types";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function componentMap(payload: A2uiPayload | null): Map<string, unknown> {
  const components = record(payload?.updateComponents)?.components;
  if (!Array.isArray(components)) return new Map();
  return new Map(components.flatMap((component) => {
    const id = record(component)?.id;
    return typeof id === "string" ? [[id, component]] : [];
  }));
}

function dataRoot(payload: A2uiPayload | null): { path: string; value: unknown } {
  const update = record(payload?.updateDataModel);
  const path = typeof update?.path === "string" ? update.path.replace(/\/$/, "") || "/" : "/";
  return { path, value: update?.value };
}

function diffPaths(before: unknown, after: unknown, path: string, result: string[]) {
  if (same(before, after)) return;
  const beforeRecord = record(before);
  const afterRecord = record(after);
  if (!beforeRecord || !afterRecord) {
    result.push(path);
    return;
  }
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  keys.forEach((key) => diffPaths(beforeRecord[key], afterRecord[key], `${path === "/" ? "" : path}/${key}`, result));
}

export function protocolChangeSummary(before: { components: A2uiPayload; datamodel: A2uiPayload | null } | null, after: { components: A2uiPayload; datamodel: A2uiPayload | null }) {
  const previousComponents = componentMap(before?.components ?? null);
  const nextComponents = componentMap(after.components);
  const componentIds = [...new Set([...previousComponents.keys(), ...nextComponents.keys()])]
    .filter((id) => !same(previousComponents.get(id), nextComponents.get(id)));
  const previousData = dataRoot(before?.datamodel ?? null);
  const nextData = dataRoot(after.datamodel);
  const dataPaths: string[] = [];
  diffPaths(previousData.value, nextData.value, nextData.path === "/" ? previousData.path : nextData.path, dataPaths);
  return { componentIds, dataPaths };
}
