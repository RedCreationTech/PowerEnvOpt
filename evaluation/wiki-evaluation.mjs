import { hash } from "./dataset.mjs";
import {
  WIKI_CASES,
  WIKI_SUITE_VERSION,
  WIKI_SUITE_HASH,
} from "./wiki-dataset.mjs";
import { validateResult } from "../server/ai.mjs";
export function sourceMetrics(expected, predicted) {
  const a = new Set(expected),
    b = new Set(predicted),
    hit = [...b].filter((x) => a.has(x)).length;
  return {
    precision: b.size ? hit / b.size : a.size ? 0 : 1,
    recall: a.size ? hit / a.size : b.size ? 0 : 1,
    exactSourceSet: a.size === b.size && [...a].every((x) => b.has(x)),
  };
}
export async function runWikiEvaluation({
  wiki,
  config,
  invokeModel,
  dryRun = false,
}) {
  const graph = await wiki.graph();
  const pages = await Promise.all(graph.nodes.map((n) => wiki.page(n.id)));
  pages.sort((a, b) => a.id.localeCompare(b.id));
  const corpusHash = hash(
    pages.map((p) => ({
      id: p.id,
      family: p.family,
      model: p.model,
      models: p.models,
      version: p.version,
      reviewStatus: p.reviewStatus,
      stale: p.stale,
      content: p.content,
      sourceIds: p.sourceIds,
    })),
  );
  const report = {
    suite: WIKI_SUITE_VERSION,
    suiteHash: WIKI_SUITE_HASH,
    wikiCorpusHash: corpusHash,
    mode: dryRun
      ? "retrieval_only"
      : "wiki_retrieval_model_citation_validation",
    syntheticOnly: true,
    notR11Acceptance: true,
    factualValidityAssessed: false,
    modelCalls: 0,
    requestedModel: dryRun ? null : config.model,
    rows: [],
    limitations: [
      "实际 Wiki 检索链路的独立小样本自测，不替代 R11 94% 门槛。",
      "种子 Wiki 和问题为合成材料，不是真实厂家手册或实站证据。",
      "来源集合正确、引用精确率/召回率不证明回答事实正确或维修建议安全。",
      "Wiki 内容哈希记录当次实际库；库变化可能使固定预期不再适用。",
    ],
  };
  for (const item of WIKI_CASES) {
    const row = {
      caseId: item.id,
      input: item.input,
      expectedSourceIds: item.expectedSourceIds,
      status: "failed",
      citations: null,
    };
    try {
      const retrieved = await wiki.retrieve({ ...item.input, limit: 6 });
      const sources = retrieved.map((p) => ({
        sourceId: p.sourceId,
        title: p.title,
        family: p.family,
        model: p.model,
        models: p.models,
        version: p.version,
        content: p.content,
      }));
      row.retrievedSourceIds = sources.map((s) => s.sourceId);
      row.retrieval = sourceMetrics(
        item.expectedSourceIds,
        row.retrievedSourceIds,
      );
      const args = {
        config,
        action: "knowledge",
        query: item.input.query,
        workorder: {
          family: item.input.family,
          model: item.input.model,
          version: item.input.version,
        },
        sources,
      };
      row.modelInputHash = hash({
        action: args.action,
        query: args.query,
        workorder: args.workorder,
        sources,
      });
      if (dryRun) {
        row.status = "retrieval_only";
        row.modelNotRun = true;
      } else {
        report.modelCalls++;
        const response = await invokeModel(args);
        const validated = validateResult(response.result, sources);
        row.status = "ok";
        row.citations = [...new Set(validated.citations)];
        row.result = validated;
        row.citationMetrics = sourceMetrics(
          item.expectedSourceIds,
          row.citations,
        );
        row.usage = response.usage || {};
        row.requestedModel = response.requestedModel || config.model;
        row.providerReportedModel = response.providerReportedModel ?? null;
      }
    } catch (e) {
      row.failure = {
        code: [
          "TIMEOUT",
          "INVALID_RESPONSE",
          "PROVIDER_ERROR",
          "CONNECTION_FAILED",
          "MISSING_CITATIONS",
        ].includes(e?.code)
          ? e.code
          : "PIPELINE_FAILED",
        message: "检索、模型调用或引用验证失败；保留在总分母。",
      };
    }
    report.rows.push(row);
  }
  const valid = report.rows.filter((r) => r.status === "ok");
  report.summary = {
    totalCases: report.rows.length,
    failedCases: report.rows.filter((r) => r.status === "failed").length,
    modelValidatedCases: valid.length,
    retrievalExpectedCoveredCases: report.rows.filter(
      (r) => r.retrieval?.recall === 1,
    ).length,
    retrievalMacroRecall:
      report.rows.reduce((s, r) => s + (r.retrieval?.recall || 0), 0) /
      report.rows.length,
    sourceCorrectCases: valid.filter((r) => r.citationMetrics.exactSourceSet)
      .length,
    sourceCorrectness: dryRun
      ? null
      : valid.filter((r) => r.citationMetrics.exactSourceSet).length /
        report.rows.length,
    macroCitationPrecision: dryRun
      ? null
      : valid.reduce((s, r) => s + r.citationMetrics.precision, 0) /
        report.rows.length,
    macroCitationRecall: dryRun
      ? null
      : valid.reduce((s, r) => s + r.citationMetrics.recall, 0) /
        report.rows.length,
  };
  report.reportHash = hash(report);
  return report;
}
