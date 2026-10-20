> v5 历史资料提示：本文保留早期设计/验证快照，不作为当前真实 AI 版本验收结论。当前能力与限制以 README、REAL_AI_TEST_REPORT.md 和 evaluation.md 为准。

# Linked workflow acceptance checklist

Independent acceptance scope: battery, cooling and capacity frontend scenario journeys. Synthetic scenario outcomes are not real equipment tests or validated AI predictions.

1. Each journey has stable asset and event IDs with resolvable evidence, diagnosis, human decision, work order, retest and outcome references. Navigation must retain selected journey; reload must retain committed records.
2. Analysis states its synthetic/assistive nature, cites the selected asset's evidence and correct scenario knowledge source, and cannot issue equipment commands. Invalid/missing/stale quality prevents valid prediction output and progression dependent on that prediction.
3. Eligible operator takeover creates the unique work order immediately, before diagnosis or approval. Repeated takeover cannot duplicate it. Rejection and deferral preserve the same work order; approval and dispatch require their own authorized decisions and cannot occur through unsafe direct calls.
4. Work items preserve original event, asset, diagnosis and decision provenance. Checklist completion and human approval are explicit prerequisites. Retest failure returns to investigation/handling and cannot create a successful case.
5. Successful closure requires a passed retest and required independent reviewer. Before/after metrics use matching units and truthful aggregate counts. Failed/rejected/deferred paths cannot increase completed-case counts or savings.
6. A completed case links to its original knowledge sources and actual diagnosis. New analysis does not mutate historical case provenance. Reopened/invalidated work must not remain a currently successful case.
7. Cross-page counts derive from shared state. Site filters do not leak selected records from another site. Original events remain traceable. Reset removes old diagnoses, decisions, work orders, tests, cases and selected-context leftovers; reloading stays reset.
8. All supported navigation/pages and interactions render without uncaught errors or unintended network requests. User-controlled text remains escaped. Corrupt/unavailable local storage boots safely.

## Verification methods

Run deterministic jsdom tests against app.js + workflows.js with the shared harness. Exercise rendered click handlers in addition to direct state API checks. Export machine-readable results with the reviewer report.

Real browser layout, CSS visibility, hit targets, responsive breakpoints, browser-native download/save and actual file:// compatibility require a real browser. Prior Chromium socket EPERM and escalation/bwrap denial and cloud file-protocol rejection are known environment limitations; do not repeat or bypass them. jsdom results must not be described as browser visual acceptance.
