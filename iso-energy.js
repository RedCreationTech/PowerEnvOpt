/*
 * iso-energy.js —— 空调能耗机理教学机示意监测图（anatomy 技能风格，纯 SVG，无 WebGL）。
 *
 * 造型：风冷压缩冷凝教学机组 —— 公共底座上，卧式压缩机（圆柱筒身 + 双端盖 + 减振弹簧脚
 * + 顶部接线盒，唯一 lit 主体）经排气管路接风冷冷凝器（翅片块 + 顶部轴流风扇护罩圈），
 * 再经干燥过滤器、细长毛细管到板式蒸发器（立板 + 盘管），吸气管路沿底座边回到压缩机，
 * 构成一条看得见流向的制冷剂循环；压缩机电源电缆沿底座前沿走线，接入面板式功率表盘
 * （0–24 kW，红弧从 15 kW 起）。一眼能认出是制冷循环教学机，同时保留
 * "同负载下压缩机越费力 → 输入功率越超基线"的完整能耗机理。
 *
 * 一句话机理：制冷剂沿管路循环搬运热量，同负载下压缩机做功越多，电缆上的功率表指针越高、
 * 管路上可见的 flow 流段越多，输入功率相对同负载基线的超出百分比越大。
 *
 * 图里每个数字都来自调用方传入的同一份场景模型（workflows.js 的 CASES.energy）：
 * 功率序列、复测序列、告警阈值、同负载基线都由入参给，本文件不自带演示数值。
 *
 * 性能约定：静态图只在挂载时生成一次；换状态时只写 1 根指针的 d、数码管 text、
 * 告警灯 opacity、8 段 flow 虚线的 opacity 和读数文本 —— 不在每帧重建整段 SVG。
 *
 * 依赖 iso-kit.js / iso-kit.css（经典脚本与全局样式）。用法：
 *   EnergyFigure.mount(container, model) → 控制器（.set(model) 换状态，.destroy() 卸载）
 *   EnergyFigure.buildSvg(model)         → 整段 <svg> 字符串（Node 自检与静态导出用）
 */
(function (global) {
  const WIDTH = 520;
  const HEIGHT = 540;

  // —— 世界坐标：x 向右，y 向后，z 向上；1 单位 ≈ 1 cm ——
  const PLATE = { x: -56, y: -42, w: 112, d: 84, r: 3 };
  const PLATE_H = 7;
  const FOOT_H = 6;
  const Z_TOP = 44; // 取景上界（吸气管 40 + 风扇护圈余量）

  // 压缩机（卧式，筒身沿 x 轴）
  const BARREL = { x0: -48, x1: -16, cy: -22, cz: 14, r: 10 };
  const COMP = { x0: -48, x1: -16, y0: -32, y1: -12 };
  // 冷凝器（后右）与顶置风扇
  const COND = { x: 6, y: -38, w: 42, d: 24, r: 2 };
  const COND_H = 32;
  const FAN = { cx: 27, cy: -26 };
  // 干燥过滤器
  const DRIER = { x: 36, y: 8, r: 3.5, z0: 2, z1: 14 };
  // 板式蒸发器（前左立板 + 盘管）
  const EVAP = { x0: -48, x1: -14, y0: 22, y1: 25.5, z0: 4, z1: 38 };
  const COIL = { x0: -44, x1: -18, cy: 34, cz: 20, r: 6, turns: 8 };
  // 功率表（前面板：表盘 + 数码窗 + 告警灯）
  const METER = { x0: 24, x1: 46, y0: 22, y1: 32, z0: 5, z1: 32 };
  const PED = { x: 23, y: 21, w: 24, d: 14, r: 2 };
  const GAUGE_R = 9;
  const G_C = [35, 32.3, 22.5];
  // 量程与 flow 分段
  const GAUGE_MAX = 24;
  const MAX_FLOW = 8;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /**
   * 演示口径：flow 可见段数按功率占量程比例线性给，最少留 2 段；
   * exceed 为相对同负载基线的超出百分比。
   */
  function derive(m) {
    const series = m.series || [];
    const after = m.after || [];
    const live = m.recovered && after.length ? after : series;
    const idx = clamp(m.index == null ? live.length - 1 : m.index, 0, Math.max(0, live.length - 1));
    const kw = live[idx] ?? live.at(-1) ?? 0;
    const baseline = m.baseline ?? 12;
    const threshold = m.threshold ?? 15;
    const exceed = baseline > 0 ? ((kw - baseline) / baseline) * 100 : 0;
    return {
      kw,
      baseline,
      threshold,
      exceed,
      recovered: !!m.recovered,
      over: kw > threshold,
      flowSegs: clamp(Math.round((kw / GAUGE_MAX) * MAX_FLOW), 2, MAX_FLOW),
    };
  }

  // 取景用两遍法：先按临时投影画一遍，再从真实产出的坐标里回收包围盒重画。
  const CAMERA = { pad: 22, azimuth: 40, elevation: 33 };
  let P = fitProjection(boxCorners(PLATE, -PLATE_H - FOOT_H - 1, Z_TOP), WIDTH, HEIGHT, CAMERA);
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
   * 沿 x 轴扫掠的圆柱（卧式筒身/端盖）：extrude 的 x 轴版，
   * 圆环位于 y-z 平面，返回 solidSvg 可用的 {fill,outline,crease,top,shades}。
   */
  function barrelX(x0, x1, cy, cz, r, steps = 26) {
    const ring = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ring.push([cy + r * Math.cos(a), cz + r * Math.sin(a)]); // [y, z]
    }
    const count = ring.length;
    const W = (x, p) => [x, p[0], p[1]];
    const top = ring.map((p) => iso(W(x1, p), P));
    const bottom = ring.map((p) => iso(W(x0, p), P));
    // CCW 圆环（y-z 面）的外法向 = (0, dz, -dy)/len
    const normals = ring.map((p, i) => {
      const q = ring[(i + 1) % count];
      const dy = q[0] - p[0], dz = q[1] - p[1];
      const len = Math.hypot(dy, dz) || 1;
      return [0, dz / len, -dy / len];
    });
    const facing = normals.map((n) => depthOf(n, P) > 1e-9);
    const outline = [];
    const crease = [];
    for (const run of runsOf(facing, false)) outline.push(pathOf(run.map((i) => top[i])));
    for (const run of runsOf(facing, true)) {
      crease.push(pathOf(run.map((i) => top[i])));
      if (x1 > x0) outline.push(pathOf(run.map((i) => bottom[i])));
    }
    if (x1 > x0) {
      for (let i = 0; i < count; i++) {
        if (facing[(i + count - 1) % count] !== facing[i]) outline.push(pathOf([top[i], bottom[i]]));
      }
    }
    const fill = pathOf(convexHull([...top, ...bottom]), true);
    const cosA = Math.cos((CAMERA.azimuth * Math.PI) / 180);
    const buckets = Array.from({ length: SHADES }, () => []);
    for (let i = 0; i < count; i++) {
      if (!facing[i]) continue;
      const lit = (normals[i][1] * cosA + 1) / 2;
      const shade = Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
      const nx = (i + 1) % count;
      buckets[shade].push(pathOf(oriented([top[i], top[nx], bottom[nx], bottom[i]]), true));
    }
    return { fill, outline: outline.join(""), crease: crease.join(""), top: pathOf(oriented(top), true), shades: buckets };
  }

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
    for (const [x, y] of byDepth(corners(PLATE, 15).map((c) => [c[0], c[1], 0]))) {
      out.push(S(cylinder(x, y, 5.4, -PLATE_H - FOOT_H, 2, P, 22), { tone: "lo" }));
      out.push(S(cylinder(x, y, 3.3, -PLATE_H - FOOT_H + 2, FOOT_H + PLATE_H - 1.8, P, 20), { tone: "lo" }));
    }
    out.push(S(slabOf(PLATE, -PLATE_H, PLATE_H, P, 6, 1), { tone: "mid" }));
    out.push(L(planOutline(insetPlan(PLATE, 4.5), 0, P), { tone: "faint" }));
    const sc = corners(PLATE, 7);
    out.push(L(sc.map((c) => ring(c[0], c[1], 1.8, 0, P, 14)).join(""), { tone: "lo" }));
    out.push(D(sc.map((c) => at([c[0], c[1], 0])), { size: 0.45 }));
    // 底座铭牌（右上空区）：面板 + 三条 rule 线 + 角钉
    const NP = { x: 38, y: -10, w: 16, d: 9, r: 1 };
    out.push(S(slabOf(NP, 0, 1, P, 4), { tone: "hi" }));
    out.push(L([8.5, 5, -3].map((yy) => seg([40, yy, 1.2], [52, yy, 1.2])).join(""), { tone: "mid" }));
    out.push(D([at([39.5, -9, 1.2]), at([52.5, -9, 1.2]), at([39.5, -2, 1.2]), at([52.5, -2, 1.2])], { size: 0.45 }));
    return out.join("");
  }

  // ———————————— 卧式压缩机（唯一 lit 主体）：筒身 + 端盖 + 弹簧脚 + 接线盒 ————————————
  function compressor() {
    const out = [];
    // 减振弹簧脚 ×4：底垫 + 四层叠环（立式弹簧用叠环读作簧圈）
    for (const [fx, fy] of byDepth([[-43, -28], [-39, -16], [-25, -28], [-21, -16]])) {
      out.push(S(slabOf({ x: fx - 2.6, y: fy - 2.6, w: 5.2, d: 5.2, r: 0.8 }, 0, 1.4, P, 3), { tone: "lo" }));
      for (let i = 0; i < 4; i++) out.push(L(ringSide([fx, fy, 2.4 + i * 1.05], 3.1, "x", 18), { tone: "mid" }));
    }
    // 鞍座 ×2（筒身卧在鞍座里）
    for (const sx of [-44, -26]) {
      out.push(S(slabOf({ x: sx, y: -30, w: 8, d: 16, r: 1.5 }, 6, 5, P, 4), { tone: "mid" }));
    }
    // 筒身（lit）：沿 x 轴的圆柱
    out.push(S(barrelX(BARREL.x0, BARREL.x1, BARREL.cy, BARREL.cz, BARREL.r), { tone: "hi", lit: true }));
    // 外壁环缝两道（读作桶身焊接段）
    for (const sx of [-40, -24]) {
      out.push(L(ringSide([sx, BARREL.cy, BARREL.cz], BARREL.r + 0.25, "x", 30), { tone: "lo" }));
    }
    // 曲轴端盖（左，两级凸台）
    out.push(S(barrelX(-50.2, -48, BARREL.cy, BARREL.cz, BARREL.r + 0.6, 26), { tone: "hi" }));
    out.push(S(barrelX(-52, -50.2, BARREL.cy, BARREL.cz, 5, 20), { tone: "mid" }));
    // 电机端盖（右）+ 端面内环 + 6 颗端盖螺栓
    out.push(S(barrelX(-16, -14.6, BARREL.cy, BARREL.cz, BARREL.r + 0.6, 26), { tone: "hi" }));
    out.push(L(ringSide([-14.6, BARREL.cy, BARREL.cz], 8, "x", 28), { tone: "lo" }));
    const bolts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      bolts.push(at([-14.5, BARREL.cy + 7.2 * Math.cos(a), BARREL.cz + 7.2 * Math.sin(a)]));
    }
    out.push(D(bolts, { size: 0.5 }));
    // 排气接管（筒顶）+ 曲轴箱端吸气嘴（朝 -x 的阶梯喷嘴，吸气管端落嘴上）
    out.push(S(cylinder(-20, -22, 2.5, 24, 3, P, 16), { tone: "mid" }));
    out.push(S(barrelX(-54.4, -52, BARREL.cy, BARREL.cz, 4, 20), { tone: "mid" }));
    // 顶部接线盒 + 盒盖 + 角钉 + 电缆格兰头
    out.push(S(slabOf({ x: -40, y: -28, w: 12, d: 12, r: 1.5 }, 24, 5, P, 4, 0.5), { tone: "mid" }));
    out.push(S(slabOf({ x: -40.6, y: -28.6, w: 13.2, d: 13.2, r: 1.8 }, 29, 1.2, P, 4), { tone: "hi" }));
    out.push(D([at([-39, -26.5, 30.4]), at([-29, -26.5, 30.4]), at([-39, -17.5, 30.4]), at([-29, -17.5, 30.4])], { size: 0.45 }));
    out.push(S(prismY(-17, -14.6, -35.6, -32.4, 25.8, 27.2), { tone: "lo", crease: "none" }));
    out.push(D([at([-34, -14.2, 26.5])], { size: 0.9, tone: "mid" }));
    // 鞍座铭牌：面板 + 三条 rule 线
    out.push(S(prismY(-14, -12.6, -25, -21, 7.5, 10.5), { tone: "lo", crease: "none" }));
    out.push(L([8.2, 9, 9.8].map((z) => seg([-24.6, -12.4, z], [-21.4, -12.4, z])).join(""), { tone: "mid" }));
    return out.join("");
  }

  // ———————————— 风冷冷凝器（后右）：翅片块 + 顶部轴流风扇护罩圈 ————————————
  function condenser() {
    const out = [];
    out.push(S(slabOf(COND, 0, COND_H, P, 6, 1), { tone: "mid" }));
    const rx = COND.x + COND.w; // 右端面
    const fy = COND.y + COND.d; // 前面
    // 右端面竖翅片
    const finsX = [];
    for (let y = COND.y + 2; y <= fy - 2; y += 2.2) finsX.push(seg([rx + 0.2, y, 2], [rx + 0.2, y, COND_H - 2]));
    out.push(L(finsX.join(""), { tone: "lo" }));
    // 前面竖翅片
    const finsF = [];
    for (let x = COND.x + 2; x <= rx - 2; x += 2.2) finsF.push(seg([x, fy + 0.2, 2], [x, fy + 0.2, COND_H - 2]));
    out.push(L(finsF.join(""), { tone: "lo" }));
    // 顶面翅片棱线
    const finsT = [];
    for (let x = COND.x + 2; x <= rx - 2; x += 2.2) finsT.push(seg([x, COND.y + 2, COND_H + 0.2], [x, fy - 2, COND_H + 0.2]));
    out.push(L(finsT.join(""), { tone: "faint" }));
    // 顶部轴流风扇：电机 + 轮毂环 + 三道护罩圈 + 放射筋 + 支柱
    out.push(S(cylinder(FAN.cx, FAN.cy, 5.5, COND_H, 6, P, 26), { tone: "hi" }));
    out.push(L(ring(FAN.cx, FAN.cy, 2.2, COND_H + 6.4, P, 24), { tone: "mid" }));
    out.push(L(ring(FAN.cx, FAN.cy, 9, COND_H + 7.5, P, 36), { tone: "lo" }));
    out.push(L(ring(FAN.cx, FAN.cy, 13, COND_H + 7.5, P, 40), { tone: "lo" }));
    out.push(L(ring(FAN.cx, FAN.cy, 17, COND_H + 7.5, P, 44), { tone: "faint" }));
    const spokes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spokes.push(seg([FAN.cx + 2.4 * Math.cos(a), FAN.cy + 2.4 * Math.sin(a), COND_H + 7.5], [FAN.cx + 17 * Math.cos(a), FAN.cy + 17 * Math.sin(a), COND_H + 7.5]));
    }
    out.push(L(spokes.join(""), { tone: "faint" }));
    for (const a of [Math.PI / 6, (Math.PI * 5) / 6, (Math.PI * 3) / 2]) {
      out.push(S(cylinder(FAN.cx + 12 * Math.cos(a), FAN.cy + 12 * Math.sin(a), 0.8, COND_H + 6, 1.5, P, 10), { tone: "lo" }));
    }
    return out.join("");
  }

  // ———————————— 干燥过滤器（冷凝器出口与毛细管之间的小筒） ————————————
  function drier() {
    const out = [];
    out.push(S(cylinder(DRIER.x, DRIER.y, DRIER.r, DRIER.z0, DRIER.z1 - DRIER.z0, P, 22), { tone: "mid" }));
    out.push(L(ringSide([DRIER.x, DRIER.y, 5.5], DRIER.r + 0.3, "y", 24), { tone: "lo" }));
    out.push(L(ringSide([DRIER.x, DRIER.y, 11], DRIER.r + 0.3, "y", 24), { tone: "lo" }));
    out.push(D([at([DRIER.x, DRIER.y, DRIER.z1])], { size: 0.9, tone: "mid" }));
    return out.join("");
  }

  // ———————————— 板式蒸发器（前左）：立板 + 边框 + 翅片线 + 盘管 ————————————
  function evaporator() {
    const out = [];
    // 盘管后半（贴在板前，先画后半再画板，穿板处被板遮住）
    const coilBack = coil(COIL.x0, COIL.x1, [COIL.cy, COIL.cz], COIL.r, COIL.turns, "x", P, 16);
    out.push(L(coilBack.back, { tone: "mid" }));
    // 立板 + 四边边框条
    out.push(S(prismY(EVAP.y0, EVAP.y1, EVAP.x0, EVAP.x1, EVAP.z0, EVAP.z1), { tone: "mid" }));
    const bz0 = EVAP.z0, bz1 = EVAP.z1, bx0 = EVAP.x0, bx1 = EVAP.x1, by = EVAP.y1;
    const t = 2.4;
    out.push(S(prismY(by, by + 2, bx0 - t, bx1 + t, bz1 - 0.5, bz1 + t), { tone: "hi" }));
    out.push(S(prismY(by, by + 2, bx0 - t, bx1 + t, bz0 - t, bz0 + 0.5), { tone: "hi" }));
    out.push(S(prismY(by, by + 2, bx0 - t, bx0 + 0.5, bz0, bz1), { tone: "hi" }));
    out.push(S(prismY(by, by + 2, bx1 - 0.5, bx1 + t, bz0, bz1), { tone: "hi" }));
    // 板面水平翅片线（边框内）
    const fins = [];
    for (let z = bz0 + 4; z <= bz1 - 4; z += 3.2) fins.push(seg([bx0 + 3, by + 2.2, z], [bx1 - 3, by + 2.2, z]));
    out.push(L(fins.join(""), { tone: "faint" }));
    // 盘管前半 + 支承钉
    out.push(L(coilBack.front, { tone: "mid" }));
    out.push(D([at([-42, 28.4, 16]), at([-42, 28.4, 26]), at([-20, 28.4, 16]), at([-20, 28.4, 26])], { size: 0.5 }));
    return out.join("");
  }

  // ———— 制冷剂管路：静态管 + 8 段 flow 虚线（dyn，运行时只改 opacity） ————
  // 回路：压缩机排气 → 冷凝器 → 干燥过滤器 → 毛细管 → 蒸发器 → 吸气回压缩机
  const PIPES = {
    dis0: [[-20, -22, 27], [-20, -22, 30]], // 排气立管
    dis1: [[-20, -22, 30], [6, -22, 30]], // 排气横管（入冷凝器左端面）
    liq2: [[36, -14, 6], [36, 8, 6]], // 液管（冷凝器前面 → 干燥器）
    liq3: [[36, 8, 6], [36, 8, 14]], // 入干燥器顶
    cap4: [[36, 8, 2], [36, 20, 2], [28, 20, 2]], // 毛细管出干燥器底
    cap5: [[20, 20, 2], [-44, 20, 2], [-44, 28, 2], [-44, 33, 6], [-44, 38, 12], [-44, 39.6, 18]], // 毛细管至蒸发器进口
    suc6: [[-18, 39.5, 21], [-18, 41, 21], [-18, 41, 4], [-53.5, 41, 4]], // 蒸发器出口下行，沿底座前沿贴地左行
    suc7: [[-53.5, 41, 4], [-53.5, -24, 4], [-53.5, -24, 14]], // 左缘纵管绕到曲轴箱端，上行入吸气嘴
  };
  const flowSeg = (i, pts, on) =>
    `<g data-dyn="flow" data-seg="${i}" style="opacity:${on ? 1 : 0}">` +
    L(pathOf(pts.map(at)), { tone: "mid", flow: true }) +
    D([at(pts[pts.length - 1])], { size: 0.7, tone: "mid" }) +
    `</g>`;
  function pipes(d) {
    const out = [];
    // 静态管（弯头处点焊点）
    out.push(L(pathOf(PIPES.dis0.concat(PIPES.dis1.slice(1)).map(at)), { tone: "mid" }));
    out.push(L(pathOf(PIPES.liq2.concat(PIPES.liq3.slice(1)).map(at)), { tone: "mid" }));
    out.push(L(pathOf(PIPES.cap4.concat(PIPES.cap5.slice(1)).map(at)), { tone: "mid" }));
    out.push(L(pathOf(PIPES.suc6.concat(PIPES.suc7.slice(1)).map(at)), { tone: "mid" }));
    const joints = [
      [-20, -22, 30], [6, -22, 30], [36, -14, 6], [36, 8, 6], [36, 8, 14], [36, 8, 2],
      [36, 20, 2], [28, 20, 2], [20, 20, 2], [-44, 20, 2], [-44, 28, 2],
      [-18, 41, 4], [-53.5, 41, 4], [-53.5, -24, 14],
    ];
    out.push(D(joints.map(at), { size: 1.1, tone: "lo" }));
    // 毛细管中段盘绕段（缠在回气管上的感温包式盘圈）
    const capCoil = coil(28, 20, [20, 5.5], 3.5, 5, "x", P, 14);
    out.push(L(capCoil.back + capCoil.front, { tone: "mid" }));
    // flow 虚线：功率越高可见段越多
    const segs = [PIPES.dis0, PIPES.dis1, PIPES.liq2, PIPES.liq3, PIPES.cap4, PIPES.cap5, PIPES.suc6, PIPES.suc7];
    for (let i = 0; i < MAX_FLOW; i++) out.push(flowSeg(i, segs[i], i < d.flowSegs));
    return out.join("");
  }

  // ———————————— 功率表（前右）：底座 + 面板盒 + 表盘 + 数码窗 + 告警灯 ————————————
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
    // 指针轴毂：贴在表盘面上的小圆环（不用 z 轴圆柱，避免在面板上戳出凸块）
    out.push(L(ringSide(center, 2.2, axis, 22), { tone: "mid" }));
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
  function meterFace(d) {
    const out = [];
    // 表盘：0–24 kW，红弧从 threshold 起
    out.push(gaugeBody(G_C, "y", GAUGE_R));
    out.push(
      alarmArc(G_C, "y", GAUGE_R, 225 - (d.threshold / GAUGE_MAX) * 270, (1 - d.threshold / GAUGE_MAX) * 270),
    );
    out.push(
      dyn(
        "needle",
        L(needleAt(G_C, "y", GAUGE_R, d.kw / GAUGE_MAX), { tone: "hi", className: "energy-needle", free: "start" }) +
          D([at(facePoint(G_C, "y", 0, 0))], { size: 0.8, tone: "hi" }),
      ),
    );
    // 数码窗：当前输入功率（dyn，运行时改 textContent）
    const mtxV = sideMatrix([28.2, 32.55], 9.5, P, "left");
    const mtxU = sideMatrix([37, 32.55], 9.1, P, "left");
    out.push(
      dyn(
        "display",
        faceTextSvg(mtxV, d.kw.toFixed(1), { size: 3.4, tone: "hi" }) +
          faceTextSvg(mtxU, "kW", { size: 2.2, tone: "mid" }),
      ),
    );
    // 告警灯（dyn，超阈值亮）
    out.push(dyn("led", D([at([42.5, 32.6, 9.5])], { size: 0.9, tone: "red" })));
    return out.join("");
  }
  function meter() {
    const out = [];
    out.push(S(slabOf(PED, 0, 5, P, 5, 0.8), { tone: "mid" }));
    out.push(S(prismY(METER.y0, METER.y1, METER.x0, METER.x1, METER.z0, METER.z1), { tone: "hi" }));
    // 数码窗凹槽
    out.push(S(prismY(31.9, 32.5, 27, 39, 6.5, 11.5), { tone: "lo", crease: "none" }));
    // 盒面四角螺钉
    out.push(D([
      at([25.5, 32.2, 7]), at([44.5, 32.2, 7]), at([25.5, 32.2, 30]), at([44.5, 32.2, 30]),
    ], { size: 0.5 }));
    // 电缆格兰头（盒面右下）
    out.push(S(prismY(32, 34.2, 33.5, 36.5, 26.8, 29.2), { tone: "lo", crease: "none" }));
    return out.join("");
  }

  // ———————————— 压缩机电源电缆：接线盒 → 沿底座前沿 → 功率表 ————————————
  function cable() {
    const pts = [
      [-34, -14.2, 26.5], [-34, -10, 26.5], [-34, -10, 2], [-34, 36.5, 2],
      [35, 36.5, 2], [35, 36.5, 28], [35, 32.6, 28],
    ];
    const d = pathOf(pts.map(at));
    return (
      `<g class="iso-wire" data-tone="lo">` +
      L(d, { tone: "lo" }) +
      `<circle class="iso-wire-end" cx="${at(pts[0])[0].toFixed(1)}" cy="${at(pts[0])[1].toFixed(1)}" r="1.2"/>` +
      `<circle class="iso-wire-end" cx="${at(pts.at(-1))[0].toFixed(1)}" cy="${at(pts.at(-1))[1].toFixed(1)}" r="1.2"/>` +
      `</g>`
    );
  }

  function buildParts() {
    return [
      { name: "base", svg: base(), anchor: [0, 0, -PLATE_H] },
      { name: "condenser", svg: condenser(), anchor: [FAN.cx, FAN.cy, COND_H / 2] },
      { name: "compressor", svg: compressor(), anchor: [BARREL.x0, BARREL.cy, BARREL.cz] },
      { name: "evaporator", svg: evaporator(), anchor: [(EVAP.x0 + EVAP.x1) / 2, EVAP.y1, 20] },
      { name: "drier", svg: drier(), anchor: [DRIER.x, DRIER.y, 8] },
      { name: "pipes", svg: pipes(derive({})), anchor: [-20, 8, 20] },
      { name: "meter", svg: meter(), anchor: [35, 32, 18] },
      { name: "meterFace", svg: meterFace(derive({})), anchor: [35, 32, 18] },
      { name: "cable", svg: cable(), anchor: [0, 36.5, 2] },
    ];
  }
  // 两遍取景：先用初始投影画一遍，回收真实包围盒重定 P，再全部重画
  let PART_ORDER = buildParts();
  refit(PART_ORDER.map((p) => p.svg).join(""));
  PART_ORDER = buildParts();
  // 动态段（pipes/meterFace）插在静态前段（底座到干燥器）与静态尾段之间，
  // 遮挡关系：管路被表盒遮住 → 表盘面画在表盒上 → 电缆最上层入表
  const STATIC_HEAD = PART_ORDER.filter((p) => !["pipes", "meterFace", "meter", "cable"].includes(p.name)).map((p) => p.svg).join("");
  const METER_BOX = PART_ORDER.find((p) => p.name === "meter").svg;
  const CABLE = PART_ORDER.find((p) => p.name === "cable").svg;

  function buildSvg(m, opts = {}) {
    const d = derive(m);
    return figureSvg({
      width: opts.width || WIDTH,
      height: opts.height || HEIGHT,
      label:
        `等距示意的空调制冷循环教学机：卧式压缩机（高亮筒身）经排气管路接风冷冷凝器，再经干燥过滤器、` +
        `毛细管到板式蒸发器，吸气管路沿底座回到压缩机。压缩机电源电缆上的功率表读 ${d.kw.toFixed(1)} 千瓦，` +
        `同负载基线 ${d.baseline.toFixed(1)} 千瓦，告警阈值 ${d.threshold} 千瓦。`,
      body: STATIC_HEAD + pipes(d) + METER_BOX + meterFace(d) + CABLE,
      standalone: opts.standalone || false,
      className: "energy-figure",
    });
  }

  const fmt1 = (v) => String(Math.round(v * 10) / 10);
  function text(d) {
    return (
      `输入功率 ${fmt1(d.kw)} kW · 同负载基线 ${fmt1(d.baseline)} kW · 超基线 ${Math.round(d.exceed)}%` +
      (d.recovered ? " · 复测通过" : d.over ? " · 超功率警戒" : "")
    );
  }
  const readout = (m) => text(derive(m));

  const CSS = `
.energy-plate{position:relative;width:100%;max-width:660px;margin:0 auto}
.energy-needle{stroke-width:1.1}
.energy-readout{font:600 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted,#6f7d94);margin:8px 2px 0;letter-spacing:.2px}
`;

  function mount(el, model, opts = {}) {
    if (global.__energyCurrent) global.__energyCurrent.destroy();
    // .iso 这一层不能省：--anatomy-* 变量定义在它上面，缺了它所有填充都取不到色
    el.innerHTML = `<style>${CSS}</style><div class="iso" data-theme="${opts.theme || "light"}"><div class="energy-plate"><div class="energy-stage">${buildSvg(model)}</div><p class="energy-readout" data-readout>${text(derive(model))}</p></div></div>`;
    const stage = el.querySelector(".energy-stage");
    const out = el.querySelector("[data-readout]");
    const needle = stage.querySelector('[data-dyn="needle"] .iso-line');
    const ledGroup = stage.querySelector('[data-dyn="led"]');
    const displayText = stage.querySelector('[data-dyn="display"] text');
    const flows = [...stage.querySelectorAll('[data-dyn="flow"]')];
    const still = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let want = derive(model);
    let shown = { ...want };
    let raf = 0, last = 0, visible = true, lastLine = "";
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px" });
    io.observe(stage);

    function paint() {
      if (needle) needle.setAttribute("d", needleAt(G_C, "y", GAUGE_R, shown.kw / GAUGE_MAX));
      if (ledGroup) ledGroup.style.opacity = shown.over ? "1" : "0.12";
      if (displayText) displayText.textContent = shown.kw.toFixed(1);
      const n = clamp(Math.round((shown.kw / GAUGE_MAX) * MAX_FLOW), 2, MAX_FLOW);
      for (let i = 0; i < flows.length; i++) {
        const o = i < n ? 1 : 0;
        if (flows[i].style.opacity !== String(o)) flows[i].style.opacity = String(o);
      }
      const next = text({ ...shown, over: shown.kw > want.threshold });
      if (next !== lastLine) { lastLine = next; out.textContent = next; }
    }
    function tick(now) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const k2 = still.matches ? 1 : 1 - Math.exp(-dt / 0.5);
      shown = { ...want, kw: lerp(shown.kw, want.kw, k2) };
      shown.over = shown.kw > want.threshold;
      paint();
      const settled = Math.abs(shown.kw - want.kw) < 0.01;
      raf = visible && !settled ? requestAnimationFrame(tick) : 0;
    }
    function run() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } }
    paint();
    const ctrl = {
      set(m2) { model = m2; want = derive(m2); run(); },
      destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; io.disconnect(); if (global.__energyCurrent === ctrl) global.__energyCurrent = null; },
    };
    global.__energyCurrent = ctrl;
    run();
    return ctrl;
  }

  global.EnergyFigure = { derive, buildSvg, readout, mount, needleAt, parts: () => PART_ORDER.map((p) => ({ name: p.name, anchor: p.anchor, svg: p.svg })), width: WIDTH, height: HEIGHT };
})(typeof window !== "undefined" ? window : globalThis);
