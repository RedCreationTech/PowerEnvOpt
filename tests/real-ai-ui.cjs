const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load } = require("./harness.cjs");
const results = [];
async function test(name, fn) {
  const h = load();
  try {
    await fn(h, h.w);
    assert.deepEqual(h.errors, []);
    results.push({ name, status: "PASS" });
  } catch (e) {
    results.push({ name, status: "FAIL", detail: e.stack });
  } finally {
    h.close();
  }
}
const setup = (h) =>
  h.eval(
    "wfAck('energy','同工况证据核验');switchPerson('analyst');workDetail(jr('energy').workId);detailTab('analysis');jr('energy').workId",
  );
(async () => {
  await test("all new surfaces and no implicit model call", (h, w) => {
    for (const p of [
      "admin",
      "analyst",
      "supervisor",
      "engineer",
      "operator",
    ]) {
      w.switchPerson(p);
      for (const page of w.WF.people[p].pages) {
        w.navigate(page);
        assert.ok(w.document.querySelector("#content").textContent.length > 0);
      }
    }
    assert.equal(h.requests.length, 0);
    w.switchPerson("admin");
    w.navigate("aiSettings");
    assert.equal(w.document.querySelector("#ai-key").type, "password");
    assert.equal(w.document.querySelector("#ai-timeout").max, "60000");
    assert.equal(w.document.querySelector("#ai-retries").max, "1");
  });
  await test("six device families never silently use UPS knowledge", (h, w) => {
    const rows = h.eval(
      "TYPES.map(type=>({type,id:deviceKnowledge({type,quality:'有效'}).id}))",
    );
    assert.equal(new Set(rows.map((x) => x.id)).size, 6);
    assert.equal(
      h.eval("deviceKnowledge({type:'unknown',quality:'有效'}).id"),
      "NO-MATCH",
    );
    assert.equal(rows.find((x) => x.type === "配电柜").id, "KB-DEMO-PDU-001");
  });
  await test("S3 lifecycle contains independent review and reopening invalidates recovered signal", (h, w) => {
    const f = w.WF,
      id = "energy";
    assert.equal(f.acknowledge(id, "核验"), true);
    f.switchPerson("analyst");
    assert.equal(f.analyze(id), true);
    f.switchPerson("supervisor");
    assert.equal(f.decide(id, "approve", f.cases[id].plans[0], "审批"), true);
    assert.equal(h.eval("decisionStage('energy')"), 2);
    assert.equal(f.dispatch(id, "engineer", "派单"), true);
    f.switchPerson("engineer");
    f.startWork(id);
    f.cases[id].checks.forEach((_, i) => f.check(id, i, true));
    f.submitChecks(id, "完成");
    assert.equal(f.retest(id, false, "复测失败"), true);
    assert.equal(f.getState().records[id].stage, "executing");
    f.cases[id].checks.forEach((_, i) => f.check(id, i, true));
    f.submitChecks(id, "重新完成");
    f.retest(id, true, "同负载验证");
    assert.equal(f.closeCase(id, "engineer", "自行关闭"), false);
    f.switchPerson("supervisor");
    f.closeCase(id, "supervisor", "独立验收");
    const wo = w.WO.get(f.getState().records[id].workId);
    assert.equal(wo.status, "已关闭");
    assert.equal(
      w.WO.transition(wo.id, "reopen", wo.version, { note: "新异常重开" }),
      true,
    );
    assert.equal(wo.phase, "requested");
    assert.equal(
      w.DEMO.getState().alarms.find((a) => a.id === f.cases[id].alarm)
        .signalState,
      "active",
    );
    assert.ok(wo.diagnoses.every((d) => d.superseded));
  });
  await test("real AI previews are escaped and manual acceptance cannot advance workflow", async (h, w) => {
    const id = setup(h),
      wo = w.WO.get(id),
      phase = wo.phase,
      calls = [];
    w.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        json: async () =>
          url === "/api/session"
            ? { csrfToken: "token" }
            : {
                result: {
                  summary: "<img src=x onerror=alert(1)>",
                  hypotheses: ["核查"],
                  steps: ["测量"],
                  citations: ["wiki-energy"],
                  limitations: ["合成"],
                },
                provider: "mock-test",
                model: "fixture",
                requestedModel: "fixture-request",
                sourceIds: ["wiki-energy"],
                usage: { total_tokens: 10 },
                requestId: "request-test",
                durationMs: 15,
                attempts: 1,
              },
      };
    };
    await w.AI_ASSIST.run(id, "diagnosis");
    assert.equal(wo.phase, phase);
    assert.equal(wo.aiSuggestions, undefined);
    assert.ok(
      w.document.querySelector("#ai-preview").textContent.includes("<img"),
    );
    assert.equal(w.document.querySelector("#ai-preview img"), null);
    w.document.querySelector("#ai-accept-note").value =
      "人工核验引用，保留限制";
    w.AI_ASSIST.accept();
    assert.equal(wo.phase, phase);
    assert.equal(wo.aiSuggestions.length, 1);
    assert.equal(wo.aiSuggestions[0].requestId, "request-test");
    assert.equal(wo.aiSuggestions[0].usage.total_tokens, 10);
    assert.equal(calls[1].opts.headers["X-CSRF-Token"], "token");
    const body = JSON.parse(calls[1].opts.body);
    assert.equal(body.workorder.model, "HC-PAC30");
    assert.equal(body.workorder.scenario, "s3");
    assert.equal(body.workorder.family, "hvac");
  });
  await test("stale AI preview and invalid quality cannot be accepted", async (h, w) => {
    const id = setup(h),
      wo = w.WO.get(id);
    w.fetch = async (url) => ({
      ok: true,
      json: async () =>
        url === "/api/session"
          ? { csrfToken: "x" }
          : {
              result: { summary: "建议", citations: [], limitations: [] },
              model: "mock",
              provider: "mock",
            },
    });
    await w.AI_ASSIST.run(id, "proposal");
    wo.version++;
    w.document.querySelector("#ai-accept-note").value = "review";
    w.AI_ASSIST.accept();
    assert.equal(wo.aiSuggestions, undefined);
    w.switchPerson("admin");
    w.WO.setQuality(id, "缺失");
    w.switchPerson("analyst");
    w.workDetail(id);
    w.detailTab("analysis");
    let called = false;
    w.fetch = async () => {
      called = true;
      throw Error("unexpected");
    };
    await w.AI_ASSIST.run(id, "diagnosis");
    assert.equal(called, false);
  });
  await test("provider profiles remain masked and credentials never enter browser persistence", async (h, w) => {
    w.switchPerson("admin");
    w.navigate("aiSettings");
    const profiles = {
      deepseek: {
        provider: "deepseek",
        model: "deepseek-flash",
        baseURL: "https://api.deepseek.com",
        hasKey: true,
      },
      qwen: {
        provider: "qwen",
        model: "qwen-plus",
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        hasKey: true,
      },
    };
    const calls = [];
    w.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        json: async () =>
          url === "/api/session"
            ? { csrfToken: "x" }
            : { ...profiles.deepseek, profiles },
      };
    };
    await w.aiLoadConfig();
    w.document.querySelector("#ai-provider").value = "qwen";
    w.aiProviderDefaults();
    assert.equal(w.document.querySelector("#ai-model").value, "qwen-plus");
    assert.equal(w.document.querySelector("#ai-key").value, "");
    w.document.querySelector("#ai-key").value = "TEST-ONLY-NOT-A-REAL-KEY";
    await w.aiSaveConfig();
    assert.equal(w.document.querySelector("#ai-key").value, "");
    assert.ok(
      !w.localStorage.getItem("hongchuang-power-demo-v1").includes("TEST-ONLY"),
    );
    assert.equal(JSON.parse(calls.at(-1).opts.body).provider, "qwen");
  });
  await test("Wiki uses backend graph/search/source pages and escaped text", async (h, w) => {
    w.switchPerson("analyst");
    w.navigate("knowledge");
    const calls = [];
    w.fetch = async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () =>
          url.includes("graph")
            ? {
                nodes: [
                  { id: "wiki-energy", title: "能耗知识", family: "cooling" },
                ],
                edges: [],
              }
            : url.includes("search")
              ? [{ id: "wiki-energy", title: "能耗知识" }]
              : {
                  id: "wiki-energy",
                  title: "能耗知识",
                  markdown: "<script>bad()</script> [[raw-source]]",
                  sourceIds: ["raw-source"],
                  backlinks: ["index"],
                },
      };
    };
    await w.wikiLoad();
    assert.ok(w.document.querySelector(".wiki-node"));
    w.document.querySelector("#wiki-search").value = "能耗";
    await w.wikiSearch();
    assert.ok(calls.at(-1).includes("query="));
    await w.wikiOpen("wiki-energy");
    assert.ok(calls.at(-1).includes("/page?id="));
    assert.equal(w.document.querySelector("#wiki-page script"), null);
    assert.ok(
      w.document.querySelector("#wiki-page").textContent.includes("<script>"),
    );
    assert.ok(
      w.document
        .querySelector("#wiki-page button")
        .textContent.includes("raw-source"),
    );
  });
  await test("evaluation explicit request keeps backend report and export separate", async (h, w) => {
    w.switchPerson("analyst");
    w.navigate("evaluation");
    const calls = [];
    w.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        json: async () =>
          url === "/api/session"
            ? { csrfToken: "x" }
            : url.includes("/run")
              ? { id: "test-job", status: "queued" }
              : {
                  id: "test-job",
                  status: "completed",
                  syntheticOnly: true,
                  metrics: { R11: { value: 0.5, pass: false } },
                  rows: [],
                },
      };
    };
    await w.evaluationRun("smoke");
    assert.equal(
      JSON.parse(calls.find((x) => x.url.includes("/run")).opts.body).scope,
      "smoke",
    );
    assert.ok(
      w.document
        .querySelector("#evaluation-report")
        .textContent.includes("0.5"),
    );
    await w.evaluationExport();
    assert.ok(h.downloads.length > 0);
  });
  await test("engineers can run and accept AI only for their assigned workorder", async (h, w) => {
    const id = setup(h),
      wo = w.WO.get(id);
    wo.ownerId = "engineer";
    w.switchPerson("engineer2");
    w.workDetail(id);
    w.detailTab("analysis");
    let calls = 0;
    w.fetch = async (url) => {
      calls++;
      return {
        ok: true,
        json: async () =>
          url === "/api/session"
            ? { csrfToken: "x" }
            : {
                result: { summary: "review", citations: [], limitations: [] },
                provider: "mock",
                model: "fixture",
              },
      };
    };
    await w.AI_ASSIST.run(id, "diagnosis");
    assert.equal(calls, 0);
    assert.equal(wo.aiSuggestions, undefined);
    w.switchPerson("engineer");
    w.workDetail(id);
    w.detailTab("analysis");
    await w.AI_ASSIST.run(id, "diagnosis");
    assert.ok(calls > 0);
    assert.ok(w.document.querySelector("#ai-preview").textContent.includes(id));
    wo.ownerId = "engineer2";
    w.document.querySelector("#ai-accept-note").value =
      "cannot accept another assignment";
    w.AI_ASSIST.accept();
    assert.equal(wo.aiSuggestions, undefined);
  });
  await test("pending AI response is discarded after switching to another workorder", async (h, w) => {
    const id = setup(h),
      first = w.WO.get(id);
    h.eval("AIUI.csrf='fixture'");
    let finish;
    w.fetch = () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            ok: true,
            json: async () => ({
              result: {
                summary: "wrong drawer marker",
                citations: [],
                limitations: [],
              },
              model: "fixture",
              provider: "mock",
            }),
          });
      });
    const pending = w.AI_ASSIST.run(id, "diagnosis");
    const secondId = w.WO.create({
      title: "Different work",
      description: "New evidence",
      device: "HC-BJ-001",
      site: w.WO.sites[0],
      type: "故障处理",
      priority: "中",
    });
    w.workDetail(secondId);
    w.detailTab("analysis");
    finish();
    await pending;
    assert.equal(w.document.querySelector("#ai-preview").textContent, "");
    assert.equal(h.eval("AIUI.preview"), null);
    assert.equal(first.aiSuggestions, undefined);
    assert.equal(w.WO.get(secondId).aiSuggestions, undefined);
  });
  await test("pending AI response is discarded after identity changes even on same workorder", async (h, w) => {
    const id = setup(h),
      wo = w.WO.get(id);
    wo.ownerId = "engineer";
    h.eval("AIUI.csrf='fixture'");
    let finish;
    w.fetch = () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            ok: true,
            json: async () => ({
              result: {
                summary: "old identity marker",
                citations: [],
                limitations: [],
              },
              provider: "mock",
              model: "fixture",
            }),
          });
      });
    const pending = w.AI_ASSIST.run(id, "diagnosis");
    w.switchPerson("engineer");
    w.workDetail(id);
    w.detailTab("analysis");
    finish();
    await pending;
    assert.equal(w.document.querySelector("#ai-preview").textContent, "");
    assert.equal(h.eval("AIUI.preview"), null);
    assert.equal(wo.aiSuggestions, undefined);
  });
  await test("accepted preview cannot use a note in another drawer", async (h, w) => {
    const id = setup(h),
      wo = w.WO.get(id);
    w.fetch = async (url) => ({
      ok: true,
      json: async () =>
        url === "/api/session"
          ? { csrfToken: "x" }
          : {
              result: {
                summary: "first work only",
                citations: [],
                limitations: [],
              },
              provider: "mock",
              model: "fixture",
            },
    });
    await w.AI_ASSIST.run(id, "diagnosis");
    w.savedPreview = h.eval("AIUI.preview");
    const secondId = w.WO.create({
      title: "Second task",
      description: "Different evidence",
      device: "HC-BJ-001",
      site: w.WO.sites[0],
      type: "故障处理",
      priority: "中",
    });
    w.workDetail(secondId);
    w.detailTab("analysis");
    assert.equal(h.eval("AIUI.preview"), null);
    const note = w.document.createElement("textarea");
    note.id = "ai-accept-note";
    note.value = "note belongs to second task";
    w.document.querySelector("#ai-preview").appendChild(note);
    h.eval("AIUI.preview=window.savedPreview");
    w.AI_ASSIST.accept();
    assert.equal(wo.aiSuggestions, undefined);
    assert.equal(w.WO.get(secondId).aiSuggestions, undefined);
  });
  await test("Wiki SVG renders actual nodes and edges with keyboard and click page navigation", async (h, w) => {
    w.switchPerson("analyst");
    w.navigate("knowledge");
    const calls = [];
    const graph = {
      nodes: [
        {
          id: "device-demo",
          title: "示例设备",
          kind: "compiled",
          family: "cooling",
        },
        { id: "knowledge-demo", title: "知识页面", kind: "compiled" },
        { id: "raw-demo", title: "原始资料", kind: "raw" },
      ],
      edges: [
        { source: "device-demo", target: "knowledge-demo", type: "wikilink" },
        { source: "knowledge-demo", target: "raw-demo", type: "wikilink" },
      ],
    };
    w.fetch = async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () =>
          url.includes("/graph")
            ? graph
            : {
                id: new URL(url, "http://localhost").searchParams.get("id"),
                title: "已打开",
                markdown: "source content",
                sourceIds: [],
              },
      };
    };
    await w.wikiLoad();
    const svg = w.document.querySelector(".wiki-graph-svg");
    assert.equal(svg.querySelectorAll(".wiki-graph-node").length, 3);
    assert.equal(svg.querySelectorAll(".wiki-graph-edge").length, 2);
    assert.equal(svg.querySelectorAll(".wiki-graph-node.device").length, 1);
    assert.equal(svg.querySelectorAll(".wiki-graph-node.raw").length, 1);
    assert.equal(svg.querySelectorAll(".wiki-graph-node.compiled").length, 1);
    for (const edge of graph.edges)
      assert.ok(
        svg.querySelector(
          `[data-source="${edge.source}"][data-target="${edge.target}"]`,
        ),
      );
    svg
      .querySelector('[data-id="raw-demo"]')
      .dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(calls.at(-1).endsWith("/page?id=raw-demo"));
    svg
      .querySelector('[data-id="knowledge-demo"]')
      .dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(calls.at(-1).endsWith("/page?id=knowledge-demo"));
    assert.ok(w.document.querySelector(".wiki-graph-alternative"));
    const malicious = h.eval(
      `wikiGraphSVG({nodes:[{id:"bad' onclick='alert(1)",title:'bad'}],edges:[]})`,
    );
    assert.ok(!malicious.includes("onclick"));
  });
  await test("AI context binds explicit knowledge version, not workorder revision", (h, w) => {
    const id = setup(h);
    const work = w.WO.get(id);
    const context = w.AI_ASSIST.context(work);
    assert.equal(context.version, "demo-v1");
    assert.equal(context.workorderVersion, work.version);
    h.eval("dev(WO.get('" + id + "').device).model='UNKNOWN-MODEL'");
    assert.equal(w.AI_ASSIST.context(work).version, "");
  });
  await test("AI citation history retains cloned original source snapshot after live Wiki changes", async (h, w) => {
    const id = setup(h),
      wo = w.WO.get(id),
      calls = [];
    const source = {
      id: "energy-source",
      title: "original title",
      family: "cooling",
      model: "HC-PAC30",
      version: "demo-v1",
      content: "ORIGINAL SOURCE CONTENT",
      sha256: "original-hash",
    };
    w.fetch = async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () =>
          url === "/api/session"
            ? { csrfToken: "fixture" }
            : url.startsWith("/api/wiki/page")
              ? {
                  id: "energy-source",
                  title: "current revised title",
                  markdown: "REVISED CONTENT",
                  version: "v2",
                }
              : {
                  result: {
                    summary: "建议",
                    citations: ["energy-source"],
                    limitations: [],
                  },
                  sourceSnapshots: [source],
                  provider: "mock",
                  model: "fixture",
                },
      };
    };
    await w.AI_ASSIST.run(id, "diagnosis");
    w.document.querySelector("#ai-preview .ai-source-snapshot").click();
    assert.ok(
      w.document
        .querySelector("#dialog-body")
        .textContent.includes("ORIGINAL SOURCE CONTENT"),
    );
    assert.ok(
      w.document
        .querySelector("#dialog-body")
        .textContent.includes("original-hash"),
    );
    w.document.querySelector("#dialog").close();
    w.document.querySelector("#ai-accept-note").value = "已核验原始快照";
    w.AI_ASSIST.accept();
    source.content = "MUTATED RESPONSE OBJECT";
    source.sha256 = "mutated-hash";
    assert.equal(
      wo.aiSuggestions[0].sourceSnapshots[0].content,
      "ORIGINAL SOURCE CONTENT",
    );
    await w.wikiOpen("energy-source");
    assert.ok(
      w.document
        .querySelector("#dialog-body")
        .textContent.includes("REVISED CONTENT"),
    );
    w.document.querySelector("#dialog").close();
    const priorCalls = calls.length;
    w.document.querySelector(".ai-assist .ai-source-snapshot").click();
    assert.equal(calls.length, priorCalls);
    const historical = w.document.querySelector("#dialog-body").textContent;
    assert.ok(historical.includes("ORIGINAL SOURCE CONTENT"));
    assert.ok(historical.includes("original-hash"));
    assert.ok(historical.includes("HC-PAC30"));
    assert.ok(!historical.includes("REVISED CONTENT"));
    assert.ok(historical.includes("可能已更新"));
    w.document.querySelector("#dialog").close();
    delete wo.aiSuggestions[0].sourceSnapshots;
    w.aiOpenSource(id, 0, 0);
    assert.ok(
      w.document
        .querySelector("#dialog-body")
        .textContent.includes("没有保存调用时"),
    );
    assert.equal(calls.length, priorCalls);
  });
  fs.writeFileSync(
    __dirname + "/real-ai-ui-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  if (results.some((x) => x.status === "FAIL")) process.exitCode = 1;
})();
