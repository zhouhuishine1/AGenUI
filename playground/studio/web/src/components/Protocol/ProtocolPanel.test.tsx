import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProtocolPanel } from "./ProtocolPanel";

vi.mock("./ProtocolEditor", () => ({
  ProtocolEditor: ({ onHistoryChange, selectComponentId }: { onHistoryChange?: (history: { canUndo: boolean; canRedo: boolean }) => void; selectComponentId?: { id: string } | null }) => (
    <button type="button" data-component-id={selectComponentId?.id} onClick={() => onHistoryChange?.({ canUndo: true, canRedo: false })}>Set undo history</button>
  ),
}));

vi.mock("./SaveBar", () => ({ SaveBar: () => null }));

afterEach(cleanup);

function renderPanel(streaming = false, selectComponentId?: { id: string; seq: number } | null) {
  return render(
    <ProtocolPanel
      componentsText="{}"
      datamodelText=""
      onComponentsChange={() => undefined}
      onDatamodelChange={() => undefined}
      editorScope="session:test"
      streaming={streaming}
      protocolId={null}
      selectComponentId={selectComponentId}
      onSave={async () => undefined}
    />,
  );
}

describe("ProtocolPanel history controls", () => {
  it("enables undo only when the active editor has undo history", () => {
    renderPanel();

    expect(screen.queryByText("The generated or selected protocol will appear here")).toBeNull();
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect((undo as HTMLButtonElement).disabled).toBe(true);
    expect((redo as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Set undo history" })[0]);
    expect((undo as HTMLButtonElement).disabled).toBe(false);
    expect((redo as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps history controls disabled while streaming", () => {
    renderPanel(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Set undo history" })[0]);

    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("forwards preview selection to the components editor", () => {
    renderPanel(false, { id: "headline", seq: 1 });

    expect(screen.getAllByRole("button", { name: "Set undo history" })[0].getAttribute("data-component-id")).toBe("headline");
  });
});
