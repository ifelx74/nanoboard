// @vitest-environment jsdom
// The suite's only DOM-environment test: boots the real runtime + provider
// with the real default-locale resources and proves rendered, translated
// output, live switching, and document-language tracking.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useTranslation } from "react-i18next";
import { i18n, initI18n } from "./index";
import { I18nProvider } from "./provider";
import { useLocaleStore } from "@/store/locale";

function Probe() {
  const { t: tNav } = useTranslation("navigation");
  const { t: tCal } = useTranslation("calendar");
  return (
    <div>
      <span>{tNav("home")}</span>
      <span>{tNav("stickies")}</span>
      <span>{tNav("whiteboard")}</span>
      <span>{tCal("overflowMore", { count: 3 })}</span>
      <span>{tCal("overflowMore_one", { count: 1 })}</span>
    </div>
  );
}

function deBundle(tree: unknown): unknown {
  if (typeof tree === "string") return tree;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    tree as Record<string, unknown>,
  )) {
    out[key] = deBundle(value);
  }
  return out;
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en-US");
  document.documentElement.lang = "";
});

describe("translation runtime", () => {
  it("renders real en-US resources, switches languages live, and tracks document.lang", async () => {
    await initI18n("en-US");
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Stickies")).toBeTruthy();
    expect(screen.getByText("Whiteboard")).toBeTruthy();
    expect(screen.getByText("+3 more")).toBeTruthy();
    expect(screen.getByText("+1 more")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en-US");

    // Test-only second locale, injected as data; shipped locales stay en-US.
    const en = (await import("./locales/en-US.json")).default;
    const de = deBundle(en as Record<string, unknown>) as Record<
      string,
      Record<string, unknown>
    >;
    de.navigation = { home: "Start", stickies: "Notizen", whiteboard: "Weißbret" };
    for (const [namespace, resources] of Object.entries(de)) {
      i18n.addResourceBundle("de", namespace, resources, true, true);
    }

    await act(async () => {
      await i18n.changeLanguage("de");
    });

    expect(screen.queryByText("Home")).toBeNull();
    expect(screen.getByText("Start")).toBeTruthy();
    expect(screen.getByText("Notizen")).toBeTruthy();
    expect(screen.getByText("Weißbret")).toBeTruthy();
    expect(document.documentElement.lang).toBe("de");

    // Switching back through the persisted store re-renders, live.
    await act(async () => {
      useLocaleStore.getState().setLocale("en-US");
    });

    expect(screen.getByText("Home")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en-US");
  });
});
