---
{
  "id": "raw-s3-synthetic",
  "title": "S3 同负载空调能耗比较（原始合成来源）",
  "family": "cooling",
  "model": "HC-PAC30",
  "version": "demo-v1",
  "reviewStatus": "reviewed",
  "reviewer": "synthetic-fixture-editor",
  "reviewedAt": "2026-10-20",
  "sourceType": "synthetic",
  "sourceIds": [],
  "provenance": "Original synthetic training fixture; not a manufacturer manual or site operating procedure.",
  "models": [
    "HC-PAC30"
  ],
  "scenario": "s3"
}
---

# S3 同负载空调能耗比较
原创合成分析案例，只用于展示证据推理。
比较优化前后空调电耗，应匹配 IT 有功负载、室外干湿球温度、工作日时段、湿度目标、冗余机组数量和服务温度约束。缺失这些变量时，较低电量不能归因于优化。
分别报告基线和观察窗口、kWh、匹配负载区间、样本量、缺失值及异常事件。计算节能率=(基线电量-观察电量)/基线电量；基线为零或窗口不等长时不得直接计算。
安全边界：保持机房供冷、湿度及冗余约束；不自动调整温度设定点、关机或写入控制器。由人工审查建议并执行批准的变更。
验收：相同工况下可重复的电耗变化、供冷稳定性和告警未恶化；结果应有混杂因素和不确定性说明。
