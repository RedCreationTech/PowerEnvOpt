import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConfigStore } from "../server/config.mjs";
import { invokeStructured } from "../server/ai.mjs";
import { baselineReport } from "./baseline.mjs";
import { runEvaluation } from "../server/evaluation.mjs";
if (process.argv.includes("--baseline-only")) {
  const report = baselineReport();
  const output =
    process.argv.find((x) => x.startsWith("--out="))?.slice(6) ||
    ".runtime/baseline-report.json";
  await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  await fs.writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify({ output, modelCalls: 0, metrics: report.metrics }, null, 2),
  );
} else if (!process.argv.includes("--confirm-model-calls")) {
  console.error(
    "Refusing provider calls without --confirm-model-calls. Usage: node evaluation/run.mjs --confirm-model-calls [--full] [--out=report.json]",
  );
  process.exitCode = 2;
} else {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    config = await createConfigStore(root).read();
  const report = await runEvaluation({
    config,
    invokeStructured,
    scope: process.argv.includes("--full") ? "full" : "smoke",
  });
  const output =
    process.argv.find((x) => x.startsWith("--out="))?.slice(6) ||
    path.join(root, ".runtime", "evaluation-report.json");
  await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  await fs.writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify(
      { output, status: report.acceptanceStatus, metrics: report.metrics },
      null,
      2,
    ),
  );
}
