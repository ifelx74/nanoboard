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
import type { BackupDocument } from "./types";

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
  it("pins the exact v1 bytes for a fixed document fixture", () => {
    const fixture: BackupDocument = {
      format: "nanoboard-backup",
      version: 1,
      appVersion: "1.2.3",
      exportedAt: "2026-11-14T12:00:00.000Z",
      tables: {
        projects: [
          {
            id: "p1",
            name: "Test project",
            slug: "test-project",
            icon: "folder",
            position: 1024,
            lastTaskNumber: 7,
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_001_000,
          },
        ],
        columns: [],
        tasks: [],
        labels: [],
        taskLabels: [],
        taskResources: [],
        stickies: [],
        whiteboards: [],
        whiteboardPreviews: [],
      },
    };

    // Field order and minification are the format's compatibility contract;
    // this literal is the contract, written out — not derived from the
    // implementation's serializer.
    expect(serializeBackupDocument(fixture)).toBe(
      '{"format":"nanoboard-backup","version":1,"appVersion":"1.2.3","exportedAt":"2026-11-14T12:00:00.000Z","tables":{"projects":[{"id":"p1","name":"Test project","slug":"test-project","icon":"folder","position":1024,"lastTaskNumber":7,"createdAt":1700000000000,"updatedAt":1700000001000}],"columns":[],"tasks":[],"labels":[],"taskLabels":[],"taskResources":[],"stickies":[],"whiteboards":[],"whiteboardPreviews":[]}}',
    );
  });
});
