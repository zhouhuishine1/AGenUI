import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PreviewScanStrip } from "./PreviewScanStrip";

afterEach(cleanup);

describe("PreviewScanStrip", () => {
  it("shows an empty preview placeholder for a new chat's default object", () => {
    render(
      <PreviewScanStrip
        presetId={null}
        renderingUrl={null}
        componentsText="{}"
        datamodelText=""
      />,
    );

    expect(screen.getByText("No preview")).toBeTruthy();
  });
});
