import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WikiStore } from "../server/wiki.mjs";
import { invokeModel } from "../server/ai.mjs";
import { createConfigStore } from "../server/config.mjs";
import { runWikiEvaluation } from "./wiki-evaluation.mjs";
const dryRun = process.argv.includes("--dry-run");
if (!dryRun && !process.argv.includes("--confirm-model-calls")) {
  console.error(
    "Use --dry-run for retrieval only, or --confirm-model-calls to invoke the configured model.",
  );
  process.exitCode = 2;
} else {
  const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    wiki = new WikiStore({ rootDir });
  const config = dryRun ? {} : await createConfigStore(rootDir).read();
  const report = await runWikiEvaluation({ wiki, config, invokeModel, dryRun });
  const output =
    process.argv.find((x) => x.startsWith("--out="))?.slice(6) ||
    path.join(rootDir, ".runtime", "wiki-e2e-report.json");
  await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  await fs.writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify(
      {
        output,
        mode: report.mode,
        modelCalls: report.modelCalls,
        wikiCorpusHash: report.wikiCorpusHash,
        summary: report.summary,
      },
      null,
      2,
    ),
  );
}
