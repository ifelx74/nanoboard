import { describe, expect, it } from "vitest";
import { openEnvelope, parseEnvelope } from "@/lib/crypto/envelope";
import {
  buildTestContents,
  createTestDb,
  seedTestDb,
  type TestDbContents,
} from "../db/test-db";
import { createBackupDocument } from "./create";
import { sealBackupDocument } from "./encrypt";
import { serializeBackupDocument } from "./serialize";

const PASSPHRASE = "correct horse battery staple";

/** An app with nothing in it yet: every table empty. */
const EMPTY_CONTENTS: TestDbContents = {
  projects: [],
  columns: [],
  tasks: [],
  labels: [],
  taskLabels: [],
  taskResources: [],
  stickies: [],
  whiteboards: [],
  whiteboardPreviews: [],
};

describe("sealBackupDocument", () => {
  it("seals a v2 envelope whose plaintext header identifies the backup before unlock", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const document = await createBackupDocument(db);
    const text = await sealBackupDocument(document, PASSPHRASE);

    // The header is readable without the passphrase: restore can validate
    // and identify the file at the picker step.
    const envelope = parseEnvelope(text);
    expect(envelope.format).toBe("nanoboard-backup");
    expect(envelope.version).toBe(2);
    if (envelope.format !== "nanoboard-backup") {
      throw new Error("expected a backup envelope");
    }
    expect(envelope.appVersion).toBe(__APP_VERSION__);
    expect(envelope.exportedAt).toBe(document.exportedAt);

    await db.close();
  });

  it("leaves no table data in the file text — only the sealed payload", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const document = await createBackupDocument(db);
    const text = await sealBackupDocument(document, PASSPHRASE);

    // A distinctive row value from the seeded workspace must not appear
    // anywhere in the encrypted file.
    expect(text).not.toContain("Wire up the label picker");
    expect(text).not.toContain("whiteboardPreviews");

    await db.close();
  });

  it("round-trips all nine tables exactly as stored", async () => {
    const db = createTestDb();
    const contents = buildTestContents();
    await seedTestDb(db, contents);

    const document = await createBackupDocument(db);
    const text = await sealBackupDocument(document, PASSPHRASE);

    const opened = await openEnvelope(text, PASSPHRASE);
    // The payload is the tables object alone — nothing else of the v1
    // document rides inside the sealed data.
    expect(opened).toEqual(contents);

    await db.close();
  });

  it("exports an empty workspace as an encrypted backup that opens to empty tables", async () => {
    const db = createTestDb();
    await seedTestDb(db, EMPTY_CONTENTS);

    const document = await createBackupDocument(db);
    const text = await sealBackupDocument(document, PASSPHRASE);

    const opened = await openEnvelope(text, PASSPHRASE);
    expect(opened).toEqual(EMPTY_CONTENTS);

    await db.close();
  });
});

describe("serializeBackupDocument (unencrypted opt-out)", () => {
  it("is byte-identical to the minified v1 serializer output", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const document = await createBackupDocument(db);

    // The "save unencrypted" path must keep emitting exactly what the v1
    // export produced: JSON.stringify of the v1 document, nothing else.
    expect(serializeBackupDocument(document)).toBe(JSON.stringify(document));

    await db.close();
  });
});
