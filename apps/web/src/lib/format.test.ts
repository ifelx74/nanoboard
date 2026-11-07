import { describe, expect, it } from "vitest";
import {
  compareStrings,
  formatDayNumber,
  formatLongDate,
  formatMediumDate,
  formatMediumDateTime,
  formatMonthShort,
  formatMonthYear,
  formatRelativeTime,
  formatShortDate,
  formatShortDateTime,
  formatWeekdayShort,
} from "./format";

const sample = new Date(2025, 0, 5, 15, 30);

describe("formatShortDate", () => {
  it("renders month-short day-numeric in the default locale", () => {
    expect(formatShortDate(sample, "en-US")).toBe("Jan 5");
  });

  it("follows the given locale instead of a fixed English pattern", () => {
    const german = formatShortDate(sample, "de-DE");
    expect(german).not.toBe(formatShortDate(sample, "en-US"));
    expect(german).toBe(
      new Intl.DateTimeFormat("de-DE", {
        month: "short",
        day: "numeric",
      }).format(sample),
    );
  });
});

describe("formatMediumDate", () => {
  it("renders month-short day-numeric year-numeric in the default locale", () => {
    expect(formatMediumDate(sample, "en-US")).toBe("Jan 5, 2025");
  });

  it("follows the given locale", () => {
    expect(formatMediumDate(sample, "de-DE")).toBe(
      new Intl.DateTimeFormat("de-DE", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(sample),
    );
  });
});

describe("formatLongDate", () => {
  it("renders weekday-long month-long day-numeric in the default locale", () => {
    expect(formatLongDate(sample, "en-US")).toBe("Sunday, January 5");
  });

  it("follows the given locale", () => {
    const french = formatLongDate(sample, "fr-FR");
    expect(french).not.toBe(formatLongDate(sample, "en-US"));
    expect(french).toBe(
      new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(sample),
    );
  });
});

describe("formatWeekdayShort", () => {
  it("renders the short weekday in the default locale", () => {
    expect(formatWeekdayShort(sample, "en-US")).toBe("Sun");
  });

  it("follows the given locale", () => {
    expect(formatWeekdayShort(sample, "de-DE")).toBe(
      new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(sample),
    );
  });
});

describe("formatDayNumber", () => {
  it("renders the day number in the default locale", () => {
    expect(formatDayNumber(sample, "en-US")).toBe("5");
  });

  it("follows the given locale", () => {
    expect(formatDayNumber(sample, "de-DE")).toBe(
      new Intl.DateTimeFormat("de-DE", { day: "numeric" }).format(sample),
    );
  });
});

describe("formatMonthShort", () => {
  it("renders the short month in the default locale", () => {
    expect(formatMonthShort(sample, "en-US")).toBe("Jan");
  });

  it("follows the given locale", () => {
    expect(formatMonthShort(sample, "de-DE")).toBe(
      new Intl.DateTimeFormat("de-DE", { month: "short" }).format(sample),
    );
  });
});

describe("formatMonthYear", () => {
  it("renders month-long year-numeric in the default locale", () => {
    expect(formatMonthYear(sample, "en-US")).toBe("January 2025");
  });

  it("follows the given locale", () => {
    expect(formatMonthYear(sample, "de-DE")).toBe(
      new Intl.DateTimeFormat("de-DE", {
        month: "long",
        year: "numeric",
      }).format(sample),
    );
  });
});

describe("formatShortDateTime", () => {
  it("renders a short date-time in the default locale", () => {
    expect(formatShortDateTime(sample, "en-US")).toBe("1/5/25, 3:30 PM");
  });

  it("follows the given locale", () => {
    expect(formatShortDateTime(sample, "de-DE")).toBe(
      new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(sample),
    );
  });
});

describe("formatMediumDateTime", () => {
  it("renders a medium date-time in the default locale", () => {
    expect(formatMediumDateTime(sample, "en-US")).toBe("Jan 5, 2025, 3:30 PM");
  });

  it("follows the given locale", () => {
    expect(formatMediumDateTime(sample, "de-DE")).toBe(
      new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(sample),
    );
  });
});

describe("formatRelativeTime", () => {
  it("renders relative day counts in the default locale", () => {
    expect(formatRelativeTime(5, "day", "en-US")).toBe("in 5 days");
    expect(formatRelativeTime(-3, "day", "en-US")).toBe("3 days ago");
  });

  it("follows the given locale", () => {
    expect(formatRelativeTime(5, "day", "de-DE")).toBe(
      new Intl.RelativeTimeFormat("de-DE", { numeric: "always" }).format(
        5,
        "day",
      ),
    );
    expect(formatRelativeTime(5, "day", "de-DE")).not.toBe(
      formatRelativeTime(5, "day", "en-US"),
    );
  });
});

describe("compareStrings", () => {
  it("sorts names locale-insensitively with numeric segments", () => {
    const names = ["item10", "Item2", "apple"];
    expect([...names].sort((a, b) => compareStrings(a, b, "en-US"))).toEqual([
      "apple",
      "Item2",
      "item10",
    ]);
  });

  it("uses the given locale's collation", () => {
    expect(compareStrings("Zebra", "apple", "en-US")).toBeGreaterThan(0);
    expect(compareStrings("Zebra", "apple", "en-US")).toBe(
      new Intl.Collator("en-US", {
        sensitivity: "base",
        numeric: true,
      }).compare("Zebra", "apple"),
    );
  });
});
