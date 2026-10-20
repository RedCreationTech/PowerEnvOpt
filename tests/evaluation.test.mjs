import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  DATASET,
  DATASET_HASH,
  VERSION,
  SEED,
  hash,
  buildDataset,
} from "../evaluation/dataset.mjs";
import {
  passes,
  rSquared,
  mae,
  wape,
  aggregate,
  numericalBaseline,
} from "../evaluation/metrics.mjs";
import {
  messagesFor,
  validatePrediction,
  runEvaluation,
  createEvaluationManager,
} from "../server/evaluation.mjs";
const config = {
  provider: "local",
  model: "fake-test-only",
  baseURL: "http://127.0.0.1:9000",
  timeoutMs: 1000,
  maxRetries: 0,
};
const goldenAdapter = async ({ messages, validate }) => {
  const input = JSON.parse(messages[1].content);
  const row = DATASET.find(
    (c) => JSON.stringify(c.input) === JSON.stringify(input),
  );
  return {
    result: validate(
      row.task === "R11" ? row.expected : { predictions: row.expected },
    ),
    model: "fake-test-only",
    requestedModel: "fake-test-only",
    providerReportedModel: "fixture-reported-model",
    provider: "local",
    usage: { total_tokens: 10 },
  };
};
test("frozen dataset version seed hash and horizon are reproducible", () => {
  assert.equal(
    hash({ version: VERSION, seed: SEED, cases: buildDataset() }),
    DATASET_HASH,
  );
  assert.equal(DATASET.length, 86);
  for (const c of DATASET.filter((c) => c.task !== "R11")) {
    assert.equal(c.input.history.length, 24);
    assert.equal(c.expected.length, 3);
    assert.notDeepEqual(c.expected, c.input.history.slice(-3));
  }
});
test("prompts strictly project input and never include gold, future, case ID or expected fields", () => {
  for (const c of DATASET) {
    const messages = messagesFor({ ...c, secret: "DO_NOT_LEAK" });
    assert.equal(messages[1].content, JSON.stringify(c.input));
    const text = JSON.stringify(messages);
    assert(!text.includes(c.id));
    assert(!text.includes("DO_NOT_LEAK"));
    assert(!text.includes("expected"));
    assert(!text.includes('"future"'));
    if (c.task !== "R11")
      for (const future of c.expected) assert(!text.includes(String(future)));
  }
});
test("strict unrounded boundaries", () => {
  assert.equal(passes("R08", 0.97), false);
  assert.equal(passes("R08", 0.9700000001), true);
  for (const task of ["R09", "R10"]) {
    assert.equal(passes(task, 0.05), false);
    assert.equal(passes(task, 0.0499999999), true);
  }
  assert.equal(passes("R11", 0.94), true);
  assert.equal(passes("R11", 0.9399999999), false);
  assert.equal(passes("R08", null), false);
});
test("metrics correct and degenerate inputs invalid", () => {
  assert.equal(rSquared([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(rSquared([2, 2], [2, 2]), null);
  assert.equal(mae([20, 22], [21, 21]), 1);
  assert.equal(wape([0, 10], [1, 9]), 0.2);
  assert.equal(wape([0, 0], [0, 0]), null);
  assert.equal(passes("R10", wape([0, 0], [0, 0])), false);
  assert.deepEqual(
    numericalBaseline({ history: [1, 2, 3, 4, 5, 6], horizon: 3 }),
    [7, 8, 9],
  );
});
test("semantic failed samples remain denominator; numeric failure vetoes gate", () => {
  const semantic = Array.from({ length: 50 }, (_, i) => ({
    task: "R11",
    status: i < 47 ? "ok" : "failed",
    expected: {
      sourceId: "a",
      family: "UPS",
      model: "UPS-100",
      version: "v2",
      reasonCode: "match",
    },
    prediction:
      i < 47
        ? {
            sourceId: "a",
            family: "UPS",
            model: "UPS-100",
            version: "v2",
            reasonCode: "match",
          }
        : null,
  }));
  const m = aggregate(semantic).R11;
  assert.equal(m.value, 0.94);
  assert.equal(m.totalCases, 50);
  assert.equal(m.failedCases, 3);
  assert.equal(m.pass, false);
  const n = aggregate([
    { task: "R08", status: "ok", expected: [1, 2], prediction: [1, 2] },
    { task: "R08", status: "failed" },
  ]).R08;
  assert.equal(n.value, 1);
  assert.equal(n.pass, false);
});
test("malformed, nonfinite, wrong horizon and unknown labels rejected", () => {
  const numeric = DATASET[0],
    semantic = DATASET.find((c) => c.task === "R11");
  for (const v of [
    null,
    { predictions: [1] },
    { predictions: ["1", 2, 3] },
    { predictions: [NaN, 2, 3] },
    { predictions: [1, 2, 3], extra: true },
  ])
    assert.throws(() => validatePrediction(numeric, v));
  assert.throws(() => validatePrediction(semantic, { label: "unknown" }));
});
test("oracle adapter is TEST ONLY; smoke never full acceptance", async () => {
  const report = await runEvaluation({
    config,
    invokeStructured: goldenAdapter,
  });
  assert.equal(report.rows.length, 11);
  assert.equal(report.fullSuitePass, false);
  assert.equal(report.acceptanceStatus, "smoke_only_not_acceptance");
  assert.equal(report.usage.total_tokens, 110);
  assert.equal(report.dataset.sha256, DATASET_HASH);
  assert.equal(report.prompt.sha256.length, 64);
  assert.equal(report.baseline.rows.length, 6);
  assert(
    report.rows.every(
      (r) =>
        r.providerReportedModel === "fixture-reported-model" &&
        r.requestedModel === "fake-test-only",
    ),
  );
});
test("full adapter fixture exercises all four gates, not real model quality", async () => {
  const report = await runEvaluation({
    config,
    invokeStructured: goldenAdapter,
    scope: "full",
  });
  assert.equal(report.rows.length, 86);
  assert.equal(report.metrics.R11.value, 1);
  assert.equal(report.fullSuitePass, true);
  assert.equal(report.productionValidated, false);
  assert.equal(report.metrics.R08.officialDefinitionPending, true);
});
test("timeouts and invalid adapter results counted without fallback", async () => {
  let i = 0;
  const report = await runEvaluation({
    config,
    invokeStructured: async () => {
      if (i++ % 2)
        throw Object.assign(new Error("secret should not surface"), {
          code: "TIMEOUT",
        });
      return { result: null };
    },
  });
  assert.equal(report.rows.length, 11);
  assert.equal(report.rows.filter((r) => r.status === "failed").length, 11);
  assert(report.rows.every((r) => r.prediction === null));
  assert(!JSON.stringify(report).includes("secret should not surface"));
  assert(Object.values(report.metrics).every((m) => !m.pass));
});
test("deadline marks all remaining cases failed without calls", async () => {
  let calls = 0;
  const report = await runEvaluation({
    config,
    invokeStructured: async () => {
      calls++;
    },
    maxDurationMs: 0,
  });
  assert.equal(calls, 0);
  assert.equal(report.rows.length, 11);
  assert(report.rows.every((r) => r.failure.code === "TIMEOUT"));
});
test("manager is single-flight and validates configured key before calling", async () => {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "powerenv-evaluation-test-"),
  );
  let release;
  const pending = new Promise((r) => (release = r));
  const manager = createEvaluationManager({
    rootDir,
    getConfig: async () => config,
    invokeStructured: async (args) => {
      await pending;
      return goldenAdapter(args);
    },
  });
  const job = await manager.start({ scope: "smoke" });
  await assert.rejects(manager.start(), (e) => e.code === "EVALUATION_BUSY");
  assert.equal(manager.status(job.id).scope, "smoke");
  release();
  while (manager.status(job.id).status !== "completed")
    await new Promise((r) => setTimeout(r, 1));
  assert.equal(manager.export(job.id).rows.length, 11);
  while (true) {
    try {
      await fs.access(
        path.join(rootDir, ".runtime", "evaluations", job.id + ".json"),
      );
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1));
    }
  }
  const restored = createEvaluationManager({
    rootDir,
    getConfig: async () => config,
    invokeStructured: goldenAdapter,
  });
  assert.equal(restored.export(job.id).rows.length, 11);
  const missing = createEvaluationManager({
    rootDir,
    getConfig: async () => ({ ...config, provider: "deepseek" }),
    invokeStructured: goldenAdapter,
  });
  await assert.rejects(missing.start(), (e) => e.code === "NOT_CONFIGURED");
  await fs.rm(rootDir, { recursive: true, force: true });
});

test("within-series R² avoids between-equipment baseline inflation", () => {
  const rows = [
    { task: "R08", status: "ok", expected: [1, 2, 3], prediction: [2, 2, 2] },
    {
      task: "R08",
      status: "ok",
      expected: [101, 102, 103],
      prediction: [102, 102, 102],
    },
  ];
  const metric = aggregate(rows).R08;
  assert.equal(metric.value, 0);
  assert(metric.pooledGlobalR2 > 0.99);
  assert.equal(metric.pass, false);
});

test("semantic 47/50 valid predictions passes exactly .94", () => {
  const rows = Array.from({ length: 50 }, (_, i) => ({
    task: "R11",
    status: "ok",
    expected: {
      sourceId: "a",
      family: "UPS",
      model: "UPS-100",
      version: "v2",
      reasonCode: "match",
    },
    prediction: {
      sourceId: i < 47 ? "a" : "b",
      family: "UPS",
      model: "UPS-100",
      version: "v2",
      reasonCode: "match",
    },
  }));
  assert.equal(aggregate(rows).R11.pass, true);
});
test("metric functions reject length mismatch and nonfinite values", () => {
  for (const fn of [rSquared, mae, wape]) {
    assert.equal(fn([1, 2], [1]), null);
    assert.equal(fn([1, 2], [1, Infinity]), null);
    assert.equal(fn([], []), null);
  }
  assert.equal(
    aggregate([
      { task: "R08", status: "ok", expected: [1, 2], prediction: [1] },
    ]).R08.failedCases,
    1,
  );
});

test("knowledge matching includes semantic distractors, stale versions, conflicts and missing metadata", () => {
  const cases = DATASET.filter((c) => c.task === "R11");
  assert.equal(
    cases.filter((c) => c.expected.reasonCode === "match").length,
    30,
  );
  assert.equal(
    cases.filter((c) => c.expected.reasonCode === "ambiguous").length,
    10,
  );
  assert.equal(
    cases.filter((c) => c.expected.reasonCode === "no_match").length,
    10,
  );
  assert(
    cases.every(
      (c) => new Set(c.input.candidates.map((x) => x.applicability)).size > 1,
    ),
  );
  assert(
    cases.every((c) =>
      c.input.candidates.some((x) => x.status === "superseded"),
    ),
  );
  assert.equal(
    cases.filter((c) => c.input.request.requiredVersion === null).length,
    2,
  );
});
test("numeric scenario coverage retains suspect sensor and OOD cases", () => {
  for (const task of ["R08", "R09", "R10"]) {
    const rows = DATASET.filter((c) => c.task === task);
    for (const scenario of [
      "normal",
      "degradation",
      "regime_shift",
      "out_of_distribution",
      "sensor_fault",
    ])
      assert(rows.some((c) => c.scenario === scenario));
    assert.equal(rows.length, 12);
  }
});
test("cancellation preserves remaining cases and prevents further calls", async () => {
  let cancelled = false,
    calls = 0;
  const report = await runEvaluation({
    config,
    scope: "full",
    shouldCancel: () => cancelled,
    invokeStructured: async (args) => {
      calls++;
      const result = await goldenAdapter(args);
      cancelled = true;
      return result;
    },
  });
  assert.equal(calls, 1);
  assert.equal(report.rows.length, 86);
  assert.equal(
    report.rows.filter((r) => r.failure?.code === "CANCELLED").length,
    85,
  );
  assert.equal(report.status, "cancelled");
  assert.equal(report.fullSuitePass, false);
});

test("source IDs are opaque and tuple scoring ignores property order", () => {
  for (const c of DATASET.filter((c) => c.task === "R11"))
    for (const candidate of c.input.candidates)
      assert.match(candidate.sourceId, /^kb-[a-f0-9]{12}$/);
  const expected = {
    sourceId: "x",
    family: "UPS",
    model: "100",
    version: "v1",
    reasonCode: "match",
  };
  const prediction = {
    reasonCode: "match",
    version: "v1",
    model: "100",
    family: "UPS",
    sourceId: "x",
  };
  assert.equal(
    aggregate([{ task: "R11", status: "ok", expected, prediction }]).R11.value,
    1,
  );
});
