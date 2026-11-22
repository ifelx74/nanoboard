export interface CodeBlockLanguageOption {
  /** Canonical lowlight language identifier. */
  id: string;
  /** Human-friendly language label shown in the code block language selector. */
  label: string;
  /** Additional fence aliases used for search and normalization. */
  aliases: readonly string[];
}

/**
 * Curated language catalog backed by `lowlight`'s `common` bundle (including
 * TypeScript). Ordered alphabetically after `plaintext` for fast scanning in
 * the hover language dropdown.
 */
export const CODE_BLOCK_LANGUAGES: readonly CodeBlockLanguageOption[] = [
  {
    id: "plaintext",
    label: "Plain text",
    aliases: ["text", "txt", "plain", "none"],
  },
  { id: "arduino", label: "Arduino", aliases: ["ino"] },
  { id: "bash", label: "Bash", aliases: ["sh", "zsh"] },
  { id: "c", label: "C", aliases: [] },
  { id: "cpp", label: "C++", aliases: ["c++", "cc", "cxx", "h", "hpp"] },
  { id: "csharp", label: "C#", aliases: ["c#", "cs", "dotnet"] },
  { id: "css", label: "CSS", aliases: [] },
  { id: "diff", label: "Diff", aliases: ["patch"] },
  { id: "go", label: "Go", aliases: ["golang"] },
  { id: "graphql", label: "GraphQL", aliases: ["gql"] },
  { id: "xml", label: "HTML / XML", aliases: ["html", "htm", "svg", "xhtml"] },
  { id: "ini", label: "INI / TOML", aliases: ["toml"] },
  { id: "java", label: "Java", aliases: [] },
  {
    id: "javascript",
    label: "JavaScript",
    aliases: ["js", "jsx", "mjs", "cjs"],
  },
  { id: "json", label: "JSON", aliases: ["jsonc"] },
  { id: "kotlin", label: "Kotlin", aliases: ["kt", "kts"] },
  { id: "less", label: "Less", aliases: [] },
  { id: "lua", label: "Lua", aliases: [] },
  { id: "makefile", label: "Makefile", aliases: ["mk", "mak"] },
  { id: "markdown", label: "Markdown", aliases: ["md"] },
  {
    id: "objectivec",
    label: "Objective-C",
    aliases: ["objc", "obj-c", "objective-c"],
  },
  { id: "perl", label: "Perl", aliases: ["pl"] },
  { id: "php", label: "PHP", aliases: [] },
  { id: "python", label: "Python", aliases: ["py"] },
  { id: "r", label: "R", aliases: [] },
  { id: "ruby", label: "Ruby", aliases: ["rb"] },
  { id: "rust", label: "Rust", aliases: ["rs"] },
  { id: "scss", label: "SCSS", aliases: [] },
  { id: "shell", label: "Shell", aliases: ["console"] },
  { id: "sql", label: "SQL", aliases: [] },
  { id: "swift", label: "Swift", aliases: [] },
  {
    id: "typescript",
    label: "TypeScript",
    aliases: ["ts", "tsx", "mts", "cts"],
  },
  { id: "vbnet", label: "VB.NET", aliases: ["vb"] },
  { id: "wasm", label: "WebAssembly", aliases: ["wat"] },
  { id: "yaml", label: "YAML", aliases: ["yml"] },
];

const LANGUAGE_BY_ID = new Map<string, CodeBlockLanguageOption>(
  CODE_BLOCK_LANGUAGES.map((entry) => [entry.id, entry]),
);

const LANGUAGE_ALIAS_MAP = new Map<string, string>();
for (const entry of CODE_BLOCK_LANGUAGES) {
  LANGUAGE_ALIAS_MAP.set(entry.id, entry.id);
  for (const alias of entry.aliases) {
    LANGUAGE_ALIAS_MAP.set(alias.toLowerCase(), entry.id);
  }
}

const VALID_LANGUAGE_ID_REGEX = /^[a-z0-9][a-z0-9_+#-]*$/;

/**
 * Matches fenced code block input rules (e.g. ```` ```ts ````, ```` ```c++ ````,
 * ```` ```c# ````, or bare ```` ``` ```` followed by space/newline).
 */
export const CODE_BLOCK_FENCE_BACKTICK_REGEX = /^```([a-zA-Z0-9_+#-]+)?[\s\n]$/;

/** Matches tilde-fenced code block input rules (e.g. `~~~python `). */
export const CODE_BLOCK_FENCE_TILDE_REGEX = /^~~~([a-zA-Z0-9_+#-]+)?[\s\n]$/;

/**
 * Normalizes a raw code fence or stored language attribute into a canonical
 * lowlight language identifier, or `null` for empty / `"auto"` / invalid input.
 * Unknown valid identifiers are preserved in lowercase for Markdown fidelity.
 */
export function normalizeCodeLanguage(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "auto") return null;

  const mapped = LANGUAGE_ALIAS_MAP.get(trimmed);
  if (mapped) return mapped;

  if (!VALID_LANGUAGE_ID_REGEX.test(trimmed)) return null;
  return trimmed;
}

/**
 * Looks up a curated language catalog entry by canonical id or fence alias.
 */
export function getCodeLanguageOption(
  raw: string | null | undefined,
): CodeBlockLanguageOption | null {
  const normalized = normalizeCodeLanguage(raw);
  if (!normalized) return null;
  return LANGUAGE_BY_ID.get(normalized) ?? null;
}

export type SmartCodeAction =
  | "exit-code-block"
  | "toggle-code-block"
  | "wrap-code-block"
  | "toggle-inline-code";

export interface SmartCodeContext {
  inCodeBlock: boolean;
  selectionEmpty: boolean;
  selectedText: string;
  sameParent: boolean;
}

/**
 * Pure decision helper for Plane's smart Code toggle:
 * - Already inside a code block -> exit back to a paragraph
 * - Empty selection -> toggle a fenced code block
 * - Multi-line or cross-block selection -> wrap selection in a fenced code block
 * - Single-line selection inside one block -> toggle inline code mark
 */
export function resolveSmartCodeAction({
  inCodeBlock,
  selectionEmpty,
  selectedText,
  sameParent,
}: SmartCodeContext): SmartCodeAction {
  if (inCodeBlock) return "exit-code-block";
  if (selectionEmpty) return "toggle-code-block";
  if (!sameParent || selectedText.includes("\n")) return "wrap-code-block";
  return "toggle-inline-code";
}

/**
 * Filters the curated language catalog case-insensitively across label, id,
 * and fence aliases.
 */
export function filterCodeLanguages(
  query: string,
): readonly CodeBlockLanguageOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return CODE_BLOCK_LANGUAGES;

  return CODE_BLOCK_LANGUAGES.filter(
    (entry) =>
      entry.label.toLowerCase().includes(normalizedQuery) ||
      entry.id.toLowerCase().includes(normalizedQuery) ||
      entry.aliases.some((alias) => alias.includes(normalizedQuery)),
  );
}
