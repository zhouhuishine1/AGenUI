import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InputBar } from "./InputBar";
import type { Provider } from "@/types";

const LAST_SELECTED_MODEL_KEY = "agenui.studio.last-selected-model";
const providers: Provider[] = [
  { name: "first", model: "first-model", base_url: "https://first.example", max_tokens: 100, api_key_display: "***", is_active: true },
  { name: "second", model: "second-model", base_url: "https://second.example", max_tokens: 100, api_key_display: "***", is_active: false },
];

function renderInputBar(currentProviders = providers) {
  return render(
    <InputBar
      providers={currentProviders}
      active="first"
      providersLoaded
      isGenerating={false}
      onSend={() => undefined}
      onStop={() => undefined}
      onConfigSaved={() => undefined}
      value=""
      onValueChange={() => undefined}
    />,
  );
}

describe("InputBar model selection", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("restores the last selected model after remount", () => {
    const first = renderInputBar();
    const select = screen.getByTitle("Select model") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "second" } });
    expect(localStorage.getItem(LAST_SELECTED_MODEL_KEY)).toBe("second");

    first.unmount();
    renderInputBar();
    expect((screen.getByTitle("Select model") as HTMLSelectElement).value).toBe("second");
  });

  it("falls back when the persisted model is no longer configured", () => {
    localStorage.setItem(LAST_SELECTED_MODEL_KEY, "removed");
    renderInputBar([providers[0]]);
    expect((screen.getByTitle("Select model") as HTMLSelectElement).value).toBe("first");
  });
});
