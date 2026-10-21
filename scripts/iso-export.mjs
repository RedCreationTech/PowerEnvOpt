#!/usr/bin/env node
/**
 * iso-export.mjs — 把精密空调图导出为独立 SVG（含内嵌样式），供不启动浏览器时目检。
 * 用法：node scripts/iso-export.mjs [输出目录，默认 manual/iso]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const root = join(import.meta.dirname, "..");
const outDir = join(root, process.argv[2] || "manual/iso");
mkdirSync(outDir, { recursive: true });
const ctx = { console, Math, JSON };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["iso-kit.js", "iso-ac.js"]) vm.runInContext(readFileSync(join(root, f), "utf8"), ctx, { filename: f });
const { AcFigure } = ctx;
const MODEL = {
  series: [23.2, 24.1, 25.2, 26.6, 28.2, 29.4],
  after: [28.4, 27.1, 25.8, 24.8, 24.1, 23.8],
  threshold: 28, dpFrom: 70, dpTo: 145, dpRecovered: 74, loadFrom: 61, loadTo: 62,
};
for (const theme of ["dark", "light"]) {
  for (const [name, m] of [
    ["anomaly", { ...MODEL, index: 5 }],
    ["recovered", { ...MODEL, recovered: true }],
  ]) {
    const svg = AcFigure.buildSvg(m, { standalone: theme });
    writeFileSync(join(outDir, `hc-pac30-${name}-${theme}.svg`), svg);
    console.log("wrote", `manual/iso/hc-pac30-${name}-${theme}.svg`);
  }
}
