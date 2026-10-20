import { hash } from "./dataset.mjs";
export const WIKI_SUITE_VERSION = "powerenv-wiki-e2e-v1";
export const WIKI_CASES = [
  {
    id: "wiki-01",
    input: {
      query: "过滤器 压差 风机 回风 告警，应先核对哪些证据？",
      family: "cooling",
      model: "HC-PAC30",
      version: "demo-v1",
    },
    expectedSourceIds: ["cooling-evidence"],
  },
  {
    id: "wiki-02",
    input: {
      query: "制冷剂不足 传感器 保护阈值，能否仅凭高压告警直接操作？",
      family: "cooling",
      model: "HC-PAC30",
      version: "demo-v1",
    },
    expectedSourceIds: ["cooling-evidence"],
  },
  {
    id: "wiki-03",
    input: {
      query: "节能率 kWh 混杂因素，电量变低能否证明优化有效？",
      family: "cooling",
      model: "HC-PAC30",
      version: "demo-v1",
    },
    expectedSourceIds: ["energy-baseline"],
  },
  {
    id: "wiki-04",
    input: {
      query: "基线为零 窗口不等长，节能比较需要哪些约束？",
      family: "cooling",
      model: "HC-PAC30",
      version: "demo-v1",
    },
    expectedSourceIds: ["energy-baseline"],
  },
  {
    id: "wiki-05",
    input: {
      query: "单体电压 内阻 浮充 校准，如何核验电池健康异常？",
      family: "ups",
      model: "HC-UPS40",
      version: "demo-v1",
    },
    expectedSourceIds: ["battery-evidence"],
  },
  {
    id: "wiki-06",
    input: {
      query: "放电曲线 后备时间 串组，证据不足时应如何描述？",
      family: "ups",
      model: "HC-BAT192",
      version: "demo-v1",
    },
    expectedSourceIds: ["battery-evidence"],
  },
  {
    id: "wiki-07",
    input: {
      query: "风机 告警 检修证据",
      family: "cooling",
      model: "HC-PAC999",
      version: "demo-v1",
    },
    expectedSourceIds: [],
  },
  {
    id: "wiki-08",
    input: {
      query: "风机 告警 检修证据",
      family: "cooling",
      model: "HC-PAC30",
      version: "demo-v0",
    },
    expectedSourceIds: [],
  },
  {
    id: "wiki-09",
    input: {
      query: "电池 内阻 告警",
      family: "cooling",
      model: "HC-UPS40",
      version: "demo-v1",
    },
    expectedSourceIds: [],
  },
  {
    id: "wiki-10",
    input: {
      query: "电源 告警 核验",
      family: "unknown-device",
      model: "UNKNOWN",
      version: "demo-v1",
    },
    expectedSourceIds: [],
  },
];
export const WIKI_SUITE_HASH = hash({
  version: WIKI_SUITE_VERSION,
  cases: WIKI_CASES,
});
// Frozen suite definition; source corpus gets its own live snapshot hash in every report.
export const EXPECTED_WIKI_SUITE_HASH =
  "981b2c0c88e45b2a7033bcb260765c3418e221bc5def28cf696230e6a7e60ccc";
if (WIKI_SUITE_HASH !== EXPECTED_WIKI_SUITE_HASH)
  throw new Error("Frozen Wiki E2E suite mismatch");
