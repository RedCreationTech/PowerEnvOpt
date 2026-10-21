/*
 * iso-th.js —— 立杆式温湿度传感站示意机理图（anatomy 技能风格，纯 SVG，无 WebGL）。
 *
 * 造型：气象/机房用温湿度传感站 —— 圆角安装底板（4 只安装孔 + 防滑纹）上立细杆，
 * 杆中部是接线盒（盒 + 格兰 + 电缆沿杆下行入底板）；杆上部叠 4 层同轴防辐射百叶罩
 * （白色薄圆盘，盘缘下垂薄边用双 ring 线表现，层间 3 根细支柱），罩内悬空露出温湿度
 * 传感芯（小圆筒 + 顶部 4 点栅孔 + 底部引线，全图唯一 lit 主体）；罩顶细颈 + 伞形防雨盖。
 * 杆下部挂就地显示盒：深色 LCD 窗（温度/湿度两行，运行时刷新）+ 运行/告警灯 +
 * LCD 旁温度条（高度随温度增强，超阈值转红）。传感站无表盘，数值全在 LCD 窗与读数条。
 *
 * 一句话机理：环境空气自由穿过多层百叶罩到达罩内的传感芯，芯体把温湿度变成 LCD 窗上
 * 的两行数字 —— 温度或湿度越过阈值时告警灯点亮、温度条涨满变红；复测回落后灯灭条降。
 *
 * 图里每个数字都来自调用方传入的同一份场景模型（monitor 侧传 {temp,hum,alarmT,alarmH}，
 * 抽屉场景侧传 {temp:25,hum:46,alarmT:30,alarmH:80}）：当前温度、湿度、两级阈值、
 * 当前帧序号与是否复测都由入参给，本文件不自带演示数值。
 *
 * 性能约定：静态图只在挂载时生成一次；换状态时只写 LCD 两行 text、告警灯/温度条颜色、
 * 温度条的 d 和读数文本 —— 不在每帧重建整段 SVG。
 *
 * 依赖 iso-kit.js / iso-kit.css（经典脚本与全局样式）。用法：
 *   ThFigure.mount(container, model) → 控制器（.set(model) 换状态，.destroy() 卸载）
 *   ThFigure.buildSvg(model)         → 整段 <svg> 字符串（Node 自检与静态导出用）
 */
(function (global) {
  const WIDTH = 520;
  const HEIGHT = 540;

  // —— 世界坐标：x 向右，y 向后，z 向上；1 单位 ≈ 1 cm ——
  const PLATE = { x: -27, y: -21, w: 54, d: 42, r: 5 }; // 圆角安装底板 0..5
  const POLE = { r: 3, z0: 8, z1: 96 }; // 立杆（至底层罩下沿）
  const JB = { x0: -9, x1: 9, y0: -7, y1: 7, z0: 56, z1: 74 }; // 中部接线盒
  const JBLID = { x: -9.8, y: -7.8, w: 19.6, d: 15.6, r: 2 }; // 盒盖
  const GLAND = { x: -5, y: 2 }; // 格兰（盒底电缆入口，电缆走杆左侧下行）
  const DISC = {
    r: [19, 17.7, 16.4, 15.1], // 4 层百叶罩圆盘（自下而上略收）
    z0: [96, 108.2, 120.4, 132.6], // 各盘底面
    h: 1.6,
  };
  const GAP_POST_ANGLES = [90, 200, 320]; // 层间 3 支柱（避开相机方位角 40°/220°）
  const CORE = { r: 8, z0: 99.5 }; // 罩内传感芯（唯一 lit，按缝切片露出）
  const CAP = { neckR: 2.2, z0: 134.2, z1: 142, r: 11.5, h: 1.8 }; // 罩顶伞形防雨盖
  const DB = { x0: 5, x1: 25, y0: 1, y1: 11, z0: 24, z1: 42 }; // 就地显示盒
  const LCD = { x0: 7.5, x1: 20.5, z0: 27.5, z1: 37.5 }; // LCD 窗
  const BAR = { x0: 21.6, x1: 23.8, z0: 27.5, z1: 37.5 }; // 温度条

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /**
   * 演示口径：temp/hum 直接取入参当前值（index 供序列场景取帧）；
   * over = 温度超 alarmT 或湿度超 alarmH；heat 把 20..35 °C 映射到 0..1 温度条高度。
   */
  function derive(m) {
    const series = Array.isArray(m.series) ? m.series : [];
    const idx = clamp(m.index == null ? Math.max(0, series.length - 1) : m.index, 0, Math.max(0, series.length - 1));
    const fin = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const temp = fin(m.temp ?? series[idx] ?? 0);
    const hum = fin(m.hum ?? 0);
    const alarmT = fin(m.alarmT ?? 30);
    const alarmH = fin(m.alarmH ?? 80);
    return {
      temp,
      hum,
      alarmT,
      alarmH,
      recovered: !!m.recovered,
      over: temp > alarmT || hum > alarmH,
      heat: clamp((temp - 20) / 15, 0, 1),
    };
  }

  // 取景用两遍法：先按临时投影画一遍，再从真实产出的坐标里回收包围盒重画。
  const CAMERA = { pad: 22, azimuth: 40, elevation: 33 };
  let P = fitProjection(
    [
      ...boxCorners(PLATE, -1, 6),
      [0, 0, CAP.z1 + CAP.h + 0.5], [DB.x1, DB.y1, DB.z1], [JB.x0, JB.y0, JB.z1], [JB.x1, JB.y1, JB.z1],
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

  /**
   * 沿 x 轴扫掠的长方体（主视面朝 +x）。
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
  const dyn = (name, inner, extra = "") => `<g data-dyn="${name}"${extra}>${inner}</g>`;
  const FACE_Y = DB.y1 + 0.14; // 显示盒 +y 主视面（LCD 窗/灯/温度条所在平面）

  // ————————————————————— 圆角底板：防滑纹 + 4 只安装孔 —————————————————————
  function base() {
    const out = [`<path class="iso-halo" d="${haloOf(PLATE, -0.8, 5.8, P)}"/>`];
    out.push(S(slabOf(PLATE, 0, 5, P, 8, 0.8), { tone: "mid" }));
    out.push(L([lineOnTop([-16, -9], [16, -9], 5.05, P) + lineOnTop([-16, 9], [16, 9], 5.05, P)], { tone: "faint" }));
    const hc = corners(PLATE, 8);
    out.push(L(hc.map((c) => ring(c[0], c[1], 2.3, 5.05, P, 18)).join(""), { tone: "lo" }));
    out.push(D(hc.map((c) => at([c[0], c[1], 5.1])), { size: 0.5 }));
    return out.join("");
  }

  // ——————————————————— 立杆：底部法兰 + 细杆（止于底层罩下沿） ———————————————————
  function pole() {
    const out = [];
    out.push(S(cylinder(0, 0, 7, 5, 3, P, 30), { tone: "mid" }));
    out.push(D([0, 90, 180, 270].map((a) => at([5 * Math.cos((a * Math.PI) / 180), 5 * Math.sin((a * Math.PI) / 180), 8.05])), { size: 0.45 }));
    out.push(S(cylinder(0, 0, POLE.r, POLE.z0, POLE.z1 - POLE.z0, P, 26), { tone: "hi" }));
    return out.join("");
  }

  // ——————————— 中部接线盒：盒体 + 外凸盒盖 + 盖螺钉 + 底格兰 + 电缆沿杆下行 ———————————
  function junction() {
    const out = [];
    out.push(S(prismY(JB.y0, JB.y1, JB.x0, JB.x1, JB.z0, JB.z1), { tone: "mid" }));
    out.push(S(slabOf(JBLID, JB.z1, 2, P, 6, 0.5), { tone: "hi" }));
    out.push(L(planOutline(insetPlan(JBLID, 1.6), JB.z1 + 2.05, P), { tone: "faint" }));
    out.push(D(corners(JBLID, 2.6).map((c) => at([c[0], c[1], JB.z1 + 2.1])), { size: 0.45 }));
    out.push(S(cylinder(GLAND.x, GLAND.y, 1.8, JB.z0 - 2, 2, P, 16), { tone: "mid", crease: "none" }));
    // 电缆：格兰 → 杆左侧下行 → 没入底板（wireSvg 吃投影点，必须 at() 之后传）
    out.push(wireSvg(at([GLAND.x, GLAND.y, JB.z0 - 2]), at([-4.9, 3, 5.4]), { via: [at([-4.6, 2.6, 44]), at([-4.6, 2.6, 12])], tone: "mid" }));
    return out.join("");
  }

  /**
   * 开口圆筒组（只画侧壁与口沿，不画顶/底面，整组共用一个 data-lit）——罩内传感芯
   * 按缝切片的载体：顶面在屏幕上永远被上层圆盘压住，单遍画家算法里只能以开口筒的
   * 方式成组画在全部圆盘之后。
   */
  function litTube(pathsList, { tone = "hi" } = {}) {
    const parts = [];
    for (const paths of pathsList) {
      parts.push(`<path class="iso-fill" d="${paths.shades.join("")}"/>`);
      paths.shades.forEach((d, i) => {
        if (d) parts.push(`<path class="iso-shade" data-shade="${i}" d="${d}"/>`);
      });
      if (paths.crease) parts.push(`<path class="iso-line iso-crease" data-tone="faint" d="${paths.crease}"/>`);
      parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${paths.outline}"/>`);
    }
    return `<g class="iso-solid" data-lit="">${parts.join("")}</g>`;
  }

  // ——— 传感芯（唯一 lit）：按罩缝切成开口筒片段画在圆盘之后 + 顶缘 4 点栅孔 + 底部引线 ———
  function sensor() {
    const tanE = Math.tan((CAMERA.elevation * Math.PI) / 180);
    const slices = [];
    let top = CORE.z0;
    for (let g = 0; g < DISC.r.length - 1; g++) {
      const floor = DISC.z0[g] + DISC.h; // 缝底 = 下层盘顶面
      const visTop = DISC.z0[g + 1] - (DISC.r[g + 1] - CORE.r) * tanE - 0.15; // 上层盘缘遮到此高度
      const z0 = Math.max(CORE.z0, floor + 0.05);
      const z1 = Math.min(visTop, DISC.z0[g + 1] - 0.1);
      if (z1 - z0 < 0.8) continue;
      slices.push(cylinder(0, 0, CORE.r, z0, z1 - z0, P, 32));
      top = z1;
    }
    const out = [litTube(slices)];
    // 顶缘：内圈沿口（壁厚）+ 4 点栅孔 + 顶部悬吊短杆至顶层盘底
    out.push(L(ring(0, 0, CORE.r - 1.1, top, P, 30), { tone: "lo" }));
    const holes = [45, 135, 225, 315].map((a) => at([(CORE.r - 0.8) * Math.cos((a * Math.PI) / 180), (CORE.r - 0.8) * Math.sin((a * Math.PI) / 180), top + 0.08]));
    out.push(D(holes, { size: 0.6, tone: "lo" }));
    out.push(L(seg([0, 0, top], [0, 0, DISC.z0[3]]), { tone: "mid" }));
    out.push(L(seg([0, 0, CORE.z0], [0, 0, DISC.z0[0] + DISC.h + 0.1]), { tone: "mid" })); // 底部引线
    return out.join("");
  }

  // ————— 防辐射百叶罩：4 层薄圆盘（缘部双 ring 线作下垂百叶边）+ 层间/罩顶 3 根细支柱 —————
  function shield() {
    const out = [];
    for (let i = 0; i < DISC.r.length; i++) {
      const r = DISC.r[i], z = DISC.z0[i];
      out.push(S(cylinder(0, 0, r, z, DISC.h, P, 40), { tone: "hi" }));
      out.push(L(ring(0, 0, r - 0.3, z, P, 40), { tone: "lo" })); // 盘缘下垂薄边
      out.push(L(ring(0, 0, r - 0.6, z + DISC.h, P, 40), { tone: "faint" })); // 盘面内圈
    }
    const posts = [];
    for (let g = 0; g < DISC.r.length - 1; g++) {
      const r = Math.min(DISC.r[g], DISC.r[g + 1]) - 1.8;
      for (const a of GAP_POST_ANGLES) {
        const x = r * Math.cos((a * Math.PI) / 180), y = r * Math.sin((a * Math.PI) / 180);
        posts.push(seg([x, y, DISC.z0[g] + DISC.h], [x, y, DISC.z0[g + 1]]));
      }
    }
    const capPostR = CAP.r - 1.7;
    for (const a of GAP_POST_ANGLES) {
      const x = capPostR * Math.cos((a * Math.PI) / 180), y = capPostR * Math.sin((a * Math.PI) / 180);
      posts.push(seg([x, y, DISC.z0[3] + DISC.h], [x, y, CAP.z0]));
    }
    out.push(L(posts.join(""), { tone: "lo" }));
    // 罩顶伞形防雨盖：细颈 + 更大圆盘盖
    out.push(S(cylinder(0, 0, CAP.neckR, DISC.z0[3] + DISC.h, CAP.z0 - DISC.z0[3] - DISC.h, P, 18), { tone: "mid" }));
    out.push(S(cylinder(0, 0, CAP.r, CAP.z0, CAP.h, P, 40), { tone: "hi" }));
    out.push(L(ring(0, 0, CAP.r - 0.3, CAP.z0, P, 40), { tone: "lo" }));
    return out.join("");
  }

  // ——————————— 就地显示盒：挂架 + 盒体 + LCD 窗 + 温度条 + 运行/告警灯 + 螺钉 ———————————
  function display() {
    const out = [];
    out.push(S(prismX(2.5, DB.x0 + 0.5, 4, 8, 30, 36), { tone: "lo" })); // 抱杆挂架
    out.push(S(prismY(DB.y0, DB.y1, DB.x0, DB.x1, DB.z0, DB.z1), { tone: "mid" }));
    // LCD 窗（内凹暗窗）+ 窗框线
    out.push(S(prismY(DB.y1 - 0.9, FACE_Y, LCD.x0, LCD.x1, LCD.z0, LCD.z1), { tone: "lo", crease: "none" }));
    const f = FACE_Y + 0.05;
    out.push(L(
      seg([LCD.x0 - 0.2, f, LCD.z0 - 0.2], [LCD.x1 + 0.2, f, LCD.z0 - 0.2]) +
        seg([LCD.x0 - 0.2, f, LCD.z1 + 0.2], [LCD.x1 + 0.2, f, LCD.z1 + 0.2]) +
        seg([LCD.x0 - 0.2, f, LCD.z0 - 0.2], [LCD.x0 - 0.2, f, LCD.z1 + 0.2]) +
        seg([LCD.x1 + 0.2, f, LCD.z0 - 0.2], [LCD.x1 + 0.2, f, LCD.z1 + 0.2]),
      { tone: "mid" },
    ));
    // 温度条：静态框 + 刻度短线（填充在 meter(d) 里以 dyn 组写入）
    out.push(L(
      seg([BAR.x0, f, BAR.z0], [BAR.x0, f, BAR.z1]) + seg([BAR.x1, f, BAR.z0], [BAR.x1, f, BAR.z1]) +
        seg([BAR.x0, f, BAR.z0], [BAR.x1, f, BAR.z0]) + seg([BAR.x0, f, BAR.z1], [BAR.x1, f, BAR.z1]) +
        seg([BAR.x0 - 0.4, f, 31.5], [BAR.x0, f, 31.5]) + seg([BAR.x0 - 0.4, f, 34.5], [BAR.x0, f, 34.5]),
      { tone: "lo" },
    ));
    // 运行灯（常绿）+ 盒体螺钉
    out.push(D([at([9, f + 0.06, 40.4])], { size: 0.7, tone: "green" }));
    out.push(D([at([DB.x0 + 1.3, f + 0.06, 40.4]), at([DB.x1 - 1.3, f + 0.06, 40.4]), at([DB.x0 + 1.3, f + 0.06, 25.6]), at([DB.x1 - 1.3, f + 0.06, 25.6])], { size: 0.4 }));
    return out.join("");
  }

  // LCD 旁温度条填充面（随 heat 增高；超阈值转红）
  function barPath(heat) {
    const z1 = BAR.z0 + (BAR.z1 - BAR.z0) * clamp(heat, 0, 1);
    const y = FACE_Y + 0.08;
    return pathOf([at([BAR.x0 + 0.15, y, BAR.z0 + 0.15]), at([BAR.x1 - 0.15, y, BAR.z0 + 0.15]), at([BAR.x1 - 0.15, y, z1 - 0.1]), at([BAR.x0 + 0.15, y, z1 - 0.1])], true);
  }

  // 运行时才变的部分：LCD 两行文本、告警灯、温度条填充
  function meter(d) {
    const out = [];
    out.push(dyn("led", D([at([11.6, FACE_Y + 0.11, 40.4])], { size: 0.85, tone: "red" }), d.over ? "" : ` opacity="0.12"`));
    const mtx = (x, z) => sideMatrix([x, FACE_Y + 0.1], z, P, "left");
    out.push(
      dyn(
        "display",
        faceTextSvg(mtx(LCD.x0 + 1.2, 35.7), `${d.temp.toFixed(1)}°C`, { size: 2.8, tone: "hi" }) +
          faceTextSvg(mtx(LCD.x0 + 1.2, 31.9), `${Math.round(d.hum)}%RH`, { size: 2.2, tone: "mid" }),
      ),
    );
    out.push(dyn("bar", `<path class="th-barfill" d="${barPath(d.heat)}"/>`));
    return out.join("");
  }

  function buildParts() {
    return [
      { name: "base", svg: base(), anchor: [0, 0, 0] },
      { name: "pole", svg: pole(), anchor: [0, 0, 52] },
      { name: "junction", svg: junction(), anchor: [0, 0, JB.z0 + 9] },
      { name: "shield", svg: shield(), anchor: [0, 0, 115] },
      { name: "sensor", svg: sensor(), anchor: [0, 0, 114] },
      { name: "display", svg: display(), anchor: [DB.x1, DB.y1, 33] },
      { name: "meter", svg: meter(derive({})), anchor: [DB.x1, DB.y1, 33] },
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
        `等距示意的立杆式温湿度传感站：多层防辐射百叶罩内悬空温湿度传感芯，` +
        `杆下挂就地显示盒。当前温度 ${d.temp.toFixed(1)} °C，湿度 ${Math.round(d.hum)} %RH` +
        `${d.over ? "，超阈值告警" : d.recovered ? "，复测正常" : ""}。`,
      body: STATIC + meter(d),
      standalone: opts.standalone || false,
      className: "th-figure",
    });
  }

  function text(d) {
    return `温度 ${d.temp.toFixed(1)} °C · 湿度 ${Math.round(d.hum)} %RH · ${d.over ? "超阈值" : d.recovered && d.temp < d.alarmT ? "复测正常" : "正常"}`;
  }
  const readout = (m) => text(derive(m));

  // 无表盘的传感站没有指针；占位导出以与其它图的契约保持一致
  function needleAt() {
    return "";
  }

  const CSS = `
.th-plate{position:relative;width:100%;max-width:660px;margin:0 auto}
.th-readout{font:600 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted,#6f7d94);margin:8px 2px 0;letter-spacing:.2px}
.th-barfill{fill:var(--anatomy-mid);stroke:none}
.th-barfill--hot{fill:var(--anatomy-red)}
.th-stage .iso-dots[data-tone="red"] circle{fill:var(--anatomy-red);opacity:.92}
.th-stage .iso-dots[data-tone="green"] circle{fill:var(--anatomy-green);opacity:.85}
`;

  function mount(el, model, opts = {}) {
    if (global.__thCurrent) global.__thCurrent.destroy();
    // .iso 这一层不能省：--anatomy-* 变量定义在它上面，缺了它所有填充都取不到色
    el.innerHTML = `<style>${CSS}</style><div class="iso" data-theme="${opts.theme || "light"}"><div class="th-plate"><div class="th-stage">${buildSvg(model)}</div><p class="th-readout" data-readout>${text(derive(model))}</p></div></div>`;
    const stage = el.querySelector(".th-stage");
    const out = el.querySelector("[data-readout]");
    const ledGroup = stage.querySelector('[data-dyn="led"]');
    const barEl = stage.querySelector('[data-dyn="bar"] path');
    const texts = [...stage.querySelectorAll('[data-dyn="display"] text')];
    const tempText = texts[0] || null;
    const humText = texts[1] || null;
    const still = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let want = derive(model);
    let shown = { ...want };
    let raf = 0, last = 0, visible = true, lastLine = "";
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px" });
    io.observe(stage);

    function paint() {
      if (tempText) tempText.textContent = `${shown.temp.toFixed(1)}°C`;
      if (humText) humText.textContent = `${Math.round(shown.hum)}%RH`;
      if (ledGroup) ledGroup.style.opacity = shown.over ? "1" : "0.12";
      if (barEl) {
        barEl.setAttribute("d", barPath(shown.heat));
        barEl.setAttribute("class", shown.over ? "th-barfill th-barfill--hot" : "th-barfill");
      }
      const next = text(shown);
      if (next !== lastLine) { lastLine = next; out.textContent = next; }
    }
    function tick(now) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const k2 = still.matches ? 1 : 1 - Math.exp(-dt / 0.5);
      shown = { ...want };
      shown.temp = lerp(shown.temp, want.temp, k2);
      shown.hum = lerp(shown.hum, want.hum, k2);
      shown.heat = clamp((shown.temp - 20) / 15, 0, 1);
      shown.over = shown.temp > want.alarmT || shown.hum > want.alarmH;
      paint();
      raf = visible && (Math.abs(shown.temp - want.temp) > 0.02 || Math.abs(shown.hum - want.hum) > 0.08) ? requestAnimationFrame(tick) : 0;
    }
    function run() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } }
    paint();
    const ctrl = {
      set(m2) { model = m2; want = derive(m2); run(); },
      destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; io.disconnect(); if (global.__thCurrent === ctrl) global.__thCurrent = null; },
    };
    global.__thCurrent = ctrl;
    run();
    return ctrl;
  }

  global.ThFigure = { derive, buildSvg, readout, mount, needleAt, parts: () => PART_ORDER.map((p) => ({ name: p.name, anchor: p.anchor, svg: p.svg })), width: WIDTH, height: HEIGHT };
})(typeof window !== "undefined" ? window : globalThis);
