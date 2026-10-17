# PowerEnvOpt 多角色运维前端：职责与模拟交接设计

研究日期：2026-10-17。以下五个角色是面向该产品的业务设计建议，不是国家/行业强制标准角色，也不是某厂商原样内置角色。所有写入、派单、通知、配置及恢复均为浏览器内模拟，不触达设备或生产系统。

## 当前版本与研究建议的区别

本文件第 II–V 节描述较完整的目标设计，**不是全部已交付功能清单**。本次实际实现与可复现操作以 README 的 v3 演示路径为准。

已实现：固定六人/五岗位、不同首页菜单和共享待办，三条现有资产事件的接管→诊断→审批并指派→接单检查→复测→独立验收，普通告警/工单处理，详情抽屉五栏目、配置与模型操作的岗位守卫、原始/复测证据和案例引用。

尚未实现：SLA/超时提醒、交接班、班组/优先级/计划时间排程、重复事件合并、指定专家协作单、附件上传、知识草稿审批发布、真实通知、配置草稿发布、生产站点权限。所有演示人员可浏览三个站点，站点选择仅过滤页面。以下 ALM-2026-0142 等是研究示例，不是本次软件中的事件 ID。

## 一、官方依据与设计边界

1. Schneider EcoStruxure Building Operation《Acknowledging an Alarm》：确认表示已经看到告警并承担处理责任。由此应区分“确认”与“物理故障恢复”。
https://ecostruxure-building-help.se.com/bms/topics/show.castle?id=14280&locale=en-US&productversion=2023
2. Schneider EcoStruxure Power Operation《Acknowledging alarms》：允许确认时附加说明，并从历史查看记录。该产品的确认对象有特定定义级语义，不能未经设计直接照搬为本项目实例语义。
https://product-help.schneider-electric.com/EcoStruxure-Power-Operation-2022/content/6%20operating/webapps/alarms/acknowledging_alarms.htm
3. IBM Maximo Manage《Work order statuses》：待批准 WAPPR、批准 APPR、执行 INPRG、物理工作完成 COMP、关闭归档 CLOSE 是不同阶段。支撑“执行完成不直接等于验收关闭”的产品区分；Maximo 并不强制本文这一条固定流程。
https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=overview-work-order-statuses
4. ServiceNow《Work on an incident record in Service Operations Workspace》：分配组和负责人影响分配操作；事件可重新指派；解决需填写解决代码和说明。
https://www.servicenow.com/docs/r/it-service-management/service-operations-workspace/work-on-incident-sow.html
5. Schneider 官方 EcoStruxure IT Expert RBAC 说明（2022 年文章）：权限可以按位置、用户组限制；其 viewer/editor/administrator 与业务岗位不是一对一关系。本文的五角色是业务工作台，不能声称是厂商标准角色。
https://blog.se.com/datacenter/2022/07/22/bolster-data-center-management-security-role-based-access-control/
6. IBM Maximo IT《Configuration management job plans》：作业计划可提供结构化任务，应用到工单后可独立调整任务而不改变原计划。用于本原型“引用作业卡/知识条目，并记录版本”。
https://www.ibm.com/docs/en/max-it/cd?topic=content-configuration-management-job-plans

## 二、角色—首页—动作—边界矩阵（本产品建议）

| 角色 | 独立首页及主要模块 | 对同一事件可执行的动作 | 下一状态/交接对象 | 禁止或只读边界 |
|---|---|---|---|---|
| 值班监控员 operator | 值班台：未确认告警、超时响应、机房监测、交接班；侧栏告警中心/设备监测/交接记录 | 确认并备注；核查点位趋势；关联已有事件或提报维修；异常升级；提交恢复观测记录 | alarm.acknowledged；工单进入待派单，主管队列新增；告警恢复仅更新独立信号状态 | 不能替工程师填写检修结果，不能批准/验收，不能改阈值来消除告警 |
| 维护工程师 engineer | 我的作业：待接单、处理中、退回补充、今日巡检；侧栏我的工单/作业卡/设备档案 | 接受自己名下任务；开始检修；勾选检查项；填写测量与处理结果；申请专家协助；提交验收 | assigned→inProgress→pendingAcceptance；主管验收队列新增 | 不能接他人工单、给自己派单、批准自己的变更、验收自己的作业 |
| 运维主管 supervisor | 调度与验收：待派单、风险审批、待验收、人员负荷/SLA；侧栏工单调度/审批验收/团队绩效 | 指定班组及具体工程师；审批处置方案；退回并写原因；根据证据验收关闭；调整优先级 | pendingAssignment→assigned；pendingApproval→approved；pendingAcceptance→closed 或 inProgress | 自己作为执行人时不得自验收；“验收关闭”不应直接修改传感器实际值 |
| 专业分析师 analyst | 分析台：反复告警、待协作诊断、能耗异常、知识待整理；侧栏事件分析/能效趋势/知识库 | 对比趋势/历史事件；提交诊断建议；将建议附加工单；整理知识草稿；提出优化方案 | analysis.requested→responded；knowledge.draft→pendingReview；给工程师增加建议 | 不直接派单/验收、不远控设备、不将统计相关性写成确定根因 |
| 系统管理员 admin | 系统健康：采集器离线、点位缺失、同步质量、待配置变更；侧栏接入管理/点位配置/权限范围/审计日志 | 查看采集健康；模拟修复映射；配置模拟阈值/通知策略/站点范围；写配置审计 | config.draft→published；影响后续演示规则；现有事件保留原阈值快照 | 技术管理员不默认拥有业务验收权；不能清空历史掩盖问题；角色切换是演示身份而非安全登录 |

建议角色示例身份：刘值班（operator）、王工（engineer）与赵工（engineer2）、陈主管（supervisor）、周分析（analyst）、林管理员（admin）。角色与人员是两个字段，不能只用 currentRole 作为所有权依据。

## 三、状态模型

- 告警：signalState = active/recovered；acknowledgedAt、acknowledgedBy 独立。UI 可以显示“持续异常·已确认”或“已恢复·待确认”。不要以单枚 status 丢失二者。
- 事件：new/triaged/inProgress/resolved/closed，关联一个或多个告警。
- 工单（简化产品流程）：pendingAssignment → assigned → inProgress → pendingAcceptance → closed。风险方案额外用 approvalState = notRequired/pending/approved/rejected，避免把普通接单与风险批准混为一谈。
- 退回：pendingAcceptance → inProgress，必须有返工原因；保留原提交记录。
- 取消：仅未执行工单可取消，须说明；已执行后的终止单独标识，不能删除已产生过程记录。
- 所有动作记录 actorId/role/timestamp/from/to/comment，关联同一 incidentId、alarmId、workOrderId。前端 localStorage 持久化并提供“重置演示数据”；刷新不丢交接，切换身份不重置。

## 四、三条可验收的端到端旅程

### 旅程 A：高温告警 → 派单维修 → 独立验收
1. 值班员首页看到 ALM-2026-0142（A 区 3 号机柜入口温度超限，演示数据）；从列表打开详情抽屉，查看趋势、阈值、关联设备，填写“已核查同区温湿度，申请现场排查”，确认并创建维修提报。
2. 主管“待派单”立刻出现同一 incidentId；选择“制冷维护组 / 王工”、优先级和计划时间后派单。王工首页出现待接单，赵工首页不出现。
3. 王工接单开始作业，检查清单逐项记录；从知识库引用带版本的“送风异常排查卡”，提交处理说明、前后测量值及演示附件。
4. “模拟遥测恢复”作为独立演示动作或模拟事件更新 signalState；不能把“点验收”当作设备恢复。
5. 主管打开待验收抽屉，看到执行人、检查项、测量和观测窗口；批准后工单关闭，时间线保留各人步骤。证据不足则退回给王工，形成真实返工队列。
验收点：确认告警不消失；派单指定人有效；未完成检查项或缺少结果阻止提交；王工不能自验收；关闭留下记录。

### 旅程 B：复发告警 → 专家协作 → 方案审批
1. 值班员将复发告警关联到现有事件，不重复创建多个工单；计数和关联告警增加。
2. 工程师在工单内“请求专业协作”，选择周分析并填写问题，自己仍保留工单主责。
3. 分析师首页出现待协作；对比本地演示趋势与历史记录，提交“疑似送风分布异常”的证据及建议，工单建议面板同步更新。
4. 若建议涉及风险处置，工程师提交方案（影响、窗口、回退项），主管批准前按钮不能进入对应执行阶段。批准后由原工程师执行并提交验收。
5. 分析师整理为知识草稿；主管审阅后发布（本原型建议治理步骤，不宣称厂商统一规定），后续工单可引用该版本。
验收点：协作不偷偷改负责人；建议有作者与依据；工程师不能自批；草稿不直接冒充已验证知识。

### 旅程 C：采集异常 → 配置修复 → 业务复核
1. 值班员发现“数据陈旧 12 分钟”，创建数据质量事件；页面显示最后采样时间与 stale 标识，不能展示为实时正常。
2. 管理员“接入健康”收到该事件关联的配置任务；查看采集器/点位映射及模拟日志，填写修复说明后点击“模拟恢复采集”。
3. 新采样时间更新、质量恢复，历史缺口保持可见；管理员写入配置变更审计而非直接验收业务事件。
4. 值班员复核数据恢复并提交观察结果；主管验收关闭关联任务。若需调整告警阈值则单独展示草稿/发布和旧新值，保留原告警产生时阈值快照。
验收点：采集恢复不抹掉历史；管理员不可直接完成业务验收；变更有前后值、操作者及时间。

## 五、前端实现重点

1. 独立工作台路由/组件 + 每个角色正常业务模块页；共同复用事件/设备/工单详情抽屉；不要靠末尾附加流程向导替代页面。
2. 在 mutation handler/store 层校验 role + actorId + siteScope + state；按钮隐藏只改善体验，不能代替模拟权限校验。纯前端权限不是生产安全边界，应明确说明。
3. 操作后同时更新详情、角色队列、数量徽标、时间线与负责人；以状态导出的列表避免手填静态 KPI。
4. 表单应具备必填、校验、取消、成功反馈、重复点击保护；拒绝/退回须填写原因；指派不能只弹出“成功”提示。
5. 在顶部持续显示“演示模式 · 数据仅保存在当前浏览器”，危险动作写成“模拟…”；避免宣称已发送短信/控制设备/真实采样。
6. 站点切换应约束队列范围。管理员权限示例须展示范围；不应默认全球所有资产。
7. 保留一个统一关联详情和完整时间线，以跨角色工作变化证明协作；不需为每个角色复制五套互不相通的假数据。

## 六、本次实现约定

- 固定演示身份：刘值班、王工、赵工、陈主管、周分析、林管理员。
- 主路径可采用：值班确认并请求诊断 → 工程师/分析师分析 → 主管批准且指派王工或赵工 → 被指派工程师接单、检查、提交及复测 → 主管独立验收或退回。诊断阶段的协作参与不等于获得执行工单的所有权。
- 上下文右抽屉：概况 / 证据 / AI 与知识 / 处置建议 / 历史，保持当前业务模块背景。
- 关闭可联动工单、事件统计、设备显示和知识草稿，但只有模拟复测/遥测恢复证据才能把告警信号设为 recovered；“点击关闭”本身不是故障消除证据。知识自动联动应标为草稿/待审核，避免未经复核直接成为已验证规程。
