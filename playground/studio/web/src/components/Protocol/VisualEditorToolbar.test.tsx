import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { VisualEditorToolbar } from "./VisualEditorToolbar";

function protocol(component: Record<string, unknown>) {
  return { version: "v0.9", updateComponents: { surfaceId: "test", components: [component] } };
}

describe("VisualEditorToolbar", () => {
  afterEach(cleanup);
  it("writes margin values as px to the selected component immediately", () => {
    const onChange = vi.fn();
    render(<VisualEditorToolbar components={protocol({ id: "text", component: "Text", text: "Hello" })} selectedComponentId="text" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "边距" }));
    fireEvent.blur(screen.getByLabelText("外边距top"), { target: { value: "12" } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      updateComponents: expect.objectContaining({ components: [expect.objectContaining({ styles: { "margin-top": "12px" } })] }),
    }));
  });

  it("updates an existing margin shorthand instead of adding side fields", () => {
    const onChange = vi.fn();
    render(<VisualEditorToolbar components={protocol({ id: "text", component: "Text", text: "Hello", styles: { margin: "0px 10px 0px 10px", "margin-left": "20px" } })} selectedComponentId="text" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "边距" }));
    fireEvent.blur(screen.getByLabelText("外边距right"), { target: { value: "24" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ updateComponents: expect.objectContaining({ components: [expect.objectContaining({ styles: { margin: "0px 24px 0px 10px", "margin-left": "20px" } })] }) }));
  });

  it("closes an open menu before another toolbar action", () => {
    const onChange = vi.fn();
    render(<VisualEditorToolbar components={protocol({ id: "text", component: "Text", text: "Hello" })} selectedComponentId="text" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "边距" }));
    fireEvent.click(screen.getByRole("button", { name: "水平对齐" }));
    expect(screen.queryByLabelText("边距调节")).toBeNull();
  });

  it("renders the popup menu in the document layer instead of the clipped toolbar", () => {
    const onChange = vi.fn();
    render(<VisualEditorToolbar components={protocol({ id: "text", component: "Text", text: "Hello" })} selectedComponentId="text" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "边距" }));
    const panel = screen.getByLabelText("边距调节");
    expect(panel.parentElement?.classList.contains("fixed")).toBe(true);
    expect(panel.parentElement?.parentElement).toBe(document.body);
  });

  it("creates a root component when editing the unselected outer layer", () => {
    const onChange = vi.fn();
    render(<VisualEditorToolbar components={protocol({ id: "text", component: "Text", text: "Hello" })} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "边距" }));
    fireEvent.blur(screen.getByLabelText("内边距left"), { target: { value: "8" } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      updateComponents: expect.objectContaining({ components: expect.arrayContaining([expect.objectContaining({ id: "root", styles: { "padding-left": "8px" } })]) }),
    }));
  });

  it("sets Image fit using the Chinese display-mode menu", () => {
    const onChange = vi.fn();
    render(<VisualEditorToolbar components={protocol({ id: "image", component: "Image", url: "https://example.test/a.png" })} selectedComponentId="image" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "图片显示" }));
    fireEvent.click(screen.getByRole("button", { name: "裁切填满" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      updateComponents: expect.objectContaining({ components: [expect.objectContaining({ fit: "cover" })] }),
    }));
  });

  it("keeps same-unit dimensions proportional by default", () => {
    const onChange = vi.fn();
    render(<VisualEditorToolbar components={protocol({ id: "image", component: "Image", url: "https://example.test/a.png", styles: { width: "100px", height: "50px" } })} selectedComponentId="image" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "尺寸" }));
    fireEvent.change(screen.getByLabelText("宽度"), { target: { value: "200" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ updateComponents: expect.objectContaining({ components: [expect.objectContaining({ styles: { width: "200px", height: "100px" } })] }) }));
  });

  it("does not change the other dimension after unlocking or with mixed units", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VisualEditorToolbar components={protocol({ id: "image", component: "Image", url: "https://example.test/a.png", styles: { width: "100px", height: "50px" } })} selectedComponentId="image" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "尺寸" }));
    fireEvent.click(screen.getByRole("button", { name: "取消固定比例" }));
    fireEvent.change(screen.getByLabelText("宽度"), { target: { value: "200" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ updateComponents: expect.objectContaining({ components: [expect.objectContaining({ styles: { width: "200px", height: "50px" } })] }) }));

    rerender(<VisualEditorToolbar components={protocol({ id: "image", component: "Image", url: "https://example.test/a.png", styles: { width: "100px", height: "50%" } })} selectedComponentId="image" onChange={onChange} />);
    expect((screen.getByRole("button", { name: "固定比例" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("edits a Button's text child alignment", () => {
    const onChange = vi.fn();
    render(<VisualEditorToolbar components={{ version: "v0.9", updateComponents: { surfaceId: "test", components: [
      { id: "button", component: "Button", child: "label", action: { event: { name: "go" } } },
      { id: "label", component: "Text", text: "Go" },
    ] } }} selectedComponentId="button" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "水平对齐" }));
    fireEvent.click(screen.getByRole("button", { name: /右对齐$/ }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      updateComponents: expect.objectContaining({ components: expect.arrayContaining([expect.objectContaining({ id: "label", styles: { "text-align": "right top" } })]) }),
    }));
  });

  it("shows a List only its supported cross-axis control and writes align", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VisualEditorToolbar components={protocol({ id: "list", component: "List", direction: "vertical", children: [] })} selectedComponentId="list" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "水平对齐" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "垂直对齐" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "水平对齐" }));
    fireEvent.click(screen.getByRole("button", { name: /右对齐$/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      updateComponents: expect.objectContaining({ components: [expect.objectContaining({ align: "end" })] }),
    }));

    rerender(<VisualEditorToolbar components={protocol({ id: "list", component: "List", direction: "horizontal", children: [] })} selectedComponentId="list" onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "水平对齐" })).toBeNull();
    expect(screen.getByRole("button", { name: "垂直对齐" })).toBeTruthy();
  });
});
