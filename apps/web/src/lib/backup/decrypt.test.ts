import { describe, expect, it } from "vitest";
import {
  buildTestContents,
  createTestDb,
  seedTestDb,
  TEST_NOW,
  type TestDbContents,
} from "../db/test-db";
import {
  applyBackupDocument,
  backupTableCounts,
  parseBackupDocument,
} from "./apply";
import { createBackupDocument } from "./create";
import {
  BackupDecryptError,
  isBackupEnvelope,
  openBackupDocument,
  readBackupEnvelope,
  sealBackupDocument,
} from "./encrypt";
import { serializeBackupDocument } from "./serialize";

const PASSPHRASE = "correct horse battery staple";

/**
 * A populated workspace distinct from buildTestContents(): extra rows the
 * restore target must NOT retain after a replace-all restore.
 */
function buildOtherContents(): TestDbContents {
  const contents = buildTestContents(TEST_NOW + 60_000);
  contents.projects.push({
    ...contents.projects[0],
    id: "project-extra",
    name: "Extra project",
    slug: "EP",
    position: 1,
  });
  contents.stickies.push({
    ...contents.stickies[0],
    id: "sticky-extra",
    position: 1,
  });
  return contents;
}

async function readAllTables(db: Parameters<typeof applyBackupDocument>[0]) {
  return {
    projects: await db.projects.toArray(),
    columns: await db.columns.toArray(),
    tasks: await db.tasks.toArray(),
    labels: await db.labels.toArray(),
    taskLabels: await db.taskLabels.toArray(),
    taskResources: await db.taskResources.toArray(),
    stickies: await db.stickies.toArray(),
    whiteboards: await db.whiteboards.toArray(),
    whiteboardPreviews: await db.whiteboardPreviews.toArray(),
  };
}

describe("isBackupEnvelope", () => {
  it("does not detect a plain v1 backup file as encrypted", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const document = await createBackupDocument(db);

    expect(isBackupEnvelope(serializeBackupDocument(document))).toBe(false);

    await db.close();
  });

  it("detects a sealed v2 backup file as encrypted", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const document = await createBackupDocument(db);
    const text = await sealBackupDocument(document, PASSPHRASE);

    expect(isBackupEnvelope(text)).toBe(true);

    await db.close();
  });

  it("rejects text that is not JSON", () => {
    expect(isBackupEnvelope("this is not json")).toBe(false);
  });

  it("rejects JSON that is not an object", () => {
    expect(isBackupEnvelope("[1, 2, 3]")).toBe(false);
    expect(isBackupEnvelope("42")).toBe(false);
  });

  it("rejects an encrypted task transfer — it is not a backup", () => {
    const text = JSON.stringify({
      format: "nanoboard-task-transfer",
      version: 1,
      encryption: {
        algorithm: "AES-256-GCM",
        kdf: {
          name: "PBKDF2",
          hash: "SHA-256",
          iterations: 600000,
          salt: "c2FsdHNhbHRzYWx0c2FsdA==",
        },
        iv: "aXYxMjM0NTY3OA==",
      },
      payload: "cGF5bG9hZA==",
    });

    expect(isBackupEnvelope(text)).toBe(false);
  });
});

describe("readBackupEnvelope", () => {
  it("reads the header metadata of a sealed backup without the passphrase", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const document = await createBackupDocument(db);
    const text = await sealBackupDocument(document, PASSPHRASE);

    const envelope = readBackupEnvelope(text);
    expect(envelope.format).toBe("nanoboard-backup");
    expect(envelope.version).toBe(2);
    expect(envelope.appVersion).toBe(__APP_VERSION__);
    expect(envelope.exportedAt).toBe(document.exportedAt);

    await db.close();
  });

  it("rejects a backup from a newer app version with the update-the-app message", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const document = await createBackupDocument(db);
    const sealed = JSON.parse(
      await sealBackupDocument(document, PASSPHRASE),
    ) as Record<string, unknown>;
    // A file written by a hypothetical newer app: same shape, bigger version.
    const future = JSON.stringify({ ...sealed, version: 3 });

    expect(() => readBackupEnvelope(future)).toThrow(
      /newer version of nanoboard — update the app first/,
    );

    await db.close();
  });

  it("rejects an envelope whose format identifier is wrong", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const document = await createBackupDocument(db);
    const sealed = JSON.parse(
      await sealBackupDocument(document, PASSPHRASE),
    ) as Record<string, unknown>;
    const wrongFormat = JSON.stringify({
      ...sealed,
      format: "nanoboard-task-transfer",
    });

    expect(() => readBackupEnvelope(wrongFormat)).toThrow(/format/i);

    await db.close();
  });

  it("rejects an envelope with no payload", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const document = await createBackupDocument(db);
    const sealed = JSON.parse(
      await sealBackupDocument(document, PASSPHRASE),
    ) as Record<string, unknown>;
    delete sealed.payload;
    const noPayload = JSON.stringify(sealed);

    expect(() => readBackupEnvelope(noPayload)).toThrow();

    await db.close();
  });
});

describe("openBackupDocument", () => {
  it("round-trips a sealed backup end-to-end into a replaced workspace", async () => {
    const source = createTestDb();
    const contents = buildTestContents();
    await seedTestDb(source, contents);

    const document = await createBackupDocument(source);
    const text = await sealBackupDocument(document, PASSPHRASE);

    const target = createTestDb();
    await seedTestDb(target, buildOtherContents());

    const restored = await openBackupDocument(text, PASSPHRASE);
    await applyBackupDocument(target, restored);

    expect(await readAllTables(target)).toEqual(contents);

    await source.close();
    await target.close();
  });

  it("preserves the envelope header — the restored document is stamped v2 from the file", async () => {
    const source = createTestDb();
    await seedTestDb(source);

    const document = await createBackupDocument(source);
    const text = await sealBackupDocument(document, PASSPHRASE);

    const restored = await openBackupDocument(text, PASSPHRASE);
    expect(restored.version).toBe(2);
    expect(restored.appVersion).toBe(__APP_VERSION__);
    expect(restored.exportedAt).toBe(document.exportedAt);
    // The summary counts come from the decrypted data, not the envelope.
    expect(backupTableCounts(restored)).toEqual(
      backupTableCounts(await createBackupDocument(source)),
    );

    await source.close();
  });

  it("rejects a wrong passphrase with one ambiguous error and writes nothing", async () => {
    const source = createTestDb();
    await seedTestDb(source);

    const document = await createBackupDocument(source);
    const text = await sealBackupDocument(document, PASSPHRASE);

    const target = createTestDb();
    const original = buildOtherContents();
    await seedTestDb(target, original);

    await expect(
      openBackupDocument(text, "not the passphrase"),
    ).rejects.toThrow(BackupDecryptError);
    expect(await readAllTables(target)).toEqual(original);

    await source.close();
    await target.close();
  });

  it("rejects a bit-flipped ciphertext and writes nothing", async () => {
    const source = createTestDb();
    await seedTestDb(source);

    const document = await createBackupDocument(source);
    const sealed = JSON.parse(
      await sealBackupDocument(document, PASSPHRASE),
    ) as Record<string, unknown>;
    const payload = sealed.payload as string;
    const flipAt = Math.floor(payload.length / 2);
    const flipped =
      payload.slice(0, flipAt) +
      (payload[flipAt] === "A" ? "B" : "A") +
      payload.slice(flipAt + 1);
    const tampered = JSON.stringify({ ...sealed, payload: flipped });

    const target = createTestDb();
    const original = buildOtherContents();
    await seedTestDb(target, original);

    await expect(openBackupDocument(tampered, PASSPHRASE)).rejects.toThrow(
      BackupDecryptError,
    );
    expect(await readAllTables(target)).toEqual(original);

    await source.close();
    await target.close();
  });

  it("rejects a truncated ciphertext and writes nothing", async () => {
    const source = createTestDb();
    await seedTestDb(source);

    const document = await createBackupDocument(source);
    const sealed = JSON.parse(
      await sealBackupDocument(document, PASSPHRASE),
    ) as Record<string, unknown>;
    // Keep well over the 16-byte GCM tag floor so the file passes the
    // header checks and fails at authentication.
    const truncated = JSON.stringify({
      ...sealed,
      payload: (sealed.payload as string).slice(0, 128),
    });

    const target = createTestDb();
    const original = buildOtherContents();
    await seedTestDb(target, original);

    await expect(openBackupDocument(truncated, PASSPHRASE)).rejects.toThrow(
      BackupDecryptError,
    );
    expect(await readAllTables(target)).toEqual(original);

    await source.close();
    await target.close();
  });

  it("rejects a file cut in half and writes nothing", async () => {
    const source = createTestDb();
    await seedTestDb(source);

    const document = await createBackupDocument(source);
    const text = await sealBackupDocument(document, PASSPHRASE);
    const cut = text.slice(0, Math.floor(text.length / 2));

    const target = createTestDb();
    const original = buildOtherContents();
    await seedTestDb(target, original);

    await expect(openBackupDocument(cut, PASSPHRASE)).rejects.toThrow();
    expect(await readAllTables(target)).toEqual(original);

    await source.close();
    await target.close();
  });

  it("rejects a newer-version envelope before any decryption work", async () => {
    const source = createTestDb();
    await seedTestDb(source);

    const document = await createBackupDocument(source);
    const sealed = JSON.parse(
      await sealBackupDocument(document, PASSPHRASE),
    ) as Record<string, unknown>;
    const future = JSON.stringify({ ...sealed, version: 3 });

    const target = createTestDb();
    const original = buildOtherContents();
    await seedTestDb(target, original);

    await expect(openBackupDocument(future, PASSPHRASE)).rejects.toThrow(
      /newer version of nanoboard/,
    );
    expect(await readAllTables(target)).toEqual(original);

    await source.close();
    await target.close();
  });
});

describe("plain v1 backups", () => {
  it("restore unchanged — serialize, parse, apply, tables equal", async () => {
    const source = createTestDb();
    const contents = buildTestContents();
    await seedTestDb(source, contents);

    const document = await createBackupDocument(source);
    const text = serializeBackupDocument(document);

    const target = createTestDb();
    await seedTestDb(target, buildOtherContents());

    await applyBackupDocument(target, parseBackupDocument(text));

    expect(await readAllTables(target)).toEqual(contents);

    await source.close();
    await target.close();
  });
});
