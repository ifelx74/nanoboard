import { describe, expect, it } from "vitest";
import enUS from "./locales/en-US.json";

describe("navigation/home/settings extraction (ticket 05)", () => {
  it("covers navigation chrome copy", () => {
    const nav = enUS.navigation as Record<string, unknown>;
    expect(nav.settings).toBe("Settings");
    expect(nav.sidebarToggle).toBe("Toggle sidebar");
    expect(nav.githubLabel).toBe("GitHub repository");
  });

  it("covers home greeting and task-count plurals", () => {
    const home = enUS.home as unknown as Record<string, Record<string, unknown>>;
    expect(home.greeting?.morning).toBe("Good morning");
    expect(home.tasks_one).toBe("{{count}} task");
    expect(home.tasks_other).toBe("{{count}} tasks");
    expect(home.weekStrip?.overflowMore_one).toBe("+{{count}} more");
    expect(home.weekStrip?.overflowMore_other).toBe("+{{count}} more");
  });

  it("covers settings preferences and backup copy", () => {
    const settings = enUS.settings as unknown as Record<string, Record<string, unknown>>;
    expect(settings.preferences?.title).toBe("Preferences");
    expect(settings.theme?.title).toBe("Theme");
    expect(settings.data?.title).toBe("Data");
  });

  it("covers common error and not-found copy", () => {
    const common = enUS.common as unknown as Record<string, Record<string, unknown>>;
    expect(common.notFound?.title).toBe("Oops! Something went wrong.");
    expect(common.error?.tryAgain).toBe("Try again");
  });
});
