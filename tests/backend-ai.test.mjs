import test from "node:test";
import assert from "node:assert/strict";
import {
  invokeModel,
  invokeStructured,
  validateResult,
} from "../server/ai.mjs";
import { validateConfig } from "../server/config.mjs";
const config = {
  provider: "local",
  baseURL: "http://127.0.0.1:11434/v1",
  model: "test",
  apiKey: "",
  timeoutMs: 1000,
  maxRetries: 0,
};
const valid = {
  summary: "建议排查",
  steps: ["人工测量"],
  citations: ["page-1"],
  limitations: ["测试数据"],
};
const response = (v) =>
  new Response(
    JSON.stringify({
      choices: [
        { message: { content: JSON.stringify(v) }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 20, total_tokens: 30, secret: "hidden" },
    }),
  );
test("real transport shape through mocked fetch; citations and usage sanitized", async () => {
  let endpoint, body;
  const r = await invokeModel({
    config,
    sources: [{ id: "page-1" }],
    fetchImpl: async (u, o) => {
      endpoint = u;
      body = JSON.parse(o.body);
      return response(valid);
    },
  });
  assert.equal(endpoint, "http://127.0.0.1:11434/v1/chat/completions");
  assert.equal(body.response_format.type, "json_object");
  assert.deepEqual(r.result, valid);
  assert.equal(r.usage.secret, undefined);
});
test("reject hallucinated citation and malformed structured output", () => {
  assert.throws(() =>
    validateResult({ ...valid, citations: ["invented"] }, [{ id: "page-1" }]),
  );
  assert.throws(() =>
    validateResult({ ...valid, steps: [{}] }, [{ id: "page-1" }]),
  );
});
test("provider key cannot leave official host; local cannot target LAN", () => {
  assert.throws(() =>
    validateConfig({
      ...config,
      provider: "deepseek",
      baseURL: "https://evil.example",
    }),
  );
  assert.throws(() =>
    validateConfig({ ...config, baseURL: "http://192.168.1.1/v1" }),
  );
});
test("one bounded retry only and no fallback", async () => {
  let calls = 0;
  const r = await invokeModel({
    config: { ...config, maxRetries: 1 },
    sources: [],
    fetchImpl: async () => {
      calls++;
      return calls === 1
        ? new Response("secret", { status: 503 })
        : response({ ...valid, citations: [] });
    },
  });
  assert.equal(calls, 2);
  assert.equal(r.provider, "local");
});
test("raw provider error never returned", async () => {
  await assert.rejects(
    invokeModel({
      config,
      fetchImpl: async () => new Response("secret APIKEY", { status: 401 }),
    }),
    (e) => !e.message.includes("APIKEY") && e.code === "PROVIDER_ERROR",
  );
});
test("generic structured adapter supports evaluation schemas", async () => {
  const r = await invokeStructured({
    config,
    messages: [{ role: "user", content: "fixture" }],
    validate: (v) => {
      assert.deepEqual(v, { values: [1, 2] });
      return v;
    },
    fetchImpl: async () => response({ values: [1, 2] }),
  });
  assert.deepEqual(r.result.values, [1, 2]);
});
test("no implicit call without key", async () => {
  let called = false;
  await assert.rejects(
    invokeModel({
      config: {
        ...config,
        provider: "deepseek",
        baseURL: "https://api.deepseek.com",
      },
      fetchImpl: async () => {
        called = true;
      },
    }),
  );
  assert.equal(called, false);
});
test("body limit enforced before network", async () => {
  let called = false;
  await assert.rejects(
    invokeModel({
      config,
      query: "x".repeat(70000),
      fetchImpl: async () => {
        called = true;
      },
    }),
  );
  assert.equal(called, false);
});
test("independent profiles persist both keys and never cross carry", async () => {
  const fs = await import("node:fs/promises"),
    os = await import("node:os"),
    path = await import("node:path");
  const { createConfigStore } = await import("../server/config.mjs");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "powerenv-profiles-"));
  try {
    const store = createConfigStore(dir);
    await store.update({ provider: "deepseek", apiKey: "FAKE_DEEPSEEK" });
    await store.update({ provider: "qwen", apiKey: "FAKE_QWEN" });
    assert.equal((await store.read()).apiKey, "FAKE_QWEN");
    await store.update({ provider: "deepseek" });
    assert.equal((await store.read()).apiKey, "FAKE_DEEPSEEK");
    const publicConfig = await store.public();
    assert(publicConfig.profiles.deepseek.hasKey);
    assert(publicConfig.profiles.qwen.hasKey);
    assert(!JSON.stringify(publicConfig).includes("FAKE_"));
    await store.update({
      provider: "qwen",
      baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    });
    assert.equal((await store.read()).apiKey, "");
    await store.update({ provider: "deepseek" });
    assert.equal((await store.read()).apiKey, "FAKE_DEEPSEEK");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("response byte cap blocks oversized payload before parsing", async () => {
  await assert.rejects(
    invokeModel({
      config,
      fetchImpl: async () => new Response("x".repeat(262145)),
    }),
    (e) => e.code === "OUTPUT_TOO_LARGE",
  );
});
test("request timeout aborts transport with redacted trace", async () => {
  await assert.rejects(
    invokeModel({
      config,
      fetchImpl: async (u, o) =>
        new Promise((resolve, reject) =>
          o.signal.addEventListener("abort", () =>
            reject(new Error("private network detail")),
          ),
        ),
    }),
    (e) =>
      e.code === "TIMEOUT" &&
      !!e.trace.requestId &&
      !e.message.includes("private"),
  );
});
test("empty citations rejected whenever evidence was supplied", () => {
  assert.throws(
    () => validateResult({ ...valid, citations: [] }, [{ id: "page-1" }]),
    (e) => e.code === "MISSING_CITATIONS",
  );
});
test("redirect policy prevents credential forwarding to alternate hosts", async () => {
  await invokeModel({
    config,
    sources: [],
    fetchImpl: async (u, o) => {
      assert.equal(o.redirect, "error");
      return response({ ...valid, citations: [] });
    },
  });
});
test("reported model is distinct from requested alias and absent evidence stays null", async () => {
  const missing = await invokeModel({
    config,
    fetchImpl: async () => response({ ...valid, citations: [] }),
  });
  assert.equal(missing.requestedModel, "test");
  assert.equal(missing.providerReportedModel, null);
  assert.equal(missing.model, "test");
  const reported = await invokeModel({
    config,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          model: "test-actual-version",
          choices: [
            {
              message: { content: JSON.stringify({ ...valid, citations: [] }) },
            },
          ],
        }),
      ),
  });
  assert.equal(reported.requestedModel, "test");
  assert.equal(reported.providerReportedModel, "test-actual-version");
  assert.equal(reported.model, "test-actual-version");
});

test("Qwen explicitly disables hybrid thinking without sending its parameter to other providers", async () => {
  for (const provider of ["qwen", "deepseek", "local"]) {
    const baseURL =
      provider === "qwen"
        ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
        : provider === "deepseek"
          ? "https://api.deepseek.com"
          : config.baseURL;
    await invokeModel({
      config: { ...config, provider, baseURL, apiKey: "FAKE_TEST_ONLY" },
      fetchImpl: async (url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(body.stream, false);
        assert.deepEqual(body.response_format, { type: "json_object" });
        if (provider === "qwen") assert.equal(body.enable_thinking, false);
        else assert.equal(Object.hasOwn(body, "enable_thinking"), false);
        return response({ ...valid, citations: [] });
      },
    });
  }
});

test("cited source snapshots preserve exact submitted evidence independently of later mutations", async () => {
  const source = {
    id: "page-1",
    title: "Original",
    family: "ups",
    model: "M1",
    models: ["M1", "M2"],
    version: "v1",
    markdown: "Original evidence.",
    secretExtra: "must-not-project",
  };
  const sources = [source, { id: "uncited", content: "Not cited" }];
  const output = await invokeModel({
    config,
    sources,
    fetchImpl: async () => {
      source.markdown = "Changed during request";
      source.models.push("M3");
      return response(valid);
    },
  });
  source.title = "Changed later";
  source.models.push("M4");
  assert.equal(output.sourceSnapshots.length, 1);
  const snapshot = output.sourceSnapshots[0];
  assert.equal(snapshot.id, "page-1");
  assert.equal(snapshot.title, "Original");
  assert.equal(snapshot.content, "Original evidence.");
  assert.deepEqual(snapshot.models, ["M1", "M2"]);
  assert.equal(snapshot.secretExtra, undefined);
  const { createHash } = await import("node:crypto");
  assert.equal(
    snapshot.sha256,
    createHash("sha256").update(snapshot.content).digest("hex"),
  );
});
