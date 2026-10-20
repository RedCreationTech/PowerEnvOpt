# Local Markdown knowledge Wiki

## Architecture and original reference

The implementation follows the architectural pattern described in [Karpathy's original LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), inspected on 2026-10-20: preserve original sources, maintain a separate compiled knowledge layer, and keep navigational and historical records. It is a project-specific adaptation, not a claim that the gist supplies an industrial maintenance ontology.

- `knowledge/raw/*.md`: immutable, original synthetic S1 cooling / S2 UPS and battery / S3 comparable-load HVAC energy source fixtures.
- `knowledge/wiki/*.md`: compiled evidence pages, index, log and review guidance.
- `knowledge/SCHEMA.md`: authoring, applicability and trust rules.
- `.runtime/wiki/raw/*.md`: user-imported immutable raw Markdown.
- `.runtime/wiki/proposals/*.json`: candidate, approved, rejected or published workflow records.
- `.runtime/wiki/published/*.md`: manually reviewed compiled output.
- `.runtime/wiki/index.md` and `log.jsonl`: generated publication catalog and append-only audit events.

The JSON frontmatter in each Markdown document carries identity, title, provenance, review state, explicit family/model/version and source IDs. The directed graph is parsed from actual `[[id]]` links; backlinks are computed from those edges. Raw source nodes are visible and readable. Missing targets are reported rather than fabricated.

## Module contract

`new WikiStore({rootDir, runtimeDir})` accepts the project root and optionally the exact runtime Wiki directory. Every method is asynchronous.

- `graph()` → `{nodes, edges}`. Nodes include metadata, outgoing links and backlinks; edges have source, target and type `wikilink`.
- `page(id)` → metadata plus Markdown/content, links, backlinks and kind `raw` or `compiled`.
- `search({query, family, model, version})` → matching pages with excerpts. Search can show unreviewed source material; it is not the operational retrieval function.
- `retrieve({query, family, model, version, limit})` → only reviewed compiled evidence, with exact declared applicability and a lexical ordering score. This is not semantic embedding search. Unknown family/model/version produces no match. Queries without keywords still return explicitly matching family evidence.
- `ingestRaw({title, markdown, family, model, version})` → new raw source, unreviewed, user-supplied provenance, SHA-256 and immutable UUID file.
- `createProposal({title, markdown, sourceIds, family, model, version, workorderId, modelInfo})` → candidate with validated source IDs and source content snapshots. May consume recorded raw sources or reviewed compiled evidence; cannot consume arbitrary fabricated citations.
- `review(id, {approved, reviewer, note})` requires a human identity and evidence-check note. Approval and rejection are terminal for that candidate's review.
- `publish(id)` requires approved status, validates source hashes again, writes the Markdown compiled page and updates index/history. Concurrent publications are serialized.
- `proposals()` returns current proposal records.
- `recordFailure({action, code})` writes bounded safe error metadata only.
- `lint()` reports dangling links, orphan nodes and source-snapshot staleness. This structural lint does not certify engineering correctness or resolve factual contradictions.

## Compilation and safe UI

The HTTP/backend adapter owns the selected-provider call: pass source text as explicitly untrusted evidence, validate model citations, then call createProposal. Do not treat embedded prompt instructions as policy, use an imported source's URLs as destinations, or allow the model to call review/publish. The UI must render Markdown as escaped text/textContent, and make only validated internal IDs clickable. It must label synthetic fixtures clearly, show provenance and applicability, and state no match when evidence is absent.

`reviewed` is a workflow state, not a warranty of vendor approval. The existing fictional HC-PAC30 demo matches S1 and S3. HC-UPS40 and HC-BAT192 are explicitly listed for S2. The version is demo-v1. This implementation never changes actual equipment or runs a live model call during tests.

## Verification

Run `node --test tests/wiki.test.mjs`. Tests cover actual graph/backlinks, family/model/version filtering, traversal refusal, candidate retrieval exclusion, manual approval and provenance, untrusted raw import, cross-family citation rejection and safe failure audit. All provider tests must use stubs, not secrets or live services.

## Reviewed revisions and stale evidence

`createProposal` also accepts optional `targetId`. This must identify an existing compiled evidence page with matching device applicability. The candidate stores a content-and-metadata digest of that target. Publication still requires a separate human review; it rejects the change if the target or any cited source has changed since the proposal was created. The prior page is preserved with an immutable revision UUID under `.runtime/wiki/history/<page-id>/`, then an atomic runtime overlay replaces the target ID. Repository source fixtures are never overwritten. The audit event and published page record the previous revision and proposal identity.

If a cited page changes, downstream compiled pages retain their visible provenance but become `stale: true`. This flag propagates through derived pages. Such pages are excluded from operational retrieval and cannot serve as evidence for a new candidate. Search and graph browsing can still show them for corrective review; lint lists them. A revised page can cite its previous version without forming a self-stale cycle: the previous version is archived and published provenance uses immutable raw source snapshots instead of a self-reference.

The graph also includes explicit fictional equipment entities and operational relationships: HC-PAC30 connects fault evidence with energy analysis; HC-UPS40 and HC-BAT192 connect power continuity and battery evidence. These are original synthetic relationships, not verified manufacturer specifications.

## 严格适用版本

真实工单上下文必须绑定设备族、型号与资料版本，不能把工单修订号当作规程版本。合成HC-PAC30/HC-UPS40/HC-BAT192固定绑定demo-v1；未绑定版本、未知型号或不同版本返回无适用资料。新候选仅适用于明确选择的型号，不继承上游资料的全部型号范围。

Operational retrieval requires all three applicability fields: nonempty family, exact model and exact version. Missing fields produce no evidence rather than broadening the match; only browsing search permits omitted filters. Candidate applicability is always narrowed to its selected model (`models: [model]`), even if its source covers several models or it revises a broader page. Reviewers must inspect this narrowed scope. Seed compiled pages carry raw-source snapshots as well: missing or changed raw provenance makes those pages stale and unavailable for operational retrieval.
