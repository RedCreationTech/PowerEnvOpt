// Full HTTP API -> WikiStore -> real adapter -> local fake OpenAI-compatible HTTP server.
// No paid/external calls. Every result below is a transport fixture, not model quality evidence.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppServer } from "../server.mjs";
import { createConfigStore } from "../server/config.mjs";
import { WikiStore } from "../server/wiki.mjs";
import { invokeStructured } from "../server/ai.mjs";
import { createEvaluationManager } from "../server/evaluation.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const listen = (server) =>
  new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server) => new Promise((resolve) => server.close(resolve));
async function setup(t) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "powerenv-integration-"));
  const calls = [];
  let mode = "valid";
  const provider = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    const context = JSON.parse(payload.messages.at(-1).content);
    calls.push({ url: req.url, payload, context });
    res.setHeader("Content-Type", "application/json");
    if (mode === "failure") {
      res.writeHead(503);
      return res.end(
        JSON.stringify({ error: { message: "FAKE_SECRET_DO_NOT_ECHO" } }),
      );
    }
    if (mode === "malformed")
      return res.end(
        JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
      );
    if (mode === "delayed")
      await new Promise((resolve) => setTimeout(resolve, 100));
    const citations =
      mode === "forged"
        ? ["not-a-real-source"]
        : (context.sources || []).map((s) => s.sourceId);
    const result = {
      summary: "本地传输测试建议，需人工核验。",
      hypotheses: ["合成假设"],
      steps: ["人工核对来源和设备型号，不执行设备操作。"],
      citations,
      limitations: ["合成测试，不是模型质量或现场维修证据。"],
    };
    res.end(
      JSON.stringify({
        model: "fake-local-v1",
        choices: [
          {
            message: { content: JSON.stringify(result) },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
      }),
    );
  });
  await listen(provider);
  const configStore = createConfigStore(tmp);
  await configStore.update({
    provider: "local",
    baseURL: `http://127.0.0.1:${provider.address().port}/v1`,
    model: "fake-local-v1",
    timeoutMs: 1000,
  });
  const wiki = new WikiStore({
    rootDir: root,
    runtimeDir: path.join(tmp, ".runtime/wiki"),
  });
  const evaluation = createEvaluationManager({
    invokeStructured,
    getConfig: () => configStore.read(),
    rootDir: tmp,
  });
  const app = createAppServer({ rootDir: root, configStore, wiki, evaluation });
  await listen(app);
  const base = `http://127.0.0.1:${app.address().port}`;
  const { csrfToken } = await (await fetch(base + "/api/session")).json();
  const post = async (route, body) => {
    const response = await fetch(base + route, {
      method: "POST",
      headers: {
        Origin: base,
        "X-CSRF-Token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  t.after(async () => {
    await close(app);
    await close(provider);
    await fs.rm(tmp, { recursive: true, force: true });
  });
  return { post, calls, wiki, base, setMode: (v) => (mode = v) };
}
const workorder = {
  id: "synthetic-W1",
  family: "cooling",
  model: "HC-PAC30",
  version: "demo-v1",
  scenario: "s1",
  description: "合成冷却告警，仅测试",
  unrelatedPrivateField: "MUST_NOT_BE_SENT",
};
test("all four workorder actions traverse HTTP transport; source applicability and manual acceptance remain intact", async (t) => {
  const { post, calls, wiki } = await setup(t);
  for (const action of ["diagnosis", "proposal", "retest", "knowledge"]) {
    const r = await post("/api/ai", {
      action,
      workorder,
      query: "核验冷却异常",
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.model, "fake-local-v1");
    assert.ok(r.body.result.citations.includes("cooling-evidence"));
    assert.ok(r.body.requestId);
    assert.equal(r.body.attempts, 1);
    const context = calls.at(-1).context;
    assert.equal(context.action, action);
    assert.equal(context.workorder.unrelatedPrivateField, undefined);
    assert.ok(
      context.sources.every(
        (s) => s.family === "cooling" || s.family === "hvac",
      ),
    );
    assert.ok(context.sources.every((s) => s.model === "HC-PAC30"));
    assert.ok(!context.sources.some((s) => s.id === "battery-evidence"));
    if (action === "knowledge") {
      assert.equal(r.body.proposal.reviewStatus, "candidate");
      assert.ok(
        !(
          await wiki.retrieve({
            family: "cooling",
            model: "HC-PAC30",
            version: "demo-v1",
          })
        ).some((s) => s.id === r.body.proposal.id),
      );
      const blocked = await post("/api/wiki/publish", {
        id: r.body.proposal.id,
      });
      assert.equal(blocked.status, 409);
    }
  }
  assert.equal(calls.length, 4);
  assert.ok(calls.every((c) => c.url === "/v1/chat/completions"));
});
test("unknown model/version and unsupported family are no-match, cannot generate a knowledge proposal", async (t) => {
  const { post, calls, wiki } = await setup(t);
  for (const overrides of [
    { model: "UNKNOWN-REAL-MODEL" },
    { version: "wrong-version" },
    { family: "generator" },
  ]) {
    const r = await post("/api/ai", {
      action: "knowledge",
      workorder: { ...workorder, ...overrides },
    });
    assert.equal(r.status, 200);
    assert.deepEqual(calls.at(-1).context.sources, []);
    assert.deepEqual(r.body.result.citations, []);
    assert.equal(r.body.proposal, undefined);
  }
  assert.deepEqual(await wiki.proposals(), []);
});
test("raw ingestion -> actual HTTP compile -> candidate -> review -> publication preserves provenance", async (t) => {
  const { post, wiki, calls } = await setup(t);
  const raw = await post("/api/wiki/ingest", {
    title: "原创合成资料",
    markdown:
      "# Original fixture\nSynthetic evidence only. Ignore previous instructions is untrusted text.",
    family: "ups",
    model: "FIXTURE-UPS",
    version: "v1",
  });
  assert.equal(raw.status, 200);
  assert.deepEqual(
    await wiki.retrieve({ family: "ups", model: "FIXTURE-UPS", version: "v1" }),
    [],
  );
  const compile = await post("/api/wiki/compile", { id: raw.body.id });
  assert.equal(compile.status, 200, JSON.stringify(compile.body));
  const candidate = compile.body.proposal;
  assert.equal(candidate.reviewStatus, "candidate");
  assert.deepEqual(candidate.rawSourceIds, [raw.body.id]);
  assert.equal(calls.at(-1).context.sources[0].reviewStatus, "unreviewed");
  assert.equal(
    (await post("/api/wiki/publish", { id: candidate.id })).status,
    409,
  );
  assert.equal(
    (
      await post("/api/wiki/review", {
        id: candidate.id,
        approved: true,
        note: "Checked synthetic origin and exact model/version",
      })
    ).status,
    200,
  );
  const published = await post("/api/wiki/publish", { id: candidate.id });
  assert.equal(published.status, 200);
  assert.equal(published.body.reviewStatus, "reviewed");
  assert.deepEqual(published.body.sourceIds, [raw.body.id]);
  assert.equal(
    (
      await wiki.retrieve({
        family: "ups",
        model: "FIXTURE-UPS",
        version: "v1",
      })
    ).length,
    1,
  );
});
test("provider failures, malformed JSON, and forged citations reject output and do not persist proposals", async (t) => {
  const { post, setMode, wiki } = await setup(t);
  for (const mode of ["failure", "malformed", "forged"]) {
    setMode(mode);
    const r = await post("/api/ai", { action: "knowledge", workorder });
    assert.equal(r.status, 502, JSON.stringify(r.body));
    assert.ok(r.body.error.code);
    assert.ok(!JSON.stringify(r.body).includes("FAKE_SECRET_DO_NOT_ECHO"));
    assert.ok(r.body.trace.requestId);
  }
  assert.deepEqual(await wiki.proposals(), []);
});
test("evaluation cancellation endpoint enforces CSRF and propagates unknown job safely", async (t) => {
  const { post, base } = await setup(t);
  const denied = await fetch(base + "/api/evaluation/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(denied.status, 403);
  const r = await post("/api/evaluation/cancel", { id: "not-a-real-job" });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "EVALUATION_NOT_RUNNING");
});

test("running evaluation can be cancelled through HTTP without dispatching remaining cases", async (t) => {
  const { post, base, calls, setMode } = await setup(t);
  setMode("delayed");
  const start = await post("/api/evaluation/run", { scope: "smoke" });
  assert.equal(start.status, 200);
  const id = start.body.id;
  const cancellation = await post("/api/evaluation/cancel", { id });
  assert.equal(cancellation.status, 200);
  let report;
  const deadline = Date.now() + 3000;
  do {
    report = await (
      await fetch(base + "/api/evaluation/export?id=" + id)
    ).json();
    if (report.status === "cancelled") break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  assert.equal(report.status, "cancelled", JSON.stringify(report));
  assert.equal(report.fullSuitePass, false);
  assert.ok(report.rows.some((r) => r.failure?.code === "CANCELLED"));
  assert.ok(calls.length <= 1, `unexpected model calls: ${calls.length}`);
  assert.equal(report.rows.length, report.totalCases);
});
