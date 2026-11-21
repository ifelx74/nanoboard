import { describe, expect, it } from "vitest";
import {
  CODE_BLOCK_FENCE_BACKTICK_REGEX,
  CODE_BLOCK_FENCE_TILDE_REGEX,
  CODE_BLOCK_LANGUAGES,
  filterCodeLanguages,
  getCodeLanguageOption,
  normalizeCodeLanguage,
  resolveSmartCodeAction,
} from "./code-blocks";
import { pagesLowlight } from "./lowlight";

describe("normalizeCodeLanguage", () => {
  it("returns null for empty, whitespace, or auto values", () => {
    expect(normalizeCodeLanguage(null)).toBeNull();
    expect(normalizeCodeLanguage(undefined)).toBeNull();
    expect(normalizeCodeLanguage("")).toBeNull();
    expect(normalizeCodeLanguage("   ")).toBeNull();
    expect(normalizeCodeLanguage("auto")).toBeNull();
    expect(normalizeCodeLanguage("Auto")).toBeNull();
  });

  it("normalizes common fence aliases to canonical lowlight language ids", () => {
    expect(normalizeCodeLanguage("ts")).toBe("typescript");
    expect(normalizeCodeLanguage("TSX")).toBe("typescript");
    expect(normalizeCodeLanguage("js")).toBe("javascript");
    expect(normalizeCodeLanguage("jsx")).toBe("javascript");
    expect(normalizeCodeLanguage("py")).toBe("python");
    expect(normalizeCodeLanguage("sh")).toBe("bash");
    expect(normalizeCodeLanguage("zsh")).toBe("bash");
    expect(normalizeCodeLanguage("yml")).toBe("yaml");
    expect(normalizeCodeLanguage("md")).toBe("markdown");
    expect(normalizeCodeLanguage("html")).toBe("xml");
    expect(normalizeCodeLanguage("svg")).toBe("xml");
    expect(normalizeCodeLanguage("c++")).toBe("cpp");
    expect(normalizeCodeLanguage("C#")).toBe("csharp");
    expect(normalizeCodeLanguage("cs")).toBe("csharp");
    expect(normalizeCodeLanguage("rs")).toBe("rust");
    expect(normalizeCodeLanguage("rb")).toBe("ruby");
    expect(normalizeCodeLanguage("kt")).toBe("kotlin");
    expect(normalizeCodeLanguage("txt")).toBe("plaintext");
    expect(normalizeCodeLanguage("text")).toBe("plaintext");
    expect(normalizeCodeLanguage("plain")).toBe("plaintext");
    expect(normalizeCodeLanguage("toml")).toBe("ini");
  });

  it("preserves trimmed lowercase canonical and unknown valid language ids", () => {
    expect(normalizeCodeLanguage("  TypeScript  ")).toBe("typescript");
    expect(normalizeCodeLanguage("sql")).toBe("sql");
    expect(normalizeCodeLanguage("Elixir")).toBe("elixir");
    expect(normalizeCodeLanguage("objective-c")).toBe("objectivec");
  });

  it("rejects strings with invalid punctuation or spaces", () => {
    expect(normalizeCodeLanguage("foo bar")).toBeNull();
    expect(normalizeCodeLanguage("@@@")).toBeNull();
  });
});

describe("CODE_BLOCK_LANGUAGES and pagesLowlight", () => {
  it("registers every catalog language and TypeScript alias on the singleton lowlight instance", () => {
    const ids = CODE_BLOCK_LANGUAGES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(pagesLowlight.registered("typescript")).toBe(true);
    expect(pagesLowlight.registered("ts")).toBe(true);

    for (const entry of CODE_BLOCK_LANGUAGES) {
      expect(pagesLowlight.registered(entry.id)).toBe(true);
    }
  });

  it("highlights TypeScript snippets into lowlight token nodes", () => {
    const tree = pagesLowlight.highlight(
      "typescript",
      "const count: number = 42;",
    );
    expect(tree.children.length).toBeGreaterThan(0);
  });

  it("resolves catalog entries from canonical ids and aliases", () => {
    expect(getCodeLanguageOption("ts")).toMatchObject({
      id: "typescript",
      label: "TypeScript",
    });
    expect(getCodeLanguageOption("html")).toMatchObject({
      id: "xml",
      label: "HTML / XML",
    });
    expect(getCodeLanguageOption("c++")).toMatchObject({
      id: "cpp",
      label: "C++",
    });
    expect(getCodeLanguageOption("unknown-lang")).toBeNull();
    expect(getCodeLanguageOption(null)).toBeNull();
  });

  it("filters languages by label, id, and alias case-insensitively", () => {
    expect(filterCodeLanguages("")).toHaveLength(CODE_BLOCK_LANGUAGES.length);
    expect(filterCodeLanguages("TSX").map((l) => l.id)).toContain("typescript");
    expect(filterCodeLanguages("html").map((l) => l.id)).toContain("xml");
    expect(filterCodeLanguages("c++").map((l) => l.id)).toContain("cpp");
    expect(filterCodeLanguages("nonexistent-language-xyz")).toEqual([]);
  });

  it("matches fenced backtick and tilde input rules including punctuation languages", () => {
    expect("``` ".match(CODE_BLOCK_FENCE_BACKTICK_REGEX)?.[1]).toBeUndefined();
    expect("```ts ".match(CODE_BLOCK_FENCE_BACKTICK_REGEX)?.[1]).toBe("ts");
    expect("```c++\n".match(CODE_BLOCK_FENCE_BACKTICK_REGEX)?.[1]).toBe("c++");
    expect("```C# ".match(CODE_BLOCK_FENCE_BACKTICK_REGEX)?.[1]).toBe("C#");
    expect("~~~python ".match(CODE_BLOCK_FENCE_TILDE_REGEX)?.[1]).toBe(
      "python",
    );
    expect("``ts ".match(CODE_BLOCK_FENCE_BACKTICK_REGEX)).toBeNull();
  });
});

describe("resolveSmartCodeAction", () => {
  it("exits an active code block regardless of selection state", () => {
    expect(
      resolveSmartCodeAction({
        inCodeBlock: true,
        selectionEmpty: true,
        selectedText: "",
        sameParent: true,
      }),
    ).toBe("exit-code-block");
    expect(
      resolveSmartCodeAction({
        inCodeBlock: true,
        selectionEmpty: false,
        selectedText: "const a = 1;",
        sameParent: true,
      }),
    ).toBe("exit-code-block");
  });

  it("toggles a code block when the selection is empty", () => {
    expect(
      resolveSmartCodeAction({
        inCodeBlock: false,
        selectionEmpty: true,
        selectedText: "",
        sameParent: true,
      }),
    ).toBe("toggle-code-block");
  });

  it("toggles inline code for a single-line selection inside one block", () => {
    expect(
      resolveSmartCodeAction({
        inCodeBlock: false,
        selectionEmpty: false,
        selectedText: "npm run build",
        sameParent: true,
      }),
    ).toBe("toggle-inline-code");
  });

  it("wraps multi-line or cross-block selections into a fenced code block", () => {
    expect(
      resolveSmartCodeAction({
        inCodeBlock: false,
        selectionEmpty: false,
        selectedText: "line one\nline two",
        sameParent: true,
      }),
    ).toBe("wrap-code-block");
    expect(
      resolveSmartCodeAction({
        inCodeBlock: false,
        selectionEmpty: false,
        selectedText: "para one",
        sameParent: false,
      }),
    ).toBe("wrap-code-block");
  });
});
