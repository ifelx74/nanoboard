import { describe, expect, it } from "vitest";
import {
  buildTestContents,
  createTestDb,
  makeTask,
  seedTestDb,
} from "../db/test-db";
import { columnSlug } from "../db/schema";
import { getProjectColumns } from "../db/tasks";
import { importProjectTasks, readProjectTransferSource } from "../db/transfer";
import {
  isTaskTransferEnvelope,
  openTaskTransferDocument,
  readTaskTransferEnvelope,
  sealTaskTransferDocument,
} from "./encrypt";
import { buildTaskTransferDocument } from "./export";
import { parseTaskImportFile, planTaskImport } from "./import";
import type { ImportLabel } from "./types";

const PASSPHRASE = "correct horse battery staple";
const EXPORTED_AT = "2026-06-01T00:00:00.000Z";
const ARCHIVED_ISO = "2026-03-01T10:00:00.000Z";
const ARCHIVED_MS = Date.parse(ARCHIVED_ISO);

const ARCHIVED_CONTENTS = {
  ...buildTestContents(),
  tasks: [
    ...buildTestContents().tasks,
    makeTask({
      id: "task-3",
      columnId: "column-3",
      status: columnSlug("done"),
      title: "Ship the release",
      number: 3,
      position: 0,
      archivedAt: ARCHIVED_MS,
    }),
  ],
};

async function buildEncryptedExport(): Promise<{
  text: string;
  plainText: string;
}> {
  const sourceDb = createTestDb();
  await seedTestDb(sourceDb, ARCHIVED_CONTENTS);
  const source = await readProjectTransferSource(sourceDb, "project-1");
  const document = await buildTaskTransferDocument({
    ...source,
    exportedAt: EXPORTED_AT,
  });
  await sourceDb.close();
  const text = await sealTaskTransferDocument(document, PASSPHRASE);
  return { text, plainText: JSON.stringify(document, null, 2) };
}

async function importViaFileText(
  targetDb: Awaited<ReturnType<typeof createTestDb>>,
  fileText: string,
) {
  const items = parseTaskImportFile(fileText);
  const columns = await getProjectColumns(targetDb, "project-1");
  const existingLabels: ImportLabel[] = [];
  const plan = planTaskImport(items, columns, existingLabels);
  return importProjectTasks(targetDb, "project-1", plan.tasks);
}

describe("sealTaskTransferDocument", () => {
  it("seals a wrapper whose header identifies the file before unlock", async () => {
    const { text } = await buildEncryptedExport();

    expect(isTaskTransferEnvelope(text)).toBe(true);
    const envelope = readTaskTransferEnvelope(text);
    expect(envelope.format).toBe("nanoboard-task-transfer");
    expect(envelope.version).toBe(1);
  });

  it("leaves no task data in the file text — only the sealed payload", async () => {
    const { text } = await buildEncryptedExport();

    expect(text).not.toContain("Wire up the label picker");
    expect(text).not.toContain("Ship the release");
    expect(text).not.toContain("labels");
  });

  it("seals exactly the bare { project, tasks } document the plain path writes", async () => {
    const { text, plainText } = await buildEncryptedExport();

    const decrypted = await openTaskTransferDocument(text, PASSPHRASE);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(plainText));
  });
});

describe("encrypted task transfer import, fed as file text", () => {
  it("round-trips tasks, labels and archive state into the target workspace", async () => {
    const { text } = await buildEncryptedExport();
    const targetDb = createTestDb();
    await seedTestDb(targetDb);

    const decrypted = await openTaskTransferDocument(text, PASSPHRASE);
    const outcomes = await importViaFileText(targetDb, decrypted);

    expect(outcomes.every((outcome) => outcome.success)).toBe(true);
    const rows = await targetDb.tasks.toArray();
    const byTitle = new Map(rows.map((row) => [row.title, row]));
    expect(byTitle.get("Wire up the label picker")?.priority).toBe("high");
    expect(byTitle.get("Ship the release")?.archivedAt).toBe(ARCHIVED_MS);
    expect(byTitle.get("Ship the release")?.status).toBe(columnSlug("done"));

    await targetDb.close();
  });

  it("rejects a wrong passphrase before anything is planned or imported", async () => {
    const { text } = await buildEncryptedExport();
    const targetDb = createTestDb();
    await seedTestDb(targetDb);

    await expect(
      openTaskTransferDocument(text, "not the passphrase"),
    ).rejects.toThrow(/passphrase|damaged|incomplete/i);
    // Nothing was planned or written: the workspace still holds the seed.
    expect(await targetDb.tasks.count()).toBe(2);

    await targetDb.close();
  });

  it("rejects tampered ciphertext before any preview is computed", async () => {
    const { text } = await buildEncryptedExport();
    const envelope = JSON.parse(text) as { payload: string };
    const index = Math.floor(envelope.payload.length / 2);
    const replacement = envelope.payload[index] === "A" ? "B" : "A";
    envelope.payload =
      envelope.payload.slice(0, index) +
      replacement +
      envelope.payload.slice(index + 1);

    await expect(
      openTaskTransferDocument(JSON.stringify(envelope), PASSPHRASE),
    ).rejects.toThrow(/passphrase|damaged|incomplete/i);
  });

  it("rejects truncated ciphertext before any preview is computed", async () => {
    const { text } = await buildEncryptedExport();
    const envelope = JSON.parse(text) as { payload: string };
    envelope.payload = envelope.payload.slice(0, 8);

    await expect(
      openTaskTransferDocument(JSON.stringify(envelope), PASSPHRASE),
    ).rejects.toThrow(/truncated|damaged|incomplete|corrupt/i);
  });

  it("rejects a wrapper whose version is newer than the app supports", async () => {
    const { text } = await buildEncryptedExport();
    const envelope = JSON.parse(text) as { version: number };
    envelope.version = 2;
    const tooNew = JSON.stringify(envelope);

    expect(() => readTaskTransferEnvelope(tooNew)).toThrow(/newer version/i);
    await expect(openTaskTransferDocument(tooNew, PASSPHRASE)).rejects.toThrow(
      /newer version/i,
    );
  });

  it("fails cleanly when the wrapper is missing encryption or payload", async () => {
    const { text } = await buildEncryptedExport();

    const noPayload = JSON.parse(text) as Record<string, unknown>;
    delete noPayload.payload;
    expect(() => readTaskTransferEnvelope(JSON.stringify(noPayload))).toThrow(
      /payload/i,
    );

    const noEncryption = JSON.parse(text) as Record<string, unknown>;
    delete noEncryption.encryption;
    expect(() =>
      readTaskTransferEnvelope(JSON.stringify(noEncryption)),
    ).toThrow(/corrupt/i);
  });
});

describe("plain bare file parity", () => {
  it("takes the existing flow untouched and imports identically", async () => {
    const { plainText, text } = await buildEncryptedExport();

    expect(isTaskTransferEnvelope(plainText)).toBe(false);
    expect(isTaskTransferEnvelope(text)).toBe(true);

    const plainDb = createTestDb();
    await seedTestDb(plainDb);
    const plainOutcomes = await importViaFileText(plainDb, plainText);

    const encryptedDb = createTestDb();
    await seedTestDb(encryptedDb);
    const decrypted = await openTaskTransferDocument(text, PASSPHRASE);
    const encryptedOutcomes = await importViaFileText(encryptedDb, decrypted);

    expect(plainOutcomes.map((outcome) => outcome.success)).toEqual(
      encryptedOutcomes.map((outcome) => outcome.success),
    );

    const project = (
      rows: { title: string; status: string; archivedAt?: number }[],
    ) =>
      rows
        .map((row) => [row.title, row.status, row.archivedAt ?? null])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(project(await plainDb.tasks.toArray())).toEqual(
      project(await encryptedDb.tasks.toArray()),
    );

    await plainDb.close();
    await encryptedDb.close();
  });
});
