import { i18n } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale-preference";

export function getActiveLocale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE;
}

function effectiveLocale(locale?: string): string {
  return locale ?? getActiveLocale();
}

export function formatShortDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(effectiveLocale(locale), {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatMediumDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(effectiveLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatLongDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(effectiveLocale(locale), {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatWeekdayShort(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(effectiveLocale(locale), {
    weekday: "short",
  }).format(date);
}

export function formatDayNumber(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(effectiveLocale(locale), {
    day: "numeric",
  }).format(date);
}

export function formatMonthShort(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(effectiveLocale(locale), {
    month: "short",
  }).format(date);
}

export function formatMonthYear(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(effectiveLocale(locale), {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatRelativeTime(
  count: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale?: string,
  numeric: "auto" | "always" = "always",
): string {
  return new Intl.RelativeTimeFormat(effectiveLocale(locale), {
    numeric,
  }).format(count, unit);
}

export function createCollator(locale?: string): Intl.Collator {
  return new Intl.Collator(effectiveLocale(locale), {
    sensitivity: "base",
    numeric: true,
  });
}

export function compareStrings(a: string, b: string, locale?: string): number {
  return createCollator(locale).compare(a, b);
}
