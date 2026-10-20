import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WikiStore } from "../server/wiki.mjs";
import {
  runWikiEvaluation,
  sourceMetrics,
} from "../evaluation/wiki-evaluation.mjs";
import {
  WIKI_CASES,
  WIKI_SUITE_HASH,
  EXPECTED_WIKI_SUITE_HASH,
} from "../evaluation/wiki-dataset.mjs";
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function setup(fn) {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiki-e2e-test-"));
  try {
    return await fn(new WikiStore({ rootDir, runtimeDir }));
  } finally {
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
}
const config = { provider: "local", model: "fake-wiki-fixture" };
test("frozen 10-case Wiki suite and set metrics", () => {
  assert.equal(WIKI_SUITE_HASH, EXPECTED_WIKI_SUITE_HASH);
  assert.equal(WIKI_CASES.length, 10);
  assert.deepEqual(sourceMetrics([], []), {
    precision: 1,
    recall: 1,
    exactSourceSet: true,
  });
  assert.equal(sourceMetrics(["a"], ["a", "b"]).precision, 0.5);
  assert.equal(sourceMetrics(["a"], []).recall, 0);
});
test("actual WikiStore retrieval dry-run never invokes model or invents model result", () =>
  setup(async (wiki) => {
    let called = 0;
    const report = await runWikiEvaluation({
      wiki,
      config,
      dryRun: true,
      invokeModel: async () => {
        called++;
      },
    });
    assert.equal(called, 0);
    assert.equal(report.modelCalls, 0);
    assert.equal(report.summary.sourceCorrectness, null);
    assert.equal(report.summary.modelValidatedCases, 0);
    assert.equal(report.wikiCorpusHash.length, 64);
    assert(report.rows.slice(0, 6).every((r) => r.retrieval.recall === 1));
    assert(
      report.rows.slice(6).every((r) => r.retrievedSourceIds.length === 0),
    );
  }));
test("real retrieval to fake provider to citation validator has no answer leakage", () =>
  setup(async (wiki) => {
    const report = await runWikiEvaluation({
      wiki,
      config,
      invokeModel: async (args) => {
        assert(!Object.hasOwn(args, "expectedSourceIds"));
        assert(!Object.hasOwn(args, "caseId"));
        const item = WIKI_CASES.find(
          (c) =>
            c.input.query === args.query &&
            c.input.model === args.workorder.model &&
            c.input.version === args.workorder.version,
        );
        assert(item);
        return {
          result: {
            summary: "Fixture output, not real model.",
            citations: item.expectedSourceIds,
            limitations: ["Synthetic fixture only"],
          },
          requestedModel: config.model,
          providerReportedModel: "fixture-reported",
          usage: { total_tokens: 1 },
        };
      },
    });
    assert.equal(report.modelCalls, 10);
    assert.equal(report.summary.sourceCorrectness, 1);
    assert.equal(report.notR11Acceptance, true);
    assert.equal(report.factualValidityAssessed, false);
    assert(
      report.rows.every((r) => r.providerReportedModel === "fixture-reported"),
    );
  }));
test("invented citation is rejected and all failed cases stay in denominator", () =>
  setup(async (wiki) => {
    const report = await runWikiEvaluation({
      wiki,
      config,
      invokeModel: async () => ({
        result: {
          summary: "Fixture",
          citations: ["not-in-retrieval"],
          limitations: [],
        },
      }),
    });
    assert.equal(report.rows.length, 10);
    assert.equal(report.summary.failedCases, 10);
    assert.equal(report.summary.sourceCorrectness, 0);
    assert(report.rows.every((r) => r.failure));
  }));
test("timeout and absent provider-reported model remain honest", () =>
  setup(async (wiki) => {
    let i = 0;
    const report = await runWikiEvaluation({
      wiki,
      config,
      invokeModel: async (args) => {
        if (i++ === 0)
          throw Object.assign(new Error("secret"), { code: "TIMEOUT" });
        return {
          result: {
            summary: "Fixture",
            citations: args.sources.slice(0, 1).map((s) => s.sourceId),
            limitations: ["No claims"],
          },
        };
      },
    });
    assert.equal(report.summary.failedCases, 1);
    assert.equal(report.rows[0].failure.code, "TIMEOUT");
    assert(report.rows.slice(1).every((r) => r.providerReportedModel === null));
    assert(!JSON.stringify(report).includes("secret"));
  }));
