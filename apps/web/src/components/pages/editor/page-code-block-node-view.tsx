import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Check, ChevronDown, Copy, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { i18n } from "@/lib/i18n";
import {
  filterCodeLanguages,
  getCodeLanguageOption,
  normalizeCodeLanguage,
} from "@/lib/pages/code-blocks";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { usePageEditorEditable } from "./page-editor-context";
import "./pages-github-dark.css";

const COPY_FEEDBACK_MS = 1_000;

/**
 * Plane-styled GitHub Dark Code Block NodeView with a hover language selector
 * dropdown (hidden when read-only) and a hover "Copy code" button (usable even
 * when the page is locked or archived).
 */
export function PageCodeBlockNodeView({
  editor,
  node,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation("pages");
  const isEditable = usePageEditorEditable(editor);

  const [languageOpen, setLanguageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Close language picker automatically if the page becomes locked/archived.
  useEffect(() => {
    if (!isEditable && languageOpen) {
      setLanguageOpen(false);
    }
  }, [isEditable, languageOpen]);

  const rawLanguage =
    typeof node.attrs.language === "string" ? node.attrs.language : null;
  const canonicalLanguage = normalizeCodeLanguage(rawLanguage);
  const activeOption = getCodeLanguageOption(canonicalLanguage);

  const plainTextLabel = t("codeBlock.plainText");
  const autoLabel = t("codeBlock.auto");

  const languageTriggerLabel =
    canonicalLanguage === null
      ? autoLabel
      : canonicalLanguage === "plaintext"
        ? plainTextLabel
        : (activeOption?.label ?? canonicalLanguage);

  const filteredLanguages = useMemo(() => {
    const matches = filterCodeLanguages(searchQuery);
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (
      normalizedSearch &&
      plainTextLabel.toLowerCase().includes(normalizedSearch) &&
      !matches.some((entry) => entry.id === "plaintext")
    ) {
      const plainTextOption = getCodeLanguageOption("plaintext");
      if (plainTextOption) {
        return [plainTextOption, ...matches];
      }
    }
    return matches;
  }, [searchQuery, plainTextLabel]);

  const handleSelectLanguage = useCallback(
    (nextLanguage: string | null) => {
      if (!isEditable) return;
      updateAttributes({ language: nextLanguage });
      setLanguageOpen(false);
      setSearchQuery("");
    },
    [isEditable, updateAttributes],
  );

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    } catch {
      const errorMessage = i18n.t("pages:codeBlock.copyError");
      toast.error(errorMessage);
    }
  }, [node]);

  const showAutoOption =
    searchQuery.trim() === "" ||
    t("codeBlock.auto")
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase()) ||
    "auto".includes(searchQuery.trim().toLowerCase());

  const copyLabel = copied ? t("codeBlock.copied") : t("codeBlock.copy");

  return (
    <NodeViewWrapper
      className="nb-code-block code-block group/code relative my-2"
      data-language={canonicalLanguage ?? undefined}
    >
      <div
        contentEditable={false}
        className={cn(
          "absolute top-2 right-2 z-10 flex items-center gap-1.5 transition-opacity duration-150",
          languageOpen
            ? "opacity-100"
            : "opacity-0 group-hover/code:opacity-100 focus-within:opacity-100",
        )}
      >
        {isEditable && (
          <Popover
            open={languageOpen}
            onOpenChange={(nextOpen) => {
              setLanguageOpen(nextOpen);
              if (!nextOpen) {
                setSearchQuery("");
              }
            }}
          >
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={t("codeBlock.selectLanguage")}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-[#30363d] bg-[#161b22]/90 px-2 text-[11px] font-medium text-[#c9d1d9] backdrop-blur-sm transition-colors outline-none hover:bg-[#21262d] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="max-w-28 truncate">
                    {languageTriggerLabel}
                  </span>
                  <ChevronDown
                    className="size-3 shrink-0 text-[#8b949e]"
                    aria-hidden="true"
                  />
                </button>
              }
            />
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={6}
              className="w-52 p-1.5"
            >
              <div
                className="flex flex-col gap-1.5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 rounded-sm border border-input bg-background px-2">
                  <Search
                    className="size-3 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    placeholder={t("codeBlock.searchLanguage")}
                    aria-label={t("codeBlock.searchLanguage")}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Escape") {
                        setLanguageOpen(false);
                        setSearchQuery("");
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        if (searchQuery.trim() === "") {
                          handleSelectLanguage(null);
                        } else if (filteredLanguages.length > 0) {
                          handleSelectLanguage(filteredLanguages[0].id);
                        } else if (showAutoOption) {
                          handleSelectLanguage(null);
                        }
                      }
                    }}
                    className="h-7 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>

                <div
                  role="listbox"
                  aria-label={t("codeBlock.selectLanguage")}
                  className="max-h-56 space-y-0.5 overflow-y-auto"
                >
                  {showAutoOption && (
                    <button
                      type="button"
                      role="option"
                      aria-selected={canonicalLanguage === null}
                      onClick={() => handleSelectLanguage(null)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1 text-left text-xs transition-colors",
                        canonicalLanguage === null
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{t("codeBlock.auto")}</span>
                      {canonicalLanguage === null && (
                        <Check
                          className="size-3.5 shrink-0 text-brand-800"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )}

                  {filteredLanguages.map((lang) => {
                    const isSelected = canonicalLanguage === lang.id;
                    const displayLabel =
                      lang.id === "plaintext"
                        ? t("codeBlock.plainText")
                        : lang.label;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectLanguage(lang.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1 text-left text-xs transition-colors",
                          isSelected
                            ? "bg-accent font-medium text-foreground"
                            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{displayLabel}</span>
                        {isSelected && (
                          <Check
                            className="size-3.5 shrink-0 text-brand-800"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}

                  {!showAutoOption && filteredLanguages.length === 0 && (
                    <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                      {t("codeBlock.noLanguages")}
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <button
          type="button"
          title={copyLabel}
          aria-label={copyLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleCopyCode();
          }}
          className={cn(
            "grid size-7 cursor-pointer place-items-center rounded-md border backdrop-blur-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            copied
              ? "border-emerald-500/40 bg-emerald-950/85 text-emerald-400"
              : "border-[#30363d] bg-[#161b22]/90 text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]",
          )}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      <pre spellCheck={false}>
        <NodeViewContent<"code"> as="code" className="hljs" />
      </pre>
    </NodeViewWrapper>
  );
}
