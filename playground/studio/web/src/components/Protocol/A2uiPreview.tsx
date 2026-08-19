import { A2uiSurface, basicCatalog, createBinderlessComponentImplementation, type ReactComponentImplementation } from "@a2ui/react/v0_9";
import { Catalog, MessageProcessor, type ComponentContext, type SurfaceModel } from "@a2ui/web_core/v0_9";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { z } from "zod";
import { buildPreviewProtocol } from "@/lib/previewProtocol";
import type { A2uiPayload } from "@/types";

interface Props { components: A2uiPayload; datamodel: A2uiPayload | null; onAction: (action: unknown) => void; referenceSize?: { width: number; height: number } | null; fit?: "contain" | "width"; /** Called with the component id, or null when the preview background is clicked. */ onSelectComponent?: (id: string | null) => void; selectedComponentId?: string; }

const extensionSchema = z.object({}).passthrough();
const nativeTypes = ["Text", "Icon", "Image", "Button", "Card", "Row", "Column", "List", "Divider", "Tabs"] as const;
const extensionTypes = ["Table", "Carousel", "Web", "RichText", "Markdown", "Lottie", "Chart", "UnknownPreview", ...nativeTypes] as const;
const styleKeys: Record<string, keyof CSSProperties> = {
  "background-color": "backgroundColor", "border-radius": "borderRadius", "border-width": "borderWidth",
  "border-color": "borderColor", "font-size": "fontSize", "font-weight": "fontWeight",
  "font-family": "fontFamily", "line-height": "lineHeight", "text-align": "textAlign",
  "flex-grow": "flexGrow", "flex-shrink": "flexShrink", "flex-basis": "flexBasis",
  "flex-wrap": "flexWrap", "align-self": "alignSelf", "border-style": "borderStyle",
  "box-shadow": "boxShadow", "background-image": "backgroundImage", "text-overflow": "textOverflow",
  "margin-inline-start": "marginInlineStart", "margin-inline-end": "marginInlineEnd",
  "padding-inline-start": "paddingInlineStart", "padding-inline-end": "paddingInlineEnd",
  "min-width": "minWidth", "max-width": "maxWidth", "min-height": "minHeight", "max-height": "maxHeight",
  "margin-top": "marginTop", "margin-right": "marginRight", "margin-bottom": "marginBottom", "margin-left": "marginLeft",
  "padding-top": "paddingTop", "padding-right": "paddingRight", "padding-bottom": "paddingBottom", "padding-left": "paddingLeft",
};

function nativeStyle(value: unknown): CSSProperties {
  const styles = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result: Record<string, unknown> = { boxSizing: "border-box" };
  for (const [key, value] of Object.entries(styles)) {
    if (key === "background-color" && typeof value === "string" && value.includes("gradient(")) {
      result.background = value;
    } else if (key === "line-clamp") {
      result.display = "-webkit-box";
      result.WebkitBoxOrient = "vertical";
      result.WebkitLineClamp = value;
      result.overflow = "hidden";
    } else if (key === "text-align") {
      // Composite A2UI values (for example, "center top") are handled by
      // textAlignmentStyle. Applying them directly produces invalid CSS.
      if (value === "trailing") result.textAlign = "right";
      else if (value === "leading") result.textAlign = "left";
      else if (value === "left" || value === "center" || value === "right") result.textAlign = value;
    } else {
      result[styleKeys[key] ?? key] = value;
    }
  }
  if (styles.width === "100%") result.width = "100%";
  return result as CSSProperties;
}

export function resolveImageSource(value: unknown, resolveDynamicValue: (value: never) => unknown): string {
  if (value && typeof value === "object") {
    if ("literalString" in value && typeof value.literalString === "string") return value.literalString;
    if ("path" in value) return String(resolveDynamicValue(value as never) ?? "");
  }
  return typeof value === "string" ? value : "";
}

export function imageObjectFit(value: unknown): CSSProperties["objectFit"] {
  switch (value) {
    case "contain": return "contain";
    case "cover": return "cover";
    case "none": return "none";
    case "scaleDown": return "scale-down";
    case "fill":
    default: return "fill";
  }
}

export function align(value: unknown): CSSProperties["alignItems"] {
  if (value === "center") return "center";
  if (value === "trailing" || value === "end") return "flex-end";
  if (value === "start" || value === "leading") return "flex-start";
  if (value === "baseline") return "baseline";
  return "stretch";
}

export function justify(value: unknown): CSSProperties["justifyContent"] {
  if (value === "spaceBetween" || value === "space-between") return "space-between";
  if (value === "spaceAround" || value === "space-around") return "space-around";
  if (value === "spaceEvenly" || value === "space-evenly") return "space-evenly";
  if (value === "center") return "center";
  if (value === "trailing" || value === "end") return "flex-end";
  return "flex-start";
}

export function textAlignmentStyle(value: unknown): Pick<CSSProperties, "display" | "flexDirection" | "justifyContent" | "textAlign"> {
  const [horizontal = "left", vertical = "top"] = typeof value === "string" ? value.split(" ") : [];
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: vertical === "center" ? "center" : vertical === "bottom" ? "flex-end" : "flex-start",
    textAlign: horizontal === "center" ? "center" : horizontal === "right" ? "right" : "left",
  };
}

const iconPaths: Record<string, ReactNode> = {
  check: <polyline points="20 6 9 17 4 12" />,
  send: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
  user: <><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
  star: <polygon points="12 2 15.1 8.3 22 9.3 17 14.2 18.2 21 12 17.8 5.8 21 7 14.2 2 9.3 8.9 8.3 12 2" />,
  info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  "map-pin": <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
};

const iconAliases: Record<string, keyof typeof iconPaths> = {
  locationOn: "map-pin",
};

export function previewIcon(name: string): ReactNode | undefined {
  return iconPaths[name] ?? iconPaths[iconAliases[name]];
}

function AndroidTabsPreview({ context, buildChild, componentIdAttr, style }: { context: ComponentContext; buildChild: (id: string, basePath?: string) => ReactNode; componentIdAttr: { "data-a2ui-component-id": string }; style: CSSProperties }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const props = context.componentModel.properties;
  const tabs = Array.isArray(props.tabs) ? props.tabs : [];
  const selectedTab = tabs[selectedIndex] as Record<string, unknown> | undefined;
  const selectedChild = typeof selectedTab?.child === "string" ? selectedTab.child : null;
  const text = (value: unknown) => value && typeof value === "object" && "path" in value
    ? context.dataContext.resolveDynamicValue(value as never)
    : value;
  return <div {...componentIdAttr} style={{ width: "100%", ...style }}>
    <div style={{ display: "flex", minHeight: 96, borderBottom: "2px solid #e0e0e0" }}>
      {tabs.map((tab, index) => {
        const record = tab && typeof tab === "object" ? tab as Record<string, unknown> : {};
        const isSelected = index === selectedIndex;
        return <button key={String(record.child ?? index)} type="button" onClick={() => setSelectedIndex(index)} style={{ flex: 1, minWidth: 0, border: 0, borderBottom: isSelected ? "8px solid #2273F7" : "8px solid transparent", background: "transparent", color: isSelected ? "#2273F7" : "#000000", cursor: "pointer", fontSize: 32, fontWeight: isSelected ? 700 : 400 }}>
          {String(text(record.title) ?? "Tab")}
        </button>;
      })}
    </div>
    {selectedChild ? buildChild(selectedChild) : null}
  </div>;
}

function NativeComponent({ context, buildChild }: { context: ComponentContext; buildChild: (id: string, basePath?: string) => ReactNode }) {
  const [, setRevision] = useState(0);
  const props = context.componentModel.properties;
  /** Marks the rendered element so preview clicks can be mapped back to the
   * component's JSON definition (see handlePreviewClick). */
  const componentIdAttr = { "data-a2ui-component-id": context.componentModel.id } as const;
  useEffect(() => {
    const subscription = context.dataContext.dataModel.subscribe("/", () => setRevision((revision) => revision + 1));
    return () => subscription.unsubscribe();
  }, [context]);
  const text = (value: unknown) => {
    if (value && typeof value === "object" && "path" in value) return context.dataContext.resolveDynamicValue(value as never);
    return value;
  };
  const children = Array.isArray(props.children) ? props.children.filter((id): id is string => typeof id === "string") : [];
  const childTemplate = props.children && typeof props.children === "object" && !Array.isArray(props.children)
    ? props.children as { componentId?: unknown; path?: unknown }
    : null;
  const child = typeof props.child === "string" ? props.child : null;
  const style = nativeStyle(props.styles);
  const type = context.componentModel.type;
  const renderedChildren = () => {
    const templateId = typeof childTemplate?.componentId === "string" ? childTemplate.componentId : null;
    const dataPath = typeof childTemplate?.path === "string" ? childTemplate.path : null;
    const items = templateId && dataPath
      ? context.dataContext.resolveDynamicValue({ path: dataPath } as never)
      : null;
    const listContext = dataPath ? context.dataContext.nested(dataPath) : null;
    if (Array.isArray(items) && templateId && listContext) {
      return items.map((_, index) => <span key={`${templateId}-${index}`} style={{ display: "contents" }}>{buildChild(templateId, listContext.nested(String(index)).path)}</span>);
    }
    return children.map((id) => buildChild(id));
  };
  if (type === "Text") return <div {...componentIdAttr} style={{ whiteSpace: "pre-wrap", ...textAlignmentStyle(props.styles && typeof props.styles === "object" ? (props.styles as Record<string, unknown>)["text-align"] : undefined), ...style }}>{String(text(props.text) ?? "")}</div>;
  if (type === "Icon") {
    const name = String(props.name ?? props.icon ?? "");
    const icon = previewIcon(name);
    const size = style.width ?? style.height ?? 24;
    return icon ? <svg {...componentIdAttr} aria-label={name} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0, color: style.color, ...style }}>{icon}</svg>
      : <span {...componentIdAttr} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", ...style }}>{name}</span>;
  }
  if (type === "Image") return <img {...componentIdAttr} src={resolveImageSource(props.url ?? props.src, context.dataContext.resolveDynamicValue.bind(context.dataContext))} alt={String(text(props.description) ?? "")} style={{ display: "block", objectFit: imageObjectFit(props.fit), ...style }} />;
  if (type === "Divider") return <div {...componentIdAttr} style={{ width: "100%", height: 1, backgroundColor: "#d7e2ea", ...style }} />;
  if (type === "Button") return <button {...componentIdAttr} type="button" onClick={() => void context.dispatchAction(props.action)} style={{ cursor: "pointer", border: "none", ...style }}>{child ? buildChild(child) : String(text(props.label) ?? "")}</button>;
  if (type === "Card") return <section {...componentIdAttr} style={{ display: "block", overflow: "hidden", ...style }}>{child ? buildChild(child) : renderedChildren()}</section>;
  if (type === "List") {
    return <div {...componentIdAttr} style={{ display: "flex", flexDirection: props.direction === "horizontal" ? "row" : "column", alignItems: align(props.align), justifyContent: justify(props.justify), ...style }}>
      {renderedChildren()}
    </div>;
  }
  if (type === "Tabs") return <AndroidTabsPreview context={context} buildChild={buildChild} componentIdAttr={componentIdAttr} style={style} />;
  const isRow = type === "Row";
  return <div {...componentIdAttr} style={{ display: "flex", flexDirection: isRow ? "row" : "column", alignItems: align(props.align), justifyContent: justify(props.justify), ...style }}>{renderedChildren()}</div>;
}

const extensionComponents = extensionTypes.map((name) => createBinderlessComponentImplementation(
  { name, schema: extensionSchema },
  ({ context, buildChild }) => {
    if ((nativeTypes as readonly string[]).includes(name)) return <NativeComponent context={context as never} buildChild={buildChild} />;
    const props = context.componentModel.properties;
    const componentIdAttr = { "data-a2ui-component-id": context.componentModel.id } as const;
    const text = ["url", "src", "text", "markdown", "html"].map((key) => {
      const value = props[key];
      return value && typeof value === "object" && "path" in value ? context.dataContext.resolveDynamicValue(value as never) : value;
    }).find((value): value is string => typeof value === "string");
    const children = Array.isArray(props.children) ? props.children.filter((id): id is string => typeof id === "string") : [];
    if (name === "Web" && text) return <iframe {...componentIdAttr} title="A2UI web content" src={text} sandbox="allow-forms allow-popups allow-scripts" className="h-36 w-full rounded border" />;
    if (name === "RichText" && text) {
      const styles = props.styles && typeof props.styles === "object" ? props.styles as Record<string, unknown> : {};
      return <div {...componentIdAttr} style={{ whiteSpace: "pre-wrap", ...textAlignmentStyle(styles["text-align"]), ...nativeStyle(styles) }} dangerouslySetInnerHTML={{ __html: text }} />;
    }
    if (name === "Markdown" && text) return <pre {...componentIdAttr} className="whitespace-pre-wrap font-sans">{text}</pre>;
    if (name === "Lottie" || name === "Chart") return <div {...componentIdAttr} className="rounded border border-dashed p-3 text-xs text-slate-500">{name}{text ? ": " + text : " preview"}</div>;
    if (name === "UnknownPreview") return <div {...componentIdAttr} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">Unsupported component: {String(props.originalType ?? "unknown")} ({context.componentModel.id})</div>;
    return <section {...componentIdAttr} data-testid={"a2ui-extension-" + name} className={name === "Carousel" ? "flex snap-x gap-2 overflow-auto" : ""}>{children.map((id) => <div key={id} className={name === "Carousel" ? "min-w-[80%] snap-center" : ""}>{buildChild(id)}</div>)}</section>;
  },
));
const previewCatalog = new Catalog<ReactComponentImplementation>(
  basicCatalog.id,
  [...basicCatalog.components.values()].filter((component) => !(nativeTypes as readonly string[]).includes(component.name)).concat(extensionComponents),
);
const supportedTypes = new Set(previewCatalog.components.keys());
const defaultReferenceCanvas = { width: 1206, height: 1175 };

export function A2uiPreview({ components, datamodel, onAction, onSelectComponent, selectedComponentId, referenceSize, fit = "contain" }: Props) {
  const [surface, setSurface] = useState<SurfaceModel<ReactComponentImplementation> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const referenceCanvas = referenceSize ?? { width: defaultReferenceCanvas.width, height: contentHeight ?? defaultReferenceCanvas.height };
  const protocol = useMemo(() => {
    try { return buildPreviewProtocol(components, datamodel); }
    catch (cause) { return cause instanceof Error ? cause : new Error("Preview is invalid"); }
  }, [components, datamodel]);
  useEffect(() => {
    if (protocol instanceof Error) { setError(protocol.message); return; }
    try {
      const processor = new MessageProcessor([previewCatalog], onAction);
      const messages = protocol.messages.map((message) => !message.updateComponents ? message : {
        ...message,
        updateComponents: {
          ...message.updateComponents,
          components: message.updateComponents.components.map((component) => supportedTypes.has(String(component.component))
            ? component
            : { ...component, component: "UnknownPreview", originalType: component.component }),
        },
      });
      processor.processMessages(messages as never);
      setSurface(processor.model.getSurface(protocol.surfaceId) ?? null);
      setError(null);
      return () => processor.model.getSurface(protocol.surfaceId)?.dispose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Preview could not render"); }
  }, [onAction, protocol]);
  useEffect(() => {
    if (referenceSize || !contentRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContentHeight(Math.ceil(entry.contentRect.height));
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [referenceSize, surface]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const widthScale = entry.contentRect.width / referenceCanvas.width;
      const heightScale = entry.contentRect.height / referenceCanvas.height;
      setScale(Math.min(widthScale, ...(fit === "contain" ? [heightScale] : [])));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fit, referenceCanvas.height, referenceCanvas.width]);
  useLayoutEffect(() => {
    const element = selectedComponentId
      ? Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-a2ui-component-id]") ?? []).find((candidate) => candidate.dataset.a2uiComponentId === selectedComponentId) ?? null
      : null;
    setSelectedElement(element);
  }, [selectedComponentId, surface]);
  if (error) return <div role="alert" className="p-3 text-xs text-amber-700">Preview error: {error}</div>;
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onSelectComponent) return;
    const target = event.target as HTMLElement;
    const element = target.closest<HTMLElement>("[data-a2ui-component-id]");
    const id = element?.dataset.a2uiComponentId;
    onSelectComponent(id ?? null);
  };
  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    setHoveredElement(target.closest<HTMLElement>("[data-a2ui-component-id]"));
  };
  const handleMouseLeave = () => setHoveredElement(null);
  const outlineFor = (element: HTMLElement | null, style: "dashed" | "solid") => {
    if (!element || !containerRef.current) return null;
    const bounds = element.getBoundingClientRect();
    const containerBounds = containerRef.current.getBoundingClientRect();
    return <div aria-hidden="true" data-testid={`a2ui-${style}-outline`} style={{ position: "absolute", zIndex: 10, pointerEvents: "none", left: bounds.left - containerBounds.left, top: bounds.top - containerBounds.top, width: bounds.width, height: bounds.height, border: `1px ${style} var(--brand-500, #2273F7)` }} />;
  };
  return <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-white" onClick={handleClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>{surface ? (
    <div
      style={{
        position: "absolute",
        top: fit === "width" ? 0 : "50%",
        left: "50%",
        width: referenceCanvas.width,
        height: referenceCanvas.height,
        transform: fit === "width" ? `translateX(-50%) scale(${scale})` : `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: fit === "width" ? "top center" : "center",
      }}
    ><div ref={contentRef}><A2uiSurface surface={surface} /></div></div>
  ) : <div className="p-3 text-xs text-slate-400">Preparing preview…</div>}{outlineFor(hoveredElement, "dashed")}{outlineFor(selectedElement, "solid")}</div>;
}
