"use strict";
const $ = (s) => document.querySelector(s),
  $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const SITES = [
  "北京 · 亦庄数据中心",
  "上海 · 张江数据中心",
  "深圳 · 南山数据中心",
];
const TYPES = [
  "UPS",
  "蓄电池组",
  "精密空调",
  "配电柜",
  "温湿度传感器",
  "柴油发电机",
];
const SEED = () => ({
  schema: 1,
  tick: 0,
  devices: Array.from({ length: 36 }, (_, i) => ({
    id: `HC-${["BJ", "SH", "SZ"][Math.floor(i / 12)]}-${String((i % 12) + 1).padStart(3, "0")}`,
    name: `${TYPES[i % 6]} ${String(Math.floor((i % 12) / 6) + 1).padStart(2, "0")}`,
    type: TYPES[i % 6],
    site: SITES[Math.floor(i / 12)],
    room: i % 12 < 6 ? "A 区动力机房" : "B 区动力机房",
    model: [
      "HC-UPS40",
      "HC-BAT192",
      "HC-PAC30",
      "HC-PDU400",
      "HC-TH01",
      "HC-DG200",
    ][i % 6],
    temp: Math.round((23 + (i % 7) * 1.4 + (i === 0 ? 10 : 0)) * 10) / 10,
    load: 48 + ((i * 7) % 36),
    health: i === 0 ? 76 : 90 + (i % 9),
    quality:
      i === 4 ? "迟到" : i === 16 ? "缺失" : i === 29 ? "时钟漂移" : "有效",
    online: i !== 16,
    points: 8,
  })),
  alarms: Array.from({ length: 18 }, (_, i) => ({
    id: `AL-20261017-${String(i + 1).padStart(3, "0")}`,
    device: `HC-${["BJ", "SH", "SZ"][Math.floor(i / 6)]}-${String((i % 6) + 1).padStart(3, "0")}`,
    title: [
      "UPS 温升持续偏高",
      "电池组压差偏大",
      "制冷效率偏离基线",
      "配电负载接近阈值",
      "遥测质量异常",
      "启动电池电压偏低",
    ][i % 6],
    severity: i % 6 === 0 ? "紧急" : i % 3 === 1 ? "重要" : "提示",
    source: i % 3 === 0 ? "预测模拟" : "规则模拟",
    status: "待确认",
    suppressedUntil: null,
    group: i % 6 < 3 ? `COR-${Math.floor(i / 6) + 1}` : "独立事件",
    time: `2026-10-17 09:${String(42 - i * 2).padStart(2, "0")}:00`,
    work: null,
  })),
  work: [],
  models: [
    {
      id: "TEMP-1.4",
      name: "温度趋势预测",
      state: "生产演示",
      prior: "TEMP-1.3",
      data: "SNAP-20261017-T",
      metric: "待真实测试集评估",
      approver: "",
    },
    {
      id: "HEALTH-0.9",
      name: "设备风险分层",
      state: "候选",
      prior: "HEALTH-0.8",
      data: "SNAP-20261017-H",
      metric: "待定义精度统计口径",
      approver: "",
    },
    {
      id: "ENERGY-1.2",
      name: "能耗基线预测",
      state: "影子",
      prior: "ENERGY-1.1",
      data: "SNAP-20261017-E",
      metric: "待定义误差与预测窗口",
      approver: "",
    },
  ],
  audits: [],
  topologyVersion: 1,
  links: [],
  config: {
    protocol: "Modbus TCP",
    interval: "60",
    gateway: "DEMO-GW-001",
    mode: "只读模拟",
  },
  messages: [],
});
let storageAvailable = true,
  state;
try {
  state = JSON.parse(localStorage.getItem("hongchuang-power-demo-v1"));
} catch (e) {
  storageAvailable = false;
}
if (
  !state ||
  state.schema !== 1 ||
  !Array.isArray(state.devices) ||
  state.devices.length !== 36 ||
  !Array.isArray(state.alarms) ||
  !Array.isArray(state.work) ||
  !Array.isArray(state.models) ||
  !Array.isArray(state.audits) ||
  !Array.isArray(state.links) ||
  !Array.isArray(state.messages) ||
  !state.config ||
  !Number.isInteger(state.tick) ||
  !state.devices.every(
    (d) => d && d.id && TYPES.includes(d.type) && SITES.includes(d.site),
  ) ||
  !state.alarms.every((a) => a && state.devices.some((d) => d.id === a.device))
)
  state = SEED();
let page = "overview",
  site = "all",
  query = "",
  filter = "全部",
  pageNo = 1,
  selectedDevice = state.devices[0].id,
  activeTab = "audit";
const modules = [
  ["overview", "运营总览", "总览与协同"],
  ["assets", "资产与拓扑", ""],
  ["monitor", "实时监控", ""],
  ["alarms", "告警中心", ""],
  ["health", "设备健康预测", "智能分析"],
  ["energy", "能耗分析", ""],
  ["assistant", "AI 运维助手", ""],
  ["work", "工单工作台", "业务与治理"],
  ["quality", "数据质量", ""],
  ["models", "模型中心", ""],
  ["access", "接入配置", ""],
  ["audit", "审计与需求指标", ""],
];
const subtitles = {
  overview: "让每一条异常可追溯，让每一次决策有依据。",
  assets: "统一资产档案与供电、制冷、通信关系，保持设备标识一致。",
  monitor: "查阅确定性模拟测点，质量异常与过期数据单独标记。",
  alarms: "从异常发现、人工确认到工单闭环，保留完整原始证据。",
  health: "趋势与区间仅作交互演示，不构成设备健康或剩余寿命保证。",
  energy: "对比用电基线与负载工况，区分电功率、累计电量与制冷能力。",
  assistant: "基于固定规则和演示知识条目的辅助建议，无模型服务或真实推理。",
  work: "人工排查、处置、复测与审核，每一步都有记录。",
  quality: "把可信数据放在预测之前，缺失值不以零值代替。",
  models: "演示版本评审、影子观察、灰度发布与回滚，不运行任何模型。",
  access: "只在浏览器保存演示配置，不连接设备，不采集凭据。",
  audit: "追踪本地演示操作，并逐项区分需求目标与实际交付范围。",
};
const dev = (id) => state.devices.find((d) => d.id === id),
  filteredDevices = () =>
    state.devices.filter((d) => site === "all" || d.site === site),
  filteredAlarms = () =>
    state.alarms.filter((a) => site === "all" || dev(a.device).site === site);
const time = () =>
  new Date(Date.UTC(2026, 9, 17, 1, 45) + state.tick * 300000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19) + " UTC";
function save() {
  try {
    localStorage.setItem("hongchuang-power-demo-v1", JSON.stringify(state));
  } catch (e) {
    storageAvailable = false;
  }
}
function log(action, target, detail = "") {
  state.audits.unshift({
    id: `AUD-${String(state.audits.length + 1).padStart(4, "0")}`,
    time: time(),
    actor: "林工（演示）",
    action,
    target,
    detail,
  });
  save();
}
function toast(msg) {
  $("#toast").textContent = msg;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 3000);
}
function badge(text) {
  return `<span class="badge ${["紧急", "缺失", "不可用"].includes(text) ? "bad" : ["重要", "迟到", "时钟漂移", "待复测", "待审批"].includes(text) ? "warn" : ["正常", "有效", "已关闭", "已确认", "生产演示"].includes(text) ? "good" : "info"}">${esc(text)}</span>`;
}
function button(text, action, cls = "small") {
  return `<button class="${cls}" onclick="${action}">${text}</button>`;
}
function modal(title, html) {
  $("#dialog-body").innerHTML = `<h2>${esc(title)}</h2>${html}`;
  $("#dialog").showModal();
}
function icon(i) {
  const p = [
    "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    "M12 3v6 M4 15v6 M20 15v6 M4 15h16 M12 9v6",
    "M2 13h4l3-8 5 15 3-7h5",
    "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4",
    "M3 12h5l3-8 4 16 3-8h3",
    "M13 2 4 14h7l-1 8 10-13h-7z",
    "M5 5h14v12H9l-4 4z M8 9h8 M8 13h5",
    "M5 4h14v17H5z M9 3h6v4H9z M8 11h8 M8 15h8",
    "M12 3 21 7v6c0 5-9 9-9 9s-9-4-9-9V7z M8 12l3 3 5-6",
    "M12 2 22 7v10l-10 5-10-5V7z M2 7l10 5 10-5 M12 12v10",
    "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
    "M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4",
  ];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${p[
    i
  ]
    .split(" M")
    .map((x, j) => `<path d="${j ? "M" : ""}${x}"/>`)
    .join("")}</svg>`;
}
function navigate(p) {
  page = p;
  query = "";
  filter = "全部";
  pageNo = 1;
  render();
  window.scrollTo(0, 0);
}
function render() {
  document.getElementById("nav").innerHTML = modules
    .map(
      (m, i) =>
        `${m[2] ? `<div class="nav-group">${m[2]}</div>` : ""}<button title="${m[1]}" class="${page === m[0] ? "active" : ""}" onclick="navigate('${m[0]}')">${icon(i)}<span>${m[1]}</span></button>`,
    )
    .join("");
  $("#title").textContent = $("#crumb").textContent = modules.find(
    (m) => m[0] === page,
  )[1];
  $("#subtitle").textContent = subtitles[page];
  $("#clock").textContent = "模拟时钟 " + time() + " / 北京时间 +08:00";
  $("#content").innerHTML = views[page]();
  if (!storageAvailable)
    $("#content").insertAdjacentHTML(
      "afterbegin",
      '<div class="split-note">当前浏览器禁止本地存储，已切换内存模式，关闭页面后更改将丢失。</div>',
    );
}
function kpi(title, value, unit, detail, color = "blue", glyph = "◈") {
  return `<div class="card"><div class="kpi-top">${title}<span class="kpi-icon">${glyph}</span></div><div class="kpi-value ${color}">${value}<small>${unit}</small></div><div class="kpi-bottom">${detail}</div></div>`;
}
function energyPower() {
  return filteredDevices().length * 4.3;
}
function energyTotal() {
  return filteredDevices().length * 142.6 + (energyPower() * state.tick) / 12;
}
function chart(kind = "temp", forecast = false, asset = dev(selectedDevice)) {
  const currentIndex = forecast ? 12 : 24,
    point = points(asset)[0];
  if (kind === "temp" && point.quality !== "有效")
    return `<div class="empty">当前温度数据${esc(point.quality)}，不绘制有效实时趋势。<br>请核查测点质量与源时间。</div>`;
  const current = kind === "energy" ? energyPower() : Number(point.value),
    max =
      kind === "energy"
        ? Math.ceil((current * 1.25) / 10) * 10
        : Math.ceil(Math.max(45, current + 8) / 5) * 5,
    min =
      kind === "energy"
        ? Math.max(0, Math.floor((current * 0.5) / 10) * 10)
        : 15;
  const vals = Array.from(
    { length: 25 },
    (_, i) =>
      current +
      (Math.sin(i / 3) - Math.sin(currentIndex / 3)) *
        (kind === "energy" ? current * 0.07 : 1.5) +
      (i - currentIndex) * (kind === "energy" ? current * 0.003 : 0.22),
  );
  const y = (v) => 180 - ((v - min) / (max - min)) * 148,
    xy = vals.map((v, i) => [42 + i * 22, y(v)]),
    line = xy.map((p) => p.join(",")).join(" ");
  const band = forecast
    ? [
        ...vals.slice(12).map((v, j) => `${306 + j * 22},${y(v + 2)}`),
        ...vals
          .slice(12)
          .map((v, j) => `${306 + j * 22},${y(v - 2)}`)
          .reverse(),
      ].join(" ")
    : "";
  return `<svg class="chart" viewBox="0 0 600 225" role="img" aria-label="${kind === "energy" ? "能耗" : "温度"}模拟趋势图"><defs><linearGradient id="area-${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#638df5" stop-opacity=".23"/><stop offset="1" stop-color="#638df5" stop-opacity="0"/></linearGradient></defs>${[0, 1, 2, 3, 4].map((i) => `<line x1="42" x2="572" y1="${32 + i * 37}" y2="${32 + i * 37}" stroke="#edf1f7"/><text x="3" y="${36 + i * 37}">${Math.round(max - ((max - min) * i) / 4)}${kind === "energy" ? "" : "°"}</text>`).join("")}<polygon points="42,180 ${line} 570,180" fill="url(#area-${kind})"/>${!forecast ? `<polyline points="${vals.map((v, i) => `${42 + i * 22},${y(kind === "energy" ? v / 1.068 : v - 5)}`).join(" ")}" fill="none" stroke="#79cbb9" stroke-width="2" stroke-dasharray="5 4"/>` : ""}${forecast ? `<polygon points="${band}" fill="#c3d5ff" opacity=".55"/><line x1="306" x2="306" y1="25" y2="180" stroke="#a4b9e4" stroke-dasharray="4 4"/><text x="320" y="21">未来 60 分钟 · 模拟区间 ±2°C</text>` : ""}<polyline points="${line}" fill="none" stroke="#4b7ae5" stroke-width="2.5"/>${[0, 1, 2, 3, 4].map((v, i) => `<text x="${35 + i * 130}" y="209">${new Date(Date.UTC(2026, 9, 17, 9, 45) + state.tick * 300000 + ((forecast ? -60 : -120) + i * 30) * 60000).toISOString().slice(11, 16)}</text>`).join("")}<text x="445" y="224">时间：北京时间 UTC+08:00</text></svg>`;
}
function head(title, right = "") {
  return `<div class="card-head"><h2>${title}</h2>${right}</div>`;
}
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${headers.length}" class="empty">没有符合条件的数据</td></tr>`}</tbody></table></div>`;
}
function toolbar(placeholder, options = ["全部"]) {
  return `<div class="toolbar"><input id="search" aria-label="搜索" placeholder="${placeholder}" value="${esc(query)}" oninput="query=this.value;pageNo=1;renderList()"><select aria-label="状态筛选" onchange="filter=this.value;pageNo=1;render()">${options.map((v) => `<option ${filter === v ? "selected" : ""}>${v}</option>`).join("")}</select><button class="right" onclick="exportCurrent()">↓ 导出 CSV</button></div>`;
}
function paginate(rows) {
  const pages = Math.max(1, Math.ceil(rows.length / 7));
  pageNo = Math.min(pageNo, pages);
  return {
    rows: rows.slice((pageNo - 1) * 7, pageNo * 7),
    footer: `<div class="pagination">共 ${rows.length} 条 · ${pageNo} / ${pages} 页 <button class="small" ${pageNo <= 1 ? "disabled" : ""} onclick="pageNo--;render()">上一页</button><button class="small" ${pageNo >= pages ? "disabled" : ""} onclick="pageNo++;render()">下一页</button></div>`,
  };
}
function renderList() {
  const el = $("#search"),
    start = el?.selectionStart;
  render();
  $("#search")?.focus();
  if (start !== undefined) $("#search")?.setSelectionRange(start, start);
}
function deviceSelect() {
  const ds = filteredDevices();
  if (!ds.some((d) => d.id === selectedDevice)) selectedDevice = ds[0].id;
  return `<select aria-label="设备选择" onchange="selectedDevice=this.value;render()">${ds.map((d) => `<option value="${d.id}" ${selectedDevice === d.id ? "selected" : ""}>${d.id} · ${d.name}</option>`).join("")}</select>`;
}
function alarmRows(alarms) {
  return alarms.map(
    (a) =>
      `<tr><td>${badge(a.severity)}</td><td><button class="link" onclick="alarmDetail('${a.id}')">${a.title}</button><span class="id">${a.id}</span></td><td>${dev(a.device).name}<span class="id">${a.device}</span></td><td>${badge(a.status)}</td><td>${a.time.slice(11)}</td><td>${button("查看证据", `alarmDetail('${a.id}')`)}</td></tr>`,
  );
}
const views = {
  overview() {
    const ds = filteredDevices(),
      aa = filteredAlarms().filter((a) => a.status !== "已关闭");
    return `<div class="kpis">${kpi("接入设备", ds.length, "台", '<span class="green">●</span> ' + ds.filter((d) => d.online).length + " 台在线 · " + ds.length * 8 + " 个模拟测点", "", "▦")}${kpi("待处置告警", aa.filter((a) => a.status === "待确认").length, "条", '<span class="red">●</span> ' + aa.filter((a) => a.severity === "紧急").length + " 条紧急 · 点击下方查看", "orange", "♧")}${kpi("设备健康指数", Math.round(ds.reduce((s, d) => s + d.health, 0) / ds.length), "/ 100", '<span class="blue">◇</span> 场景分数，不代表模型预测精度', "blue", "♡")}${kpi("演示日累计能耗", energyTotal().toLocaleString("zh-CN", { maximumFractionDigits: 1 }), "kWh", '<span class="green">◌</span> 合成场景 · 非真实电表读数', "", "ϟ")}</div><div class="grid two"><section class="card">${head("运行趋势", `<div class="legend"><span><i style="background:#4b7ae5"></i>UPS 温度</span><span><i style="background:#79cbb9"></i>环境温度</span><span>最近 2 小时 · °C</span></div>`)}${chart("temp", false, filteredDevices()[0])}<div class="metric-note">固定场景曲线 · 手动推进时钟可查看下一步模拟值</div></section><section class="card">${head("站点运行概况", '<span class="subtext">3 个演示站点</span>')}${SITES.map((s, i) => `<div class="site-row"><div class="site-icon">▥</div><div class="site-copy"><b>${s}</b><small>12 台设备 · 96 个测点</small></div>${badge(i === 1 ? "监测缺口" : "正常")}${button("进入", `selectSite('${s}')`)}</div>`).join("")}<div class="callout"><span class="spark">✧</span><div><b style="font-size:12px">以数据质量约束预测</b><p>${ds.filter((d) => d.quality !== "有效").length} 处质量问题已标记，异常数据不静默填补。</p><button class="link" onclick="navigate('quality')">查看数据质量 →</button></div></div></section></div><div class="grid two"><section class="card">${head("需要关注的告警", `<button class="link" onclick="navigate('alarms')">全部告警 →</button>`)}${table(["等级", "告警内容", "关联设备", "状态", "发生时间", "操作"], alarmRows(aa.slice(0, 4)))}</section><section class="card">${head("预测性维护关注", '<span class="badge warn">模拟风险</span>')}<div class="risk-card"><div class="risk-ring"><span>${ds[0].health}</span></div><div class="risk-copy"><b>${ds[0].name} · 趋势关注</b><p>${ds[0].id} / A 区动力机房</p>${badge("未来 60 分钟")}</div></div><div class="split-note">温度呈上行趋势，建议人工核查通风、风机与负载。不能据此判定电池故障。</div><button class="primary" onclick="selectedDevice='${ds[0].id}';navigate('health')">查看预测证据 →</button></section></div>`;
  },
  assets() {
    const rows = filteredDevices().filter(
      (d) =>
        `${d.id}${d.name}${d.model}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "全部" || d.type === filter),
    );
    const p = paginate(rows);
    return `<div class="card" style="margin-bottom:20px">${head("供电与环境关系", `<span class="subtext">拓扑 v${state.topologyVersion} · 示意关系</span>`)}<div class="topology"><button class="node" onclick="topologyNode('市电输入')">市电输入<small>400 V / 50 Hz · 演示</small></button><button class="node" onclick="topologyNode('配电母线')">配电母线<small>供电关系 → UPS</small></button><button class="node" onclick="topologyNode('柴油发电机')">柴油发电机<small>冗余关系 · 备用电源</small></button><div class="flowline">↓ 供电连接　　↔ 冗余关系　　⇢ 制冷影响</div>${filteredDevices()
      .slice(0, 3)
      .map(
        (d) =>
          `<button class="node" onclick="assetDetail('${d.id}')">${d.name}<small>${d.id}</small>${badge(d.quality === "有效" ? "正常" : d.quality)}</button>`,
      )
      .join(
        "",
      )}</div><p>${state.links.map((l) => `${esc(l.from)} → ${esc(l.to)}（${esc(l.type)}）`).join("<br>")}</p><div class="toolbar" style="margin-top:16px;margin-bottom:0"><button onclick="editTopology()">编辑演示关系</button><button onclick="modal('拓扑版本', '<p>初始版本 v1；当前 v'+state.topologyVersion+'</p><p>本地新增关系：'+esc(JSON.stringify(state.links))+'</p>')">版本记录</button></div></div><div class="card">${head("资产目录", '<span class="subtext">资产 ID 跨页面一致</span>')}${toolbar("搜索设备 ID、名称或型号", ["全部", ...TYPES])}${table(
      ["设备 / ID", "型号", "站点 / 机房", "状态", "测点", "操作"],
      p.rows.map(
        (d) =>
          `<tr><td><strong>${d.name}</strong><span class="id">${d.id}</span></td><td>${d.model}</td><td>${d.site}<span class="id">${d.room}</span></td><td>${badge(d.online ? d.riskLabel || "正常" : "监测离线")}</td><td>${d.points}</td><td>${button("设备档案", `assetDetail('${d.id}')`)}</td></tr>`,
      ),
    )}${p.footer}</div>`;
  },
  monitor() {
    return `<div class="card" style="margin-bottom:20px">${head("测点趋势", deviceSelect())}${chart()}<div class="split-note">所有值为合成场景。迟到、缺失、时钟漂移标记会阻止该设备输出预测；离线不等同物理设备故障。</div></div><div class="card">${head("测点快照", `<button onclick="exportCurrent()">↓ 导出 CSV</button>`)}${table(
      ["测点 ID", "指标", "当前值", "单位", "数据质量", "源时间"],
      points(dev(selectedDevice)).map(
        (p) =>
          `<tr><td>${p.id}</td><td>${p.name}</td><td><strong>${p.value}</strong></td><td>${p.unit}</td><td>${badge(p.quality)}</td><td>${p.source_ts}</td></tr>`,
      ),
    )}</div>`;
  },
  alarms() {
    const rows = filteredAlarms().filter(
      (a) =>
        `${a.id}${a.title}${a.device}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "全部" || a.severity === filter || a.status === filter),
    );
    const p = paginate(rows);
    return `<div class="kpis">${kpi("原始事件", filteredAlarms().length, "条", "原始记录始终保留")}${kpi("待确认", filteredAlarms().filter((a) => a.status === "待确认").length, "条", "人工确认，不等于故障恢复", "orange")}${kpi(
      "关联分组",
      new Set(
        filteredAlarms()
          .filter((a) => a.group !== "独立事件")
          .map((a) => a.group),
      ).size,
      "组",
      "按同站点关联展示",
    )}${kpi("关联工单", filteredAlarms().filter((a) => a.work).length, "条", "一条告警只建立一个演示工单")}</div><div class="card">${head("告警事件列表", `<button onclick="showGroups()">关联分组</button>`)}${toolbar("搜索告警、设备 ID 或关键词", ["全部", "紧急", "重要", "提示", "待确认", "已确认", "处理中", "已关闭"])}${table(["等级", "告警内容", "关联设备", "状态", "发生时间", "操作"], alarmRows(p.rows))}${p.footer}</div>`;
  },
  health() {
    const select = deviceSelect(),
      d = dev(selectedDevice),
      valid = d.quality === "有效";
    return `<div class="grid two"><section class="card">${head("设备健康趋势", select)}${valid ? chart("temp", true) : `<div class="empty">预测已阻断：${d.quality}<br>请先核查数据质量，当前无可用预测结果。</div>`}<div class="legend"><span><i style="background:#4b7ae5"></i>合成温度 / 预测路径</span><span><i style="background:#b3c9ff"></i>区间仅为演示，不是统计置信区间</span></div></section><section class="card">${head("风险证据包", badge(valid ? "模拟结果" : "不可用"))}<div class="risk-number ${valid ? "orange" : "red"}">${valid ? d.health : "—"}<small style="font-size:12px"> / 100</small></div><p>演示健康分数，不是预测精度</p><dl><dt>设备 ID</dt><dd>${d.id}</dd><dt>模型版本</dt><dd>TEMP-1.4（未运行）</dd><dt>预测窗口</dt><dd>模拟未来 60 分钟</dd><dt>输入质量</dt><dd>${badge(d.quality)}</dd></dl><button ${valid ? "" : "disabled"} onclick="predictionEvidence()">查看计算边界</button></section></div><div class="card">${head("建议与适用条件")}<div class="split-note">${valid ? "优先人工检查通风、风机状态、负载及环境温度。单一温度异常不足以认定电池或整机故障。" : "数据条件不足。停止输出风险建议，先处理质量问题。"}</div><p>依据：KB-DEMO-UPS-001 / v1.0 / §3.2 演示排查条目。不是厂商手册原文，实际操作必须依据现场规程。</p><div class="toolbar"><button onclick="openKnowledge('UPS')">查看知识依据</button><button onclick="navigate('assistant')">询问运维助手</button><button onclick="navigate('alarms')">关联告警</button></div></div>`;
  },
  energy() {
    return `<div class="kpis">${kpi("今日累计用电", energyTotal().toFixed(1), "kWh", "合成电表增量场景")}${kpi("当前设施功率", energyPower().toFixed(1), "kW", "电功率，不是制冷能力")}${kpi("演示 PUE", "1.42", "", "设施能耗 / IT 能耗，同口径场景")}${kpi("相对基线偏差", "+6.8", "%", "未做天气或业务负载归因", "orange")}</div><div class="grid two"><section class="card">${head("能耗趋势与可比基线", '<span class="subtext">模拟负载 · kW</span>')}${chart("energy")}<div class="legend"><span>蓝线：场景功率</span><span>绿虚线：合成基线</span></div></section><section class="card">${head("分系统累计电量", '<span class="subtext">合成数据 · kWh</span>')}<div class="energy-bars">${[0.52, 0.29, 0.12, 0.07].map((v, i) => `<div class="energy-bar" style="height:${v * 140}%"><b>${(energyTotal() * v).toFixed(1)}</b><span>${["IT 负载", "制冷", "UPS 损耗", "其他"][i]}</span></div>`).join("")}</div></section></div><div class="card">${head("计量处理与分析边界", `<button onclick="exportCurrent()">↓ 导出分析 CSV</button>`)}${table(
      ["处理项", "演示规则", "结果"],
      [
        "累计电表复位|检测负差分并分段计量|不产生伪能耗尖峰",
        "倍率变化|保留原始读数与倍率版本|当前倍率 1.0 / v1",
        "工况对比|先对齐业务负载和天气|示例不作节能效果归因",
        "参数误差 <5%|原始需求目标|未训练、未验证、未验收",
      ].map(
        (s) =>
          "<tr>" +
          s
            .split("|")
            .map((x) => `<td>${x}</td>`)
            .join("") +
          "</tr>",
      ),
    )}</div>`;
  },
  assistant() {
    return `<div class="grid two"><section class="card">${head("运维辅助工作台", '<span class="badge info">固定规则引擎</span>')}<div class="toolbar">${deviceSelect()}</div><div class="chat-message"><b>✧ 红创运维助手</b><br>我可以根据所选设备，演示 UPS 温升、空调能耗和数据缺失的排查建议，并提供演示条目引用。没有来源的问题会拒答；不会执行电源操作。</div>${state.messages.map((m) => `<div class="chat-message ${m.role === "user" ? "user" : ""}">${esc(m.text)}</div>`).join("")}<div class="toolbar">${["UPS 温度偏高怎么排查？", "空调能耗异常怎么分析？", "数据缺失还能预测吗？"].map((q) => `<button class="small" onclick="ask('${q}')">${q}</button>`).join("")}</div><div class="chat-input"><textarea id="question" aria-label="问题" placeholder="输入问题，例如：UPS 温度偏高怎么排查？"></textarea><button class="primary" onclick="ask($('#question').value)">发送</button></div><p>无网络请求 · 关键词匹配 · 不具备真实语义理解或生成式 AI 能力</p><div class="toolbar"><button class="small" onclick="assistantFeedback('有帮助')">建议有帮助</button><button class="small" onclick="assistantFeedback('需要专家复核')">需要专家复核</button></div></section><section class="card">${head("演示知识库", '<span class="subtext">3 个审查示例</span>')}${["UPS", "空调", "质量"].map((s, i) => `<div class="site-row"><div><b>${s}排查指引</b><small class="source" style="display:block">KB-DEMO-${["UPS", "AC", "DQ"][i]}-001 · v1.0</small></div>${button("查看", `openKnowledge('${s}')`)}</div>`).join("")}<div class="split-note">这些条目是产品演示脚本，不是原厂手册，不应据此开展现场维修。</div><button onclick="state.messages=[];log('清空演示对话','assistant');render();toast('已清空当前演示对话')">清空对话</button></section></div>`;
  },
  work() {
    const rows = state.work.filter(
      (w) =>
        (site === "all" || dev(w.device).site === site) &&
        `${w.id}${w.device}${w.title}`.includes(query) &&
        (filter === "全部" || w.status === filter),
    );
    const p = paginate(rows);
    return `<div class="card">${head("工单闭环", '<span class="subtext">高风险现场操作不在本原型执行</span>')}${toolbar("搜索工单、设备 ID 或标题", ["全部", ...WORK_STATES, "已取消"])}${table(
      ["工单 / 事件", "设备", "负责人", "状态", "更新版本", "操作"],
      p.rows.map(
        (w) =>
          `<tr><td><strong>${w.title}</strong><span class="id">${w.id} · ${w.alarm}</span></td><td>${w.device}</td><td>${esc(w.owner || "未分派")}</td><td>${badge(w.status)}</td><td>v${w.version}</td><td>${button("处理 / 查看", `workDetail('${w.id}')`)}</td></tr>`,
      ),
    )}${p.footer}${!state.work.length ? '<div class="split-note">从“告警中心”打开一条告警，先确认，再创建工单，即可体验分派、审批、处置、复测与关闭。</div>' : ""}</div>`;
  },
  quality() {
    const ds = filteredDevices().filter((d) => d.quality !== "有效");
    return `<div class="kpis">${kpi(
      "有效测点",
      filteredDevices()
        .flatMap(points)
        .filter((p) => p.quality === "有效").length,
      "个",
      "逐点统计当前快照，异常数据不冒充实测",
    )}${kpi("质量异常", ds.length, "项", "有效与异常测点分开展示", "orange")}${kpi("受限预测设备", ds.length, "台", "质量恢复前拒绝预测")}${kpi("填充值冒充实测", "0", "项", "缺失值明确显示为 —", "green")}</div><div class="card">${head("质量问题清单", `<button onclick="exportCurrent()">↓ 导出 CSV</button>`)}${table(
      ["测点", "问题", "影响", "处理规则", "操作"],
      ds.map(
        (d) =>
          `<tr><td>${d.id}${d.online ? "-P01" : "-P01 … P08（8点）"}<span class="id">${d.name}</span></td><td>${badge(d.quality)}</td><td>该设备预测不可用</td><td>${d.quality === "迟到" ? "按源时间归档" : d.quality === "缺失" ? "不填零，标记缺口" : "保留源时间与接收时间"}</td><td>${button("记录复核", `qualityReview('${d.id}')`)} ${button("查看设备", `assetDetail('${d.id}')`)}</td></tr>`,
      ),
    )}<div class="split-note">“记录复核”仅保存人工备注，不自动修复数据或移除质量标记。请勿把模拟复核结果当作真实采集恢复。</div></div>`;
  },
  models() {
    return `<div class="grid three">${state.models.map((m) => `<section class="card">${head(m.name, badge(m.state))}<h3>${m.id}</h3><p>数据快照：${m.data}</p><p>上一版本：${m.prior}</p><div class="split-note">${m.metric}<br>不显示虚构准确率</div><p>审批人：${esc(m.approver || "尚未审批")}</p><div class="stack">${button("查看模型卡", `modelCard('${m.id}')`)}${button("推进发布流程", `promoteModel('${m.id}')`, "primary")}${button("回滚演示", `rollbackModel('${m.id}')`)}</div></section>`).join("")}</div><div class="card">${head("模型发布约束")}<p>候选 → 影子 → 待审批 → 灰度 10% → 生产演示。进入灰度需要填写与申请人不同的演示审批人。</p><p>本地角色字段仅用于交互示范，不是可信身份认证或生产权限控制。模型权重、训练、推理、灰度流量和性能评测均未实现。</p></div>`;
  },
  access() {
    return `<div class="grid two"><section class="card">${head("只读接入配置", '<span class="badge info">模拟适配器</span>')}<form id="config-form" onsubmit="event.preventDefault();saveConfig()"><div class="form-grid"><div><label for="protocol">协议类型</label><select id="protocol">${["Modbus TCP", "SNMP", "OPC UA", "MQTT", "REST / 历史文件"].map((x) => `<option ${state.config.protocol === x ? "selected" : ""}>${x}</option>`).join("")}</select></div><div><label for="gateway">演示网关标识（非网络地址）</label><input id="gateway" required maxlength="40" value="${esc(state.config.gateway)}" pattern="[A-Za-z0-9_-]+"></div><div><label for="interval">模拟采样周期（秒）</label><input id="interval" required type="number" min="5" max="3600" value="${esc(state.config.interval)}"></div><div><label>操作模式</label><input value="只读模拟 · 无网络连接" disabled></div></div><div class="toolbar" style="margin-top:22px"><button class="primary" type="submit">保存本地配置</button><button type="button" onclick="testConnection()">模拟连通性检查</button></div></form><div class="split-note">不输入 IP、账号、口令或密钥。协议选项仅改变界面配置，不建立连接、不扫描网络。</div></section><section class="card">${head("数据契约与点表")}<p>schema_version / site_id / gateway_id / device_id / point_id / source_ts / ingest_ts / sequence / value / unit / quality_code / source_protocol / trace_id</p><button onclick="download('point-map.json',JSON.stringify(filteredDevices().flatMap(points),null,2),'application/json');log('导出点表','access')">↓ 下载演示点表 JSON</button><div class="callout"><span class="spark">▤</span><div><b>当前适配边界</b><p>协议语义参考公开标准；设备寄存器、MIB 和厂家点表仍须现场确认。</p></div></div></section></div>`;
  },
  audit() {
    return `<div class="tabs"><button class="${activeTab === "audit" ? "active" : ""}" onclick="activeTab='audit';render()">操作审计</button><button class="${activeTab === "requirements" ? "active" : ""}" onclick="activeTab='requirements';render()">需求指标映射</button><button class="${activeTab === "about" ? "active" : ""}" onclick="activeTab='about';render()">数据与本地存储</button></div>${activeTab === "audit" ? auditView() : activeTab === "requirements" ? requirementsView() : aboutView()}`;
  },
};
const WORK_STATES = [
  "待分派",
  "已分派",
  "已接单",
  "排查中",
  "待审批",
  "处理中",
  "待复测",
  "待审核",
  "已关闭",
];
function selectSite(s) {
  site = s;
  $("#site").value = s;
  render();
}
function points(d) {
  const bad = d.quality !== "有效";
  const specs = {
    UPS: [
      ["机内温度", d.temp + state.tick * 0.1, "°C"],
      ["输出线电压", 400, "V"],
      ["输出频率", 50, "Hz"],
      ["负载率", d.load, "%"],
      ["有功功率", +((40 * d.load) / 100).toFixed(2), "kW"],
      ["功率因数", 0.98, ""],
      ["旁路状态", "正常", ""],
      ["风机状态", "运行", ""],
    ],
    蓄电池组: [
      ["环境温度", 25, "°C"],
      ["标称电压", 384, "V"],
      ["浮充电压", 433.92, "V"],
      ["单体数量", 32, "只"],
      ["单体标称电压", 12, "V"],
      ["单体压差", 0.18, "V"],
      ["估算容量", 92, "%（演示）"],
      ["充电模式", "浮充", ""],
    ],
    精密空调: [
      ["回风温度", 27, "°C"],
      ["送风温度", 18, "°C"],
      ["制冷量", 30, "kW（制冷）"],
      ["输入电功率", 8.2, "kW（电）"],
      ["相对湿度", 45, "%RH"],
      ["风机转速", 1200, "rpm"],
      ["压缩机状态", "运行", ""],
      ["滤网压差", 70, "Pa"],
    ],
    配电柜: [
      ["柜内温度", d.temp, "°C"],
      ["线电压", 400, "V"],
      ["频率", 50, "Hz"],
      ["相电流", 82, "A"],
      ["功率因数", 0.96, ""],
      ["有功功率", 54.5, "kW"],
      ["累计电量", 14260, "kWh"],
      ["开关状态", "合闸（只读）", ""],
    ],
    温湿度传感器: [
      ["环境温度", d.temp, "°C"],
      ["相对湿度", 46, "%RH"],
      ["露点温度", 13.1, "°C"],
      ["电池电压", 3.2, "V"],
      ["信号强度", -61, "dBm"],
      ["采样周期", 60, "s"],
      ["传感状态", "读取中", ""],
      ["版本", "DEMO-1.0", ""],
    ],
    柴油发电机: [
      ["冷却液温度", 24, "°C"],
      ["额定主用功率", 160, "kW"],
      ["额定主用容量", 200, "kVA"],
      ["输出功率", 0, "kW"],
      ["转速", 0, "rpm"],
      ["实测输出频率", "—", "Hz（待机不适用）"],
      ["燃油液位", 78, "%"],
      ["运行状态", "待机", ""],
    ],
  };
  return specs[d.type].map((p, i) => ({
    id: `${d.id}-P${String(i + 1).padStart(2, "0")}`,
    device: d.id,
    name: p[0],
    value: !d.online || (i === 0 && d.quality === "缺失") ? "—" : p[1],
    unit: p[2],
    quality: !d.online ? "缺失" : i === 0 && bad ? d.quality : "有效",
    source_ts: !d.online
      ? "—（离线，无有效样本）"
      : i === 0 && bad
        ? d.quality === "缺失"
          ? "—（无有效样本）"
          : d.quality === "迟到"
            ? "2026-10-17 01:20:00 UTC（迟到）"
            : "2026-10-17 02:00:00 UTC（漂移）"
        : time(),
  }));
}
function assetDetail(id) {
  const d = dev(id);
  modal(
    d.name + " · 设备档案",
    `<dl><dt>稳定资产 ID</dt><dd>${id}</dd><dt>演示型号</dt><dd>${d.model}（虚构通用型号）</dd><dt>位置</dt><dd>${d.site} / ${d.room}</dd><dt>质量</dt><dd>${badge(d.quality)}</dd><dt>资产来源</dt><dd>公开参数启发的合成场景，非厂家实物接入</dd></dl><div class="toolbar"><button onclick="selectedDevice='${id}';$('#dialog').close();navigate('monitor')">查看实时测点</button><button onclick="selectedDevice='${id}';$('#dialog').close();navigate('health')">健康预测</button></div>`,
  );
}
function topologyNode(name) {
  modal(
    name,
    `<p>拓扑示意节点：${esc(name)}。供电与冗余仅表示依赖关系，不包含任何控制指令。</p>`,
  );
}
function editTopology() {
  const ds = filteredDevices();
  modal(
    "新增本地演示关系",
    `<form onsubmit="event.preventDefault();addEdge()"><div class="form-grid"><div><label>上游设备</label><select id="edge-from">${ds.map((d) => `<option>${d.id}</option>`).join("")}</select></div><div><label>下游设备</label><select id="edge-to">${ds.map((d) => `<option>${d.id}</option>`).join("")}</select></div><div><label>关系类型</label><select id="edge-type"><option>供电连接</option><option>制冷影响</option><option>通信依赖</option><option>冗余关系</option></select></div></div><p>演示校验：拒绝自环、重复关系与有向环；原始示意图不代表现场完整拓扑。</p><button class="primary" type="submit">校验并保存关系</button></form>`,
  );
}
function addEdge() {
  let from = $("#edge-from").value,
    to = $("#edge-to").value,
    type = $("#edge-type").value;
  if (from === to) return toast("不能建立设备自环");
  if (
    state.links.some((l) => l.from === from && l.to === to && l.type === type)
  )
    return toast("该关系已存在");
  const reaches = (n, target, seen = new Set()) => {
    if (n === target) return true;
    if (seen.has(n)) return false;
    seen.add(n);
    return state.links
      .filter((l) => l.from === n)
      .some((l) => reaches(l.to, target, seen));
  };
  if (reaches(to, from)) return toast("关系将形成有向环，已拒绝");
  state.links.push({ from, to, type });
  state.topologyVersion++;
  log("新增演示拓扑关系", from, `${type} → ${to}`);
  $("#dialog").close();
  render();
  toast("关系已保存至本地，版本已更新");
}
function alarmDetail(id) {
  const a = state.alarms.find((a) => a.id === id),
    d = dev(a.device);
  modal(
    "告警证据 · " + a.title,
    `<dl><dt>告警 ID</dt><dd>${a.id}</dd><dt>关联设备</dt><dd>${d.name} / ${a.device}</dd><dt>事件来源</dt><dd>${a.source} / ${a.source === "预测模拟" ? "TEMP-1.4" : "RULE-DEMO-1.0"}</dd><dt>事件时间</dt><dd>${a.time} Asia/Shanghai（固定场景）</dd><dt>关联组</dt><dd>${a.group}</dd><dt>状态</dt><dd>${badge(a.status)}</dd><dt>质量标记</dt><dd>${badge(d.quality)}</dd><dt>抑制状态</dt><dd>${a.suppressedUntil !== null && a.suppressedUntil > state.tick ? "已抑制至模拟步 " + a.suppressedUntil : "未抑制"}</dd><dt>关联工单</dt><dd>${a.work || "尚未创建"}</dd></dl><div class="split-note">示例证据：温度趋势与当前负载需结合现场验证。关联事件不等于根因已证实。所有阈值为演示规则。</div><label for="alarm-reason">操作依据 / 原因（必填）</label><textarea id="alarm-reason" placeholder="例如：已核对趋势，安排人工现场排查"></textarea><div class="toolbar" style="margin-top:15px">${a.status === "待确认" ? button("确认告警", `ackAlarm('${id}')`, "primary") : ""}${a.status === "已确认" && !a.work ? button("创建工单", `createWork('${id}')`, "primary") : ""}${a.work ? button("查看工单", `workDetail('${a.work}')`) : ""}${button("升级等级", `escalateAlarm('${id}')`)}${button("抑制 15 分钟", `suppressAlarm('${id}')`)}</div><button class="link" onclick="openKnowledge('UPS')">查看 KB-DEMO-UPS-001 演示知识引用 →</button>`,
  );
}
function reason(selector) {
  const r = $(selector)?.value.trim();
  if (!r) {
    toast("请填写操作依据或原因");
    return null;
  }
  return r;
}
function ackAlarm(id) {
  const r = reason("#alarm-reason");
  if (!r) return;
  const a = state.alarms.find((x) => x.id === id);
  if (a.status !== "待确认") return toast("该告警已确认");
  a.status = "已确认";
  log("确认告警", id, r);
  $("#dialog").close();
  render();
  toast("告警已确认，下一步可创建工单");
}
function createWork(id) {
  const a = state.alarms.find((x) => x.id === id);
  if (a.work) return toast("已有工单，未重复创建");
  if (a.status !== "已确认") return toast("请先确认告警");
  const r = reason("#alarm-reason");
  if (!r) return;
  const wid = `WO-20261017-${String(state.work.length + 1).padStart(3, "0")}`;
  state.work.push({
    id: wid,
    alarm: id,
    device: a.device,
    title: a.title,
    status: "待分派",
    owner: "",
    version: 1,
    history: [
      {
        time: time(),
        from: "新建",
        to: "待分派",
        reason: r,
        actor: "林工（演示）",
      },
    ],
  });
  a.work = wid;
  a.status = "处理中";
  log("创建工单", wid, `${id} / ${r}`);
  $("#dialog").close();
  render();
  toast("已创建 " + wid);
}
function escalateAlarm(id) {
  const r = reason("#alarm-reason");
  if (!r) return;
  let a = state.alarms.find((x) => x.id === id);
  if (a.severity === "紧急") return toast("已是最高等级");
  a.severity = a.severity === "提示" ? "重要" : "紧急";
  log("升级告警", id, r);
  $("#dialog").close();
  render();
  toast("已升级告警等级");
}
function suppressAlarm(id) {
  const r = reason("#alarm-reason");
  if (!r) return;
  const a = state.alarms.find((x) => x.id === id);
  a.suppressedUntil = state.tick + 3;
  log("限时抑制演示", id, r);
  $("#dialog").close();
  render();
  toast("仅标记抑制，原始告警保留；模拟推进 3 次自动到期");
}
function showGroups() {
  modal(
    "同站点关联事件",
    SITES.map(
      (s, i) =>
        `<h3>${s} · COR-${i + 1}</h3><p>${state.alarms
          .filter((a) => a.group === `COR-${i + 1}`)
          .map((a) => a.id)
          .join(" / ")}</p>`,
    ).join("") +
      "<p>按拓扑与时间窗口合成的演示分组。所有原始事件仍可查阅，不跨站点关联。</p>",
  );
}
function workDetail(id) {
  const w = state.work.find((x) => x.id === id);
  modal(
    "工单 " + id,
    `<p>${esc(w.title)} · ${w.device} · v${w.version}</p><div class="split-note">当前状态：${w.status}。每次推进必须填写依据；复测及关闭需要明确结果和另一名审核人。所有“现场操作”均为文字记录演示。</div><div class="form-grid"><div><label>演示操作人</label><input id="work-actor" value="林工" required></div><div><label>工单负责人</label><input id="work-owner" value="${esc(w.owner || "王工")}" required></div><div><label>复测结论</label><select id="work-test"><option value="">请选择（复测时必选）</option><option>通过</option><option>不通过</option></select></div><div><label>独立演示审核人</label><input id="work-reviewer" placeholder="关闭时需不同于操作人、负责人"></div></div><label style="margin-top:15px">排查 / 处置 / 复测依据</label><textarea id="work-reason" placeholder="请记录依据与结果，不输入敏感个人信息"></textarea><div class="toolbar" style="margin-top:15px">${w.status === "已关闭" || w.status === "已取消" ? button("重开工单", `transitionWork('${id}','reopen',${w.version})`, "primary") : button("推进至 " + WORK_STATES[WORK_STATES.indexOf(w.status) + 1], `transitionWork('${id}','next',${w.version})`, "primary")}${!["已关闭", "已取消"].includes(w.status) ? button("取消工单", `transitionWork('${id}','cancel',${w.version})`) : ""}${w.status === "待审核" || w.status === "待审批" ? button("驳回排查", `transitionWork('${id}','reject',${w.version})`) : ""}</div><h3>状态轨迹</h3><ul class="timeline">${w.history.map((h) => `<li>${esc(h.from)} → ${esc(h.to)}<small>${esc(h.actor)} · ${h.time}</small><p>${esc(h.reason)}</p></li>`).join("")}</ul>`,
  );
}
function transitionWork(id, action, version) {
  const w = state.work.find((x) => x.id === id);
  if (w.version !== version) return toast("版本已变化，请重新打开工单");
  const r = reason("#work-reason");
  if (!r) return;
  const actor = $("#work-actor").value.trim(),
    owner = $("#work-owner").value.trim(),
    reviewer = $("#work-reviewer").value.trim(),
    test = $("#work-test").value;
  if (!actor || !owner) return toast("请填写操作人与负责人");
  let next;
  if (action === "reopen") {
    if (!["已关闭", "已取消"].includes(w.status))
      return toast("当前状态不能重开");
    next = "待分派";
  } else if (action === "cancel") {
    if (["已关闭", "已取消"].includes(w.status))
      return toast("当前状态不能取消");
    next = "已取消";
  } else if (action === "reject") {
    if (!["待审核", "待审批"].includes(w.status))
      return toast("当前状态不能驳回");
    next = "排查中";
  } else {
    let index = WORK_STATES.indexOf(w.status);
    if (index < 0 || index >= WORK_STATES.length - 1)
      return toast("无合法下一状态");
    next = WORK_STATES[index + 1];
    if (w.status === "待复测") {
      if (!test) return toast("请明确复测结论");
      if (test === "不通过") next = "排查中";
    }
    if (
      ["待审核", "待审批"].includes(w.status) &&
      (!reviewer || reviewer === actor || reviewer === owner)
    )
      return toast("请填写不同于操作人及负责人的审核人");
  }
  const old = w.status;
  w.status = next;
  w.owner = owner;
  w.version++;
  w.history.push({
    time: time(),
    from: old,
    to: next,
    reason:
      r +
      (test ? "；复测：" + test : "") +
      (reviewer ? "；审核人：" + reviewer : ""),
    actor,
  });
  const a = state.alarms.find((a) => a.id === w.alarm);
  a.status =
    next === "已关闭" ? "已关闭" : next === "已取消" ? "已确认" : "处理中";
  log("工单状态变更", id, `${old} → ${next}；${r}`);
  $("#dialog").close();
  render();
  toast("工单已更新：" + next);
}
const KNOWLEDGE = {
  UPS: {
    id: "KB-DEMO-UPS-001",
    chapter: "§3.2",
    text: "检查数据有效性，再人工核查环境温度、通风条件、风机状态和负载变化。温升本身不能证明电池故障。涉及开柜、旁路或电源切换必须遵守现场规程，交由有资格人员。",
  },
  空调: {
    id: "KB-DEMO-AC-001",
    chapter: "§2.1",
    text: "先对齐业务负载、环境天气、采样区间及电表倍率。检查过滤网、送回风温差和风机状态。制冷量与输入电功率不同，不把负载下降直接归因为节能效果。",
  },
  质量: {
    id: "KB-DEMO-DQ-001",
    chapter: "§1.4",
    text: "检查源时间、接收时间、序列号与测点质量。缺失不填零，迟到数据保留原始时间。质量不足时拒绝预测，待人工复核与有效新数据到达后再评估。",
  },
};
Object.assign(KNOWLEDGE, {
  蓄电池组: {
    id: "KB-DEMO-BAT-001",
    chapter: "合成检查参考",
    text: "核对单体电压、内阻、温度、同组基线与维护记录。不得仅凭内阻推算寿命或自动放电；现场检查须遵守适用原厂规程。",
  },
  配电柜: {
    id: "KB-DEMO-PDU-001",
    chapter: "合成检查参考",
    text: "核验额定容量、相电流、计量倍率、峰值窗口及失效转供工况。正常负载有裕度不证明冗余合格；不自动合分闸。",
  },
  温湿度传感器: {
    id: "KB-DEMO-SENSOR-001",
    chapter: "合成检查参考",
    text: "先核对时间戳、校准记录、安装位置与独立温湿度测量。无有效交叉证据时不将单点异常推断为制冷故障。",
  },
  柴油发电机: {
    id: "KB-DEMO-DG-001",
    chapter: "合成检查参考",
    text: "核查启动电池、燃油、冷却、维护与负载测试记录。仅由合格现场人员按适用规程检验；不自动启动或切换供电。",
  },
});
function deviceKnowledge(d) {
  const key =
    d?.quality !== "有效"
      ? "质量"
      : {
          UPS: "UPS",
          精密空调: "空调",
          蓄电池组: "蓄电池组",
          配电柜: "配电柜",
          温湿度传感器: "温湿度传感器",
          柴油发电机: "柴油发电机",
        }[d?.type];
  return (
    KNOWLEDGE[key] || {
      id: "NO-MATCH",
      chapter: "未匹配",
      text: "没有匹配此设备族的知识来源。请补充适用型号资料，由专业人员核验；不得回退使用 UPS 规程。",
    }
  );
}
function openKnowledge(key) {
  const k = KNOWLEDGE[key];
  modal(
    k.id + " / v1.0",
    `<div class="split-note">演示知识脚本 · 非厂家手册原文 · 适用范围：虚构 HC 系列演示设备</div><h3>${k.chapter} ${key}排查参考</h3><p>${k.text}</p><p>来源说明：公开行业资料启发的原创演示摘要。公开参考链接及适用边界见 docs/data-sources.md。</p>`,
  );
}
function ask(q) {
  q = q.trim();
  if (!q) return toast("请输入问题");
  let key = /缺失|质量|迟到|漂移/.test(q)
    ? "质量"
    : /空调|能耗|制冷/.test(q)
      ? "空调"
      : /UPS|温升|温度/i.test(q)
        ? "UPS"
        : null;
  let answer;
  if (/分闸|合闸|切换电源|远控|关闭UPS/i.test(q))
    answer =
      "拒绝执行：此原型不具备电源控制能力。实际电气操作必须由授权人员按现场规程处理。";
  else if (!key)
    answer =
      "没有匹配的演示知识来源，无法给出可靠答案。请尝试 UPS 温升、空调能耗或数据质量问题。";
  else {
    const k = KNOWLEDGE[key];
    answer = `所选设备：${selectedDevice}\n${k.text}\n\n引用：${k.id} / v1.0 / ${k.chapter}（演示知识，非厂家原文）\n适用条件：仅供产品交互示例，需现场专家复核。无真实 AI 推理，未测语义匹配准确率。`;
  }
  state.messages.push(
    { role: "user", text: q },
    { role: "assistant", text: answer },
  );
  log("演示知识检索", selectedDevice, key || "无匹配来源");
  render();
}
function assistantFeedback(value) {
  if (!state.messages.length) return toast("请先提出一个问题");
  log("助手建议反馈", selectedDevice, value);
  toast("反馈已记入本地审计，不会触发训练");
}
function predictionEvidence() {
  modal(
    "预测计算与效果边界",
    "<p>趋势由固定正弦项、线性项和手动模拟步数合成；演示区间固定为 ±2°C，没有统计覆盖率含义。</p><p>无历史训练、无真实特征计算、无故障概率或剩余寿命推断。精度 >0.97、温度与能耗误差 <5% 均为原始需求目标，不能由该页面验证。</p>",
  );
}
function qualityReview(id) {
  modal(
    "记录数据质量复核",
    `<p>${id} / ${dev(id).quality}。保存不会解除质量标记。</p><textarea id="quality-note" aria-label="复核备注" placeholder="填写待核查事项"></textarea><button class="primary" onclick="const r=reason('#quality-note');if(r){log('数据质量复核','${id}',r);$('#dialog').close();toast('已保存复核备注，质量标记保持不变')}">保存复核记录</button>`,
  );
}
function modelCard(id) {
  const m = state.models.find((m) => m.id === id);
  modal(
    "模型卡 · " + id,
    `<dl><dt>任务</dt><dd>${m.name}</dd><dt>快照</dt><dd>${m.data}（合成场景标识）</dd><dt>指标</dt><dd>${m.metric}</dd><dt>状态</dt><dd>${m.state}</dd><dt>适配环境</dt><dd>国产 CPU / OS / 推理平台待用户清单与实际验证</dd><dt>版本边界</dt><dd>状态机原型，无训练集、模型工件或推理服务</dd></dl>`,
  );
}
function promoteModel(id) {
  const m = state.models.find((m) => m.id === id);
  if (m.state === "生产演示") return toast("已处于生产演示状态");
  if (m.state === "待审批") {
    modal(
      "演示双人发布审批",
      `<p>申请人：林工。仅用于交互流程，不是生产认证。</p><label>独立演示审批人</label><input id="model-approver" placeholder="例如：陈工"><p></p><button class="primary" onclick="approveModel('${id}')">批准进入灰度 10%</button>`,
    );
    return;
  }
  const next = {
    候选: "影子",
    已回滚: "影子",
    影子: "待审批",
    "灰度 10%": "生产演示",
  }[m.state];
  if (!next) return;
  const before = m.state;
  m.state = next;
  log("模型状态演示", id, `${before} → ${next}`);
  render();
  toast("已进入 " + next + "，未实际加载模型");
}
function approveModel(id) {
  const m = state.models.find((m) => m.id === id),
    name = $("#model-approver").value.trim();
  if (m.state !== "待审批") return toast("模型不在待审批状态");
  if (!name || name === "林工")
    return toast("审批人必须填写且不同于申请人林工");
  m.approver = name;
  m.state = "灰度 10%";
  log("模型灰度批准", id, "演示审批人：" + name);
  $("#dialog").close();
  render();
  toast("已批准灰度状态演示，未分流真实流量");
}
function rollbackModel(id) {
  const m = state.models.find((m) => m.id === id);
  if (!["生产演示", "灰度 10%"].includes(m.state))
    return toast("只有生产或灰度状态可回滚");
  m.state = "已回滚";
  m.approver = "";
  log("模型回滚演示", id, "回滚目标：" + m.prior);
  render();
  toast("已记录回滚至 " + m.prior + "（状态模拟）");
}
function saveConfig() {
  const interval = Number($("#interval").value),
    gateway = $("#gateway").value;
  if (
    !Number.isFinite(interval) ||
    interval < 5 ||
    interval > 3600 ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(gateway)
  )
    return toast("周期须为 5–3600 秒，标识仅可用字母数字下划线短横线");
  state.config = {
    protocol: $("#protocol").value,
    interval: String(interval),
    gateway,
    mode: "只读模拟",
  };
  log("保存模拟接入配置", gateway, state.config.protocol);
  toast("已保存浏览器配置，没有设备连接");
}
function testConnection() {
  log("模拟连通性检查", state.config.gateway, "固定模拟结果，无网络请求");
  modal(
    "模拟检查结果",
    '<p>✓ 配置格式有效<br>✓ 演示点表 288 点<br>✓ 固定场景数据可读</p><div class="split-note">以上为本地脚本返回的场景结果。没有访问 IP、端口、网关或设备，不能作为真实连通性证据。</div>',
  );
}
function auditView() {
  const p = paginate(
    state.audits.filter((a) =>
      `${a.action}${a.target}${a.detail}`.includes(query),
    ),
  );
  return `<div class="card">${head("本地操作审计", `<button onclick="exportAudit()">↓ 导出 JSON</button>`)}${toolbar("搜索操作、资源或说明")}${table(
    ["时间 / ID", "操作人", "操作", "资源", "说明"],
    p.rows.map(
      (a) =>
        `<tr><td>${a.time}<span class="id">${a.id}</span></td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td><td style="white-space:normal">${esc(a.detail)}</td></tr>`,
    ),
  )}${p.footer}<div class="metric-note">localStorage 可被使用者编辑或清除，不是不可篡改审计。没有服务端认证、权限隔离或审计存证。</div></div>`;
}
const REQUIREMENTS = [
  [
    "R01",
    "国产化环境部署",
    "待指定 CPU / OS / 数据库 / 推理平台清单",
    "本机 Node 服务与无 CDN 前端；未做国产平台兼容验收",
  ],
  [
    "R02",
    "总数据处理容量 >100万点",
    "须定义点、采样和活跃率",
    "本演示仅 288 个测点，未做容量测试",
  ],
  [
    "R03",
    "扩展处理容量 >1000万点",
    "须真实分片扩容与迁移测试",
    "前端原型无存储集群或扩展能力证明",
  ],
  [
    "R04",
    "2000条并发事件/秒存储",
    "须端到端持久化及丢失计数",
    "19 条合成初始事件，未压测",
  ],
  [
    "R05",
    "≥200个客户端同时访问",
    "200个以上按包含本数解释",
    "单浏览器本地状态，未测并发",
  ],
  [
    "R06",
    "单页面响应时间 ≤3秒",
    "需冻结网络、负载、冷启动口径",
    "无生产性能验收；静态加载不代表后端性能",
  ],
  [
    "R07",
    "MTBF >50000小时",
    "需长期运行数据与可靠性论证",
    "短期演示不能验证 MTBF",
  ],
  [
    "R08",
    "设备性能预测精度 >0.97",
    "需明确统计量、独立冻结测试集",
    "已接真实模型接口与冻结合成评测；尚未配置实测，不代表达标",
  ],
  [
    "R09",
    "温度预测误差 <5%",
    "暂定 MAE/20°C 运行范围，同时报告摄氏度 MAE",
    "可执行温度评测；真实模型成绩待用户配置后运行",
  ],
  [
    "R10",
    "能耗预测误差 <5%",
    "WAPE，零分母不可评估；固定工况与预测窗口",
    "可执行能耗评测，模型与独立基线分列；未实测",
  ],
  [
    "R11",
    "语义匹配准确率 ≥94%",
    "需人工标注独立语义测试集",
    "固定候选中的来源/设备族/型号/版本元组匹配评测；未实测",
  ],
  [
    "R12",
    "大模型预测性维护辅助",
    "可追溯预测、引用、人工处置闭环",
    "真实模型建议与 Wiki 来源链；仍需人工采纳和独立验收",
  ],
];
function requirementsView() {
  return `<div class="card requirements">${head("原始需求追踪矩阵", '<span class="badge warn">全部为目标，非实测成绩</span>')}<div class="split-note">依据需求 7011031111 及对应需求与方案设计。严格区分原文指标、设计建议和本次本地验证交付；未声称通过任何模型、容量或可靠性验收。</div>${table(
    ["编号", "原始要求 / 目标", "验收前提", "本原型边界"],
    REQUIREMENTS.map(
      (r) => "<tr>" + r.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>",
    ),
  )}</div>`;
}
function aboutView() {
  return `<div class="card">${head("数据与存储说明")}<p>36 台虚构设备，3 个站点，288 个模拟测点，19 条初始告警（含新增 S3）。场景初始时间为 2026-10-17 09:45:00 Asia/Shanghai（01:45:00 UTC）。</p><p>刷新按钮每次推进模拟时钟 5 分钟，不运行后台定时任务；图表由固定公式生成，无无控随机数。设备演示配置、操作记录和工单保存在当前浏览器 localStorage；API Key、Wiki 和自测报告保存在本机后端运行目录。</p><p>提供本地后台 API 和主动触发的真实模型调用，无真实设备连接或电源远程控制。仅在专用设置页填写模型 Key，不要在工单或资料中填写凭据或生产敏感信息。浏览器禁止存储时使用内存模式。</p><div class="toolbar"><button onclick="download('hongchuang-demo-state.json',JSON.stringify(state,null,2),'application/json');log('导出演示状态','localStorage')">↓ 导出本地 JSON</button><button class="danger" onclick="requestReset()">重置全部演示数据</button></div><div class="split-note">公开来源和数据边界见压缩包 docs/data-sources.md；启动方式、功能清单和测试范围见 README.md。</div></div>`;
}
function download(name, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob(
      [type.startsWith("text/csv") ? "\uFEFF" : "", content],
      { type },
    ),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("已生成下载：" + name);
}
function csv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let s = String(cell ?? "");
          if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
          return '"' + s.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
function exportCurrent() {
  let rows;
  if (page === "assets")
    rows = [
      ["设备 ID", "名称", "站点", "型号", "质量"],
      ...filteredDevices()
        .filter(
          (d) =>
            `${d.id}${d.name}${d.model}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (filter === "全部" || d.type === filter),
        )
        .map((d) => [d.id, d.name, d.site, d.model, d.quality]),
    ];
  else if (page === "alarms")
    rows = [
      ["事件 ID", "设备 ID", "内容", "等级", "状态"],
      ...filteredAlarms()
        .filter(
          (a) =>
            `${a.id}${a.title}${a.device}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (filter === "全部" || a.severity === filter || a.status === filter),
        )
        .map((a) => [a.id, a.device, a.title, a.severity, a.status]),
    ];
  else if (page === "monitor")
    rows = [
      ["测点 ID", "指标", "值", "单位", "质量"],
      ...points(dev(selectedDevice)).map((p) => [
        p.id,
        p.name,
        p.value,
        p.unit,
        p.quality,
      ]),
    ];
  else if (page === "work")
    rows = [
      ["工单 ID", "设备 ID", "事件 ID", "状态", "负责人"],
      ...state.work
        .filter(
          (w) =>
            (site === "all" || dev(w.device).site === site) &&
            `${w.id}${w.device}${w.title}`.includes(query) &&
            (filter === "全部" || w.status === filter),
        )
        .map((w) => [w.id, w.device, w.alarm, w.status, w.owner]),
    ];
  else if (page === "quality")
    rows = [
      ["设备 ID", "质量", "预测"],
      ...filteredDevices()
        .filter((d) => d.quality !== "有效")
        .map((d) => [d.id, d.quality, "阻断"]),
    ];
  else if (page === "energy")
    rows = [
      ["类型", "数值", "单位", "数据性质"],
      ["日累计用电", energyTotal(), "kWh", "模拟"],
      ["设施功率", energyPower(), "kW", "模拟"],
      ["PUE", 1.42, "比值", "模拟"],
    ];
  else
    rows = [
      ["时间", "操作人", "操作", "对象", "说明"],
      ...state.audits
        .filter((a) => `${a.action}${a.target}${a.detail}`.includes(query))
        .map((a) => [a.time, a.actor, a.action, a.target, a.detail]),
    ];
  download(`hongchuang-${page}.csv`, csv(rows));
  log("导出 CSV", page, "当前站点与筛选结果");
}
function exportAudit() {
  download(
    "hongchuang-audit.json",
    JSON.stringify(state.audits, null, 2),
    "application/json",
  );
  log("导出审计", "audit");
}
function requestReset() {
  modal(
    "重置全部本地演示数据",
    '<p>将清除当前浏览器的演示工单、对话、配置、审计与模型状态，恢复初始场景。此操作不影响任何真实设备。建议先导出 JSON。</p><button class="danger" onclick="resetDemo()">确认重置演示数据</button>',
  );
}
function resetDemo() {
  state = SEED();
  selectedDevice = state.devices[0].id;
  save();
  $("#dialog").close();
  render();
  toast("已恢复初始演示数据");
}
$("#site").addEventListener("change", (e) => {
  site = e.target.value;
  pageNo = 1;
  render();
});
$("#refresh").addEventListener("click", () => {
  state.tick++;
  state.alarms.forEach((a) => {
    if (a.suppressedUntil !== null && a.suppressedUntil <= state.tick) {
      a.suppressedUntil = null;
      log("演示抑制到期", a.id);
    }
  });
  save();
  render();
  toast("已推进模拟时钟 5 分钟，未获取真实数据");
});
window.DEMO = {
  getState: () => state,
  navigate,
  render,
  reset: resetDemo,
  points,
  exportCSV: csv,
  requirements: REQUIREMENTS,
};
render();
