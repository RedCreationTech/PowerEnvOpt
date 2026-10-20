import { DATASET, DATASET_HASH, VERSION, SEED, hash } from "./dataset.mjs";
import { aggregate, numericalBaseline } from "./metrics.mjs";
export function baselineReport() {
  const rows = DATASET.filter((c) => c.task !== "R11").map((c) => ({
    caseId: c.id,
    task: c.task,
    scenario: c.scenario,
    status: "ok",
    expected: c.expected,
    prediction: numericalBaseline(c.input),
  }));
  const metrics = aggregate(rows);
  delete metrics.R11;
  const byScenario = Object.fromEntries(
    [...new Set(rows.map((r) => r.scenario))].map((scenario) => {
      const m = aggregate(rows.filter((r) => r.scenario === scenario));
      delete m.R11;
      return [scenario, m];
    }),
  );
  const report = {
    kind: "independent-numerical-baseline-only",
    syntheticOnly: true,
    modelCalls: 0,
    modelEvaluation: "not_run",
    modelGateStatus: "not_tested",
    baseline:
      "trailing-six OLS plus explicitly supplied known intervention; no provider or future labels",
    dataset: { version: VERSION, seed: SEED, sha256: DATASET_HASH },
    metrics,
    byScenario,
    rows,
  };
  return { ...report, reportHash: hash(report) };
}
