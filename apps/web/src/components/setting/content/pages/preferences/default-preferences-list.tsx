import { SettingsControlItem } from "../../../control-item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { I_THEME_OPTION, THEME_OPTIONS } from "@/constants/theme";
import { parseTheme, type Theme } from "@/lib/theme-preference";
import { useThemeStore } from "@/store/theme";

const items: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function DefaultSettingPreferencesList() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <div className="flex flex-col gap-y-1">
      {/* Theme Selection */}
      <SettingsControlItem
        title={"Theme"}
        description={"Select or customize your interface color scheme."}
        control={
          <Select
            items={items}
            value={theme}
            onValueChange={(value) => setTheme(parseTheme(value))}
          >
            <SelectTrigger className="w-full max-w-48 rounded-sm">
              <SelectValue>
                <ThemeOptionIcon
                  option={THEME_OPTIONS.find((o) => o.value === theme)!}
                />
                {THEME_OPTIONS.find((o) => o.value === theme)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              align={"start"}
              alignItemWithTrigger={false}
              className={"rounded-sm"}
            >
              <SelectGroup>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <ThemeOptionIcon
                      option={THEME_OPTIONS.find(
                        (o) => o.value === item.value,
                      )!}
                    />
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

function ThemeOptionIcon({ option }: { option: I_THEME_OPTION }) {
  return (
    <div
      className="relative flex h-4 w-4 rotate-45 transform items-center justify-center rounded-full border"
      style={{
        borderColor: option.icon.border,
      }}
    >
      <div
        className="h-full w-1/2 rounded-l-full"
        style={{
          background: option.icon.color1,
        }}
      />
      <div
        className="h-full w-1/2 rounded-r-full border-l"
        style={{
          borderLeftColor: option.icon.border,
          background: option.icon.color2,
        }}
      />
    </div>
  );
}
