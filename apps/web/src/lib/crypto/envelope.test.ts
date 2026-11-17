import { describe, expect, it } from "vitest";
import {
  openEnvelope,
  parseEnvelope,
  sealBackupEnvelope,
  sealTaskTransferEnvelope,
  TASK_TRANSFER_ENVELOPE_FORMAT,
} from "./envelope";

const PASSPHRASE = "correct horse battery staple";
const HEADER = { appVersion: "1.2.3", exportedAt: "2026-11-14T12:00:00.000Z" };
// A nested payload with unicode text, exercising UTF-8 round-trip.
const PAYLOAD = {
  tables: {
    projects: [{ id: "p1", name: "Schéma — café ☕", slug: "schema" }],
    tasks: [{ id: "t1", title: "Ünïcodé tâsk", position: 1 }],
  },
};

describe("sealBackupEnvelope", () => {
  it("yields a minified JSON envelope matching the backup v2 wire shape", async () => {
    const text = await sealBackupEnvelope(PAYLOAD, PASSPHRASE, HEADER);

    expect(text.split("\n")).toHaveLength(1);

    const envelope = JSON.parse(text) as Record<string, unknown>;
    expect(envelope.format).toBe("nanoboard-backup");
    expect(envelope.version).toBe(2);
    expect(envelope.appVersion).toBe(HEADER.appVersion);
    expect(envelope.exportedAt).toBe(HEADER.exportedAt);
    expect(typeof envelope.payload).toBe("string");
    // The sealed payload must not leak plaintext into the file.
    expect(text).not.toContain("projects");
    expect(text).not.toContain("Ünïcodé");
  });

  it("records the fixed algorithms and a 600000-iteration PBKDF2 block", async () => {
    const envelope = parseEnvelope(
      await sealBackupEnvelope(PAYLOAD, PASSPHRASE, HEADER),
    );

    expect(envelope.encryption.algorithm).toBe("AES-256-GCM");
    expect(envelope.encryption.kdf).toMatchObject({
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 600_000,
    });
    // 16-byte salt and 12-byte IV, base64-coded.
    expect(Buffer.from(envelope.encryption.kdf.salt, "base64")).toHaveLength(
      16,
    );
    expect(Buffer.from(envelope.encryption.iv, "base64")).toHaveLength(12);
  });

  it("emits a different envelope on every seal — fresh salt and IV", async () => {
    const first = parseEnvelope(
      await sealBackupEnvelope(PAYLOAD, PASSPHRASE, HEADER),
    );
    const second = parseEnvelope(
      await sealBackupEnvelope(PAYLOAD, PASSPHRASE, HEADER),
    );

    expect(first.encryption.kdf.salt).not.toBe(second.encryption.kdf.salt);
    expect(first.encryption.iv).not.toBe(second.encryption.iv);
    expect(first.payload).not.toBe(second.payload);
  });
});

describe("sealTaskTransferEnvelope", () => {
  it("yields the task-transfer wrapper shape with no appVersion/exportedAt", async () => {
    const text = await sealTaskTransferEnvelope(PAYLOAD, PASSPHRASE);

    const envelope = JSON.parse(text) as Record<string, unknown>;
    expect(envelope.format).toBe("nanoboard-task-transfer");
    expect(envelope.version).toBe(1);
    expect(envelope).not.toHaveProperty("appVersion");
    expect(envelope).not.toHaveProperty("exportedAt");
    expect(envelope.encryption).toMatchObject({ algorithm: "AES-256-GCM" });
    expect(typeof envelope.payload).toBe("string");
  });
});

describe("openEnvelope", () => {
  it("round-trips the backup payload object with the right passphrase", async () => {
    const text = await sealBackupEnvelope(PAYLOAD, PASSPHRASE, HEADER);

    await expect(openEnvelope(text, PASSPHRASE)).resolves.toEqual(PAYLOAD);
  });

  it("round-trips the task-transfer payload object with the right passphrase", async () => {
    const document = { project: { name: "P" }, tasks: [{ title: "t" }] };
    const text = await sealTaskTransferEnvelope(document, PASSPHRASE);

    await expect(openEnvelope(text, PASSPHRASE)).resolves.toEqual(document);
  });

  it("fails with a GCM authentication error on the wrong passphrase", async () => {
    const text = await sealBackupEnvelope(PAYLOAD, PASSPHRASE, HEADER);

    await expect(openEnvelope(text, "wrong passphrase")).rejects.toThrow(
      /passphrase|damaged|incomplete/i,
    );
  });

  it("fails the same way on a bit-flipped ciphertext", async () => {
    const envelope = parseEnvelope(
      await sealBackupEnvelope(PAYLOAD, PASSPHRASE, HEADER),
    );
    const bytes = Buffer.from(envelope.payload, "base64");
    bytes[0] = bytes[0]! ^ 0x01;
    const tampered = JSON.stringify({
      ...envelope,
      payload: bytes.toString("base64"),
    });

    await expect(openEnvelope(tampered, PASSPHRASE)).rejects.toThrow(
      /passphrase|damaged|incomplete/i,
    );
  });

  it("fails the same way when the plaintext header metadata is tampered with", async () => {
    const envelope = parseEnvelope(
      await sealBackupEnvelope(PAYLOAD, PASSPHRASE, HEADER),
    );

    for (const tampered of [
      { ...envelope, appVersion: "9.9.9" },
      { ...envelope, exportedAt: "1999-01-01T00:00:00.000Z" },
      { ...envelope, format: TASK_TRANSFER_ENVELOPE_FORMAT },
    ]) {
      await expect(
        openEnvelope(JSON.stringify(tampered), PASSPHRASE),
      ).rejects.toThrow(/passphrase|damaged|incomplete/i);
    }
  });

  it("fails the same way on a truncated ciphertext", async () => {
    const envelope = parseEnvelope(
      await sealBackupEnvelope(PAYLOAD, PASSPHRASE, HEADER),
    );
    const tampered = JSON.stringify({
      ...envelope,
      payload: envelope.payload.slice(
        0,
        Math.floor(envelope.payload.length / 2),
      ),
    });

    await expect(openEnvelope(tampered, PASSPHRASE)).rejects.toThrow(
      /passphrase|damaged|incomplete/i,
    );
  });
});

describe("parseEnvelope", () => {
  it("rejects text that is not JSON", () => {
    expect(() => parseEnvelope("not json {")).toThrow(/not valid JSON/i);
  });

  it("rejects a JSON document that is not an envelope", () => {
    expect(() => parseEnvelope(JSON.stringify({ format: "other" }))).toThrow();
    expect(() => parseEnvelope(JSON.stringify([1, 2, 3]))).toThrow();
  });
});
