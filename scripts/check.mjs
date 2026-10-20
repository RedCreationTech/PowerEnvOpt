import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = ["app.js", "workflows.js", "ai-ui.js", "server.mjs"];
for (const dir of ["server", "evaluation", "scripts"]) {
  for (const file of await fs.readdir(path.join(root, dir))) {
    if (file.endsWith(".mjs")) files.push(`${dir}/${file}`);
  }
}
for (const file of files) {
  const result = spawnSync(
    process.execPath,
    ["--check", path.join(root, file)],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(
  `Syntax verified: ${files.length} application/backend/evaluation modules.`,
);
