/*
 * iso-pdu.js —— 落地配电柜容量支路负载示意监测图（anatomy 技能风格，纯 SVG，无 WebGL）。
 *
 * 造型：落地配电柜 —— 柜体 + 上部门板（铰链/拉手/门锁/铭牌，关闭）+ 中部开敞面板排
 * （主断路器大手柄、水平双汇流排、绝缘子、四只支路微断）+ 出线电缆自底部垂至地板走线。
 * 旁边立柱挂一只负载表盘（0–100%，红弧自规划线 85% 起）。一眼能认出是配电柜，同时保留
 * "支路负载爬升 → 逼近规划线 → 叠加计划增量后越线" 的完整容量风险机理。
 *
 * 一句话机理：市电经主断路器 onto 双汇流排，再分到四只支路微断带载出线；第三支路（高亮）
 * 电缆带流至末端机柜剪影，电缆上流条随负载率增减，立柱表盘指针与数显同步读数，
 * 计划增量刻标落在红弧区内即"超规划线"。
 *
 * 图里每个数字都来自调用方传入的同一份场景模型（workflows.js 的 CASES.capacity）：
 * 支路峰值负载率序列、复测序列、规划线与计划增量都由入参给，本文件不自带演示数值。
 *
 * 性能约定：静态图只在挂载时生成一次；换状态时只写指针 d、计划刻标 d、数显 text、
 * 告警灯 opacity、4 组流条的 opacity 和读数文本 —— 不在每帧重建整段 SVG。
 *
 * 依赖 iso-kit.js / iso-kit.css（经典脚本与全局样式）。用法：
 *   PduFigure.mount(container, model) → 控制器（.set(model) 换状态，.destroy() 卸载）
 *   PduFigure.buildSvg(model)         → 整段 <svg> 字符串（Node 自检与静态导出用）
 */
(function (global) {
  const WIDTH = 520;
  const HEIGHT = 540;

  // —— 世界坐标：x 向右，y 向后，z 向上；1 单位 ≈ 1 cm ——
  const CAB = { x: -42, y: -26, w: 80, d: 52, r: 3 };
  const Z_TOP = 148;
  const CAP = { x: -45, y: -29, w: 86, d: 58, r: 3 };
  const PLATE = { x: -52, y: -32, w: 142, d: 76, r: 4 }; // 底盘 x -52..90（右侧让位立柱与末端机柜）
  const PLATE_H = 8;
  const FOOT_H = 6;
  const FRONT = CAB.y + CAB.d; // 26
  const RIGHT = CAB.x + CAB.w; // 38

  // 正面分区：上门板 / 中部开敞面板排 / 底部电缆室盖板
  const DOOR = { x0: -36, x1: 34, z0: 96, z1: 144 };
  const BAY = { x0: -34, x1: 34, z0: 20, z1: 90 };
  const BUS = { x0: -30, x1: 30, y0: 22, y1: 25.4, zA0: 58, zA1: 61, zB0: 64, zB1: 67 };
  const MCBS = [-26, -9, 9, 26]; // 四只支路微断的 x 中心
  const LIT = 2;                 // 第 3 支路（点亮主体）
  const ROUTES = [               // 出线电缆：x=微断中心, lane=地板走线道 y, end=走线终点 x
    { x: -26, lane: 30, end: -2, tone: "mid" },
    { x: -9, lane: 33, end: 18, tone: "mid" },
    { x: 9, lane: 36, end: 68.3, tone: "lit" }, // 第 3 支路：垂到地板后带流至末端机柜
    { x: 26, lane: 39, end: 47, tone: "mid" },
  ];
  const MAX_STRANDS = 4; // 点亮电缆上的流条上限（演示口径，非实测电流）

  // 负载表盘立柱（柜体右侧）与末端机柜剪影（第 3 支路电缆终点）
  const POST = { x: 48.5, y: -1.5, w: 8, d: 8, r: 1 };
  const G_C = [52.5, 6.5, 66]; // 表盘中心（立柱正面 y=6.5 平面）
  const GAUGE_R = 12.5;
  const LCD = { x0: 48.7, x1: 56.3, z0: 41, z1: 51 };
  const RACK = { x: 68, y: 28, w: 16, d: 14, r: 2 }; // 末端机柜剪影 x 68..84, y 28..42

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /**
   * 演示口径（写进图注，不当作实测电流）：流条可见条数随负载率线性增减，
   * 全亮为 4 条、最少留 1 条；计划增量刻标 = 当前负载 + 计划 pp，钳到量程内。
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
      strands: clamp(Math.ceil(clamp(load / 100, 0, 1) * MAX_STRANDS), 1, MAX_STRANDS),
    };
  }

  // 取景用两遍法：先按临时投影画一遍，再从真实产出的坐标里回收包围盒重画。
  const CAMERA = { pad: 22, azimuth: 40, elevation: 33 };
  let P = fitProjection(
    [
      ...boxCorners(PLATE, -PLATE_H - FOOT_H - 1, 0),
      ...boxCorners(CAB, 0, Z_TOP + 8),
      [84, 42, 45], // 末端机柜剪影
      [57, 7, 96],  // 表盘立柱帽
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
    for (const [x, y] of byDepth(corners(PLATE, 8).map((c) => [c[0], c[1], 0]))) {
      out.push(S(cylinder(x, y, 5.6, -PLATE_H - FOOT_H, 2, P, 22), { tone: "lo" }));
      out.push(S(cylinder(x, y, 3.4, -PLATE_H - FOOT_H + 2, FOOT_H - 1.6, P, 20), { tone: "lo" }));
    }
    out.push(S(slabOf(PLATE, -PLATE_H, PLATE_H, P, 6, 1), { tone: "mid" }));
    out.push(L(planOutline(insetPlan(PLATE, 4.5), 0, P), { tone: "faint" }));
    const sc = corners(PLATE, 8);
    out.push(L(sc.map((c) => ring(c[0], c[1], 1.8, 0, P, 14)).join(""), { tone: "lo" }));
    out.push(D(sc.map((c) => at([c[0], c[1], 0])), { size: 0.45 }));
    return out.join("");
  }

  // ——————————————————— 负载表盘立柱（柜体右侧，带法兰盘与柱帽） ———————————————————
  function post() {
    const out = [];
    const cx = POST.x + POST.w / 2, cy = POST.y + POST.d / 2; // 52.5, 2.5
    out.push(S(cylinder(cx, cy, 8.5, 0, 2.6, P, 30), { tone: "lo" }));
    out.push(L(ring(cx, cy, 6.6, 2.6, P, 26), { tone: "lo" }));
    out.push(D([0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      return at([cx + 7.4 * Math.cos(a), cy + 7.4 * Math.sin(a), 2.6]);
    }), { size: 0.5 }));
    out.push(S(slabOf(POST, 2.6, 86, P, 2, 0.6), { tone: "mid" }));
    const capPlan = { x: POST.x - 1.5, y: POST.y - 1.5, w: POST.w + 3, d: POST.d + 3, r: 1.5 };
    out.push(S(slabOf(capPlan, 88.6, 3.4, P, 2, 0.5), { tone: "hi" }));
    const cc = corners(capPlan, 1.8);
    out.push(L(cc.map((c) => ring(c[0], c[1], 1, 92, P, 12)).join(""), { tone: "lo" }));
    out.push(D(cc.map((c) => at([c[0], c[1], 92])), { size: 0.4 }));
    return out.join("");
  }

  // ———————————————————————— 机柜本体、顶盖、侧面 ————————————————————————
  function cabinet() {
    const out = [];
    out.push(S(slabOf(CAB, 0, Z_TOP, P, 8, 1.2), { tone: "mid" }));
    // 侧板拼缝（右侧面 x=RIGHT）+ 下部散热横缝
    out.push(L(pathOf([
      at([RIGHT + 0.2, -20, 16]), at([RIGHT + 0.2, 20, 16]),
      at([RIGHT + 0.2, 20, 140]), at([RIGHT + 0.2, -20, 140]),
    ], true), { tone: "faint" }));
    const vents = [];
    for (const z of [22, 28, 34]) vents.push(seg([RIGHT + 0.2, -18, z], [RIGHT + 0.2, 14, z]));
    out.push(L(vents.join(""), { tone: "lo" }));
    return out.join("");
  }

  function cap() {
    const out = [];
    out.push(S(slabOf(CAP, Z_TOP, 6, P, 8, 1), { tone: "hi" }));
    const cc = corners(CAP, 6);
    out.push(D(cc.map((c) => at([c[0], c[1], Z_TOP + 6])), { size: 0.45 }));
    out.push(L(cc.map((c) => ring(c[0], c[1], 1.5, Z_TOP + 6, P, 14)).join(""), { tone: "lo" }));
    // 顶面两条前后加强筋
    out.push(S(slabOf({ x: CAP.x + 8, y: CAP.y + 4, w: CAP.w - 16, d: 4, r: 1 }, Z_TOP + 6, 2.2, P, 2, 0.4), { tone: "mid" }));
    out.push(S(slabOf({ x: CAP.x + 8, y: CAP.y + CAP.d - 8, w: CAP.w - 16, d: 4, r: 1 }, Z_TOP + 6, 2.2, P, 2, 0.4), { tone: "mid" }));
    return out.join("");
  }

  // ———————————— 正面：底部电缆室盖板、上部柜门（铰链/拉手/门锁/铭牌） ————————————
  function front() {
    const out = [];
    // 底部电缆室盖板（电缆自底部穿出）
    out.push(S(prismY(FRONT - 1.2, FRONT + 1.6, DOOR.x0, DOOR.x1, 3, 15), { tone: "lo" }));
    out.push(L(seg([DOOR.x0 + 2, FRONT + 1.8, 13], [DOOR.x1 - 2, FRONT + 1.8, 13]), { tone: "faint" }));
    // 柜门（关闭、微凸）+ 门框缝
    out.push(S(prismY(FRONT - 1, FRONT + 2, DOOR.x0, DOOR.x1, DOOR.z0, DOOR.z1), { tone: "hi" }));
    out.push(L(pathOf([
      at([DOOR.x0 - 1.5, FRONT + 1.8, DOOR.z0 - 1.5]), at([DOOR.x1 + 1.5, FRONT + 1.8, DOOR.z0 - 1.5]),
      at([DOOR.x1 + 1.5, FRONT + 1.8, DOOR.z1 + 1.5]), at([DOOR.x0 - 1.5, FRONT + 1.8, DOOR.z1 + 1.5]),
    ], true), { tone: "faint" }));
    // 铰链（左侧竖排三只）
    for (const z of [102, 118, 134]) {
      out.push(S(prismY(FRONT + 0.4, FRONT + 3, DOOR.x0 - 2.6, DOOR.x0 - 0.6, z, z + 5), { tone: "mid" }));
      out.push(D([at([DOOR.x0 - 1, FRONT + 3.2, z + 2.5])], { size: 0.45 }));
    }
    // 拉手（右侧）：两支座 + 立杆
    for (const z of [114, 128]) {
      out.push(S(prismY(FRONT + 2, FRONT + 5.2, 29.4, 31.8, z - 1.6, z + 1.6), { tone: "mid" }));
    }
    out.push(S(prismY(FRONT + 4.4, FRONT + 5.8, 29.8, 31.4, 112, 130), { tone: "hi" }));
    // 门锁（拉手下方案芯）
    out.push(L(ringSide([30.6, FRONT + 2.4, 107], 2, "y", 20), { tone: "lo" }));
    out.push(D([at([30.6, FRONT + 2.6, 107])], { size: 0.55 }));
    // 铭牌（门左上）：面板 + 三条 rule 线 + 角钉
    out.push(S(prismY(FRONT + 2, FRONT + 2.8, -30, -12, 126, 136), { tone: "lo", crease: "none" }));
    out.push(L([0.32, 0.55, 0.78].map((t) => seg([-28, FRONT + 2.9, 126 + 10 * t], [-14, FRONT + 2.9, 126 + 10 * t])).join(""), { tone: "mid" }));
    out.push(D([
      at([-29, FRONT + 2.9, 127.2]), at([-13, FRONT + 2.9, 127.2]),
      at([-29, FRONT + 2.9, 134.8]), at([-13, FRONT + 2.9, 134.8]),
    ], { size: 0.45 }));
    // 门体与中部面板排之间的分段横缝
    out.push(L(seg([CAB.x + 1.5, FRONT + 0.3, 93], [CAB.x + CAB.w - 1.5, FRONT + 0.3, 93]), { tone: "faint", free: "both" }));
    return out.join("");
  }

  // ———————— 中部开敞面板排：背板 + 主断 + 双汇流排 + 绝缘子 + 四只支路微断 ————————
  function panel() {
    const out = [];
    // 开敞区内凹背板 + 边框线
    out.push(S(prismY(21.5, 24.2, BAY.x0, BAY.x1, BAY.z0, BAY.z1), { tone: "lo", crease: "none" }));
    out.push(L(pathOf([
      at([BAY.x0, 24.3, BAY.z0]), at([BAY.x1, 24.3, BAY.z0]),
      at([BAY.x1, 24.3, BAY.z1]), at([BAY.x0, 24.3, BAY.z1]),
    ], true), { tone: "faint" }));
    // 主断路器（左）：本体 + 大手柄
    out.push(S(prismY(22, 26.2, -30, -6, 70, 88), { tone: "mid" }));
    out.push(S(prismY(26.2, 30.6, -21, -15, 74, 86), { tone: "hi" }));
    out.push(D([at([-18, 30.8, 80])], { size: 0.6, tone: "mid" }));
    // 下引连接排 + 两只电流互感器环
    out.push(S(prismY(22.4, 25, -9.5, -3.5, 67, 70.2), { tone: "hi" }));
    out.push(L(ringSide([-6.5, 25.4, 68.4], 3.8, "y", 24), { tone: "mid" }));
    out.push(L(ringSide([-6.5, 25.4, 68.4], 2.4, "y", 20), { tone: "lo" }));
    out.push(L(ringSide([-6.5, 25.8, 69.6], 2.4, "y", 20), { tone: "lo" }));
    // 水平双汇流排（两条平行铜排，hi 长 prismX）+ 端部封堵
    for (const [z0, z1] of [[BUS.zA0, BUS.zA1], [BUS.zB0, BUS.zB1]]) {
      out.push(S(prismX(BUS.x0, BUS.x1, BUS.y0, BUS.y1, z0, z1), { tone: "hi" }));
      out.push(S(prismX(BUS.x0 - 1.2, BUS.x0, BUS.y0 - 0.4, BUS.y1 + 0.4, z0 - 0.4, z1 + 0.4), { tone: "mid" }));
      out.push(S(prismX(BUS.x1, BUS.x1 + 1.2, BUS.y0 - 0.4, BUS.y1 + 0.4, z0 - 0.4, z1 + 0.4), { tone: "mid" }));
    }
    // 绝缘子支撑（两排错开）
    for (const x of [-18, 10]) out.push(S(cylinder(x, 23.7, 2.2, 54, 4, P, 18), { tone: "mid" }));
    for (const x of [-4, 24]) out.push(S(cylinder(x, 23.7, 2.2, 60, 4, P, 18), { tone: "mid" }));
    // 四只支路微断：本体 + 小手柄 + 下端出线端子 + 角钉；第 3 只整体点亮（唯一 data-lit）
    MCBS.forEach((cx, i) => {
      const lit = i === LIT;
      out.push(S(prismY(21.8, 25.8, cx - 6.5, cx + 6.5, 30, 50), lit ? { tone: "mid", lit: true } : { tone: "mid" }));
      out.push(S(prismY(25.8, 29.6, cx - 1.9, cx + 1.9, 37, 45.5), { tone: "hi" }));
      out.push(S(prismY(24.6, 27.4, cx - 3.2, cx + 3.2, 27.6, 30), { tone: lit ? "hi" : "lo" }));
      out.push(D([
        at([cx - 5.4, 26.1, 31.8]), at([cx + 5.4, 26.1, 31.8]),
        at([cx - 5.4, 26.1, 48.2]), at([cx + 5.4, 26.1, 48.2]),
      ], { size: 0.45 }));
    });
    return out.join("");
  }

  // ———————————— 出线电缆：微断底部 → 底部穿出 → 垂到地板 → 走线（wireSvg） ————————————
  function cables() {
    return ROUTES.map((r) =>
      wireSvg(at([r.x, 28.2, 30]), at([r.end, r.lane, 1]), {
        via: [at([r.x, r.lane, 30]), at([r.x, r.lane, 1])],
        tone: r.tone,
        size: 1.3,
      }),
    ).join("");
  }

  // ———— 第 3 支路电缆上的流条（flow 虚线，静态画好，运行时只决定前几组可见） ————
  function flow() {
    const out = [];
    for (let i = 0; i < MAX_STRANDS; i++) {
      const dy = (i - (MAX_STRANDS - 1) / 2) * 1.3; // 沿走线道微微散开
      const dz = 0.5 + Math.abs(i - (MAX_STRANDS - 1) / 2) * 0.35;
      const pts = [at([9, 36 + dy, 29]), at([9, 36 + dy, dz]), at([66, 36 + dy, dz]), at([66, 36, 1])];
      out.push(
        `<g data-strand="${i}">` +
          L(pathOf(pts), { tone: "lit", flow: true }) +
          D([pts[0]], { size: 0.5, tone: "mid" }) +
          "</g>",
      );
    }
    return out.join("");
  }

  // ————————————— 末端机柜剪影（与第 3 支路一起点亮；data-lit 全图只留给微断） —————————————
  function rack() {
    const out = [];
    for (const [fx, fy] of byDepth(corners(RACK, 2.2).map((c) => [c[0], c[1], 0]))) {
      out.push(S(prismY(fy - 1.4, fy + 1.4, fx - 1.4, fx + 1.4, 0, 2.4), { tone: "lo" }));
    }
    out.push(S(slabOf(RACK, 2.4, 39.6, P, 4, 0.8), { tone: "mid", className: "pdu-rack" }));
    const F = RACK.y + RACK.d; // 42
    // 正面 UNIT 横缝 + 中缝 + 状态灯 + 竖把手
    const slots = [];
    for (const z of [9, 16, 23, 30, 37]) slots.push(seg([RACK.x + 2.5, F + 0.3, z], [RACK.x + RACK.w - 2.5, F + 0.3, z]));
    out.push(L(slots.join(""), { tone: "lo" }));
    out.push(L(seg([RACK.x + RACK.w / 2, F + 0.3, 4.5], [RACK.x + RACK.w / 2, F + 0.3, 39.5]), { tone: "faint" }));
    out.push(D([at([RACK.x + 3.6, F + 0.4, 39.6]), at([RACK.x + 6.2, F + 0.4, 39.6])], { size: 0.7, tone: "hi" }));
    out.push(S(prismY(F - 0.6, F + 1.2, RACK.x + RACK.w - 4.6, RACK.x + RACK.w - 3, 18, 30), { tone: "hi" }));
    // 顶盖螺钉
    const rc = corners(RACK, 3);
    out.push(L(rc.map((c) => ring(c[0], c[1], 0.9, 42, P, 12)).join(""), { tone: "lo" }));
    return out.join("");
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
    out.push(S(cylinder(center[0], center[1], 2.2, center[2] - R + 1, 2.4, P, 18), { tone: "mid" }));
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
  // 计划增量红刻标：落在当前负载 + 计划 pp 的位置（越线时进入红弧区）
  function plannedTickAt(center, axis, R, share) {
    const a = ((225 - clamp(share, 0, 1) * 270) * Math.PI) / 180;
    return pathOf([
      at(facePoint(center, axis, (R - 6.8) * Math.cos(a), (R - 6.8) * Math.sin(a))),
      at(facePoint(center, axis, (R - 1.6) * Math.cos(a), (R - 1.6) * Math.sin(a))),
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
        "planned",
        L(plannedTickAt(G_C, "y", GAUGE_R, clamp(d.projected / 100, 0, 1)), { tone: "red", className: "pdu-needle", free: "end" }),
      ),
    );
    out.push(
      dyn(
        "needle",
        L(needleAt(G_C, "y", GAUGE_R, d.share), { tone: "hi", className: "pdu-needle", free: "start" }) +
          D([at(facePoint(G_C, "y", 0, 0))], { size: 0.8, tone: "hi" }),
      ),
    );
    // 数显窗：支路负载率大字 + 百分号小字（dyn，运行时改 textContent）
    out.push(S(prismY(6.4, 7.4, LCD.x0, LCD.x1, LCD.z0, LCD.z1), { tone: "lo", crease: "none" }));
    const mtx = (x, z) => sideMatrix([x, 7.5], z, P, "left");
    out.push(
      dyn(
        "lcd",
        faceTextSvg(mtx(LCD.x0 + 1.1, 46.6), d.load.toFixed(0), { size: 4.8, tone: "hi" }) +
          faceTextSvg(mtx(LCD.x0 + 6.2, 43.4), "%", { size: 2.4, tone: "mid" }),
      ),
    );
    // 状态灯：运行（常亮暗点）+ 告警（dyn 红点，计划越线时亮）
    out.push(D([at([50.2, 7.2, 36.6])], { size: 0.9, tone: "mid" }));
    out.push(L(ringSide([53.6, 6.9, 36.6], 1.8, "y", 18), { tone: "lo" }));
    out.push(dyn("led", D([at([53.6, 7.2, 36.6])], { size: 0.9, tone: "red" }), d.over ? "" : ` opacity="0.12"`));
    return out.join("");
  }

  function buildParts() {
    return [
      { name: "base", svg: base(), anchor: [0, 0, -PLATE_H] },
      { name: "cabinet", svg: cabinet(), anchor: [CAB.x + CAB.w / 2, 0, Z_TOP / 2] },
      { name: "cap", svg: cap(), anchor: [CAB.x + CAB.w / 2, 0, Z_TOP + 3] },
      { name: "front", svg: front(), anchor: [0, FRONT, 120] },
      { name: "panel", svg: panel(), anchor: [0, 23, 55] },
      // 立柱比柜体右侧板更靠近观察者：必须后画，否则柱身被侧板盖住只剩表盘悬空
      { name: "post", svg: post(), anchor: [52.5, 2.5, 46] },
      { name: "rack", svg: rack(), anchor: [RACK.x + RACK.w / 2, RACK.y + RACK.d / 2, 21] },
      { name: "cables", svg: cables(), anchor: [9, 36, 15] },
      { name: "flow", svg: flow(), anchor: [9, 36, 15] },
      { name: "meter", svg: meter(derive({})), anchor: G_C },
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
        `等距示意的落地配电柜：上门板关闭，中部开敞面板排内主断路器、双汇流排与四只支路微断清晰可见。` +
        `第三支路（高亮）电缆带流至末端机柜，负载表读 ${d.load.toFixed(0)}%，规划线 ${d.threshold.toFixed(0)}%，计划 +${d.planned}pp 后 ${d.projected.toFixed(0)}%。`,
      body: STATIC + meter(d),
      standalone: opts.standalone || false,
      className: "pdu-figure",
    });
  }

  function text(d) {
    return `B 支路负载 ${d.load.toFixed(0)}% · 规划线 ${d.threshold.toFixed(0)}% · 计划 +${d.planned}pp→${d.projected.toFixed(0)}%${d.over ? " · 超规划线" : ""}`;
  }
  const readout = (m) => text(derive(m));

  const CSS = `
.pdu-plate{position:relative;width:100%;max-width:660px;margin:0 auto}
.pdu-needle{stroke-width:1.1}
.pdu-readout{font:600 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted,#6f7d94);margin:8px 2px 0;letter-spacing:.2px}
/* 末端机柜剪影与第 3 支路一起点亮：复刻 data-lit 的填色（全图 data-lit 只保留微断一处） */
.pdu-figure .pdu-rack>.iso-fill{fill:var(--anatomy-face)}
.pdu-figure .pdu-rack>.iso-shade{fill:var(--anatomy-lit-shade)}
.pdu-figure .pdu-rack>.iso-top{fill:var(--anatomy-lit-top)}
.pdu-figure .pdu-rack>.iso-edge{stroke:var(--anatomy-lit)}
`;

  function mount(el, model, opts = {}) {
    if (global.__pduCurrent) global.__pduCurrent.destroy();
    // .iso 这一层不能省：--anatomy-* 变量定义在它上面，缺了它所有填充都取不到色
    el.innerHTML = `<style>${CSS}</style><div class="iso" data-theme="${opts.theme || "light"}"><div class="pdu-plate"><div class="pdu-stage">${buildSvg(model)}</div><p class="pdu-readout" data-readout>${text(derive(model))}</p></div></div>`;
    const stage = el.querySelector(".pdu-stage");
    const out = el.querySelector("[data-readout]");
    const needleEl = stage.querySelector('[data-dyn="needle"] .iso-line');
    const plannedEl = stage.querySelector('[data-dyn="planned"] .iso-line');
    const lcdText = stage.querySelector('[data-dyn="lcd"] text');
    const ledGroup = stage.querySelector('[data-dyn="led"]');
    const strands = [...stage.querySelectorAll("[data-strand]")];
    const still = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let want = derive(model);
    let shown = { ...want };
    let raf = 0, last = 0, visible = true, lastLine = "";
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px" });
    io.observe(stage);

    function paint() {
      if (needleEl) needleEl.setAttribute("d", needleAt(G_C, "y", GAUGE_R, clamp(shown.load / 100, 0, 1)));
      if (plannedEl) plannedEl.setAttribute("d", plannedTickAt(G_C, "y", GAUGE_R, clamp((shown.load + want.planned) / 100, 0, 1)));
      if (lcdText) lcdText.textContent = shown.load.toFixed(0);
      if (ledGroup) ledGroup.style.opacity = shown.over ? "1" : "0.12";
      const n = clamp(Math.ceil(clamp(shown.load / 100, 0, 1) * MAX_STRANDS), 1, MAX_STRANDS);
      for (let i = 0; i < strands.length; i++) {
        const o = i < n ? (i === n - 1 ? 0.45 : 1) : 0;
        if (strands[i].style.opacity !== String(o)) strands[i].style.opacity = String(o);
      }
      const next = text(shown);
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
      destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; io.disconnect(); if (global.__pduCurrent === ctrl) global.__pduCurrent = null; },
    };
    global.__pduCurrent = ctrl;
    run();
    return ctrl;
  }

  global.PduFigure = { derive, buildSvg, readout, mount, needleAt, parts: () => PART_ORDER.map((p) => ({ name: p.name, anchor: p.anchor, svg: p.svg })), width: WIDTH, height: HEIGHT };
})(typeof window !== "undefined" ? window : globalThis);
