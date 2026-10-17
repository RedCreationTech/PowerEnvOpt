# 动环智维：可解释、可复核的演示业务闭环

研究日期：2026-10-16。以下是纯前端产品原型设计，所有现场数据、阈值、时间、人员、工单和结果均为合成示例；官方资料仅支持监测变量、设备告警和核验方法，不能证明本原型已训练模型或具备预测精度。界面明确标记“演示数据 · 建议待人工确认”，禁止自动执行控制、旁路切换、断电或告警复位。来源适用设备型号必须显示，不将单相 Smart-UPS 自检方法机械套用到所有工业 UPS。

## 全局交互结构

总览风险卡 → 设备诊断（同一 scenarioId）→ 证据时间线与关联拓扑 → 知识依据（可点击官方来源，显示型号/章节/适用边界）→ AI 辅助研判（观察事实/假设/备选原因/缺失证据分开）→ 人工决定（批准检查、补充证据、暂缓并填写理由）→ 关联工单 → 复测记录 → 人工验收关闭。

每步保留 alarmIds、assetId、evidenceIds、knowledgeIds、workOrderId；切换页面不丢失选中场景。工单须回链原告警，知识页须能返回诊断。AI 状态用“证据充分度：待现场核实”，不使用未经验证的置信度百分比或剩余寿命倒计时。清除告警与验收完成是两种状态。

## 场景 1：UPS 电池组的异常单体，需要核验劣化

- ID：BAT-01；资产：UPS-A / 电池串 A / B12；标题：B12 阻抗持续偏离同组，建议安排核验。
- 演示传感证据：B12 阻抗由 5.2 升至 7.1 mΩ（+36.5%）；同组中位数 5.3 mΩ；B12 温度 32.8°C、同组 27.4°C；电压 13.3V；数据截至 14:32，最近 24h 完整率 98%。这些数字不是厂商阈值。
- 关联：B12→电池串 A→UPS-A→机柜 A01–A08；核对安装日期、近期放电、环境温升、历史维护，避免将错误年龄元数据当作劣化证据。
- 知识命中：S1 支持阻抗/电压/温度监测；S2 支持同串偏离单体分析；S3 说明电池评分仅供参考，安装日期会影响建议，需按适用设备核验自检。
- AI 解释：温升及同组阻抗偏离支持“电池状态异常”假设；不能据此确定剩余寿命。备选原因：连接/测量异常、局部环境热源、安装日期错误。缺失：现场检查、厂家适用测试结果。
- 人工决策：批准“检查与测试”工单，或请求补充数据；不默认批准更换。检查窗口、负载保障、厂家规程由负责人确认。
- 工单 WO-BAT-017：核对设备型号及更换记录；合格人员按厂家程序复核传感/连接与电池状况；按适用规程测试；附测试报告后决定是否更换。明确这是工单草稿，未向外部系统提交。
- 复测演示：核对型号及日期完成；现场测试确认异常后，经授权完成对应维护；阻抗 5.4 mΩ、温度 27.8°C；复测报告已附。负责人选择“验收通过”才关闭；若无改善返回诊断。
- 型号限制：S3 是单相 Smart-UPS 文档；不将其 4–5 年寿命或自检通过规则当作所有电池类型的通用标准，也不建议只更换一个模块而忽视整串匹配要求。

## 场景 2：精密空调的气流受阻假设与机柜热点

- ID：COOL-02；资产：CRAC-02 / 冷通道 B；标题：机柜进风升温与滤网告警同现。
- 演示证据：机柜进风 24.2→29.4°C（40分钟）；回风 31.6°C；风机指令 82%、反馈 81%；Filter Clogged 告警 14:08；IT 功率同窗变化 +2%；滤网维护记录距今 92天。29.4°C、92天都不是推荐通用阈值。
- 关联：温度点 B07→冷通道 B→CRAC-02；同时对照风机反馈、IT 负载、门禁/围挡状态和告警时间，禁止仅凭温度推断压缩机故障。
- 知识命中：S4 手册附录 C 定义高送回风温度、滤网堵塞、滤网维护和气流丢失告警；S5 支持持续监控及基于实时负载调整/维护建议。
- AI 解释：滤网告警早于热点且负载相对稳定，使气流受阻值得优先检查；尚未确认根因。备选：温度传感器偏差、通道短路/热回流、风机故障、制冷能力不足。缺失：现场滤网状态、实测气流及制冷运行参数。
- 人工决策：批准现场巡检；不自动调低设定温度、不自动强制风机或复位。审批需确认值班负责人及维护窗口。
- 工单 WO-COOL-028：核验传感器与现场热点；检查滤网/通道遮挡/风机状态；按设备维护规程处理；记录前后曲线与照片。更换、停机等动作由合格人员按审批执行。
- 复测演示：现场确认滤网积尘并按规程维护；机柜进风 25.1°C、滤网告警恢复；负载保持可比；演示观察窗 30分钟无复发。该观察窗是原型验收示例，不是厂商要求。若仅告警恢复但温度未恢复，保留“待复测”。

## 场景 3：支路容量与冗余承载风险

- ID：PWR-03；资产：PDU-A / 支路 QF-12 / 上游 UPS-A；标题：计划扩容后支路余量不足，需评估冗余场景。
- 演示证据：支路额定 63A；峰值 55A；站点配置预警 80%（原型阈值，不是 IEC 通用标准）；新增负载计划折算 +12A，模拟合计 67A。峰值与新增负载的同时性尚未确认。
- 关联：QF-12→PDU-A→UPS-A；查 A/B 供电映射、同时间窗峰值、额定/设计容量、变更计划与其他 UPS 剩余容量。明确“运行态容量”与“故障转供场景容量”不同。
- 知识命中：S6 第13页支持支路平均/最大负载与断路器额定值比较，并对 UPS/发电机校验停电场景与设计冗余；第10–12页说明 A/kW/kVA/kWh 数据与时间同步需求。
- AI 解释：若峰值与新增负载同时出现，67A 超过本示例63A名牌值，应暂停该扩容方案并由电气工程师评估；不等于已经发生过载，也不能用当前功率直接证明 N+1 成立。缺失：负载同时性、接线图核实、保护整定及实际冗余策略。
- 人工决策：延期接入 / 评估迁移到已核验支路 / 补充容量资料；UI 可做模拟对比，但不可直接开关或分断线路。
- 工单 WO-PWR-009：复核名牌及拓扑；收集同步负载曲线；评估计划接入与故障转供工况；由授权工程师审查变更方案；执行后复测并上传单线图修订。
- 复测演示：经批准调整接入方案后，QF-12 峰值 48A；新增负载所在支路峰值 45A；冗余工况计算附报告。仅满足现场批准的设计标准后人工验收，不用“低于80%”代替工程判断。

## 官方来源与可核验依据

S1｜Schneider Electric · EcoStruxure Battery Management System Solution Overview
https://productinfo.se.com/ecostruxurebms_guides/dd00594044-ecostruxure-battery-management-system-user-guide/English/EcoStruxureBMS_User_Guide_DD00594044.XML.xml/%24/EcoStruxureBMS_Solution_Overview_DD00594029.XML
依据：电池块电压、阻抗、温度连续监测；可配置电流、环境温湿度等传感输入。支撑传感器选择，不提供本原型阈值。

S2｜Schneider Electric · Battery Management System / Asset Advisor Release Notes
https://productinfo.se.com/eaa_rn/doca0283_eaa_rn/English/DOCA0283%20EcoStruxure%20Asset%20Advisor%20Release%20Notes_0001022413.xml/%24/RN_EcoStruxureAssetAdvisor_AnalyticsNewLayoutBatteryBanks_7.0_0001080602
依据：识别相对同串显著偏离单体；以容量与阻抗展示电池串；维护日志。支撑同组比较与日志入口，不能证明原型实现了这些算法。

S3｜Schneider Electric FAQ000242964 · Should I replace batteries in my single-phase Smart-UPS, if EcoStruxture IT Expert recommends UPS battery replacement?
https://www.se.com/us/en/faqs/FAQ000242964/
依据：UPS Score 受温度、UPS/电池年龄、告警影响；安装/更换日期不准会影响建议；应按文档对适用 UPS 执行自检并核验结果。寿命已尽时即使自检通过也建议更换。

S4｜Vertiv · Liebert CRV CRD10 User Manual · SL-70637 Rev7 01-23 · Appendix C / printed page 83
https://www.vertiv.com/4992f9/globalassets/products/thermal-management/in-row-cooling/liebert-crv-in-row-cooling-system-10-40kw/liebert-crv-crd10_user-manual_sl-70637_rev7_01-23_web.pdf
依据：高送风/回风温度按设备设定触发；Filter Clogged 表示滤网堵塞，Filter Maintenance 表示未按规定周期维护；Airflow Loss 对应风机不能正常工作。告警适用 CRD10，别将此映射冒充任意 CRAC 的实际协议点表。

S5｜Vertiv · Thermal Remote Monitoring
https://www.vertiv.com/en-asia/services-catalog/maintenance-services/remote-services/thermal-remote-monitoring/
依据：持续监测、实时负载洞察、设备告警与健康报告、推荐行动计划。该服务页并不规定具体滤网处理流程或验收时间。

S6｜Schneider Electric · Capacity Management (IEC) · ESXP2GE012EN-05 · 11/2023
https://productinfo.se.com/esxp_digital_apps_iec/cm/English/BM_ESXP_DG_Capacity_Management_IEC.pdf
依据：第5–7页实时/历史容量、配置告警及专家建议；第10–12页电流、功率、能耗及时间同步；第13页支路负载与额定容量比较、UPS/发电机冗余分析；第14–15页报告。原文明确项目需专业风险评估，不能替代现场设计验证。

## 推荐结构（可直接作为前端类型）

Scenario { id, assetId, title, demo:true, severity, stage, observedAt, evidence:[{id,metric,value,unit,baseline,window,quality}], relations:[{from,to,type}], knowledgeIds, assessment:{facts,hypothesis,alternatives,missingEvidence,limitations}, decision:{status,choice,owner,reason}, workOrder:{id,status,steps,requiresApproval}, retest:{before,after,window,report,acceptedBy,outcome} }

推荐页面文案：AI 辅助研判 / 证据与依据 / 待人工确认 / 生成检查工单草稿 / 记录复测结果 / 验收关闭。不要使用：AI已自动修复 / 真实预测准确率 / 保证避免故障 / 未核验的寿命预测。
