// Export reproducible evaluation data. No provider requests or credentials are read.
import fs from "node:fs/promises";
import path from "node:path";
import { DATASET, DATASET_HASH, VERSION, SEED, hash } from "./dataset.mjs";
import { SPEC, PROMPT_VERSION, messagesFor } from "../server/evaluation.mjs";
import {
  WIKI_CASES,
  WIKI_SUITE_VERSION,
  WIKI_SUITE_HASH,
} from "./wiki-dataset.mjs";
const output = path.resolve(
  process.argv.find((value) => value.startsWith("--out="))?.slice(6) ||
    ".runtime/exported-evaluation",
);
await fs.mkdir(output, { recursive: true, mode: 0o700 });
const inputs = DATASET.map((test) => ({
  caseId: test.id,
  task: test.task,
  input: test.input,
}));
const gold = DATASET.map((test) => ({
  caseId: test.id,
  task: test.task,
  expected: test.expected,
}));
const catalog = DATASET.map((test) => ({
  caseId: test.id,
  task: test.task,
  scenario: test.scenario,
  metric: SPEC[test.task].metric,
  horizon: test.input.horizon || null,
  historyPoints: test.input.history?.length || 0,
  candidateCount: test.input.candidates?.length || 0,
  syntheticOnly: true,
}));
const files = {
  "wiki-inputs.jsonl":
    WIKI_CASES.map((test) =>
      JSON.stringify({ caseId: test.id, input: test.input }),
    ).join("\n") + "\n",
  "wiki-gold.jsonl":
    WIKI_CASES.map((test) =>
      JSON.stringify({
        caseId: test.id,
        expectedSourceIds: test.expectedSourceIds,
      }),
    ).join("\n") + "\n",
  "inputs.jsonl":
    inputs.map((value) => JSON.stringify(value)).join("\n") + "\n",
  "gold.jsonl": gold.map((value) => JSON.stringify(value)).join("\n") + "\n",
  "case-catalog.json": JSON.stringify(catalog, null, 2) + "\n",
  "case-catalog.csv":
    [
      "caseId,task,scenario,metric,horizon,historyPoints,candidateCount",
      ...catalog.map((value) =>
        [
          value.caseId,
          value.task,
          value.scenario,
          value.metric,
          value.horizon ?? "",
          value.historyPoints,
          value.candidateCount,
        ]
          .map((cell) => '"' + String(cell).replaceAll('"', '""') + '"')
          .join(","),
      ),
    ].join("\n") + "\n",
  "README.txt":
    "PowerEnvOpt 冻结合成数据 v2\ninputs.jsonl 仅测试输入；gold.jsonl 是评分答案，禁止传给模型、索引进 Wiki 或并入提示词。\ncase-catalog 是样本和覆盖目录，不是供应商成绩。全部数据为原创合成，不能替代现场验收。\n使用应用独立评测会自动执行输入投影及评分隔离；不要手工把整个目录上传给模型。\nR08暂定序列内合并R²>0.97；R09暂定MAE/20°C<5%；R10 WAPE<5%；R11适用知识元组准确率>=94%。\n基线与真实模型结果必须分列。已知计划调整值是事前假设，不代表预测未知突发故障。\n",
};
for (const [name, content] of Object.entries(files))
  await fs.writeFile(path.join(output, name), content, { mode: 0o600 });
const manifest = {
  version: VERSION,
  seed: SEED,
  datasetHash: DATASET_HASH,
  totalCases: DATASET.length,
  syntheticOnly: true,
  promptVersion: PROMPT_VERSION,
  promptHash: hash(DATASET.map(messagesFor)),
  metrics: SPEC,
  wikiSuite: {
    version: WIKI_SUITE_VERSION,
    sha256: WIKI_SUITE_HASH,
    totalCases: WIKI_CASES.length,
    notR11Acceptance: true,
  },
  files: Object.fromEntries(
    Object.entries(files).map(([name, content]) => [
      name,
      { sha256: hash(content), bytes: Buffer.byteLength(content) },
    ]),
  ),
  warning:
    "gold.jsonl is scorer-only and must never be included in model context.",
};
await fs.writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(
  JSON.stringify(
    {
      output,
      totalCases: DATASET.length,
      datasetHash: DATASET_HASH,
      modelCalls: 0,
    },
    null,
    2,
  ),
);
