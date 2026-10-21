/*
 * iso-ups.js —— 在线式塔式 UPS 主机双变换示意监测图（anatomy 技能风格，纯 SVG，无 WebGL）。
 *
 * 造型：塔式 UPS —— 落地机柜前开门剖视（门扇旋开在柜体左前方），柜内自左而右的能量流：
 * 市电输入端子排与输入开关 → 整流器段（三只整流模块，AC→DC）→ 直流母线（双铜排 +
 * 支撑绝缘子 + 两只母线电容，蓄电池组经两根电缆自母线向下挂接）→ 逆变器段（三只逆变
 * 模块，中间高亮）→ 静态旁路（细导管自输入开关上方跨过柜顶，经吊架落到静态开关块）
 * → 输出端子排。前面板嵌负载表盘（0–100%，红弧自规划线起）+ 状态灯 + 数码窗。
 * 一眼能认出是在线式 UPS 主机，同时保留"带载越重逆变段越吃力 → 叠加计划增量后
 * 越过规划线"的完整容量风险机理。
 *
 * 一句话机理：市电经整流成直流挂上双铜排母线，再经逆变回交流供出，静态旁路跨顶备用；
 * 带载率越高，主路上可见 flow 虚线段越多，逆变段（高亮）越热越吃力，
 * 表盘指针与数码窗同步读数，负载 + 计划增量越过规划线即"超规划线"。
 *
 * 图里每个数字都来自调用方传入的同一份场景模型（workflows.js 的 CASES.capacity）：
 * 负载率序列、复测序列、规划线与计划增量都由入参给，本文件不自带演示数值。
 *
 * 性能约定：静态图只在挂载时生成一次；换状态时只写指针 d、数显 text、
 * 告警灯 opacity、6 组 flow 虚线的 opacity 和读数文本 —— 不在每帧重建整段 SVG。
 *
 * 依赖 iso-kit.js / iso-kit.css（经典脚本与全局样式）。用法：
 *   UpsFigure.mount(container, model) → 控制器（.set(model) 换状态，.destroy() 卸载）
 *   UpsFigure.buildSvg(model)         → 整段 <svg> 字符串（Node 自检与静态导出用）
 */
(function (global) {
  const WIDTH = 520;
  const HEIGHT = 540;

  // —— 世界坐标：x 向右，y 向后，z 向上；1 单位 ≈ 1 cm ——
  const CAB = { x: -42, y: -26, w: 80, d: 52, r: 3 }; // -42..38 / -26..26
  const Z_TOP = 150;
  const CAP = { x: -45, y: -29, w: 86, d: 58, r: 3 };
  const PLATE = { x: -86, y: -34, w: 142, d: 70, r: 4 }; // 底盘 x -86..56（左侧让位旋开的门扇）
  const PLATE_H = 8;
  const FOOT_H = 6;
  const FRONT = CAB.y + CAB.d; // 26
  const RIGHT = CAB.x + CAB.w; // 38

  const MAX_SEGS = 6; // 主路 flow 虚线段上限（演示口径，非实测电流）

  // 前开门剖视三段背板带（上：进出线/面板/旁路；中：功率单元；下：电池挂接）
  const BAND_X0 = -36, BAND_X1 = 36;
  const BANDS = [[103, 142], [42, 100], [8, 38]];

  // 上排：市电输入 / 控制面板 / 旁路导管 / 静态开关 / 输出端子
  const IN_TERM = { x0: -35, x1: -21, z0: 128, z1: 136 }; // 输入端子排基座
  const IN_POSTS = [-32.5, -28, -23.5]; // 三只输入端子柱
  const IN_SW = { x0: -35, x1: -17, z0: 106, z1: 126 }; // 输入开关
  const CONDUIT = { x0: -26, x1: 35.5, z0: 136, z1: 141 }; // 静态旁路跨顶细导管
  const DROP_L = { x0: -20.5, x1: -17.5, z0: 126, z1: 136 }; // 左吊架（输入开关顶 → 导管）
  const DROP_R = { x0: 32.5, x1: 35.5, z0: 123, z1: 136 }; // 右吊架（导管 → 静态开关）
  const PANEL = { x0: -16, x1: 10, z0: 103, z1: 135 }; // 前面板（表盘 + 数码窗 + 状态灯）
  const G_C = [-7.5, 30.8, 119]; // 负载表盘中心（面板正面 y=30.8 平面）
  const GAUGE_R = 8;
  const LCD = { x0: 1, x1: 8.5, z0: 121, z1: 129 }; // 数码窗
  const OUT_TERM = { x0: 15, x1: 32, z0: 128, z1: 136 }; // 输出端子排基座
  const OUT_POSTS = [19, 25.5, 30]; // 三只输出端子柱
  const ST_SW = { x0: 17, x1: 31, z0: 105, z1: 123 }; // 静态开关块

  // 中排：整流段 / 直流母线 / 逆变段
  const RECT_C = [-31, -24, -17]; // 三只整流模块中心 x
  const INV_C = [17, 24, 31];     // 三只逆变模块中心 x（中间为唯一高亮主体）
  const LIT = 1;
  const MOD = { y0: 24, y1: 29, w: 6.6, z0: 70, z1: 96 }; // 功率模块通用尺寸
  const BUS = { x0: -14, x1: 14, y0: 22, y1: 25, zA0: 77, zA1: 80, zB0: 83, zB1: 86 };
  const BUS_BAR = { x0: -13, x1: 13, y0: 22, y1: 25, z0: 60, z1: 63 }; // 母线支撑梁
  const BUS_CAPS = [-5.2, 5.2];  // 母线电容（圆柱）
  const BUS_INS = [-11.3, 11.3]; // 支撑绝缘子

  // 下排：蓄电池组挂接口
  const BATT = { x0: -7, x1: 7, y0: 23, y1: 27, z0: 12, z1: 19 };
  const BATT_WIRE_X = [-1.2, 1.2]; // 自母线向下引的两根电缆

  // 前开门扇（铰链在柜体前左棱，向观察者旋开约 115°）
  const DOOR = { hinge: [-42, 25], ang: 115, len: 76, th: 1.5, z0: 8, z1: 142 };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /**
   * 演示口径（写进图注，不当作实测电流）：主路 flow 虚线段数随负载率线性增减，
   * 全亮为 6 段、最少留 1 段；计划增量 = 当前负载 + 计划 pp（读数与越线判断用）。
   */
  function derive(m) {
    const series = m.series || [];
    const after = m.after || [];
    const live = m.recovered && after.length ? after : series;
    const idx = clamp(m.index == null ? live.length - 1 : m.index, 0, Math.max(0, live.length - 1));
    const load = live[idx] ?? live.at(-1) ?? 0;
    const threshold = m.threshold ?? 85;
    const planned = m.planned ?? 12;
    const projected = load + planned;
    return {
      load,
      threshold,
      planned,
      projected,
      share: clamp(load / 100, 0, 1),
      recovered: !!m.recovered,
      over: projected > threshold,
      segs: clamp(Math.ceil(clamp(load / 100, 0, 1) * MAX_SEGS), 1, MAX_SEGS),
    };
  }

  // 取景用两遍法：先按临时投影画一遍，再从真实产出的坐标里回收包围盒重画。
  const CAMERA = { pad: 22, azimuth: 40, elevation: 33 };
  let P = fitProjection(
    [
      ...boxCorners(PLATE, -PLATE_H - FOOT_H - 1, 0),
      ...boxCorners(CAB, 0, Z_TOP + 8),
      [-78, 98, 142], // 旋开门扇的自由边
      [-44, 20, 8],
      [32, 26, 142],  // 端子柱顶
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
  const dyn = (name, inner, extra = "") => `<g data-dyn="${name}"${extra}>${inner}</g>`;

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

  // ————————————————————————————— 底盘与地脚 —————————————————————————————
  function base() {
    const out = [`<path class="iso-halo" d="${haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
    for (const [x, y] of byDepth(corners(PLATE, 10).map((c) => [c[0], c[1], 0]))) {
      out.push(S(cylinder(x, y, 5.6, -PLATE_H - FOOT_H, 2, P, 22), { tone: "lo" }));
      out.push(S(cylinder(x, y, 3.4, -PLATE_H - FOOT_H + 2, FOOT_H - 1.6, P, 20), { tone: "lo" }));
    }
    out.push(S(slabOf(PLATE, -PLATE_H, PLATE_H, P, 6, 1), { tone: "mid" }));
    out.push(L(planOutline(insetPlan(PLATE, 4.5), 0, P), { tone: "faint" }));
    const sc = corners(PLATE, 10);
    out.push(L(sc.map((c) => ring(c[0], c[1], 1.8, 0, P, 14)).join(""), { tone: "lo" }));
    out.push(D(sc.map((c) => at([c[0], c[1], 0])), { size: 0.45 }));
    return out.join("");
  }

  // ———————————————————————— 机柜本体、顶盖、侧面 ————————————————————————
  function cabinet() {
    const out = [];
    out.push(S(slabOf(CAB, 0, Z_TOP, P, 8, 1.2), { tone: "mid" }));
    // 正面外框缝（剖视开口四周）
    out.push(L(pathOf([
      at([CAB.x + 0.3, FRONT + 0.2, 2]), at([RIGHT - 0.3, FRONT + 0.2, 2]),
      at([RIGHT - 0.3, FRONT + 0.2, 148]), at([CAB.x + 0.3, FRONT + 0.2, 148]),
    ], true), { tone: "faint" }));
    // 踢脚板
    out.push(S(prismY(FRONT - 1.4, FRONT + 1.8, -36, 36, 3, 8), { tone: "hi" }));
    return out.join("");
  }

  function side() {
    const out = [];
    // 侧板门缝（右侧面 x=RIGHT）+ 下部散热横缝 + 铭牌
    out.push(L(pathOf([
      at([RIGHT + 0.2, -20, 12]), at([RIGHT + 0.2, 20, 12]),
      at([RIGHT + 0.2, 20, 146]), at([RIGHT + 0.2, -20, 146]),
    ], true), { tone: "faint" }));
    const vents = [];
    for (const z of [20, 25, 30]) vents.push(seg([RIGHT + 0.2, -18, z], [RIGHT + 0.2, 14, z]));
    out.push(L(vents.join(""), { tone: "lo" }));
    out.push(S(prismX(RIGHT - 0.4, RIGHT + 0.8, -14, 12, 128, 146), { tone: "lo", crease: "none" }));
    out.push(L([0.32, 0.55, 0.78].map((t) => seg([RIGHT + 0.9, -11, 128 + 18 * t], [RIGHT + 0.9, 9, 128 + 18 * t])).join(""), { tone: "mid" }));
    out.push(D([
      at([RIGHT + 0.9, -12.5, 129.5]), at([RIGHT + 0.9, 10.5, 129.5]),
      at([RIGHT + 0.9, -12.5, 144.5]), at([RIGHT + 0.9, 10.5, 144.5]),
    ], { size: 0.45 }));
    return out.join("");
  }

  function cap() {
    const out = [];
    out.push(S(slabOf(CAP, Z_TOP, 8, P, 8, 1), { tone: "hi" }));
    const cc = corners(CAP, 6);
    out.push(D(cc.map((c) => at([c[0], c[1], Z_TOP + 8])), { size: 0.45 }));
    out.push(L(cc.map((c) => ring(c[0], c[1], 1.5, Z_TOP + 8, P, 14)).join(""), { tone: "lo" }));
    // 顶置风机网罩：两圈同心环 + 放射筋
    const cx = 0, cy = -2;
    out.push(L(ring(cx, cy, 14, Z_TOP + 8, P, 38), { tone: "lo" }));
    out.push(L(ring(cx, cy, 22, Z_TOP + 8, P, 42), { tone: "faint" }));
    const spokes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spokes.push(seg([cx + 14 * Math.cos(a), cy + 14 * Math.sin(a), Z_TOP + 8], [cx + 22 * Math.cos(a), cy + 22 * Math.sin(a), Z_TOP + 8]));
    }
    out.push(L(spokes.join(""), { tone: "faint" }));
    return out.join("");
  }

  // ————————————— 开敞剖视三段背板带 + 底部走线槽 + 电池端子块 —————————————
  function interior() {
    const out = [];
    for (const [z0, z1] of BANDS) {
      out.push(S(prismY(21.5, 23.8, BAND_X0, BAND_X1, z0, z1), { tone: "lo", crease: "none" }));
      out.push(L(pathOf([
        at([BAND_X0, 24, z0]), at([BAND_X1, 24, z0]),
        at([BAND_X1, 24, z1]), at([BAND_X0, 24, z1]),
      ], true), { tone: "faint" }));
      out.push(D([
        at([BAND_X0 + 1.5, 24.1, z0 + 1.5]), at([BAND_X1 - 1.5, 24.1, z0 + 1.5]),
        at([BAND_X0 + 1.5, 24.1, z1 - 1.5]), at([BAND_X1 - 1.5, 24.1, z1 - 1.5]),
      ], { size: 0.4 }));
    }
    // 底部电缆槽（电池端子块坐在槽上）
    out.push(S(prismX(-30, 30, 22.5, 25, 9.5, 12), { tone: "lo" }));
    out.push(L(seg([-28, 25.2, 10.7], [28, 25.2, 10.7]), { tone: "faint" }));
    return out.join("");
  }

  // ———————————— 直流母线：双铜排 + 端封 + 支撑梁 + 绝缘子 + 电容 ————————————
  function bus() {
    const out = [];
    out.push(S(prismX(BUS_BAR.x0, BUS_BAR.x1, BUS_BAR.y0, BUS_BAR.y1, BUS_BAR.z0, BUS_BAR.z1), { tone: "mid" }));
    for (const [z0, z1] of [[BUS.zA0, BUS.zA1], [BUS.zB0, BUS.zB1]]) {
      out.push(S(prismX(BUS.x0, BUS.x1, BUS.y0, BUS.y1, z0, z1), { tone: "hi" }));
      out.push(S(prismX(BUS.x0 - 1.1, BUS.x0, BUS.y0 - 0.4, BUS.y1 + 0.4, z0 - 0.4, z1 + 0.4), { tone: "mid" }));
      out.push(S(prismX(BUS.x1, BUS.x1 + 1.1, BUS.y0 - 0.4, BUS.y1 + 0.4, z0 - 0.4, z1 + 0.4), { tone: "mid" }));
    }
    // 支撑绝缘子（带伞裙环）与母线电容，都站在支撑梁上、顶住下排铜排
    for (const x of BUS_INS) {
      out.push(S(cylinder(x, 23.5, 2.3, 63, 14, P, 18), { tone: "mid" }));
      out.push(L(ring(x, 23.5, 2.9, 67.5, P, 18), { tone: "lo" }));
      out.push(L(ring(x, 23.5, 2.9, 71.5, P, 18), { tone: "lo" }));
    }
    for (const x of BUS_CAPS) {
      out.push(S(cylinder(x, 23.5, 3.4, 63, 14, P, 22), { tone: "mid" }));
      out.push(L(ring(x, 23.5, 3.55, 70, P, 20), { tone: "lo" }));
      out.push(L(ring(x, 23.5, 1.3, 77, P, 14), { tone: "lo" }));
      out.push(D([at([x, 23.5, 77.3])], { size: 0.55, tone: "hi" }));
    }
    return out.join("");
  }

  // ————— 功率模块：整流三只 + 逆变三只（中间整只为唯一 lit 主体）+ 上下滑道 —————
  function module(cx, lit) {
    const out = [];
    out.push(S(prismY(MOD.y0, MOD.y1, cx - 3.3, cx + 3.3, MOD.z0, MOD.z1), lit ? { tone: "mid", lit: true } : { tone: "mid" }));
    out.push(S(prismY(MOD.y1, MOD.y1 + 2.5, cx - 1.4, cx + 1.4, 78, 88), { tone: "hi" })); // 抽拉把手
    out.push(S(prismY(26, 30, cx - 2.2, cx + 2.2, 67.5, 70), { tone: "lo" })); // 底部接插口
    out.push(D([at([cx + 2.2, MOD.y1 + 0.2, 92])], { size: 0.55, tone: lit ? "hi" : "mid" })); // 状态灯点
    out.push(D([
      at([cx - 2.9, MOD.y1 + 0.2, 72.5]), at([cx + 2.9, MOD.y1 + 0.2, 72.5]),
      at([cx - 2.9, MOD.y1 + 0.2, 93.5]), at([cx + 2.9, MOD.y1 + 0.2, 93.5]),
    ], { size: 0.42 }));
    return out.join("");
  }
  function modules() {
    const out = [];
    for (const z of [99, 102.2]) { // 模块组上下滑道
      out.push(S(prismY(24.5, 28.5, -35, -13.5, z, z + 2.2), { tone: "lo", crease: "none" }));
      out.push(S(prismY(24.5, 28.5, 13.5, 35, z, z + 2.2), { tone: "lo", crease: "none" }));
    }
    for (const z of [66.2, 69.4]) {
      out.push(S(prismY(24.5, 28.5, -35, -13.5, z, z + 2.2), { tone: "lo", crease: "none" }));
      out.push(S(prismY(24.5, 28.5, 13.5, 35, z, z + 2.2), { tone: "lo", crease: "none" }));
    }
    for (const cx of RECT_C) out.push(module(cx, false));
    INV_C.forEach((cx, i) => out.push(module(cx, i === LIT)));
    return out.join("");
  }

  // ———————————————— 蓄电池组挂接口端子块（前面板沿，双电缆落点） ————————————————
  function battery() {
    const out = [];
    out.push(S(prismY(BATT.y0, BATT.y1, BATT.x0, BATT.x1, BATT.z0, BATT.z1), { tone: "mid" }));
    out.push(S(prismY(BATT.y1, BATT.y1 + 0.7, -5, 5, 13.5, 17.5), { tone: "lo", crease: "none" }));
    out.push(L(seg([-3.5, BATT.y1 + 0.85, 15.5], [3.5, BATT.y1 + 0.85, 15.5]), { tone: "mid" }));
    for (const x of BATT_WIRE_X) {
      out.push(L(ringSide([x, BATT.y1 + 0.4, 15.5], 2.1, "y", 20), { tone: "lo" }));
      out.push(L(ringSide([x, BATT.y1 + 0.4, 15.5], 1.2, "y", 16), { tone: "faint" }));
    }
    out.push(D([
      at([BATT.x0 + 1.2, BATT.y1 + 0.2, BATT.z0 + 1]), at([BATT.x1 - 1.2, BATT.y1 + 0.2, BATT.z0 + 1]),
      at([BATT.x0 + 1.2, BATT.y1 + 0.2, BATT.z1 - 1]), at([BATT.x1 - 1.2, BATT.y1 + 0.2, BATT.z1 - 1]),
    ], { size: 0.42 }));
    return out.join("");
  }

  // ———— 上排正面件：输入端子/开关、旁路导管与吊架、控制面板、静态开关、输出端子 ————
  function faceTop() {
    const out = [];
    // 输入端子排基座 + 三只端子柱
    out.push(S(prismY(24.5, 27.5, IN_TERM.x0, IN_TERM.x1, IN_TERM.z0, IN_TERM.z1), { tone: "mid" }));
    for (const x of IN_POSTS) {
      out.push(S(cylinder(x, 26, 1.6, IN_TERM.z1, 5, P, 16), { tone: "mid" }));
      out.push(D([at([x, 26, IN_TERM.z1 + 5.2])], { size: 0.55, tone: "hi" }));
    }
    // 输入开关：本体 + 大手柄 + 铭牌条
    out.push(S(prismY(24, 28, IN_SW.x0, IN_SW.x1, IN_SW.z0, IN_SW.z1), { tone: "mid" }));
    out.push(S(prismY(28, 31.6, -27, -23, 110, 122), { tone: "hi" }));
    out.push(S(prismY(28, 28.7, -33.5, -28.5, 108, 114), { tone: "lo", crease: "none" }));
    out.push(L(seg([-33, 28.85, 111], [-29, 28.85, 111]), { tone: "mid" }));
    out.push(D([
      at([-34, 28.2, 107.5]), at([-18, 28.2, 107.5]),
      at([-34, 28.2, 124.5]), at([-18, 28.2, 124.5]),
    ], { size: 0.45 }));
    // 静态旁路：跨顶细导管 + 两只吊架（标注性走线，从输入开关上方跨到输出端）
    out.push(S(prismY(26.5, 29.5, CONDUIT.x0, CONDUIT.x1, CONDUIT.z0, CONDUIT.z1), { tone: "lo" }));
    out.push(L(seg([CONDUIT.x0 + 1.5, 29.7, 138.5], [CONDUIT.x1 - 1.5, 29.7, 138.5]), { tone: "faint" }));
    out.push(S(prismY(26.5, 29.5, DROP_L.x0, DROP_L.x1, DROP_L.z0, DROP_L.z1), { tone: "mid" }));
    out.push(S(prismY(26.5, 29.5, DROP_R.x0, DROP_R.x1, DROP_R.z0, DROP_R.z1), { tone: "mid" }));
    out.push(D([
      at([(DROP_L.x0 + DROP_L.x1) / 2, 29.7, 128]),
      at([(DROP_R.x0 + DROP_R.x1) / 2, 29.7, 130]),
    ], { size: 0.45 }));
    // 控制面板（凸起面板 + 内衬板）：表盘 / 数码窗 / 状态灯都挂在正面
    out.push(S(prismY(26, 30, PANEL.x0, PANEL.x1, PANEL.z0, PANEL.z1), { tone: "mid" }));
    out.push(S(prismY(29.7, 30.4, PANEL.x0 + 1.2, PANEL.x1 - 1.2, PANEL.z0 + 1.2, PANEL.z1 - 1.2), { tone: "lo", crease: "none" }));
    out.push(D([
      at([PANEL.x0 + 1.6, 30.5, PANEL.z0 + 1.6]), at([PANEL.x1 - 1.6, 30.5, PANEL.z0 + 1.6]),
      at([PANEL.x0 + 1.6, 30.5, PANEL.z1 - 1.6]), at([PANEL.x1 - 1.6, 30.5, PANEL.z1 - 1.6]),
    ], { size: 0.42 }));
    // 输出端子排基座 + 三只端子柱
    out.push(S(prismY(24.5, 27.5, OUT_TERM.x0, OUT_TERM.x1, OUT_TERM.z0, OUT_TERM.z1), { tone: "mid" }));
    for (const x of OUT_POSTS) {
      out.push(S(cylinder(x, 26, 1.6, OUT_TERM.z1, 5, P, 16), { tone: "mid" }));
      out.push(D([at([x, 26, OUT_TERM.z1 + 5.2])], { size: 0.55, tone: "hi" }));
    }
    // 静态开关块：本体 + 手柄 + 晶闸管对环
    out.push(S(prismY(24.5, 29, ST_SW.x0, ST_SW.x1, ST_SW.z0, ST_SW.z1), { tone: "mid" }));
    out.push(S(prismY(29, 31.8, 21, 27, 109, 119), { tone: "hi" }));
    out.push(L(ringSide([24, 29.3, 114], 2.7, "y", 22), { tone: "mid" }));
    out.push(L(ringSide([24, 29.3, 114], 1.7, "y", 18), { tone: "lo" }));
    out.push(D([
      at([ST_SW.x0 + 1.5, 29.2, ST_SW.z0 + 1.5]), at([ST_SW.x1 - 1.5, 29.2, ST_SW.z0 + 1.5]),
      at([ST_SW.x0 + 1.5, 29.2, ST_SW.z1 - 1.5]), at([ST_SW.x1 - 1.5, 29.2, ST_SW.z1 - 1.5]),
    ], { size: 0.42 }));
    return out.join("");
  }

  // ———— 连接线：输入开关→整流段、逆变段→静态开关→输出端子、母线→电池两根电缆 ————
  function wires() {
    const out = [];
    out.push(wireSvg(at([-31, 28.8, 106.2]), at([-31, 28.8, 96.2]), { tone: "lo", size: 1.1 }));
    out.push(wireSvg(at([24, 28.6, 96.2]), at([24, 28.6, 104.8]), { tone: "lo", size: 1.1 }));
    out.push(wireSvg(at([27.5, 28.6, 122.8]), at([27.5, 28.6, 128.2]), { tone: "lo", size: 1.1 }));
    out.push(wireSvg(at([BATT_WIRE_X[0], 25.6, 77]), at([BATT_WIRE_X[0], 25.6, 19.2]), { tone: "lo", size: 1.2 }));
    out.push(wireSvg(at([BATT_WIRE_X[1], 25.6, 86]), at([BATT_WIRE_X[1], 25.6, 19.2]), { tone: "lo", size: 1.2 }));
    return out.join("");
  }

  // ———— 主路能量流 flow 虚线（静态画好，运行时只决定前几段可见）————
  function flow() {
    const routes = [
      [[-28, 31.8, 139.5], [-28, 31.8, 97.5]],   // 市电 → 整流段（穿过输入开关）
      [[-34, 32.2, 83], [-14.2, 32.2, 83]],      // 穿过整流段
      [[-13, 26.4, 81.5], [13, 26.4, 81.5]],     // 贴着直流母线（两铜排之间）
      [[-13, 26.4, 88.6], [13, 26.4, 88.6]],     // 贴着直流母线下沿
      [[14.2, 32.2, 83], [34, 32.2, 83]],        // 穿过逆变段（高亮）
      [[24.7, 32.4, 96.5], [24.7, 32.4, 127.5]], // 逆变段 → 输出端子（穿过静态开关）
    ];
    return routes.map((pts, i) => {
      const d = pathOf(pts.map((p) => at(p)));
      return (
        `<g data-flow="${i}">` +
        L(d, { tone: "lit", flow: true }) +
        D([at(pts[0])], { size: 0.5, tone: "mid" }) +
        "</g>"
      );
    }).join("");
  }

  // ———————————————————————— 表计、数显窗与指针 ————————————————————————
  const facePoint = (c, axis, u, v) => (axis === "x" ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1], c[2] + v]);
  function gaugeBody(center, axis, R) {
    const out = [];
    out.push(L(ringSide(center, R, axis, 34), { tone: "hi" }));
    out.push(L(ringSide(center, R - 2.2, axis, 30), { tone: "lo" }));
    out.push(L(ringSide(center, R - 5.4, axis, 26), { tone: "faint" }));
    const minor = [], major = [];
    const N = axis === "x" ? 20 : 16;
    const every = axis === "x" ? 5 : 4;
    for (let i = 0; i <= N; i++) {
      const a = ((225 - (i / N) * 270) * Math.PI) / 180;
      const big = i % every === 0;
      const r0 = R - 2.2, r1 = R - (big ? 6.4 : 4.4);
      const d = pathOf([
        at(facePoint(center, axis, r1 * Math.cos(a), r1 * Math.sin(a))),
        at(facePoint(center, axis, r0 * Math.cos(a), r0 * Math.sin(a))),
      ]);
      (big ? major : minor).push(d);
    }
    out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
    out.push(S(cylinder(center[0], center[1], 2, center[2] - R + 1, 2.2, P, 18), { tone: "mid" }));
    return out.join("");
  }
  // 红弧：从规划线刻标起、扫到量程末端（角随量程递减方向为升压侧）
  function alarmArc(center, axis, R, from, span) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = ((from + (i / 12) * span) * Math.PI) / 180;
      pts.push(at(facePoint(center, axis, (R - 3.4) * Math.cos(a), (R - 3.4) * Math.sin(a))));
    }
    return L(pathOf(pts, false), { tone: "red" });
  }
  function needleAt(center, axis, R, share) {
    const a = ((225 - clamp(share, 0, 1) * 270) * Math.PI) / 180;
    return pathOf([
      at(facePoint(center, axis, -2.6 * Math.cos(a), -2.6 * Math.sin(a))),
      at(facePoint(center, axis, (R - 4) * Math.cos(a), (R - 4) * Math.sin(a))),
    ]);
  }
  function meter(d) {
    const out = [];
    out.push(gaugeBody(G_C, "y", GAUGE_R));
    out.push(
      alarmArc(G_C, "y", GAUGE_R, 225 - (d.threshold / 100) * 270, (d.threshold / 100) * 270 - 270),
    );
    out.push(
      dyn(
        "needle",
        L(needleAt(G_C, "y", GAUGE_R, d.share), { tone: "hi", className: "ups-needle", free: "start" }) +
          D([at(facePoint(G_C, "y", 0, 0))], { size: 0.8, tone: "hi" }),
      ),
    );
    // 数码窗：负载率大字 + 百分号小字（dyn，运行时改 textContent）
    out.push(S(prismY(30.4, 31.1, LCD.x0, LCD.x1, LCD.z0, LCD.z1), { tone: "lo", crease: "none" }));
    const mtx = (x, z) => sideMatrix([x, 31.2], z, P, "left");
    out.push(
      dyn(
        "lcd",
        faceTextSvg(mtx(LCD.x0 + 0.5, 127.9), d.load.toFixed(0), { size: 3.4, tone: "hi" }) +
          faceTextSvg(mtx(LCD.x0 + 0.6, 123.5), "%", { size: 2.2, tone: "mid" }),
      ),
    );
    // 状态灯：运行（常亮暗点）+ 告警（dyn 红点，超规划线时亮）
    out.push(D([at([2.2, 30.9, 112])], { size: 0.85, tone: "hi" }));
    out.push(L(ringSide([6, 30.8, 112], 1.8, "y", 18), { tone: "lo" }));
    out.push(dyn("led", D([at([6, 30.9, 112])], { size: 0.85, tone: "red" }), d.over ? "" : ` opacity="0.12"`));
    return out.join("");
  }

  // ———————————— 旋开的门扇：铰链在柜体前左棱，外板面朝观察者 ————————————
  const D_RAD = (DOOR.ang * Math.PI) / 180;
  const D_DIR = [Math.cos(D_RAD), Math.sin(D_RAD)];       // 门扇平面方向
  const D_NRM = [Math.sin(D_RAD), -Math.cos(D_RAD)];      // 厚度外法向（朝观察者侧）
  const D_H = DOOR.hinge;                                  // 铰链线中心（柜体前左棱）
  const D_F = [D_H[0] + D_DIR[0] * DOOR.len, D_H[1] + D_DIR[1] * DOOR.len]; // 自由边中心
  const dFace = (t, back = 0) => [
    D_H[0] + (D_F[0] - D_H[0]) * t + D_NRM[0] * (DOOR.th + back),
    D_H[1] + (D_F[1] - D_H[1]) * t + D_NRM[1] * (DOOR.th + back),
  ];
  // 门扇局部小件：贴外表面向外挤出（深度 depth）
  function doorBox(t0, t1, z0, z1, depth) {
    const a = dFace(t0), b = dFace(t1);
    const ring = [a, b, [b[0] + D_NRM[0] * depth, b[1] + D_NRM[1] * depth], [a[0] + D_NRM[0] * depth, a[1] + D_NRM[1] * depth]];
    return extrude(ring, z0, z1 - z0, P, { convex: true });
  }
  function door() {
    const out = [];
    const a = dFace(0), b = dFace(1);
    const inner = (t) => [
      D_H[0] + (D_F[0] - D_H[0]) * t - D_NRM[0] * DOOR.th,
      D_H[1] + (D_F[1] - D_H[1]) * t - D_NRM[1] * DOOR.th,
    ];
    const c0 = inner(0), c1 = inner(1);
    out.push(S(extrude([a, b, c1, c0], DOOR.z0, DOOR.z1 - DOOR.z0, P, { convex: true }), { tone: "mid" }));
    // 外板面内凹边框缝
    const p = (t, z) => { const q = dFace(t); return [q[0], q[1], z]; };
    out.push(L(pathOf([
      at(p(0.05, 14)), at(p(0.95, 14)), at(p(0.95, 136)), at(p(0.05, 136)),
    ], true), { tone: "lo" }));
    // 竖向加强筋两条 + 下部通风槽（凹槽框 + 三条缝）
    for (const t of [0.3, 0.62]) out.push(L(seg(p(t, 20), p(t, 130)), { tone: "faint" }));
    out.push(S(doorBox(0.07, 0.44, 19, 35.5, 0.4), { tone: "lo", crease: "none" }));
    for (const z of [23, 27.5, 32]) out.push(L(seg(p(0.11, z), p(0.4, z)), { tone: "faint" }));
    // 四角螺钉
    out.push(D([at(p(0.05, 16)), at(p(0.95, 16)), at(p(0.05, 134)), at(p(0.95, 134))], { size: 0.45 }));
    // 铭牌（rule 线）+ 拉手（两支座 + 立杆）
    out.push(S(doorBox(0.52, 0.7, 106, 124, 0.5), { tone: "lo", crease: "none" }));
    for (const z of [111, 113.5, 116]) out.push(L(seg(p(0.55, z), p(0.67, z)), { tone: "mid" }));
    out.push(S(doorBox(0.78, 0.83, 70, 75, 1.5), { tone: "mid" }));
    out.push(S(doorBox(0.81, 0.86, 75.5, 80.5, 1.5), { tone: "mid" }));
    out.push(S(doorBox(0.775, 0.865, 63, 87, 2.6), { tone: "hi" }));
    // 铰链 barrel 三只（柜体前左棱上）
    for (const z of [22, 68, 114]) {
      out.push(S(cylinder(D_H[0], D_H[1], 2.1, z, 10, P, 18), { tone: "mid" }));
      out.push(D([at([D_H[0], D_H[1], z + 5])], { size: 0.5 }));
    }
    return out.join("");
  }

  function buildParts() {
    return [
      { name: "base", svg: base(), anchor: [0, 0, -PLATE_H] },
      { name: "cabinet", svg: cabinet(), anchor: [CAB.x + CAB.w / 2, 0, Z_TOP / 2] },
      { name: "side", svg: side(), anchor: [RIGHT, 0, Z_TOP / 2] },
      { name: "cap", svg: cap(), anchor: [0, 0, Z_TOP + 4] },
      { name: "interior", svg: interior(), anchor: [0, 23, 75] },
      { name: "bus", svg: bus(), anchor: [0, 23.5, 73] },
      { name: "modules", svg: modules(), anchor: [0, 26, 83] },
      { name: "battery", svg: battery(), anchor: [0, 25, 15] },
      { name: "faceTop", svg: faceTop(), anchor: [0, 28, 122] },
      { name: "wires", svg: wires(), anchor: [0, 27, 70] },
      { name: "flow", svg: flow(), anchor: [0, 30, 90] },
      { name: "meter", svg: meter(derive({})), anchor: G_C },
      { name: "door", svg: door(), anchor: [(D_H[0] + D_F[0]) / 2, (D_H[1] + D_F[1]) / 2, 75] },
    ];
  }
  // 两遍取景：先用初始投影画一遍，回收真实包围盒重定 P，再全部重画
  let PART_ORDER = buildParts();
  refit(PART_ORDER.map((p) => p.svg).join(""));
  PART_ORDER = buildParts();
  const STATIC = PART_ORDER.filter((p) => p.name !== "meter").map((p) => p.svg).join("");

  function buildSvg(m, opts = {}) {
    const d = derive(m);
    return figureSvg({
      width: opts.width || WIDTH,
      height: opts.height || HEIGHT,
      label:
        `等距示意的在线式塔式 UPS 主机：前开门剖视，市电经整流段挂上直流母线，再经逆变段（高亮）供出，静态旁路跨顶备用。` +
        `负载表读 ${d.load.toFixed(0)}%，规划线 ${d.threshold.toFixed(0)}%，计划 +${d.planned}pp 后 ${d.projected.toFixed(0)}%。`,
      body: STATIC + meter(d),
      standalone: opts.standalone || false,
      className: "ups-figure",
    });
  }

  function text(d) {
    return `负载率 ${d.load.toFixed(0)}% · 规划线 ${d.threshold.toFixed(0)}% · ${d.recovered ? "复测正常" : d.over ? "超规划线" : "正常"}`;
  }
  const readout = (m) => text(derive(m));

  const CSS = `
.ups-plate{position:relative;width:100%;max-width:660px;margin:0 auto}
.ups-needle{stroke-width:1.1}
.ups-readout{font:600 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted,#6f7d94);margin:8px 2px 0;letter-spacing:.2px}
`;

  function mount(el, model, opts = {}) {
    if (global.__upsCurrent) global.__upsCurrent.destroy();
    // .iso 这一层不能省：--anatomy-* 变量定义在它上面，缺了它所有填充都取不到色
    el.innerHTML = `<style>${CSS}</style><div class="iso" data-theme="${opts.theme || "light"}"><div class="ups-plate"><div class="ups-stage">${buildSvg(model)}</div><p class="ups-readout" data-readout>${text(derive(model))}</p></div></div>`;
    const stage = el.querySelector(".ups-stage");
    const out = el.querySelector("[data-readout]");
    const needleEl = stage.querySelector('[data-dyn="needle"] .iso-line');
    const lcdText = stage.querySelector('[data-dyn="lcd"] text');
    const ledGroup = stage.querySelector('[data-dyn="led"]');
    const segs = [...stage.querySelectorAll("[data-flow]")];
    const still = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let want = derive(model);
    let shown = { ...want };
    let raf = 0, last = 0, visible = true, lastLine = "";
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px" });
    io.observe(stage);

    function paint() {
      if (needleEl) needleEl.setAttribute("d", needleAt(G_C, "y", GAUGE_R, clamp(shown.load / 100, 0, 1)));
      if (lcdText) lcdText.textContent = shown.load.toFixed(0);
      if (ledGroup) ledGroup.style.opacity = shown.over ? "1" : "0.12";
      const n = clamp(Math.ceil(clamp(shown.load / 100, 0, 1) * MAX_SEGS), 1, MAX_SEGS);
      for (let i = 0; i < segs.length; i++) {
        const o = i < n ? (i === n - 1 ? 0.45 : 1) : 0;
        if (segs[i].style.opacity !== String(o)) segs[i].style.opacity = String(o);
      }
      const next = text({ ...shown, over: shown.load + want.planned > want.threshold });
      if (next !== lastLine) { lastLine = next; out.textContent = next; }
    }
    function tick(now) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const k2 = still.matches ? 1 : 1 - Math.exp(-dt / 0.5);
      shown = { ...want, load: lerp(shown.load, want.load, k2) };
      shown.over = shown.load + want.planned > want.threshold;
      paint();
      const settled = Math.abs(shown.load - want.load) < 0.05;
      raf = visible && !settled ? requestAnimationFrame(tick) : 0;
    }
    function run() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } }
    paint();
    const ctrl = {
      set(m2) { model = m2; want = derive(m2); run(); },
      destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; io.disconnect(); if (global.__upsCurrent === ctrl) global.__upsCurrent = null; },
    };
    global.__upsCurrent = ctrl;
    run();
    return ctrl;
  }

  global.UpsFigure = { derive, buildSvg, readout, mount, needleAt, parts: () => PART_ORDER.map((p) => ({ name: p.name, anchor: p.anchor, svg: p.svg })), width: WIDTH, height: HEIGHT };
})(typeof window !== "undefined" ? window : globalThis);
