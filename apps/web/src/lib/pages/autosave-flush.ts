export interface DebouncedSaverOptions {
  delayMs: number;
  /** Performs the persistence write. Called synchronously on flush when idle. */
  save: () => Promise<void>;
  onError?: (error: unknown) => void;
}

export interface DebouncedSaver {
  /** Marks state dirty and resets the debounce timer. */
  schedule: () => void;
  /**
   * Cancels any pending timer and immediately commits if dirty, awaiting any
   * in-flight write in order. Resolves `true` on clean/successful save and
   * `false` if the latest save threw.
   */
  flush: () => Promise<boolean>;
  /** Cancels any pending timer without triggering a save. */
  cancel: () => void;
}

/**
 * Coordinates debounced autosaves with an explicit awaitable `flush()` seam so
 * actions such as "Make a copy", Lock, Archive, or unmount can await pending
 * IndexedDB writes in strict order before mutating or cloning the row.
 */
export function createDebouncedSaver({
  delayMs,
  save,
  onError,
}: DebouncedSaverOptions): DebouncedSaver {
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<boolean> | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = (): Promise<boolean> => {
    clearTimer();
    if (!dirty) {
      return inFlight ?? Promise.resolve(true);
    }
    dirty = false;

    const invoke = (): Promise<void> => {
      try {
        return save();
      } catch (error) {
        return Promise.reject(error);
      }
    };

    const previous = inFlight;
    const nextSave: Promise<boolean> = (
      previous ? previous.then(invoke) : invoke()
    )
      .then(() => true)
      .catch((error: unknown) => {
        dirty = true;
        onError?.(error);
        return false;
      })
      .finally(() => {
        if (inFlight === nextSave) {
          inFlight = null;
        }
      });

    inFlight = nextSave;
    return nextSave;
  };

  const schedule = () => {
    dirty = true;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delayMs);
  };

  return {
    schedule,
    flush,
    cancel: clearTimer,
  };
}
