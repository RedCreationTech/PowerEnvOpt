/**
 * check-iso-dom.mjs —— 用桩 DOM 在 Node 里跑 AcFigure.mount / set / destroy，
 * 抓 TDZ、未定义引用、生命周期泄漏这类只在浏览器里才暴露的错误，省掉一次浏览器往返。
 * 用法：node scripts/check-iso-dom.mjs
 */
// 桩 DOM：只为把 mount() 跑到真实浏览器之外，抓 TDZ / 未定义这类错误
import { readFileSync } from "node:fs";
import vm from "node:vm";
const mk = (tag = "div") => {
  const el = {
    tag, _html: "", children: [], style: {}, dataset: {}, textContent: "",
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    querySelector: (sel) => { const n = mk(); n.setAttribute = () => {}; return n; },
    querySelectorAll: () => [], setAttribute() {}, addEventListener() {}, appendChild() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 520, height: 540 }),
  };
  return el;
};
const ctx = { console, Math, JSON, Date, Number, String, Array, Object, RegExp, Error };
vm.createContext(ctx);
ctx.globalThis = ctx; ctx.window = ctx;
ctx.document = { createElement: mk, querySelector: () => mk(), body: mk() };
ctx.matchMedia = () => ({ matches: false });
ctx.requestAnimationFrame = (fn) => { ctx.__frames = (ctx.__frames || 0) + 1; if (ctx.__frames < 5) fn(performance?.now?.() ?? Date.now()); return 1; };
ctx.cancelAnimationFrame = () => {};
ctx.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() { this.cb([{ isIntersecting: true }]); } disconnect() {} };
for (const f of ["iso-kit.js", "iso-ac.js"]) vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f });
const host = mk();
const ctrl = ctx.AcFigure.mount(host, { series: [23.2, 24.1, 25.2, 26.6, 28.2, 29.4], after: [28.4, 23.8], threshold: 28, dpFrom: 70, dpTo: 145, dpRecovered: 74, index: 5 });
ctrl.set({ ...ctrl && {}, series: [23.2, 29.4], after: [28.4, 23.8], recovered: true, threshold: 28, dpFrom: 70, dpTo: 145, dpRecovered: 74 });
ctrl.destroy();
console.log("mount/set/destroy 全部通过，无 TDZ 或未定义引用");
