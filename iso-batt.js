/*
 * iso-batt.js —— UPS 蓄电池柜内阻监测示意机理图（anatomy 技能风格，纯 SVG，无 WebGL）。
 *
 * 造型：UPS 蓄电池柜 —— 带脚轮的落地柜，正面上部敞开可见 2 层×8 只电池单体
 * （电池罐：prismX 方罐 + 中盖 + 正负极柱小圆柱 + 提手缝）；前排腾出的一只「被测单体」
 * 抽出柜外，由台式内阻夹具测量：小底座 + 两根带弹簧线的探针夹到极柱 + 旁边立一只
 * 圆表盘（0–40% 刻度，225° 表盘，红色警戒弧从 25% 阈值处起）。
 *
 * 一句话机理：同组单体里最劣化的一只被抽出柜外，夹具探针夹住它的正负极柱读出内阻偏离 ——
 * 偏离越大表针越高、单体上方的热气纹越明显；复测恢复后针回落、热纹消失。
 *
 * 图里每个数字都来自调用方传入的同一份场景模型（workflows.js 的 CASES.battery）：
 * 内阻偏离序列、复测序列、警戒阈值、当前帧序号与是否复测都由入参给，本文件不自带演示数值。
 *
 * 性能约定：静态图只在挂载时生成一次；换状态时只写表针的 d、显示屏 text、
 * 告警灯 opacity、热气纹组的 opacity 和读数文本 —— 不在每帧重建整段 SVG。
 *
 * 依赖 iso-kit.js / iso-kit.css（经典脚本与全局样式）。用法：
 *   BattFigure.mount(container, model) → 控制器（.set(model) 换状态，.destroy() 卸载）
 *   BattFigure.buildSvg(model)         → 整段 <svg> 字符串（Node 自检与静态导出用）
 */
(function (global) {
  const WIDTH = 520;
  const HEIGHT = 540;

  // —— 世界坐标：x 向右，y 向后，z 向上；1 单位 ≈ 1 cm ——
  const CAB = { x: -46, y: -28, w: 92, d: 56, r: 4 };
  const LEFT = CAB.x, RIGHT = CAB.x + CAB.w, FRONT = CAB.y + CAB.d;
  const PLATE = { x: -54, y: -34, w: 108, d: 72, r: 3 };
  const PLATE_H = 8;
  const FOOT_H = 6;
  const Z_BAY0 = 64; // 敞开仓下沿（Deck 64..68）
  const ROW0_Z = 68; // 第一层单体 68..104
  const SHELF_Z = 104, SHELF_H = 3.5; // 中隔板 104..107.5
  const ROW1_Z = 107.5; // 第二层单体 107.5..143.5
  const Z_TOP = 143.5, HEADER_H = 13.5; // 顶盖 143.5..157
  const CELL = { w: 9, d: 26, h: 36 };
  const RANGE = 40; // 表盘量程 0–40 %
  const MC = { x0: -19, x1: -10, y0: 40, y1: 66, z0: 68, z1: 104 }; // 被测单体（抽出柜外）
  const TRAY = { x: -24, y: 24, w: 60, d: 54, r: 2 }; // 抽出托盘（y 24..78，面高 68）
  const BASE = { x0: -20, x1: -5, y0: 66, y1: 74 }; // 夹具底座（托盘前区）
  const POST_Y = 70; // 探针立柱所在 y
  const TU = [MC.x0 + 1.8, MC.x1 - 1.8]; // 被测单体正负极柱 x（右正左负）
  const G = { x0: 8, x1: 32, y0: 60, y1: 68, z0: 72, z1: 96 }; // 表盘外壳
  const G_C = [(G.x0 + G.x1) / 2, G.y1, (G.z0 + G.z1) / 2]; // 表盘圆心（面朝 +y）
  const GAUGE_R = 9.5;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /**
   * 演示口径：dev 取 live[idx]（recovered 时取复测序列末值）；
   * over = dev > threshold；热气纹强度随偏离线性增强，10% 以下不可见。
   */
  function derive(m) {
    const series = m.series || [];
    const after = m.after || [];
    const idx = clamp(m.index == null ? Math.max(0, series.length - 1) : m.index, 0, Math.max(0, series.length - 1));
    const dev = m.recovered && after.length ? after[after.length - 1] : (series[idx] ?? series.at(-1) ?? 0);
    const threshold = m.threshold ?? 25;
    return {
      dev,
      threshold,
      recovered: !!m.recovered,
      over: dev > threshold,
      heat: clamp((dev - 10) / 22, 0, 1),
    };
  }

  // 取景用两遍法：先按临时投影画一遍，再从真实产出的坐标里回收包围盒重画。
  const CAMERA = { pad: 22, azimuth: 40, elevation: 33 };
  let P = fitProjection(
    [
      ...boxCorners(PLATE, -PLATE_H - FOOT_H - 1, 0),
      ...boxCorners(CAB, 0, Z_TOP + HEADER_H),
      [-24, 78, 0], [36, 78, 68], [-14.5, 66, 130], [33, 68, 98],
    ],
    WIDTH,
    HEIGHT,
    CAMERA,
  );
  const refit = (svg) => {
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    const eat = (x, y, r = 0) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x - r < minx) minx = x - r; if (x + r > maxx) maxx = x + r;
      if (y - r < miny) miny = y - r; if (y + r > maxy) maxy = y + r;
    };
    for (const m of svg.matchAll(/([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)/g)) eat(+m[2], +m[3]);
    for (const m of svg.matchAll(/<circle[^>]*cx="(-?[\d.]+)"[^>]*cy="(-?[\d.]+)"[^>]*r="([\d.]+)"/g)) eat(+m[1], +m[2], +m[3]);
    if (maxx <= minx || maxy <= miny) return;
    const r = Math.min((WIDTH - CAMERA.pad * 2) / (maxx - minx), (HEIGHT - CAMERA.pad * 2) / (maxy - miny));
    const cx = (minx + maxx) / 2 - P.origin[0];
    const cy = (miny + maxy) / 2 - P.origin[1];
    P = { ...P, scale: P.scale * r, origin: [WIDTH / 2 - r * cx, HEIGHT / 2 - r * cy] };
  };

  const at = (p) => iso(p, P);
  const S = (paths, style) => solidSvg(paths, style);
  const L = (d, style) => lineSvg(d, style);
  const D = (pts, style) => dotsSvg(pts, style);
  const seg = (a, b) => segment(a, b, P);
  const ringSide = (c, r, axis, steps) => sideRing(c, r, axis, P, steps || 28);
  const byDepth = (list) =>
    [...list].sort((a, b) => depthOf([a[0], a[1], a[2] ?? 0], P) - depthOf([b[0], b[1], b[2] ?? 0], P));
  const dyn = (name, inner) => `<g data-dyn="${name}">${inner}</g>`;
  const cellX = (i) => -41 + i * ((82 - CELL.w) / 7);

  /**
   * 沿 x 轴扫掠的长方体（立式板件，主视面朝 +x）。
   */
  function prismX(x0, x1, y0, y1, z0, z1) {
    const V = (x, y, z) => iso([x, y, z], P);
    const all = [V(x0,y0,z0), V(x1,y0,z0), V(x0,y1,z0), V(x1,y1,z0), V(x0,y0,z1), V(x1,y0,z1), V(x0,y1,z1), V(x1,y1,z1)];
    const hull = pathOf(convexHull(all), true);
    const top = pathOf(oriented([V(x1,y0,z0), V(x1,y1,z0), V(x1,y1,z1), V(x1,y0,z1)]), true);
    const shades = [];
    shades[2] = pathOf(oriented([V(x0,y1,z0), V(x1,y1,z0), V(x1,y1,z1), V(x0,y1,z1)]), true);
    shades[1] = pathOf(oriented([V(x0,y0,z1), V(x1,y0,z1), V(x1,y1,z1), V(x0,y1,z1)]), true);
    const crease =
      pathOf([V(x1,y1,z1), V(x1,y1,z0)], false) + pathOf([V(x1,y1,z1), V(x0,y1,z1)], false) + pathOf([V(x1,y1,z1), V(x1,y0,z1)], false);
    return { fill: hull, shades, top, crease, outline: hull };
  }

  /**
   * 沿 y 轴扫掠的长方体（主视面朝 +y，正面件用）。
   * 与 prismX 镜像：top = 前(+y)主视面，shades = 顶面与 +x 端面。
   */
  function prismY(y0, y1, x0, x1, z0, z1) {
    const V = (x, y, z) => iso([x, y, z], P);
    const all = [V(x0,y0,z0), V(x1,y0,z0), V(x0,y1,z0), V(x1,y1,z0), V(x0,y0,z1), V(x1,y0,z1), V(x0,y1,z1), V(x1,y1,z1)];
    const hull = pathOf(convexHull(all), true);
    const top = pathOf(oriented([V(x0,y1,z0), V(x1,y1,z0), V(x1,y1,z1), V(x0,y1,z1)]), true);
    const shades = [];
    shades[2] = pathOf(oriented([V(x1,y0,z0), V(x1,y1,z0), V(x1,y1,z1), V(x1,y0,z1)]), true);
    shades[1] = pathOf(oriented([V(x0,y0,z1), V(x1,y0,z1), V(x1,y1,z1), V(x0,y1,z1)]), true);
    const crease =
      pathOf([V(x1,y1,z1), V(x1,y1,z0)], false) + pathOf([V(x1,y1,z1), V(x0,y1,z1)], false) + pathOf([V(x1,y1,z1), V(x1,y0,z1)], false);
    return { fill: hull, shades, top, crease, outline: hull };
  }

  // ————————————————————————————— 底盘与脚轮 —————————————————————————————
  function base() {
    const out = [`<path class="iso-halo" d="${haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
    for (const [x, y] of byDepth(corners(PLATE, 14).map((c) => [c[0], c[1], 0]))) {
      out.push(S(cylinder(x, y, 4.8, -PLATE_H - FOOT_H, 2.2, P, 22), { tone: "lo" }));
      out.push(S(cylinder(x, y, 2.8, -PLATE_H - FOOT_H + 2.2, FOOT_H - 1.8, P, 18), { tone: "lo" }));
    }
    out.push(S(slabOf(PLATE, -PLATE_H, PLATE_H, P, 6, 1), { tone: "mid" }));
    out.push(L(planOutline(insetPlan(PLATE, 4.5), 0, P), { tone: "faint" }));
    const sc = corners(PLATE, 8);
    out.push(L(sc.map((c) => ring(c[0], c[1], 1.8, 0, P, 14)).join(""), { tone: "lo" }));
    out.push(D(sc.map((c) => at([c[0], c[1], 0])), { size: 0.45 }));
    return out.join("");
  }

  // ——————————— 柜体：下部封闭舱 + 正面上部敞开仓（背板/侧板/立柱/隔板/顶盖） ———————————
  function cabinet() {
    const out = [];
    out.push(S(slabOf(CAB, 0, Z_BAY0, P, 8, 1.2), { tone: "mid" }));
    // 下部正脸：踢脚板 + 通风格栅 + 中缝 + 上沿横梁 + 门把手 + 铭牌
    out.push(S(prismY(FRONT - 1.2, FRONT + 1.4, LEFT + 2, RIGHT - 2, 1.5, 9), { tone: "hi" }));
    for (const z of [16, 24, 32]) {
      out.push(S(prismY(FRONT - 0.9, FRONT + 0.4, LEFT + 7, -8, z, z + 3.4), { tone: "lo", crease: "none" }));
      out.push(S(prismY(FRONT - 0.9, FRONT + 0.4, 8, RIGHT - 7, z, z + 3.4), { tone: "lo", crease: "none" }));
    }
    out.push(L(seg([0, FRONT + 0.6, 9], [0, FRONT + 0.6, 58]), { tone: "lo" }));
    out.push(L(seg([-7, FRONT + 0.6, 26], [-7, FRONT + 0.6, 42]), { tone: "lo" }));
    out.push(S(prismX(4, 7, FRONT, FRONT + 2.6, 26, 42), { tone: "hi" }));
    out.push(S(prismY(FRONT - 1, FRONT + 0.6, LEFT, RIGHT, 58, Z_BAY0), { tone: "mid" }));
    // 铭牌：面板 + 三条 rule 线 + 角钉（无文字）
    out.push(S(prismY(FRONT - 0.2, FRONT + 0.7, LEFT + 7, LEFT + 25, 42, 52), { tone: "lo", crease: "none" }));
    out.push(L([0.32, 0.55, 0.78].map((t) => seg([LEFT + 9, FRONT + 0.8, 42 + 10 * t], [LEFT + 23, FRONT + 0.8, 42 + 10 * t])).join(""), { tone: "mid" }));
    out.push(D([
      at([LEFT + 8.4, FRONT + 0.8, 42.8]), at([LEFT + 23.6, FRONT + 0.8, 42.8]),
      at([LEFT + 8.4, FRONT + 0.8, 51.2]), at([LEFT + 23.6, FRONT + 0.8, 51.2]),
    ], { size: 0.45 }));
    return out.join("");
  }

  function rack() {
    const out = [];
    // 右山墙整板（0..157，正对相机的侧面）
    out.push(S(prismX(RIGHT - 2.4, RIGHT, CAB.y, FRONT, 0, Z_TOP + HEADER_H), { tone: "mid" }));
    // 仓内背板与左侧板（薄板，tone lo）
    out.push(S(prismY(-4.6, -2, LEFT + 2.4, RIGHT - 2.4, Z_BAY0, Z_TOP), { tone: "lo", crease: "none" }));
    out.push(S(prismX(LEFT + 0.8, LEFT + 3, -4, FRONT - 0.5, Z_BAY0, Z_TOP), { tone: "lo", crease: "none" }));
    // 前左立柱
    out.push(S(prismY(FRONT - 2.6, FRONT, LEFT, LEFT + 2.8, Z_BAY0, Z_TOP), { tone: "mid" }));
    // 仓底 Deck 与中隔板
    out.push(S(slabOf({ x: LEFT + 2, y: -4, w: CAB.w - 4, d: 32, r: 1 }, Z_BAY0, 4, P, 3, 0.4), { tone: "hi" }));
    out.push(S(slabOf({ x: LEFT + 3, y: -4, w: CAB.w - 6, d: 31.5, r: 1 }, SHELF_Z, SHELF_H, P, 3, 0.4), { tone: "mid" }));
    // 顶盖
    out.push(S(slabOf(CAB, Z_TOP, HEADER_H, P, 8, 1), { tone: "mid" }));
    const cc = corners(CAB, 6);
    out.push(D(cc.map((c) => at([c[0], c[1], Z_TOP + HEADER_H])), { size: 0.45 }));
    out.push(L(cc.map((c) => ring(c[0], c[1], 1.6, Z_TOP + HEADER_H, P, 14)).join(""), { tone: "lo" }));
    // 右侧板细节：铰链、内嵌拉手、铭牌、下部通风缝
    for (const z of [30, 72, 114]) {
      out.push(S(prismX(RIGHT - 0.2, RIGHT + 1.8, 20, 24, z, z + 5), { tone: "mid" }));
      out.push(D([at([RIGHT + 1.8, 22, z + 2.5])], { size: 0.45 }));
    }
    for (const z of [92, 108]) {
      out.push(S(prismX(RIGHT - 0.2, RIGHT + 2.2, -22, -18, z - 2, z + 2), { tone: "mid" }));
    }
    out.push(S(prismX(RIGHT + 1.2, RIGHT + 2.8, -21, -19, 90, 110), { tone: "hi" }));
    out.push(S(prismX(RIGHT - 0.2, RIGHT + 0.7, -12, 12, 118, 134), { tone: "lo", crease: "none" }));
    out.push(L([0.32, 0.55, 0.78].map((t) => seg([RIGHT + 0.8, -9, 118 + 16 * t], [RIGHT + 0.8, 9, 118 + 16 * t])).join(""), { tone: "mid" }));
    out.push(D([at([RIGHT + 0.8, -10.5, 119.5]), at([RIGHT + 0.8, 10.5, 119.5]), at([RIGHT + 0.8, -10.5, 132.5]), at([RIGHT + 0.8, 10.5, 132.5])], { size: 0.45 }));
    const vents = [];
    for (const z of [12, 17, 22]) vents.push(seg([RIGHT + 0.2, -20, z], [RIGHT + 0.2, 16, z]));
    out.push(L(vents.join(""), { tone: "lo" }));
    return out.join("");
  }

  // ——————————————— 电池罐单体：方罐 + 中盖 + 正负极柱 + 提手缝 ———————————————
  function cell(x0, y0, z0, lit) {
    const x1 = x0 + CELL.w, y1 = y0 + CELL.d, z1 = z0 + CELL.h;
    const out = [];
    out.push(S(prismY(y0, y1, x0, x1, z0, z1), { tone: "mid", lit: !!lit }));
    // 中盖：环绕罐身的盖圈，略外凸，盖住罐口
    out.push(S(prismY(y0 - 0.35, y1 + 0.35, x0 - 0.35, x1 + 0.35, z1 - 3.2, z1), { tone: "hi" }));
    // 提手缝：正面顶部内凹横槽
    out.push(S(prismY(y1 - 0.3, y1 + 0.5, x0 + 2.2, x1 - 2.2, z1 - 9.2, z1 - 6.6), { tone: "lo", crease: "none" }));
    // 罐身两道浅缝
    out.push(L([0.34, 0.66].map((t) => seg([x0 + 1, y1 + 0.15, z0 + CELL.h * t], [x1 - 1, y1 + 0.15, z0 + CELL.h * t])).join(""), { tone: "faint" }));
    // 正负极柱小圆柱 + 顶面触点（被测单体右正红、左负深，其余统一 mid）
    const tc = (y0 + y1) / 2;
    for (const [tx, plus] of [[x0 + 1.8, false], [x1 - 1.8, true]]) {
      out.push(S(cylinder(tx, tc, 1.5, z1, 3.2, P, 18), { tone: "hi" }));
      out.push(D([at([tx, tc, z1 + 3.3])], { size: lit ? 0.8 : 0.55, tone: lit ? (plus ? "red" : "lo") : "mid" }));
    }
    return out.join("");
  }

  // 仓内 15 只（前排第 4 位腾出给被测单体）
  function cellArray() {
    const out = [];
    for (let i = 0; i < 8; i++) if (i !== 3) out.push(cell(cellX(i), -1, ROW0_Z, false));
    for (let i = 0; i < 8; i++) out.push(cell(cellX(i), -1, ROW1_Z, false));
    return out.join("");
  }

  // ———————————— 抽出托盘：承载被测单体与夹具，前沿挡板 + 拉手环 ————————————
  function tray() {
    const out = [];
    out.push(S(slabOf(TRAY, 63, 5, P, 4, 0.5), { tone: "hi" }));
    const y1 = TRAY.y + TRAY.d;
    out.push(S(prismY(y1 - 4, y1, TRAY.x, TRAY.x + TRAY.w, 68, 72.5), { tone: "mid" }));
    out.push(S(prismY(TRAY.y, y1, TRAY.x, TRAY.x + 1.6, 68, 70.5), { tone: "mid", crease: "none" }));
    out.push(L(ringSide([6, y1 + 1.8, 70.2], 2.2, "y", 18), { tone: "lo" }));
    out.push(D([
      at([TRAY.x + 2, y1 - 2, 72.7]), at([TRAY.x + TRAY.w - 2, y1 - 2, 72.7]),
    ], { size: 0.45 }));
    return out.join("");
  }

  // ———————————— 台式内阻夹具：底座 + 双立柱 + 弹簧线探针夹到极柱 ————————————
  function fixture() {
    const out = [];
    out.push(S(slabOf({ x: BASE.x0, y: BASE.y0, w: BASE.x1 - BASE.x0, d: BASE.y1 - BASE.y0, r: 1.5 }, 68, 6, P, 4, 0.5), { tone: "mid" }));
    out.push(L(planOutline(insetPlan({ x: BASE.x0, y: BASE.y0, w: BASE.x1 - BASE.x0, d: BASE.y1 - BASE.y0, r: 1.5 }, 2), 74.2, P), { tone: "faint" }));
    // 门架横杆：把两根立柱连成一体，读作台式夹具的弓梁
    out.push(S(prismY(POST_Y - 1.6, POST_Y + 1.6, TU[0] - 0.5, TU[1] + 0.5, 91.5, 94.5), { tone: "mid" }));
    for (const tx of TU) {
      // 根部锁紧螺母 + 立柱 + 顶部短杆
      out.push(S(cylinder(tx, POST_Y, 1.7, 74, 2.6, P, 14), { tone: "mid", crease: "none" }));
      out.push(S(cylinder(tx, POST_Y, 1.35, 74, 24, P, 14), { tone: "hi" }));
      out.push(L(seg([tx, POST_Y, 98], [tx, POST_Y, 100.2]), { tone: "mid" }));
      // 弹簧线（螺旋线分 back/front 两段画，探针尖压到极柱顶）
      const spring = coil(POST_Y, 53.2, [tx, 103.5], 2.4, 5, "y", P, 14);
      out.push(L(spring.back, { tone: "mid" }), L(spring.front, { tone: "hi" }));
      out.push(L(pathOf([at([tx, 53.6, 105.4]), at([tx, 53, 107.3])]), { tone: "hi" }));
    }
    return out.join("");
  }

  // ———————————————— 被测单体（唯一 lit 主体）+ 上方热气纹（dyn heat） ————————————————
  function uut() {
    return cell(MC.x0, MC.y0, MC.z0, true);
  }
  function heat() {
    const lines = [];
    for (let k = 0; k < 3; k++) {
      const x0 = -14.5 + (k - 1) * 3.1;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push(at([x0 + Math.sin(t * Math.PI * 3 + k * 1.7) * 1.0, MC.y1 + 0.8, 109 + t * 19]));
      }
      lines.push(L(pathOf(pts), { tone: "mid" }));
    }
    return lines.join("");
  }

  // ————————————————— 表盘：外壳 + 表圈 + 表体三件套（0–40%，225°） —————————————————
  const facePoint = (c, axis, u, v) => (axis === "x" ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1], c[2] + v]);
  function gaugeBody(center, axis, R) {
    const out = [];
    out.push(L(ringSide(center, R, axis, 34), { tone: "hi" }));
    out.push(L(ringSide(center, R - 1.8, axis, 30), { tone: "lo" }));
    out.push(L(ringSide(center, R - 4.8, axis, 26), { tone: "faint" }));
    const minor = [], major = [];
    const N = 8, every = 2; // 9 个刻度位：0/10/20/30/40 为主刻度
    for (let i = 0; i <= N; i++) {
      const a = ((225 - (i / N) * 225) * Math.PI) / 180;
      const big = i % every === 0;
      const r0 = R - 1.8, r1 = R - (big ? 5.6 : 3.4);
      const d = pathOf([
        at(facePoint(center, axis, r1 * Math.cos(a), r1 * Math.sin(a))),
        at(facePoint(center, axis, r0 * Math.cos(a), r0 * Math.sin(a))),
      ]);
      (big ? major : minor).push(d);
    }
    out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
    out.push(S(cylinder(center[0], center[1], 2, center[2] - 1.2, 2.4, P, 18), { tone: "mid" }));
    return out.join("");
  }
  function alarmArc(center, axis, R, from, span) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = ((from + (i / 12) * span) * Math.PI) / 180;
      pts.push(at(facePoint(center, axis, (R - 3.4) * Math.cos(a), (R - 3.4) * Math.sin(a))));
    }
    return L(pathOf(pts, false), { tone: "red" });
  }
  function needleAt(center, axis, R, share) {
    const a = ((225 - clamp(share, 0, 1) * 225) * Math.PI) / 180;
    return pathOf([
      at(facePoint(center, axis, -2.4 * Math.cos(a), -2.4 * Math.sin(a))),
      at(facePoint(center, axis, (R - 4) * Math.cos(a), (R - 4) * Math.sin(a))),
    ]);
  }
  function gauge() {
    const out = [];
    // 两只支脚 + 外壳 + 表圈
    out.push(S(prismY(G.y0 + 2, G.y1 - 2, G.x0 + 3, G.x0 + 8, 68, G.z0), { tone: "lo" }));
    out.push(S(prismY(G.y0 + 2, G.y1 - 2, G.x1 - 8, G.x1 - 3, 68, G.z0), { tone: "lo" }));
    out.push(S(prismY(G.y0, G.y1, G.x0, G.x1, G.z0, G.z1), { tone: "mid" }));
    out.push(S(prismY(G.y1 - 0.9, G.y1, G.x0 + 1.2, G.x1 - 1.2, G.z0 + 1.2, G.z1 - 1.2), { tone: "lo", crease: "none" }));
    out.push(gaugeBody(G_C, "y", GAUGE_R));
    // 显示屏窗口（ recessed ，文字在 meter(d) 里以 dyn 组写入）
    out.push(S(prismY(G.y1 - 1, G.y1 + 0.15, 13, 27, 75.5, 81.5), { tone: "lo", crease: "none" }));
    return out.join("");
  }
  // 运行时才变的部分：警戒弧、表针、告警灯、显示屏文本
  function meter(d) {
    const out = [];
    out.push(alarmArc(G_C, "y", GAUGE_R, 225 - (d.threshold / RANGE) * 225, -(d.threshold / RANGE) * 225));
    out.push(
      dyn(
        "needle",
        L(needleAt(G_C, "y", GAUGE_R, d.dev / RANGE), { tone: "hi", className: "batt-needle", free: "start" }) +
          D([at(facePoint(G_C, "y", 0, 0))], { size: 0.8, tone: "hi" }),
      ),
    );
    out.push(dyn("led", D([at(facePoint(G_C, "y", 6.6, 5.4))], { size: 0.95, tone: "red" })));
    const mtx = (x, z) => sideMatrix([x, G.y1 + 0.25], z, P, "left");
    out.push(
      dyn(
        "display",
        faceTextSvg(mtx(14.2, 80.6), `${d.dev.toFixed(1)}%`, { size: 3.2, tone: "hi" }) +
          faceTextSvg(mtx(14.2, 77.8), "内阻偏离", { size: 2, tone: "mid" }),
      ),
    );
    return out.join("");
  }

  function buildParts() {
    return [
      { name: "base", svg: base(), anchor: [0, 0, -PLATE_H] },
      { name: "cabinet", svg: cabinet(), anchor: [(LEFT + RIGHT) / 2, 0, Z_BAY0 / 2] },
      { name: "rack", svg: rack(), anchor: [0, -2, (Z_BAY0 + Z_TOP) / 2] },
      { name: "cells", svg: cellArray(), anchor: [0, 12, (ROW0_Z + CELL.h) / 2] },
      { name: "tray", svg: tray(), anchor: [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d - 6, 68] },
      { name: "uut", svg: uut(), anchor: [-14.5, (MC.y0 + MC.y1) / 2, MC.z0 + CELL.h / 2] },
      { name: "fixture", svg: fixture(), anchor: [-14.5, POST_Y, 90] },
      { name: "gauge", svg: gauge(), anchor: [G_C[0], G.y1, G_C[2]] },
      { name: "meter", svg: meter(derive({})), anchor: [G_C[0], G.y1, G_C[2]] },
      { name: "heat", svg: heat(), anchor: [-14.5, MC.y1, 119] },
    ];
  }
  // 两遍取景：先用初始投影画一遍，回收真实包围盒重定 P，再全部重画
  let PART_ORDER = buildParts();
  refit(PART_ORDER.map((p) => p.svg).join(""));
  PART_ORDER = buildParts();
  const STATIC = PART_ORDER.filter((p) => p.name !== "meter" && p.name !== "heat").map((p) => p.svg).join("");

  function buildSvg(m, opts = {}) {
    const d = derive(m);
    return figureSvg({
      width: opts.width || WIDTH,
      height: opts.height || HEIGHT,
      label:
        `等距示意的 UPS 蓄电池柜：正面上部敞开，两层共十六只单体；前排被测单体抽出柜外，` +
        `内阻夹具探针夹住正负极柱，表盘读数 ${d.dev.toFixed(0)}%，阈值 ${d.threshold}%${d.over ? "，超警戒" : ""}。`,
      body: STATIC + meter(d) + `<g data-dyn="heat" style="opacity:${d.heat.toFixed(2)}">${heat()}</g>`,
      standalone: opts.standalone || false,
      className: "batt-figure",
    });
  }

  function text(d) {
    return `内阻偏离 ${d.dev.toFixed(0)}% · 阈值 ${d.threshold}% · ${d.over ? "超警戒" : d.recovered ? "复测正常" : "正常"}`;
  }
  const readout = (m) => text(derive(m));

  const CSS = `
.batt-plate{position:relative;width:100%;max-width:660px;margin:0 auto}
.batt-needle{stroke-width:1.1}
.batt-readout{font:600 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted,#6f7d94);margin:8px 2px 0;letter-spacing:.2px}
`;

  function mount(el, model, opts = {}) {
    if (global.__battCurrent) global.__battCurrent.destroy();
    // .iso 这一层不能省：--anatomy-* 变量定义在它上面，缺了它所有填充都取不到色
    el.innerHTML = `<style>${CSS}</style><div class="iso" data-theme="${opts.theme || "light"}"><div class="batt-plate"><div class="batt-stage">${buildSvg(model)}</div><p class="batt-readout" data-readout>${text(derive(model))}</p></div></div>`;
    const stage = el.querySelector(".batt-stage");
    const out = el.querySelector("[data-readout]");
    const needleLine = stage.querySelector('[data-dyn="needle"] .iso-line');
    const ledGroup = stage.querySelector('[data-dyn="led"]');
    const heatGroup = stage.querySelector('[data-dyn="heat"]');
    const displayText = stage.querySelector('[data-dyn="display"] text');
    const still = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let want = derive(model);
    let shown = { ...want };
    let raf = 0, last = 0, visible = true, lastLine = "";
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px" });
    io.observe(stage);

    function paint() {
      if (needleLine) needleLine.setAttribute("d", needleAt(G_C, "y", GAUGE_R, shown.dev / RANGE));
      if (ledGroup) ledGroup.style.opacity = shown.over ? "1" : "0.12";
      if (heatGroup) heatGroup.style.opacity = shown.heat.toFixed(2);
      if (displayText) displayText.textContent = `${shown.dev.toFixed(1)}%`;
      const next = text(shown);
      if (next !== lastLine) { lastLine = next; out.textContent = next; }
    }
    function tick(now) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const k2 = still.matches ? 1 : 1 - Math.exp(-dt / 0.5);
      shown = { ...want, dev: lerp(shown.dev, want.dev, k2) };
      shown.heat = clamp((shown.dev - 10) / 22, 0, 1);
      shown.over = shown.dev > want.threshold;
      paint();
      raf = visible && Math.abs(shown.dev - want.dev) > 0.02 ? requestAnimationFrame(tick) : 0;
    }
    function run() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } }
    paint();
    const ctrl = {
      set(m2) { model = m2; want = derive(m2); run(); },
      destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; io.disconnect(); if (global.__battCurrent === ctrl) global.__battCurrent = null; },
    };
    global.__battCurrent = ctrl;
    run();
    return ctrl;
  }

  global.BattFigure = { derive, buildSvg, readout, mount, needleAt, parts: () => PART_ORDER.map((p) => ({ name: p.name, anchor: p.anchor, svg: p.svg })), width: WIDTH, height: HEIGHT };
})(typeof window !== "undefined" ? window : globalThis);
