/** CodeMirror 6 JSON editor for one A2UI payload (components or datamodel). */

import { json } from "@codemirror/lang-json";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import { historyField, redoDepth, undoDepth } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

interface ProtocolEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** While streaming, the editor is driven by the token stream (read-only). */
  readOnly: boolean;
  /** Receives the underlying EditorView so the parent can dispatch undo/redo. */
  viewRef?: MutableRefObject<EditorView | null>;
  /** Receives current undo/redo availability for the editor history. */
  onHistoryChange?: (history: { canUndo: boolean; canRedo: boolean }) => void;
  historyState?: unknown;
  onHistoryStateChange?: (state: unknown) => void;
  /** When set, the JSON object whose top-level "id" matches is selected and
   * scrolled into view (used by preview click-to-select). */
  selectComponentId?: { id: string; seq: number } | null;
  /** Reports the one updateComponents component containing the editor selection. */
  onComponentSelection?: (id: string | null) => void;
}

/** Find the string value of the first JSON property named "id" matching targetId. */
function findObjectWithId(node: SyntaxNode, doc: string, targetId: string): SyntaxNode | null {
  if (node.type.name === "Object") {
    let child = node.firstChild;
    while (child) {
      if (child.type.name === "Property") {
        const key = child.firstChild;
        const colon = key?.nextSibling ?? null;
        const value = colon?.nextSibling ?? null;
        if (
          key && value &&
          doc.slice(key.from, key.to) === '"id"' &&
          value.type.name === "String" &&
          doc.slice(value.from, value.to) === JSON.stringify(targetId)
        ) {
          return value;
        }
      }
      child = child.nextSibling;
    }
  }
  let child = node.firstChild;
  while (child) {
    const found = findObjectWithId(child, doc, targetId);
    if (found) return found;
    child = child.nextSibling;
  }
  return null;
}

function propertyValue(node: SyntaxNode, doc: string, name: string): SyntaxNode | null {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.type.name !== "Property") continue;
    const key = child.firstChild;
    const value = key?.nextSibling?.nextSibling ?? null;
    if (key && value && doc.slice(key.from, key.to) === JSON.stringify(name)) return value;
  }
  return null;
}

function componentNodes(node: SyntaxNode, doc: string): SyntaxNode[] {
  const root = node.type.name === "Object" ? node : findFirstObject(node);
  if (!root) return [];
  const updateComponents = propertyValue(root, doc, "updateComponents");
  if (!updateComponents || updateComponents.type.name !== "Object") return [];
  const components = propertyValue(updateComponents, doc, "components");
  if (!components || components.type.name !== "Array") return [];
  const result: SyntaxNode[] = [];
  for (let child = components.firstChild; child; child = child.nextSibling) {
    if (child.type.name === "Object") result.push(child);
  }
  return result;
}

function findFirstObject(node: SyntaxNode): SyntaxNode | null {
  if (node.type.name === "Object") return node;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const object = findFirstObject(child);
    if (object) return object;
  }
  return null;
}

export function componentIdForSelection(node: SyntaxNode, doc: string, ranges: readonly { from: number; to: number }[]): string | null {
  if (hasSyntaxError(node)) return null;
  const ids = new Set<string>();
  for (const range of ranges) {
    const matches = componentNodes(node, doc).filter((component) => range.from === range.to
      ? range.from >= component.from && range.from < component.to
      : range.from >= component.from && range.to <= component.to);
    if (matches.length !== 1) return null;
    const id = propertyValue(matches[0], doc, "id");
    if (!id || id.type.name !== "String") return null;
    try {
      const value = JSON.parse(doc.slice(id.from, id.to));
      if (typeof value !== "string") return null;
      ids.add(value);
    } catch {
      return null;
    }
  }
  return ids.size === 1 ? [...ids][0] : null;
}

function hasSyntaxError(node: SyntaxNode): boolean {
  if (node.type.isError) return true;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (hasSyntaxError(child)) return true;
  }
  return false;
}

const HISTORY_FIELDS = { history: historyField };

export function ProtocolEditor({ value, onChange, readOnly, viewRef, onHistoryChange, historyState, onHistoryStateChange, selectComponentId, onComponentSelection }: ProtocolEditorProps) {
  const suppressSelectionSyncRef = useRef(false);
  const selectionSyncFrameRef = useRef<number | null>(null);
  const scrollTopRef = useRef(0);
  const extensions = useMemo(() => [
    json(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged || update.transactions.some((transaction) => transaction.isUserEvent("undo") || transaction.isUserEvent("redo"))) {
        onHistoryChange?.({ canUndo: undoDepth(update.state) > 0, canRedo: redoDepth(update.state) > 0 });
        onHistoryStateChange?.(update.state.toJSON(HISTORY_FIELDS));
      }
      if (update.selectionSet && !suppressSelectionSyncRef.current) {
        onComponentSelection?.(componentIdForSelection(
          syntaxTree(update.state).topNode,
          update.state.doc.toString(),
          update.state.selection.ranges,
        ));
      }
    }),
  ], [onComponentSelection, onHistoryChange, onHistoryStateChange]);
  const [view, setView] = useState<EditorView | null>(null);

  useEffect(() => {
    if (viewRef) viewRef.current = view;
    if (view) onHistoryChange?.({ canUndo: undoDepth(view.state) > 0, canRedo: redoDepth(view.state) > 0 });
  }, [view, viewRef, onHistoryChange]);

  useEffect(() => {
    if (!view || value === view.state.doc.toString()) return;
    const scrollTop = view.scrollDOM.scrollTop;
    suppressSelectionSyncRef.current = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    if (selectionSyncFrameRef.current !== null) cancelAnimationFrame(selectionSyncFrameRef.current);
    selectionSyncFrameRef.current = requestAnimationFrame(() => {
      suppressSelectionSyncRef.current = false;
      selectionSyncFrameRef.current = null;
    });
    requestAnimationFrame(() => { view.scrollDOM.scrollTop = scrollTop; });
  }, [value, view]);

  useEffect(() => () => {
    if (selectionSyncFrameRef.current !== null) cancelAnimationFrame(selectionSyncFrameRef.current);
  }, []);

  // Select (and scroll to) the id value matching the requested preview component.
  useEffect(() => {
    if (!selectComponentId || !view) return;
    const doc = view.state.doc.toString();
    const node = findObjectWithId(syntaxTree(view.state).topNode, doc, selectComponentId.id);
    if (!node) return;
    suppressSelectionSyncRef.current = true;
    try {
      view.dispatch({
        selection: { anchor: node.from, head: node.to },
        effects: EditorView.scrollIntoView(node.from, { y: "center" }),
        scrollIntoView: true,
      });
    } finally {
      suppressSelectionSyncRef.current = false;
    }
    view.focus();
  }, [selectComponentId, view]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      initialState={historyState ? { json: historyState, fields: HISTORY_FIELDS } : undefined}
      editable={!readOnly}
      onCreateEditor={setView}
      onUpdate={(update) => { scrollTopRef.current = update.view.scrollDOM.scrollTop; }}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        bracketMatching: true,
      }}
      height="100%"
      style={{ height: "100%", fontSize: 12 }}
      placeholder={readOnly ? "Waiting for protocol output..." : "{ }"}
    />
  );
}
