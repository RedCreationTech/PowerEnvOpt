#!/usr/bin/env node
/**
 * build-iso-preview.mjs — 生成 manual/iso-preview.html：四张设备等距机理图的本地预览台
 * （S1 精密空调 / S2 蓄电池组 / S3 配电容量 / S4 空调能耗，数据全部取自 workflows.js 的 CASES）。
 *
 * 用途：在浏览器里核对造型、两种状态与逐窗口动画；manual/ 已在 .gitignore 内，属开发期产物。
 * 用法：node scripts/build-iso-preview.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const kit = readFileSync(join(root, "iso-kit.css"), "utf8");
const inline = (f) => readFileSync(join(root, f), "utf8").replace(/<\/script>/g, "<\\/script>");

// 与 workflows.js CASES 保持一致（预览台不引 workflows.js，避免内联整个场景引擎）
const CASES = {
  cooling: {
    label: "S1 · 精密空调",
    fig: "AcFigure",
    model: { series: [23.2, 24.1, 25.2, 26.6, 28.2, 29.4], after: [28.4, 27.1, 25.8, 24.8, 24.1, 23.8], threshold: 28, dpFrom: 70, dpTo: 145, dpRecovered: 74, loadFrom: 61, loadTo: 62 },
    note: "滤网压差 70→145 Pa，进风 23.2→29.4 °C（警戒线 28），复测 23.8 °C / 74 Pa；IT 负载 61%→62%",
  },
  battery: {
    label: "S2 · 蓄电池组",
    fig: "BattFigure",
    model: { series: [7, 9, 13, 18, 24, 31], after: [26, 18, 11, 7, 5, 4], threshold: 25 },
    note: "单体内阻偏离 7%→31%（阈值 25%），维护后回到 4%；窗口：过去 6 周每周同工况采样",
  },
  capacity: {
    label: "S3 · 配电容量",
    fig: "PduFigure",
    model: { series: [61, 65, 69, 74, 79, 84], after: [77, 71, 66, 63, 62, 62], threshold: 85, planned: 12 },
    note: "B 支路峰值负载率 61%→84%（规划线 85%），计划新增 +12pp 将达 96%；调整后 62%",
  },
  energy: {
    label: "S4 · 空调能耗",
    fig: "EnergyFigure",
    model: { series: [12, 12.8, 13.9, 15.1, 16.5, 18], after: [17, 16.2, 15.4, 14.3, 13.4, 12.6], threshold: 15, baseline: 12 },
    note: "同负载（IT 62±1%、室外 28±0.5°C）输入功率 12→18 kW，偏离基线 +50%；优化复测 12.6 kW",
  },
};

const html = `<!doctype html>
<html lang="zh-CN" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <title>机理示意 · 四设备预览</title>
    <style>
      ${kit}
      body { margin: 0; padding: 24px; background: var(--anatomy-bg, #101b30); color: #dce5f2; font: 13px/1.6 ui-sans-serif, system-ui; }
      body[data-theme="light"] { background: #f4f6fa; color: #1d2735; }
      .bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
      .bar button { padding: 7px 12px; border-radius: 8px; border: 1px solid #5b6c88; background: transparent; color: inherit; cursor: pointer; }
      .bar button[aria-pressed="true"] { background: #2f6df6; border-color: #2f6df6; color: #fff; }
      .plate { max-width: 700px; margin: 0 auto; border: 1px solid #34405a; border-radius: 14px; padding: 14px; background: var(--anatomy-face, #16233c); }
      body[data-theme="light"] .plate { border-color: #ccd5e4; }
      .note { max-width: 700px; margin: 14px auto 0; color: #93a3bd; }
    </style>
  </head>
  <body class="iso">
    <div class="bar" id="cases"></div>
    <div class="bar" id="states"></div>
    <div class="plate"><div id="fig"></div></div>
    <p class="note" id="note"></p>
    <!-- 自包含：file:// 页面跨目录加载脚本会被拦，这里直接把 kit 与图形内联 -->
    <script>${inline("iso-kit.js")}</script>
    <script>${inline("iso-ac.js")}</script>
    <script>${inline("iso-batt.js")}</script>
    <script>${inline("iso-pdu.js")}</script>
    <script>${inline("iso-energy.js")}</script>
    <script>
      const CASES = ${JSON.stringify(CASES)};
      const fig = document.getElementById("fig");
      const note = document.getElementById("note");
      let ctrl = null, caseId = "cooling", state = { index: 5 };
      const mkBtn = (host, text, on, kind) => {
        const b = document.createElement("button");
        b.textContent = text;
        if (kind) b.dataset.state = kind;
        b.onclick = on;
        host.appendChild(b);
        return b;
      };
      const render = () => {
        const c = CASES[caseId];
        const m = { ...c.model, index: state.index, recovered: !!state.recovered };
        if (ctrl) { ctrl.destroy(); ctrl = null; }
        ctrl = globalThis[c.fig].mount(fig, m);
        note.textContent = c.note + "。风条/流条数量为演示口径，不是实测风量/电流。";
        document.querySelectorAll("#cases button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.case === caseId)));
        document.querySelectorAll("#states button[data-state]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.state === (state.recovered ? "复测通过" : "T" + (state.index + 1)))));
      };
      for (const [id, c] of Object.entries(CASES)) {
        mkBtn(document.getElementById("cases"), c.label, () => { caseId = id; state = { index: 5 }; rebuildStates(); render(); }, null).dataset.case = id;
      }
      mkBtn(document.getElementById("cases"), "亮色", () => { document.body.dataset.theme = document.body.dataset.theme === "light" ? "dark" : "light"; });
      function rebuildStates() {
        const host = document.getElementById("states");
        host.innerHTML = "";
        const n = CASES[caseId].model.series.length;
        for (let i = 0; i < n; i++) mkBtn(host, "T" + (i + 1), () => { state = { index: i }; render(); }, "T" + (i + 1));
        mkBtn(host, "复测通过", () => { state = { index: 5, recovered: true }; render(); }, "复测通过");
      }
      rebuildStates();
      render();
    </script>
  </body>
</html>
`;
mkdirSync(join(root, "manual"), { recursive: true });
const out = join(root, "manual", "iso-preview.html");
writeFileSync(out, html);
console.log("wrote", out.replace(root + "/", ""), existsSync(out) ? "" : "");
