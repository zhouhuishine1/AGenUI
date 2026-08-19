import { describe, expect, it } from "vitest";
import { align, imageObjectFit, justify, previewIcon, resolveImageSource, textAlignmentStyle } from "./A2uiPreview";

describe("Image preview helpers", () => {
  const remoteUrl = "https://images.example.test/wide.jpg";
  const resolve = (value: { path: string }) => value.path === "/image" ? remoteUrl : undefined;

  it("uses static, literalString, and data-model image URLs", () => {
    expect(resolveImageSource(remoteUrl, resolve as never)).toBe(remoteUrl);
    expect(resolveImageSource({ literalString: remoteUrl }, resolve as never)).toBe(remoteUrl);
    expect(resolveImageSource({ path: "/image" }, resolve as never)).toBe(remoteUrl);
  });

  it("maps every A2UI Image fit value and defaults to fill", () => {
    expect(imageObjectFit(undefined)).toBe("fill");
    expect(imageObjectFit("fill")).toBe("fill");
    expect(imageObjectFit("contain")).toBe("contain");
    expect(imageObjectFit("cover")).toBe("cover");
    expect(imageObjectFit("none")).toBe("none");
    expect(imageObjectFit("scaleDown")).toBe("scale-down");
  });

  it("maps the A2UI locationOn icon name instead of rendering it as fallback text", () => {
    expect(previewIcon("locationOn")).toBeDefined();
  });

  it("maps text alignment into visible horizontal and vertical preview layout", () => {
    expect(textAlignmentStyle("left top")).toMatchObject({ textAlign: "left", justifyContent: "flex-start" });
    expect(textAlignmentStyle("center center")).toMatchObject({ textAlign: "center", justifyContent: "center" });
    expect(textAlignmentStyle("right bottom")).toMatchObject({ textAlign: "right", justifyContent: "flex-end" });
  });

  it("renders every supported layout-alignment enum as a valid flex value", () => {
    expect(align("start")).toBe("flex-start");
    expect(align("center")).toBe("center");
    expect(align("end")).toBe("flex-end");
    expect(align("stretch")).toBe("stretch");
    expect(justify("spaceAround")).toBe("space-around");
    expect(justify("spaceBetween")).toBe("space-between");
    expect(justify("spaceEvenly")).toBe("space-evenly");
  });
});
