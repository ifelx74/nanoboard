import { useEffect, useState } from "react";

export type Protection = "encrypted" | "plain";

/** WebCrypto requires a secure context; plain HTTP on a LAN has none. */
export const cryptoAvailable =
  typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";

/**
 * Minimum passphrase length for encryption. PBKDF2 slows offline attacks,
 * but a short passphrase against a leaked backup is still brute-forceable;
 * this is the floor, not a strength guarantee.
 */
export const MIN_PASSPHRASE_LENGTH = 12;

/**
 * Shared state bundle for the two encrypted-export dialogs: the passphrase
 * pair, visibility toggle, protection choice, in-flight flag, and the
 * derived match/length state that gates the primary button. The passphrase
 * is used exactly as typed — leading/trailing whitespace is significant.
 * Closing the dialog (open → false) wipes every value — the passphrase
 * never outlives the operation.
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

  const mismatch =
    confirmPassphrase.length > 0 && passphrase !== confirmPassphrase;
  const passphraseTooShort =
    passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE_LENGTH;
  const canSubmit =
    protection === "plain" ||
    (cryptoAvailable &&
      passphrase.length >= MIN_PASSPHRASE_LENGTH &&
      confirmPassphrase === passphrase);

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
    mismatch,
    passphraseTooShort,
    canSubmit,
  };
}
