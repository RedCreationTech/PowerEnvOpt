/*
 * twin3d.js —— WebGL 3D 数字孪生机房（经典脚本 IIFE，全局 Twin3d，无模块依赖）。
 *
 * 世界：3 个站点大厅沿 x 轴分布（中心 -25 / 0 / +25，净宽 13m，间距 12m），
 * 每厅含 A、B 两个动力机房（隔断留 1.2m 门洞）。每区 6 类设备：
 * 配电柜 / UPS / 蓄电池组贴后墙，精密空调前排面朝后墙，柴油发电机撬座右前地板，
 * 温湿度传感器挂后墙。1 单位 = 1 m。
 *
 * 依赖 vendor/three.min.js（r152 UMD，全局 THREE）。漫游为自实现：
 * 指针锁定（单击 canvas 进入）+ 拖拽两种视角模式，WASD/方向键平移，Shift 加速，
 * 滚轮沿视线进退，Esc 退出锁定；点击设备补间飞行 0.9s 后回调 onSelect(id)。
 *
 * 用法：
 *   Twin3d.mount(el, { devices, onSelect }) → ctrl
 *   ctrl: { destroy(), teleport(siteName), focusDevice(id), setDevices(devices) }
 */
(function (global) {
  "use strict";

  /* ---------------- 常量 ---------------- */
  const HALL_X = [-25, 0, 25]; // 三个大厅中心
  const HALL_W = 13; // 净宽
  const HALL_D = 5.6; // 净深
  const WALL_H = 3.2;
  const WALL_T = 0.2;
  const WORLD_LIMIT = 60;
  const EYE_H = 1.7;
  const FLY_DIST = 2.2;
  const FLY_TIME = 0.9;

  const C = {
    sky: 0xdde6f0,
    fog: 0xdde6f0,
    ground: 0xc9d0d9,
    floor: 0xd4d8de,
    floorLine: 0xb4bac3,
    wall: 0xe9ecf1,
    cab: 0xd9dde3, // 柜体浅灰
    white: 0xeef0f4, // 柜体白
    batBlack: 0x1c2025, // 电池近黑
    upsDark: 0x4a5160, // UPS 深灰
    steel: 0x3a4048, // 钢架
    steelDark: 0x2b3038,
    yellow: 0xf2c230, // 警示标贴黄
    screen: 0x0e3a2c, // 屏幕墨绿
    screenGlow: 0x35d07f,
    skid: 0x2f3a4a, // 撬座深蓝灰
    engine: 0x3c434e,
    rad: 0x9aa0a8, // 散热器
    gen: 0x8a8f98, // 发电机筒身
    vent: 0x14161a,
    lampGreen: 0x2fbf71,
    lampRed: 0xe5484d,
    lampGray: 0x8b93a1,
    termRed: 0x8a3324, // 电池正极柱红棕
  };

  const TYPE_KEY = {
    UPS: "ups",
    蓄电池组: "batt",
    精密空调: "ac",
    配电柜: "pdu",
    温湿度传感器: "th",
    柴油发电机: "dg",
  };

  const FONT =
    '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';
  const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

  let active = null; // 单例守卫

  /* ---------------- DOM 样式 ---------------- */
  function injectStyles() {
    if (document.getElementById("twin3d-styles")) return;
    const st = document.createElement("style");
    st.id = "twin3d-styles";
    st.textContent = [
      ".twin3d{position:relative;width:100%;height:520px;overflow:hidden;background:#dde6f0;border-radius:10px}",
      ".twin3d canvas{display:block;width:100%;height:100%;touch-action:none}",
      ".twin3d-hint{position:absolute;top:10px;left:10px;z-index:5;padding:6px 11px;border-radius:8px;background:rgba(17,24,39,.78);color:#e8edf5;font:12px/1.6 " + FONT + ";pointer-events:none;white-space:nowrap}",
      ".twin3d-hover{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:5;padding:5px 12px;border-radius:999px;background:rgba(20,28,40,.88);color:#fff;font:12.5px/1.5 " + FONT + ";pointer-events:none;display:none;box-shadow:0 2px 10px rgba(15,23,42,.25)}",
      ".twin3d-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#f1f4f9;color:#5b6472;font:14px/1.8 " + FONT + ";text-align:center;padding:24px;border-radius:10px}",
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------------- Canvas 纹理 ---------------- */
  // 设备铭牌：两行（设备名 / id），白底深字小圆角
  function makePlateTexture(name, id) {
    const W = 576,
      H = 216; // 2x 分辨率保证清晰
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d");
    const r = 26;
    g.beginPath();
    g.moveTo(r, 4);
    g.arcTo(W - 4, 4, W - 4, H - 4, r);
    g.arcTo(W - 4, H - 4, 4, H - 4, r);
    g.arcTo(4, H - 4, 4, 4, r);
    g.arcTo(4, 4, W - 4, 4, r);
    g.closePath();
    g.fillStyle = "#ffffff";
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = "#c3cad4";
    g.stroke();
    g.fillStyle = "#1f2937";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '600 62px ' + FONT;
    g.fillText(String(name), W / 2, 78, W - 48);
    g.fillStyle = "#5b6472";
    g.font = '42px ' + MONO;
    g.fillText(String(id), W / 2, 158, W - 48);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // 大厅文字铭牌（Room / 站点名）
  function makeSignTexture(text, opt) {
    const o = Object.assign({ fs: 56, fg: "#1f2937", bg: "rgba(255,255,255,0.92)", border: "#c3cad4", pad: 30 }, opt);
    const cv = document.createElement("canvas");
    let g = cv.getContext("2d");
    g.font = '600 ' + o.fs + 'px ' + FONT;
    const tw = Math.ceil(g.measureText(text).width);
    cv.width = tw + o.pad * 2;
    cv.height = o.fs + o.pad * 1.35;
    g = cv.getContext("2d");
    const W = cv.width,
      H = cv.height,
      r = 20;
    g.beginPath();
    g.moveTo(r, 2);
    g.arcTo(W - 2, 2, W - 2, H - 2, r);
    g.arcTo(W - 2, H - 2, 2, H - 2, r);
    g.arcTo(2, H - 2, 2, 2, r);
    g.arcTo(2, 2, W - 2, 2, r);
    g.closePath();
    g.fillStyle = o.bg;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = o.border;
    g.stroke();
    g.fillStyle = o.fg;
    g.font = '600 ' + o.fs + 'px ' + FONT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, W / 2, H / 2 + 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // 地板瓷砖纹 + 网格线（整个大厅顶面一次映射）
  function makeFloorTexture() {
    const PPM = 50; // 每米 50px
    const W = HALL_W * PPM,
      H = HALL_D * PPM;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d");
    g.fillStyle = "#d4d8de";
    g.fillRect(0, 0, W, H);
    // 瓷砖错缝
    g.strokeStyle = "#ccd1d8";
    g.lineWidth = 2;
    for (let i = 0; i <= HALL_D * 2; i++) {
      g.beginPath();
      g.moveTo(0, i * PPM * 0.5);
      g.lineTo(W, i * PPM * 0.5);
      g.stroke();
    }
    for (let i = 0; i <= HALL_W * 2; i++) {
      const off = i % 2 ? PPM * 0.25 : 0;
      g.beginPath();
      g.moveTo(i * PPM * 0.5, off);
      g.lineTo(i * PPM * 0.5, H);
      g.stroke();
    }
    // 1m 主网格线
    g.strokeStyle = "#b4bac3";
    g.lineWidth = 3;
    for (let i = 0; i <= HALL_W; i++) {
      g.beginPath();
      g.moveTo(i * PPM, 0);
      g.lineTo(i * PPM, H);
      g.stroke();
    }
    for (let i = 0; i <= HALL_D; i++) {
      g.beginPath();
      g.moveTo(0, i * PPM);
      g.lineTo(W, i * PPM);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  /* ---------------- three 小工具 ---------------- */
  function std(color, o) {
    return new THREE.MeshStandardMaterial(
      Object.assign({ color: color, roughness: 0.82, metalness: 0.08 }, o || {})
    );
  }
  function box(w, h, d, m, x, y, z, rx, ry, rz) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  function cyl(rt, rb, h, m, x, y, z, rx, ry, rz) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 18), m);
    mesh.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  function sph(r, m, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true;
    return mesh;
  }
  // 半透明发光材质（屏幕 / 指示灯），不参与投影
  function glow(color, intensity) {
    return new THREE.MeshStandardMaterial({
      color: 0x0b0e12,
      emissive: color,
      emissiveIntensity: intensity == null ? 1 : intensity,
      roughness: 0.5,
      metalness: 0,
    });
  }
  function flat(mesh) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }

  /* ---------------- 6 类设备模型（正面朝 -z，原点在占地中心、地面 y=0） ---------------- */
  function buildUps() {
    const g = new THREE.Group();
    const dark = std(C.upsDark);
    const trim = std(0x343a46);
    g.add(box(1.04, 0.09, 1.14, trim, 0, 0.045, 0)); // 底座
    g.add(box(1.0, 2.0, 1.1, dark, 0, 1.09, 0)); // 塔身
    // 前脸上下分割线
    g.add(flat(box(0.9, 0.02, 0.012, trim, 0, 1.38, -0.556)));
    g.add(flat(box(0.9, 0.02, 0.012, trim, 0, 0.72, -0.556)));
    // 上部 LCD 窗 + 绿色读数条 + 两只状态方块
    g.add(box(0.44, 0.32, 0.022, std(0x101216, { roughness: 0.4 }), 0, 1.62, -0.556));
    g.add(flat(box(0.3, 0.07, 0.012, glow(C.screenGlow, 0.95), 0, 1.63, -0.57)));
    g.add(flat(box(0.05, 0.05, 0.012, glow(C.lampGreen, 1), -0.12, 1.5, -0.57)));
    g.add(flat(box(0.05, 0.05, 0.012, glow(0xd98e2b, 1), -0.03, 1.5, -0.57)));
    // 中部大面板 + 黄色警示贴
    g.add(box(0.86, 0.5, 0.02, std(0x434a59), 0, 1.04, -0.556));
    g.add(flat(box(0.2, 0.15, 0.012, std(C.yellow, { roughness: 0.6 }), 0.28, 1.04, -0.573)));
    g.add(flat(box(0.1, 0.02, 0.014, std(0x23262c), 0.28, 1.04, -0.58)));
    // 底部 1/3 三条黑色横通风栅
    [0.26, 0.44, 0.62].forEach(function (y) {
      g.add(box(0.86, 0.1, 0.02, std(C.vent, { roughness: 0.95 }), 0, y, -0.556));
    });
    g.userData.dims = { w: 1.0, d: 1.1, h: 2.09 };
    return g;
  }

  function buildBattery() {
    const g = new THREE.Group();
    const frame = std(C.steel, { metalness: 0.25, roughness: 0.6 });
    const post = { w: 0.06, d: 0.06 };
    // 4 角柱
    [
      [-0.6, -0.37],
      [0.6, -0.37],
      [-0.6, 0.37],
      [0.6, 0.37],
    ].forEach(function (p) {
      g.add(box(post.w, 1.85, post.d, frame, p[0], 0.925, p[1]));
    });
    // 顶层横梁
    g.add(box(1.26, 0.06, 0.06, frame, 0, 1.82, -0.37));
    g.add(box(1.26, 0.06, 0.06, frame, 0, 1.82, 0.37));
    g.add(box(0.06, 0.06, 0.8, frame, -0.6, 1.82, 0));
    g.add(box(0.06, 0.06, 0.8, frame, 0.6, 1.82, 0));
    // 3 层托盘 × 每层 2 块电池
    const trayM = std(0x33393f, { metalness: 0.2, roughness: 0.65 });
    const batM = std(C.batBlack, { roughness: 0.9 });
    const lidM = std(0x22262c, { roughness: 0.85 });
    [0.14, 0.74, 1.34].forEach(function (ty) {
      g.add(box(1.26, 0.05, 0.8, trayM, 0, ty, 0));
      [-0.315, 0.315].forEach(function (bx) {
        const by = ty + 0.2; // 电池块中心
        g.add(box(0.56, 0.3, 0.72, batM, bx, by, 0));
        g.add(box(0.58, 0.035, 0.74, lidM, bx, ty + 0.365, 0)); // 上盖沿
        g.add(flat(box(0.26, 0.02, 0.07, std(0x0d0f12), bx, ty + 0.39, 0))); // 提手凹槽线
        g.add(cyl(0.032, 0.032, 0.05, std(C.termRed, { roughness: 0.5 }), bx - 0.14, ty + 0.4, 0.18));
        g.add(cyl(0.032, 0.032, 0.05, std(0x2a2e33), bx + 0.14, ty + 0.4, 0.18));
      });
    });
    g.userData.dims = { w: 1.3, d: 0.85, h: 1.88 };
    return g;
  }

  function buildAc() {
    const g = new THREE.Group();
    const bodyM = std(C.white);
    g.add(box(1.09, 0.07, 1.04, std(0xd4d8de), 0, 0.035, 0)); // 底座
    g.add(box(1.05, 2.03, 1.0, bodyM, 0, 1.085, 0)); // 柜体
    g.add(box(0.98, 1.96, 0.03, std(0xf4f6f8), 0, 1.1, -0.5)); // 前脸门板
    // 前上部回风格栅（暗底 + 4 横条）
    g.add(flat(box(0.84, 0.5, 0.015, std(0x9aa1ab), 0, 1.62, -0.517)));
    [1.45, 1.58, 1.71, 1.84].forEach(function (y) {
      g.add(flat(box(0.8, 0.075, 0.02, std(0xe4e7ec), 0, y, -0.527)));
    });
    // 前下部 3 片斜百叶（绕 x 轴 ~25°）
    [0.42, 0.62, 0.82].forEach(function (y) {
      const louver = box(0.8, 0.17, 0.02, std(0xdfe3e8), 0, y, -0.53, -0.44, 0, 0);
      g.add(louver);
    });
    // 右上小显示窗 + 状态灯
    g.add(box(0.2, 0.14, 0.02, std(C.screen, { roughness: 0.4 }), 0.32, 1.99, -0.517));
    g.add(flat(box(0.12, 0.05, 0.012, glow(C.screenGlow, 0.9), 0.32, 1.99, -0.53)));
    g.add(flat(box(0.03, 0.03, 0.012, glow(C.lampGreen, 1), 0.44, 1.99, -0.53)));
    // 顶部风扇网罩：平放 Torus + 4 根放射筋
    const guardM = std(0x6a707a, { metalness: 0.3, roughness: 0.55 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 10, 40), guardM);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 2.115, 0);
    flat(ring);
    g.add(ring);
    for (let k = 0; k < 4; k++) {
      const bar = box(0.5, 0.016, 0.034, guardM, 0, 2.112, 0, 0, (k * Math.PI) / 4, 0);
      flat(bar);
      g.add(bar);
    }
    const hub = cyl(0.032, 0.032, 0.03, guardM, 0, 2.115, 0);
    flat(hub);
    g.add(hub);
    g.userData.dims = { w: 1.05, d: 1.0, h: 2.12 };
    return g;
  }

  function buildPdu() {
    const g = new THREE.Group();
    g.add(box(0.94, 0.07, 0.99, std(0x9aa0a8), 0, 0.035, 0)); // 底座
    g.add(box(0.9, 1.93, 0.95, std(0xb9bec7), 0, 1.035, 0)); // 柜体
    g.add(box(0.84, 1.87, 0.03, std(0xc4c9d1), 0, 1.05, -0.475)); // 门
    // 上部 2 只电表窗（深绿黑）
    [-0.17, 0.17].forEach(function (x) {
      g.add(box(0.2, 0.26, 0.02, std(0x0f2f24, { roughness: 0.35 }), x, 1.62, -0.49));
    });
    // 红 / 绿 两只信号灯
    g.add(flat(sph(0.026, glow(C.lampRed, 1), -0.17, 1.4, -0.49)));
    g.add(flat(sph(0.026, glow(C.lampGreen, 1), 0.17, 1.4, -0.49)));
    // 中部 3×4 微型断路器（凸起的方块 + 斜杠杆）
    const brkM = std(0x2b3038);
    const levM = std(0xd7dbe0);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const x = -0.27 + c * 0.18,
          y = 1.12 - r * 0.18;
        g.add(flat(box(0.1, 0.15, 0.03, brkM, x, y, -0.492)));
        g.add(flat(box(0.025, 0.09, 0.02, levM, x + 0.02, y, -0.51, 0, 0, -0.35)));
      }
    }
    // 黄色警示贴 + 底部通风缝
    g.add(flat(box(0.17, 0.13, 0.012, std(C.yellow, { roughness: 0.6 }), 0.27, 0.5, -0.492)));
    g.add(flat(box(0.1, 0.02, 0.014, std(0x23262c), 0.27, 0.5, -0.5)));
    [0.24, 0.31].forEach(function (y) {
      g.add(flat(box(0.56, 0.04, 0.014, std(0x8f959e), 0, y, -0.49)));
    });
    g.userData.dims = { w: 0.9, d: 0.95, h: 2.0 };
    return g;
  }

  function buildSensor() {
    const g = new THREE.Group();
    g.add(box(0.14, 0.2, 0.07, std(0xf2f3f5), 0, 0.1, 0));
    g.add(box(0.12, 0.18, 0.012, std(0xe2e5ea), 0, 0.1, -0.036)); // 前面板
    g.add(flat(sph(0.012, glow(C.lampGreen, 1.2), 0.04, 0.14, -0.043))); // LED
    [0.055, 0.075, 0.095].forEach(function (y) {
      g.add(flat(box(0.05, 0.008, 0.006, std(0xc3c8cf), -0.025, y, -0.043)));
    });
    g.userData.dims = { w: 0.14, d: 0.07, h: 0.2 };
    return g;
  }

  function buildGenset() {
    const g = new THREE.Group();
    const skidM = std(C.skid, { metalness: 0.2, roughness: 0.7 });
    g.add(box(1.9, 0.12, 0.9, skidM, 0, 0.06, 0)); // 撬座
    // 撬座边吊耳
    [-0.85, 0.85].forEach(function (x) {
      g.add(box(0.1, 0.06, 0.14, skidM, x, 0.15, -0.38));
      g.add(box(0.1, 0.06, 0.14, skidM, x, 0.15, 0.38));
    });
    // 中部发动机块
    g.add(box(0.8, 0.52, 0.58, std(C.engine), -0.08, 0.38, 0));
    g.add(box(0.7, 0.09, 0.42, std(0x4a525e), -0.08, 0.685, 0)); // 气门室罩
    // 顶面 4 只缸盖凸包（半圆柱排）
    [-0.18, -0.06, 0.06, 0.18].forEach(function (z) {
      const bump = cyl(0.085, 0.085, 0.5, std(0x4a525e), -0.08, 0.72, z, Math.PI / 2, 0, 0);
      g.add(bump);
    });
    g.add(cyl(0.015, 0.015, 0.3, std(0xd9b23a), 0.28, 0.55, 0.28)); // 侧油尺
    // 右端散热器：翅片组 + 圆形风扇护罩
    g.add(box(0.22, 0.5, 0.6, std(C.rad), 0.6, 0.4, 0));
    for (let i = 0; i < 6; i++) {
      g.add(flat(box(0.24, 0.02, 0.62, std(0xaeb4bc), 0.6, 0.2 + i * 0.08, 0)));
    }
    const fanRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 10, 36), std(0x6a707a));
    fanRing.rotation.y = Math.PI / 2;
    fanRing.position.set(0.725, 0.4, 0);
    flat(fanRing);
    g.add(fanRing);
    const cross1 = box(0.015, 0.4, 0.015, std(0x6a707a), 0.73, 0.4, 0);
    const cross2 = box(0.015, 0.015, 0.4, std(0x6a707a), 0.73, 0.4, 0);
    flat(cross1);
    flat(cross2);
    g.add(cross1);
    g.add(cross2);
    // 左端发电机：筒身 + 端盖 + 3 道散热筋
    g.add(cyl(0.24, 0.24, 0.42, std(C.gen), -0.68, 0.38, 0, 0, 0, Math.PI / 2));
    g.add(cyl(0.17, 0.17, 0.06, std(0x767c86), -0.92, 0.38, 0, 0, 0, Math.PI / 2));
    [-0.56, -0.68, -0.8].forEach(function (x) {
      const fin = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.01, 8, 32), std(0x7d838d));
      fin.rotation.y = Math.PI / 2;
      fin.position.set(x, 0.38, 0);
      flat(fin);
      g.add(fin);
    });
    // 排气管：2 段圆管拐上 + 0.5m 处消音器小盒
    g.add(cyl(0.04, 0.04, 0.5, std(0x565d68), -0.25, 0.95, 0.15));
    g.add(cyl(0.04, 0.04, 0.34, std(0x565d68), -0.09, 1.19, 0.15, 0, 0, Math.PI / 2));
    g.add(box(0.32, 0.14, 0.14, std(0x4a525e), 0.14, 1.19, 0.15));
    g.add(cyl(0.045, 0.045, 0.03, std(0x565d68), 0.31, 1.19, 0.15, 0, 0, Math.PI / 2));
    // 撬座边小控制箱：盒 + 表窗 + 灯
    g.add(box(0.26, 0.34, 0.18, std(C.cab), 0.72, 0.29, -0.31));
    g.add(flat(box(0.12, 0.09, 0.012, std(0x0f2f24), 0.72, 0.33, -0.403)));
    g.add(flat(sph(0.014, glow(C.lampGreen, 1), 0.79, 0.24, -0.4)));
    g.userData.dims = { w: 1.9, d: 0.9, h: 1.3 };
    return g;
  }

  const BUILDERS = {
    ups: buildUps,
    batt: buildBattery,
    ac: buildAc,
    pdu: buildPdu,
    th: buildSensor,
    dg: buildGenset,
  };

  function typeKey(dev) {
    return TYPE_KEY[dev.type] || "ups";
  }

  /* ---------------- 世界构建 ---------------- */
  function buildHall(floorTex) {
    const g = new THREE.Group();
    const wallM = std(C.wall, { roughness: 0.95 });
    // 地板（顶面瓷砖纹 CanvasTexture，其余侧面素色）
    const floorSide = std(C.floor);
    const floorTop = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.9,
      metalness: 0.02,
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(HALL_W, 0.25, HALL_D), [
      floorSide,
      floorSide,
      floorTop,
      floorSide,
      floorSide,
      floorSide,
    ]);
    floor.position.set(0, -0.125, 0);
    floor.receiveShadow = true;
    g.add(floor);
    // 后墙 / 左右端墙
    const back = box(HALL_W + 0.4, WALL_H, WALL_T, wallM, 0, WALL_H / 2, HALL_D / 2 + WALL_T / 2);
    const left = box(WALL_T, WALL_H, HALL_D, wallM, -HALL_W / 2 - WALL_T / 2, WALL_H / 2, 0);
    const right = box(WALL_T, WALL_H, HALL_D, wallM, HALL_W / 2 + WALL_T / 2, WALL_H / 2, 0);
    g.add(back);
    g.add(left);
    g.add(right);
    // 中间隔断（1.2m 门洞 + 门楣）
    const segD = (HALL_D - 1.2) / 2;
    g.add(box(WALL_T, WALL_H, segD, wallM, 0, WALL_H / 2, -(0.6 + segD / 2)));
    g.add(box(WALL_T, WALL_H, segD, wallM, 0, WALL_H / 2, 0.6 + segD / 2));
    g.add(box(WALL_T, WALL_H - 2.45, 1.2, wallM, 0, 2.45 + (WALL_H - 2.45) / 2, 0));
    return g;
  }

  // 每区槽位（相对区中心 zc）：pdu/ups/batt 后墙排，ac 前排朝后墙，dg 右前，th 挂墙
  const ZONE_SLOTS = {
    pdu: { p: [-1.95, 0, 2.0], ry: 0, gap: 1.05 },
    ups: { p: [0, 0, 2.0], ry: 0, gap: 1.15 },
    batt: { p: [1.95, 0, 2.0], ry: 0, gap: 1.4 },
    ac: { p: [0, 0, -1.62], ry: Math.PI, gap: 1.2 },
    dg: { p: [1.7, 0, -0.15], ry: 0, gap: 2.0 },
    th: { p: [-1.0, 1.5, 2.755], ry: 0, gap: 0.4 },
  };

  function addDevicePlate(group, dev) {
    const dims = group.userData.dims;
    const tex = makePlateTexture(dev.name, dev.id);
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    let sx = 0.9,
      sy = 0.3375,
      py = dims.h * 0.55,
      pz = -dims.d / 2 - 0.38;
    if (dims.h < 1.6 && dims.d > 0.3) {
      // 低矮设备（柴发撬座）：铭牌缩小下移，露出机身细节
      sx = 0.72;
      sy = 0.27;
      py = dims.h * 0.32;
      pz = -dims.d / 2 - 0.34;
    } else if (dims.h < 0.4) {
      // 挂墙传感器：小铭牌挂到设备下方，不遮挡白盒
      sx = 0.5;
      sy = 0.1875;
      py = -0.3;
      pz = -0.12;
    }
    sp.scale.set(sx, sy, 1);
    sp.position.set(0, py, pz);
    group.add(sp);
  }

  function addStatusLight(group, dev, statusList) {
    const dims = group.userData.dims;
    const color = !dev.online ? C.lampGray : dev.alarm ? C.lampRed : C.lampGreen;
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0x22262c,
        emissive: color,
        emissiveIntensity: 1.15,
        roughness: 0.4,
      })
    );
    m.position.set(dims.w / 2 - 0.08, dims.h + 0.05, -dims.d / 2 + 0.08);
    group.add(m);
    statusList.push({ mesh: m, dev: dev });
  }

  function makeSignSprite(text, scaleX, fs) {
    const tex = makeSignTexture(text, { fs: fs });
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    const ratio = tex.image.height / tex.image.width;
    sp.scale.set(scaleX, scaleX * ratio, 1);
    return sp;
  }

  function buildWorld(ctx) {
    const world = new THREE.Group();
    ctx.pickables = [];
    ctx.statusLights = [];
    const floorTex = makeFloorTexture();
    const sites = [];
    ctx.devices.forEach(function (d) {
      if (d.site && sites.indexOf(d.site) < 0) sites.push(d.site);
    });
    ctx.sites = sites;

    // 室外大地
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_LIMIT * 2 + 30, WORLD_LIMIT * 2 + 30),
      std(C.ground, { roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.26;
    ground.receiveShadow = true;
    world.add(ground);

    sites.forEach(function (site, si) {
      const cx = HALL_X[si] != null ? HALL_X[si] : si * 25;
      const hall = buildHall(floorTex);
      hall.position.x = cx;
      world.add(hall);
      // 大厅正上方 2.8m 站点名铭牌（厅前悬空，避开隔断墙体）
      const siteSign = makeSignSprite(site, 3.4, 52);
      siteSign.position.set(cx, 2.82, -3.2);
      world.add(siteSign);

      const siteDevs = ctx.devices.filter(function (d) {
        return d.site === site;
      });
      const rooms = [];
      siteDevs.forEach(function (d) {
        const r = d.room || "";
        const key = r.indexOf("B") >= 0 ? "B 区动力机房" : "A 区动力机房";
        if (rooms.indexOf(key) < 0) rooms.push(key);
      });
      rooms.sort();
      rooms.forEach(function (room, ri) {
        const zc = ri === 0 ? -3.3 : 3.3; // 区中心 x 偏移
        // 墙上 Room 铭牌
        const roomSign = makeSignSprite(room, 1.9, 42);
        roomSign.position.set(cx + zc, 2.62, HALL_D / 2 - 0.12);
        world.add(roomSign);

        const rdevs = siteDevs.filter(function (d) {
          const key = (d.room || "").indexOf("B") >= 0 ? "B 区动力机房" : "A 区动力机房";
          return key === room;
        });
        const byType = {};
        rdevs.forEach(function (d) {
          const k = typeKey(d);
          (byType[k] = byType[k] || []).push(d);
        });
        Object.keys(byType).forEach(function (k) {
          const slot = ZONE_SLOTS[k] || ZONE_SLOTS.ups;
          const list = byType[k];
          list.forEach(function (dev, i) {
            const builder = BUILDERS[k] || buildUps;
            const grp = builder();
            grp.name = dev.id;
            grp.userData.device = dev;
            const ox = (i - (list.length - 1) / 2) * slot.gap;
            grp.position.set(cx + zc + slot.p[0] + ox, slot.p[1], slot.p[2]);
            grp.rotation.y = slot.ry;
            addStatusLight(grp, dev, ctx.statusLights);
            addDevicePlate(grp, dev);
            world.add(grp);
            ctx.pickables.push(grp);
          });
        });
      });
    });
    return world;
  }

  function disposeObject(root) {
    root.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach(function (m) {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    });
  }

  /* ---------------- mount ---------------- */
  function mount(el, opts) {
    if (!el) throw new Error("Twin3d.mount: 缺少挂载容器");
    if (active) active.destroy();
    injectStyles();

    const devices = (opts && opts.devices) || [];
    const onSelect = opts && opts.onSelect;

    const root = document.createElement("div");
    root.className = "twin3d";
    el.appendChild(root);

    let renderer;
    try {
      if (typeof THREE === "undefined") throw new Error("THREE 未加载");
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      const fb = document.createElement("div");
      fb.className = "twin3d-fallback";
      fb.textContent = "当前环境不支持 WebGL，3D 数字孪生机房无法渲染。";
      root.appendChild(fb);
      const stub = { destroy: function () { if (fb.parentNode) fb.parentNode.removeChild(fb); }, teleport: function () {}, focusDevice: function () {}, setDevices: function () {} };
      active = stub;
      return stub;
    }

    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setClearColor(C.sky, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    root.appendChild(renderer.domElement);
    const canvas = renderer.domElement;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(C.fog, 60, 90);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 240);
    camera.rotation.order = "YXZ";

    // 光照：半球环境 + 主平行光（投影）+ 反向补光
    scene.add(new THREE.HemisphereLight(0xcfe0f4, 0x8f939b, 0.95));
    const sun = new THREE.DirectionalLight(0xfff4e4, 1.35);
    sun.position.set(38, 55, 28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -48;
    sun.shadow.camera.right = 48;
    sun.shadow.camera.top = 48;
    sun.shadow.camera.bottom = -48;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 170;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfe9f7, 0.3);
    fill.position.set(-30, 40, -35);
    scene.add(fill);

    // 提示条 + 悬浮名字条 + 锁定准星
    const hint = document.createElement("div");
    hint.className = "twin3d-hint";
    hint.textContent = "点击场景锁定鼠标 · 360° 转视角（可仰俯到底）· WASD 移动 · Q/E 升降 · Shift 加速 · 滚轮平滑前进 · 点击设备查看机理 · Esc 退出";
    root.appendChild(hint);
    const hover = document.createElement("div");
    hover.className = "twin3d-hover";
    root.appendChild(hover);
    const cross = document.createElement("div");
    cross.className = "twin3d-cross";
    cross.style.cssText = "position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:rgba(47,109,246,.9);box-shadow:0 0 0 2px rgba(255,255,255,.75);display:none;pointer-events:none;z-index:5;";
    root.appendChild(cross);

    const ctx = {
      renderer: renderer,
      scene: scene,
      camera: camera,
      devices: devices.slice(),
      pickables: [],
      statusLights: [],
      sites: [],
    };
    ctx.world = buildWorld(ctx);
    scene.add(ctx.world);

    /* ---------- 漫游状态 ---------- */
    const PITCH_MAX = 1.553; // ≈89°：几乎可仰望/俯瞰到底
    const st = {
      yaw: Math.PI,
      pitch: -0.11,
      tyaw: Math.PI,
      tpitch: -0.11,
      keys: Object.create(null),
      dragging: false,
      dragX: 0,
      dragY: 0,
      downX: 0,
      downY: 0,
      moved: 0,
      hoverId: null,
      tween: null,
      pendingSelect: null,
      zoomVel: 0,
      eyeTarget: EYE_H,
      inView: true,
      raf: 0,
      destroyed: false,
    };
    camera.position.set(0, EYE_H, -6.8);
    camera.rotation.set(st.pitch, st.yaw, 0);

    /* ---------- 尺寸自适应 ---------- */
    function resize() {
      const w = root.clientWidth || 800;
      const h = root.clientHeight || 520;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    /* ---------- 视口内才渲染 ---------- */
    const io = new IntersectionObserver(
      function (entries) {
        st.inView = entries[0] ? entries[0].isIntersecting : true;
      },
      { threshold: 0.01 }
    );
    io.observe(root);

    /* ---------- 拾取 ---------- */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const tmpV = new THREE.Vector3();
    const tmpF = new THREE.Vector3();
    const tmpR = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);

    function pickAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      raycaster.camera = camera;
      const hits = raycaster.intersectObjects(ctx.pickables, true);
      for (let i = 0; i < hits.length; i++) {
        let o = hits[i].object;
        while (o && !o.userData.device) o = o.parent;
        if (o) return o;
      }
      return null;
    }

    function showHover(dev) {
      const id = dev ? dev.id : null;
      if (id === st.hoverId) return;
      st.hoverId = id;
      if (dev) {
        const tag = !dev.online ? " · 离线" : dev.alarm ? " · ⚠ " + (dev.alarmTitle || "活动告警") : " · 正常";
        hover.textContent = dev.name + " · " + dev.id + tag;
        hover.style.display = "block";
        canvas.style.cursor = "pointer";
      } else {
        hover.style.display = "none";
        canvas.style.cursor = "";
      }
    }

    /* ---------- 补间飞行 ---------- */
    function flyTo(pos, target, done) {
      st.tween = {
        t: 0,
        fromPos: camera.position.clone(),
        toPos: pos.clone(),
        fromTgt: new THREE.Vector3().copy(currentTarget()),
        toTgt: target.clone(),
        done: done || null,
      };
      st.pendingSelect = null;
    }
    const lookCurrent = new THREE.Vector3();
    function currentTarget() {
      camera.getWorldDirection(lookCurrent);
      return lookCurrent.multiplyScalar(6).add(camera.position);
    }
    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    function syncAngles() {
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
      st.yaw = st.tyaw = e.y;
      st.pitch = st.tpitch = THREE.MathUtils.clamp(e.x, -PITCH_MAX, PITCH_MAX);
      st.eyeTarget = camera.position.y;
    }

    function deviceFocusPoint(grp) {
      const dims = grp.userData.dims || { w: 1, d: 1, h: 1.6 };
      const center = grp.position.clone();
      center.y += dims.h * 0.5;
      const front = new THREE.Vector3(0, 0, -1).applyQuaternion(grp.quaternion);
      const eye = center.clone().addScaledVector(front, dims.d / 2 + FLY_DIST);
      eye.y = EYE_H;
      return { eye: eye, target: center };
    }

    function focusDevice(id) {
      const grp = ctx.pickables.find(function (g) {
        return g.name === id;
      });
      if (!grp) return;
      const fp = deviceFocusPoint(grp);
      flyTo(fp.eye, fp.target, null);
    }

    function selectDevice(id) {
      focusDevice(id);
      st.pendingSelect = id;
    }

    function teleport(siteName) {
      const idx = ctx.sites.indexOf(siteName);
      if (idx < 0) return;
      const cx = HALL_X[idx] != null ? HALL_X[idx] : idx * 25;
      st.tween = null;
      st.pendingSelect = null;
      camera.position.set(cx, EYE_H, -3.1);
      st.yaw = st.tyaw = Math.PI;
      st.pitch = st.tpitch = 0;
      st.eyeTarget = EYE_H;
      camera.rotation.set(st.pitch, st.yaw, 0);
    }

    /* ---------- 输入事件 ---------- */
    function onMouseMove(e) {
      if (document.pointerLockElement === canvas) {
        st.tyaw -= e.movementX * 0.0023;
        st.tpitch = THREE.MathUtils.clamp(st.tpitch - e.movementY * 0.0023, -PITCH_MAX, PITCH_MAX);
      } else if (st.dragging) {
        st.tyaw -= e.movementX * 0.0032;
        st.tpitch = THREE.MathUtils.clamp(st.tpitch - e.movementY * 0.0032, -PITCH_MAX, PITCH_MAX);
        st.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      } else {
        const grp = pickAt(e.clientX, e.clientY);
        showHover(grp ? grp.userData.device : null);
      }
    }
    function onPointerDown(e) {
      if (e.button !== 0) return;
      st.dragging = true;
      st.downX = e.clientX;
      st.downY = e.clientY;
      st.moved = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    function canvasCenter() {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function onPointerUp(e) {
      if (!st.dragging) return;
      st.dragging = false;
      const dist = Math.hypot(e.clientX - st.downX, e.clientY - st.downY);
      if (dist < 6 && st.moved < 10) {
        if (document.pointerLockElement === canvas) {
          // 锁定态：以画面中心准星拾取
          const c = canvasCenter();
          const grp = pickAt(c.x, c.y);
          if (grp) selectDevice(grp.name);
        } else {
          const grp = pickAt(e.clientX, e.clientY);
          if (grp) {
            selectDevice(grp.name);
          } else {
            try {
              canvas.requestPointerLock({ unadjustedMovement: true });
            } catch (err) {
              try {
                canvas.requestPointerLock();
              } catch (err2) {}
            }
          }
        }
      }
    }
    function onWheel(e) {
      e.preventDefault();
      if (st.tween) return;
      st.zoomVel += e.deltaY;
    }
    function isFormTarget(t) {
      return t && t.closest && t.closest("input,textarea,select,button");
    }
    function onKeyDown(e) {
      if (isFormTarget(e.target)) return;
      st.keys[e.code] = true;
      if (e.code.indexOf("Arrow") === 0) e.preventDefault();
    }
    function onKeyUp(e) {
      st.keys[e.code] = false;
    }
    function onLockChange() {
      const locked = document.pointerLockElement === canvas;
      if (!locked) showHover(null);
      cross.style.display = locked ? "block" : "none";
    }
    function onContextMenu(e) {
      e.preventDefault();
    }
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerlockchange", onLockChange);
    canvas.addEventListener("contextmenu", onContextMenu);

    /* ---------- 帧循环 ---------- */
    const clock = new THREE.Clock();
    function frame() {
      if (st.destroyed) return;
      st.raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;

      if (st.inView) {
        // 补间飞行
        if (st.tween) {
          const tw = st.tween;
          tw.t += dt / FLY_TIME;
          const k = easeInOut(Math.min(tw.t, 1));
          camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
          tmpV.lerpVectors(tw.fromTgt, tw.toTgt, k);
          camera.lookAt(tmpV);
          if (tw.t >= 1) {
            st.tween = null;
            syncAngles();
            if (st.pendingSelect) {
              const id = st.pendingSelect;
              st.pendingSelect = null;
              if (typeof onSelect === "function") {
                try {
                  onSelect(id);
                } catch (err) {
                  console.error(err);
                }
              }
            }
          }
        } else {
          // 漫游移动（WASD / 方向键）；视角朝目标指数平滑，滚轮平滑推拉，Q/E 升降
          const damp = 1 - Math.exp(-dt * 22);
          st.yaw += (st.tyaw - st.yaw) * damp;
          st.pitch += (st.tpitch - st.pitch) * damp;
          camera.rotation.set(st.pitch, st.yaw, 0);
          let iz = 0,
            ix = 0,
            iy = 0;
          const k = st.keys;
          if (k.KeyW || k.ArrowUp) iz += 1;
          if (k.KeyS || k.ArrowDown) iz -= 1;
          if (k.KeyA || k.ArrowLeft) ix -= 1;
          if (k.KeyD || k.ArrowRight) ix += 1;
          if (k.KeyE || k.PageUp) iy += 1;
          if (k.KeyQ || k.PageDown) iy -= 1;
          if (iz || ix) {
            camera.getWorldDirection(tmpF);
            tmpF.y = 0;
            tmpF.normalize();
            tmpR.crossVectors(tmpF, UP).normalize();
            const speed = 3.6 * (k.ShiftLeft || k.ShiftRight ? 2.5 : 1) * dt;
            camera.position.addScaledVector(tmpF, iz * speed);
            camera.position.addScaledVector(tmpR, ix * speed);
            camera.position.x = THREE.MathUtils.clamp(camera.position.x, -WORLD_LIMIT, WORLD_LIMIT);
            camera.position.z = THREE.MathUtils.clamp(camera.position.z, -WORLD_LIMIT, WORLD_LIMIT);
          }
          if (iy) st.eyeTarget = THREE.MathUtils.clamp(st.eyeTarget + iy * 1.6 * dt, 0.6, 4.5);
          if (Math.abs(st.zoomVel) > 0.01) {
            camera.getWorldDirection(tmpF);
            tmpF.y = 0;
            if (tmpF.lengthSq() > 1e-6) {
              tmpF.normalize();
              camera.position.addScaledVector(tmpF, -st.zoomVel * dt * 0.05);
              camera.position.x = THREE.MathUtils.clamp(camera.position.x, -WORLD_LIMIT, WORLD_LIMIT);
              camera.position.z = THREE.MathUtils.clamp(camera.position.z, -WORLD_LIMIT, WORLD_LIMIT);
            }
            st.zoomVel *= Math.exp(-dt * 9);
          }
          camera.position.y += (st.eyeTarget - camera.position.y) * (1 - Math.exp(-dt * 10));
        }
        // 告警灯脉动
        for (let i = 0; i < ctx.statusLights.length; i++) {
          const s = ctx.statusLights[i];
          if (s.dev.online && s.dev.alarm) {
            const p = 0.5 + 0.5 * Math.sin(t * 5.2);
            s.mesh.material.emissiveIntensity = 0.9 + 1.9 * p;
            s.mesh.scale.setScalar(1 + 0.35 * p);
          }
        }
        renderer.render(scene, camera);
      }
    }
    st.raf = requestAnimationFrame(frame);

    /* ---------- 控制句柄 ---------- */
    let destroyed = false;
    const ctrl = {
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        st.destroyed = true;
        cancelAnimationFrame(st.raf);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("wheel", onWheel);
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("keyup", onKeyUp);
        document.removeEventListener("pointerlockchange", onLockChange);
        canvas.removeEventListener("contextmenu", onContextMenu);
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        disposeObject(ctx.world);
        renderer.dispose();
        if (root.parentNode) root.parentNode.removeChild(root);
        if (active === ctrl) active = null;
      },
      teleport: teleport,
      focusDevice: focusDevice,
      setDevices: function (next) {
        ctx.devices = (next || []).slice();
        scene.remove(ctx.world);
        disposeObject(ctx.world);
        ctx.world = buildWorld(ctx);
        scene.add(ctx.world);
        showHover(null);
      },
      _el: root,
    };
    active = ctrl;
    return ctrl;
  }

  global.Twin3d = { mount: mount, version: "1.0.0" };
})(typeof window !== "undefined" ? window : this);
