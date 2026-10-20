---
{
  "id": "cooling-evidence",
  "title": "S1 制冷异常证据采集",
  "family": "cooling",
  "model": "HC-PAC30",
  "version": "demo-v1",
  "reviewStatus": "reviewed",
  "reviewer": "synthetic-fixture-editor",
  "reviewedAt": "2026-10-20",
  "sourceType": "synthetic",
  "sourceIds": [
    "raw-s1-synthetic"
  ],
  "provenance": "Original synthetic training fixture; not a manufacturer manual or site operating procedure.",
  "models": [
    "HC-PAC30"
  ],
  "scenario": "s1",
  "sourceSnapshots": [
    {
      "id": "raw-s1-synthetic",
      "sha256": "4feae54e28cffac15bfad7831fbcda31cf11331b2fa5f65da2266bcf35d9eb1c"
    }
  ]
}
---

# S1 制冷异常证据采集
这是原创合成教学材料，无厂家手册来源，不适用于直接控制真实设备。
冷量不足、回风温度上升和高压告警并不能单独证明制冷剂不足。先核对时间戳、传感器可靠性、设定点、供回风趋势、风机运行反馈和过滤器压差，再由有资质人员按现场 SOP 检查气流阻塞、冷凝侧散热与压缩机状态。
把告警发生前后相同时间窗口的室外温度、机房 IT 负载、供回风温度、湿度和功率并列，区分负荷增加与效率恶化。
安全边界：只读采集；不得远程复位保护、带电拆检、补充制冷剂或调整保护阈值。缺少型号适用说明时不得引用为维修步骤。
验收证据：告警趋势、人工核验记录和稳定观察窗口；禁止用单一瞬时温度作为修复证明。

来源：[[raw-s1-synthetic]]。
相关：[[evidence-review]]；[[index]]。

适用实体与关联约束：[[device-hc-pac30]]；[[energy-baseline]]。
