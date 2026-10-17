# v2 linked workflow independent verification

Verified 2026-10-17 Beijing time. Test target: app.js + workflows.js in this delivery. Pure frontend, synthetic data only.

## Result

- 24 linked-journey acceptance groups passed.
- Existing business/DOM checks: 23 passed; extra checks: 7 passed; chart/data consistency: 5 passed.
- Initial-screen button smoke checks: 176 passed without uncaught runtime errors.
- Static server request-handler checks: 7 passed. These use mocked Node requests/responses, not browser or live HTTP proof.
- No tested application interaction called fetch, XMLHttpRequest or WebSocket.

Command: install test dependencies with `npm install --prefix tests`, then `npm test` from the project root. This verification reused an already-installed jsdom 30.1.3 through NODE_PATH; no runtime dependency is needed by the delivered app. Node v24.19.0 was used.

Machine-readable outputs: tests/linked-results.json, results.json, extra-results.json, consistency-results.json, button-results.json and server-results.json. Root npm test includes the linked suite.

## What was independently exercised

Each battery, cooling and capacity journey was completed from analysis through human decision, work order, checklist, retest, independent review and case. Tests verify the original asset/event/evidence/knowledge IDs, immutable diagnosis/decision references on work orders, retest links and displayed case provenance. Reload preserves completed state and selected scenario.

Negative tests cover missing analysis, missing reason, unknown plan, defer/reject, duplicate work-order creation, incomplete checklist, premature retest/close, failed retest backflow, cleared checklist after failure, missing/identical reviewer, stale quality, fresh-analysis requirement after quality recovery, invalid IDs, corrupt saved journey and missing referenced work. Legacy work transitions cannot bypass the linked journey gates.

The rendered UI click path completes a battery journey using actual DOM button handlers and checkbox events. Entered HTML remains text. This is a jsdom interaction test, not a real browser click/visual test.

Aggregate cards are checked with all three cases closed, after one reset, and under a single-site filter. Reset clears work, diagnoses, decisions, tests and cases without clearing other journeys. Entire-demo reset removes all linked work and cases.

Shared asset points reflect matching synthetic source evidence and current outcomes: battery impedance deviation 31% → 4%, cooling inlet temperature 29.4°C → 23.8°C, capacity peak load 84% → 62%. Shared device risk changes only at independent closure and returns to initial state on reset. Original pre-event snapshots stay available separately. These numbers are scripted demonstration values, not measured maintenance results or AI accuracy claims.

## Issues found and corrected during review

1. Site-filtered scenario cards originally had global summary totals.
2. Current bad quality initially left a previous valid prediction visible.
3. Scenario-only navigation did not persist selected context.
4. Work orders initially lacked explicit immutable diagnosis/decision/evidence references.
5. Legacy asset metrics and health advice conflicted with the new scenario evidence.
6. Invalid saved journey data left orphan work orders; missing work references caused runtime errors.
7. Restoring good quality allowed approval of an outdated diagnosis.
8. Reviewer surname matching rejected unrelated people sharing a surname; identity matching now uses the actor values.

9. Linked asset detail originally changed the old selected device without carrying scenario context; asset-to-monitor navigation now follows the same scenario.

All corresponding assertions passed in the final suite run.

## Limits

No real browser visual/responsive/accessibility acceptance was performed. Known environment failures were Chromium socket EPERM, denied escalation/bwrap launch and cloud file-protocol rejection; denied routes were not bypassed or repeated. Available user-computer CUA is not a permitted substitute for direct parent operation. jsdom does not prove CSS layout, visual visibility, hit targets, keyboard/focus behavior, file:// browser policy or OS download saving.

No production authentication, signed approval, actual field work, equipment control, AI inference, model performance, capacity/load/availability or regulatory compliance was tested. Role fields provide interaction gates only, not trusted identity or security.
