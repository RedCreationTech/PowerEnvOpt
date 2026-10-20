// Real loopback HTTP security tests. No model network calls and no real keys.
const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict");
(async () => {
  const root = path.resolve(__dirname, "..");
  const { createAppServer } = await import("../server.mjs");
  const { createConfigStore } = await import("../server/config.mjs");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "powerenv-security-"));
  const store = createConfigStore(tmp);
  let calls = 0;
  const server = createAppServer({
    rootDir: root,
    configStore: store,
    model: async () => {
      calls++;
      return { result: { summary: "mock", citations: [], limitations: [] } };
    },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`,
    results = [];
  const check = async (url, options, status) => {
    const r = await fetch(base + url, options);
    assert.equal(r.status, status, `${url}: ${await r.clone().text()}`);
    results.push({ url, status });
    return r;
  };
  try {
    for (const url of ["/", "/app.js", "/styles.css"])
      await check(url, {}, 200);
    for (const url of [
      "/.runtime/config.json",
      "/server/config.mjs",
      "/package.json",
      "/tests/server-test.cjs",
      "/evaluation/dataset.json",
      "/docs/README.md",
    ])
      await check(url, {}, 404);
    await new Promise((resolve, reject) => {
      require("node:http")
        .get(
          base + "/api/session",
          { headers: { Host: "evil.example" } },
          (r) => {
            try {
              assert.equal(r.statusCode, 403);
              r.resume();
              resolve();
            } catch (e) {
              reject(e);
            }
          },
        )
        .on("error", reject);
    });
    await check(
      "/api/config",
      { headers: { Origin: "https://evil.example" } },
      403,
    );
    await check(
      "/api/session",
      { headers: { "Sec-Fetch-Site": "cross-site" } },
      403,
    );
    await check(
      "/api/config",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
      403,
    );
    const { csrfToken } = await (await check("/api/session", {}, 200)).json();
    const headers = {
      "Content-Type": "application/json",
      Origin: base,
      "X-CSRF-Token": csrfToken,
    };
    const config = await (
      await check(
        "/api/config",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            apiKey: "FAKE_TEST_ONLY",
            provider: "deepseek",
          }),
        },
        200,
      )
    ).json();
    assert.equal(config.hasKey, true);
    assert.equal(config.apiKey, undefined);
    const read = await (await check("/api/config", {}, 200)).text();
    assert(!read.includes("FAKE_TEST_ONLY"));
    assert.equal(
      (await fs.stat(path.join(tmp, ".runtime/config.json"))).mode & 0o777,
      0o600,
    );
    assert.equal(
      (await fs.stat(path.join(tmp, ".runtime"))).mode & 0o777,
      0o700,
    );
    await check(
      "/api/config",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ baseURL: "https://evil.example" }),
      },
      400,
    );
    await check(
      "/api/config",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          provider: "local",
          baseURL: "http://127.0.0.1:11434/v1",
          model: "local-test",
        }),
      },
      200,
    );
    assert.equal((await store.read()).apiKey, "");
    assert.equal(calls, 0);
    await check(
      "/api/ai",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "diagnosis",
          workorder: { id: "synthetic" },
        }),
      },
      200,
    );
    assert.equal(calls, 1);
    await check(
      "/api/ai",
      { method: "POST", headers, body: JSON.stringify({ action: "unknown" }) },
      400,
    );
    await check(
      "/api/config",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ apiKey: "x".repeat(70000) }),
      },
      413,
    );
    await fs.writeFile(
      path.join(__dirname, "server-results.json"),
      JSON.stringify(
        {
          mode: "Real loopback HTTP; mock model only; no external requests",
          bind: "127.0.0.1",
          results,
        },
        null,
        2,
      ),
    );
    console.log(`Server security: ${results.length} HTTP assertions passed`);
  } finally {
    await new Promise((r) => server.close(r));
    await fs.rm(tmp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
