/*
 * iso-dg.js —— 柴油发电机组启动蓄电池欠压示意监测图（anatomy 技能风格，纯 SVG，无 WebGL）。
 *
 * 造型：撬装开架机组 —— 型钢撬座 + 减震底脚上从左到右一字排开：启动蓄电池组（2 只 12V
 * 串联电池盒 + 正负极柱 + 跨接电缆，第一只高亮）→ 启动马达（小圆柱筒身 + 前端齿圈 hint
 * + 顶部电磁开关）→ 发动机（缸体 + 圆形检视盖 + 缸盖凸包排 + 燃油滤清器 + 进气空滤罐）
 * → 联轴器（双法兰 + 螺栓圈）→ 发电机（圆柱筒身 + 纵向散热筋 + 端部圆形端盖 + 顶部接线盒）
 * → 输出断路器盒（铭牌 + 小手柄 + 出缆）。排烟管从缸盖顶上行至消音器盒，尾端带防雨帽。
 * 旁边控制箱面板上有启动电压表盘（0–40V，225°）、数显窗与欠压指示灯。
 *
 * 一句话机理：启动蓄电池经电缆向启动马达放电 —— 端电压越低，电缆上可见的电流段越少
 * （马达带不动）；机组起动后发动机经联轴器拖动发电机，电力经接线盒送入输出断路器。
 * 表盘指针与数显读启动电压，指针跌进表盘低端的欠压红弧区即"欠压告警"，复测恢复后回落。
 *
 * 图里每个数字都来自调用方传入的同一份场景模型（workflows.js 的 CASES.battery）：
 * 序列按"启动蓄电池电压 V"呈现（0–40V 量程），复测序列、欠压线与是否复测都由入参给，
 * 本文件不自带演示数值；recovered 时优先取 m.recoveredValue（模拟维护后电压恢复）。
 *
 * 性能约定：静态图只在挂载时生成一次；换状态时只写表针的 d、数显 text、告警灯 opacity、
 * 5 组启动电流段的 opacity 和读数文本 —— 不在每帧重建整段 SVG。
 *
 * 依赖 iso-kit.js / iso-kit.css（经典脚本与全局样式）。用法：
 *   DgFigure.mount(container, model) → 控制器（.set(model) 换状态，.destroy() 卸载）
 *   DgFigure.buildSvg(model)         → 整段 <svg> 字符串（Node 自检与静态导出用）
 */
(function (global) {
  const WIDTH = 520;
  const HEIGHT = 540;

  // —— 世界坐标：x 向右，y 向后，z 向上；1 单位 ≈ 1 cm ——
  const PLATE = { x: -74, y: -22, w: 166, d: 46, r: 3 }; // 型钢撬座 x -74..92, y -22..24
  const PLATE_H = 8;
  const FOOT_H = 6;
  const RANGE = 40;      // 表盘量程 0–40 V
  const MAX_SEGS = 5;    // 启动回路上限流条段数（演示口径，非实测电流）
  const BAT = { y0: -12, y1: 10, z1: 22, w: 18 }; // 电池盒共用尺寸
  const B1 = { x0: -70 };                        // 第一只（高亮）
  const B2 = { x0: -49 };                        // 第二只
  const CB = { x0: -30, x1: -10, y0: 10, y1: 22, z1: 30 }; // 控制箱（表盘/数显/指示灯所在）
  const G_C = [-20, CB.y1, 19];                  // 表盘圆心（面朝 +y）
  const GAUGE_R = 8.5;
  const LCD = { x0: -26, x1: -14, z0: 3.5, z1: 8 };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (v) => String(Math.round(v * 10) / 10); // 31→"31"，27.2→"27.2"

  /**
   * 演示口径：volts 取 live[idx]（recovered 时优先取 m.recoveredValue，否则复测序列末值）；
   * 欠压判定 volts < threshold（欠压区在表盘低端）；可见电流段数随电压线性增减，最少 1 段。
   */
  function derive(m) {
    const series = m.series || [];
    const after = m.after || [];
    const idx = clamp(m.index == null ? Math.max(0, series.length - 1) : m.index, 0, Math.max(0, series.length - 1));
    const recovered = !!m.recovered;
    const fallback = after[after.length - 1] ?? series[series.length - 1] ?? 0;
    const raw = recovered ? (Number.isFinite(m.recoveredValue) ? m.recoveredValue : fallback) : (series[idx] ?? series[series.length - 1] ?? 0);
    const volts = Number.isFinite(raw) ? raw : 0;
    const threshold = m.threshold ?? 25;
    return {
      volts,
      threshold,
      recovered,
      over: volts < threshold,
      share: clamp(volts / RANGE, 0, 1),
      strands: clamp(Math.ceil(clamp(volts / RANGE, 0, 1) * MAX_SEGS), 1, MAX_SEGS),
    };
  }

  // 取景用两遍法：先按临时投影画一遍，再从真实产出的坐标里回收包围盒重画。
  const CAMERA = { pad: 22, azimuth: 40, elevation: 33 };
  let P = fitProjection(
    [
      ...boxCorners(PLATE, -PLATE_H - FOOT_H - 1, 0),
      ...boxCorners({ x: -70, y: -12, w: 39, d: 22 }, 0, BAT.z1 + 2),
      ...boxCorners({ x: 14, y: -13, w: 36, d: 26 }, 0, 36),
      ...boxCorners({ x: 58, y: -11.5, w: 31, d: 23 }, 0, 40),
      [48.6, 2, 54], [2, 2, 35], [-26, 16, 35], [CB.x0, CB.y0, CB.z1], [-20, CB.y1, 29],
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

  /**
   * 沿 x 轴的圆柱（启动马达/发电机筒身/排烟管等横放圆件）。
   * 仿 kit extrude 的画法：侧面按光向分四阶着色，右端盖盘面作 top，左端环 + 轮廓素线作 outline。
   */
  function cylX(x0, x1, cy, z0, z1, r, steps = 40) {
    const ring = [];
    const cz = (z0 + z1) / 2;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ring.push([cy + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
    const counter = signedArea(ring) > 0;
    const { sinA, cosA, sinE, cosE } = cameraOf(P);
    const tv = [sinA * cosE, sinE]; // y-z 平面内朝向观察者的深度梯度
    const L2 = [cosA, 0.62];        // 简化光向（+y、+z 受光）
    const n2 = Math.hypot(tv[0], tv[1]);
    const nl = Math.hypot(L2[0], L2[1]);
    const count = steps;
    const normals = ring.map(([ay, az], i) => {
      const [by, bz] = ring[(i + 1) % count];
      const dy = by - ay, dz = bz - az;
      const len = Math.hypot(dy, dz) || 1;
      return counter ? [dz / len, -dy / len] : [-dz / len, dy / len];
    });
    const facing = normals.map(([ny, nz]) => (ny * tv[0] + nz * tv[1]) / n2 > 1e-9);
    const left = ring.map(([y, z]) => at([x0, y, z]));
    const right = ring.map(([y, z]) => at([x1, y, z]));
    const buckets = Array.from({ length: SHADES }, () => []);
    for (const run of runsOf(facing, true)) {
      for (let k = run[0]; k < run[run.length - 1]; k++) {
        const j = (k + 1) % count;
        const lit = (normals[k][0] * L2[0] + normals[k][1] * L2[1]) / nl;
        const bucket = Math.min(SHADES - 1, Math.max(0, Math.floor(((lit + 1) / 2) * SHADES)));
        buckets[bucket].push(pathOf(oriented([left[k], left[j], right[j], right[k]]), true));
      }
    }
    const outline = [pathOf(right, true), pathOf(left, true)];
    for (const run of runsOf(facing, true)) {
      for (const i of [run[0], run[run.length - 1] % count]) outline.push(pathOf([left[i], right[i]]));
    }
    return {
      fill: pathOf(convexHull([...left, ...right]), true),
      shades: buckets.map((b) => b.join("")),
      top: pathOf(oriented(right), true),
      crease: "",
      outline: outline.join(""),
    };
  }

  /** 沿 y 轴的圆柱（空滤罐、燃油滤清器等正放圆件），画法与 cylX 同构。 */
  function cylY(cx, y0, y1, z0, z1, r, steps = 36) {
    const ring = [];
    const cz = (z0 + z1) / 2;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ring.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); // x,z
    }
    const counter = signedArea(ring) > 0;
    const { sinA, cosA, sinE, cosE } = cameraOf(P);
    const tv = [cosA * cosE, sinE]; // x-z 平面内朝向观察者的深度梯度
    const L2 = [0.76, 0.65];
    const n2 = Math.hypot(tv[0], tv[1]);
    const nl = Math.hypot(L2[0], L2[1]);
    const count = steps;
    const normals = ring.map(([ax, az], i) => {
      const [bx, bz] = ring[(i + 1) % count];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      return counter ? [dz / len, -dx / len] : [-dz / len, dx / len];
    });
    const facing = normals.map(([nx, nz]) => (nx * tv[0] + nz * tv[1]) / n2 > 1e-9);
    const left = ring.map(([x, z]) => at([x, y0, z]));
    const right = ring.map(([x, z]) => at([x, y1, z]));
    const buckets = Array.from({ length: SHADES }, () => []);
    for (const run of runsOf(facing, true)) {
      for (let k = run[0]; k < run[run.length - 1]; k++) {
        const j = (k + 1) % count;
        const lit = (normals[k][0] * L2[0] + normals[k][1] * L2[1]) / nl;
        const bucket = Math.min(SHADES - 1, Math.max(0, Math.floor(((lit + 1) / 2) * SHADES)));
        buckets[bucket].push(pathOf(oriented([left[k], left[j], right[j], right[k]]), true));
      }
    }
    const outline = [pathOf(right, true), pathOf(left, true)];
    for (const run of runsOf(facing, true)) {
      for (const i of [run[0], run[run.length - 1] % count]) outline.push(pathOf([left[i], right[i]]));
    }
    return {
      fill: pathOf(convexHull([...left, ...right]), true),
      shades: buckets.map((b) => b.join("")),
      top: pathOf(oriented(right), true),
      crease: "",
      outline: outline.join(""),
    };
  }

  // x=常数平面（y-z 圆）朝前半圈弧：y = cy + r·cosθ, z = cz + r·sinθ
  function arcYZ(x, cy, cz, r) {
    const pts = [];
    for (let a = -45; a <= 135; a += 15) {
      const t = (a * Math.PI) / 180;
      pts.push(at([x, cy + r * Math.cos(t), cz + r * Math.sin(t)]));
    }
    return pathOf(pts);
  }
  // y=常数平面（x-z 圆）朝前半圈弧
  function arcXZ(y, cx, cz, r) {
    const pts = [];
    for (let a = -40; a <= 140; a += 15) {
      const t = (a * Math.PI) / 180;
      pts.push(at([cx + r * Math.cos(t), y, cz + r * Math.sin(t)]));
    }
    return pathOf(pts);
  }

  // ————————————————————————————— 撬座底盘与减震底脚 —————————————————————————————
  function base() {
    const out = [`<path class="iso-halo" d="${haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
    const cxm = PLATE.x + PLATE.w / 2;
    const feet = [...corners(PLATE, 10), [cxm, PLATE.y + 10], [cxm, PLATE.y + PLATE.d - 10], [-32, -16], [-32, 20], [32, -16], [32, 20]];
    for (const [x, y] of byDepth(feet.map((c) => [c[0], c[1], 0]))) {
      out.push(S(cylinder(x, y, 5.2, -PLATE_H - FOOT_H, 2, P, 22), { tone: "lo" }));
      out.push(S(cylinder(x, y, 3.2, -PLATE_H - FOOT_H + 2, FOOT_H - 1.6, P, 18), { tone: "lo" }));
    }
    out.push(S(slabOf(PLATE, -PLATE_H, PLATE_H, P, 6, 1), { tone: "mid" }));
    // 两条纵向安装导轨（机组底脚落位处）
    out.push(S(slabOf({ x: -72, y: 14, w: 162, d: 5, r: 1 }, 0, 2.2, P, 2, 0.3), { tone: "mid" }));
    out.push(S(slabOf({ x: -72, y: -19, w: 162, d: 5, r: 1 }, 0, 2.2, P, 2, 0.3), { tone: "mid" }));
    out.push(L(planOutline(insetPlan(PLATE, 4.5), 0, P), { tone: "faint" }));
    const sc = corners(PLATE, 8);
    out.push(L(sc.map((c) => ring(c[0], c[1], 1.8, 0, P, 14)).join(""), { tone: "lo" }));
    out.push(D(sc.map((c) => at([c[0], c[1], 0])), { size: 0.45 }));
    return out.join("");
  }

  // ——————————— 电池单体：电池盒 + 中盖 + 提手缝 + 正负极柱（第一只点亮） ———————————
  function cell(x0, lit) {
    const x1 = x0 + BAT.w, y0 = BAT.y0, y1 = BAT.y1, z0 = 0, z1 = BAT.z1;
    const tc = (y0 + y1) / 2;
    const out = [];
    out.push(S(prismY(y0, y1, x0, x1, z0, z1), { tone: "mid", lit: !!lit }));
    out.push(S(prismY(y0 - 0.35, y1 + 0.35, x0 - 0.35, x1 + 0.35, z1 - 3, z1), { tone: "hi" }));
    // 提手缝：正面顶部内凹横槽
    out.push(S(prismY(y1 - 0.3, y1 + 0.5, x0 + 2.6, x1 - 2.6, z1 - 9, z1 - 6.4), { tone: "lo", crease: "none" }));
    // 罐身两道浅缝
    out.push(L([0.34, 0.66].map((t) => seg([x0 + 1, y1 + 0.15, z0 + BAT.z1 * t], [x1 - 1, y1 + 0.15, z0 + BAT.z1 * t])).join(""), { tone: "faint" }));
    // 正负极柱小圆柱 + 顶面触点（右正红、左负深）
    for (const [tx, plus] of [[x0 + 3.2, false], [x1 - 3.2, true]]) {
      out.push(S(cylinder(tx, tc, 1.6, z1, 3.4, P, 18), { tone: "hi" }));
      out.push(D([at([tx, tc, z1 + 3.5])], { size: lit ? 0.8 : 0.55, tone: lit ? (plus ? "red" : "lo") : "mid" }));
    }
    return out.join("");
  }

  function batteries() {
    return cell(B1.x0, true) + cell(B2.x0, false);
  }

  // ——————————— 电池间跨接线（串联）与负极搭铁线（wireSvg，端子吃投影点） ———————————
  function batCables() {
    const out = [];
    out.push(wireSvg(at([B2.x0 + 3.2, -1, BAT.z1 + 3.4]), at([B1.x0 + BAT.w - 3.2, -1, BAT.z1 + 3.4]), {
      via: [at([(B1.x0 + BAT.w + B2.x0) / 2, -1, BAT.z1 + 7])],
      tone: "hi",
      size: 1.1,
    }));
    out.push(wireSvg(at([B1.x0 + 3.2, -1, BAT.z1 + 3.4]), at([B1.x0 + 3.2, BAT.y1 + 0.6, 0.6]), {
      via: [at([B1.x0 + 3.2, BAT.y1 + 0.6, BAT.z1 - 3])],
      tone: "mid",
      size: 1.1,
    }));
    return out.join("");
  }

  // ——————————— 控制箱：箱体 + 面板角钉 + 表盘 + 数显窗 + 指示灯 ———————————
  function controlBox() {
    const out = [];
    out.push(S(slabOf({ x: CB.x0, y: CB.y0, w: CB.x1 - CB.x0, d: CB.y1 - CB.y0, r: 1 }, 0, CB.z1, P, 4, 0.8), { tone: "mid" }));
    out.push(S(prismY(CB.y1 - 0.8, CB.y1, CB.x0 + 1, CB.x1 - 1, 1, CB.z1 - 1), { tone: "lo", crease: "none" }));
    out.push(D([
      at([CB.x0 + 1.4, CB.y1 + 0.2, 1.4]), at([CB.x1 - 1.4, CB.y1 + 0.2, 1.4]),
      at([CB.x0 + 1.4, CB.y1 + 0.2, CB.z1 - 1.4]), at([CB.x1 - 1.4, CB.y1 + 0.2, CB.z1 - 1.4]),
    ], { size: 0.45 }));
    // 铭牌 rule 线（无文字）
    out.push(S(prismY(CB.y1 - 0.2, CB.y1 + 0.3, CB.x0 + 2, CB.x0 + 8.5, 2.5, 6.5), { tone: "lo", crease: "none" }));
    out.push(L([0.3, 0.55, 0.8].map((t) => seg([CB.x0 + 3, CB.y1 + 0.4, 2.5 + 4 * t], [CB.x0 + 7.5, CB.y1 + 0.4, 2.5 + 4 * t])).join(""), { tone: "mid" }));
    out.push(gaugeBody(G_C, "y", GAUGE_R));
    // 数显窗凹陷框（文字在 meter(d) 里以 dyn 组写入）
    out.push(S(prismY(CB.y1 - 1, CB.y1 + 0.15, LCD.x0, LCD.x1, LCD.z0, LCD.z1), { tone: "lo", crease: "none" }));
    // 运行灯（常亮暗点）与欠压告警灯位（dyn 红点）
    out.push(D([at([-27, CB.y1 + 0.3, 24.5])], { size: 0.75, tone: "mid" }));
    out.push(L(ringSide([-12.6, CB.y1 + 0.1, 24.5], 1.6, "y", 18), { tone: "lo" }));
    return out.join("");
  }

  // 箱顶上方走线的两只支杆（立在控制箱顶面，托住 + 电缆；电缆高于箱顶 30、从表盘右上方越过）
  function standoffs() {
    const out = [];
    for (const sx of [-24, -12]) {
      out.push(S(prismY(13, 15, sx - 0.6, sx + 0.6, CB.z1, 31.5), { tone: "mid" }));
      out.push(S(slabOf({ x: sx - 1.1, y: 13.4, w: 2.2, d: 1.2, r: 0.3 }, 31.5, 0.8, P, 2, 0.2), { tone: "hi" }));
    }
    return out.join("");
  }

  // ——————————— 启动马达（前排）：底座 + 筒身 + 齿圈 hint + 啮合小轴 + 电磁开关 ———————————
  function starter() {
    const out = [];
    out.push(S(slabOf({ x: -3, y: 9, w: 14, d: 10, r: 1.5 }, 0, 7.5, P, 3, 0.4), { tone: "mid" }));
    out.push(S(cylX(-2, 10, 14, 7.5, 17.5, 5), { tone: "hi" }));
    out.push(S(cylX(9.4, 10.6, 14, 7.5, 17.5, 5.4), { tone: "mid" }));
    out.push(L(arcYZ(4, 14, 12.5, 5.05), { tone: "lo" })); // 筒身箍弧
    // 齿圈 hint：前端环 + 伸到发动机端面的啮合小轴
    out.push(L(ringSide([10.7, 14, 12.5], 6.2, "x", 24), { tone: "lo" }));
    out.push(L(seg([10.8, 14, 12.5], [14, 13, 12.5]), { tone: "mid" }));
    // 电磁开关（顶部小圆柱 + 接线端子）
    out.push(S(cylY(2, 11.5, 16.5, 17, 21, 1.7), { tone: "mid" }));
    out.push(L(seg([2, 14, 21], [2, 14, 22.2]), { tone: "mid" }));
    out.push(D([at([2, 14, 22.3])], { size: 0.55, tone: "mid" }));
    return out.join("");
  }

  // ———————————————————————— 发动机：缸体 + 缸盖排 + 附件 ————————————————————————
  function engine() {
    const out = [];
    // 缸体 + 正面圆形检视盖（飞轮壳侧）
    out.push(S(slabOf({ x: 14, y: -13, w: 36, d: 26, r: 2 }, 0, 26, P, 3, 0.8), { tone: "mid" }));
    out.push(L(ringSide([32, 13.2, 12], 5.5, "y", 30), { tone: "lo" }));
    out.push(D([at([32, 13.3, 12])], { size: 0.5, tone: "mid" }));
    out.push(D([45, 135, 225, 315].map((a) => {
      const r = (a * Math.PI) / 180;
      return at([32 + 3.8 * Math.cos(r), 13.3, 12 + 3.8 * Math.sin(r)]);
    }), { size: 0.4 }));
    // 推杆室接缝 + 棱线短缝
    out.push(L(seg([15, 13.3, 20], [49, 13.3, 20]), { tone: "faint" }));
    out.push(L([
      seg([14.6, 13.2, 1], [14.6, 13.2, 25]), seg([49.4, 13.2, 1], [49.4, 13.2, 25]),
    ].join(""), { tone: "faint", free: "both" }));
    // 缸盖 + 四只凸包（气门室罩）
    out.push(S(slabOf({ x: 15, y: -11, w: 34, d: 22, r: 1.5 }, 26, 5, P, 3, 0.5), { tone: "mid" }));
    for (const bx of [18, 26, 34, 42]) {
      out.push(S(prismY(-10, 10, bx, bx + 5, 31, 35), { tone: "hi" }));
    }
    out.push(L(seg([16, 10.6, 31], [48, 10.6, 31]), { tone: "lo" }));
    // 燃油滤清器：支架 + 滤杯小圆柱 + 油管
    out.push(S(prismY(12.6, 14.6, 16.4, 19.6, 10, 14), { tone: "mid" }));
    out.push(S(cylY(18, 13.2, 16.8, 6, 16, 2.6), { tone: "hi" }));
    out.push(L(seg([18, 15, 6], [18, 15, 4.4]), { tone: "mid" }));
    out.push(L(seg([18, 13.3, 15], [18, 13.05, 18]), { tone: "lo" }));
    // 进气：空滤罐（矮罐，y 轴圆柱）+ 卡箍弧 + 进气管
    out.push(L(pathOf([at([26, 10, 34.8]), at([26, 13.8, 36.6]), at([26, 15, 37.2])]), { tone: "mid" }));
    out.push(S(cylY(26, 13, 21, 34, 41, 3.5), { tone: "hi" }));
    out.push(S(cylY(26, 12.4, 13.2, 33.7, 41.3, 3.9), { tone: "mid" }));
    out.push(L([arcXZ(15.5, 26, 37.5, 3.55), arcXZ(19.5, 26, 37.5, 3.55)].join(""), { tone: "lo" }));
    // 吊耳
    out.push(S(prismY(-1.2, 1.2, 39, 41, 35, 36.6), { tone: "mid" }));
    out.push(L(ringSide([40, 0, 39.8], 1.6, "y", 16), { tone: "mid" }));
    return out.join("");
  }

  // ———————————— 飞轮壳 + 联轴器（双法兰 + 螺栓圈）+ 发电机筒身 ————————————
  function drivetrain() {
    const out = [];
    out.push(S(cylX(50, 54, 0, 8, 31, 11), { tone: "mid" })); // 飞轮壳
    out.push(S(cylX(54, 55, 0, 16.4, 22.6, 7), { tone: "mid" })); // 法兰 1
    out.push(S(cylX(57, 58, 0, 16.4, 22.6, 7), { tone: "mid" })); // 法兰 2
    out.push(S(cylX(55, 57, 0, 17.4, 21.6, 4.5), { tone: "hi" })); // 中间节
    out.push(L(ringSide([54.5, 0, 19.5], 5.6, "x", 20), { tone: "lo" })); // 螺栓圈
    out.push(D([0, 60, 120, 180, 240, 300].map((a) => {
      const r = (a * Math.PI) / 180;
      return at([54.5, 5.6 * Math.cos(r), 19.5 + 5.6 * Math.sin(r)]);
    }), { size: 0.4 }));
    // 发电机：底座导轨 + 筒身 + 散热筋 + 环槽 + 端盖
    out.push(S(prismY(-8, 8, 59, 63, 0, 8), { tone: "mid" }));
    out.push(S(prismY(-8, 8, 79, 83, 0, 8), { tone: "mid" }));
    out.push(S(cylX(58, 84, 0, 8, 31, 11.5), { tone: "mid" }));
    out.push(S(cylX(57.2, 58.2, 0, 8, 31, 11.8), { tone: "lo" })); // 后端环
    const ribs = [];
    for (const deg of [-60, -40, -20, 0, 20, 40, 60]) {
      const a = (deg * Math.PI) / 180;
      ribs.push(seg([59.5, 11.5 * Math.cos(a), 19.5 + 11.5 * Math.sin(a)], [82.5, 11.5 * Math.cos(a), 19.5 + 11.5 * Math.sin(a)]));
    }
    out.push(L(ribs.join(""), { tone: "lo" }));
    for (const gx of [63, 71, 79]) { // 环槽只画朝前半圈
      const pts = [];
      for (let a = -50; a <= 130; a += 15) {
        const r = (a * Math.PI) / 180;
        pts.push(at([gx, 11.5 * Math.cos(r), 19.5 + 11.5 * Math.sin(r)]));
      }
      out.push(L(pathOf(pts), { tone: "lo" }));
    }
    out.push(S(cylX(84, 86, 0, 8, 31, 11.5), { tone: "hi" })); // 端部钟罩
    out.push(S(cylX(86, 88, 0, 12.2, 26.8, 8.5), { tone: "mid" })); // 圆形端盖
    out.push(L(ringSide([88, 0, 19.5], 8.5, "x", 34), { tone: "mid" }));
    out.push(L(ringSide([88, 0, 19.5], 6.3, "x", 30), { tone: "faint" }));
    out.push(S(cylX(88, 89.4, 0, 17.8, 21.2, 3), { tone: "hi" })); // 轴端轮毂
    out.push(D([at([89.5, 0, 19.5])], { size: 0.5, tone: "mid" }));
    // 顶部接线盒
    out.push(S(slabOf({ x: 66, y: -6, w: 10, d: 12, r: 1 }, 31, 6, P, 3, 0.4), { tone: "mid" }));
    out.push(L(seg([67, 6.3, 36.8], [75, 6.3, 36.8]), { tone: "lo" }));
    out.push(D([at([67, 6.4, 32.8]), at([75, 6.4, 32.8])], { size: 0.4 }));
    return out.join("");
  }

  // ———————————————— 输出断路器盒：盒体 + 铭牌 + 手柄 + 底部出缆 ————————————————
  function breakerBox() {
    const out = [];
    out.push(S(slabOf({ x: 66, y: 13, w: 16, d: 8, r: 1 }, 0, 22, P, 3, 0.5), { tone: "mid" }));
    out.push(S(prismY(21, 23.6, 67, 71, 8, 18), { tone: "hi" })); // 小手柄
    out.push(D([at([69, 23.7, 13])], { size: 0.5, tone: "mid" })); // 手柄转轴
    // 铭牌 + rule 线 + 角钉
    out.push(S(prismY(20.6, 21.4, 74, 80, 3.5, 7), { tone: "lo", crease: "none" }));
    out.push(L([0.3, 0.55, 0.8].map((t) => seg([74.6, 21.5, 3.5 + 3.5 * t], [79.4, 21.5, 3.5 + 3.5 * t])).join(""), { tone: "mid" }));
    out.push(D([at([74.4, 21.5, 4]), at([79.6, 21.5, 4]), at([74.4, 21.5, 6.5]), at([79.6, 21.5, 6.5])], { size: 0.4 }));
    // 状态指示
    out.push(D([at([76, 21.4, 14]), at([76, 21.4, 10])], { size: 0.55, tone: "mid" }));
    // 底部出线
    out.push(wireSvg(at([70, 19, 2]), at([70, 24.2, 0.8]), { tone: "mid", size: 1.1 }));
    return out.join("");
  }

  // ———————————— 排烟管：竖直上行的立管 + 消音器盒 + 拉架 + 尾端防雨帽 ————————————
  function exhaust() {
    const out = [];
    out.push(S(cylinder(38, 2, 2.1, 35, 10, P, 24), { tone: "hi" })); // 立管：缸盖顶 → 消音器底
    out.push(S(slabOf({ x: 30, y: -4, w: 14, d: 12, r: 1.5 }, 45, 9, P, 3, 0.6), { tone: "mid" })); // 消音器盒
    out.push(L([
      seg([31.5, 8.3, 45.6], [42.5, 8.3, 45.6]),
      seg([31.5, 8.3, 53.4], [42.5, 8.3, 53.4]),
    ].join(""), { tone: "lo" }));
    // 拉架：消音器底 → 缸盖顶
    out.push(S(prismY(5.6, 7.6, 32, 34.2, 35, 45), { tone: "lo" }));
    // 尾端短立管 + 防雨帽
    out.push(S(cylinder(46.2, 2, 1.9, 49.5, 4.5, P, 22), { tone: "mid" }));
    out.push(S(cylinder(46.2, 2, 2.7, 54, 1, P, 22), { tone: "hi" }));
    return out.join("");
  }

  // ———————— 发电回路（常显）：接线盒 → 断路器 → 出缆，筒身前壁一段流条 ————————
  function genFlow() {
    const out = [];
    out.push(L(pathOf([at([71, 6, 34]), at([71, 6, 26]), at([71, 14, 24]), at([71, 15, 22.3])]), { tone: "mid", flow: true }));
    out.push(D([at([71, 6, 34])], { size: 0.5, tone: "mid" }));
    out.push(L(pathOf([at([59, 11.2, 22]), at([83, 11.2, 22])]), { tone: "mid", flow: true }));
    out.push(L(pathOf([at([70, 20.6, 3]), at([70, 24.4, 0.9])]), { tone: "mid", flow: true }));
    out.push(D([at([70, 24.4, 0.9])], { size: 0.5, tone: "mid" }));
    return out.join("");
  }

  // ———— 启动回路电缆（电池 + 极柱 → 启动马达）：箱顶上方走线（支杆托住，高于表盘） ————
  const START_PATH = [[-34.2, -1, 25.5], [-33, 14, 31.5], [2, 14, 31.5], [2.6, 13, 22]];
  function startCable() {
    return wireSvg(at(START_PATH[0]), at(START_PATH[START_PATH.length - 1]), {
      via: START_PATH.slice(1, -1).map(at),
      tone: "hi",
      size: 1.4,
    });
  }
  function flow() {
    const spans = [
      [START_PATH[0], START_PATH[1]],
      [START_PATH[1], [-19.5, 14, 31.5]],
      [[-19.5, 14, 31.5], [-6, 14, 31.5]],
      [[-6, 14, 31.5], START_PATH[2]],
      [START_PATH[2], START_PATH[3]],
    ];
    return spans
      .map(([a, b], i) => {
        const pts = [at(a), at(b)];
        return `<g data-seg="${i}">` + L(pathOf(pts), { tone: "lit", flow: true, free: "both" }) + D([pts[0]], { size: 0.5, tone: "mid" }) + "</g>";
      })
      .join("");
  }

  // ———————————————————————— 表计、数显窗与指针 ————————————————————————
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
  // 红弧（反向）：从表盘起点（0V，225°）向读数增大方向（角度递减）扫到欠压线刻标 —— 欠压区在低端
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
  // 运行时才变的部分：欠压红弧、表针、告警灯、数显文本
  function meter(d) {
    const out = [];
    out.push(alarmArc(G_C, "y", GAUGE_R, 225, -(d.threshold / RANGE) * 225));
    out.push(
      dyn(
        "needle",
        L(needleAt(G_C, "y", GAUGE_R, d.share), { tone: "hi", className: "dg-needle", free: "start" }) +
          D([at(facePoint(G_C, "y", 0, 0))], { size: 0.8, tone: "hi" }),
      ),
    );
    out.push(dyn("led", D([at([-12.6, CB.y1 + 0.3, 24.5])], { size: 0.85, tone: "red" }), d.over ? "" : ` opacity="0.12"`));
    const mtx = (x, z) => sideMatrix([x, CB.y1 + 0.25], z, P, "left");
    out.push(
      dyn(
        "lcd",
        faceTextSvg(mtx(LCD.x0 + 1.4, 6.6), `${d.volts.toFixed(1)} V`, { size: 3.1, tone: "hi" }),
      ),
    );
    return out.join("");
  }

  function buildParts() {
    return [
      { name: "base", svg: base(), anchor: [0, 0, -PLATE_H] },
      { name: "batteries", svg: batteries(), anchor: [-49, -1, 11] },
      { name: "bat-cables", svg: batCables(), anchor: [-48, 4, 23] },
      { name: "control-box", svg: controlBox(), anchor: [-20, CB.y1, 15] },
      { name: "standoffs", svg: standoffs(), anchor: [-18, 14, 31] },
      { name: "starter", svg: starter(), anchor: [4, 0, 12] },
      { name: "engine", svg: engine(), anchor: [32, 0, 18] },
      { name: "drivetrain", svg: drivetrain(), anchor: [70, 0, 19] },
      { name: "breaker", svg: breakerBox(), anchor: [74, 17, 11] },
      { name: "exhaust", svg: exhaust(), anchor: [38, 2, 49] },
      { name: "gen-flow", svg: genFlow(), anchor: [71, 14, 24] },
      { name: "start-cable", svg: startCable(), anchor: [-16, 14, 33] },
      { name: "flow", svg: flow(), anchor: [-16, 14, 33] },
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
        `等距示意的柴油发电机组撬座：启动蓄电池组（高亮）、启动马达、发动机、联轴器与发电机一字排开，` +
        `排烟管上行至消音器。启动电池电压 ${fmt(d.volts)} 伏，欠压线 ${fmt(d.threshold)} 伏${d.over ? "，欠压告警" : ""}。`,
      body: STATIC + meter(d),
      standalone: opts.standalone || false,
      className: "dg-figure",
    });
  }

  function text(d) {
    return `启动电压 ${fmt(d.volts)} V · 欠压线 ${fmt(d.threshold)} V · ${d.over ? "欠压告警" : d.recovered ? "复测正常" : "电压正常"}`;
  }
  const readout = (m) => text(derive(m));

  const CSS = `
.dg-plate{position:relative;width:100%;max-width:660px;margin:0 auto}
.dg-needle{stroke-width:1.1}
.dg-readout{font:600 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted,#6f7d94);margin:8px 2px 0;letter-spacing:.2px}
`;

  function mount(el, model, opts = {}) {
    if (global.__dgCurrent) global.__dgCurrent.destroy();
    // .iso 这一层不能省：--anatomy-* 变量定义在它上面，缺了它所有填充都取不到色
    el.innerHTML = `<style>${CSS}</style><div class="iso" data-theme="${opts.theme || "light"}"><div class="dg-plate"><div class="dg-stage">${buildSvg(model)}</div><p class="dg-readout" data-readout>${text(derive(model))}</p></div></div>`;
    const stage = el.querySelector(".dg-stage");
    const out = el.querySelector("[data-readout]");
    const needleEl = stage.querySelector('[data-dyn="needle"] .iso-line');
    const ledGroup = stage.querySelector('[data-dyn="led"]');
    const lcdText = stage.querySelector('[data-dyn="lcd"] text');
    const segs = [...stage.querySelectorAll("[data-seg]")];
    const still = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let want = derive(model);
    let shown = { ...want };
    let raf = 0, last = 0, visible = true, lastLine = "";
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px" });
    io.observe(stage);

    function paint() {
      if (needleEl) needleEl.setAttribute("d", needleAt(G_C, "y", GAUGE_R, clamp(shown.volts / RANGE, 0, 1)));
      if (ledGroup) ledGroup.style.opacity = shown.over ? "1" : "0.12";
      if (lcdText) lcdText.textContent = `${shown.volts.toFixed(1)} V`;
      const n = clamp(Math.ceil(clamp(shown.volts / RANGE, 0, 1) * MAX_SEGS), 1, MAX_SEGS);
      for (let i = 0; i < segs.length; i++) {
        const o = i < n ? (i === n - 1 ? 0.45 : 1) : 0;
        if (segs[i].style.opacity !== String(o)) segs[i].style.opacity = String(o);
      }
      const next = text(shown);
      if (next !== lastLine) { lastLine = next; out.textContent = next; }
    }
    function tick(now) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const k2 = still.matches ? 1 : 1 - Math.exp(-dt / 0.5);
      shown = { ...want, volts: lerp(shown.volts, want.volts, k2) };
      shown.over = shown.volts < want.threshold;
      paint();
      raf = visible && Math.abs(shown.volts - want.volts) > 0.02 ? requestAnimationFrame(tick) : 0;
    }
    function run() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } }
    paint();
    const ctrl = {
      set(m2) { model = m2; want = derive(m2); run(); },
      destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; io.disconnect(); if (global.__dgCurrent === ctrl) global.__dgCurrent = null; },
    };
    global.__dgCurrent = ctrl;
    run();
    return ctrl;
  }

  global.DgFigure = { derive, buildSvg, readout, mount, needleAt, parts: () => PART_ORDER.map((p) => ({ name: p.name, anchor: p.anchor, svg: p.svg })), width: WIDTH, height: HEIGHT };
})(typeof window !== "undefined" ? window : globalThis);
