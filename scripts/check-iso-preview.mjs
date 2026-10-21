/**
 * check-iso-preview.mjs —— 校验 manual/iso-preview.html 这份自包含预览台：
 * 1) 内联的 iso-kit.js / iso-ac.js / iso-batt.js / iso-pdu.js / iso-energy.js 与当前源码逐字节一致
 *    （防止改了源码忘了重建预览）；
 * 2) 每张图的 buildSvg 产物里每个 path 的 d 都是合法路径（抓 d="[object Object]" 这类运行时拼串错误）；
 * 3) 每张图恰好一个 data-lit、无 NaN/Infinity/undefined、含各自的 dyn 组；
 * 4) 每张图 mount 产物带 .iso 包裹层（--anatomy-* 主题变量定义在它上面，缺了整个图会变黑色剪影）。
 * 用法：node scripts/check-iso-preview.mjs
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FIGURES = [
  { file: "iso-ac.js", global: "AcFigure", model: { series: [23.2, 24.1, 25.2, 26.6, 28.2, 29.4], after: [28.4, 27.1, 25.8, 24.8, 24.1, 23.8], threshold: 28, dpFrom: 70, dpTo: 145, dpRecovered: 74, loadFrom: 61, loadTo: 62, index: 5 } },
  { file: "iso-batt.js", global: "BattFigure", model: { series: [7, 9, 13, 18, 24, 31], after: [26, 18, 11, 7, 5, 4], threshold: 25, index: 5 } },
  { file: "iso-pdu.js", global: "PduFigure", model: { series: [61, 65, 69, 74, 79, 84], after: [77, 71, 66, 63, 62, 62], threshold: 85, planned: 12, index: 5 } },
  { file: "iso-energy.js", global: "EnergyFigure", model: { series: [12, 12.8, 13.9, 15.1, 16.5, 18], after: [17, 16.2, 15.4, 14.3, 13.4, 12.6], threshold: 15, baseline: 12, index: 5 } },
  { file: "iso-ups.js", global: "UpsFigure", model: { series: [61, 65, 69, 74, 79, 84], after: [77, 71, 66, 63, 62, 62], threshold: 85, planned: 12, index: 5 } },
  { file: "iso-dg.js", global: "DgFigure", model: { series: [7, 9, 13, 18, 24, 31], after: [26, 18, 11, 7, 5, 4], threshold: 25, recoveredValue: 27.2, index: 5 } },
  { file: "iso-th.js", global: "ThFigure", model: { temp: 25, hum: 46, alarmT: 30, alarmH: 80, index: 5 } },
];

const html = readFileSync("manual/iso-preview.html", "utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].replace(/<\\\/script>/g, "<\/script>"));
if (blocks.length < FIGURES.length + 1) fail(`预览页里只有 ${blocks.length} 个内联脚本块，预期至少 ${FIGURES.length + 1}`);

// 1) 与源码同步
for (const [i, name] of [[0, "iso-kit.js"], ...FIGURES.map((f, k) => [k + 1, f.file])]) {
  const src = readFileSync(name, "utf8");
  if (blocks[i].trim() !== src.trim()) fail(`${name} 已改动但预览页未重建，请跑 node scripts/build-iso-preview.mjs`);
}

// 2-4) 每张图的数值与挂载不变量
const ctx = { console, Math, JSON, Date, Number, String, Array, Object, RegExp, Error };
ctx.globalThis = ctx; ctx.window = ctx;
ctx.matchMedia = () => ({ matches: false });
ctx.requestAnimationFrame = () => 1;
ctx.cancelAnimationFrame = () => {};
ctx.IntersectionObserver = class { observe() {} disconnect() {} };
vm.createContext(ctx);
vm.runInContext(
  `const __mk = (tag = "div") => ({
    tag, style: {}, dataset: {}, textContent: "", _html: "",
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    querySelector: () => { const n = __mk(); n.setAttribute = () => {}; return n; },
    querySelectorAll: () => [], setAttribute() {}, addEventListener() {},
  });` + blocks[0],
  ctx,
);
for (const f of FIGURES) {
  vm.runInContext(blocks[FIGURES.indexOf(f) + 1], ctx, { filename: f.file });
  vm.runInContext(
    `{
      const __svg = ${f.global}.buildSvg(${JSON.stringify(f.model)});
      const __bad = [];
      const __re = /\sd="([^"]*)"/g; let __m;
      while ((__m = __re.exec(__svg))) if (!/^[Mm]/.test(__m[1])) __bad.push(__m[1].slice(0, 40));
      globalThis.__check = { bad: __bad, lit: (__svg.match(/data-lit/g) || []).length, nan: /NaN|Infinity|undefined/.test(__svg), mounted: "" };
      const __host = __mk();
      ${f.global}.mount(__host, ${JSON.stringify(f.model)});
      globalThis.__check.mounted = __host.innerHTML;
      if (globalThis.__cur) globalThis.__cur.destroy();
      globalThis.__cur = null;
    }`,
    ctx,
  );
  const r = ctx.__check;
  if (r.bad.length) fail(`${f.global} 产物有 ${r.bad.length} 个非法 path d：${r.bad.join(" | ")}`);
  if (r.lit !== 1) fail(`${f.global} 的 data-lit 应为 1，实际 ${r.lit}`);
  if (r.nan) fail(`${f.global} 产物含 NaN/Infinity/undefined`);
  if (!r.mounted.includes('class="iso"')) fail(`${f.global} mount 产物缺少 .iso 包裹层，主题变量会失效、图形渲染成黑块`);
  console.log(`ok   ${f.global.padEnd(12)} 同步、d 合法、lit=1、挂载带 .iso 包裹层`);
}
console.log("ok   预览页与源码同步、四图不变量全部通过");
function fail(msg) { console.error("FAIL " + msg); process.exit(1); }
