#!/usr/bin/env node
/**
 * build-iso-kit.mjs — 从本机已安装的 anatomy 技能里生成项目内可用的 iso-kit.js。
 *
 * 为什么要在构建期复制而不是运行时 import：
 * 演示项目是无打包器的经典 script 页面，且 server.mjs 只放行白名单静态文件，
 * 所以把技能里那份「去掉 export 关键字的 ESM」（= 官方 kitScript() 的产物）落成
 * 一个普通脚本，浏览器里直接拿到 iso / slabOf / solidSvg 等全局函数。
 *
 * 用法：node scripts/build-iso-kit.mjs [--skill <anatomy 目录>]
 * 出处：github.com/wheresryan22/anatomy（MIT）。改动上游后重跑本脚本即可同步。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const i = process.argv.indexOf("--skill");
const skill =
  i > -1
    ? process.argv[i + 1]
    : join(process.env.HOME || "", ".qoder/skills/anatomy");
const kitFile = join(skill, "kit", "iso-kit.mjs");
const cssFile = join(skill, "kit", "iso.css");
if (!existsSync(kitFile)) {
  console.error(`找不到 anatomy 技能：${kitFile}`);
  console.error("先安装：git clone --depth 1 https://github.com/wheresryan22/anatomy.git ~/.qoder/skills/anatomy");
  process.exit(1);
}

const source = readFileSync(kitFile, "utf8");
// 与技能 scripts/inline-kit.mjs 的 strip() 保持一致
const body = source.replace(/^export /gm, "");
const css = existsSync(cssFile) ? readFileSync(cssFile, "utf8") : "";
const version = (() => {
  try {
    return readFileSync(join(skill, "CHANGELOG.md"), "utf8").match(/^##\s+\[?([0-9][^\s\]]*)\]?/m)?.[1] || "unknown";
  } catch {
    return "unknown";
  }
})();

const banner = `/*
 * iso-kit.js —— 等距 SVG 绘图内核，由 scripts/build-iso-kit.mjs 自动生成，请勿手改。
 *
 * 来源：anatomy 技能 v${version}（github.com/wheresryan22/anatomy，MIT）。
 * 生成方式：去掉 kit/iso-kit.mjs 的顶层 export 关键字（等价于技能自己的 kitScript()），
 * 这样经典 <script> 里直接得到 iso/slabOf/extrude/solidSvg/fitProjection 等全局函数。
 * 同步上游：node scripts/build-iso-kit.mjs
 */
`;

writeFileSync(join(root, "iso-kit.js"), banner + body);
if (css) writeFileSync(join(root, "iso-kit.css"), `/* 同源于 anatomy 技能 kit/iso.css（MIT），由 scripts/build-iso-kit.mjs 生成 */\n${css}`);
console.log(
  `wrote iso-kit.js (${body.length} 字节, 来自 anatomy v${version})${css ? " + iso-kit.css" : ""}`,
);
