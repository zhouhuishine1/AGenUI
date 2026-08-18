import { describe, expect, it } from "vitest";
import { imageObjectFit, resolveImageSource } from "./A2uiPreview";

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
});
