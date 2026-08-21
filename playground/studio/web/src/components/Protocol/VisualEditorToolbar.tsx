import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { A2uiPayload } from "@/types";

type ComponentRecord = Record<string, unknown>;
type Alignment = "start" | "center" | "end";
type Dimension = { value: string; unit: string };

interface Props {
  components: A2uiPayload;
  datamodel?: A2uiPayload | null;
  selectedComponentId?: string;
  onChange: (components: A2uiPayload) => void;
}

const TEXT_COMPONENTS = new Set(["Text", "RichText"]);
const FIT_OPTIONS = [
  ["contain", "完整显示"],
  ["cover", "裁切填满"],
  ["fill", "拉伸填满"],
  ["none", "原始尺寸"],
  ["scaleDown", "缩小适配"],
] as const;

function ToolIcon({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-slate-500">{children}</span>;
}

function MarginIcon() { return <ToolIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="5" width="14" height="14" rx="1" /><path d="M9 2v6M15 2v6M9 16v6M15 16v6M2 9h6M16 9h6M2 15h6M16 15h6" /></svg></ToolIcon>; }
function HorizontalIcon() { return <ToolIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h11M4 18h16" /></svg></ToolIcon>; }
function VerticalIcon() { return <ToolIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 4v16M12 6v12M18 4v16" /></svg></ToolIcon>; }
function SizeIcon() { return <ToolIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 3v18M3 5h4M3 19h4M19 3v18M17 5h4M17 19h4M8 12h8" /></svg></ToolIcon>; }
function ImageModeIcon() { return <ToolIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m21 15-5-5L5 21" /></svg></ToolIcon>; }
function MoreIcon() { return <ToolIcon><span className="-mt-2 text-xl leading-none">…</span></ToolIcon>; }
function EventIcon() { return <ToolIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></ToolIcon>; }

type EventType = "event" | "functionCall";
type ValueEntry = { key: string; value: string; source: "manual" | "path" };
type EditorState = { type: EventType; name: string; returnType: string; entries: ValueEntry[] };
type DraftsByType = Record<EventType, EditorState>;
type DataPath = { path: string; value: unknown };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function dataPaths(datamodel: A2uiPayload | null): DataPath[] {
  const update = asRecord(datamodel?.updateDataModel) ?? asRecord(datamodel);
  if (!update) return [];
  const root = typeof update.path === "string" ? update.path.replace(/\/$/, "") || "/" : "/";
  const result: DataPath[] = [];
  const visit = (value: unknown, path: string) => {
    result.push({ path, value });
    const record = asRecord(value);
    if (record) Object.entries(record).forEach(([key, child]) => visit(child, `${path === "/" ? "" : path}/${key}`));
  };
  visit(update.value ?? update, root);
  return result;
}

function editorState(action: unknown): EditorState {
  const record = asRecord(action);
  const event = asRecord(record?.event);
  const functionCall = asRecord(record?.functionCall);
  const type: EventType = functionCall ? "functionCall" : "event";
  const source = functionCall ?? event;
  const pairs = asRecord(source?.[type === "event" ? "context" : "args"]) ?? {};
  return {
    type,
    name: typeof source?.[type === "event" ? "name" : "call"] === "string" ? source[type === "event" ? "name" : "call"] as string : "",
    returnType: typeof functionCall?.returnType === "string" ? functionCall.returnType : "",
    entries: Object.entries(pairs).map(([key, value]) => {
      const path = asRecord(value)?.path;
      return { key, value: typeof path === "string" ? path : typeof value === "string" ? value : JSON.stringify(value), source: typeof path === "string" ? "path" : "manual" };
    }),
  };
}

function emptyEditorState(type: EventType): EditorState {
  return { type, name: "", returnType: "", entries: [] };
}

function EventEditor({ action, datamodel, onConfirm, onClose }: { action: unknown; datamodel: A2uiPayload | null; onConfirm: (action?: Record<string, unknown>) => void; onClose: () => void }) {
  const initialDraft = useMemo(() => editorState(action), [action]);
  const [type, setType] = useState<EventType>(initialDraft.type);
  const [drafts, setDrafts] = useState<DraftsByType>(() => ({ event: initialDraft.type === "event" ? initialDraft : emptyEditorState("event"), functionCall: initialDraft.type === "functionCall" ? initialDraft : emptyEditorState("functionCall") }));
  const [picker, setPicker] = useState<number | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const paths = useMemo(() => dataPaths(datamodel ?? null), [datamodel]);
  const draft = drafts[type];
  const nameLabel = type === "event" ? "名称" : "Call";
  const entriesLabel = type === "event" ? "Context 参数" : "Args 参数";
  const setDraft = (updater: (current: EditorState) => EditorState) => setDrafts((current) => ({ ...current, [type]: updater(current[type]) }));
  const changeEntry = (index: number, change: Partial<ValueEntry>) => setDraft((current) => ({ ...current, entries: current.entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...change } : entry) }));
  const save = () => {
    if (cleared) { onConfirm(); return; }
    const values = Object.fromEntries(draft.entries.filter((entry) => entry.key).map((entry) => [entry.key, entry.source === "path" ? { path: entry.value } : entry.value]));
    const body = { [type === "event" ? "name" : "call"]: draft.name, [type === "event" ? "context" : "args"]: values, ...(type === "functionCall" && draft.returnType ? { returnType: draft.returnType } : {}) };
    onConfirm({ [type]: body });
  };
  return createPortal(<div role="dialog" aria-label="事件菜单" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-base font-semibold text-slate-800">事件</h2><button type="button" aria-label="清空事件" onClick={() => { setDrafts({ event: emptyEditorState("event"), functionCall: emptyEditorState("functionCall") }); setCleared(true); }} className="text-xs text-slate-500 hover:text-red-600">清空</button></div>
      <div className="mb-4"><p className="mb-2 text-xs font-medium text-slate-600">事件类型</p><div className="flex gap-2">{(["event", "functionCall"] as EventType[]).map((nextType) => <button type="button" key={nextType} onClick={() => { setType(nextType); setCleared(false); }} className={`rounded-md border px-3 py-1.5 text-sm ${type === nextType ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}>{nextType}</button>)}</div></div>
      <div className="mb-5 flex gap-3"><label className="block flex-1 text-xs font-medium text-slate-600">{nameLabel}<input aria-label={nameLabel} value={draft.name} onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setCleared(false); }} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-brand-500" /></label>{type === "functionCall" && <label className="block w-40 text-xs font-medium text-slate-600">返回类型<select aria-label="返回类型" value={draft.returnType} onChange={(event) => setDraft((current) => ({ ...current, returnType: event.target.value }))} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800"><option value="">不选择</option>{["string", "number", "boolean", "array", "object", "any", "void"].map((returnType) => <option key={returnType} value={returnType}>{returnType}</option>)}</select></label>}</div>
      <div><div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium text-slate-600">{entriesLabel}</p><button type="button" onClick={() => { setDraft((current) => ({ ...current, entries: [...current.entries, { key: "", value: "", source: "manual" }] })); setCleared(false); }} className="text-xs text-brand-600 hover:text-brand-700">添加参数</button></div>
        <div className="space-y-2">{draft.entries.map((entry, index) => <div key={index} className="flex flex-wrap items-center gap-2"><input aria-label={`参数键 ${index + 1}`} value={entry.key} onChange={(event) => changeEntry(index, { key: event.target.value })} placeholder="键名" className="w-28 rounded border border-slate-300 px-2 py-1.5 text-sm" /><span>:</span><input aria-label={`参数值 ${index + 1}`} disabled={entry.source === "path"} value={entry.value} onChange={(event) => changeEntry(index, { value: event.target.value })} placeholder="键值" className="min-w-[130px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-500" /><div className="flex rounded border border-slate-200 p-0.5 text-xs"><button type="button" onClick={() => changeEntry(index, { source: "manual" })} className={`rounded px-2 py-1 ${entry.source === "manual" ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>手动输入</button><button type="button" onClick={() => { setSelectedPath(entry.source === "path" ? entry.value : null); setPicker(index); }} className={`rounded px-2 py-1 ${entry.source === "path" ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>从DataModel选择</button></div><button type="button" aria-label={`删除参数 ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, entries: current.entries.filter((_, entryIndex) => entryIndex !== index) }))} className="text-slate-400 hover:text-red-600">删除</button></div>)}</div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">取消</button><button type="button" onClick={save} className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">确认</button></div>
      {picker !== null && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/30 p-4"><div role="dialog" aria-label="DataModel 键值选择" className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl"><p className="mb-3 text-sm font-semibold text-slate-800">选择 DataModel 键值</p><div className="max-h-72 overflow-auto rounded border border-slate-200 p-2">{paths.map((item) => <button type="button" key={item.path} onClick={() => setSelectedPath(item.path)} className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 ${selectedPath === item.path ? "bg-brand-50 text-brand-700" : ""}`} style={{ paddingLeft: `${8 + Math.max(0, item.path.split("/").length - 2) * 16}px` }}>{item.path} {asRecord(item.value) === null && <span className="text-slate-400">({String(item.value)})</span>}</button>)}</div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setPicker(null)} className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">取消</button><button type="button" disabled={!selectedPath} onClick={() => { if (selectedPath) changeEntry(picker, { value: selectedPath, source: "path" }); setPicker(null); }} className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">确认</button></div></div></div>}
    </section>
  </div>, document.body);
}

function componentsArray(payload: A2uiPayload): ComponentRecord[] | null {
  const update = payload.updateComponents;
  if (!update || typeof update !== "object") return null;
  const components = (update as Record<string, unknown>).components;
  return Array.isArray(components) ? components.filter((value): value is ComponentRecord => Boolean(value) && typeof value === "object") : null;
}

function cloneWithComponents(payload: A2uiPayload, components: ComponentRecord[]): A2uiPayload {
  const update = payload.updateComponents as Record<string, unknown>;
  return { ...payload, updateComponents: { ...update, components } };
}

function readPx(styles: Record<string, unknown>, key: string): string {
  const value = styles[key];
  return typeof value === "string" && /^\d+px$/.test(value) ? value.slice(0, -2) : "";
}

function splitBox(styles: Record<string, unknown>, shorthand: "margin" | "padding", side: string): string {
  const direct = readPx(styles, `${shorthand}-${side}`);
  if (direct) return direct;
  const parts = typeof styles[shorthand] === "string" ? styles[shorthand].split(/\s+/) : [];
  const index = side === "top" ? 0 : side === "right" ? 1 : side === "bottom" ? 2 : 3;
  return /^\d+px$/.test(parts[index] ?? "") ? parts[index].slice(0, -2) : "0";
}

function updateBox(styles: Record<string, unknown>, shorthand: "margin" | "padding", side: string, value: string): Record<string, unknown> {
  const directKey = `${shorthand}-${side}`;
  if (Object.prototype.hasOwnProperty.call(styles, directKey)) return { ...styles, [directKey]: value };
  if (Object.prototype.hasOwnProperty.call(styles, shorthand)) {
    const raw = typeof styles[shorthand] === "string" ? styles[shorthand].trim().split(/\s+/) : [];
    const values = raw.length === 1 ? [raw[0], raw[0], raw[0], raw[0]] : raw.length === 2 ? [raw[0], raw[1], raw[0], raw[1]] : raw.length === 3 ? [raw[0], raw[1], raw[2], raw[1]] : raw.length >= 4 ? raw.slice(0, 4) : ["0px", "0px", "0px", "0px"];
    const index = side === "top" ? 0 : side === "right" ? 1 : side === "bottom" ? 2 : 3;
    values[index] = value;
    return { ...styles, [shorthand]: values.join(" ") };
  }
  return { ...styles, [directKey]: value };
}

function dimension(value: unknown): Dimension {
  const match = typeof value === "string" ? value.trim().match(/^(\d+(?:\.\d+)?)(px|%)$/) : null;
  return match ? { value: match[1], unit: match[2] } : { value: "", unit: "px" };
}

function rounded(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function SizePanel({ styles, onChange }: { styles: Record<string, unknown>; onChange: (styles: Record<string, unknown>) => void }) {
  const width = dimension(styles.width);
  const height = dimension(styles.height);
  const matchingUnits = width.unit === height.unit;
  const [locked, setLocked] = useState(matchingUnits);
  const [values, setValues] = useState({ width: width.value, height: height.value });

  useEffect(() => {
    setLocked(matchingUnits);
    setValues({ width: width.value, height: height.value });
  }, [height.unit, height.value, matchingUnits, width.unit, width.value]);

  const update = (axis: "width" | "height", value: string) => {
    const digits = value.replace(/\D/g, "");
    const nextValues = { ...values, [axis]: digits };
    if (locked && digits) {
      const source = axis === "width" ? Number(values.width) : Number(values.height);
      const counterpart = axis === "width" ? Number(values.height) : Number(values.width);
      const ratio = source > 0 && counterpart > 0 ? counterpart / source : 1;
      nextValues[axis === "width" ? "height" : "width"] = rounded(axis === "width" ? Number(digits) * ratio : Number(digits) / ratio);
    }
    setValues(nextValues);
    const nextStyles: Record<string, unknown> = { ...styles };
    if (nextValues.width) nextStyles.width = `${nextValues.width}${width.unit}`;
    if (nextValues.height) nextStyles.height = `${nextValues.height}${height.unit}`;
    onChange(nextStyles);
  };

  return <div className="flex min-w-[270px] items-center gap-2 p-3" aria-label="尺寸调节">
    {(["width", "height"] as const).map((axis) => <label key={axis} className="flex min-w-0 flex-1 items-center gap-1.5 rounded bg-slate-100 px-2.5 py-2 text-xs text-slate-500"><span>{axis === "width" ? "宽" : "高"}</span><input aria-label={axis === "width" ? "宽度" : "高度"} inputMode="numeric" value={values[axis]} placeholder="0" onChange={(event) => update(axis, event.target.value)} className="min-w-0 flex-1 bg-transparent text-right text-base text-slate-700 outline-none" /><span>{axis === "width" ? width.unit : height.unit}</span></label>)}
    <button type="button" aria-label={locked ? "取消固定比例" : "固定比例"} title={locked ? "取消固定比例" : "固定比例"} disabled={!matchingUnits} onClick={() => setLocked((value) => !value)} className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border text-sm ${locked ? "border-brand-300 bg-brand-50 text-brand-600" : "border-slate-200 text-slate-400"} disabled:cursor-not-allowed disabled:opacity-40`}>{locked ? "🔗" : "⛓"}</button>
  </div>;
}

export function VisualEditorToolbar({ components, datamodel, selectedComponentId, onChange }: Props) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const pendingMarginsRef = useRef(new Map<string, string>());
  const pendingMarginStylesRef = useRef<Record<string, unknown> | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(Infinity);
  const [openMenu, setOpenMenu] = useState<"margin" | "size" | "horizontal" | "vertical" | "fit" | "overflow" | null>(null);
  const [popupPosition, setPopupPosition] = useState({ left: 0, top: 0 });
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const records = useMemo(() => componentsArray(components), [components]);
  const selected = records?.find((component) => component.id === selectedComponentId) ?? null;
  const type = typeof selected?.component === "string" ? selected.component : "root";
  const alignmentTarget = type === "Button"
    ? records?.find((component) => component.id === selected?.child && TEXT_COMPONENTS.has(String(component.component))) ?? selected
    : selected;
  const isText = TEXT_COMPONENTS.has(String(alignmentTarget?.component));
  const isList = type === "List";
  const isHorizontalList = isList && selected?.direction === "horizontal";
  const supportsHorizontal = isText || type === "Row" || type === "Column" || (isList && !isHorizontalList);
  const supportsVertical = isText || type === "Row" || type === "Column" || isHorizontalList;
  const hasAction = Boolean(asRecord(selected?.action)?.event || asRecord(selected?.action)?.functionCall);

  const mutate = (id: string | undefined, updater: (component: ComponentRecord) => ComponentRecord) => {
    const source = componentsArray(components);
    if (!source) return;
    const targetId = id ?? "root";
    let found = false;
    const next = source.map((component) => {
      if (component.id !== targetId) return component;
      found = true;
      return updater(component);
    });
    if (!found && !id) next.unshift(updater({ id: "root", component: "Column", children: source.map((component) => component.id).filter((value): value is string => typeof value === "string") }));
    onChange(cloneWithComponents(components, next));
  };

  const targetId = selectedComponentId;
  const styles = (selected?.styles && typeof selected.styles === "object" ? selected.styles : {}) as Record<string, unknown>;
  const commitPendingMargins = () => {
    if (pendingMarginsRef.current.size === 0) return;
    const currentStyles = (selected?.styles && typeof selected.styles === "object" ? selected.styles : {}) as Record<string, unknown>;
    let nextStyles = pendingMarginStylesRef.current ?? currentStyles;
    pendingMarginsRef.current.forEach((value, key) => {
      const [box, side] = key.split(":") as ["margin" | "padding", "top" | "right" | "bottom" | "left"];
      nextStyles = updateBox(nextStyles, box, side, `${value}px`);
    });
    pendingMarginsRef.current.clear();
    pendingMarginStylesRef.current = nextStyles;
    mutate(targetId, (component) => ({ ...component, styles: nextStyles }));
  };
  const closeMenu = () => {
    commitPendingMargins();
    pendingMarginStylesRef.current = null;
    setOpenMenu(null);
  };
  const setTextAlign = (axis: "horizontal" | "vertical", value: Alignment) => {
    if (!alignmentTarget || !records) return;
    const current = ((alignmentTarget.styles as Record<string, unknown> | undefined)?.["text-align"] as string | undefined) ?? "left top";
    const [horizontal = "left", vertical = "top"] = current.split(" ");
    const next = axis === "horizontal" ? `${value === "start" ? "left" : value === "end" ? "right" : "center"} ${vertical}` : `${horizontal} ${value === "start" ? "top" : value === "end" ? "bottom" : "center"}`;
    mutate(String(alignmentTarget.id), (component) => ({ ...component, styles: { ...(component.styles as Record<string, unknown> ?? {}), "text-align": next } }));
  };
  const setLayoutAlign = (axis: "horizontal" | "vertical", value: Alignment) => {
    if (!selected) return;
    if (type === "List") {
      mutate(String(selected.id), (component) => ({ ...component, align: value }));
      return;
    }
    const row = type === "Row" || (type === "List" && selected.direction === "horizontal");
    const property = axis === "horizontal" ? (row ? "justify" : "align") : (row ? "align" : "justify");
    mutate(String(selected.id), (component) => ({ ...component, [property]: value }));
  };

  const tools = [
    { id: "margin", label: "边距", icon: <MarginIcon />, enabled: true },
    { id: "size", label: "尺寸", icon: <SizeIcon />, enabled: true },
    { id: "horizontal", label: "水平对齐", icon: <HorizontalIcon />, enabled: supportsHorizontal },
    { id: "vertical", label: "垂直对齐", icon: <VerticalIcon />, enabled: supportsVertical },
    { id: "fit", label: "图片显示", icon: <ImageModeIcon />, enabled: type === "Image" },
    { id: "event", label: "事件", icon: <EventIcon />, enabled: type === "Button", configured: hasAction },
  ].filter((tool) => tool.enabled);

  useLayoutEffect(() => {
    const measure = () => {
      if (!toolbarRef.current || !toolsRef.current) return;
      const children = Array.from(toolsRef.current.children) as HTMLElement[];
      if (toolbarRef.current.clientWidth === 0) {
        setVisibleCount(children.length);
        return;
      }
      const available = toolbarRef.current.clientWidth - 52;
      let used = 0;
      let count = children.length;
      for (let index = 0; index < children.length; index += 1) {
        used += children[index].offsetWidth + (index ? 4 : 0);
        if (used > available) { count = index; break; }
      }
      setVisibleCount(count);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (toolbarRef.current) observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, [tools.length]);
  useEffect(() => {
    commitPendingMargins();
    pendingMarginStylesRef.current = null;
    setOpenMenu(null);
  }, [selectedComponentId]);
  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!toolbarRef.current?.contains(target) && !popupRef.current?.contains(target)) closeMenu();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [openMenu]);
  useLayoutEffect(() => {
    if (!openMenu) return;
    const updatePosition = () => {
      const rect = toolbarRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopupPosition({ left: Math.max(8, rect.left + 6), top: rect.bottom + 4 });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [openMenu]);

  const marginInput = (box: "margin" | "padding", side: "top" | "right" | "bottom" | "left") => <label className="flex w-[118px] items-center gap-1.5 text-[11px] text-slate-500"><span className="w-3">{{ top: "上", right: "右", bottom: "下", left: "左" }[side]}</span><span className="flex min-w-0 flex-1 items-center rounded border border-slate-200 bg-white focus-within:border-brand-400"><input aria-label={`${box === "margin" ? "外边距" : "内边距"}${side}`} inputMode="numeric" pattern="[0-9]*" defaultValue={splitBox(styles, box, side)} placeholder="0" onInput={(event) => { const value = event.currentTarget.value.replace(/\D/g, ""); event.currentTarget.value = value; if (value) pendingMarginsRef.current.set(`${box}:${side}`, value); else pendingMarginsRef.current.delete(`${box}:${side}`); }} onBlur={(event) => { const value = event.currentTarget.value.replace(/\D/g, ""); if (value) pendingMarginsRef.current.set(`${box}:${side}`, value); else pendingMarginsRef.current.delete(`${box}:${side}`); commitPendingMargins(); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-xs text-slate-700 outline-none" /><span className="pr-2 text-[10px] text-slate-400">px</span></span></label>;
  const marginPanel = <div className="w-[300px] space-y-4 p-3" aria-label="边距调节">
    {(["margin", "padding"] as const).map((box) => <section key={box} className="space-y-2.5"><p className="text-[11px] font-medium text-slate-500">{box === "margin" ? "外边距" : "内边距"}</p><div className="space-y-2"><div className="flex justify-center">{marginInput(box, "top")}</div><div className="flex justify-between">{marginInput(box, "left")}{marginInput(box, "right")}</div><div className="flex justify-center">{marginInput(box, "bottom")}</div></div></section>)}
  </div>;
  const alignmentPanel = (axis: "horizontal" | "vertical") => <div className="flex min-w-[210px] gap-1 p-2" aria-label={`${axis === "horizontal" ? "水平" : "垂直"}对齐选项`}>
    {(["start", "center", "end"] as Alignment[]).map((value) => <button type="button" key={value} onClick={() => { isText ? setTextAlign(axis, value) : setLayoutAlign(axis, value); closeMenu(); }} className="flex flex-1 flex-col items-center gap-1 rounded px-2 py-2 text-[11px] text-slate-600 hover:bg-slate-100"><span aria-hidden="true" className="grid h-5 w-5 place-items-center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{axis === "horizontal" ? <>{value === "start" && <><path d="M4 5v14" /><path d="M8 7h11M8 12h8M8 17h11" /></>}{value === "center" && <><path d="M12 4v16" /><path d="M5 7h14M7 12h10M5 17h14" /></>}{value === "end" && <><path d="M20 5v14" /><path d="M5 7h11M8 12h8M5 17h11" /></>}</> : <>{value === "start" && <><path d="M5 4h14" /><path d="M7 8v11M12 8v8M17 8v11" /></>}{value === "center" && <><path d="M4 12h16" /><path d="M7 5v14M12 7v10M17 5v14" /></>}{value === "end" && <><path d="M5 20h14" /><path d="M7 5v11M12 8v8M17 5v11" /></>}</>}</svg></span>{{ start: axis === "horizontal" ? "左对齐" : "顶对齐", center: "居中", end: axis === "horizontal" ? "右对齐" : "底对齐" }[value]}</button>)}
  </div>;
  const popup = openMenu === "margin" ? marginPanel : openMenu === "size" ? <SizePanel styles={styles} onChange={(nextStyles) => mutate(targetId, (component) => ({ ...component, styles: nextStyles }))} /> : openMenu === "horizontal" ? alignmentPanel("horizontal") : openMenu === "vertical" ? alignmentPanel("vertical") : openMenu === "fit" ? <div className="flex min-w-[310px] gap-1 p-2" aria-label="图片显示模式">{FIT_OPTIONS.map(([value, label]) => <button type="button" key={value} onClick={() => { mutate(targetId, (component) => ({ ...component, fit: value })); closeMenu(); }} className="rounded px-2 py-2 text-[11px] text-slate-600 hover:bg-slate-100">{label}</button>)}</div> : null;
  const visible = tools.slice(0, visibleCount);
  const overflow = tools.slice(visibleCount);

  const toolButton = (tool: typeof tools[number]) => <button type="button" key={tool.id} onClick={() => { const next = openMenu === tool.id ? null : tool.id; closeMenu(); if (tool.id === "event") setEventEditorOpen(true); else if (next) setOpenMenu(next as typeof openMenu); }} className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition ${tool.configured ? "text-slate-600 hover:bg-slate-100" : tool.id === "event" ? "text-slate-300 hover:bg-slate-100" : openMenu === tool.id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>{tool.icon}<span>{tool.label}</span></button>;
  const popupLayer = openMenu && typeof document !== "undefined" ? createPortal(
    <div ref={popupRef} className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg" style={popupPosition}>
      {openMenu === "overflow" ? <div className="flex gap-1 p-1.5">{overflow.map(toolButton)}</div> : popup}
    </div>,
    document.body,
  ) : null;

  return <><div ref={toolbarRef} className="relative flex min-h-10 shrink-0 items-center border-b border-slate-200 bg-white px-1.5 shadow-sm">
    <div ref={toolsRef} aria-hidden="true" className="invisible absolute flex gap-1">{tools.map(toolButton)}</div>
    <div className="flex min-w-0 gap-1 overflow-hidden">{visible.map(toolButton)}</div>
    {overflow.length > 0 && <button type="button" aria-label="更多编辑工具" onClick={() => { const next = openMenu === "overflow" ? null : "overflow"; closeMenu(); if (next) setOpenMenu(next); }} className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"><MoreIcon /><span>更多</span></button>}
  </div>{popupLayer}{eventEditorOpen && selected && <EventEditor action={selected.action} datamodel={datamodel ?? null} onClose={() => setEventEditorOpen(false)} onConfirm={(action) => { mutate(String(selected.id), (component) => { const next = { ...component }; if (action) next.action = action; else delete next.action; return next; }); setEventEditorOpen(false); }} />}</>;
}
