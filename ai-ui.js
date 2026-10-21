"use strict";
/* Live AI is an optional, server-mediated advisory layer. No browser-held API key. */
const AIUI = {
  csrf: null,
  config: null,
  busy: false,
  preview: null,
  wiki: null,
  wikiPage: null,
  wikiResults: null,
  evaluation: null,
};
async function aiApi(path, body) {
  if (body !== undefined && !AIUI.csrf) {
    const r = await fetch("/api/session", { credentials: "same-origin" });
    if (!r.ok) throw Error("无法创建安全会话");
    AIUI.csrf = (await r.json()).csrfToken;
  }
  const r = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-CSRF-Token": AIUI.csrf },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("服务返回非 JSON 响应，请检查本地服务是否启动。");
  }
  if (!r.ok)
    throw Error(data.error?.message || data.error || `服务错误 ${r.status}`);
  return data;
}
function aiStatus(id, text, bad = false) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
    el.classList.toggle("ai-error", bad);
  }
}
function aiError(e, id = "ai-status") {
  aiStatus(id, e.message, true);
  toast(e.message);
}
function aiConfigFields() {
  const c = AIUI.config || {};
  return `<div class="form-grid"><div><label for="ai-provider">提供方</label><select id="ai-provider" onchange="aiProviderDefaults()">${[
    ["deepseek", "DeepSeek"],
    ["qwen", "Qwen / 通义千问"],
    ["local", "本地 OpenAI 兼容服务"],
  ]
    .map(
      ([v, n]) =>
        `<option value="${v}" ${c.provider === v ? "selected" : ""}>${n}</option>`,
    )
    .join(
      "",
    )}</select></div><div><label for="ai-model">模型名称</label><input id="ai-model" value="${esc(c.model || "deepseek-flash")}" autocomplete="off"></div><div><label for="ai-base">API Base URL</label><input id="ai-base" value="${esc(c.baseURL || "https://api.deepseek.com")}" autocomplete="off"></div><div><label for="ai-key">API Key（留空保留；不回显）</label><input id="ai-key" type="password" autocomplete="new-password" placeholder="仅发送至本地服务端，不写入浏览器存储"></div><div><label for="ai-timeout">超时（毫秒）</label><input id="ai-timeout" type="number" min="1000" max="60000" value="${Number(c.timeoutMs) || 30000}"></div><div><label for="ai-retries">重试次数</label><input id="ai-retries" type="number" min="0" max="1" value="${Number(c.maxRetries) || 0}"></div></div><p>密钥状态：${!AIUI.config ? "未读取，请先读取服务端配置" : c.hasKey ? "服务端已配置（浏览器不可读取）" : "尚未配置"}。各提供方独立保存配置；修改当前提供方地址需重新提供密钥。</p><label class="ai-checkbox"><input id="ai-clear" type="checkbox">删除服务端已存密钥</label>`;
}
views.aiSettings = () =>
  `<section class="card"><h2>真实 AI 接入设置</h2><p>模型只生成辅助建议。审批、派单、设备操作、复测结论与关闭工单均由人处理。所有设备数据仍为合成演示。</p><p>服务端配置与本地演示身份不同：演示角色切换不是生产身份认证。仅在可信本机环境使用。</p><div id="ai-config-fields">${aiConfigFields()}</div><div class="toolbar"><button onclick="aiLoadConfig()">读取服务端配置</button><button class="primary" onclick="aiSaveConfig()">保存到服务端</button><button onclick="aiTestConnection()">测试连接（会调用模型）</button></div><p id="ai-status" role="status">未测试连接；不会自动调用真实模型。</p></section>`;
async function aiLoadConfig() {
  try {
    AIUI.config = await aiApi("/api/config");
    if ($("#ai-config-fields"))
      $("#ai-config-fields").innerHTML = aiConfigFields();
    aiStatus("ai-status", "已读取服务端配置。密钥不会返回浏览器。");
  } catch (e) {
    aiError(e);
  }
}
function aiProviderDefaults() {
  const p = $("#ai-provider").value,
    saved = AIUI.config?.profiles?.[p],
    defaults = {
      deepseek: {
        baseURL: "https://api.deepseek.com",
        model: "deepseek-flash",
      },
      qwen: {
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
      },
      local: { baseURL: "http://127.0.0.1:11434/v1", model: "qwen2.5:7b" },
    }[p],
    profile = { ...defaults, ...saved, provider: p };
  AIUI.config = { ...AIUI.config, ...profile };
  $("#ai-config-fields").innerHTML = aiConfigFields();
  $("#ai-key").value = "";
  aiStatus("ai-status", `已选择 ${p} 的独立配置，点击保存后用于后续模型调用。`);
}
async function aiSaveConfig() {
  if (!allowed("admin")) return denied();
  const key = $("#ai-key");
  const body = {
    provider: $("#ai-provider").value,
    model: $("#ai-model").value.trim(),
    baseURL: $("#ai-base").value.trim(),
    apiKey: key.value,
    clearKey: $("#ai-clear").checked,
    timeoutMs: Number($("#ai-timeout").value),
    maxRetries: Number($("#ai-retries").value),
  };
  key.value = "";
  try {
    AIUI.config = await aiApi("/api/config", body);
    aiStatus("ai-status", "配置已保存到服务端。未调用模型。");
    if ($("#ai-config-fields"))
      $("#ai-config-fields").innerHTML = aiConfigFields();
  } catch (e) {
    aiError(e);
  } finally {
    body.apiKey = "";
  }
}
async function aiTestConnection() {
  if (!allowed("admin") || AIUI.busy) return;
  AIUI.busy = true;
  aiStatus("ai-status", "正在测试已保存配置，这会产生一次模型调用…");
  try {
    const r = await aiApi("/api/connection/test", {});
    aiStatus(
      "ai-status",
      `连接成功：${r.provider} / ${r.model}。${r.result?.summary || ""}`,
    );
  } catch (e) {
    aiError(e);
  } finally {
    AIUI.busy = false;
  }
}
modules.push(["aiSettings", "AI 接入设置", "服务与知识"]);
subtitles.aiSettings =
  "API Key 只保存在服务端；连接测试和真实推理均须主动触发。";
PEOPLE.admin.pages.push("aiSettings");
const AI_FAMILY = {
  UPS: "ups",
  蓄电池组: "battery",
  精密空调: "cooling",
  配电柜: "distribution",
  温湿度传感器: "sensor",
  柴油发电机: "generator",
};
// Explicit bindings for this synthetic fixture set, not workorder or firmware versions.
const SEED_KNOWLEDGE_VERSIONS = Object.freeze({
  "HC-PAC30": "demo-v1",
  "HC-UPS40": "demo-v1",
  "HC-BAT192": "demo-v1",
});
function aiWorkContext(w) {
  const d = dev(w.device),
    c = CASES[w.journey];
  return {
    id: w.id,
    workorderVersion: w.version,
    scenario: { cooling: "s1", battery: "s2", energy: "s3" }[w.journey],
    phase: w.phase,
    title: w.title,
    deviceId: d.id,
    deviceType: d.type,
    family: w.journey === "energy" ? "hvac" : AI_FAMILY[d.type],
    model: d.model,
    version: d.knowledgeVersion || SEED_KNOWLEDGE_VERSIONS[d.model] || "",
    quality: w.flow?.quality || d.quality,
    description: w.description,
    evidence: w.evidence,
    checks: w.checkRecords || w.flow?.checks || [],
    tests: w.tests,
    scenarioEvidence: c
      ? {
          metric: c.metric,
          unit: c.unit,
          series: c.series,
          window: c.window,
          facts: c.facts,
          risk: c.risk,
        }
      : undefined,
  };
}
function aiCitationButtons(record, workId = null, recordIndex = null) {
  return (
    (record.result.citations || [])
      .map((id, citationIndex) => {
        const saved = (record.sourceSnapshots || []).some(
          (source) => source.id === id,
        );
        const action =
          workId === null
            ? `aiOpenSource(null,null,${citationIndex})`
            : `aiOpenSource(${JSON.stringify(workId)},${recordIndex},${citationIndex})`;
        return `<button class="ai-source-snapshot" onclick="${esc(action)}">${esc(id)} · ${saved ? "调用时来源快照" : "历史快照不可用"}</button>`;
      })
      .join(" ") || "没有可核验引用"
  );
}
function aiOpenSource(workId, recordIndex, citationIndex) {
  const record =
    workId === null
      ? AIUI.preview
      : WO.get(workId)?.aiSuggestions?.[recordIndex];
  const id = record?.result?.citations?.[citationIndex];
  if (typeof id !== "string") return toast("来源记录不可用");
  const source = record.sourceSnapshots?.find((item) => item.id === id);
  const current = /^[a-z0-9][a-z0-9-]{0,95}$/.test(id)
    ? `<button onclick="wikiOpen('${id}')">另查当前 Wiki 页面（可能已更新，非本次历史来源）</button>`
    : "";
  if (!source)
    return modal(
      "历史来源不可用",
      `<p>此旧记录没有保存调用时的来源内容与哈希，不能用当前页面冒充原始依据。</p><p>${esc(id)}</p>${current}`,
    );
  modal(
    "调用时来源快照 · " + (source.title || source.id),
    `<p>这是随本次 AI 返回保存的引用快照，不会随 Wiki 修订变化。</p><dl><dt>来源 ID</dt><dd>${esc(source.id)}</dd><dt>设备族 / 型号 / 版本</dt><dd>${esc(source.family)} / ${esc(source.model || (source.models || []).join(", "))} / ${esc(source.version)}</dd><dt>SHA-256</dt><dd>${esc(source.sha256)}</dd></dl><pre class="ai-eval-result">${esc(source.content || "")}</pre>${current}`,
  );
}
function aiPanel(w) {
  return `<section class="support-block ai-assist"><span class="eyebrow">LIVE AI · 人工采纳</span><h3>工单 AI 辅助 · ${esc(w.id)}</h3><p>向已配置服务发送本工单的合成证据。适用知识版本：${esc(aiWorkContext(w).version || "未绑定，不检索适用资料")}。输出先预览，人工采纳只追加建议证据，不审批、不派单、不控制、不关闭。</p><div class="toolbar">${[
    ["diagnosis", "诊断建议"],
    ["proposal", "方案草案"],
    ["retest", "复测解释"],
    ["knowledge", "生成知识候选"],
  ]
    .map(([a, t]) => `<button onclick="aiRun('${w.id}','${a}')">${t}</button>`)
    .join(
      "",
    )}</div><label for="ai-query">补充问题（选填，不填写密钥或敏感资料）</label><textarea id="ai-query" maxlength="2000"></textarea><p id="ai-work-status" role="status">未调用模型。证据质量不合格会阻断诊断、方案与复测解释。</p><div id="ai-preview"></div>${(w.aiSuggestions || []).length ? `<h4>已采纳的辅助证据</h4>${w.aiSuggestions.map((x, recordIndex) => `<div class="split-note"><b>${esc(x.id)} · ${esc(x.action)}</b><p>${esc(x.result.summary)}</p><small>${esc(x.provider)} / ${esc(x.model)} · ${esc(x.actor)} · ${esc(x.time)}</small><p>采纳依据：${esc(x.note)}</p><p>来源：${aiCitationButtons(x, w.id, recordIndex)}</p></div>`).join("")}` : ""}</section>`;
}
function aiDisplayedWorkId() {
  if (!detailDialog.open || !detail || detail.tab !== "analysis") return null;
  return detail.type === "work"
    ? detail.id
    : detail.caseId
      ? jr(detail.caseId).workId
      : null;
}
function aiRequestContextMatches(context) {
  return (
    !!context &&
    aiDisplayedWorkId() === context.id &&
    state.demoPerson === context.actorId &&
    $("#ai-preview") === context.previewElement
  );
}
function aiEngineerMayAssist(w) {
  return !allowed("engineer") || w.ownerId === state.demoPerson;
}
async function aiRun(id, action) {
  const w = WO.get(id);
  if (
    !w ||
    !allowed("analyst", "engineer", "supervisor") ||
    !aiEngineerMayAssist(w) ||
    aiDisplayedWorkId() !== id
  )
    return denied();
  if (AIUI.busy) return toast("已有模型请求处理中");
  if (
    action !== "knowledge" &&
    (w.flow?.quality || dev(w.device).quality) !== "有效"
  )
    return toast("证据质量不合格，请先修复并复核");
  AIUI.busy = true;
  AIUI.preview = null;
  aiStatus("ai-work-status", "正在调用已配置模型，工单状态不会改变…");
  if ($("#ai-preview")) $("#ai-preview").textContent = "";
  const version = w.version;
  const context = {
    id,
    actorId: state.demoPerson,
    previewElement: $("#ai-preview"),
  };
  try {
    const response = await aiApi("/api/ai", {
      action,
      workorder: aiWorkContext(w),
      query: $("#ai-query")?.value || "",
    });
    if (!aiRequestContextMatches(context)) {
      toast(`工单 ${id} 的 AI 返回已丢弃：当前工单、身份或视图已变化。`);
      return;
    }
    AIUI.preview = { ...response, ...context, action, version };
    aiStatus(
      "ai-work-status",
      `已返回 ${response.provider} / ${response.model} 的辅助建议，尚未采纳。`,
    );
    aiDrawPreview();
  } catch (e) {
    if (aiRequestContextMatches(context)) aiError(e, "ai-work-status");
    else toast(`工单 ${id} 的 AI 请求未完成，当前视图未更改。`);
  } finally {
    AIUI.busy = false;
  }
}
function aiDrawPreview() {
  const p = AIUI.preview,
    el = $("#ai-preview");
  if (!p || !el || !aiRequestContextMatches(p)) return;
  const r = p.result;
  el.innerHTML = `<article class="ai-result"><h4>工单 ${esc(p.id)} · 模型输出 · 待人工核验</h4><p>${esc(r.summary)}</p>${["hypotheses", "steps", "limitations"].map((k) => (Array.isArray(r[k]) && r[k].length ? `<h5>${{ hypotheses: "候选解释", steps: "建议步骤", limitations: "限制与不确定性" }[k]}</h5><ul>${r[k].map((s) => `<li>${esc(typeof s === "string" ? s : JSON.stringify(s))}</li>`).join("")}</ul>` : "")).join("")}<p>引用：${aiCitationButtons(p)}</p><p>调用追溯：${esc(p.requestId || "未返回")} · ${esc(p.timestamp || "")} · ${esc(p.durationMs ?? "—")} ms · ${esc(p.attempts ?? "—")} 次尝试</p><p>Token 用量：${esc(JSON.stringify(p.usage || {}))} · 请求模型：${esc(p.requestedModel || p.model)}</p>${p.proposal ? `<p>已生成知识候选 ${esc(p.proposal.id)}，尚未发布。请在“知识与案例库 → 导入资料与人工审核发布”核验并审核。</p>` : ""}<label for="ai-accept-note">人工核验与采纳依据（必填）</label><textarea id="ai-accept-note"></textarea><button class="primary" onclick="aiAccept()">采纳为工单辅助证据</button><button onclick="AIUI.preview=null;document.getElementById('ai-preview').textContent=''">放弃本次建议</button></article>`;
}
function aiAccept() {
  const p = AIUI.preview,
    w = p && WO.get(p.id),
    note = $("#ai-accept-note")?.value.trim();
  if (!p || !w) return toast("未采纳：当前没有可采纳的模型建议，请重新生成");
  if (!note) return toast("未采纳：请先填写「人工核验与采纳依据」");
  if (!allowed("analyst", "engineer"))
    return toast("未采纳：仅分析或工程岗位可以采纳模型建议");
  if (!aiEngineerMayAssist(w))
    return toast("未采纳：当前工程师不是该工单的被指派人");
  if (["closed", "cancelled"].includes(w.phase))
    return toast("未采纳：工单已关闭或已取消，不能再采纳建议");
  if (w.version !== p.version)
    return toast("未采纳：工单在生成建议后已被更新，请重新生成建议");
  if (!aiRequestContextMatches(p))
    return toast("未采纳：当前工单或身份已变化，请重新生成建议");
  if (
    p.action !== "knowledge" &&
    (w.flow?.quality || dev(w.device).quality) !== "有效"
  )
    return toast("证据质量已变化，不能采纳");
  const record = {
    id: `AI-${w.id}-${(w.aiSuggestions || []).length + 1}`,
    workId: w.id,
    action: p.action,
    result: JSON.parse(JSON.stringify(p.result)),
    provider: p.provider,
    model: p.model,
    sourceIds: [...(p.sourceIds || [])],
    sourceSnapshots: JSON.parse(JSON.stringify(p.sourceSnapshots || [])),
    requestId: p.requestId,
    timestamp: p.timestamp,
    durationMs: p.durationMs,
    attempts: p.attempts,
    usage: p.usage,
    requestedModel: p.requestedModel,
    proposalId: p.proposal?.id,
    actor: person().name,
    time: new Date().toISOString(),
    note,
  };
  (w.aiSuggestions ||= []).push(record);
  w.evidence.push({
    id: record.id,
    workId: w.id,
    kind: "人工采纳的 AI 辅助建议（不是现场证据）",
    time: record.time,
    summary: p.result.summary,
  });
  workAudit(w, "人工采纳 AI 辅助建议", `${record.id}；${note}`);
  AIUI.preview = null;
  render();
  toast("已追加辅助证据；工单状态未改变");
}
const aiDrawDetailBase = drawDetail;
drawDetail = () => {
  AIUI.preview = null;
  aiDrawDetailBase();
  if (!detailDialog.open || !detail) return;
  const w =
    detail.type === "work"
      ? WO.get(detail.id)
      : detail.caseId
        ? WO.get(jr(detail.caseId).workId)
        : null;
  if (w && detail.tab === "analysis") {
    const body = detailDialog.querySelector(".drawer-content");
    if (body) body.insertAdjacentHTML("beforeend", aiPanel(w));
  }
};
// Backend-backed local Wiki: original Markdown is escaped; links are explicit application actions.
function wikiMarkdown(text) {
  return esc(text || "")
    .replace(
      /\[\[([\w./-]+)(?:\|([^\]]+))?\]\]/g,
      (_, id, label) =>
        `<button class="wiki-link" onclick="wikiOpen('${id}')">${label || id}</button>`,
    )
    .replace(/\n/g, "<br>");
}
function wikiHome() {
  const g = AIUI.wiki;
  return `<section class="card"><h2>本地知识 Wiki · 图谱与来源</h2><p>可浏览的页面、双向链接与原始来源。合成教学内容不是厂家批准规程；AI 不能发布知识或直接改变工单。</p><div class="toolbar"><input id="wiki-search" aria-label="搜索 Wiki" placeholder="搜索页面、设备族或关键词"><button onclick="wikiSearch()">搜索</button><button onclick="wikiLoad()">加载 / 刷新图谱</button></div><p id="wiki-status" role="status">${g ? "图谱已加载" : "点击加载以读取本地服务知识文件"}</p><div id="wiki-results"></div><div id="wiki-graph">${g ? wikiGraphHTML(g) : ""}</div><div id="wiki-page">${AIUI.wikiPage ? wikiPageHTML(AIUI.wikiPage) : ""}</div></section>`;
}
function wikiGraphSVG(g) {
  const safeId = (id) =>
    typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,95}$/.test(id);
  const nodes = (g.nodes || [])
    .filter((n) => safeId(n.id))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!nodes.length) return "<p>当前图谱没有可显示节点。</p>";
  const category = (n) =>
    n.kind === "raw"
      ? "raw"
      : n.entityType === "device" ||
          n.kind === "device" ||
          n.id.startsWith("device-")
        ? "device"
        : "compiled";
  const lanes = ["device", "compiled", "raw"],
    labels = { device: "设备实体", compiled: "知识页面", raw: "原始资料" };
  const buckets = Object.fromEntries(
    lanes.map((k) => [k, nodes.filter((n) => category(n) === k)]),
  );
  const positions = new Map();
  for (const [column, k] of lanes.entries())
    buckets[k].forEach((n, row) =>
      positions.set(n.id, { x: 24 + column * 270, y: 62 + row * 96 }),
    );
  const height = Math.max(
    250,
    100 + Math.max(...lanes.map((k) => buckets[k].length)) * 96,
  );
  const edges = (g.edges || []).filter(
    (e) => positions.has(e.source) && positions.has(e.target),
  );
  return `<div class="wiki-graph-legend"><span class="device">设备实体</span><span class="compiled">知识页面</span><span class="raw">原始资料</span><small>箭头为文件中实际解析的链接；点击节点查阅 Markdown 与来源。</small></div><div class="wiki-graph-canvas"><svg class="wiki-graph-svg" viewBox="0 0 810 ${height}" role="img" aria-label="本地 Wiki 实际页面关系图，${nodes.length} 个节点，${edges.length} 条关系"><defs><marker id="wiki-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#9aaac0"/></marker></defs>${lanes.map((k, i) => `<text class="wiki-lane-title" x="${24 + i * 270}" y="30">${labels[k]}</text>`).join("")}${edges
    .map((e) => {
      const a = positions.get(e.source),
        b = positions.get(e.target),
        right = b.x >= a.x,
        x1 = a.x + (right ? 220 : 0),
        x2 = b.x + (right ? 0 : 220),
        y1 = a.y + 32,
        y2 = b.y + 32,
        mid = (x1 + x2) / 2;
      return `<path class="wiki-graph-edge" data-source="${e.source}" data-target="${e.target}" d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" fill="none" stroke="#9aaac0" stroke-width="1.5" marker-end="url(#wiki-arrow)"><title>${esc(e.source)} → ${esc(e.target)} · ${esc(e.type || "wikilink")}</title></path>`;
    })
    .join("")}${nodes
    .map((n) => {
      const p = positions.get(n.id),
        kind = category(n),
        title = String(n.title || n.id),
        short = title.length > 14 ? title.slice(0, 13) + "…" : title;
      return `<g class="wiki-graph-node ${kind}" data-id="${n.id}" role="button" tabindex="0" aria-label="打开 ${esc(title)}" onclick="wikiOpen('${n.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();wikiOpen('${n.id}')}" transform="translate(${p.x} ${p.y})"><title>${esc(title)} · ${esc(n.id)}${n.stale ? " · 来源已过期" : ""}</title><rect width="220" height="64" rx="10"/><text x="12" y="25">${esc(short)}</text><text class="wiki-node-meta" x="12" y="47">${esc(n.family || labels[kind])} · ${n.stale ? "来源已变更" : esc(n.reviewStatus || "未标记")}</text></g>`;
    })
    .join("")}</svg></div>`;
}
function wikiGraphHTML(g) {
  return `<h3>页面关系图</h3>${wikiGraphSVG(g)}<details class="wiki-graph-alternative"><summary>无障碍节点与关系列表</summary><div class="wiki-nodes">${(g.nodes || []).map((n) => `<button class="wiki-node" onclick="wikiOpen('${esc(n.id)}')"><b>${esc(n.title || n.id)}</b><small>${esc(n.family || n.kind || "")} · ${esc(n.reviewStatus || "未标记")}${n.stale ? " · ⚠ 来源已变更，不用于检索" : ""}</small></button>`).join("")}</div><ul class="wiki-edges">${(g.edges || []).map((e) => `<li><button onclick="wikiOpen('${esc(e.source)}')">${esc(e.source)}</button> → <button onclick="wikiOpen('${esc(e.target)}')">${esc(e.target)}</button> · ${esc(e.type)}</li>`).join("")}</ul></details>`;
}
function wikiPageHTML(p) {
  return `<article class="wiki-article"><h3>${esc(p.title || p.id)}</h3><p>${esc(p.id)} · ${esc(p.family || "")} · ${esc(p.model || "")} · ${esc(p.version || "")} · ${esc(p.reviewStatus || "")}</p>${p.stale ? '<p class="ai-error">来源已变更：本页需重新编译与审核，当前不用于 AI 检索。</p>' : ""}<div class="wiki-prose">${wikiMarkdown(p.markdown || p.content)}</div><h4>原始来源</h4>${(p.sourceIds || []).map((id) => `<button onclick="wikiOpen('${esc(id)}')">${esc(id)}</button>`).join(" ") || "<p>本页未列来源。</p>"}<h4>反向链接</h4>${(p.backlinks || []).map((id) => `<button onclick="wikiOpen('${esc(typeof id === "string" ? id : id.id)}')">${esc(typeof id === "string" ? id : id.title || id.id)}</button>`).join(" ") || "暂无"}<p class="subtext">来源标记：${esc(p.sourceType || p.provenance?.sourceType || "合成 / 以页面标记为准")}</p></article>`;
}
async function wikiLoad() {
  try {
    AIUI.wiki = await aiApi("/api/wiki/graph");
    if ($("#wiki-graph")) $("#wiki-graph").innerHTML = wikiGraphHTML(AIUI.wiki);
    aiStatus(
      "wiki-status",
      `${AIUI.wiki.nodes.length} 个节点，${AIUI.wiki.edges.length} 条关系`,
    );
  } catch (e) {
    aiError(e, "wiki-status");
  }
}
async function wikiSearch() {
  try {
    const q = $("#wiki-search")?.value || "";
    const data = await aiApi("/api/wiki/search?query=" + encodeURIComponent(q));
    const rows = Array.isArray(data) ? data : data.results || data.pages || [];
    AIUI.wikiResults = rows;
    if ($("#wiki-results"))
      $("#wiki-results").innerHTML =
        `<h3>${rows.length} 条结果</h3>${rows.map((p) => `<button onclick="wikiOpen('${esc(p.id)}')">${esc(p.title || p.id)}</button>`).join(" ")}`;
    aiStatus("wiki-status", "搜索完成，点击结果打开页面与来源。");
  } catch (e) {
    aiError(e, "wiki-status");
  }
}
async function wikiOpen(id) {
  try {
    const p = await aiApi("/api/wiki/page?id=" + encodeURIComponent(id));
    AIUI.wikiPage = p;
    if ($("#wiki-page")) {
      $("#wiki-page").innerHTML = wikiPageHTML(p);
      $("#wiki-page").scrollIntoView?.({ block: "nearest" });
    } else modal("Wiki · " + (p.title || p.id), wikiPageHTML(p));
  } catch (e) {
    toast("知识页面读取失败：" + e.message);
  }
}
const originalKnowledgeView = views.knowledge;
views.knowledge = () =>
  wikiHome() +
  `<details class="card"><summary>场景内置知识与已验收案例（离线参考）</summary>${originalKnowledgeView()}</details>`;
subtitles.assistant =
  "离线规则示例与服务端真实 AI 明确区分；真实 AI 从具体工单发起，人工采纳后才留档。";
const originalAssistantView = views.assistant;
views.assistant = () =>
  `<section class="card"><h2>从工单进入真实 AI 辅助</h2><p>先接管告警或新建工单，再在右侧“AI 研判与知识依据”调用诊断、方案、复测解释或知识问答。模型不直接控制业务状态。</p><button onclick="navigate('work')">打开工单中心</button>${allowed("admin") ? "<button onclick=\"navigate('aiSettings')\">配置真实 AI</button>" : ""}</section><details><summary>离线规则问答（非真实 AI）</summary>${originalAssistantView()}</details>`;
const originalEnergyView = views.energy;
views.energy = () =>
  `<section class="card"><h2>S3 · 同负载能耗异常与优化验证</h2><p>IT 负载 62±1%，室外 28±0.5°C，空调输入 12→18 kW。保持温度约束，先核实工况，再由人工批准优化与复测。</p><button class="primary" onclick="openCase('energy','evidence')">打开 S3 证据与工单链</button><p>所有值为合成示例；不能据此宣称真实节能率。</p></section>` +
  originalEnergyView();
window.AI_ASSIST = {
  run: aiRun,
  accept: aiAccept,
  context: aiWorkContext,
  api: aiApi,
};
render();
// Knowledge ingest, compile, review and publish are four explicit human actions.
function wikiAdminHTML() {
  return `<details class="card"><summary>导入资料与人工审核发布</summary><p>粘贴资料只保存原始页。AI 编译产生候选，不自动发布。上传前请去除密钥与敏感信息。</p><div class="form-grid"><div><label for="wiki-title">资料标题</label><input id="wiki-title"></div><div><label for="wiki-family">设备族</label><select id="wiki-family"><option value="cooling">制冷 / 精密空调</option><option value="ups">UPS / 蓄电池组</option><option value="distribution">配电</option><option value="sensor">传感器</option><option value="generator">柴油发电机</option></select></div><div><label for="wiki-model">适用型号</label><input id="wiki-model" placeholder="例如 HC-PAC30"></div><div><label for="wiki-version">资料版本</label><input id="wiki-version" placeholder="例如 v1"></div></div><label for="wiki-file">从本机读取 Markdown（仅填入下方正文，保存前不上传）</label><input id="wiki-file" type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" onchange="wikiReadFile(this)"><label for="wiki-raw">原始资料正文</label><textarea id="wiki-raw" rows="6"></textarea><button onclick="wikiIngest()">保存原始资料（不调用模型）</button><p id="wiki-admin-status" role="status"></p><label for="wiki-target">更新已有 Wiki 页面 ID（选填；留空创建新页）</label><input id="wiki-target" placeholder="先浏览已有页面确认目标 ID"><div id="wiki-ingested"></div><div class="toolbar"><button onclick="wikiProposals()">读取待审核候选</button><button onclick="wikiLint()">检查断链与过期引用</button></div><div id="wiki-proposals"></div></details>`;
}
const wikiKnowledgeView = views.knowledge;
views.knowledge = () =>
  wikiKnowledgeView() +
  (allowed("admin", "analyst", "supervisor") ? wikiAdminHTML() : "");
PEOPLE.admin.pages.push("knowledge");
async function wikiIngest() {
  if (!allowed("admin", "analyst", "supervisor")) return denied();
  try {
    const p = await aiApi("/api/wiki/ingest", {
      title: $("#wiki-title").value.trim(),
      markdown: $("#wiki-raw").value,
      family: $("#wiki-family").value,
      model: $("#wiki-model").value.trim(),
      version: $("#wiki-version").value.trim(),
    });
    aiStatus("wiki-admin-status", "原始资料已保存，尚未编译或发布。");
    $("#wiki-ingested").innerHTML =
      `<p>${esc(p.title)} · ${esc(p.id)}</p><button onclick="wikiOpen('${esc(p.id)}')">查看原始页</button><button onclick="wikiCompile('${esc(p.id)}')">AI 编译为候选（会调用模型）</button>`;
  } catch (e) {
    aiError(e, "wiki-admin-status");
  }
}
async function wikiCompile(id) {
  if (!allowed("admin", "analyst", "supervisor") || AIUI.busy) return;
  AIUI.busy = true;
  aiStatus("wiki-admin-status", "正在编译原始资料为待审核候选…");
  try {
    const r = await aiApi("/api/wiki/compile", {
      id,
      targetId: $("#wiki-target")?.value.trim() || undefined,
    });
    aiStatus(
      "wiki-admin-status",
      r.proposal
        ? "候选已保存，必须人工审核后才能发布。"
        : "模型未生成可保存候选。",
    );
    await wikiProposals();
  } catch (e) {
    aiError(e, "wiki-admin-status");
  } finally {
    AIUI.busy = false;
  }
}
async function wikiProposals() {
  try {
    const data = await aiApi("/api/wiki/proposals"),
      rows = Array.isArray(data) ? data : data.proposals || [];
    if ($("#wiki-proposals"))
      $("#wiki-proposals").innerHTML =
        `<h3>${rows.length} 个候选</h3>${rows.map((p) => `<article class="wiki-article"><h4>${esc(p.title)}</h4><p>${esc(p.id)} · ${esc(p.reviewStatus)} · 更新目标：${esc(p.targetId || "新建页面")} · ${esc(p.family)} / ${esc(p.model)} / ${esc(p.version)}</p><div class="wiki-prose">${wikiMarkdown(p.markdown)}</div><p>来源：${(p.sourceIds || []).map((id) => `<button onclick="wikiOpen('${esc(id)}')">${esc(id)}</button>`).join(" ")}</p>${p.reviewStatus === "candidate" ? `<label for="review-${esc(p.id)}">人工审核依据（核验来源、型号、版本及安全边界）</label><textarea id="review-${esc(p.id)}"></textarea><button onclick="wikiReview('${esc(p.id)}',true)">审核通过（仍不发布）</button><button onclick="wikiReview('${esc(p.id)}',false)">拒绝候选</button>` : ""}${p.reviewStatus === "approved" ? `<button class="primary" onclick="wikiPublish('${esc(p.id)}')">明确发布到 Wiki</button>` : ""}</article>`).join("")}`;
    aiStatus("wiki-admin-status", "候选列表已更新。");
  } catch (e) {
    aiError(e, "wiki-admin-status");
  }
}
async function wikiReview(id, approved) {
  if (!allowed("analyst", "supervisor"))
    return toast("由分析人员或主管独立审核候选");
  const note = document.getElementById("review-" + id)?.value.trim();
  if (!note) return toast("请填写人工审核依据");
  try {
    await aiApi("/api/wiki/review", { id, approved, note });
    await wikiProposals();
  } catch (e) {
    aiError(e, "wiki-admin-status");
  }
}
async function wikiPublish(id) {
  if (!allowed("admin", "supervisor"))
    return toast("由管理员或主管发布已审核候选");
  try {
    await aiApi("/api/wiki/publish", { id });
    await wikiProposals();
    await wikiLoad();
    aiStatus("wiki-admin-status", "已发布已审核知识，图谱与页面已刷新。");
  } catch (e) {
    aiError(e, "wiki-admin-status");
  }
}
async function wikiLint() {
  try {
    const data = await aiApi("/api/wiki/lint");
    if ($("#wiki-proposals"))
      $("#wiki-proposals").innerHTML =
        `<h3>结构检查（不代替专业审核）</h3><pre class="ai-eval-result">${esc(JSON.stringify(data, null, 2))}</pre>`;
  } catch (e) {
    aiError(e, "wiki-admin-status");
  }
}
modules.push(["evaluation", "独立评测", ""]);
modules.push(["scenarios", "场景演示", ""]);
subtitles.evaluation =
  "真实模型评测与固定规则基线分开报告；合成测试不能冒充现场指标验收。";
for (const id of ["admin", "analyst", "supervisor"])
  PEOPLE[id].pages.push("evaluation");
views.evaluation = () =>
  `<section class="card"><h2>独立评测 · R08–R11</h2><p>显式运行才会调用已配置模型，可能产生费用。Smoke 是快速检查，Full 使用完整独立合成测试集。规则基线与模型结果分别统计；未配置或失败不会伪造指标。</p><p>分别报告 R08 预测 R²（暂定口径）、R09 温度 MAE / 固定 20°C 量程、R10 能耗 WAPE、R11 知识匹配 sourceId / family / model / version / reasonCode 的 exact accuracy；阈值与分母见报告，无法评估则明确标记。通过合成集不等于真实现场验收。</p><div class="toolbar"><button onclick="evaluationRun('smoke')">运行 Smoke（真实调用）</button><button onclick="evaluationRun('full')">运行 Full（真实调用）</button><button onclick="evaluationCancel()">取消当前评测</button><button onclick="evaluationRefresh()">刷新最近报告</button><button onclick="evaluationExport()">导出 JSON 报告</button></div><p id="evaluation-status" role="status">尚未运行。此页面不会自动调用模型。</p><div id="evaluation-report">${AIUI.evaluation ? evaluationHTML(AIUI.evaluation) : ""}</div></section>`;
function evaluationHTML(r) {
  return `<h3>${esc(r.status || r.acceptanceStatus || "评测报告")}</h3><p>仅合成样本；请核对报告范围、样本数、失败项和证据。</p><pre class="ai-eval-result">${esc(JSON.stringify(r, null, 2))}</pre>`;
}
async function evaluationRun(scope) {
  if (!allowed("admin", "analyst", "supervisor") || AIUI.busy) return;
  AIUI.busy = true;
  aiStatus("evaluation-status", `正在启动 ${scope} 评测…`);
  try {
    AIUI.evaluation = await aiApi("/api/evaluation/run", { scope });
    AIUI.evaluationId = AIUI.evaluation.id || AIUI.evaluation.jobId;
    if ($("#evaluation-report"))
      $("#evaluation-report").innerHTML = evaluationHTML(AIUI.evaluation);
    aiStatus("evaluation-status", "评测已提交，正在读取状态。");
    await evaluationRefresh();
  } catch (e) {
    aiError(e, "evaluation-status");
  } finally {
    AIUI.busy = false;
  }
}
async function evaluationRefresh() {
  try {
    const r = await aiApi(
      "/api/evaluation/status" +
        (AIUI.evaluationId
          ? "?id=" + encodeURIComponent(AIUI.evaluationId)
          : ""),
    );
    AIUI.evaluation = r;
    AIUI.evaluationId = r.id || r.jobId || AIUI.evaluationId;
    if ($("#evaluation-report"))
      $("#evaluation-report").innerHTML = evaluationHTML(r);
    aiStatus(
      "evaluation-status",
      `评测状态：${r.status || r.acceptanceStatus || "已读取"}。`,
    );
    clearTimeout(AIUI.evalTimer);
    if (["queued", "running", "pending"].includes(r.status))
      AIUI.evalTimer = setTimeout(evaluationRefresh, 2000);
  } catch (e) {
    aiError(e, "evaluation-status");
  }
}
async function evaluationExport() {
  try {
    const data = await aiApi(
      "/api/evaluation/export" +
        (AIUI.evaluationId
          ? "?id=" + encodeURIComponent(AIUI.evaluationId)
          : ""),
    );
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "powerenv-independent-evaluation.json";
    a.click();
    URL.revokeObjectURL(url);
    aiStatus("evaluation-status", "已导出服务端报告，未更改评测结果。");
  } catch (e) {
    aiError(e, "evaluation-status");
  }
}
render();

async function wikiReadFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 200000) return toast("资料过大，请使用不超过 200 KB 的文本");
  try {
    const text = await file.text();
    $("#wiki-raw").value = text;
    if (!$("#wiki-title").value) $("#wiki-title").value = file.name;
    aiStatus(
      "wiki-admin-status",
      "已在浏览器读取文件，尚未上传。核对后点击保存原始资料。",
    );
  } catch (e) {
    aiError(e, "wiki-admin-status");
  }
}

async function evaluationCancel() {
  if (!allowed("admin", "analyst", "supervisor")) return denied();
  if (!AIUI.evaluationId) return toast("请先读取或启动评测任务");
  try {
    const r = await aiApi("/api/evaluation/cancel", { id: AIUI.evaluationId });
    AIUI.evaluation = r;
    if ($("#evaluation-report"))
      $("#evaluation-report").innerHTML = evaluationHTML(r);
    aiStatus(
      "evaluation-status",
      "已请求取消。当前请求可能仍需等候超时结束，后续样本不再调用模型。",
    );
    await evaluationRefresh();
  } catch (e) {
    aiError(e, "evaluation-status");
  }
}
