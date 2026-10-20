---
{
  "id": "raw-s2-synthetic",
  "title": "S2 UPS 与蓄电池告警核验（原始合成来源）",
  "family": "ups",
  "model": "HC-UPS40",
  "version": "demo-v1",
  "reviewStatus": "reviewed",
  "reviewer": "synthetic-fixture-editor",
  "reviewedAt": "2026-10-20",
  "sourceType": "synthetic",
  "sourceIds": [],
  "provenance": "Original synthetic training fixture; not a manufacturer manual or site operating procedure.",
  "models": [
    "HC-UPS40",
    "HC-BAT192"
  ],
  "scenario": "s2"
}
---

# S2 UPS 与蓄电池告警核验
原创合成训练案例，不构成厂家维护指引。
单体电压离群、内阻趋势上升、温度差异与剩余后备时间变化是不同证据，不能把 UPS 负载率等同于电池健康度。核对浮充状态、历史同温度测量、采样校准、串组身份和告警时间。
备电时间估计依赖负载、电池容量、老化和温度；缺少实测放电曲线时只说明不确定性，不虚构分钟数。
安全边界：不得发起电池放电测试、旁路切换、断开电池串或带电紧固。安排合格人员依据真实型号手册和批准的维护窗口复核。
验收必须包含问题串组标识、复测条件、维修记录和业务连续性确认。
