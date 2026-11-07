import { useTranslation } from "react-i18next";
import { SettingsControlItem } from "../../../control-item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWeekStartsOn,
  type WeekStartsOnPreference,
} from "@/components/calendar/use-week-starts-on";
import { getLocaleLabel } from "@/lib/i18n/get-locale-label";
import {
  SUPPORTED_LOCALES,
  parseLocalePreference,
  type LocalePreference,
} from "@/lib/i18n/locale-preference";
import { useLocaleStore } from "@/store/locale";

const WEEK_START_OPTIONS: { value: WeekStartsOnPreference; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
];

export default function LanguageAndTimezoneList() {
  const [weekStartsOn, setWeekStartsOn] = useWeekStartsOn();
  const { t } = useTranslation("settings");
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  // "System" plus every supported locale, each labeled in its own language
  // and driven by the supported-locale list so future locales appear here
  // with no UI change.
  const languageOptions: { value: LocalePreference; label: string }[] = [
    { value: "system", label: t("language.system") },
    ...SUPPORTED_LOCALES.map((supported) => ({
      value: supported as LocalePreference,
      label: getLocaleLabel(supported),
    })),
  ];

  return (
    <div className="flex flex-col gap-y-1">
      <SettingsControlItem
        title={t("language.title")}
        description={t("language.description")}
        control={
          <Select
            items={languageOptions}
            value={locale}
            onValueChange={(value) => setLocale(parseLocalePreference(value))}
          >
            <SelectTrigger className="w-full max-w-48 rounded-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              align="start"
              alignItemWithTrigger={false}
              className="rounded-sm"
            >
              <SelectGroup>
                {languageOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      />
      <SettingsControlItem
        title="First day of the week"
        description="Choose which day your week starts on."
        control={
          <Select
            items={WEEK_START_OPTIONS}
            value={weekStartsOn}
            onValueChange={(value) => {
              if (value !== null) setWeekStartsOn(value);
            }}
          >
            <SelectTrigger className="w-full max-w-48 rounded-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              align="start"
              alignItemWithTrigger={false}
              className="rounded-sm"
            >
              <SelectGroup>
                {WEEK_START_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
