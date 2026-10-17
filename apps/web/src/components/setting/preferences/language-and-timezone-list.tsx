import { SettingsControlItem } from "../control-item";
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

const WEEK_START_OPTIONS: { value: WeekStartsOnPreference; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
];

export default function LanguageAndTimezoneList() {
  const [weekStartsOn, setWeekStartsOn] = useWeekStartsOn();

  return (
    <div className="flex flex-col gap-y-1">
      {/* <SettingsControlItem
        title={"Timezone"}
        description={"Current timezone setting."}
        control={
          <TimezoneSelect
            value={user?.user_timezone || "Asia/Kolkata"}
            onChange={handleTimezoneChange}
          />
        }
      />
      <SettingsControlItem
        title={"Language"}
        description={"Choose the language used in the user interface."}
        control={
          <Select<LanguageOption>
            getValues={() => languageOptions}
            value={selectedLanguageOption}
            onChange={(value) => void handleLanguageChange(value)}
            getOptionValue={(option) => option.value}
            getOptionLabel={(option) => option.label}
            placeholder="Select a language"
            showSearch={false}
            pinSelected={false}
            contentSizing="anchor"
          >
            <Select.Trigger<LanguageOption>
              variant="select-md"
              className="w-42 max-w-full"
            >
              <span className="min-w-0 grow truncate text-left">
                {profile?.language
                  ? getLanguageLabel(profile.language)
                  : "Select a language"}
              </span>
            </Select.Trigger>
          </Select>
        }
      /> */}
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
