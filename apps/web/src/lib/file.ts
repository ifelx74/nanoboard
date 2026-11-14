/**
 * Upper bound for any user-supplied import file (backup restore, task
 * transfer import). The formats nanoboard writes are a few megabytes at
 * most; 50 MB leaves generous headroom while keeping a hostile or broken
 * file from exhausting memory before validation ever runs.
 */
export const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
