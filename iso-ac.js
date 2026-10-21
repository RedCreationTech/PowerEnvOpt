/*
 * iso-ac.js —— 机房精密空调整机示意监测图（anatomy 技能风格，纯 SVG，无 WebGL）。
 *
 * 造型：通用房间级精密空调整机 —— 落地机柜 + 前上部回风格栅 + 正面抽拉滤网（lit 主体）
 * + 前下部下送风百叶出口 + 右上控制面板（数码显示窗、运行/告警灯、两只表计：
 * 滤网压差与进风温度）。一眼能认出是空调，同时保留"滤网脏 → 压差升 → 风量少 → 温度超警戒"
 * 的完整故障机理。
 *
 * 一句话机理：回风从前上部格栅进入 → 穿过滤网 → 换热后由前下部百叶送出；
 * 滤网越脏，压差表指针越高、穿过滤网的风条越少，进风温度跟着往上爬。
 *
 * 图里每个数字都来自调用方传入的同一份场景模型（workflows.js 的 CASES.cooling）：
 * 温度序列、复测序列、警戒线、压差两端与复测压差都由入参给，本文件不自带演示数值。
 *
 * 性能约定：静态图只在挂载时生成一次；换状态时只写 2 个指针的 d、数码管 text、
 * 告警灯 opacity、6 组风条的 opacity、1 个积灰组的 opacity 和读数文本 —— 不在每帧重建整段 SVG。
 *
 * 依赖 iso-kit.js / iso-kit.css（经典脚本与全局样式）。用法：
 *   AcFigure.mount(container, model) → 控制器（.set(model) 换状态，.destroy() 卸载）
 *   AcFigure.buildSvg(model)         → 整段 <svg> 字符串（Node 自检与静态导出用）
 */
(function (global) {
  const WIDTH = 520;
  const HEIGHT = 540;

  // —— 世界坐标：x 向右，y 向后，z 向上；1 单位 ≈ 1 cm ——
  const CAB = { x: -46, y: -30, w: 92, d: 60, r: 4 };
  const Z_TOP = 182;
  const CAP = { x: CAB.x - 3, y: CAB.y - 3, w: CAB.w + 6, d: CAB.d + 6, r: 4 };
  const PLATE = { x: -52, y: -36, w: 100, d: 68, r: 3 };
  const PLATE_H = 8;
  const FOOT_H = 6;
  const FRONT = CAB.y + CAB.d;
  const RIGHT = CAB.x + CAB.w;
  const MAX_STREAMS = 6;
  const TEMP_LO = 18;
  const TEMP_SPAN = 16;
  const DP_FULL = 200;

  // 前部分区（正面 y=FRONT 平面上，x 从左到右）：左列回风/送风，右列面板
  const GRILLE = { x0: -36, x1: 8, z0: 130, z1: 168 }; // 回风格栅开口
  const OUTLET = { x0: -36, x1: 8, z0: 14, z1: 88 }; // 下送风百叶开口
  const BEZEL = { x0: 10, x1: 42, z0: 56, z1: 170 }; // 右列控制面板（略凸起）
  const TRAY = { x0: -32, x1: 4, y1: FRONT + 16, z0: 98, z1: 124 }; // 抽出的滤网托盘
  const DP_C = [26, BEZEL_ZY(), 122];
  const T_C = [26, BEZEL_ZY(), 78];
  function BEZEL_ZY() {
    return FRONT + 3.6;
  }
  const GAUGE_R = 10.5;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /**
   * 演示口径（写进图注，不当作实测风量）：压差从干净值往上走时，
   * 可见风条按线性比例减少、最少留 2 条；积灰不透明度同向增大。
   */
  function derive(m) {
    const series = m.series || [];
    const after = m.after || [];
    const live = m.recovered && after.length ? after : series;
    const idx = clamp(m.index == null ? live.length - 1 : m.index, 0, Math.max(0, live.length - 1));
    const dpClean = m.dpFrom ?? 70;
    const dpAlarm = m.dpTo ?? 145;
    const temp = live[idx] ?? live.at(-1) ?? 0;
    const dp = m.recovered ? (m.dpRecovered ?? dpClean) : lerp(dpClean, dpAlarm, live.length > 1 ? idx / (live.length - 1) : 1);
    const dust = clamp((dp - dpClean) / Math.max(1, dpAlarm - dpClean), 0, 1);
    const share = clamp(1 - (dp - dpClean) / Math.max(1, (m.dpAlarmFull ?? 2) * (dpAlarm - dpClean)), 0.3, 1);
    const threshold = m.threshold ?? 28;
    return {
      temp,
      dp,
      dpClean,
      dpAlarm,
      threshold,
      load: lerp(m.loadFrom ?? 61, m.loadTo ?? 62, live.length > 1 ? idx / (live.length - 1) : 1),
      recovered: !!m.recovered,
      dust,
      share,
      streams: Math.max(2, Math.round(MAX_STREAMS * share)),
      over: temp > threshold,
    };
  }

  // 取景用两遍法：先按临时投影画一遍，再从真实产出的坐标里回收包围盒重画。
  const CAMERA = { pad: 22, azimuth: 40, elevation: 33 };
  let P = fitProjection(
    [...boxCorners(PLATE, -PLATE_H - FOOT_H - 1, 0), ...boxCorners(CAB, 0, Z_TOP + 8)],
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

  /**
   * 沿 x 轴扫掠的长方体（立式面板，主视面朝 +x）。
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
    for (const [x, y] of byDepth(corners(PLATE, 15).map((c) => [c[0], c[1], 0]))) {
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

  // ———————————————————————— 机柜本体、顶盖、侧面 ————————————————————————
  function cabinet() {
    const out = [];
    out.push(S(slabOf(CAB, 0, Z_TOP, P, 8, 1.2), { tone: "mid" }));
    // 正面分段门缝：左列回风/送风与右列面板之间两道竖缝
    for (const sx of [GRILLE.x0 - 2, BEZEL.x0 - 2]) {
      out.push(L(pathOf([at([sx, FRONT + 0.2, 6]), at([sx, FRONT + 0.2, 176])], false), { tone: "faint", free: "both" }));
    }
    // 踢脚板
    out.push(S(prismY(FRONT - 1.4, FRONT + 1.6, GRILLE.x0 - 2, BEZEL.x1 + 2, 6, 12.5), { tone: "hi" }));
    return out.join("");
  }

  function cap() {
    const out = [];
    out.push(S(slabOf(CAP, Z_TOP, 8, P, 8, 1), { tone: "hi" }));
    const cc = corners(CAP, 6);
    out.push(D(cc.map((c) => at([c[0], c[1], Z_TOP + 8])), { size: 0.45 }));
    out.push(L(cc.map((c) => ring(c[0], c[1], 1.6, Z_TOP + 8, P, 14)).join(""), { tone: "lo" }));
    // 顶面风扇网罩：两圈同心环 + 放射筋，读作顶置风机Deck
    const cx = 0, cy = -2;
    out.push(L(ring(cx, cy, 15, Z_TOP + 8, P, 40), { tone: "lo" }));
    out.push(L(ring(cx, cy, 23, Z_TOP + 8, P, 44), { tone: "faint" }));
    const spokes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spokes.push(seg([cx + 15 * Math.cos(a), cy + 15 * Math.sin(a), Z_TOP + 8], [cx + 23 * Math.cos(a), cy + 23 * Math.sin(a), Z_TOP + 8]));
    }
    out.push(L(spokes.join(""), { tone: "faint" }));
    return out.join("");
  }

  function side() {
    const out = [];
    // 侧板门缝（右侧面 x=RIGHT）
    out.push(L(pathOf([
      at([RIGHT + 0.2, -22, 12]), at([RIGHT + 0.2, 24, 12]),
      at([RIGHT + 0.2, 24, 176]), at([RIGHT + 0.2, -22, 176]),
    ], true), { tone: "faint" }));
    // 三个铰链，沿侧面前缘竖排
    for (const z of [36, 96, 156]) {
      out.push(S(prismX(RIGHT - 0.6, RIGHT + 2.2, 24, 28, z, z + 6), { tone: "mid" }));
      out.push(D([at([RIGHT + 2.2, 26, z + 3])], { size: 0.45 }));
    }
    // 内嵌拉手：两个支座 + 一根立杆
    for (const z of [92, 110]) {
      out.push(S(prismX(RIGHT - 0.4, RIGHT + 2.4, -21, -17, z - 2, z + 2), { tone: "mid" }));
    }
    out.push(S(prismX(RIGHT + 1.2, RIGHT + 3, -20, -18, 90, 112), { tone: "hi" }));
    // 铭牌：面板 + 三条 rule 线 + 角钉
    out.push(S(prismX(RIGHT - 0.4, RIGHT + 0.8, -14, 12, 128, 146), { tone: "lo", crease: "none" }));
    out.push(L([0.32, 0.55, 0.78].map((t) => seg([RIGHT + 0.9, -11, 128 + 18 * t], [RIGHT + 0.9, 9, 128 + 18 * t])).join(""), { tone: "mid" }));
    out.push(D([at([RIGHT + 0.9, -12.5, 129.5]), at([RIGHT + 0.9, 10.5, 129.5]), at([RIGHT + 0.9, -12.5, 144.5]), at([RIGHT + 0.9, 10.5, 144.5])], { size: 0.45 }));
    // 下部进风格栅缝
    const vents = [];
    for (const z of [20, 25, 30]) vents.push(seg([RIGHT + 0.2, -24, z], [RIGHT + 0.2, 18, z]));
    out.push(L(vents.join(""), { tone: "lo" }));
    return out.join("");
  }

  // ————————————————— 正面：回风格栅、送风百叶、控制面板 —————————————————
  function frontFace() {
    const out = [];
    // 回风格栅：凹槽 + 横條 + 边框
    out.push(S(prismY(FRONT - 3, FRONT - 0.4, GRILLE.x0, GRILLE.x1, GRILLE.z0, GRILLE.z1), { tone: "lo", crease: "none" }));
    for (let z = GRILLE.z0 + 4; z <= GRILLE.z1 - 4; z += 5.2) {
      out.push(S(prismY(FRONT - 0.4, FRONT + 2.6, GRILLE.x0 + 1.5, GRILLE.x1 - 1.5, z, z + 2.1), { tone: "mid", crease: "none" }));
    }
    // 送风百叶：凹槽 + 斜叶片（前缘略低的平行四边形）+ 边框
    out.push(S(prismY(FRONT - 3, FRONT - 0.4, OUTLET.x0, OUTLET.x1, OUTLET.z0, OUTLET.z1), { tone: "lo", crease: "none" }));
    for (let z = OUTLET.z0 + 6; z <= OUTLET.z1 - 6; z += 12.5) {
      out.push(S(louverY(z), { tone: "mid" }));
    }
    // 开口边框（四角框条）
    for (const o of [GRILLE, OUTLET]) {
      const t = 2.4, p = FRONT + 1;
      out.push(S(prismY(p - 1, p + t, o.x0 - t, o.x1 + t, o.z1 - 0.5, o.z1 + t), { tone: "hi" }));
      out.push(S(prismY(p - 1, p + t, o.x0 - t, o.x1 + t, o.z0 - t, o.z0 + 0.5), { tone: "hi" }));
      out.push(S(prismY(p - 1, p + t, o.x0 - t, o.x0 + 0.5, o.z0, o.z1), { tone: "hi" }));
      out.push(S(prismY(p - 1, p + t, o.x1 - 0.5, o.x1 + t, o.z0, o.z1), { tone: "hi" }));
    }
    // 右列控制面板（略凸起）：表计底座 + 显示窗 + 指示灯
    out.push(S(prismY(FRONT - 1, FRONT + 3, BEZEL.x0, BEZEL.x1, BEZEL.z0, BEZEL.z1), { tone: "mid" }));
    out.push(S(prismY(FRONT + 2.4, FRONT + 3.4, BEZEL.x0 + 3, BEZEL.x1 - 3, BEZEL.z1 - 24, BEZEL.z1 - 6), { tone: "lo", crease: "none" }));
    // 运行灯（常绿）与告警灯（dyn，超警戒时亮）
    out.push(D([at([BEZEL.x0 + 5, FRONT + 3.6, BEZEL.z0 + 6])], { size: 0.9, tone: "hi" }));
    out.push(dyn("led", D([at([BEZEL.x0 + 10, FRONT + 3.6, BEZEL.z0 + 6])], { size: 0.9, tone: "red" })));
    out.push(L(seg([BEZEL.x0 + 13.5, FRONT + 3.5, BEZEL.z0 + 6], [BEZEL.x1 - 4, FRONT + 3.5, BEZEL.z0 + 6]), { tone: "faint" }));
    return out.join("");
  }

  // 一片下送风百叶：前缘压低的平行六面体（沿 x 通长）
  function louverY(zBack) {
    const V = (x, y, z) => iso([x, y, z], P);
    const x0 = OUTLET.x0 + 1.5, x1 = OUTLET.x1 - 1.5;
    const y0 = FRONT - 0.4, y1 = FRONT + 4.6;
    const z0 = zBack, z1 = zBack + 2.2, drop = 2.6;
    const all = [
      V(x0, y0, z0), V(x1, y0, z0), V(x0, y0, z1), V(x1, y0, z1),
      V(x0, y1, z0 - drop), V(x1, y1, z0 - drop), V(x0, y1, z1 - drop), V(x1, y1, z1 - drop),
    ];
    const hull = pathOf(convexHull(all), true);
    // 主视面 = 朝 +y 的斜面（前缘低）
    const top = pathOf(oriented([V(x0,y1,z0-drop), V(x1,y1,z0-drop), V(x1,y1,z1-drop), V(x0,y1,z1-drop)]), true);
    const shades = [];
    shades[1] = pathOf(oriented([V(x0,y0,z1), V(x1,y0,z1), V(x1,y1,z1-drop), V(x0,y1,z1-drop)]), true);
    shades[2] = pathOf(oriented([V(x1,y0,z0), V(x1,y1,z0-drop), V(x1,y1,z1-drop), V(x1,y0,z1)]), true);
    const crease =
      pathOf([V(x1,y1,z1-drop), V(x1,y1,z0-drop)], false) +
      pathOf([V(x1,y1,z1-drop), V(x0,y1,z1-drop)], false) +
      pathOf([V(x1,y1,z1-drop), V(x1,y0,z1)], false);
    return { fill: hull, shades, top, crease, outline: hull };
  }

  // ——————————— 抽拉式滤网托盘（唯一 lit 主体）：从正面抽出，积灰 dyn ———————————
  function filterTray() {
    const out = [];
    // 机内滑道残余（托盘抽出后留在柜内的两节轨）
    for (const z of [TRAY.z0 - 1.6, TRAY.z1 + 0.4]) {
      out.push(S(prismY(FRONT - 8, FRONT - 1, TRAY.x0 - 2, TRAY.x1 + 2, z, z + 1.4), { tone: "lo", crease: "none" }));
    }
    // 托盘底 + 四壁（开口顶，看得见滤网介质）：仅正面板为 lit 主体，其余 hi
    const t = 2, y0 = FRONT - 2, y1 = TRAY.y1;
    out.push(S(slabOf({ x: TRAY.x0, y: y0, w: TRAY.x1 - TRAY.x0, d: y1 - y0, r: 1 }, TRAY.z0, t, P, 3, 0.4), { tone: "hi" }));
    out.push(S(prismY(y0, y1, TRAY.x0, TRAY.x0 + t, TRAY.z0, TRAY.z1), { tone: "hi" }));
    out.push(S(prismY(y0, y1, TRAY.x1 - t, TRAY.x1, TRAY.z0, TRAY.z1), { tone: "hi" }));
    out.push(S(prismX(TRAY.x0, TRAY.x1, y1 - t, y1, TRAY.z0, TRAY.z1), { tone: "hi", lit: true }));
    out.push(S(prismX(TRAY.x0, TRAY.x1, y0, y0 + t, TRAY.z0, TRAY.z1), { tone: "mid" }));
    // 折褶滤网介质（顶面开口内）：沿 y 的竖褶
    const pleats = [];
    for (let x = TRAY.x0 + 3; x <= TRAY.x1 - 3; x += 3.6) {
      pleats.push(seg([x, y0 + t + 0.6, TRAY.z0 + 2.4], [x, y1 - t - 0.6, TRAY.z0 + 2.4]));
    }
    out.push(L(pleats.join(""), { tone: "lo" }));
    // 积灰：介质面上一组短纹，运行时只改这个组的 opacity
    const dust = [];
    for (let x = TRAY.x0 + 2.5; x <= TRAY.x1 - 2.5; x += 5.2) {
      for (let y = y0 + 4; y <= y1 - 4; y += 6) {
        dust.push(seg([x, y, TRAY.z0 + 2.6], [x + 1.8, y + 1.6, TRAY.z0 + 2.6]));
      }
    }
    out.push(dyn("dust", L(dust.join(""), { tone: "mid" })));
    // 前面拉手
    const hx = (TRAY.x0 + TRAY.x1) / 2;
    out.push(S(prismX(TRAY.x0 + 3, TRAY.x1 - 3, y1, y1 + 1.6, (TRAY.z0 + TRAY.z1) / 2 - 1.6, (TRAY.z0 + TRAY.z1) / 2 + 1.6), { tone: "mid" }));
    out.push(L(ringSide([hx, y1 + 2.2, (TRAY.z0 + TRAY.z1) / 2], 2.4, "y", 20), { tone: "lo" }));
    // 四角螺钉
    out.push(D([
      at([TRAY.x0 + 1.2, y1 + 0.4, TRAY.z0 + 1.2]), at([TRAY.x1 - 1.2, y1 + 0.4, TRAY.z0 + 1.2]),
      at([TRAY.x0 + 1.2, y1 + 0.4, TRAY.z1 - 1.2]), at([TRAY.x1 - 1.2, y1 + 0.4, TRAY.z1 - 1.2]),
    ], { size: 0.45 }));
    return out.join("");
  }

  // ———————————————————————— 表计、数码管与指针 ————————————————————————
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
  function gauges(d) {
    const out = [];
    out.push(gaugeBody(DP_C, "y", GAUGE_R));
    out.push(alarmArc(DP_C, "y", GAUGE_R, 225 - (d.dpAlarm / DP_FULL) * 270, (d.dpAlarm / DP_FULL) * 270 - 45));
    out.push(
      dyn(
        "needle-dp",
        L(needleAt(DP_C, "y", GAUGE_R, d.dp / DP_FULL), { tone: "hi", className: "ac-needle", free: "start" }) +
          D([at(facePoint(DP_C, "y", 0, 0))], { size: 0.8, tone: "hi" }),
      ),
    );
    out.push(gaugeBody(T_C, "y", GAUGE_R));
    out.push(
      alarmArc(
        T_C,
        "y",
        GAUGE_R,
        225 - ((d.threshold - TEMP_LO) / TEMP_SPAN) * 270,
        ((TEMP_SPAN - (d.threshold - TEMP_LO)) / TEMP_SPAN) * 270,
      ),
    );
    out.push(
      dyn(
        "needle-temp",
        L(needleAt(T_C, "y", GAUGE_R, (d.temp - TEMP_LO) / TEMP_SPAN), { tone: "hi", className: "ac-needle", free: "start" }) +
          D([at(facePoint(T_C, "y", 0, 0))], { size: 0.8, tone: "hi" }),
      ),
    );
    // 数码管：当前进风温度大字 + 单位小字（dyn，运行时改 textContent）
    const mtx = (x, z) => sideMatrix([x, FRONT + 3.5], z, P, "left");
    out.push(
      dyn(
        "display",
        faceTextSvg(mtx(BEZEL.x0 + 5, BEZEL.z1 - 11), d.temp.toFixed(1), { size: 5.2, tone: "hi" }) +
          faceTextSvg(mtx(BEZEL.x0 + 5, BEZEL.z1 - 16.5), "°C", { size: 2.6, tone: "mid" }),
      ),
    );
    return out.join("");
  }

  // ———— 气流：6 组风条（入栅/出窗交替），静态画好，运行时只决定前几组可见 ————
  function streams() {
    const out = [];
    for (let i = 0; i < MAX_STREAMS; i++) {
      const t = i / (MAX_STREAMS - 1);
      if (i % 2 === 0) {
        // 回风：从顶盖上方落入回风格栅
        const x = lerp(GRILLE.x0 + 6, GRILLE.x1 - 6, t);
        out.push(
          `<g data-stream="${i}">` +
            L(pathOf([at([x, FRONT + 1.5, 197]), at([x, FRONT + 1.5, GRILLE.z1 + 1])], false), { tone: "mid", flow: true, free: "start" }) +
            D([at([x, FRONT + 1.5, 197])], { size: 0.6, tone: "mid" }) +
            "</g>",
        );
      } else {
        // 送风：从百叶前缘涌出，向前下方铺开
        const x = lerp(OUTLET.x0 + 6, OUTLET.x1 - 6, t);
        out.push(
          `<g data-stream="${i}">` +
            L(
              pathOf(
                [
                  at([x, FRONT + 4.5, OUTLET.z0 + 16]),
                  at([x, FRONT + 9, OUTLET.z0 + 8]),
                  at([x, FRONT + 16, OUTLET.z0 - 2]),
                ],
                false,
              ),
              { tone: "mid", flow: true, free: "end" },
            ) +
            D([at([x, FRONT + 16, OUTLET.z0 - 2])], { size: 0.6, tone: "mid" }) +
            "</g>",
        );
      }
    }
    return out.join("");
  }

  function buildParts() {
    return [
      { name: "base", svg: base(), anchor: [0, 0, -PLATE_H] },
      { name: "cabinet", svg: cabinet(), anchor: [CAB.x + CAB.w / 2, CAB.y + CAB.d / 2, Z_TOP / 2] },
      { name: "side", svg: side(), anchor: [RIGHT, 0, Z_TOP / 2] },
      { name: "front", svg: frontFace(), anchor: [0, FRONT, Z_TOP / 2] },
      { name: "cap", svg: cap(), anchor: [0, 0, Z_TOP + 4] },
      { name: "filter", svg: filterTray(), anchor: [(TRAY.x0 + TRAY.x1) / 2, TRAY.y1, (TRAY.z0 + TRAY.z1) / 2] },
      { name: "gauges", svg: gauges(derive({})), anchor: [26, FRONT, 100] },
      { name: "streams", svg: streams(), anchor: [0, FRONT + 8, 100] },
    ];
  }
  // 两遍取景：先用初始投影画一遍，回收真实包围盒重定 P，再全部重画
  let PART_ORDER = buildParts();
  refit(PART_ORDER.map((p) => p.svg).join(""));
  PART_ORDER = buildParts();
  const STATIC = PART_ORDER.filter((p) => p.name !== "gauges").map((p) => p.svg).join("");

  function buildSvg(m, opts = {}) {
    const d = derive(m);
    return figureSvg({
      width: opts.width || WIDTH,
      height: opts.height || HEIGHT,
      label:
        `等距示意的机房精密空调整机：前上部回风格栅进风，穿过滤网（高亮托盘）换热后由前下部百叶送出。` +
        `滤网压差表读 ${d.dp.toFixed(0)} 帕，进风温度 ${d.temp.toFixed(1)} 摄氏度，警戒线 ${d.threshold} 摄氏度。`,
      body: STATIC + gauges(d),
      standalone: opts.standalone || false,
      className: "ac-figure",
    });
  }

  function text(d) {
    return `压差 ${d.dp.toFixed(0)} Pa · 进风 ${d.temp.toFixed(1)} °C · 气流 ${d.streams}/${MAX_STREAMS} 条${d.over ? " · 超警戒" : ""}`;
  }
  const readout = (m) => text(derive(m));

  const CSS = `
.ac-plate{position:relative;width:100%;max-width:660px;margin:0 auto}
.ac-needle{stroke-width:1.1}
.ac-readout{font:600 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted,#6f7d94);margin:8px 2px 0;letter-spacing:.2px}
`;

  function mount(el, model, opts = {}) {
    if (global.__acCurrent) global.__acCurrent.destroy();
    // .iso 这一层不能省：--anatomy-* 变量定义在它上面，缺了它所有填充都取不到色
    el.innerHTML = `<style>${CSS}</style><div class="iso" data-theme="${opts.theme || "light"}"><div class="ac-plate"><div class="ac-stage">${buildSvg(model)}</div><p class="ac-readout" data-readout>${text(derive(model))}</p></div></div>`;
    const stage = el.querySelector(".ac-stage");
    const out = el.querySelector("[data-readout]");
    const needleDp = stage.querySelector('[data-dyn="needle-dp"] .iso-line');
    const needleTemp = stage.querySelector('[data-dyn="needle-temp"] .iso-line');
    const dustGroup = stage.querySelector('[data-dyn="dust"]');
    const ledGroup = stage.querySelector('[data-dyn="led"]');
    const displayText = stage.querySelector('[data-dyn="display"] text');
    const streams = [...stage.querySelectorAll("[data-stream]")];
    const still = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let want = derive(model);
    let shown = { ...want };
    let raf = 0, last = 0, visible = true, lastLine = "";
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px" });
    io.observe(stage);

    function paint() {
      if (needleDp) needleDp.setAttribute("d", needleAt(DP_C, "y", GAUGE_R, shown.dp / DP_FULL));
      if (needleTemp) needleTemp.setAttribute("d", needleAt(T_C, "y", GAUGE_R, (shown.temp - TEMP_LO) / TEMP_SPAN));
      if (dustGroup) dustGroup.style.opacity = shown.dust.toFixed(2);
      if (ledGroup) ledGroup.style.opacity = shown.over ? "1" : "0.12";
      if (displayText) displayText.textContent = shown.temp.toFixed(1);
      const n = Math.max(2, Math.round(MAX_STREAMS * clamp(1 - (shown.dp - want.dpClean) / Math.max(1, (want.dpAlarm - want.dpClean) * 2), 0.3, 1)));
      for (let i = 0; i < streams.length; i++) {
        const o = i < n ? (i === n - 1 ? 0.45 : 1) : 0;
        if (streams[i].style.opacity !== String(o)) streams[i].style.opacity = String(o);
      }
      const next = text({ ...shown, streams: n, over: shown.temp > want.threshold });
      if (next !== lastLine) { lastLine = next; out.textContent = next; }
    }
    function tick(now) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const k2 = still.matches ? 1 : 1 - Math.exp(-dt / 0.5);
      shown = { ...want, temp: lerp(shown.temp, want.temp, k2), dp: lerp(shown.dp, want.dp, k2) };
      shown.dust = clamp((shown.dp - want.dpClean) / Math.max(1, want.dpAlarm - want.dpClean), 0, 1);
      shown.over = shown.temp > want.threshold;
      paint();
      const settled = Math.abs(shown.temp - want.temp) < 0.02 && Math.abs(shown.dp - want.dp) < 0.2;
      raf = visible && !settled ? requestAnimationFrame(tick) : 0;
    }
    function run() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } }
    paint();
    const ctrl = {
      set(m2) { model = m2; want = derive(m2); run(); },
      destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; io.disconnect(); if (global.__acCurrent === ctrl) global.__acCurrent = null; },
    };
    global.__acCurrent = ctrl;
    run();
    return ctrl;
  }

  global.AcFigure = { derive, buildSvg, readout, mount, needleAt, parts: () => PART_ORDER.map((p) => ({ name: p.name, anchor: p.anchor, svg: p.svg })), width: WIDTH, height: HEIGHT };
})(typeof window !== "undefined" ? window : globalThis);
