import { useEffect, useState } from "react";

export type Protection = "encrypted" | "plain";

/** WebCrypto requires a secure context; plain HTTP on a LAN has none. */
export const cryptoAvailable =
  typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";

/**
 * Shared state bundle for the two encrypted-export dialogs: the passphrase
 * pair, visibility toggle, protection choice, in-flight flag, and the
 * derived trimmed/match state that gates the primary button. Closing the
 * dialog (open → false) wipes every value — the passphrase never outlives
 * the operation.
 */
export function usePassphraseProtection(open: boolean) {
  // Encrypted is always the default; when WebCrypto is unavailable the
  // encrypted path renders disabled with the explanation inline, and only the
  // plain opt-out can produce a file — never a silent downgrade.
  const [protection, setProtection] = useState<Protection>("encrypted");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Closing the dialog discards the passphrase completely.
  useEffect(() => {
    if (open) return;
    setProtection("encrypted");
    setPassphrase("");
    setConfirmPassphrase("");
    setShowPassphrase(false);
    setExporting(false);
  }, [open]);

  const trimmedPassphrase = passphrase.trim();
  const trimmedConfirm = confirmPassphrase.trim();
  const mismatch =
    trimmedConfirm.length > 0 && trimmedPassphrase !== trimmedConfirm;
  const canSubmit =
    protection === "plain" ||
    (cryptoAvailable &&
      trimmedPassphrase.length > 0 &&
      trimmedConfirm.length > 0 &&
      !mismatch);

  return {
    protection,
    setProtection,
    passphrase,
    setPassphrase,
    confirmPassphrase,
    setConfirmPassphrase,
    showPassphrase,
    setShowPassphrase,
    exporting,
    setExporting,
    trimmedPassphrase,
    mismatch,
    canSubmit,
  };
}
