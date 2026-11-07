import { describe, expect, it } from "vitest";
import { formatRelativeDueDate } from "./due-date-status";

const today = new Date(2025, 0, 5);

describe("formatRelativeDueDate", () => {
  it("renders today, tomorrow, and yesterday in the default locale", () => {
    expect(formatRelativeDueDate(today, today, "en-US")).toBe("today");
    expect(formatRelativeDueDate(new Date(2025, 0, 6), today, "en-US")).toBe(
      "tomorrow",
    );
    expect(formatRelativeDueDate(new Date(2025, 0, 4), today, "en-US")).toBe(
      "yesterday",
    );
  });

  it("follows the given locale for today, tomorrow, and yesterday", () => {
    expect(formatRelativeDueDate(today, today, "de-DE")).toBe(
      new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" }).format(
        0,
        "day",
      ),
    );
    expect(formatRelativeDueDate(new Date(2025, 0, 6), today, "de-DE")).toBe(
      new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" }).format(
        1,
        "day",
      ),
    );
    expect(formatRelativeDueDate(new Date(2025, 0, 4), today, "de-DE")).toBe(
      new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" }).format(
        -1,
        "day",
      ),
    );
  });

  it("keeps day counts via relative time for other offsets", () => {
    expect(formatRelativeDueDate(new Date(2025, 0, 10), today, "en-US")).toBe(
      "in 5 days",
    );
    expect(formatRelativeDueDate(new Date(2025, 0, 2), today, "en-US")).toBe(
      "3 days ago",
    );
  });
});
