import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DATASET, DATASET_HASH, hash } from "../evaluation/dataset.mjs";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test("export keeps input and gold separate and verifies each content hash without provider configuration", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "powerenv-export-"));
  try {
    const run = spawnSync(
      process.execPath,
      [path.join(root, "evaluation/export.mjs"), "--out=" + dir],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout).modelCalls, 0);
    const input = (await fs.readFile(path.join(dir, "inputs.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    const gold = (await fs.readFile(path.join(dir, "gold.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(input.length, 86);
    assert.equal(gold.length, 86);
    input.forEach((row, i) => {
      assert.deepEqual(Object.keys(row), ["caseId", "task", "input"]);
      assert.deepEqual(row.input, DATASET[i].input);
      assert.equal(row.expected, undefined);
      assert.deepEqual(gold[i].expected, DATASET[i].expected);
    });
    const manifest = JSON.parse(
      await fs.readFile(path.join(dir, "manifest.json"), "utf8"),
    );
    assert.equal(manifest.datasetHash, DATASET_HASH);
    for (const [name, metadata] of Object.entries(manifest.files)) {
      const body = await fs.readFile(path.join(dir, name), "utf8");
      assert.equal(hash(body), metadata.sha256);
      assert.equal(Buffer.byteLength(body), metadata.bytes);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
