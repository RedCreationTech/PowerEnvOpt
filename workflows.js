"use strict";
/* Connected, deterministic operations demonstration. No inference or equipment control. */
const CASES = {
  battery: {
    title: "S2 · UPS 电池劣化提前干预",
    subtitle: "从阻抗偏离到维护窗口，而非等待 UPS 失效",
    tag: "供电连续性",
    device: "HC-BJ-002",
    related: ["HC-BJ-001", "HC-BJ-004"],
    alarm: "AL-20261017-002",
    event: "EV-BAT-101",
    evidence: "EVS-BAT-101",
    kb: "KB-BAT-01",
    metric: "单体内阻偏离",
    unit: "%",
    series: [7, 9, 13, 18, 24, 31],
    after: [26, 18, 11, 7, 5, 4],
    threshold: 25,
    window: "过去 6 周 / 每周同工况采样",
    forecast:
      "若同一趋势继续，下一维护周期偏离可能进一步扩大。应优先安排现场检查；不预测精确剩余寿命。",
    hypotheses: [
      ["电池单体劣化", "优先核查", "内阻偏离持续增大、相邻单体稳定"],
      ["接线或测量接触异常", "尚未排除", "缺少端子检查和独立仪表复核"],
      ["温度或充电工况变化", "待核对", "温度升高，但工况校正记录不完整"],
    ],
    checks: [
      "核对电池序列号、安装日期与同组历史基线",
      "授权人员按现场规程复核连接和独立测量",
      "在批准窗口执行原厂自检并记录报告",
    ],
    plans: ["安排有资质人员专项检查", "暂缓新增负载并加密人工巡检"],
    risk: "不得仅凭阻抗决定更换，不允许自动放电、旁路切换或带电开柜。",
    before: "偏离 31% · 温度 32°C · 同组中位数偏离 4%",
    outcome: "独立复核后维护问题单体；同工况偏离降至 4%。这里只回放合成证据。",
    horizon: "下一维护周期",
    impact: "UPS A 路备用能力",
    facts: [
      ["电池年龄", "4.2 年（合成）"],
      ["温度趋势", "26 → 32 °C"],
      ["同组对照", "4% 偏离"],
      ["UPS 负载", "64% → 65%"],
    ],
  },
  cooling: {
    title: "S1 · 精密空调高温预测排查",
    subtitle: "关联温度、压差与负载，避免把相关性当根因",
    tag: "热风险管理",
    device: "HC-SH-003",
    related: ["HC-SH-005", "HC-SH-004"],
    alarm: "AL-20261017-009",
    event: "EV-AC-201",
    evidence: "EVS-AC-201",
    kb: "KB-AC-01",
    metric: "机柜进风温度",
    unit: "°C",
    series: [23.2, 24.1, 25.2, 26.6, 28.2, 29.4],
    after: [28.4, 27.1, 25.8, 24.8, 24.1, 23.8],
    threshold: 28,
    window: "过去 60 分钟 / 10 分钟聚合",
    forecast:
      "演示线性外推 +30 分钟约 33°C（非模型预测区间）。若气流受阻持续，热点风险增加，先核验传感器及气流。",
    hypotheses: [
      ["滤网阻塞导致气流下降", "优先核查", "压差 70→145 Pa，温度同向上升"],
      ["IT 负载突增", "证据较弱", "同窗口负载 61%→62%，不能完全排除局部热点"],
      ["传感器漂移 / 冷气短路", "尚未排除", "缺少现场多点温度和气流测量"],
    ],
    checks: [
      "对齐进风温度、压差与负载的时间窗口",
      "现场核验滤网、风机与送回风路径",
      "按批准规程维护并记录现场前后照片编号",
    ],
    plans: ["批准气流与滤网专项巡检", "保持设备运行并补充多点温度测量"],
    risk: "不自动停机或调整制冷设定值。滤网维护应遵守原厂规程，保持冗余制冷能力。",
    before: "进风 29.4°C · 滤网压差 145 Pa · IT 负载 62%",
    outcome: "维护气流路径后，在相近 IT 负载下进风降至 23.8°C，压差 74 Pa。",
    horizon: "未来 30 分钟",
    impact: "B 区机柜热裕度",
    facts: [
      ["滤网压差", "70 → 145 Pa"],
      ["IT 负载", "61% → 62%"],
      ["风机状态", "运行 / 需现场核验"],
      ["最近维护", "90 天前（合成）"],
    ],
  },
  capacity: {
    title: "扩展 · 配电容量风险审查",
    subtitle: "把计划新增负载纳入容量与冗余判断",
    tag: "容量与变更",
    device: "HC-SZ-004",
    related: ["HC-SZ-001", "HC-SZ-010"],
    alarm: "AL-20261017-016",
    event: "EV-PDU-301",
    evidence: "EVS-PDU-301",
    kb: "KB-CAP-01",
    metric: "支路峰值负载率",
    unit: "%",
    series: [61, 65, 69, 74, 79, 84],
    after: [77, 71, 66, 63, 62, 62],
    threshold: 85,
    window: "过去 6 天 / 每日同窗口峰值",
    forecast:
      "现有峰值 84% + 计划增加 12 个百分点 = 96%，超过本演示规划警戒线 85%。需核实额定容量与 A/B 路失效工况。",
    hypotheses: [
      [
        "新增负载使支路裕度不足",
        "场景计算成立",
        "84% + 12pp = 96%；85% 为自定演示线",
      ],
      ["A/B 路冗余容量不足", "资料不足", "缺少完整失效切换及上级 UPS 容量验证"],
      [
        "峰值窗口与电表倍率偏差",
        "待核对",
        "需核验峰值口径、功率因数与计量倍率",
      ],
    ],
    checks: [
      "核实支路额定容量、峰值口径和计量倍率",
      "审核 A/B 路及上级 UPS 的故障工况容量",
      "批准变更窗口和回退计划后记录模拟负载迁移",
    ],
    plans: ["延期扩容并完成容量复核", "经审核分散新增负载至备用支路"],
    risk: "本演示不证明 N+1 或双路冗余合格。禁止自动合分闸、迁移负载或承诺扩容安全。",
    before: "原支路 84% · 计划新增 +12pp · 模拟投产 96%",
    outcome:
      "复核并调整计划后，原支路峰值 62%，目标支路 68%；保留人工冗余复核要求。",
    horizon: "计划投产窗口",
    impact: "新增机柜供电容量",
    facts: [
      ["计划新增", "12 个百分点"],
      ["预计原支路", "96%"],
      ["演示规划线", "85% / 非行业标准"],
      ["冗余校核", "等待人工报告"],
    ],
  },
};
CASES.energy = {
  title: "S3 · 空调同负载能耗异常与优化验证",
  subtitle: "同负载、同气象窗口比较输入功率，优化效果须独立复测",
  tag: "能耗优化",
  device: "HC-SH-009",
  related: ["HC-SH-003", "HC-SH-005"],
  alarm: "AL-ENERGY-301",
  event: "EV-ENERGY-301",
  evidence: "EVS-ENERGY-301",
  kb: "KB-ENERGY-01",
  metric: "同负载空调输入功率",
  unit: "kW",
  series: [12, 12.8, 13.9, 15.1, 16.5, 18],
  after: [17, 16.2, 15.4, 14.3, 13.4, 12.6],
  threshold: 15,
  window: "6 个同负载窗口 / IT 负载 62±1% / 室外 28±0.5°C",
  forecast:
    "同负载输入功率从 12 升至 18 kW，偏离合成基线 50%。先核验计量、气象与负载口径，不能将相关性当作节能收益。",
  hypotheses: [
    ["换热或气流效率下降", "优先核查", "同负载输入功率升高，压差趋势需联查"],
    ["环境或业务工况不可比", "尚未排除", "需核验室外温湿度、运行台数与时段"],
    ["电表倍率或采样偏差", "待核对", "需核查电表倍率与同步采样"],
  ],
  checks: [
    "核验同负载、室外温度、运行台数和时间窗口",
    "现场核对换热、过滤网与计量倍率",
    "按已审批方案人工优化，记录设定值及回退条件",
  ],
  plans: ["先维护气流和换热路径再做同工况复测", "仅补测校准，不实施设定值优化"],
  risk: "不自动调温、停机或切换运行模式。不能把负载下降计作节能效果；必须保持温度 SLA 与冗余。",
  before: "IT 负载 62% · 室外 28°C · 输入 18 kW",
  outcome:
    "合成同负载复测输入功率 12.6 kW，较异常窗口低 30%；不代表真实节能量或年度收益。",
  horizon: "下一同负载验证窗口",
  impact: "制冷能耗与机柜热安全",
  facts: [
    ["IT 负载", "62±1%"],
    ["室外温度", "28±0.5°C"],
    ["基线输入功率", "12 kW（合成）"],
    ["异常输入功率", "18 kW（合成）"],
  ],
};
const WF_KNOWLEDGE = {
  "KB-BAT-01": {
    title: "电池状态：监测偏离与核验建议",
    version: "原创摘要 v2.0 / 查阅 2026-10-16",
    scope:
      "BMS 监测变量；Smart-UPS FAQ 仅适用于对应单相设备。虚构 HC 型号不在厂家适用清单内。",
    passage:
      "电池块电压、阻抗和温度可作为持续监测输入。同串偏离和维护日志可帮助排查。电池年龄、安装日期或更换记录不准确会影响建议，应结合适用设备测试核验。",
    boundary:
      "不能把阻抗趋势直接换算为剩余寿命，不能把单相 Smart-UPS 自检流程推广到所有 UPS。",
    sources: [
      [
        "Schneider BMS · Solution Overview",
        "https://productinfo.se.com/ecostruxurebms_guides/dd00594044-ecostruxure-battery-management-system-user-guide/English/EcoStruxureBMS_User_Guide_DD00594044.XML.xml/%24/EcoStruxureBMS_Solution_Overview_DD00594029.XML",
        "Solution Overview / 在线文档",
      ],
      [
        "Schneider · FAQ000242964",
        "https://www.se.com/us/en/faqs/FAQ000242964/",
        "Smart-UPS 电池建议 / FAQ000242964",
      ],
    ],
  },
  "KB-AC-01": {
    title: "制冷热点：告警与气流的联合核验",
    version: "原创摘要 v2.0 / 查阅 2026-10-16",
    scope:
      "Liebert CRV CRD10 手册告警定义作为流程参考；不冒充 HC-PAC30 的实际协议点表。",
    passage:
      "高送回风温度、滤网堵塞、滤网维护和气流丢失分别对应不同告警，应联合负载、风机状态及现场检查区分原因。持续监测及实时负载洞察可以支持维护行动计划。",
    boundary:
      "滤网告警和温升同现不证明唯一根因；不自动改变设定温度、复位或停机。",
    sources: [
      [
        "Vertiv Liebert CRV CRD10 用户手册",
        "https://www.vertiv.com/4992f9/globalassets/products/thermal-management/in-row-cooling/liebert-crv-in-row-cooling-system-10-40kw/liebert-crv-crd10_user-manual_sl-70637_rev7_01-23_web.pdf",
        "SL-70637 Rev7 01-23 / Appendix C / 印刷页 83",
      ],
      [
        "Vertiv · Thermal Remote Monitoring",
        "https://www.vertiv.com/en-asia/services-catalog/maintenance-services/remote-services/thermal-remote-monitoring/",
        "服务范围 / 无具体维护阈值",
      ],
    ],
  },
  "KB-CAP-01": {
    title: "支路扩容：正常运行与冗余工况分开审核",
    version: "原创摘要 v2.0 / 查阅 2026-10-16",
    scope:
      "IEC 容量管理应用指南；设计必须由现场专业人员按实际额定值与冗余策略验证。",
    passage:
      "将支路平均及最大负载与额定容量比较，并检验 UPS 或发电机在停电和设计冗余工况下的容量。计量单位、同步时间窗口和计划新增负载的同时性都会影响结论。",
    boundary:
      "本场景 85% 仅为合成规划线，不是 IEC 或厂家统一阈值；正常运行有裕度不等于故障转供有裕度。",
    sources: [
      [
        "Schneider · Capacity Management (IEC)",
        "https://productinfo.se.com/esxp_digital_apps_iec/cm/English/BM_ESXP_DG_Capacity_Management_IEC.pdf",
        "ESXP2GE012EN-05 / 11-2023 / pp.10–13",
      ],
    ],
  },
};
WF_KNOWLEDGE["KB-ENERGY-01"] = {
  title: "同负载能耗比较与验证边界",
  version: "原创合成摘要 v1",
  scope: "虚构 HC-PAC30 教学场景，非厂家规程或实际节能保证。",
  passage:
    "比较输入电功率前需对齐负载、天气、测量窗口、电表倍率与运行台数。优化前后必须同时满足温度和冗余约束。",
  boundary: "负载降低不等于效率提高；不能从单一短窗口外推年度节能。",
  sources: [],
};
function wfTrend(c, values = c.series, post = false) {
  const all = [...c.series, ...c.after, c.threshold],
    lo = Math.min(...all) * 0.85,
    hi = Math.max(...all) * 1.1,
    y = (v) => 160 - ((v - lo) / (hi - lo)) * 125;
  return `<svg class="journey-chart" viewBox="0 0 540 200" role="img" aria-label="${c.metric}${post ? "复测" : "原始"}趋势">${[0, 1, 2, 3].map((i) => `<line x1="40" x2="510" y1="${35 + i * 42}" y2="${35 + i * 42}" stroke="#e7edf5"/>`).join("")}<line x1="40" x2="510" y1="${y(c.threshold)}" y2="${y(c.threshold)}" stroke="#dc9860" stroke-dasharray="5 5"/><text x="45" y="${y(c.threshold) - 7}">演示警戒线 ${c.threshold}${c.unit}</text><polyline points="${values.map((v, i) => `${55 + i * 88},${y(v)}`).join(" ")}" fill="none" stroke="${post ? "#159883" : "#4c73db"}" stroke-width="3"/>${values.map((v, i) => `<circle cx="${55 + i * 88}" cy="${y(v)}" r="4" fill="${post ? "#159883" : "#4c73db"}"/><text x="${45 + i * 88}" y="${y(v) - 10}">${v}</text><text x="${45 + i * 88}" y="190">T${i + 1}</text>`).join("")}</svg><p>${c.window} · ${c.metric} / ${c.unit} · 固定合成样本</p>`;
}
function wfHistory(r) {
  return `<ul class="timeline">${r.history.map((h) => `<li><b>${esc(h.action)}</b><small>${h.time}</small><p>${esc(h.detail)}</p><span class="subtext">${h.id}</span></li>`).join("") || "<li>尚未操作。请从证据核验开始。</li>"}</ul>`;
}

// Role simulation: handlers enforce the selected demo identity, not production security.
const PEOPLE = {
  operator: {
    name: "刘值班",
    role: "值班监控",
    kind: "operator",
    pages: [
      "overview",
      "assets",
      "monitor",
      "alarms",
      "health",
      "work",
      "quality",
      "audit",
    ],
    focus: "接管告警、核验监测证据并向诊断人员交接。",
  },
  engineer: {
    name: "王工",
    role: "维护工程师",
    kind: "engineer",
    pages: [
      "overview",
      "work",
      "assets",
      "monitor",
      "alarms",
      "health",
      "assistant",
      "knowledge",
      "quality",
      "audit",
    ],
    focus: "接收分派给我的工单，记录现场检查与复测证据。",
  },
  engineer2: {
    name: "赵工",
    role: "维护工程师",
    kind: "engineer",
    pages: [
      "overview",
      "work",
      "assets",
      "monitor",
      "alarms",
      "health",
      "assistant",
      "knowledge",
      "quality",
      "audit",
    ],
    focus: "接收分派给我的工单，记录现场检查与复测证据。",
  },
  supervisor: {
    name: "陈主管",
    role: "运维主管",
    kind: "supervisor",
    pages: [
      "overview",
      "work",
      "alarms",
      "assets",
      "monitor",
      "health",
      "energy",
      "assistant",
      "knowledge",
      "quality",
      "audit",
    ],
    focus: "审核处置依据、选择执行人，独立验收或退回返工。",
  },
  analyst: {
    name: "周分析",
    role: "可靠性分析",
    kind: "analyst",
    pages: [
      "overview",
      "health",
      "assistant",
      "knowledge",
      "energy",
      "monitor",
      "assets",
      "alarms",
      "work",
      "quality",
      "models",
      "audit",
    ],
    focus: "研判待诊断事件，核对知识依据并回顾闭环案例。",
  },
  admin: {
    name: "林管理员",
    role: "系统管理员",
    kind: "admin",
    pages: [
      "overview",
      "work",
      "access",
      "quality",
      "models",
      "assets",
      "monitor",
      "audit",
    ],
    focus: "维护模拟接入与资产关系、检查数据质量和发布记录。",
  },
};
const stageLabel = {
  dispatch: "待派单",
  cancelled: "已取消",
  discovered: "待接管",
  acknowledged: "待分析",
  requested: "待分析",
  analyzed: "待方案审批",
  deferred: "待方案审批 · 暂缓",
  rejected: "待分析 · 退回",
  assigned: "待接单",
  executing: "处理中",
  retest: "待复测",
  review: "待验收",
  closed: "已关闭",
};
function freshJourney(id) {
  return {
    id,
    stage: "discovered",
    quality: "有效",
    diagnoses: [],
    decisions: [],
    workId: null,
    checks: [],
    tests: [],
    caseId: null,
    history: [],
  };
}
let journeysValidated = false;
function ensureJourneys() {
  if (journeysValidated && state.journeys) return state.journeys;
  const old = state.journeys,
    records = {};
  if (!state.alarms.some((a) => a.id === "AL-ENERGY-301"))
    state.alarms.push({
      id: "AL-ENERGY-301",
      device: "HC-SH-009",
      title: "同负载空调输入功率偏离基线",
      severity: "重要",
      source: "预测模拟",
      status: "待确认",
      group: "ENERGY-S3",
      time: time(),
      work: null,
    });
  if (!PEOPLE[state.demoPerson]) state.demoPerson = "operator";
  state.work = Array.isArray(state.work) ? state.work : [];
  // Work orders are authoritative; journey records are a compatibility/read-model alias.
  for (const id of Object.keys(CASES)) {
    const c = CASES[id],
      existing = state.work.find(
        (w) => w.journey === id || w.id === old?.records?.[id]?.workId,
      );
    let r = existing?.flow || old?.records?.[id] || freshJourney(id);
    if (!r || typeof r !== "object") r = freshJourney(id);
    r.id = id;
    for (const k of ["diagnoses", "decisions", "checks", "tests", "history"])
      if (!Array.isArray(r[k])) r[k] = [];
    if (!stageLabel[r.stage]) r.stage = "discovered";
    if (!["有效", "缺失", "迟到"].includes(r.quality)) r.quality = "有效";
    records[id] = r;
    if (existing) {
      existing.journey = id;
      existing.eventId = c.event;
      existing.flow = r;
      bindWork(existing, r);
    } else if (r.stage !== "discovered") {
      const w = makeWork(
        {
          id: r.workId || `WO-FLOW-${id.toUpperCase()}`,
          device: c.device,
          title: c.title,
          alarm: c.alarm,
          eventId: c.event,
          journey: id,
          source: "预测预警",
          type: "预测性维护",
          description: c.subtitle,
        },
        r,
      );
      w.history.push({
        time: time(),
        from: "旧版事件",
        to: w.status,
        actor: "版本迁移",
        reason: "迁移补建：保留旧版证据与阶段；此条不是历史人工操作",
      });
      migrationAudit(w);
      r.history.push({
        id: `MIGRATE-${w.id}`,
        workId: w.id,
        time: time(),
        actor: "migration",
        action: "迁移补建",
        detail: "旧版已接管事件补建唯一工单，保留全部诊断、审批与复测证据",
      });
    }
  }
  state.journeys = {
    version: 4,
    active: CASES[old?.active] ? old.active : "cooling",
    records,
  };
  for (const w of state.work) {
    if (!w.journey) bindWork(w);
    const a = state.alarms.find((a) => a.id === w.alarm);
    if (a) {
      a.work = w.id;
      if (!["已关闭", "已取消"].includes(w.status)) a.status = "处理中";
    }
  }
  // Already acknowledged ordinary alarms also receive one work order, without a fake takeover.
  for (const a of state.alarms.filter(
    (a) =>
      !caseForAlarm(a.id) &&
      a.status === "已确认" &&
      !state.work.some((w) => w.alarm === a.id),
  )) {
    const w = makeWork({
      device: a.device,
      title: a.title,
      alarm: a.id,
      source: "告警接管",
      description: a.title,
    });
    a.work = w.id;
    migrationAudit(w);
    w.history.push({
      time: time(),
      from: "旧版已确认",
      to: w.status,
      actor: "版本迁移",
      reason: "迁移补建：旧版已确认告警，未虚构人工接管记录",
    });
  }
  for (const w of state.work) for (const h of w.history) h.workId = w.id;
  journeysValidated = true;
  return state.journeys;
}
const person = () => PEOPLE[state.demoPerson] || PEOPLE.operator;
const jr = (id = ensureJourneys().active) => ensureJourneys().records[id];
const cs = (id = ensureJourneys().active) => CASES[id];
const caseForDevice = (id) =>
  Object.keys(CASES).find((k) => CASES[k].device === id);
const caseForAlarm = (id) =>
  Object.keys(CASES).find((k) => CASES[k].alarm === id);
const allowed = (...roles) => roles.includes(person().kind);
function denied() {
  toast("当前模拟身份无此操作权限，或任务尚未交接到此岗位");
  return false;
}
function isAssigned(id) {
  const w = state.work.find((w) => w.id === jr(id).workId);
  return allowed("engineer") && w?.ownerId === state.demoPerson;
}
function wfSync() {
  for (const id of Object.keys(CASES)) {
    const r = jr(id),
      c = cs(id),
      d = dev(c.device),
      closed = r.stage === "closed",
      recovered =
        ["review", "closed"].includes(r.stage) && !!r.tests.at(-1)?.passed;
    d.journeyId = id;
    d.riskLabel = closed ? "已闭环" : "待核验风险";
    d.quality = r.quality;
    d.health = closed ? 96 : 72;
    d.temp =
      id === "battery"
        ? recovered
          ? 27.8
          : 32
        : id === "cooling"
          ? recovered
            ? 27
            : 31.6
          : d.temp;
    if (id === "capacity") d.load = recovered ? 62 : 84;
    d.currentEvidence = r.tests.at(-1)?.evidence || c.evidence;
    d.riskStatus = stageLabel[r.stage];
    const a = state.alarms.find((a) => a.id === c.alarm);
    a.signalState = recovered ? "recovered" : "active";
    a.condition = recovered
      ? closed
        ? "复测恢复（已验收）"
        : "复测恢复（待验收）"
      : "异常待核验";
  }
}
const originalLog = log;
log = (action, target, detail = "") => {
  originalLog(action, target, detail);
  state.audits[0].actor = person().name + " · " + person().role;
  save();
};
function wfLog(id, action, detail) {
  wfSync();
  const r = jr(id);
  r.history.push({
    id: `TRACE-${id}-${r.history.length + 1}`,
    time: time(),
    actor: state.demoPerson,
    workId: r.workId,
    action: person().name + " · " + action,
    detail,
  });
  log(action, r.workId || cs(id).event, detail);
  save();
}
function wfCommit(id, action, detail) {
  wfLog(id, action, detail);
  render();
  return true;
}
function wfAck(id, note) {
  if (
    !CASES[id] ||
    !allowed("operator") ||
    jr(id).stage !== "discovered" ||
    !String(note || "").trim()
  )
    return denied();
  const r = jr(id);
  r.stage = "acknowledged";
  ensureCaseWork(id);
  r.acknowledgedBy = state.demoPerson;
  const alarm = state.alarms.find((a) => a.id === cs(id).alarm);
  alarm.status = "处理中";
  alarm.work = r.workId;
  alarm.acknowledgedBy = state.demoPerson;
  alarm.acknowledgedAt = time();
  return wfCommit(id, "接管告警", note);
}
function wfRequest(id, note) {
  if (
    !CASES[id] ||
    !allowed("operator") ||
    jr(id).stage !== "acknowledged" ||
    !String(note || "").trim()
  )
    return denied();
  jr(id).stage = "requested";
  jr(id).requestedBy = state.demoPerson;
  return wfCommit(id, "提交诊断请求", note);
}
function wfAnalyze(id = ensureJourneys().active) {
  if (
    !CASES[id] ||
    !allowed("engineer", "analyst") ||
    !["acknowledged", "requested", "analyzed", "deferred", "rejected"].includes(
      jr(id).stage,
    )
  )
    return denied();
  const r = jr(id),
    blocked = r.quality !== "有效";
  r.diagnoses.push({
    id: `DX-${id}-${r.diagnoses.length + 1}`,
    workId: r.workId,
    event: cs(id).event,
    evidence: cs(id).evidence,
    kb: cs(id).kb,
    knowledgeVersion: WF_KNOWLEDGE[cs(id).kb].version,
    version: "DEMO-RULE-3.0",
    actor: state.demoPerson,
    time: time(),
    blocked,
    quality: r.quality,
    conclusion: blocked
      ? "证据质量不足，拒绝输出预测结论"
      : cs(id).hypotheses[0][0],
  });
  r.stage = blocked ? "requested" : "analyzed";
  wfCommit(
    id,
    blocked ? "质量门禁阻断" : "提交固定规则辅助诊断",
    r.diagnoses.at(-1).id,
  );
  return !blocked;
}
function wfDecide(id, choice, plan, note, assignee = "engineer") {
  if (!CASES[id] || !allowed("supervisor")) return denied();
  const r = jr(id),
    d = r.diagnoses.at(-1);
  if (
    !d ||
    d.blocked ||
    d.superseded ||
    r.quality !== "有效" ||
    !["analyzed", "deferred"].includes(r.stage) ||
    !["approve", "defer", "reject"].includes(choice) ||
    !String(note || "").trim() ||
    !cs(id).plans.includes(plan)
  )
    return false;
  r.decisions.push({
    id: `DEC-${id}-${r.decisions.length + 1}`,
    workId: r.workId,
    diagnosis: d.id,
    choice,
    plan,
    note: note.trim(),
    actor: state.demoPerson,
    assignee: null,
    time: time(),
  });
  r.stage = { approve: "dispatch", defer: "deferred", reject: "rejected" }[
    choice
  ];
  if (choice === "approve") {
    const w = state.work.find((w) => w.id === r.workId);
    Object.assign(w, {
      diagnosisId: d.id,
      decisionId: r.decisions.at(-1).id,
      approvedPlan: plan,
    });
    w.version++;
  }

  return wfCommit(
    id,
    choice === "approve" ? "批准方案，转待派单" : "处置方案审核",
    `${choice} / ${plan} / ${note}`,
  );
}
function wfStart(id = ensureJourneys().active) {
  if (
    !CASES[id] ||
    !isAssigned(id) ||
    jr(id).stage !== "assigned" ||
    jr(id).quality !== "有效"
  )
    return denied();
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  r.stage = "executing";
  w.status = "排查中";
  w.version++;
  w.history.push({
    time: time(),
    from: "待接单",
    to: "排查中",
    reason: "本人接受已分派工单",
    actor: person().name,
  });
  wfCommit(id, "接受工单", w.id);
  return w.id;
}
function wfCheck(id, index, value) {
  if (
    !CASES[id] ||
    !isAssigned(id) ||
    jr(id).stage !== "executing" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= cs(id).checks.length ||
    typeof value !== "boolean"
  )
    return denied();
  jr(id).checks[index] = value;
  wfLog(id, value ? "完成检查项" : "撤回检查项", cs(id).checks[index]);
  return true;
}
function wfSubmit(id, note) {
  if (
    !CASES[id] ||
    !isAssigned(id) ||
    jr(id).stage !== "executing" ||
    !cs(id).checks.every((_, i) => jr(id).checks[i]) ||
    !String(note || "").trim()
  )
    return false;
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  r.stage = "retest";
  w.status = "待复测";
  w.version++;
  w.history.push({
    time: time(),
    from: "排查中",
    to: "待复测",
    reason: note,
    actor: person().name,
  });
  return wfCommit(id, "提交排查记录", note);
}
function wfRetest(id, pass, note) {
  if (
    !CASES[id] ||
    !isAssigned(id) ||
    jr(id).stage !== "retest" ||
    jr(id).quality !== "有效" ||
    typeof pass !== "boolean" ||
    !String(note || "").trim()
  )
    return false;
  const r = jr(id),
    c = cs(id);
  r.tests.push({
    id: `TEST-${id}-${r.tests.length + 1}`,
    workId: r.workId,
    evidence: `POST-${id}-${r.tests.length + 1}`,
    actor: state.demoPerson,
    passed: pass,
    values: pass ? [...c.after] : [...c.series],
    note,
    time: time(),
    window: c.window,
    quality: r.quality,
  });
  r.stage = pass ? "review" : "executing";
  if (!pass) r.checks = [];
  const w = state.work.find((w) => w.id === r.workId);
  w.status = pass ? "待审核" : "排查中";
  w.version++;
  w.history.push({
    time: time(),
    from: "待复测",
    to: w.status,
    reason: note,
    actor: person().name,
  });
  return wfCommit(
    id,
    pass ? "复测通过，提交独立验收" : "复测失败，返回排查",
    r.tests.at(-1).id,
  );
}
function wfClose(id, reviewer, note) {
  if (!CASES[id] || !allowed("supervisor")) return denied();
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  if (
    r.stage !== "review" ||
    r.quality !== "有效" ||
    !r.tests.at(-1)?.passed ||
    w.ownerId === state.demoPerson ||
    r.tests.at(-1).actor === state.demoPerson ||
    reviewer !== state.demoPerson ||
    !String(note || "").trim()
  )
    return false;
  r.stage = "closed";
  r.caseId = `CASE-${id.toUpperCase()}-001`;
  r.reviewer = person().name;
  r.reviewNote = note;
  w.caseId = r.caseId;
  w.acceptance = { workId: w.id, actor: state.demoPerson, time: time(), note };
  w.status = "已关闭";
  w.version++;
  w.history.push({
    time: time(),
    from: "待审核",
    to: "已关闭",
    reason: note,
    actor: person().name,
  });
  state.alarms.find((a) => a.id === cs(id).alarm).status = "已关闭";
  return wfCommit(id, "独立验收关闭并回写案例", `${r.caseId} / ${note}`);
}
function wfReturn(id, note) {
  if (
    !CASES[id] ||
    !allowed("supervisor") ||
    jr(id).stage !== "review" ||
    !String(note || "").trim()
  )
    return false;
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  r.stage = "executing";
  r.checks = [];
  w.status = "排查中";
  w.version++;
  w.history.push({
    time: time(),
    from: "待审核",
    to: "排查中",
    reason: note,
    actor: person().name,
  });
  return wfCommit(id, "验收退回返工", note);
}
function wfQuality(id, value) {
  if (
    !CASES[id] ||
    !allowed("admin") ||
    !["有效", "缺失", "迟到"].includes(value) ||
    jr(id).stage === "closed"
  )
    return denied();
  const r = jr(id);
  if (
    r.quality !== value &&
    [
      "acknowledged",
      "requested",
      "analyzed",
      "deferred",
      "rejected",
      "dispatch",
    ].includes(r.stage) &&
    r.diagnoses.length
  ) {
    r.stage = "requested";
    r.diagnoses.at(-1).superseded = true;
  }
  r.quality = value;
  return wfCommit(id, "更改演示证据质量", value);
}
function wfReset(id) {
  if (!CASES[id] || !allowed("admin")) return denied();
  const r = jr(id);
  state.work = state.work.filter((w) => w.id !== r.workId);
  const a = state.alarms.find((a) => a.id === cs(id).alarm);
  a.status = "待确认";
  a.work = null;
  delete a.acknowledgedBy;
  delete a.acknowledgedAt;
  ensureJourneys().records[id] = freshJourney(id);
  return wfCommit(id, "重置单个合成事件", "其他记录保持不变");
}
function wfAction(label, fn, primary = false, disabled = false) {
  return `<button class="${primary ? "primary" : "small"}" ${disabled ? "disabled" : ""} onclick="${fn}">${label}</button>`;
}
function wfDecisionForm(choice) {
  if (
    !wfDecide(
      jr().id,
      choice,
      $("#wf-plan")?.value,
      $("#wf-note")?.value,
      $("#wf-assignee")?.value,
    )
  )
    toast("请检查身份、有效诊断、方案、执行人与必填依据");
}
function wfForm(action) {
  const id = jr().id,
    note = $("#wf-note")?.value?.trim();
  if (!note) return toast("请填写操作依据");
  const result =
    action === "ack"
      ? wfAck(id, note)
      : action === "request"
        ? wfRequest(id, note)
        : action === "submit"
          ? wfSubmit(id, note)
          : action === "pass"
            ? wfRetest(id, true, note)
            : action === "fail"
              ? wfRetest(id, false, note)
              : action === "close"
                ? wfClose(id, state.demoPerson, note)
                : action === "return"
                  ? wfReturn(id, note)
                  : false;
  if (!result) toast("操作未完成，请核对当前岗位、状态和检查清单");
}

// Native module surfaces. All context-specific interactions live in the detail drawer.
const nativeViews = { ...views };
modules.splice(7, 0, ["knowledge", "知识与案例库", ""]);
subtitles.overview = "站点运行状态与当前岗位的待办，来自同一组业务记录。";
subtitles.knowledge = "检索知识适用条件，回顾已验收事件及其原始证据。";
const nativeIcon = icon;
icon = (i) => nativeIcon(i % 12);
function visibleCases() {
  return ["cooling", "battery", "energy", "capacity"].filter(
    (id) => site === "all" || dev(cs(id).device).site === site,
  );
}
function inQueue(id) {
  const r = jr(id);
  switch (person().kind) {
    case "operator":
      return ["discovered", "acknowledged"].includes(r.stage);
    case "engineer":
      return (
        (isAssigned(id) &&
          ["assigned", "executing", "retest"].includes(r.stage)) ||
        r.stage === "requested"
      );
    case "supervisor":
      return ["analyzed", "deferred", "review"].includes(r.stage);
    case "analyst":
      return ["requested", "rejected"].includes(r.stage);
    case "admin":
      return r.quality !== "有效";
    default:
      return false;
  }
}
function nextOwner(id) {
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  if (["discovered", "acknowledged"].includes(r.stage))
    return "刘值班 · 接管 / 提交诊断";
  if (["requested", "rejected"].includes(r.stage))
    return "周分析 / 维护工程师 · 诊断";
  if (["analyzed", "deferred"].includes(r.stage)) return "陈主管 · 审批分派";
  if (["assigned", "executing", "retest"].includes(r.stage))
    return `${w?.owner || "未分派"} · ${stageLabel[r.stage]}`;
  if (r.stage === "review") return "陈主管 · 独立验收";
  return "已归档 · 可查证据与案例";
}
function queueTable(ids) {
  return table(
    ["事件 / 设备", "状态", "当前责任人", "操作"],
    ids.map(
      (id) =>
        `<tr><td><strong>${cs(id).title}</strong><span class="id">${cs(id).event} · ${cs(id).device}</span></td><td>${badge(stageLabel[jr(id).stage])}</td><td>${nextOwner(id)}</td><td>${wfAction("打开详情", `openCase('${id}','actions')`)}</td></tr>`,
    ),
  );
}
function ordinaryQueue() {
  const p = person(),
    rows = [];
  if (p.kind === "operator")
    for (const a of filteredAlarms().filter(
      (a) => !caseForAlarm(a.id) && a.status === "待确认",
    ))
      rows.push({
        id: a.id,
        title: a.title,
        device: a.device,
        status: a.status,
        owner: "刘值班 · 接管告警",
        type: "alarm",
      });
  for (const w of state.work.filter(
    (w) => !w.journey && (site === "all" || dev(w.device).site === site),
  )) {
    const mine =
        p.kind === "engineer" &&
        w.ownerId === state.demoPerson &&
        ["待接单", "排查中", "处置中", "待复测"].includes(w.status),
      review =
        p.kind === "supervisor" &&
        ["待分派", "待审批", "待审核"].includes(w.status);
    if (mine || review)
      rows.push({
        id: w.id,
        title: w.title,
        device: w.device,
        status: w.status,
        owner: review ? "陈主管 · " + w.status : w.owner,
        type: "work",
      });
  }
  return rows;
}
function inboxCount() {
  return visibleCases().filter(inQueue).length + ordinaryQueue().length;
}
function roleQueue() {
  const ids = visibleCases().filter(inQueue),
    ordinary = ordinaryQueue(),
    p = person();
  return `<section class="card role-queue">${head(`${p.name}的${{ operator: "值班待办", engineer: "执行与诊断待办", supervisor: "审批与验收待办", analyst: "诊断待办", admin: "质量待办" }[p.kind]}`, badge(inboxCount() + " 项"))}<p>${p.focus}</p>${ids.length ? queueTable(ids) : ""}${
    ordinary.length
      ? table(
          ["任务 / 设备", "状态", "当前责任人", "操作"],
          ordinary
            .slice(0, Math.max(0, 5 - ids.length))
            .map(
              (x) =>
                `<tr><td><strong>${esc(x.title)}</strong><span class="id">${x.id} · ${x.device}</span></td><td>${badge(x.status)}</td><td>${esc(x.owner)}</td><td>${wfAction("打开详情", `openEntity('${x.type}','${x.id}','actions')`)}</td></tr>`,
            ),
        )
      : ""
  }${ordinary.length + ids.length > 5 ? `<p>显示前 5 项，共 ${inboxCount()} 项。${wfAction("查看完整任务列表", `navigate('${p.kind === "operator" ? "alarms" : "work"}')`)}</p>` : ""}${!ids.length && !ordinary.length ? '<div class="empty">当前岗位暂无待办。其他岗位的进度可在告警或工单详情中查阅。</div>' : ""}</section>`;
}

views.overview = () => {
  const p = person(),
    ids = visibleCases(),
    queue = roleQueue();
  if (p.kind === "operator") return nativeViews.overview() + queue;
  if (p.kind === "engineer")
    return (
      queue +
      `<div class="kpis">${kpi("分派给我", state.work.filter((w) => w.ownerId === state.demoPerson && w.status !== "已关闭" && (site === "all" || dev(w.device).site === site)).length, "张", "按固定演示人员 ID 分派")}${kpi("待接单", ids.filter((id) => isAssigned(id) && jr(id).stage === "assigned").length, "张", "接受后才能填写检查清单")}${kpi("待复测", ids.filter((id) => isAssigned(id) && jr(id).stage === "retest").length, "张", "失败返回排查")}${kpi("已提交验收", ids.filter((id) => isAssigned(id) && jr(id).stage === "review").length, "张", "由主管独立审核")}</div>` +
      nativeViews.work()
    );
  if (p.kind === "supervisor")
    return (
      queue +
      `<div class="kpis">${kpi("待审批", ids.filter((id) => ["analyzed", "deferred"].includes(jr(id).stage)).length, "项", "审核建议并选择执行人")}${kpi("执行中", ids.filter((id) => ["assigned", "executing", "retest"].includes(jr(id).stage)).length, "项", "跨岗位工单共享")}${kpi("待独立验收", ids.filter((id) => jr(id).stage === "review").length, "项", "必须有有效通过复测")}${kpi("已闭环", ids.filter((id) => jr(id).stage === "closed").length, "项", "保留异常与复测历史")}</div>` +
      nativeViews.work()
    );
  if (p.kind === "analyst")
    return (
      queue +
      `<section class="card">${head("事件研判与经验回顾")}${queueTable(ids)}</section>` +
      knowledgeCatalogue()
    );
  return (
    queue +
    `<div class="kpis">${kpi("演示网关", 1, "个", esc(state.config.gateway))}${kpi("模拟测点", filteredDevices().length * 8, "个", "仅浏览器固定样本")}${kpi("资产关系版本", state.topologyVersion, "", "按变更记录追溯")}${kpi("本地审计", state.audits.length, "条", "非不可篡改存证")}</div>` +
    nativeViews.quality()
  );
};
function entityLink() {
  const id = caseForDevice(selectedDevice);
  return id
    ? `<div class="entity-shortcut">${badge(stageLabel[jr(id).stage])}<span>${cs(id).event} · ${nextOwner(id)}</span>${wfAction("查看关联事件", `openCase('${id}','overview')`)}</div>`
    : "";
}
views.monitor = () => monView() + entityLink();
views.assistant = () => nativeViews.assistant() + entityLink();
views.health = () => {
  const select = deviceSelect(),
    id = caseForDevice(selectedDevice);
  if (!id) return nativeViews.health();
  const c = cs(id),
    r = jr(id),
    closed = r.stage === "closed",
    t = r.tests.at(-1),
    recovered = !!t?.passed;
  return `<div class="grid two"><section class="card">${head("设备健康与监测证据", select)}${r.quality === "有效" ? wfTrend(c, recovered ? t.values : c.series, recovered) : '<div class="empty">证据质量不足，停止预测。</div>'}<p>${recovered ? (closed ? "已审核的复测快照" : "复测快照 · 等待独立验收") : "事件触发时的异常快照"} · ${t?.evidence || c.evidence}</p></section><section class="card">${head("当前风险状态", badge(stageLabel[r.stage]))}<h2>${c.metric} ${recovered ? c.after.at(-1) : c.series.at(-1)}${c.unit}</h2><p>${recovered ? c.outcome : r.quality === "有效" ? c.forecast : "缺少可信输入，不能给出有效预测结论。"}</p><div class="split-note">${closed ? "原始异常保留在历史证据中，闭环仅代表此合成场景通过验收。" : c.risk}</div>${wfAction("查阅事件详情与前后证据", `openCase('${id}','evidence')`, true)}</section></div>`;
};
function knowledgeCatalogue() {
  return `<section class="card">${head("知识条目与已验收案例", badge("原创摘要 · 非原厂规程"))}${table(
    ["知识条目", "适用范围", "关联事件 / 案例", "操作"],
    visibleCases().map((id) => {
      const c = cs(id),
        k = WF_KNOWLEDGE[c.kb],
        r = jr(id);
      return `<tr><td><strong>${c.kb}</strong><span class="id">${k.title}</span></td><td class="wrap-cell">${k.scope}</td><td>${c.event}<span class="id">${r.caseId || "尚无已验收案例"}</span></td><td>${wfAction("查看引用与证据", `openCase('${id}','analysis')`)}</td></tr>`;
    }),
  )}<p>已验收案例是本地回顾材料，不自动发布为可执行知识规程。</p></section>`;
}
views.knowledge = knowledgeCatalogue;
views.work = () =>
  `<div class="work-summary">${["待接单", "排查中", "待复测", "待审核", "已关闭"].map((s) => `<button onclick="filter='${s}';pageNo=1;render()">${s}<b>${state.work.filter((w) => (site === "all" || dev(w.device).site === site) && w.status === s).length}</b></button>`).join("")}</div>` +
  nativeViews.work();
WORK_STATES.splice(
  0,
  WORK_STATES.length,
  "待分派",
  "待接单",
  "排查中",
  "待审批",
  "处置中",
  "待复测",
  "待审核",
  "已关闭",
);

// A single native dialog styled as a right drawer keeps the underlying filters and scroll intact.
let detail = null,
  detailOpener = null,
  detailScroll = 0,
  detailInitialHash = "";
const detailDialog = document.createElement("dialog");
detailDialog.id = "entity-drawer";
detailDialog.setAttribute("aria-labelledby", "detail-title");
document.body.appendChild(detailDialog);
const detailTabs = [
  ["overview", "概况"],
  ["evidence", "监测证据"],
  ["analysis", "AI / 知识"],
  ["actions", "建议与处置"],
  ["history", "历史记录"],
  ["figure", "机理示意"],
];
function openCase(id, tab = "overview") {
  if (!CASES[id]) return;
  ensureJourneys().active = id;
  save();
  openEntity("event", id, tab);
}
function openEntity(type, id, tab = "overview", opts = {}) {
  if (
    (type === "asset" && !dev(id)) ||
    (type === "alarm" && !state.alarms.some((a) => a.id === id)) ||
    (type === "work" && !state.work.some((w) => w.id === id))
  )
    return;
  // plain：纯资产视图（数字孪生点击/资产档案进入）。只展示设备自身档案，
  // 不带 S1–S4 场景阶段与工单旅程；场景故事保留在「场景演示」页与告警业务流中。
  const plain = type === "asset" && !!opts.plain;
  const caseId =
    type === "event"
      ? id
      : type === "asset" && !plain
        ? caseForDevice(id)
        : type === "alarm"
          ? caseForAlarm(id)
          : state.work.find((w) => w.id === id)?.journey;
  if (caseId) {
    ensureJourneys().active = caseId;
    save();
  }
  if (!detailDialog.open) {
    detailOpener = document.activeElement;
    detailScroll = window.scrollY;
    detailInitialHash = location.hash;
    detailDialog.showModal();
    document.body.classList.add("drawer-open");
  }
  detail = {
    type,
    id,
    caseId: plain ? null : caseId,
    plain,
    tab: detailTabs.some((t) => t[0] === tab) ? tab : "overview",
  };
  drawDetail();
  $("#detail-close").focus();
}
function closeDetail() {
  if (detailDialog.open) detailDialog.close();
}
detailDialog.addEventListener("click", (event) => {
  if (event.target === detailDialog) {
    const r = detailDialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeDetail();
  }
});
detailDialog.addEventListener("close", () => {
  detail = null;
  figTeardown();
  document.body.classList.remove("drawer-open");
  window.scrollTo(0, detailScroll);
  if (detailOpener?.isConnected) detailOpener.focus();
  else $("#title")?.focus();
});
function detailTab(tab) {
  if (!detail || !detailTabs.some((t) => t[0] === tab)) return;
  detail.tab = tab;
  drawDetail();
  detailDialog.querySelector(`[data-tab="${tab}"]`)?.focus();
}
function drawDetail() {
  if (!detail || !detailDialog.open) return;
  const x = detail,
    caseId = x.caseId,
    d =
      x.type === "asset"
        ? dev(x.id)
        : x.caseId
          ? dev(cs(x.caseId).device)
          : x.type === "alarm"
            ? dev(state.alarms.find((a) => a.id === x.id).device)
            : dev(state.work.find((w) => w.id === x.id).device);
  if (!d) return;
  const r = caseId ? jr(caseId) : null,
    c = caseId ? cs(caseId) : null;
  detailDialog.innerHTML = `<div class="drawer-heading"><div class="breadcrumbs"><button class="link" onclick="closeDetail()">${modules.find((m) => m[0] === page)?.[1] || "返回列表"}</button><span>/</span>详情</div><button id="detail-close" aria-label="关闭详情并返回列表" onclick="closeDetail()">×</button></div><div class="drawer-identity"><span class="eyebrow">${x.type === "asset" ? "ASSET RECORD" : x.type === "work" ? "WORK ORDER" : "EVENT RECORD"}</span><h2 id="detail-title">${c ? c.title : d.name}</h2><p>${d.id} · ${d.site}</p>${r ? badge(stageLabel[r.stage]) + " <span>" + nextOwner(caseId) + "</span>" : ""}</div><div class="drawer-tabs" role="tablist" aria-label="详情栏目">${detailTabs.map(([tab, label]) => `<button id="tab-${tab}" role="tab" aria-controls="detail-panel" aria-selected="${x.tab === tab}" data-tab="${tab}" onclick="detailTab('${tab}')">${label}</button>`).join("")}</div><div id="detail-panel" role="tabpanel" aria-labelledby="tab-${x.tab}" class="drawer-content">${caseId ? caseDetail(caseId, x.tab) : genericDetail(d, x.tab)}</div><div class="drawer-footnote">本地合成数据 · 当前身份：${person().name} / ${person().role} · 不执行真实设备控制</div>`;
  detailDialog
    .querySelector(".drawer-tabs")
    .addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const i = detailTabs.findIndex((t) => t[0] === detail.tab),
        n =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? detailTabs.length - 1
              : (i + (e.key === "ArrowRight" ? 1 : detailTabs.length - 1)) % detailTabs.length;
      detailTab(detailTabs[n][0]);
    });
  if (x.tab === "figure") {
    let figKey = x.caseId && CASE_FIGURE[x.caseId] ? x.caseId : null;
    if (!figKey) {
      const a0 =
        x.type === "alarm"
          ? state.alarms.find((al) => al.id === x.id)
          : state.alarms.find((al) => al.device === d.id);
      figKey = genericFigKey(d, a0);
    }
    if (figKey && globalThis[CASE_FIGURE[figKey]]) {
      figTeardown();
      figCtrl = globalThis[CASE_FIGURE[figKey]].mount($("#case-fig-host"), figCaseModel(figKey));
      // 有活动告警时 AI 自动回放机理（固定节奏演示基线）
      const act = state.alarms.find((al) => al.device === d.id && al.status !== "已关闭");
      if (act) figAutoPlay(figKey);
    }
  } else figTeardown();
}
function caseDetail(id, tab) {
  const r = jr(id),
    c = cs(id),
    a = state.alarms.find((a) => a.id === c.alarm),
    w = state.work.find((w) => w.id === r.workId),
    d = r.diagnoses.at(-1),
    t = r.tests.at(-1);
  if (tab === "overview")
    return `<section><h3>资产与事件</h3><dl><dt>设备</dt><dd>${c.device} · ${dev(c.device).model}（虚构）</dd><dt>告警</dt><dd>${c.alarm} · ${a.status}</dd><dt>监测条件</dt><dd>${a.condition}</dd><dt>影响范围</dt><dd>${c.impact}</dd><dt>事件</dt><dd>${c.event}</dd><dt>工单</dt><dd>${r.workId ? wfAction(r.workId, `workDetail('${r.workId}')`) : "接管时立即创建"}</dd><dt>执行人</dt><dd>${w?.owner || "尚未分派"}</dd><dt>案例</dt><dd>${r.caseId || "等待独立验收"}</dd></dl><div class="split-note">${r.stage === "closed" ? c.outcome : "告警确认仅表示有人接管，不代表异常恢复。" + c.risk}</div><h3>关联资产</h3><div class="toolbar">${[c.device, ...c.related].map((d) => wfAction(d, `assetDetail('${d}')`)).join("")}</div>${wfAction("查看当前岗位可执行操作", "detailTab('actions')", true)}</section>`;
  if (tab === "evidence")
    return `<section><h3>事件前原始快照</h3><p>${c.evidence} · 固定时间 2026-10-17 01:45 UTC · 质量 ${r.quality}</p>${r.quality === "有效" ? wfTrend(c) : '<div class="empty">证据质量不足，保留样本但不作为有效预测输入。</div>'}<dl class="fact-list">${c.facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl><h3>复测记录 ${r.tests.length} 次</h3>${r.tests.map((t) => `<div class="split-note"><b>${t.id} · ${t.passed ? "通过" : "失败 / 返工"}</b><p>${t.evidence} · ${t.time} · ${PEOPLE[t.actor]?.name || "历史人员"}</p>${wfTrend(c, t.values, t.passed)}<p>${esc(t.note)}</p></div>`).join("") || "<p>尚无复测证据。不会显示已恢复。</p>"}${allowed("admin") ? `<label for="wf-quality">演示证据质量</label><select id="wf-quality" onchange="wfQuality('${id}',this.value)" ${r.stage === "closed" ? "disabled" : ""}>${["有效", "缺失", "迟到"].map((q) => `<option ${r.quality === q ? "selected" : ""}>${q}</option>`).join("")}</select>` : ""}</section>`;
  if (tab === "analysis") {
    const k = WF_KNOWLEDGE[c.kb];
    return `<section><h3>辅助诊断 ${badge("固定规则 · 非真实 AI")}</h3>${d ? `<p>${d.id} · ${d.version} · ${PEOPLE[d.actor]?.name || "历史人员"}</p><div class="split-note">${d.blocked || d.superseded || r.quality !== "有效" ? "证据不足或旧分析已失效，不可据此批准。" : esc(d.conclusion)}</div>` : "<p>尚未提交辅助诊断。由值班人员接管告警并请求诊断后，分析人员可处理。</p>"}${d && !d.blocked && !d.superseded && r.quality === "有效" ? `<h3>竞争假设</h3>${c.hypotheses.map((h) => `<div class="hypothesis"><b>${h[0]}</b><span>${h[1]}</span><p>${h[2]}</p></div>`).join("")}<p>${r.stage === "closed" ? "以上为处置前诊断记录，不代表当前仍在发生异常。" : c.forecast}</p>` : ""}${allowed("engineer", "analyst") && ["requested", "analyzed", "deferred", "rejected"].includes(r.stage) ? wfAction("核对证据并提交辅助诊断", `wfAnalyze('${id}')`, true) : ""}<h3>${c.kb} · ${k.title}</h3><p>${k.version}</p><div class="knowledge-passage">${k.passage}</div><h4>适用范围</h4><p>${k.scope}</p><div class="split-note">${k.boundary}</div>${k.sources.map(([title, url, ref]) => `<div class="source-record"><a href="${url}" target="_blank" rel="noopener noreferrer">${title} ↗</a><p>${ref}</p></div>`).join("")}<p>规则排序不是故障概率；根因需要现场证实。公开资料只在主动点击链接时打开。</p>${r.caseId ? `<h3>已验收案例 ${r.caseId}</h3><p>${c.outcome}</p><p>审核：${esc(r.reviewer)} · ${esc(r.reviewNote)}</p><p>仅供复盘，不自动成为通用知识规程。</p>` : ""}</section>`;
  }
  if (tab === "history") return wfHistory(r);
  if (tab === "figure") {
    if (!CASE_FIGURE[id] || !c.series) return `<section><h3>故障机理回放</h3><div class="empty">该事件暂无等距机理示意图。</div></section>`;
    return `<section><h3>故障机理回放 ${badge("演示口径")}</h3>${figAlarmBanner(a)}${figAutoBar(id)}<div id="case-fig-host" class="case-fig"></div>${figTimelineHtml(id, "fig-t")}${aiDemoBlock(id)}<p class="split-note">等距剖视解释「${c.metric}」的故障物理：表针、风条/流条与告警灯由本场景同一份数据驱动。T1–T${c.series.length} 为时间窗逐帧回放，复测通过为维护后的状态。存在活动告警时自动按时间窗播放；也可点「AI 自动回放」重新播放。仅作演示，不构成设备健康或剩余寿命保证。</p></section>`;
  }
  return caseActions(id);
}
function caseActions(id) {
  const r = jr(id),
    c = cs(id),
    w = state.work.find((w) => w.id === r.workId);
  let actions = "",
    form = false;
  if (allowed("operator") && ["discovered", "acknowledged"].includes(r.stage)) {
    form = true;
    actions = wfAction(
      r.stage === "discovered" ? "确认并接管告警" : "提交诊断请求",
      `wfForm('${r.stage === "discovered" ? "ack" : "request"}')`,
      true,
    );
  }
  if (
    allowed("engineer", "analyst") &&
    ["acknowledged", "requested", "analyzed", "rejected", "deferred"].includes(
      r.stage,
    )
  )
    actions = wfAction("查阅证据与提交诊断", "detailTab('analysis')", true);
  if (allowed("supervisor") && ["analyzed", "deferred"].includes(r.stage)) {
    form = true;
    actions = `<label for="wf-plan">处置方案</label><select id="wf-plan">${c.plans.map((p) => `<option>${p}</option>`).join("")}</select><div class="toolbar">${wfAction("批准方案，转待派单", "wfDecisionForm('approve')", true)}${wfAction("暂缓", "wfDecisionForm('defer')")}${wfAction("退回补充诊断", "wfDecisionForm('reject')")}</div>`;
  }
  if (isAssigned(id) && r.stage === "assigned")
    actions = wfAction("接受分派工单", `wfStart('${id}')`, true);
  if (isAssigned(id) && r.stage === "executing") {
    form = true;
    actions = `<h3>现场检查清单（文字模拟）</h3>${c.checks.map((x, i) => `<label class="check-row"><input type="checkbox" ${r.checks[i] ? "checked" : ""} onchange="wfCheck('${id}',${i},this.checked)">${x}</label>`).join("")}${wfAction("提交排查，进入复测", "wfForm('submit')", true)}`;
  }
  if (isAssigned(id) && r.stage === "retest") {
    form = true;
    actions = `<div class="toolbar">${wfAction("回放复测通过证据", "wfForm('pass')", true)}${wfAction("回放复测失败证据", "wfForm('fail')")}</div>`;
  }
  if (allowed("supervisor") && r.stage === "review") {
    form = true;
    actions = `<p>验收人：${person().name}（当前固定身份），执行人：${w.owner}。请先查阅监测证据中的复测结果。</p><div class="toolbar">${wfAction("独立验收并关闭", "wfForm('close')", true)}${wfAction("退回继续排查", "wfForm('return')")}</div>`;
  }
  return `<h3>当前交接</h3><div class="split-note">${nextOwner(id)}</div><p>${c.risk}</p>${w ? `<p>工单 ${w.id} · 执行人 ${w.owner} · v${w.version}<br>已批准：${esc(w.approvedPlan)}</p>` : ""}${form ? '<label for="wf-note">操作依据 / 现场与验收记录（必填）</label><textarea id="wf-note" placeholder="填写模拟证据、处置依据或复测结论，不输入敏感信息"></textarea>' : ""}${actions || `<div class="empty">${r.stage === "closed" ? "该事件已闭环。可查阅证据、案例和完整历史。" : "当前岗位仅可查阅。请由 " + nextOwner(id) + " 完成下一步。"}</div>`}${r.decisions.length ? "<h3>方案审批记录</h3>" + r.decisions.map((d) => `<div class="split-note">${d.id} · ${PEOPLE[d.actor]?.name} · ${esc(d.choice)}<p>${esc(d.plan)}<br>${esc(d.note)}</p></div>`).join("") : ""}`;
}
function genericDetail(d, tab) {
  const a =
      detail.type === "alarm"
        ? state.alarms.find((a) => a.id === detail.id)
        : state.alarms.find((a) => a.device === d.id),
    w =
      detail.type === "work"
        ? state.work.find((w) => w.id === detail.id)
        : a?.work
          ? state.work.find((w) => w.id === a.work)
          : null;
  if (tab === "overview")
    return `<dl><dt>资产 ID</dt><dd>${d.id}</dd><dt>名称</dt><dd>${d.name}</dd><dt>型号</dt><dd>${d.model}（虚构）</dd><dt>机房</dt><dd>${d.room}</dd><dt>数据质量</dt><dd>${badge(d.quality)}</dd><dt>告警</dt><dd>${a ? a.id + " · " + a.status : "暂无关联告警"}</dd><dt>工单</dt><dd>${w ? w.id + " · " + w.status : "尚未创建"}</dd></dl><div class="toolbar">${a ? wfAction("关联告警", `alarmDetail('${a.id}')`) : ""}${w ? wfAction("关联工单", `workDetail('${w.id}')`) : ""}</div>`;
  if (tab === "evidence")
    return `<h3>设备测点</h3>${chart("temp", false, d)}${table(
      ["测点", "值", "单位", "质量"],
      points(d).map(
        (p) =>
          `<tr><td>${p.name}</td><td>${p.value}</td><td>${p.unit}</td><td>${badge(p.quality)}</td></tr>`,
      ),
    )}`;
  if (tab === "analysis") {
    const k = deviceKnowledge(d);
    return `<h3>${k.id}</h3><p>${k.text}</p><p>固定规则知识脚本，无真实推理或现场操作授权。</p>`;
  }
  if (tab === "history")
    return `<ul class="timeline">${(w?.history || []).map((h) => `<li>${esc(h.from)} → ${esc(h.to)}<small>${esc(h.actor)} · ${h.time}</small><p>${esc(h.reason)}</p></li>`).join("") || "<li>尚无工单流转记录。</li>"}</ul>`;
  if (tab === "figure") {
    const key = genericFigKey(d, a);
    if (!key) return `<section><h3>故障机理回放</h3><div class="empty">该设备类型暂无机理示意图。场景化机理见 S1–S4（场景演示页）。</div></section>`;
    const src = figCase(key);
    return `<section><h3>故障机理回放 ${badge("演示口径")}</h3>${figAlarmBanner(a)}${figAutoBar(key)}<p>按「${a ? a.title : d.name}」映射的同类机理：<b>${src.title}</b>。下列数据为 ${src.kb} 场景演示口径，非本告警的实测序列。</p><div id="case-fig-host" class="case-fig"></div>${figTimelineHtml(key, "fig-t")}${aiDemoBlock(key)}</section>`;
  }
  if (w && detail.type === "work") {
    const mine = allowed("engineer") && w.ownerId === state.demoPerson,
      supervisor = allowed("supervisor"),
      can = supervisor || mine;
    return `<h3>${w.id} · ${badge(w.status)}</h3><p>负责人：${esc(w.owner || "未分派")} · 当前操作人：${person().name}</p>${can ? `<label for="work-reason">处理依据（必填）</label><textarea id="work-reason"></textarea>${w.status === "待分派" && supervisor ? '<label for="work-owner">分派给</label><select id="work-owner"><option value="engineer">王工</option><option value="engineer2">赵工</option></select>' : ""}${w.status === "待复测" && mine ? '<label for="work-test">复测结论</label><select id="work-test"><option value="">请选择</option><option>通过</option><option>不通过</option></select>' : ""}<div class="toolbar">${(["待分派", "待审批", "待审核"].includes(w.status) && supervisor) || (["待接单", "排查中", "处置中", "待复测"].includes(w.status) && mine) ? wfAction("推进当前工单", `transitionWork('${w.id}','next',${w.version})`, true) : ""}${supervisor && ["待审批", "待审核"].includes(w.status) ? wfAction("退回排查", `transitionWork('${w.id}','reject',${w.version})`) : ""}${supervisor && !["已关闭", "已取消"].includes(w.status) ? wfAction("取消工单", `transitionWork('${w.id}','cancel',${w.version})`) : ""}${supervisor && ["已关闭", "已取消"].includes(w.status) ? wfAction("重开工单", `transitionWork('${w.id}','reopen',${w.version})`) : ""}</div>` : "<p>当前身份只读。执行人只能处理分派给本人的工单，验收由主管完成。</p>"}`;
  }
  if (!a) return "<p>无关联事件。可在监测证据中查阅此设备全部测点。</p>";
  return `<h3>${a.id} · ${badge(a.status)}</h3><p>接管只改变处理状态，不表示异常恢复。</p>${a.work ? wfAction("查看关联工单", `workDetail('${a.work}')`) : ""}${allowed("operator", "supervisor") ? `<label for="alarm-reason">操作依据（必填）</label><textarea id="alarm-reason"></textarea><div class="toolbar">${a.status === "待确认" && allowed("operator") ? wfAction("确认告警", `ackAlarm('${a.id}')`, true) : ""}${!a.work && a.status === "已确认" && allowed("operator", "supervisor") ? wfAction("创建待分派工单", `createWork('${a.id}')`, true) : ""}${wfAction("升级等级", `escalateAlarm('${a.id}')`)}${allowed("supervisor") ? wfAction("抑制 15 分钟", `suppressAlarm('${a.id}')`) : ""}</div>` : "<p>由值班监控人员接管后转工单，主管审核分派。</p>"}`;
}
// ———————————————————— 机理示意（iso-*.js 等距剖视，数据来自 CASES）————————————————————
const CASE_FIGURE = { cooling: "AcFigure", battery: "BattFigure", capacity: "PduFigure", energy: "EnergyFigure", ups: "UpsFigure", dg: "DgFigure", th: "ThFigure" };
// 新图复用既有 CASE 数据做驱动：ups ← 容量场景（负载率%）、dg ← 电池场景（数值按 V 呈现）
const FIG_MODEL = { ups: "capacity", dg: "battery" };
function figCase(key) {
  const base = cs(FIG_MODEL[key] || key) || {};
  if (key === "dg") return { ...base, unit: "V", metric: "启动蓄电池电压" };
  if (key === "ups") return { ...base, metric: "UPS 负载率" };
  if (key === "th") return { title: "S0 · 温湿度传感站", metric: "环境温度", unit: "°C", kb: "KB-TH-01", device: "HC-BJ-005", series: [25, 25.2, 25.4, 25.3, 25.1, 25], after: [25, 25.1, 25, 25.1, 25, 25], threshold: 30, temp: 25, hum: 46, alarmT: 30, alarmH: 80 };
  return base;
}
let figCtrl = null,
  figState = { index: null, recovered: false };
function figCaseModel(key) {
  const c = figCase(key),
    live = figState.recovered && c.after?.length ? c.after : c.series || [];
  return { ...c, index: figState.index == null ? live.length - 1 : figState.index, recovered: !!figState.recovered, recoveredValue: key === "dg" ? 27.2 : c.recoveredValue };
}
function figSync(id) {
  const el = $("#case-fig-host");
  if (!el || !CASE_FIGURE[id] || !globalThis[CASE_FIGURE[id]]) return;
  const m = figCaseModel(id);
  if (figCtrl) figCtrl.set(m);
  else figCtrl = globalThis[CASE_FIGURE[id]].mount(el, m);
  document.querySelectorAll("[data-fig-t]").forEach((b) => b.classList.toggle("active", !figState.recovered && +b.dataset.figT === figState.index));
  document.querySelectorAll("[data-fig-rec]").forEach((b) => b.classList.toggle("active", !!figState.recovered));
}
function figStep(id, i) {
  stopFigAuto();
  figState = { index: i, recovered: false };
  figSync(id);
}
function figRecover(id) {
  stopFigAuto();
  figState = { index: null, recovered: true };
  figSync(id);
}
// 自动回放：按时间窗逐帧播放异常发展 → 维护后复测态（纯演示动效，固定节奏，非 AI 推理）
let figAutoTimer = 0,
  figAutoKey = null;
function stopFigAuto() {
  if (figAutoTimer) {
    clearTimeout(figAutoTimer);
    figAutoTimer = 0;
  }
  figAutoKey = null;
  const b = document.querySelector("[data-fig-auto]");
  if (b) b.style.display = "none";
}
function figAutoPlay(key) {
  stopFigAuto();
  const c = figCase(key),
    n = c.series.length;
  figAutoKey = key;
  const badge = document.querySelector("[data-fig-auto]");
  if (badge) badge.style.display = "";
  let i = 0;
  figState = { index: 0, recovered: false };
  figSync(key);
  const step = () => {
    if (figAutoKey !== key) return;
    i++;
    if (i < n) {
      figState = { index: i, recovered: false };
      figSync(key);
      figAutoTimer = setTimeout(step, 1100);
    } else {
      figState = { index: null, recovered: true };
      figSync(key);
      figAutoTimer = setTimeout(() => stopFigAuto(), 1200);
    }
  };
  figAutoTimer = setTimeout(step, 1100);
}
function figAutoBar(key) {
  return `<div class="toolbar"><button class="small" onclick="figAutoPlay('${key}')">▶ 自动回放</button><span data-fig-auto class="badge info" style="display:none">回放中…</span></div>`;
}
function figTeardown() {
  stopFigAuto();
  if (figCtrl) {
    figCtrl.destroy();
    figCtrl = null;
  }
  figState = { index: null, recovered: false };
}

// ———————————— 场景演示页（首页固定规则入口迁至此处，管理员「服务与知识」菜单）————————————
// 注意：modules.push 放在 ai-ui.js 的 evaluation 之后，保证入口落在独立评测旁同组；
// 此处只注册视图与权限，导航顺序由 push 时机决定。
subtitles.scenarios =
  "S1–S4 故障机理等距剖视回放：动画、表计与 AI 演示基线共用同一份场景数据，人工交互不产生设备控制。";
for (const id of ["admin", "analyst", "supervisor"]) PEOPLE[id].pages.push("scenarios");
let scenarioId = "cooling",
  scenFigCtrl = null,
  scenFigHostEl = null,
  scenFigState = { index: null, recovered: false };
function scenModel(key) {
  const c = figCase(key),
    live = scenFigState.recovered && c.after?.length ? c.after : c.series || [];
  return { ...c, index: scenFigState.index == null ? live.length - 1 : scenFigState.index, recovered: !!scenFigState.recovered };
}
function scenarioPick(id) {
  scenarioId = id;
  scenFigState = { index: null, recovered: false };
  render();
}
function scenStep(i) {
  scenFigState = { index: i, recovered: false };
  scenFigSync();
}
function scenRecover() {
  scenFigState = { index: null, recovered: true };
  scenFigSync();
}
function scenFigSync() {
  const el = $("#scenario-fig-host");
  if (!el) return;
  // render() 重建 DOM 后旧挂载点已失效：控制器宿主元素变了就先销毁再挂载
  if (scenFigCtrl && scenFigHostEl !== el) scenFigTeardown();
  const m = scenModel(scenarioId);
  if (scenFigCtrl) scenFigCtrl.set(m);
  else {
    scenFigCtrl = globalThis[CASE_FIGURE[scenarioId]].mount(el, m);
    scenFigHostEl = el;
  }
  document.querySelectorAll("[data-scen-t]").forEach((b) => b.classList.toggle("active", !scenFigState.recovered && +b.dataset.scenT === scenFigState.index));
  document.querySelectorAll("[data-scen-rec]").forEach((b) => b.classList.toggle("active", !!scenFigState.recovered));
}
function scenFigTeardown() {
  if (scenFigCtrl) {
    scenFigCtrl.destroy();
    scenFigCtrl = null;
  }
  scenFigHostEl = null;
  scenFigState = { index: null, recovered: false };
}
function figTimelineHtml(key, attr) {
  const c = figCase(key);
  return `<div class="toolbar fig-timeline">${c.series.map((_, i) => `<button class="small" data-${attr}="${i}" onclick="${attr === "scen-t" ? `scenStep(${i})` : `figStep('${key}',${i})`}">T${i + 1}</button>`).join("")}<button class="small" data-${attr === "scen-t" ? "scen-rec" : "fig-rec"}="1" onclick="${attr === "scen-t" ? "scenRecover()" : `figRecover('${key}')`}">复测通过</button></div>`;
}
views.scenarios = () => {
  const c = cs(scenarioId),
    r = jr(scenarioId);
  return (
    `<section class="card decision-highlights">${head("场景演示 · 故障机理与 AI 指标", badge("固定规则演示"))}<p>四个合成场景各配一张等距机理剖视：动画、表计与告警灯由同一份场景数据驱动。下方「AI 演示基线」用固定算法说明 R08–R11 招标指标的统计口径，不伪造真实模型成绩。</p><div class="highlight-grid">${Object.keys(CASES).map((id) => `<button class="${id === scenarioId ? "active" : ""}" onclick="scenarioPick('${id}')"><small>${cs(id).tag} · ${stageLabel[jr(id).stage]}</small><b>${cs(id).title}</b><span>${cs(id).kb} · ${cs(id).horizon}</span></button>`).join("")}</div></section>` +
    `<section class="card">${head(c.title, badge(stageLabel[r.stage]))}<p>${c.subtitle}。影响：${c.impact}；${c.window}。</p><div id="scenario-fig-host" class="case-fig"></div>${figTimelineHtml(scenarioId, "scen-t")}${aiDemoBlock(scenarioId)}<div class="toolbar">${wfAction("在工单抽屉查看完整处置流程", `openCase('${scenarioId}','overview')`, true)}</div><div class="split-note">${c.risk}</div></section>`
  );
};

// ———————————— AI 演示基线：固定算法说明 R08–R11 指标口径（非真实模型成绩）————————————
function aiDemoBlock(key) {
  return `<h3>AI 模型性能指标 · R08–R11</h3><p>以固定算法演示基线在「${figCase(key).metric}」序列上现场计算，展示各指标的统计口径与阈值含义；<b>「实测」列可直接编辑</b>——代入你自己的窗口观测值，基线会实时重算指标。点「用已配置模型预测」会让真实大模型以前半程窗口为上下文预测后半程（显式调用、可能产生费用），与基线并排对照；成绩口径以「独立评测」页为准，本演示不伪造指标。</p><div class="toolbar"><button class="small" onclick="aiDemoRun('${key}')">运行 AI 演示基线</button><button class="small" onclick="aiModelPredict('${key}')">用已配置模型预测（真实调用）</button><span data-ai-model-status class="badge info" style="display:none"></span></div><div id="ai-demo-out" class="ai-demo-out"><div class="empty">尚未运行。点击上方按钮，用固定算法（滚动一步外推 + 结构化元组匹配）演示指标口径。</div></div>`;
}
function aiDemoCompute(s) {
  const preds = s.map((_, i) => (i < 2 ? null : s[i - 1] + (s[i - 1] - s[i - 2]))),
    pairs = s.map((a, i) => [a, preds[i]]).filter((p) => p[1] != null),
    mean = pairs.reduce((x, p) => x + p[0], 0) / pairs.length,
    ssRes = pairs.reduce((x, p) => x + (p[0] - p[1]) ** 2, 0),
    ssTot = pairs.reduce((x, p) => x + (p[0] - mean) ** 2, 0),
    r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0,
    mae = pairs.reduce((x, p) => x + Math.abs(p[0] - p[1]), 0) / pairs.length;
  return { preds, pairs, r2, mae };
}
function aiDemoErrPct(c, s, mae) {
  return c.unit === "kW"
    ? (mae / (s.reduce((x, v) => x + v, 0) / s.length)) * 100
    : c.unit === "°C"
      ? (mae / 20) * 100
      : (mae / 40) * 100;
}
function aiDemoErrLabel(c) {
  return c.unit === "kW" ? "R10 能耗 WAPE" : c.unit === "°C" ? "R09 误差（MAE/20°C 量程）" : "R09 误差（MAE/40V 量程）";
}
function aiDemoChips(c, r2, errPct) {
  const chip = (pass, label, got, target) =>
    `<span class="ai-chip ${pass ? "pass" : "miss"}"><b>${label}</b> ${got}<small>目标 ${target}</small></span>`;
  return `${chip(r2 > 0.97, "R08 预测 R²", r2.toFixed(3), "&gt; 0.97")}${chip(errPct < 5, aiDemoErrLabel(c), errPct.toFixed(2) + "%", "&lt; 5%")}${chip(true, "R11 语义匹配", "100%", "≥ 94%")}`;
}
function aiDemoRun(key) {
  const c = figCase(key),
    s = c.series,
    out = $("#ai-demo-out");
  if (!out) return;
  const m = aiDemoCompute(s),
    errPct = aiDemoErrPct(c, s, m.mae);
  const k = WF_KNOWLEDGE[c.kb],
    tuple = [
      ["sourceId", c.kb],
      ["family", dev(c.device).type],
      ["model", dev(c.device).model],
      ["version", k.version.split(" ")[0]],
      ["reasonCode", c.event],
    ];
  out.innerHTML =
    `<div class="ai-chips" id="ai-chips">${aiDemoChips(c, m.r2, errPct)}</div>` +
    table(
      ["窗口", "实测（可编辑）", "基线预测", "误差"],
      m.pairs.map((p, j) => {
        const i = j + 2;
        return `<tr><td>T${i + 1}</td><td><input class="ai-act" data-ai-act="${i}" type="number" step="any" value="${p[0]}" oninput="aiDemoRecompute('${key}')" aria-label="T${i + 1} 实测值"></td><td data-ai-p="${i}">${p[1].toFixed(1)}${c.unit}</td><td data-ai-e="${i}">${Math.abs(p[0] - p[1]).toFixed(1)}${c.unit}</td></tr>`;
      }),
    ) +
    `<p class="split-note">R11 演示口径：告警 → 知识条目的结构化元组 exact 匹配 ${tuple.map((t) => `${t[0]}=${t[1]}`).join(" · ")}，5/5 一致 = 100%。非法/留空的实测输入按场景默认值计。基线算法未达标的项表明该类指标需要真实模型与独立冻结测试集，见「独立评测」。</p>`;
}
// 实测列被编辑时只增量重算（不重建输入框，保住焦点），实时刷新指标与预测/误差列
function aiDemoRecompute(key) {
  const c = figCase(key),
    s = c.series.map((v, i) => {
      const el = document.querySelector(`[data-ai-act="${i}"]`);
      if (!el) return v;
      const n = parseFloat(el.value);
      return Number.isFinite(n) ? n : v;
    }),
    m = aiDemoCompute(s),
    errPct = aiDemoErrPct(c, s, m.mae);
  const chips = $("#ai-chips");
  if (chips) chips.innerHTML = aiDemoChips(c, m.r2, errPct);
  m.preds.forEach((p, i) => {
    if (p == null) return;
    const pc = document.querySelector(`[data-ai-p="${i}"]`),
      ec = document.querySelector(`[data-ai-e="${i}"]`);
    if (pc) pc.textContent = p.toFixed(1) + c.unit;
    if (ec) ec.textContent = Math.abs(s[i] - p).toFixed(1) + c.unit;
  });
}
// —— 真实模型预测：/api/predict 显式调用用户已配置的大模型；未配置时明确提示，不回退伪造 ——
async function figAiPost(path, body) {
  const s = await (await fetch("/api/session", { credentials: "same-origin" })).json();
  const r = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": s.csrfToken },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await r.json();
  } catch {}
  if (!r.ok) {
    const e = new Error((data && data.error && (data.error.message || data.error)) || `服务错误 ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return data;
}
async function aiModelPredict(key) {
  const c = figCase(key),
    n = c.series.length,
    half = Math.max(2, Math.ceil(n / 2)),
    prefix = c.series.slice(0, half),
    targets = n - half;
  const status = document.querySelector("[data-ai-model-status]"),
    setStatus = (t, bad) => {
      if (!status) return;
      status.style.display = t ? "" : "none";
      status.textContent = t || "";
      status.className = "badge " + (bad ? "warn" : "info");
    };
  setStatus("模型预测中…（真实调用，可能产生费用）");
  try {
    const out = await figAiPost("/api/predict", {
      prefix,
      targets,
      unit: c.unit,
      context: `动环演示场景「${c.title || c.metric}」：前 ${half} 个时间窗为已知观测，请预测后续 ${targets} 个窗口的${c.metric}。`,
    });
    aiModelRender(key, out);
    setStatus(`模型预测完成 · ${out.model || "已配置模型"}`);
    setTimeout(() => setStatus(""), 5000);
  } catch (e) {
    const unconfigured = e.status === 409 || /NOT_CONFIGURED|未配置/.test(e.message);
    setStatus(unconfigured ? "未配置模型：请到「接入配置」页填写 API 后重试（当前仅固定基线）" : "模型调用失败：" + e.message, true);
  }
}
function aiModelRender(key, out) {
  const c = figCase(key),
    preds = out.result.predictions,
    s = c.series,
    half = Math.max(2, Math.ceil(s.length / 2)),
    // 模型成绩：以后半程实测为基准算 R² 与误差
    pairs = preds.map((p, j) => [s[half + j], p]),
    mean = pairs.reduce((x, p) => x + p[0], 0) / pairs.length,
    ssRes = pairs.reduce((x, p) => x + (p[0] - p[1]) ** 2, 0),
    ssTot = pairs.reduce((x, p) => x + (p[0] - mean) ** 2, 0),
    r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0,
    mae = pairs.reduce((x, p) => x + Math.abs(p[0] - p[1]), 0) / pairs.length;
  const head = document.querySelector("#ai-demo-out thead tr");
  if (head && !head.querySelector("[data-ai-mh]")) {
    const th = document.createElement("th");
    th.setAttribute("data-ai-mh", "1");
    th.textContent = "模型预测";
    head.insertBefore(th, head.children[2]);
  }
  const rows = document.querySelectorAll("#ai-demo-out tbody tr");
  rows.forEach((tr, j) => {
    tr.querySelector("[data-ai-m]")?.remove();
    const i = j + 2, // 该行实测索引：模型只预测上下文（前 half 窗）之后的窗口
      p = i >= half ? preds[i - half] : null;
    const td = document.createElement("td");
    td.setAttribute("data-ai-m", String(j));
    td.textContent = Number.isFinite(p) ? Number(p).toFixed(1) + c.unit : "—";
    tr.insertBefore(td, tr.children[2]);
  });
  let mchips = document.getElementById("ai-model-chips");
  if (!mchips) {
    mchips = document.createElement("div");
    mchips.id = "ai-model-chips";
    mchips.className = "ai-chips";
    document.getElementById("ai-chips")?.after(mchips);
  }
  const chip = (pass, label, got, target) =>
    `<span class="ai-chip ${pass ? "pass" : "miss"}"><b>${label}</b> ${got}<small>目标 ${target}</small></span>`;
  const errPct = aiDemoErrPct(c, s, mae);
  mchips.innerHTML =
    `<span class="badge info">模型成绩（后半程 ${preds.length} 窗）</span>` +
    chip(r2 > 0.97, "R08 预测 R²", r2.toFixed(3), "&gt; 0.97") +
    chip(errPct < 5, c.unit === "kW" ? "R10 能耗 WAPE" : "R09 误差", errPct.toFixed(2) + "%", "&lt; 5%");
  let note = document.getElementById("ai-model-note");
  if (!note) {
    note = document.createElement("p");
    note.id = "ai-model-note";
    note.className = "split-note";
    mchips.after(note);
  }
  note.textContent = `模型依据：${out.result.reason}（${out.model || "模型"} · 用量 ${out.usage?.total_tokens ?? "?"} tokens · ${out.durationMs ?? "?"} ms）。协议：模型以前 ${half} 窗为上下文一次性外推后 ${preds.length} 窗；基线为滚动一步外推（逐窗用实测修正），两者信息量不同，成绩仅作口径演示。`;
}

// ———————————— WebGL 3D 数字孪生机房（资产页：漫游 + 点击进机理示意）————————————
let twinCtrl = null,
  twinHostEl = null,
  twinLastSite = null;
function twinDevices() {
  return state.devices.map((d) => {
    const alarm = state.alarms.find((a) => a.device === d.id && a.status !== "已关闭");
    return { ...d, alarm: !!alarm, alarmTitle: alarm ? alarm.title : "" };
  });
}
function twinSync() {
  const el = $("#twin3d-host");
  if (!el || !globalThis.Twin3d) return;
  if (twinCtrl && twinHostEl !== el) twinTeardown();
  if (!twinCtrl) {
    twinCtrl = Twin3d.mount(el, { devices: twinDevices(), onSelect: (id) => openEntity("asset", id, "figure", { plain: true }) });
    twinHostEl = el;
    window.DEMO = window.DEMO || {};
    window.DEMO.twin = twinCtrl;
  } else twinCtrl.setDevices(twinDevices());
  // 只在站点模式切换时瞬移，避免打断用户漫游
  if (state.site !== twinLastSite) {
    twinCtrl.teleport(state.site === "all" ? "all" : state.site);
    twinLastSite = state.site;
  }
}
function twinTeardown() {
  if (twinCtrl) {
    twinCtrl.destroy();
    twinCtrl = null;
  }
  twinHostEl = null;
  twinLastSite = null;
}
function twinGo(site) {
  state.site = site;
  save();
  render();
}
function twin3dCard() {
  return `<section class="card twin3d-card">${head("动力机房数字孪生", badge("3D 示意"))}<p>三个站点大厅按真实布局口径示意（每厅 A/B 两个动力机房，各 6 类设备）；点击进入场景后：点击锁定鼠标漫游（360° 视角、WASD 移动、Q/E 升降、Esc 退出），<b>点击任意设备飞到其跟前并打开该设备的机理示意</b>。布局与模型为演示口径。</p><div class="toolbar twin3d-bar">${["all", ...SITES].map((s) => `<button class="small ${state.site === s ? "active" : ""}" onclick="twinGo('${s}')">${s === "all" ? "全部站点" : s}</button>`).join("")}<span class="twin-legend"><i class="lg ok"></i>正常<i class="lg alarm"></i>活动告警<i class="lg off"></i>离线</span></div><div id="twin3d-host"></div></section>`;
}
// 机理示意 tab 顶部的活动告警横幅（有未闭环告警时显示）
function figAlarmBanner(a) {
  if (!a || a.status === "已关闭") return "";
  return `<p class="alarm-banner">⚠ 该设备当前存在活动告警：${badge(a.severity)} <b>${esc(a.title)}</b>（${a.id} · ${a.status}）${wfAction("查看告警", `alarmDetail('${a.id}')`)}</p>`;
}
const baseAssetsView = views.assets;
views.assets = () => twin3dCard() + baseAssetsView();

// ———————————— 实时监控重构：左曲线多序列叠加 + 右机理图 + 时间筛选 + CSV 导出 ————————————
const MON_FIG_KEY = { 精密空调: "cooling", 蓄电池组: "battery", UPS: "ups", 配电柜: "capacity", 柴油发电机: "dg", 温湿度传感器: "th" };
let monSel = [],
  monRange = "today",
  monCustom = null,
  monLastDevice = null,
  monFigCtrl = null,
  monFigHostEl = null;
const MON_NOW = () => Date.UTC(2026, 9, 17, 1, 45) + state.tick * 300000;
function monRangeMs() {
  const now = MON_NOW();
  if (monRange === "custom" && monCustom) return monCustom;
  if (monRange === "today") {
    const day = new Date(now + 8 * 3600e3);
    return [Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - 8 * 3600e3, now];
  }
  const d = { "3d": 3, "7d": 7, "30d": 30 }[monRange] || 1;
  return [now - d * 864e5, now];
}
function monInterval(range) {
  const h = range / 36e5;
  if (h <= 26) return 6e5; // 10 分钟
  if (h <= 96) return 18e5; // 30 分钟
  if (h <= 240) return 72e5; // 2 小时
  return 216e5; // 6 小时
}
function monNumericPoints(d) {
  return points(d)
    .map((p, i) => ({ ...p, idx: i, num: typeof p.value === "number" ? p.value : NaN }))
    .filter((p) => Number.isFinite(p.num));
}
function monSeriesAt(p, t, d) {
  const k = p.idx + (d.id.charCodeAt(3) || 0) + (d.id.charCodeAt(6) || 0);
  return p.num * (1 + 0.045 * Math.sin(t / 7.2e6 + k * 1.31) + 0.012 * Math.sin(t / 8.64e7 + k));
}
function monChartSvg() {
  const d = dev(selectedDevice),
    vis = monNumericPoints(d).filter((p) => monSel.includes(p.id)),
    [from, to] = monRangeMs(),
    step = monInterval(to - from),
    n = Math.max(2, Math.min(160, Math.round((to - from) / step) + 1)),
    ts = Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1)),
    PAL = ["#4b7ae5", "#159883", "#dc9860", "#8f6fd8", "#d8708a", "#5aa3c9"];
  if (!vis.length) return `<div class="empty" style="padding:60px 0">在下表「操作」列点击「显示」，把指标趋势叠加到曲线。</div>`;
  const all = vis.flatMap((p) => ts.map((t) => monSeriesAt(p, t, d))),
    lo = Math.min(...all),
    hi = Math.max(...all),
    span = hi - lo || 1,
    X = (t) => 46 + ((t - from) / (to - from)) * 560,
    Y = (v) => 380 - ((v - lo) / span) * 350,
    fmt = (t) => new Date(t + 8 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
  const grid = [0, 1, 2, 3]
    .map((i) => { const y = 30 + i * 88; return `<line x1="46" x2="606" y1="${y}" y2="${y}" stroke="#edf1f7"/><text x="2" y="${y + 4}" font-size="10">${(hi - (span * i) / 3).toFixed(1)}</text>`; })
    .join("");
  const lines = vis
    .map((p, j) => `<polyline points="${ts.map((t) => `${X(t).toFixed(1)},${Y(monSeriesAt(p, t, d)).toFixed(1)}`).join(" ")}" fill="none" stroke="${PAL[j % 6]}" stroke-width="2.2"/>`)
    .join("");
  const area = `<polygon points="46,380 ${ts.map((t) => `${X(t).toFixed(1)},${Y(monSeriesAt(vis[0], t, d)).toFixed(1)}`).join(" ")} 606,380" fill="${PAL[0]}" opacity="0.08"/>`;
  const lbl = [0, 0.5, 1].map((k) => `<text x="${Math.max(2, 46 + 560 * k - 22)}" y="416" font-size="10">${fmt(from + (to - from) * k)}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 640 440" preserveAspectRatio="xMidYMid meet" role="img" aria-label="测点趋势曲线">${grid}${area}${lines}${lbl}<text x="440" y="16" font-size="10" fill="#93a3bd">北京时间 UTC+08 · 合成场景</text></svg><div class="legend">${vis.map((p, j) => `<span><i style="background:${PAL[j % 6]}"></i>${esc(p.name)}</span>`).join("")}</div>`;
}
// 机理图模型：按设备类型映射，数值取自该设备当前测点（演示口径）
function monFigModel(d) {
  const key = MON_FIG_KEY[d.type];
  if (!key) return null;
  const pts = points(d),
    num = (name) => { const p = pts.find((x) => x.name === name); return typeof p?.value === "number" ? p.value : null; },
    drift = Array.from({ length: 6 }, (_, i) => 1 + 0.03 * Math.sin(i * 1.7 + d.id.length)),
    s6 = (base) => drift.map((k) => +(base * k).toFixed(1));
  if (key === "cooling") {
    const t = num("回风温度") ?? 26,
      dp = Math.max(70, num("滤网压差") ?? 78);
    return { series: s6(t), after: s6(t), threshold: 28, dpFrom: 70, dpTo: dp, loadFrom: 55, loadTo: 60, index: 5 };
  }
  if (key === "battery") { const cap = num("估算容量") ?? 92; return { series: s6(Math.max(0, 100 - cap)), after: s6(Math.max(0, 100 - cap)), threshold: 25, index: 5 }; }
  if (key === "ups") { const l = num("负载率") ?? d.load; return { series: s6(l), after: s6(l), threshold: 85, planned: 10, index: 5 }; }
  if (key === "capacity") return { series: s6(d.load ?? 60), after: s6(d.load ?? 60), threshold: 85, planned: 10, index: 5 };
  if (key === "dg") return { series: [24.2, 24.0, 23.9, 24.1, 24.3, 24.2], after: [26.8, 26.9, 27, 27, 26.9, 27], threshold: 20, index: 5, recoveredValue: 27 };
  if (key === "th") return { temp: num("环境温度") ?? d.temp ?? 25, hum: num("相对湿度") ?? 46, alarmT: 30, alarmH: 80, index: 5 };
  return null;
}
function monSync() {
  const host = $("#mon-fig-host");
  if (!host) return;
  const d = dev(selectedDevice),
    key = MON_FIG_KEY[d.type];
  if (monFigHostEl !== host) {
    if (monFigCtrl) monFigCtrl.destroy();
    monFigCtrl = null;
    monFigHostEl = host;
  }
  if (!key) {
    if (monFigCtrl) { monFigCtrl.destroy(); monFigCtrl = null; }
    host.innerHTML = `<div class="empty" style="padding:44px 14px">温湿度传感器为无机构件，暂无机理示意图。</div>`;
    return;
  }
  const m = monFigModel(d);
  if (monFigCtrl) monFigCtrl.set(m);
  else monFigCtrl = globalThis[CASE_FIGURE[key]].mount(host, m);
}
function monToggle(id) {
  monSel = monSel.includes(id) ? monSel.filter((x) => x !== id) : [...monSel, id];
  render();
}
function monSetRange(r) {
  monRange = r;
  if (r !== "custom") monCustom = null;
  render();
}
function monApplyCustom() {
  const f = document.getElementById("mon-from")?.value,
    t = document.getElementById("mon-to")?.value;
  if (!f || !t) return toast("请选择完整的起止时间");
  const from = Date.parse(f + ":00+08:00"),
    to = Date.parse(t + ":00+08:00");
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return toast("结束时间须晚于开始时间");
  monRange = "custom";
  monCustom = [from, to];
  render();
}
function monExport() {
  const d = dev(selectedDevice),
    [from, to] = monRangeMs(),
    step = monInterval(to - from),
    n = Math.max(2, Math.min(160, Math.round((to - from) / step) + 1)),
    ts = Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1)),
    vis = monNumericPoints(d).filter((p) => monSel.includes(p.id));
  if (!vis.length) return toast("请先在测点快照中「显示」至少一条曲线");
  const rows = [
    ["时间(+08)", ...vis.map((p) => `${p.name}(${p.unit})`)],
    ...ts.map((t) => [new Date(t + 8 * 3600e3).toISOString().slice(0, 16).replace("T", " "), ...vis.map((p) => monSeriesAt(p, t, d).toFixed(2))]),
  ];
  download(`监控曲线_${d.id}.csv`, csv(rows), "text/csv;charset=utf-8");
}
function monView() {
  const d = dev(selectedDevice);
  if (monLastDevice !== d.id) {
    const first = monNumericPoints(d)[0]?.id;
    monSel = first ? [first] : [];
    monLastDevice = d.id;
    if (monFigCtrl) { monFigCtrl.destroy(); monFigCtrl = null; monFigHostEl = null; }
  }
  const [from, to] = monRangeMs(),
    dt = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 16),
    rangeBtns = [["today", "今日"], ["3d", "近3日"], ["7d", "近7日"], ["30d", "近30日"]]
      .map(([k, l]) => `<button class="small ${monRange === k ? "active" : ""}" onclick="monSetRange('${k}')">${l}</button>`)
      .join("");
  return `<div class="card" style="margin-bottom:16px">${head("实时监控 · 测点趋势", `<span class="subtext">${d.id} · ${esc(d.name)} · ${esc(d.type)}</span>`)}
    <div class="toolbar mon-bar"><select aria-label="设备选择" onchange="selectedDevice=this.value;render()">${filteredDevices().map((x) => `<option value="${x.id}" ${selectedDevice === x.id ? "selected" : ""}>${x.id} · ${esc(x.name)}</option>`).join("")}</select><span class="mon-lab">时间</span>${rangeBtns}<input id="mon-from" type="datetime-local" value="${dt(from)}" aria-label="开始时间"><span class="mon-lab">至</span><input id="mon-to" type="datetime-local" value="${dt(to)}" aria-label="结束时间"><button class="small" onclick="monApplyCustom()">应用</button><button class="small" onclick="monExport()">↓ 导出曲线 CSV</button></div>
    <div class="mon-split"><div class="mon-chart">${monChartSvg()}</div><div class="mon-fig"><h4>设备机理示意 <span class="badge info">演示口径</span></h4><div id="mon-fig-host" class="case-fig"></div></div></div>
    <div class="split-note">所有值为合成场景。状态量测点不参与曲线叠加；右侧机理图按设备类型映射，序列取自该设备当前测点（演示口径）。</div></div>
    <div class="card">${head("测点快照", `<span class="subtext">${points(d).length} 个测点 · 操作列可叠加曲线</span>`)}${table(
      ["测点 ID", "指标", "当前值", "单位", "数据质量", "源时间", "操作"],
      points(d).map((p) => {
        const numeric = typeof p.value === "number",
          on = monSel.includes(p.id);
        return `<tr><td>${p.id}</td><td>${esc(p.name)}</td><td><strong>${p.value}</strong></td><td>${esc(p.unit)}</td><td>${badge(p.quality)}</td><td>${p.source_ts}</td><td>${numeric ? `<button class="small mon-tg ${on ? "active" : ""}" onclick="monToggle('${p.id}')">${on ? "隐藏" : "显示"}</button>` : '<span class="subtext">状态量</span>'}</td></tr>`;
      }),
    )}</div>`;
}

// ———————————— 告警/资产 → 机理图映射：设备类型优先，同类机理不再错配 ————————————
function genericFigKey(d, a) {
  // 设备类型优先：设备视图始终显示设备本身的机理图；告警只决定横幅与数据故事
  //（能耗循环等场景化机理保留在 S4 场景/案例抽屉中呈现）
  if (d.type === "精密空调") return "cooling";
  if (d.type === "蓄电池组") return "battery";
  if (d.type === "UPS") return "ups";
  if (d.type === "配电柜") return "capacity";
  if (d.type === "柴油发电机") return "dg";
  if (d.type === "温湿度传感器") return "th";
  return null;
}
assetDetail = (id) => openEntity("asset", id, "overview", { plain: true });
alarmDetail = (id) => openEntity("alarm", id);
workDetail = (id) => openEntity("work", id, "actions");
const nativeAck = ackAlarm,
  nativeCreate = createWork,
  nativeEscalate = escalateAlarm,
  nativeSuppress = suppressAlarm;
ackAlarm = (id) => {
  if (!allowed("operator")) return denied();
  const key = caseForAlarm(id);
  if (key) return wfAck(key, $("#alarm-reason")?.value || $("#wf-note")?.value);
  const result = nativeAck(id),
    a = state.alarms.find((a) => a.id === id);
  if (a?.status === "已确认") {
    a.acknowledgedBy = state.demoPerson;
    a.acknowledgedAt = time();
    save();
  }
  return result;
};
createWork = (id) => {
  if (!allowed("operator", "supervisor")) return denied();
  const key = caseForAlarm(id);
  if (key) {
    openCase(key, "actions");
    return toast("此事件先由诊断人员提交方案，主管审批后自动分派工单");
  }
  const n = state.work.length;
  nativeCreate(id);
  if (state.work.length > n) {
    state.work.at(-1).history[0].actor = person().name;
    save();
  }
  return state.work.length > n;
};
escalateAlarm = (id) =>
  allowed("operator", "supervisor") ? nativeEscalate(id) : denied();
suppressAlarm = (id) => (allowed("supervisor") ? nativeSuppress(id) : denied());
transitionWork = (id, action, version) => {
  const w = state.work.find((w) => w.id === id);
  if (!w || w.journey) return denied();
  if (w.version !== version) return toast("版本已变化，请重新打开工单");
  const supervisor = allowed("supervisor"),
    mine = allowed("engineer") && w.ownerId === state.demoPerson;
  if (!supervisor && !mine) return denied();
  let note = reason("#work-reason");
  if (!note) return false;
  let next;
  if (action === "reopen") {
    if (!supervisor || !["已关闭", "已取消"].includes(w.status))
      return denied();
    next = "待分派";
    w.ownerId = null;
    w.owner = "";
    w.testPassed = false;
  } else if (action === "cancel") {
    if (!supervisor || ["已关闭", "已取消"].includes(w.status)) return denied();
    next = "已取消";
  } else if (action === "reject") {
    if (!supervisor || !["待审批", "待审核"].includes(w.status))
      return denied();
    next = "排查中";
    w.testPassed = false;
  } else if (action === "next") {
    if (w.status === "待分派") {
      const owner = $("#work-owner")?.value;
      if (!supervisor || PEOPLE[owner]?.kind !== "engineer") return denied();
      w.ownerId = owner;
      w.owner = PEOPLE[owner].name;
      next = "待接单";
    } else if (w.status === "待接单" && mine) next = "排查中";
    else if (w.status === "排查中" && mine) next = "待审批";
    else if (w.status === "待审批" && supervisor) next = "处置中";
    else if (w.status === "处置中" && mine) next = "待复测";
    else if (w.status === "待复测" && mine) {
      const test = $("#work-test")?.value;
      if (!["通过", "不通过"].includes(test)) return toast("请填写复测结论");
      w.testPassed = test === "通过";
      w.testActor = state.demoPerson;
      state.alarms.find((a) => a.id === w.alarm).signalState = w.testPassed
        ? "recovered"
        : "active";
      note += "；复测：" + test;
      w.tests = w.tests || [];
      w.tests.push({
        id: `TEST-${w.id}-${w.tests.length + 1}`,
        passed: w.testPassed,
        actor: state.demoPerson,
        time: time(),
        note,
      });
      next = w.testPassed ? "待审核" : "排查中";
    } else if (
      w.status === "待审核" &&
      supervisor &&
      w.testPassed &&
      w.testActor !== state.demoPerson &&
      w.ownerId !== state.demoPerson
    )
      next = "已关闭";
    else return denied();
  } else return false;
  const old = w.status;
  w.status = next;
  w.version++;
  w.history.push({
    time: time(),
    from: old,
    to: next,
    reason: note,
    actor: person().name,
  });
  const a = state.alarms.find((a) => a.id === w.alarm);
  a.status =
    next === "已关闭" ? "已关闭" : next === "已取消" ? "已确认" : "处理中";
  log("工单状态变更", id, `${old} → ${next} / ${note}`);
  render();
  return true;
};
const nativeEditTopology = editTopology,
  nativeAddEdge = addEdge,
  nativeSaveConfig = saveConfig,
  nativeTestConnection = testConnection,
  nativeQualityReview = qualityReview,
  nativeRequestReset = requestReset,
  nativeReset = resetDemo,
  nativeRollback = rollbackModel;
editTopology = () => (allowed("admin") ? nativeEditTopology() : denied());
addEdge = () => (allowed("admin") ? nativeAddEdge() : denied());
saveConfig = () => (allowed("admin") ? nativeSaveConfig() : denied());
testConnection = () => (allowed("admin") ? nativeTestConnection() : denied());
qualityReview = (id) =>
  allowed("admin", "analyst", "engineer") ? nativeQualityReview(id) : denied();
requestReset = () => (allowed("admin") ? nativeRequestReset() : denied());
resetDemo = () => {
  if (!allowed("admin")) return denied();
  closeDetail();
  journeysValidated = false;
  state = SEED();
  state.demoPerson = "admin";
  ensureJourneys();
  wfSync();
  selectedDevice = state.devices[0].id;
  $("#dialog").close();
  save();
  render();
  return true;
};
promoteModel = (id) => {
  const m = state.models.find((m) => m.id === id);
  if (!m) return false;
  if (m.state === "待审批") return approveModel(id);
  if (!allowed("admin")) return denied();
  const next = {
    候选: "影子",
    已回滚: "影子",
    影子: "待审批",
    "灰度 10%": "生产演示",
  }[m.state];
  if (!next) return false;
  if (next === "待审批") m.requestedBy = state.demoPerson;
  m.state = next;
  log("模型发布状态演示", id, next);
  render();
  return true;
};
approveModel = (id) => {
  const m = state.models.find((m) => m.id === id);
  if (
    !allowed("analyst") ||
    !m ||
    m.state !== "待审批" ||
    m.requestedBy === state.demoPerson
  )
    return denied();
  m.approver = person().name;
  m.state = "灰度 10%";
  log("模型灰度审核", id, "当前固定身份：" + person().name);
  render();
  return true;
};
rollbackModel = (id) => (allowed("admin") ? nativeRollback(id) : denied());
views.models = () =>
  `<div class="grid three">${state.models.map((m) => `<section class="card">${head(m.name, badge(m.state))}<h3>${m.id}</h3><p>数据快照 ${m.data}<br>上一版本 ${m.prior}</p><div class="split-note">${m.metric}</div><p>审批人：${esc(m.approver || "尚未审批")}</p><div class="stack">${wfAction("查看模型卡", `modelCard('${m.id}')`)}${allowed("admin") && m.state !== "待审批" ? wfAction("推进发布状态", `promoteModel('${m.id}')`, true) : ""}${allowed("analyst") && m.state === "待审批" ? wfAction("以当前分析人员身份审核", `approveModel('${m.id}')`, true) : ""}${allowed("admin") ? wfAction("回滚演示", `rollbackModel('${m.id}')`) : ""}</div></section>`).join("")}</div><section class="card"><h2>模型发布约束</h2><p>管理员提交，分析人员审核，管理员继续发布。所有动作仅改变本地状态，不加载模型或分流流量。</p></section>`;

const nativeRender = render;
render = () => {
  ensureJourneys();
  wfSync();
  if (!person().pages.includes(page)) page = "overview";
  nativeRender();
  $("#nav").innerHTML = modules
    .filter((m) => person().pages.includes(m[0]))
    .map(
      (m, i) =>
        `${m[2] ? `<div class="nav-group">${m[2]}</div>` : ""}<button title="${m[1]}" class="${page === m[0] ? "active" : ""}" onclick="navigate('${m[0]}')">${icon(i)}<span>${m[1]}</span>${m[0] === "overview" ? `<span class="nav-count">${inboxCount()}</span>` : ""}</button>`,
    )
    .join("");
  $(".header-actions").innerHTML =
    `<span class="demo-tag">身份模拟 · 非权限认证</span><label class="sr-only" for="role-switch">切换演示人员</label><select id="role-switch" onchange="switchPerson(this.value)">${Object.entries(
      PEOPLE,
    )
      .map(
        ([id, p]) =>
          `<option value="${id}" ${id === state.demoPerson ? "selected" : ""}>${p.name} · ${p.role}</option>`,
      )
      .join("")}</select>`;
  if (state.journeys.recovered)
    $("#content").insertAdjacentHTML(
      "afterbegin",
      '<div class="split-note">旧版联动记录已迁移为岗位协同初始状态；全站资产、配置与普通记录保留。<button class="small" onclick="state.journeys.recovered=false;save();render()">知道了</button></div>',
    );
  if (!allowed("admin"))
    $$("button")
      .filter(
        (b) =>
          b.textContent === "编辑演示关系" ||
          b.textContent === "重置全部演示数据",
      )
      .forEach((b) => (b.disabled = true));
  if (!allowed("admin", "analyst", "engineer"))
    $$("button")
      .filter((b) => b.textContent === "记录复核")
      .forEach((b) => (b.disabled = true));
  if (page === "scenarios") scenFigSync();
  else scenFigTeardown();
  if (page === "assets") twinSync();
  else twinTeardown();
  if (page === "monitor") monSync();
  drawDetail();
};
const viewContexts = {};
function saveViewContext() {
  viewContexts[page] = {
    query,
    filter,
    pageNo,
    selectedDevice,
    scroll: window.scrollY,
  };
}
function switchPerson(id) {
  if (!PEOPLE[id]) return false;
  saveViewContext();
  closeDetail();
  $("#dialog").close();
  state.demoPerson = id;
  save();
  page = "overview";
  query = "";
  filter = "全部";
  pageNo = 1;
  history.replaceState(null, "", "#overview");
  render();
  window.scrollTo(0, 0);
  return true;
}
const nativeNavigate = navigate;
navigate = (p) => {
  if (!views[p] || !person().pages.includes(p)) return denied();
  saveViewContext();
  closeDetail();
  page = p;
  const c = viewContexts[p] || {
    query: "",
    filter: "全部",
    pageNo: 1,
    selectedDevice,
  };
  ({ query, filter, pageNo, selectedDevice } = c);
  history.replaceState(null, "", "#" + p);
  render();
  window.scrollTo(0, c.scroll || 0);
};
function wfGo(p, id = ensureJourneys().active) {
  if (!CASES[id]) return false;
  openCase(
    id,
    {
      monitor: "evidence",
      assistant: "analysis",
      work: "actions",
      health: "evidence",
      knowledge: "analysis",
      assets: "overview",
      alarms: "overview",
    }[p] || "overview",
  );
  return true;
}
function wfSelect(id) {
  return openCase(id);
}
function wfRoute() {
  const match = location.hash.match(
    /^#([a-z]+)(?:\?case=(battery|cooling|energy|capacity))?$/,
  );
  if (!match) return;
  if (views[match[1]] && person().pages.includes(match[1])) navigate(match[1]);
  if (match[2]) openCase(match[2]);
}
window.addEventListener("hashchange", wfRoute);
const nativePoints = points;
points = (d) => {
  const result = nativePoints(d),
    id = d.journeyId;
  if (!id) return result;
  const r = jr(id),
    recovered =
      ["review", "closed"].includes(r.stage) && !!r.tests.at(-1)?.passed;
  const set = (i, name, value, unit) =>
    Object.assign(result[i], {
      name,
      value: r.quality === "缺失" ? "—" : value,
      unit,
      quality: r.quality,
      source_ts:
        (r.tests.at(-1)?.time || "2026-10-17 01:45:00 UTC") +
        " / " +
        d.currentEvidence,
    });
  if (id === "battery") {
    set(0, "电池环境温度", recovered ? 27.8 : 32, "°C");
    set(5, "单体内阻偏离", recovered ? 4 : 31, "%");
  }
  if (id === "cooling") {
    set(0, "回风温度", recovered ? 27 : 31.6, "°C");
    set(4, "机柜进风温度", recovered ? 23.8 : 29.4, "°C");
    set(7, "滤网压差", recovered ? 74 : 145, "Pa");
  }
  if (id === "capacity") set(3, "支路峰值负载率", recovered ? 62 : 84, "%");
  return result;
};
// Decision-support presentation. Uses the existing shared event state and guarded actions.
const DECISION_CONTEXT = {
  battery: {
    comparison:
      "同组中位数偏离 4%，问题单体 31%；同组对照支持优先核查，但未做工况校正。",
    assumption: "相同采样方法与充电工况持续；尚需端子检查和独立仪表复核。",
    gap: "独立内阻复测、端子检查、温度/充电工况校正",
    plans: [
      [
        "优先核实劣化与接触问题，减少带病运行的不确定性",
        "有资质维护人员、独立仪表、原厂报告",
        "主管确认维护窗口与备用能力后实施",
        "异常即停止检查，保持原运行方式并升级现场负责人",
      ],
      [
        "短期降低新增负载影响，但不能消除潜在劣化",
        "值班人员、加密巡检记录",
        "专项检查前的临时观察期，复核时间由主管确定",
        "趋势继续恶化时结束观察，升级专项检查",
      ],
    ],
  },
  cooling: {
    comparison:
      "同窗口 IT 负载 61%→62%，温度 23.2→29.4°C；这是关联对照，无独立同类机组样本。",
    assumption:
      "负载与环境近似不变、气流受阻持续；约 33°C 仅固定趋势外推，不含统计置信区间。",
    gap: "多点温度、风机/气流实测、现场滤网状态",
    plans: [
      [
        "核实气流与滤网原因；维护效果必须经复测验证",
        "有资质制冷维护人员、多点温度仪、现场记录",
        "先确认冗余制冷与现场维护规程",
        "温度继续恶化时停止维护并按现场应急规程升级",
      ],
      [
        "优先排除测量偏差，短期热风险仍需持续关注",
        "值班/维护人员、多点温度与负载记录",
        "即刻补测，主管确定再次评估时间",
        "达到现场应急条件时结束观察并升级处理",
      ],
    ],
  },
  capacity: {
    comparison:
      "原支路峰值 84% 对比自定演示规划线 85%；暂无备用支路原始基线，不能声称同类比较完整。",
    assumption:
      "新增 12 个百分点与原峰值同时出现，口径一致；额定容量、功率因数和失效转供仍待核验。",
    gap: "额定容量、计量倍率、备用支路基线、A/B 路失效工况报告",
    plans: [
      [
        "避免在资料不足时投产，代价是扩容进度推迟",
        "容量规划人员、额定容量/计量/冗余资料",
        "扩容投产前完成复核，日期由主管决定",
        "复核不通过则保持原负载计划，不实施扩容",
      ],
      [
        "降低原支路压力，但目标支路与上级容量必须复核",
        "电气专业人员、变更审批、备用支路与转供报告",
        "仅在批准变更窗口按现场规程执行",
        "目标容量或冗余不满足即撤销计划，恢复审批前方案",
      ],
    ],
  },
};
DECISION_CONTEXT.energy = {
  comparison:
    "IT 负载 62±1%、室外 28±0.5°C 下输入功率 12→18 kW；数据均为合成样本。",
  assumption:
    "负载、天气、运行台数、计量倍率和时间窗口可比；温度 SLA 保持不变。",
  gap: "独立电表核验、室外温湿度、运行台数与优化后完整同工况窗口",
  plans: [
    [
      "恢复换热效率，但节能效果待测",
      "制冷工程师、同工况测量记录",
      "主管批准维护窗口及热安全约束",
      "温度越限立即停止优化并恢复已审批基线",
    ],
    [
      "避免无依据调整，短期高能耗可能持续",
      "校准仪表、值班与维护人员",
      "补全可比窗口后再次审批",
      "工况不匹配则拒绝节能结论",
    ],
  ],
};
function decisionStage(id) {
  const s = jr(id).stage;
  return ["discovered", "acknowledged"].includes(s)
    ? 0
    : ["requested", "rejected"].includes(s)
      ? 1
      : ["analyzed", "deferred", "dispatch", "assigned", "executing"].includes(
            s,
          )
        ? 2
        : 3;
}
function decisionGap(id) {
  const r = jr(id);
  if (r.quality !== "有效")
    return `输入${r.quality}：林管理员修复质量后，由诊断人员重新核验；禁止据此批准或复测。`;
  return {
    discovered: "待值班核对证据并接管；尚无有效诊断。",
    acknowledged: "待值班提交诊断请求；确认告警不等于恢复。",
    requested: "待分析人员核对来源、竞争假设与缺失证据。",
    rejected: "主管已退回：补充证据并重新提交诊断。",
    analyzed: "待主管比较方案、填写依据并指定执行人。",
    deferred: "方案已暂缓；主管需补齐决策依据后再审批。",
    assigned: "已批准；仅被分派工程师可接单。",
    executing: `待完成 ${cs(id).checks.filter((_, i) => !r.checks[i]).length} 项检查并提交记录。`,
    retest: "待被分派工程师提交有效复测证据。",
    review: "复测已通过，仍待主管独立验收。",
    closed: "已验收并回写本地案例；经验须复核后才能推广。",
  }[r.stage];
}
function decisionRail(id) {
  const r = jr(id),
    active = decisionStage(id),
    labels = ["发现与证据", "AI 辅助分析", "人工决策与执行", "复测与回写"],
    tabs = ["evidence", "analysis", "actions", "evidence"];
  return `<section class="decision-path" aria-label="事件四阶段路径"><div class="decision-steps">${labels.map((label, i) => `<button class="decision-step ${i === active ? "current" : i < active ? "complete" : ""}" ${i === active ? 'aria-current="step"' : ""} onclick="detailTab('${tabs[i]}')"><small>0${i + 1} · ${r.stage === "closed" ? "已完成" : i === active ? "当前阶段" : i < active ? "已有记录" : "待推进"}</small><b>${label}</b></button>`).join("")}</div><div class="decision-next"><div><b>${r.quality !== "有效" ? "林管理员 · 先修复证据质量" : nextOwner(id)}</b>${r.quality !== "有效" ? `<p>业务责任仍为：${nextOwner(id)}</p>` : ""}<p>${decisionGap(id)}</p></div>${wfAction(r.quality !== "有效" ? "查看质量阻断" : r.stage === "closed" ? "查看案例回写" : "查看当前交接", `detailTab('${r.quality !== "有效" ? "evidence" : r.stage === "closed" ? "analysis" : "actions"}')`)}</div></section>`;
}
function evidenceSummary(id) {
  const c = cs(id),
    r = jr(id),
    ctx = DECISION_CONTEXT[id];
  return `<section class="support-block"><span class="eyebrow">EVIDENCE READINESS</span><h3>证据质量与对照 ${badge(r.quality)}</h3><p>${c.window} · 原始快照 ${c.evidence}</p><div class="evidence-metrics"><div><small>窗口内变化</small><b>${c.series[0]} → ${c.series.at(-1)} ${c.unit}</b></div><div><small>完整性</small><b>${r.quality === "缺失" ? "输入缺失" : "6 / 6 合成样本"}</b></div><div><small>时效状态</small><b>${r.quality === "迟到" ? "迟到，不可审批" : "历史快照，非实时"}</b></div></div><p><b>趋势 / 对照：</b>${ctx.comparison}</p><p><b>待补证据：</b>${ctx.gap}</p><p class="subtext">样本完整不等于现场证据充分；6 个固定样本不构成预测模型验证集。</p></section>`;
}
function knowledgeMapping(id) {
  const c = cs(id),
    r = jr(id),
    d = r.diagnoses.at(-1),
    valid = d && !d.blocked && !d.superseded && r.quality === "有效";
  return `<section class="support-block"><span class="eyebrow">KNOWLEDGE → EVIDENCE → HYPOTHESIS</span><h3>知识如何参与本次研判</h3><p>${valid ? "已提交的规则研判链" : "待核验研判链预览，尚不构成获批诊断"} · ${c.kb} · ${WF_KNOWLEDGE[c.kb].version}</p>${c.hypotheses.map((h, i) => `<div class="reasoning-link"><b>${i + 1}. ${h[0]}</b><p>事件事实：${h[2]}</p><p>知识关联：${i === 0 ? WF_KNOWLEDGE[c.kb].passage : WF_KNOWLEDGE[c.kb].boundary}</p><span class="badge info">${h[1]}</span><p class="subtext">事实来源 ${c.evidence}；知识仅提供核验方向，不能证明根因。下方可核对原始来源、版本与适用范围。</p></div>`).join("")}<h3>条件风险与干预时机</h3><p><b>影响：</b>${c.impact} · <b>观察窗口：</b>${c.horizon}</p><p>${r.stage === "closed" ? "已验收结论：" + c.outcome : r.quality !== "有效" ? "质量门禁阻断，当前不输出有效风险推演。" : d && (d.blocked || d.superseded) ? "上次诊断已阻断或失效，须重新核验并提交；当前不输出有效风险推演。" : (valid ? "已提交的条件风险研判：" : "待核验条件推演示例（尚无有效诊断）：") + c.forecast}</p><p><b>成立前提：</b>${DECISION_CONTEXT[id].assumption}</p><p><b>不确定性 / 下一步：</b>${DECISION_CONTEXT[id].gap}</p><div class="split-note">条件推演用于确定检查优先级。无真实模型推理、无故障概率、无准确率或寿命承诺。${r.stage === "closed" ? "此处保留处置前研判，不代表当前风险。" : ""}</div></section>`;
}
function planComparison(id) {
  const c = cs(id);
  return `<section class="support-block"><span class="eyebrow">HUMAN DECISION</span><h3>处置方案比较</h3><p>以下为演示决策草案；资源、时间窗与回退条件须现场负责人确认，选择方案后仍需主管批准。</p>${c.plans
    .map((p, i) => {
      const x = DECISION_CONTEXT[id].plans[i];
      return `<article class="plan-option"><h4>方案 ${i + 1} · ${p}</h4><dl><dt>预期影响 / 代价</dt><dd>${x[0]}</dd><dt>人员与资源</dt><dd>${x[1]}</dd><dt>执行窗口</dt><dd>${x[2]}</dd><dt>停止 / 回退条件</dt><dd>${x[3]}</dd></dl></article>`;
    })
    .join("")}</section>`;
}
function retestComparison(id) {
  const c = cs(id),
    r = jr(id),
    t = r.tests.at(-1);
  return `<section class="support-block"><span class="eyebrow">VERIFY & LEARN</span><h3>处置前后对照与回写</h3>${table(["比较项", "处置前", "最新复测"], [`<tr><td>${c.metric}</td><td>${c.series.at(-1)} ${c.unit}</td><td>${t ? t.values.at(-1) + " " + c.unit : "尚未复测"}</td></tr>`, `<tr><td>证据编号</td><td>${c.evidence}</td><td>${t ? t.evidence : "待生成"}</td></tr>`, `<tr><td>业务结论</td><td>异常待核验</td><td>${t ? (t.passed ? "测量通过，" + (r.stage === "closed" ? "已独立验收" : "仍需独立验收") : "复测失败，已返回排查") : "不能声称恢复"}</td></tr>`])}<p>比较口径：${c.window}，使用固定合成回放；真实验收还需确认负载、环境与测量方法可比。</p><p>${r.tests.filter((x) => !x.passed).length} 次失败记录保留；失败会清空检查项并返回工程师排查，主管可将通过复测退回返工。</p>${r.caseId ? `<div class="split-note"><b>${r.caseId} · 已回写本地案例</b><p>链路：${c.evidence} → ${r.diagnoses.at(-1)?.id} → ${r.decisions.at(-1)?.id} → ${r.workId} → ${t?.id}</p><p>复盘结论：${c.outcome}</p><p>验收依据：${esc(r.reviewNote)}</p><p>知识复用：保留来源和适用范围，人工审核后再用于相似事件；未训练模型、未自动发布规程。</p></div>` : "<p>主管独立验收后才生成案例编号，自动关联证据、诊断、决策、工单与复测记录。</p>"}</section>`;
}
const baseCaseDetail = caseDetail;
caseDetail = (id, tab) => {
  const body = baseCaseDetail(id, tab);
  if (tab === "overview")
    return (
      `<div class="split-note"><b>本次 AI 辅助价值</b><p>${cs(id).subtitle}</p><p>把监测事实与可核验知识关联，输出有前提的风险研判，由人选择方案并用复测验证。</p>${wfAction("查看知识与研判链", "detailTab('analysis')")}</div>` +
      body
    );
  if (tab === "evidence")
    return evidenceSummary(id) + retestComparison(id) + body;
  if (tab === "analysis") return knowledgeMapping(id) + body;
  return body;
};
const baseCaseActions = caseActions;
caseActions = (id) => planComparison(id) + baseCaseActions(id);
const baseDrawDetail = drawDetail;
drawDetail = () => {
  baseDrawDetail();
  if (detail?.caseId && detailDialog.open)
    detailDialog
      .querySelector(".drawer-tabs")
      ?.insertAdjacentHTML("beforebegin", decisionRail(detail.caseId));
};
detailTabs[2][1] = "AI 研判与知识依据";
detailTabs[3][1] = "人工决策与执行";
const baseQueueTable = queueTable;
queueTable = (ids) =>
  table(
    ["事件 / AI 辅助线索", "状态 / 缺项", "当前责任人", "操作"],
    ids.map(
      (id) =>
        `<tr><td class="wrap-cell"><strong>${cs(id).title}</strong><span class="id">${cs(id).event} · ${cs(id).kb}</span><span class="subtext">${cs(id).subtitle}</span></td><td class="wrap-cell">${badge(stageLabel[jr(id).stage])}<span class="id">${decisionGap(id)}</span></td><td>${nextOwner(id)}</td><td>${wfAction("查看研判链", `openCase('${id}','analysis')`)} ${wfAction("处理待办", `openCase('${id}','actions')`)}</td></tr>`,
    ),
  );
const baseAlarmRows = alarmRows;
alarmRows = (alarms) =>
  alarms.map((a) => {
    const id = caseForAlarm(a.id),
      row = baseAlarmRows([a])[0];
    return id
      ? row.replace(
          `<span class="id">${a.id}</span>`,
          `<span class="id">${a.id}</span><button class="ai-clue" onclick="openCase('${id}','analysis')">AI 辅助 · ${cs(id).kb} · ${jr(id).quality === "有效" ? "可查研判依据" : "质量阻断"}</button>`,
        )
      : row;
  });
// v4: one work-order aggregate owns lifecycle, evidence and role handoffs.
const WO_PHASE_STATUS = {
  acknowledged: "待分析",
  requested: "待分析",
  rejected: "待分析",
  analyzed: "待方案审批",
  deferred: "待方案审批",
  dispatch: "待派单",
  assigned: "待接单",
  executing: "处理中",
  retest: "待复测",
  review: "待验收",
  closed: "已关闭",
  cancelled: "已取消",
};
const WO_STATUS_PHASE = {
  待分析: "requested",
  待方案审批: "analyzed",
  待派单: "dispatch",
  待接单: "assigned",
  处理中: "executing",
  待复测: "retest",
  待验收: "review",
  已关闭: "closed",
  已取消: "cancelled",
  待分派: "dispatch",
  已分派: "assigned",
  已接单: "executing",
  排查中: "executing",
  处置中: "executing",
  待审批: "analyzed",
  待审核: "review",
};
const WO_TYPES = ["故障处理", "预测性维护", "预防性巡检", "容量变更"];
const WO_PRIORITIES = ["紧急", "高", "中", "低"];
function bindWork(w, r = w.flow) {
  const oldStatus = w.status,
    legacy = !w.phase;
  w.phase = w.phase || r?.stage || WO_STATUS_PHASE[oldStatus] || "requested";
  if (!WO_PHASE_STATUS[w.phase]) w.phase = "requested";
  w.history = Array.isArray(w.history) ? w.history : [];
  w.version = Number(w.version) || 1;
  w.source =
    w.source || (w.journey ? "预测预警" : w.alarm ? "告警接管" : "人工创建");
  w.type = w.type || "故障处理";
  w.priority = w.priority || "中";
  w.description = w.description || w.title;
  w.site = dev(w.device)?.site || w.site;
  w.evidence = Array.isArray(w.evidence) ? w.evidence : [];
  w.diagnoses = Array.isArray(w.diagnoses) ? w.diagnoses : [];
  w.decisions = Array.isArray(w.decisions) ? w.decisions : [];
  w.tests = Array.isArray(w.tests) ? w.tests : [];
  Object.defineProperty(w, "status", {
    enumerable: true,
    configurable: true,
    get() {
      return WO_PHASE_STATUS[this.phase];
    },
    set(v) {
      const next = WO_STATUS_PHASE[v];
      if (next && WO_PHASE_STATUS[this.phase] !== WO_PHASE_STATUS[next])
        this.phase = next;
    },
  });
  if (r) {
    w.flow = r;
    r.workId = w.id;
    Object.defineProperty(r, "stage", {
      enumerable: true,
      configurable: true,
      get() {
        return w.phase;
      },
      set(v) {
        if (WO_PHASE_STATUS[v]) w.phase = v;
      },
    });
    w.evidenceId = w.evidenceId || CASES[w.journey]?.evidence;
    w.knowledgeId = w.knowledgeId || CASES[w.journey]?.kb;
    if (!w.evidence.length)
      w.evidence.push({
        id: w.evidenceId,
        workId: w.id,
        kind: "事件原始快照",
        values: [...CASES[w.journey].series],
        window: CASES[w.journey].window,
      });
    for (const k of ["diagnoses", "decisions", "tests"]) {
      w[k] = r[k];
      for (const x of r[k]) x.workId = w.id;
    }
    for (const h of r.history) h.workId = w.id;
  }
  for (const h of w.history) h.workId = w.id;
  if (
    legacy &&
    !r &&
    ((!PEOPLE[w.ownerId] &&
      ["assigned", "executing", "retest", "review"].includes(w.phase)) ||
      (w.phase === "analyzed" && !w.diagnoses.length))
  ) {
    w.phase = "requested";
    w.ownerId = null;
    w.owner = "";
    w.history.push({
      workId: w.id,
      time: time(),
      from: oldStatus,
      to: w.status,
      actor: "版本迁移",
      reason:
        "迁移待核验：旧记录缺少固定执行人或可核验分析，保留历史并补充分析后重新审批",
    });
  }
  return w;
}
function migrationAudit(w) {
  state.audits.unshift({
    id: `AUDIT-MIGRATE-${w.id}`,
    time: time(),
    actor: "系统 · 版本迁移",
    action: "迁移补建",
    target: w.id,
    detail: "旧版记录补建工单并保留证据；非历史人工操作",
  });
}
function makeWork(data, r) {
  const existing = state.work.find(
    (w) =>
      (data.eventId && w.eventId === data.eventId) ||
      (data.alarm && w.alarm === data.alarm) ||
      (data.id && w.id === data.id),
  );
  if (existing) return existing;
  const id =
    data.id ||
    `WO-${Date.now()}-${(state.workSequence = (state.workSequence || 0) + 1).toString().padStart(3, "0")}`;
  const w = {
    ...data,
    id,
    phase: r?.stage && r.stage !== "discovered" ? r.stage : "requested",
    ownerId: null,
    owner: "",
    version: 1,
    history: [],
    createdAt: time(),
  };
  state.work.push(w);
  bindWork(w, r);
  return w;
}
function ensureCaseWork(id) {
  const c = CASES[id],
    r = state.journeys.records[id];
  const w = makeWork(
    {
      id: r.workId || `WO-FLOW-${id.toUpperCase()}`,
      journey: id,
      eventId: c.event,
      alarm: c.alarm,
      device: c.device,
      title: c.title,
      source: "预测预警",
      type: id === "capacity" ? "容量变更" : "预测性维护",
      priority: "高",
      description: c.subtitle,
    },
    r,
  );
  r.workId = w.id;
  const a = state.alarms.find((a) => a.id === c.alarm);
  a.work = w.id;
  return w;
}
function workAudit(w, action, note, from = w.status) {
  w.version++;
  const h = {
    id: `TRACE-${w.id}-${w.history.length + 1}`,
    workId: w.id,
    time: time(),
    actor: state.demoPerson,
    actorName: person().name,
    from,
    to: w.status,
    action,
    reason: note,
  };
  w.history.push(h);
  log(action, w.id, note);
  save();
  return h;
}
wfLog = (id, action, note) => {
  wfSync();
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  r.history.push({
    id: `TRACE-${id}-${r.history.length + 1}`,
    workId: r.workId,
    time: time(),
    actor: state.demoPerson,
    action: person().name + " · " + action,
    detail: note,
  });
  if (w) {
    for (const h of w.history) h.workId = w.id;
    for (const k of ["diagnoses", "decisions", "tests"]) {
      w[k] = r[k];
      for (const x of r[k]) x.workId = w.id;
    }
    workAudit(w, action, note, w.history.at(-1)?.to || "新建");
  } else log(action, cs(id).event, note);
  save();
};
function wfDispatch(id, assignee, note) {
  if (
    !CASES[id] ||
    !allowed("supervisor") ||
    jr(id).stage !== "dispatch" ||
    jr(id).quality !== "有效" ||
    PEOPLE[assignee]?.kind !== "engineer" ||
    !String(note || "").trim()
  )
    return false;
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  w.ownerId = assignee;
  w.owner = PEOPLE[assignee].name;
  r.stage = "assigned";
  return wfCommit(id, "分派工单", `${w.id} / ${w.owner} / ${note}`);
}
function workResponsible(w) {
  if (["acknowledged", "requested", "rejected"].includes(w.phase))
    return "周分析 · 分析";
  if (["analyzed", "deferred", "dispatch", "review"].includes(w.phase))
    return "陈主管 · " + w.status;
  if (["assigned", "executing", "retest"].includes(w.phase))
    return (w.owner || "需主管明确执行人") + " · " + w.status;
  return "归档 · 保留完整记录";
}
nextOwner = (id) =>
  jr(id).workId
    ? workResponsible(state.work.find((w) => w.id === jr(id).workId))
    : "刘值班 · 接管并自动建单";
inQueue = (id) => {
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  return w ? workInQueue(w) : allowed("operator") && r.stage === "discovered";
};
function workInQueue(w) {
  return (
    (allowed("analyst") &&
      ["acknowledged", "requested", "rejected"].includes(w.phase)) ||
    (allowed("supervisor") &&
      ["analyzed", "deferred", "dispatch", "review"].includes(w.phase)) ||
    (allowed("engineer") &&
      w.ownerId === state.demoPerson &&
      ["assigned", "executing", "retest"].includes(w.phase)) ||
    (allowed("admin") && w.flow?.quality !== "有效" && !!w.flow)
  );
}
ordinaryQueue = () => {
  const rows = state.work
    .filter(
      (w) =>
        !w.journey &&
        (site === "all" || dev(w.device)?.site === site) &&
        workInQueue(w),
    )
    .map((w) => ({ ...w, type: "work", owner: workResponsible(w) }));
  if (allowed("operator"))
    for (const a of filteredAlarms().filter(
      (a) => !caseForAlarm(a.id) && a.status === "待确认",
    ))
      rows.push({ ...a, type: "alarm", owner: "刘值班 · 接管并自动建单" });
  return rows;
};
queueTable = (ids) =>
  table(
    ["工单 / 预警来源", "状态", "当前责任人", "操作"],
    ids.map((id) => {
      const r = jr(id),
        c = cs(id);
      return `<tr><td><strong>${esc(c.title)}</strong><span class="id">${r.workId || "尚未接管"} · ${c.event}</span><span class="subtext">${c.kb} · ${c.subtitle}</span></td><td>${badge(r.workId ? state.work.find((w) => w.id === r.workId).status : "待接管")}</td><td>${nextOwner(id)}</td><td>${wfAction(r.workId ? "打开工单" : "接管并建单", r.workId ? `workDetail('${r.workId}')` : `openCase('${id}','actions')`)}</td></tr>`;
    }),
  );
const oldDecisionGap = decisionGap;
decisionGap = (id) =>
  jr(id).stage === "dispatch"
    ? "方案已批准，待主管明确执行人与分派依据。"
    : jr(id).stage === "cancelled"
      ? "工单已取消，证据与操作记录保留；主管可以重开同一工单。"
      : jr(id).stage === "acknowledged"
        ? "工单已建立，分析人员可直接分析；值班人员可补充诊断交接。"
        : oldDecisionGap(id);
const caseActionsV3 = caseActions;
caseActions = (id) => {
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  let body = caseActionsV3(id);
  if (w)
    body =
      `<div class="work-anchor"><b>统一工单 ${w.id}</b><p>${w.status} · ${esc(w.source)} · ${esc(w.type)} · ${esc(w.priority)}优先级</p>${wfAction("打开此工单", `workDetail('${w.id}')`)}</div>` +
      body;
  if (r.stage === "dispatch" && allowed("supervisor"))
    body += `<label for="wf-assignee">执行人</label><select id="wf-assignee"><option value="engineer">王工</option><option value="engineer2">赵工</option></select><label for="wf-note">分派依据</label><textarea id="wf-note"></textarea>${wfAction("分派同一工单", `wfDispatch('${id}',$('#wf-assignee').value,$('#wf-note').value)`, true)}`;
  if (w && allowed("supervisor"))
    body += `<section class="support-block"><label for="work-reason">取消 / 重开依据（必填）</label><textarea id="work-reason"></textarea>${wfAction(["closed", "cancelled"].includes(w.phase) ? "重开同一工单" : "取消工单", `transitionWork('${w.id}','${["closed", "cancelled"].includes(w.phase) ? "reopen" : "cancel"}',${w.version})`)}</section>`;
  return body;
};
const caseDetailV3 = caseDetail;
caseDetail = (id, tab) => {
  const r = jr(id),
    w = state.work.find((w) => w.id === r.workId);
  if (tab === "history" && w) return workHistory(w);
  return caseDetailV3(id, tab);
};
function workHistory(w) {
  return `<h3>${w.id} · 完整工单历史</h3><p>分析、审批、分派、检查、复测与验收均归属于此编号。迁移记录明确标识来源。</p><ul class="timeline">${w.history.map((h) => `<li><b>${esc(h.action || h.reason || "状态变更")}</b><small>${esc(h.actorName || PEOPLE[h.actor]?.name || h.actor)} · ${h.time}</small><p>${esc(h.from || "")} → ${esc(h.to || "")} · ${esc(h.reason || "")}</p><span class="id">${w.id}${h.id ? " · " + esc(h.id) : ""}</span></li>`).join("")}</ul>${w.flow?.history.length ? "<h3>原始事件轨迹（保留历史来源）</h3>" + wfHistory(w.flow) : ""}`;
}
function acknowledgeOrdinary(id, note) {
  const a = state.alarms.find((a) => a.id === id);
  if (!a || !allowed("operator") || !String(note || "").trim()) return false;
  if (a.work) return state.work.find((w) => w.id === a.work);
  if (a.status !== "待确认" && a.status !== "已确认") return false;
  const w = makeWork({
    alarm: id,
    device: a.device,
    title: a.title,
    source: a.source === "预测模拟" ? "预测预警" : "告警接管",
    type: a.source === "预测模拟" ? "预测性维护" : "故障处理",
    priority: a.severity === "紧急" ? "紧急" : "中",
    description: note,
  });
  a.work = w.id;
  a.status = "处理中";
  a.acknowledgedBy = state.demoPerson;
  a.acknowledgedAt = time();
  w.evidence.push({
    id: `EVS-${id}`,
    workId: w.id,
    kind: "接管时测点快照",
    values: points(dev(a.device)),
    time: time(),
  });
  workAudit(w, "接管告警并自动创建工单", note, "新建");
  render();
  return w;
}
ackAlarm = (id) => {
  const key = caseForAlarm(id),
    note = $("#alarm-reason")?.value || $("#wf-note")?.value;
  if (key) {
    const result = wfAck(key, note);
    if (result) toast("已接管，工单 " + jr(key).workId + " 已创建");
    return result;
  }
  const w = acknowledgeOrdinary(id, note);
  if (w) toast("已接管，工单 " + w.id + " 已创建");
  return !!w;
};
createWork = (id) => {
  const a = state.alarms.find((a) => a.id === id);
  if (a?.work) {
    workDetail(a.work);
    return true;
  }
  return ackAlarm(id);
};
function woSetQuality(id, value) {
  const w = state.work.find((w) => w.id === id);
  if (
    !w ||
    !allowed("admin") ||
    !["有效", "缺失", "迟到"].includes(value) ||
    ["closed", "cancelled"].includes(w.phase)
  )
    return false;
  if (w.journey) return wfQuality(w.journey, value);
  const from = w.status;
  dev(w.device).quality = value;
  for (const x of state.work.filter(
    (x) =>
      x.device === w.device &&
      !x.journey &&
      !["closed", "cancelled"].includes(x.phase),
  )) {
    for (const d of x.diagnoses) d.superseded = true;
    if (["analyzed", "deferred", "dispatch"].includes(x.phase))
      x.phase = "requested";
    workAudit(x, "更新证据质量", value, from);
  }
  render();
  return true;
}
function woCreate(data) {
  if (!allowed("operator", "analyst", "supervisor", "engineer"))
    return denied();
  if (
    !data ||
    !String(data.title || "").trim() ||
    !String(data.description || "").trim() ||
    !dev(data.device) ||
    data.site !== dev(data.device).site ||
    !WO_TYPES.includes(data.type) ||
    !WO_PRIORITIES.includes(data.priority)
  )
    return false;
  const w = makeWork({
    title: data.title.trim(),
    description: data.description.trim(),
    device: data.device,
    site: data.site,
    type: data.type,
    priority: data.priority,
    source: data.type === "预测性维护" ? "主动预防" : "人工创建",
    alarm: null,
  });
  w.evidence.push({
    id: `EVS-${w.id}-INITIAL`,
    workId: w.id,
    kind: "建单时测点快照",
    time: time(),
    values: points(dev(w.device)),
  });
  workAudit(w, "人工创建工单", w.description, "新建");
  render();
  return w.id;
}
function newWorkForm() {
  if (!allowed("operator", "analyst", "supervisor", "engineer"))
    return denied();
  modal(
    "新建工单",
    `<p>故障、预测性维护、预防巡检与容量变更均从同一工单流程开始。</p><label for="wo-title">标题</label><input id="wo-title" maxlength="120"><div class="form-grid"><div><label for="wo-site">站点</label><select id="wo-site" onchange="newWorkAssets()">${SITES.map((s) => `<option>${s}</option>`).join("")}</select></div><div><label for="wo-device">资产</label><select id="wo-device"></select></div><div><label for="wo-type">工单类型</label><select id="wo-type">${WO_TYPES.map((s) => `<option>${s}</option>`).join("")}</select></div><div><label for="wo-priority">优先级</label><select id="wo-priority">${WO_PRIORITIES.map((s) => `<option ${s === "中" ? "selected" : ""}>${s}</option>`).join("")}</select></div></div><label for="wo-description">现象、预防目的与证据说明</label><textarea id="wo-description"></textarea>${wfAction("创建工单", "submitNewWork()", true)}`,
  );
  newWorkAssets();
}
function newWorkAssets() {
  $("#wo-device").innerHTML = state.devices
    .filter((d) => d.site === $("#wo-site").value)
    .map((d) => `<option value="${d.id}">${d.id} · ${d.name}</option>`)
    .join("");
}
function submitNewWork() {
  const id = woCreate({
    title: $("#wo-title").value,
    site: $("#wo-site").value,
    device: $("#wo-device").value,
    type: $("#wo-type").value,
    priority: $("#wo-priority").value,
    description: $("#wo-description").value,
  });
  if (!id) return toast("请填写标题和说明，并选择同站点资产、类型与优先级");
  $("#dialog").close();
  navigate("work");
  workDetail(id);
  toast("已创建 " + id);
}
function woTransition(id, action, version, options = {}) {
  const w = state.work.find((w) => w.id === id);
  if (!w || w.version !== version) return false;
  const note = String(options.note || "").trim(),
    supervisor = allowed("supervisor"),
    mine = allowed("engineer") && w.ownerId === state.demoPerson,
    old = w.status;
  if (!note) return false;
  if (action === "cancel") {
    if (!supervisor || ["closed", "cancelled"].includes(w.phase)) return false;
    w.phase = "cancelled";
  } else if (action === "reopen") {
    if (!supervisor || !["closed", "cancelled"].includes(w.phase)) return false;
    w.caseArchive = w.caseArchive || [];
    if (w.caseId || w.flow?.caseId)
      w.caseArchive.push({
        caseId: w.caseId || w.flow.caseId,
        workId: w.id,
        acceptance: w.acceptance || {
          reviewer: w.flow?.reviewer,
          note: w.flow?.reviewNote,
        },
        archivedAt: time(),
      });
    w.caseId = null;
    w.acceptance = null;
    w.phase = "requested";
    w.ownerId = null;
    w.owner = "";
    w.testPassed = false;
    for (const d of w.diagnoses) d.superseded = true;
    if (w.flow) {
      w.flow.checks = [];
      w.flow.caseId = null;
      w.flow.reviewNote = null;
      for (const d of w.flow.diagnoses) d.superseded = true;
    }
  } else if (w.journey) return false;
  else if (action === "reject") {
    if (!supervisor || !["analyzed", "deferred", "review"].includes(w.phase))
      return false;
    w.phase = w.phase === "review" ? "executing" : "rejected";
    w.testPassed = false;
  } else if (action === "next") {
    if (
      ["acknowledged", "requested", "rejected"].includes(w.phase) &&
      allowed("analyst", "engineer")
    ) {
      if (dev(w.device).quality !== "有效") return false;
      const k = deviceKnowledge(dev(w.device));
      w.diagnoses.push({
        id: `DX-${w.id}-${w.diagnoses.length + 1}`,
        workId: id,
        actor: state.demoPerson,
        time: time(),
        conclusion: note,
        plan: options.plan || note,
        knowledgeId: k.id,
        knowledgeVersion: "本地演示知识快照 v4",
        knowledgeText: k.text,
        evidence: w.evidence.at(-1)?.id,
      });
      w.phase = "analyzed";
    } else if (["analyzed", "deferred"].includes(w.phase) && supervisor) {
      if (
        dev(w.device).quality !== "有效" ||
        !w.diagnoses.length ||
        w.diagnoses.at(-1).superseded
      )
        return false;
      w.decisions.push({
        id: `DEC-${w.id}-${w.decisions.length + 1}`,
        workId: id,
        actor: state.demoPerson,
        time: time(),
        choice: "approve",
        note,
        diagnosis: w.diagnoses.at(-1).id,
      });
      w.phase = "dispatch";
    } else if (
      w.phase === "dispatch" &&
      supervisor &&
      PEOPLE[options.assignee]?.kind === "engineer"
    ) {
      if (dev(w.device).quality !== "有效") return false;
      w.ownerId = options.assignee;
      w.owner = PEOPLE[options.assignee].name;
      w.phase = "assigned";
    } else if (w.phase === "assigned" && mine) w.phase = "executing";
    else if (w.phase === "executing" && mine) {
      w.checkRecords = w.checkRecords || [];
      w.checkRecords.push({
        id: `CHECK-${id}-${w.checkRecords.length + 1}`,
        workId: id,
        actor: state.demoPerson,
        note,
        time: time(),
      });
      w.phase = "retest";
    } else if (
      w.phase === "retest" &&
      mine &&
      ["通过", "不通过"].includes(options.test)
    ) {
      if (dev(w.device).quality !== "有效") return false;
      w.testPassed = options.test === "通过";
      w.testActor = state.demoPerson;
      w.tests.push({
        id: `TEST-${w.id}-${w.tests.length + 1}`,
        workId: id,
        passed: w.testPassed,
        actor: state.demoPerson,
        time: time(),
        note,
        evidence: `POST-${id}-${w.tests.length + 1}`,
      });
      w.phase = w.testPassed ? "review" : "executing";
      const a = state.alarms.find((a) => a.id === w.alarm);
      if (a) a.signalState = w.testPassed ? "recovered" : "active";
    } else if (
      w.phase === "review" &&
      supervisor &&
      dev(w.device).quality === "有效" &&
      w.testPassed &&
      w.testActor !== state.demoPerson &&
      w.ownerId !== state.demoPerson
    ) {
      w.phase = "closed";
      w.caseId = `CASE-${id}`;
      w.acceptance = {
        workId: id,
        actor: state.demoPerson,
        time: time(),
        note,
      };
    } else return false;
  } else return false;
  const a = state.alarms.find((a) => a.id === w.alarm);
  if (a) {
    a.status =
      w.phase === "closed"
        ? "已关闭"
        : w.phase === "cancelled"
          ? "已确认"
          : "处理中";
    if (["reopen", "reject"].includes(action)) a.signalState = "active";
  }
  workAudit(
    w,
    action === "next"
      ? "工单交接"
      : action === "reopen"
        ? "重开同一工单"
        : action === "cancel"
          ? "取消工单"
          : "退回补充",
    options.test ? note + "；复测：" + options.test : note,
    old,
  );
  if (w.flow) {
    w.flow.history.push({
      id: `TRACE-${id}-${w.flow.history.length + 1}`,
      workId: id,
      time: time(),
      actor: state.demoPerson,
      action: person().name + " · " + action,
      detail: note,
    });
  }
  save();
  render();
  return true;
}
transitionWork = (id, action, version) => {
  const ok = woTransition(id, action, version, {
    note: $("#work-reason")?.value,
    assignee: $("#work-owner")?.value,
    test: $("#work-test")?.value,
    plan: $("#work-plan")?.value,
  });
  if (!ok) toast("请检查当前身份、状态、版本与必填依据");
  return ok;
};
const genericDetailV3 = genericDetail;
genericDetail = (d, tab) => {
  const w =
    detail.type === "work" ? state.work.find((w) => w.id === detail.id) : null;
  if (!w) return genericDetailV3(d, tab);
  const mine = allowed("engineer") && w.ownerId === state.demoPerson,
    supervisor = allowed("supervisor");
  if (tab === "overview")
    return `<h3>${esc(w.title)}</h3><dl><dt>统一工单</dt><dd>${w.id}</dd><dt>状态 / 当前责任</dt><dd>${w.status} · ${workResponsible(w)}</dd><dt>来源 / 类型 / 优先级</dt><dd>${esc(w.source)} / ${esc(w.type)} / ${esc(w.priority)}</dd><dt>站点 / 设备</dt><dd>${esc(w.site)} · ${w.device}</dd><dt>描述</dt><dd>${esc(w.description)}</dd><dt>关联告警</dt><dd>${w.alarm || "主动建单，无故障告警"}</dd><dt>案例</dt><dd>${w.caseId || "验收后生成"}</dd></dl><div class="toolbar">${wfAction("关联资产", `assetDetail('${w.device}')`)}${w.alarm ? wfAction("关联告警", `alarmDetail('${w.alarm}')`) : ""}</div>`;
  if (tab === "history") return workHistory(w);
  if (tab === "evidence")
    return `<h3>工单证据 ${w.id}</h3><p>当前证据质量：${esc(d.quality)}；非有效质量不得提交诊断、批准或复测。</p>${allowed("admin") ? `<label for="wo-quality">演示证据质量</label><select id="wo-quality" onchange="woSetQuality('${w.id}',this.value)">${["有效", "缺失", "迟到"].map((q) => `<option ${d.quality === q ? "selected" : ""}>${q}</option>`).join("")}</select>` : ""}${w.evidence
      .map(
        (e) =>
          `<div class="split-note"><b>${esc(e.id)} · ${esc(e.kind)}</b><p>${w.id} · ${e.time || "历史快照"}</p>${
            Array.isArray(e.values) && e.values[0]?.name
              ? table(
                  ["测点", "值", "单位", "质量"],
                  e.values.map(
                    (p) =>
                      `<tr><td>${esc(p.name)}</td><td>${esc(p.value)}</td><td>${esc(p.unit)}</td><td>${esc(p.quality)}</td></tr>`,
                  ),
                )
              : ""
          }</div>`,
      )
      .join(
        "",
      )}<h3>检查与复测记录</h3>${(w.checkRecords || []).map((c) => `<p>${c.id} · ${w.id} · ${esc(c.note)}</p>`).join("")}${w.tests.map((t) => `<div class="split-note">${t.id} · ${w.id} · ${t.passed ? "通过，仍需独立验收" : "失败，返回处理"}<p>${esc(t.note)}</p></div>`).join("") || "<p>暂无复测，不能声称恢复。</p>"}`;
  if (tab === "analysis")
    return `<h3>工单分析与知识依据</h3><p>本节为固定规则参考与人工分析记录；真实 AI 操作见下方独立面板。缺少设备适用依据时须补充现场资料，不直接采用其他型号的规程。</p>${genericDetailV3(d, tab)}<h3>已提交分析</h3>${w.diagnoses.map((x) => `<div class="split-note"><b>${x.id} · ${w.id}</b><p>${esc(x.conclusion)}</p><p>${esc(x.knowledgeId)} · ${esc(x.knowledgeVersion)}</p><p>${esc(x.knowledgeText)}</p><p>证据 ${esc(x.evidence || "旧版未记录")}</p></div>`).join("") || "<p>待分析人员补充证据与建议方案。</p>"}${wfAction("前往分析 / 交接", "detailTab('actions')")}`;
  const canAnalyze =
      allowed("analyst", "engineer") &&
      ["acknowledged", "requested", "rejected"].includes(w.phase),
    canNext =
      canAnalyze ||
      (supervisor &&
        ["analyzed", "deferred", "dispatch", "review"].includes(w.phase)) ||
      (mine && ["assigned", "executing", "retest"].includes(w.phase));
  const labels = {
    acknowledged: "提交分析与方案",
    requested: "提交分析与方案",
    rejected: "重新提交分析",
    analyzed: "批准方案，转待派单",
    deferred: "批准方案，转待派单",
    dispatch: "分派工单",
    assigned: "接受工单",
    executing: "提交检查，进入复测",
    retest: "提交复测结果",
    review: "独立验收并关闭",
  };
  return `<h3>${w.id} · ${badge(w.status)}</h3><p>当前责任：${workResponsible(w)} · 操作人：${person().name}</p><div class="split-note">${esc(w.description)}<p>信号恢复与业务关闭分开记录；复测通过后仍需主管独立验收。</p></div>${canNext || supervisor ? `<label for="work-reason">分析 / 操作依据（必填）</label><textarea id="work-reason"></textarea>${canAnalyze ? '<label for="work-plan">建议方案（可在依据中一并填写）</label><textarea id="work-plan"></textarea>' : ""}${w.phase === "dispatch" ? '<label for="work-owner">执行人</label><select id="work-owner"><option value="engineer">王工</option><option value="engineer2">赵工</option></select>' : ""}${w.phase === "retest" ? '<label for="work-test">复测结论</label><select id="work-test"><option value="">请选择</option><option>通过</option><option>不通过</option></select>' : ""}<div class="toolbar">${canNext ? wfAction(labels[w.phase], `transitionWork('${w.id}','next',${w.version})`, true) : ""}${supervisor && ["analyzed", "deferred", "review"].includes(w.phase) ? wfAction("退回补充 / 返工", `transitionWork('${w.id}','reject',${w.version})`) : ""}${supervisor ? wfAction(["closed", "cancelled"].includes(w.phase) ? "重开同一工单" : "取消工单", `transitionWork('${w.id}','${["closed", "cancelled"].includes(w.phase) ? "reopen" : "cancel"}',${w.version})`) : ""}</div>` : "<p>当前岗位只读，请由当前责任人推进。</p>"}<h3>方案审批</h3>${w.decisions.map((x) => `<p>${x.id} · ${w.id} · ${esc(x.note)}</p>`).join("") || "<p>尚无审批记录。</p>"}`;
};
WORK_STATES.splice(
  0,
  WORK_STATES.length,
  "待分析",
  "待方案审批",
  "待派单",
  "待接单",
  "处理中",
  "待复测",
  "待验收",
  "已关闭",
);
views.work = () => {
  const rows = state.work.filter(
    (w) =>
      (site === "all" || dev(w.device)?.site === site) &&
      `${w.id}${w.device}${w.title}${w.source}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "全部" || w.status === filter),
  );
  const p = paginate(rows);
  return `<section class="card work-center">${head("工单中心 · 全流程协同", allowed("operator", "analyst", "supervisor", "engineer") ? wfAction("新建工单", "newWorkForm()", true) : "")}<p>接管即建单，主动维护也从这里开始。每次分析、审批、分派和复测都使用同一工单编号。</p><div class="work-status-strip">${WORK_STATES.map((s) => `<button class="${filter === s ? "active" : ""}" onclick="filter='${s}';pageNo=1;render()"><b>${state.work.filter((w) => w.status === s && (site === "all" || dev(w.device)?.site === site)).length}</b><span>${s}</span></button>`).join("")}</div>${toolbar("搜索工单、资产、标题或来源", ["全部", ...WORK_STATES, "已取消"])}${table(
    ["工单 / 来源", "站点 / 资产", "类型 / 优先级", "状态 / 当前责任", "操作"],
    p.rows.map(
      (w) =>
        `<tr><td class="wrap-cell"><strong>${esc(w.title)}</strong><span class="id">${w.id}</span><span class="subtext">${esc(w.source)}${w.eventId ? " · " + w.eventId : ""}</span></td><td>${esc(w.site)}<span class="id">${w.device}</span></td><td>${esc(w.type)}<span class="id">${esc(w.priority)}优先级</span></td><td>${badge(w.status)}<span class="id">${workResponsible(w)}</span></td><td>${wfAction("打开工单", `workDetail('${w.id}')`)}</td></tr>`,
    ),
  )}${p.footer}${!rows.length ? '<div class="empty">当前筛选下暂无工单。点击“新建工单”发起主动维护，或接管告警自动创建工单。</div>' : ""}</section>`;
};
nativeViews.work = views.work;
modules.find((m) => m[0] === "work")[1] = "工单中心";
subtitles.work = "工单是协同底座：接管即建单，分析、决策、执行与复测全程追溯。";
const oldDrawWork = drawDetail;
drawDetail = () => {
  oldDrawWork();
  if (!detailDialog.open || !detail) return;
  const w =
    detail.type === "work"
      ? state.work.find((w) => w.id === detail.id)
      : detail.caseId
        ? state.work.find((w) => w.id === jr(detail.caseId).workId)
        : detail.type === "alarm"
          ? state.work.find((w) => w.alarm === detail.id)
          : null;
  if (w) {
    const identity = detailDialog.querySelector(".drawer-identity");
    if (detail.type === "work")
      identity.querySelector("h2").textContent = w.title;
    identity.insertAdjacentHTML(
      "beforeend",
      `<div class="work-anchor"><b>${w.id}</b> ${badge(w.status)}<span class="id">${workResponsible(w)}</span>${detail.type !== "work" ? wfAction("打开关联工单", `workDetail('${w.id}')`) : ""}</div>`,
    );
  }
};
window.WO = {
  get: (id) => state.work.find((w) => w.id === id),
  list: () => state.work,
  create: woCreate,
  transition: woTransition,
  acknowledgeAlarm: acknowledgeOrdinary,
  setQuality: woSetQuality,
  types: WO_TYPES,
  priorities: WO_PRIORITIES,
  sites: SITES,
  open: workDetail,
  newForm: newWorkForm,
};

window.WF = {
  getState: () => ensureJourneys(),
  cases: CASES,
  knowledge: WF_KNOWLEDGE,
  people: PEOPLE,
  person: () => state.demoPerson,
  switchPerson,
  select: wfSelect,
  go: wfGo,
  acknowledge: wfAck,
  requestDiagnosis: wfRequest,
  analyze: wfAnalyze,
  decide: wfDecide,
  dispatch: wfDispatch,
  startWork: wfStart,
  check: wfCheck,
  submitChecks: wfSubmit,
  retest: wfRetest,
  closeCase: wfClose,
  returnWork: wfReturn,
  setQuality: wfQuality,
  reset: wfReset,
  open: openCase,
  close: closeDetail,
};
window.DEMO.navigate = navigate;
window.DEMO.render = render;
window.DEMO.points = points;
window.DEMO.reset = resetDemo;
ensureJourneys();
wfSync();
save();
render();
wfRoute();
