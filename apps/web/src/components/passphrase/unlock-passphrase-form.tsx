import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { ChangeEvent, FormEvent, ReactNode, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cryptoAvailable } from "@/hooks/use-passphrase-protection";

/**
 * Shared unlock step for the encrypted file dialogs (backup restore and
 * task-transfer import): the file row (name + change-file), a header
 * metadata slot (`children`, backup only), the passphrase field with a
 * show/hide toggle, the caller-localized error slot, and the forgotten-
 * passphrase note. Distinct copy — labels, the header call-out, the form/
 * input ids — is passed in; layout and behavior are shared. The submit and
 * cancel actions live in {@link UnlockPassphraseFooter}, which renders in
 * the dialog's footer.
 */
export function UnlockPassphraseForm({
  formId,
  inputId,
  fileName,
  passphrase,
  showPassphrase,
  busy,
  error,
  fileInputRef,
  onSubmit,
  onPassphraseChange,
  onTogglePassphraseVisibility,
  onFileChange,
  changeFileLabel,
  passphraseLabel,
  showPassphraseLabel,
  hidePassphraseLabel,
  forgottenPassphraseNote,
  cryptoUnavailableLabel,
  children,
}: {
  formId: string;
  inputId: string;
  fileName: string;
  passphrase: string;
  showPassphrase: boolean;
  /** True while unlocking: every control is disabled. */
  busy: boolean;
  /** Localized unlock error; rendered as the inline alert when set. */
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPassphraseChange: (value: string) => void;
  onTogglePassphraseVisibility: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  changeFileLabel: string;
  passphraseLabel: string;
  showPassphraseLabel: string;
  hidePassphraseLabel: string;
  forgottenPassphraseNote: string;
  /** Shown instead of the passphrase field when WebCrypto is missing. */
  cryptoUnavailableLabel: string;
  /** Slot shown between the file row and the passphrase field (metadata). */
  children?: ReactNode;
}) {
  return (
    <form id={formId} onSubmit={onSubmit}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">{fileName}</span>
          <button
            type="button"
            className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
            disabled={busy || !cryptoAvailable}
            onClick={() => fileInputRef.current?.click()}
          >
            {changeFileLabel}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={onFileChange}
        />
        {children}
        {!cryptoAvailable && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {cryptoUnavailableLabel}
          </p>
        )}
        <div className="space-y-2">
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-muted-foreground"
          >
            {passphraseLabel}
          </label>
          <div className="relative">
            <Input
              id={inputId}
              type={showPassphrase ? "text" : "password"}
              autoComplete="off"
              className="h-9 pr-9 text-sm"
              value={passphrase}
              disabled={busy || !cryptoAvailable}
              onChange={(event) => onPassphraseChange(event.target.value)}
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={busy || !cryptoAvailable}
              aria-label={
                showPassphrase ? hidePassphraseLabel : showPassphraseLabel
              }
              onClick={onTogglePassphraseVisibility}
            >
              {showPassphrase ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {forgottenPassphraseNote}
        </p>
      </div>
    </form>
  );
}

/**
 * The unlock step's footer actions: cancel (back to the pick step) and the
 * submit button wired to the form by id, with a spinner while busy.
 */
export function UnlockPassphraseFooter({
  formId,
  busy,
  canSubmit,
  cancelLabel,
  submitLabel,
  submittingLabel,
  onCancel,
}: {
  formId: string;
  busy: boolean;
  /** False while the passphrase is blank — disables the submit button. */
  canSubmit: boolean;
  cancelLabel: string;
  submitLabel: string;
  submittingLabel: string;
  onCancel: () => void;
}) {
  return (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        form={formId}
        size="sm"
        disabled={busy || !canSubmit}
      >
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        {busy ? submittingLabel : submitLabel}
      </Button>
    </>
  );
}
