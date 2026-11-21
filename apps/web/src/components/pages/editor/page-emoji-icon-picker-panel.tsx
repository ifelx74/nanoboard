import {
  Flag,
  Hash,
  Heart,
  Lightbulb,
  Palette,
  PawPrint,
  Plane,
  Search,
  Smile,
  Trophy,
  User,
  Utensils,
  X,
} from "lucide-react";
import { useId, useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import type { PageLogo } from "@/lib/db/schema";
import {
  EMOJI_CATEGORIES,
  LOCAL_EMOJI_GROUPS,
  searchLocalEmojis,
  type EmojiCategoryKey,
} from "@/lib/pages/emoji-data";
import {
  DEFAULT_PAGE_ICON_COLOR,
  PAGE_ICON_COLORS,
  isValidHexColor,
} from "@/lib/pages/logo";
import { PROJECT_ICONS, type ProjectIconKey } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

export type EmojiIconPickerTab = "emoji" | "icon";

export interface PageEmojiIconPickerPanelProps {
  value: PageLogo | null;
  defaultTab: EmojiIconPickerTab;
  onSelect: (logo: PageLogo) => void;
  onRemove?: () => void;
}

const CATEGORY_ICONS: Readonly<
  Record<EmojiCategoryKey, ComponentType<{ className?: string }>>
> = {
  smileys: Smile,
  people: User,
  nature: PawPrint,
  food: Utensils,
  travel: Plane,
  activities: Trophy,
  objects: Lightbulb,
  symbols: Heart,
  flags: Flag,
};

const ICON_ENTRIES: ReadonlyArray<{
  key: ProjectIconKey;
  searchable: string;
  Icon: (typeof PROJECT_ICONS)[ProjectIconKey];
}> = (Object.keys(PROJECT_ICONS) as ProjectIconKey[]).map((key) => ({
  key,
  // Split camelCase so e.g. `FolderKanban` matches both `folderkanban` and `folder kanban`.
  searchable:
    `${key} ${key.replace(/([a-z0-9])([A-Z])/g, "$1 $2")}`.toLowerCase(),
  Icon: PROJECT_ICONS[key],
}));

function isPresetIconColor(color: string): boolean {
  const lower = color.toLowerCase();
  return PAGE_ICON_COLORS.some((preset) => preset.toLowerCase() === lower);
}

/**
 * Lazy-loaded body for the reusable Emoji + colored Lucide icon popover picker.
 * Consumes the module-level `LOCAL_EMOJI_GROUPS` singleton inside the lazy chunk
 * so emoji lookup data never enters initial app-shell bundles.
 */
export default function PageEmojiIconPickerPanel({
  value,
  defaultTab,
  onSelect,
  onRemove,
}: PageEmojiIconPickerPanelProps) {
  const { t } = useTranslation("pages");
  const hexInputId = useId();

  const initialIconColor =
    value?.type === "icon" && isValidHexColor(value.color)
      ? value.color
      : DEFAULT_PAGE_ICON_COLOR;

  const [activeTab, setActiveTab] = useState<EmojiIconPickerTab>(defaultTab);
  const [activeCategory, setActiveCategory] =
    useState<EmojiCategoryKey>("smileys");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeColor, setActiveColor] = useState<string>(initialIconColor);
  const [showCustomHex, setShowCustomHex] = useState<boolean>(
    () => !isPresetIconColor(initialIconColor),
  );
  const [hexDigits, setHexDigits] = useState<string>(() =>
    initialIconColor.replace(/^#/, ""),
  );

  function getCategoryLabel(category: EmojiCategoryKey): string {
    switch (category) {
      case "smileys":
        return t("logoPicker.categories.smileys");
      case "people":
        return t("logoPicker.categories.people");
      case "nature":
        return t("logoPicker.categories.nature");
      case "food":
        return t("logoPicker.categories.food");
      case "travel":
        return t("logoPicker.categories.travel");
      case "activities":
        return t("logoPicker.categories.activities");
      case "objects":
        return t("logoPicker.categories.objects");
      case "symbols":
        return t("logoPicker.categories.symbols");
      case "flags":
        return t("logoPicker.categories.flags");
    }
  }

  const trimmedQuery = searchQuery.trim();

  const visibleEmojis = useMemo(() => {
    if (trimmedQuery.length > 0) {
      return searchLocalEmojis(trimmedQuery, 96);
    }
    const group = LOCAL_EMOJI_GROUPS.find((g) => g.key === activeCategory);
    return group ? group.items : [];
  }, [trimmedQuery, activeCategory]);

  const visibleIcons = useMemo(() => {
    if (trimmedQuery.length === 0) return ICON_ENTRIES;
    const normalized = trimmedQuery.toLowerCase();
    return ICON_ENTRIES.filter((entry) =>
      entry.searchable.includes(normalized),
    );
  }, [trimmedQuery]);

  function handleSelectTab(nextTab: EmojiIconPickerTab) {
    setActiveTab(nextTab);
    setSearchQuery("");
  }

  function handleCustomHexChange(raw: string) {
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setHexDigits(cleaned);
    if (cleaned.length === 3 || cleaned.length === 6) {
      const candidate = `#${cleaned}`;
      if (isValidHexColor(candidate)) {
        setActiveColor(candidate);
      }
    }
  }

  return (
    <div className="flex w-[328px] max-w-[calc(100vw-2rem)] flex-col text-popover-foreground">
      {/* Top tab strip + optional Remove action */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 pt-2 pb-1.5">
        <div
          role="tablist"
          className="inline-flex items-center rounded-md bg-muted p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "emoji"}
            onClick={() => handleSelectTab("emoji")}
            className={cn(
              "cursor-pointer rounded-sm px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              activeTab === "emoji"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("logoPicker.emojiTab")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "icon"}
            onClick={() => handleSelectTab("icon")}
            className={cn(
              "cursor-pointer rounded-sm px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              activeTab === "icon"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("logoPicker.iconsTab")}
          </button>
        </div>

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("logoPicker.remove")}
          </button>
        )}
      </div>

      {/* Shared search input */}
      <div className="px-2.5 pt-2">
        <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:border-ring">
          <Search
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={
              activeTab === "emoji"
                ? t("logoPicker.searchEmojis")
                : t("logoPicker.searchIcons")
            }
            aria-label={
              activeTab === "emoji"
                ? t("logoPicker.searchEmojis")
                : t("logoPicker.searchIcons")
            }
            autoFocus
            className="w-full min-w-0 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label={t("list.search.clear")}
              className="grid size-4 shrink-0 cursor-pointer place-items-center rounded-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Emoji tab panel */}
      {activeTab === "emoji" && (
        <div role="tabpanel" className="flex flex-col">
          {trimmedQuery.length === 0 && (
            <div className="grid grid-cols-9 gap-0.5 border-b border-border/70 px-2 py-1.5">
              {EMOJI_CATEGORIES.map((category) => {
                const CategoryIcon = CATEGORY_ICONS[category];
                const label = getCategoryLabel(category);
                const selected = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={selected}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      "grid size-7 cursor-pointer place-items-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      selected
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <CategoryIcon className="size-3.5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="h-60 overflow-y-auto px-2 py-2">
            {trimmedQuery.length === 0 && (
              <p className="mb-1.5 px-1 text-[11px] font-semibold text-muted-foreground">
                {getCategoryLabel(activeCategory)}
              </p>
            )}
            {visibleEmojis.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                {t("logoPicker.emptyEmojis")}
              </p>
            ) : (
              <div className="grid grid-cols-8 gap-0.5">
                {visibleEmojis.map((item) => {
                  const isSelected =
                    value?.type === "emoji" && value.value === item.emoji;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      title={`:${item.name}:`}
                      aria-label={item.name.replace(/_/g, " ")}
                      aria-pressed={isSelected}
                      onClick={() =>
                        onSelect({ type: "emoji", value: item.emoji })
                      }
                      className={cn(
                        "grid size-9 cursor-pointer place-items-center rounded-md text-xl leading-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        isSelected && "bg-accent ring-1 ring-brand-800",
                      )}
                    >
                      {item.emoji}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Colored Lucide Icons tab panel */}
      {activeTab === "icon" && (
        <div role="tabpanel" className="flex flex-col">
          {/* Color swatches / custom hex toggle */}
          <div className="flex items-center justify-between gap-1.5 border-b border-border/70 px-2.5 py-2">
            {showCustomHex ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1">
                <span
                  aria-hidden="true"
                  className="size-3.5 shrink-0 rounded-full border border-border/70"
                  style={{ backgroundColor: activeColor }}
                />
                <label
                  htmlFor={hexInputId}
                  className="shrink-0 text-[11px] font-medium text-muted-foreground"
                >
                  #
                </label>
                <input
                  id={hexInputId}
                  type="text"
                  value={hexDigits}
                  onChange={(event) =>
                    handleCustomHexChange(event.target.value)
                  }
                  aria-label={t("logoPicker.customColorLabel")}
                  placeholder="6d7b8a"
                  maxLength={6}
                  className="w-full min-w-0 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-between gap-1">
                {PAGE_ICON_COLORS.map((color) => {
                  const selected =
                    activeColor.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      aria-pressed={selected}
                      onClick={() => {
                        setActiveColor(color);
                        setHexDigits(color.slice(1));
                      }}
                      className={cn(
                        "grid size-6 cursor-pointer place-items-center rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        selected &&
                          "ring-2 ring-brand-800 ring-offset-1 ring-offset-popover",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-4 rounded-full border border-black/10 dark:border-white/15"
                        style={{ backgroundColor: color }}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              title={t("logoPicker.customColorToggle")}
              aria-label={t("logoPicker.customColorToggle")}
              aria-pressed={showCustomHex}
              onClick={() => {
                setShowCustomHex((prev) => !prev);
                setHexDigits(activeColor.replace(/^#/, ""));
              }}
              className={cn(
                "grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                showCustomHex && "bg-accent text-foreground",
              )}
            >
              {showCustomHex ? (
                <Palette className="size-3.5" aria-hidden="true" />
              ) : (
                <Hash className="size-3" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Icon grid */}
          <div className="h-60 overflow-y-auto px-2 py-2">
            {visibleIcons.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                {t("logoPicker.emptyIcons")}
              </p>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {visibleIcons.map(({ key, Icon }) => {
                  const isSelected =
                    value?.type === "icon" && value.name === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={key}
                      aria-label={key}
                      aria-pressed={isSelected}
                      onClick={() =>
                        onSelect({
                          type: "icon",
                          name: key,
                          color: activeColor,
                        })
                      }
                      className={cn(
                        "grid size-9 cursor-pointer place-items-center rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        isSelected && "bg-accent ring-1 ring-brand-800",
                      )}
                    >
                      <Icon
                        className="size-4.5"
                        style={{ color: activeColor }}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
