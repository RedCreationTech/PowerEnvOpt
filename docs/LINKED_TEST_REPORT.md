> v5 历史资料提示：本文保留早期设计/验证快照，不作为当前真实 AI 版本验收结论。当前能力与限制以 README、REAL_AI_TEST_REPORT.md 和 evaluation.md 为准。

> 历史验证快照：本文对应工单底座改版前的实现与计数，不代表当前 v4.0.0 验收结果。当前报告见 [WORKORDER_FOUNDATION_TEST_REPORT.md](WORKORDER_FOUNDATION_TEST_REPORT.md)。

# v3 role-based operations: independent verification

Verified 2026-10-17. Target: the delivered app.js, workflows.js, index.html and styles.css. This is a local, synthetic frontend demonstration.

## Result

- 24 linked-journey acceptance groups passed.
- 19 role, drawer and integration acceptance groups passed.
- 35 retained business/DOM groups passed (23 main, 7 extra, 5 consistency).
- 106 initial-page button smoke checks passed across role-visible pages.
- 7 static-server request-handler checks passed using mocked Node requests/responses.
- Tested app interactions made no fetch, XMLHttpRequest or WebSocket calls.
- JavaScript syntax checks passed.

Run `npm install --ignore-scripts --prefix tests`, then `npm test` from the project root. The review reused installed jsdom 30.1.3 through NODE_PATH on Node v24.19.0. The application itself has no runtime dependency. Machine-readable evidence is in tests/*-results.json and tests/results.json. All seven suites, including role-drawer.cjs, are included in npm test.

## Independently exercised

### Normal modules and contextual detail

Asset and alarm tables and the monitor remain rendered in their normal modules. No collapsed legacy explorer or global journey context takes over these pages. Linked asset, alarm and work entry points open the matching detail drawer without replacing the module. Search, site, nondefault asset type and second-page pagination survive opening and closing detail.

DOM checks verify labelled dialog/tab/tabpanel structure, arrow-key tab navigation, focus on the close control, return to the original connected opener, and fallback to the stable page heading after an action rerenders the list. These checks explicitly simulate the dialog close event; they are not native browser keyboard acceptance.

### Roles, assignment and handler guards

Six fixed demo people represent five role kinds: operator, maintenance engineer (two people), supervisor, reliability analyst and administrator. Default identity is the operator. Each identity has its expected home and exact permitted navigation. Tasks transfer between role queues; a non-assigned engineer cannot accept, check, submit or retest another engineer’s work. Site-filtered engineer totals agree with their queue.

Direct-call negative checks cover linked handoffs, ordinary alarm actions, configuration, topology, reset and model handlers. Analysis, decisions, retests and audit histories use fixed current-person IDs. Free-text reviewer names cannot impersonate the supervisor. Administrator is not a business superuser. This is frontend interaction gating, not production authentication or tamper resistance.

### Full linked workflows

Battery, cooling and capacity each complete operator acknowledgement and diagnosis request → analyst diagnosis → supervisor approval and assignment → assigned engineer acceptance and checklist → retest → supervisor independent acceptance → original alarm/work closure and case writeback. Work retains original asset, event, evidence, diagnosis, decision and knowledge IDs. IDs and provenance appear across the relevant drawer tabs. Completed data survives reload.

Negative paths cover skipped handoffs, missing reasons, unknown plans, deferral/rejection, duplicate acceptance/work creation, incomplete checklists, premature retest/closure, failed retest and fresh checklist, supervisor return for rework, wrong identities, invalid IDs and quality gates. Recovering valid quality requires a fresh diagnosis before approval.

A DOM click journey completes the battery scenario across identities using rendered buttons and checkbox events. Decision, retest and review HTML input remains escaped text.

### Shared data and persistence

Passed retest updates synthetic telemetry while the alarm remains under processing and the case awaits independent acceptance. Closure is separately reflected in risk state and knowledge case visibility. Original event evidence remains available. Scripted values checked are impedance deviation 31% → 4%, cooling inlet 29.4°C → 23.8°C and branch peak load 84% → 62%; none are real measurements or AI accuracy claims.

Single-case reset does not affect other closed cases. Full admin reset clears linked work. Corrupt journeys and orphan linked work recover consistently. v2 journey migration resets linked chains while preserving ordinary non-linked records. Selected linked entity context persists across reload.

## Findings corrected and retested

- Linked asset drawer selection originally changed active context without persisting it; reload persistence now passes.
- Legacy ordinary failed-retest → rework → passed-retest history and evidence requirements were corrected during the separate legacy regression review.
- Native work-state filters and fixed-role ordinary flows were adjusted and independently retested.

## Boundaries and outstanding manual acceptance

No real browser visual/responsive acceptance was possible. No browser screenshot was produced. Native Escape dismissal, modal focus trapping, browser Back behavior, layout/overflow, actual pointer hit targets, file:// policy and OS download saving remain unverified. jsdom DOM assertions do not prove CSS visibility or screen-reader behavior.

Previously denied Chromium launch routes were not retried or bypassed. Available user-computer CUA was not used as a substitute. The review used only the existing permitted Node/jsdom environment.

No real device connection, equipment action, backend authorization, signed approvals, real AI inference, model performance, production security or regulatory compliance was tested. The identity switch deliberately permits role simulation and is labelled as such.
