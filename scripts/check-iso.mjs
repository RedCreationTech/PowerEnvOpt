#!/usr/bin/env node
/**
 * check-iso.mjs —— 在 Node 里加载 iso-kit.js + iso-ac.js，对图形做纯数值自检，不开浏览器。
 *
 * 检查项：语法可加载、两种状态都能出图、输出里无 NaN/Infinity、
 * 气流条数随压差单调递减、指针读数被夹在量程内、零件与路径数量在预算内。
 * 用法：node scripts/check-iso.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const root = join(import.meta.dirname, "..");
const ctx = { console, Math, JSON, globalThis: null };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["iso-kit.js", "iso-ac.js"]) {
  try {
    vm.runInContext(readFileSync(join(root, f), "utf8"), ctx, { filename: f });
  } catch (e) {
    console.error(`加载 ${f} 失败：`, e.message);
    process.exit(1);
  }
}
const { AcFigure } = ctx;
if (!AcFigure) {
  console.error("iso-ac.js 没有导出 AcFigure");
  process.exit(1);
}

const MODEL = {
  series: [23.2, 24.1, 25.2, 26.6, 28.2, 29.4],
  after: [28.4, 27.1, 25.8, 24.8, 24.1, 23.8],
  threshold: 28,
  dpFrom: 70,
  dpTo: 145,
  dpRecovered: 74,
  loadFrom: 61,
  loadTo: 62,
  window: "过去 60 分钟 / 10 分钟聚合",
};

const fails = [];
const ok = (cond, msg) => {
  if (!cond) fails.push(msg);
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}`);
};

// 1. 逐帧读数
const steps = [];
for (let i = 0; i < MODEL.series.length; i++) {
  const d = AcFigure.derive({ ...MODEL, index: i });
  steps.push(d);
  for (const key of ["temp", "dp", "dust", "share", "load", "streams", "threshold"]) {
    if (!Number.isFinite(d[key])) fails.push(`index ${i} 的 ${key} 不是有限数：${d[key]}`);
  }
}
ok(steps.length === 6, "异常窗口 6 个采样点全部可推导");
ok(
  steps.every((s, i) => i === 0 || s.dp >= steps[i - 1].dp),
  "压差随窗口单调不降",
);
ok(
  steps.every((s, i) => i === 0 || s.streams <= steps[i - 1].streams) && steps.every((s) => s.streams >= 2),
  "气流条数随压差单调不增",
);
ok(steps[0].streams === 6 && steps.at(-1).streams < 6, `首帧满量 6 条、末帧收到 ${steps.at(-1).streams} 条`);
ok(steps.at(-1).temp === 29.4 && steps.at(-1).over === true, "末帧读到 29.4 °C 且判为超警戒 28 °C");
const rec = AcFigure.derive({ ...MODEL, recovered: true });
ok(Math.abs(rec.dp - 74) < 1e-9 && Math.abs(rec.temp - 23.8) < 1e-9, `复测态读 ${rec.temp} °C / ${rec.dp} Pa（与场景 outcome 一致）`);
ok(rec.streams === 6 && rec.over === false, "复测态气流回到 6 条且不再超警戒");

// 2. 出图
for (const [name, m] of [
  ["异常末帧", { ...MODEL, index: 5 }],
  ["复测通过", { ...MODEL, recovered: true }],
]) {
  const svg = AcFigure.buildSvg(m);
  ok(svg.includes("<svg"), `${name}：产出 <svg>`);
  const bad = svg.match(/NaN|Infinity|undefined/);
  ok(!bad, `${name}：输出无 NaN/Infinity/undefined${bad ? `（首个：${bad[0]}）` : ""}`);
  const paths = (svg.match(/<path/g) || []).length;
  const dots = (svg.match(/<circle|\.iso-dots/g) || []).length;
  ok(paths > 120 && paths < 1400, `${name}：path 数 ${paths}（Figure 档预算内）`);
  ok(dots > 0, `${name}：含螺钉/端点等点元 ${dots} 处`);
  const sansDisplay = svg.replace(/<g data-dyn="display">[\s\S]*?<\/g>/, "");
  ok(!/<text/.test(sansDisplay), `${name}：图形内不出现文字（数码管显示窗除外，文字只在设备屏幕与卡片里）`);
  ok((svg.match(/data-lit/g) || []).length === 1, `${name}：恰好一个 lit 主体（滤网）`);
  ok((svg.match(/data-stream="/g) || []).length === 6, `${name}：6 组风条静态存在，运行时只切可见性`);
  ok(/data-dyn="dust"/.test(svg) && /data-dyn="needle-dp"/.test(svg) && /data-dyn="needle-temp"/.test(svg), `${name}：积灰与两只指针各自成组，可只写属性`);
  console.log(`     ${name}：${(svg.length / 1024).toFixed(1)} KB，lit 组 ${(svg.match(/data-lit/g) || []).length} 处`);
}

// 2b. 取景：所有内容必须落在 viewBox 内（±2），且不要占满到贴边
for (const [name, m] of [["异常末帧", { ...MODEL, index: 5 }], ["复测通过", { ...MODEL, recovered: true }], ["首帧", { ...MODEL, index: 0 }]]) {
  const svg = AcFigure.buildSvg(m);
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  const eat = (X, Y, R = 0) => { if (X - R < a) a = X - R; if (X + R > b) b = X + R; if (Y - R < c) c = Y - R; if (Y + R > d) d = Y + R; };
  for (const x of svg.matchAll(/([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)/g)) eat(+x[2], +x[3]);
  for (const x of svg.matchAll(/<circle[^>]*cx="(-?[\d.]+)"[^>]*cy="(-?[\d.]+)"[^>]*r="([\d.]+)"/g)) eat(+x[1], +x[2], +x[3]);
  const out = [];
  if (a < -2) out.push(`左 ${a.toFixed(0)}`);
  if (b > AcFigure.width + 2) out.push(`右 ${(b - AcFigure.width).toFixed(0)}`);
  if (c < -2) out.push(`上 ${c.toFixed(0)}`);
  if (d > AcFigure.height + 2) out.push(`下 ${(d - AcFigure.height).toFixed(0)}`);
  ok(!out.length, `${name}：取景在画面内${out.length ? `（出界：${out.join("、")}）` : ""}`);
  const w = ((b - a) / AcFigure.width) * 100, h = ((d - c) / AcFigure.height) * 100;
  ok(w > 45 && w < 98 && h > 45 && h < 98, `${name}：占画面 宽 ${w.toFixed(0)}% 高 ${h.toFixed(0)}%`);
}

// 2c. 输出里不能混进对象，且必须带 .iso 主题层
for (const [name, m] of [["异常末帧", { ...MODEL, index: 5 }]]) {
  const svg = AcFigure.buildSvg(m);
  ok(!svg.includes("[object Object]"), `${name}：无 [object Object]（coil 等返回对象的 helper 必须拆开用）`);
  const fake = () => ({ setAttribute() {}, style: {}, querySelector: fake, querySelectorAll: () => [] });
  const host = { innerHTML: "", querySelector: fake, querySelectorAll: () => [] };
  // 图形跑在 vm context 里，浏览器全局必须挂在 ctx 上（挂 main-realm 的 globalThis 它看不见）
  ctx.IntersectionObserver = class { observe() {} disconnect() {} };
  ctx.requestAnimationFrame = () => 1;
  ctx.cancelAnimationFrame = () => {};
  ctx.matchMedia = () => ({ matches: true });
  AcFigure.mount(host, m).destroy();
  ok(/class="iso" data-theme="light"/.test(host.innerHTML), `${name}：挂载结果带 .iso 主题层（缺了会全黑）`);
  ok(/<svg/.test(host.innerHTML) && /data-stream="/.test(host.innerHTML) && /data-readout/.test(host.innerHTML),
    `${name}：挂载产物含 svg、风条组与读数节点`);
}

// 3. 读数文案
ok(AcFigure.readout({ ...MODEL, index: 5 }).includes("145 Pa"), "读数含真实压差端点 145 Pa");
ok(AcFigure.readout({ ...MODEL, index: 5 }).includes("29.4"), "读数含真实温度末点 29.4");

console.log(fails.length ? `\n${fails.length} 项未通过` : "\n全部通过");
process.exit(fails.length ? 1 : 0);
