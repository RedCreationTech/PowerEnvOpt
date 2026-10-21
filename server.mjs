// Loopback-only server. Model calls happen exclusively after explicit POST actions.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  createConfigStore,
  redactConfig,
  SafeError,
} from "./server/config.mjs";
import { invokeModel, invokeStructured, ACTIONS } from "./server/ai.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
const assets = new Set([
  "/index.html",
  "/app.js",
  "/workflows.js",
  "/ai-ui.js",
  "/styles.css",
  "/iso-kit.js",
  "/iso-kit.css",
  "/iso-ac.js",
  "/iso-batt.js",
  "/iso-pdu.js",
  "/iso-energy.js",
  "/assets/hongchuang-logo.svg",
  "/assets/hongchuang-mark.svg",
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};
function equal(a, b) {
  return (
    typeof a === "string" &&
    a.length === b.length &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
    throw new SafeError("CONTENT_TYPE", "请求必须为 JSON。", 415);
  let size = 0,
    parts = [];
  for await (const part of req) {
    size += part.length;
    if (size > 65536)
      throw new SafeError("BODY_TOO_LARGE", "请求超过 64 KB 限制。", 413);
    parts.push(part);
  }
  try {
    const b = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!b || typeof b !== "object" || Array.isArray(b)) throw Error();
    return b;
  } catch {
    throw new SafeError("INVALID_JSON", "请求 JSON 无效。");
  }
}
export function createAppServer({
  rootDir = root,
  configStore = createConfigStore(rootDir),
  wiki = null,
  evaluation = null,
  model = invokeModel,
} = {}) {
  const csrf = randomBytes(32).toString("hex");
  let active = 0;
  const server = http.createServer(async (req, res) => {
    let operation = null;
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(data));
    };
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const port = server.address()?.port;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      if (!hosts.has(req.headers.host))
        throw new SafeError("INVALID_HOST", "不允许的主机。", 403);
      const origin = `http://${req.headers.host}`;
      if (req.headers.origin && req.headers.origin !== origin)
        throw new SafeError("CROSS_ORIGIN", "不允许跨来源请求。", 403);
      if (["cross-site", "same-site"].includes(req.headers["sec-fetch-site"]))
        throw new SafeError("CROSS_ORIGIN", "不允许跨来源请求。", 403);
      const url = new URL(req.url, origin);
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        throw new SafeError("INVALID_URL", "无效地址。");
      }
      if (pathname.includes("..") || pathname.includes("\\"))
        throw new SafeError("INVALID_PATH", "不允许的路径。", 403);
      if (!pathname.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(req.method))
          throw new SafeError("METHOD_NOT_ALLOWED", "不支持的方法。", 405);
        const asset = pathname === "/" ? "/index.html" : pathname;
        if (!assets.has(asset))
          throw new SafeError("NOT_FOUND", "未找到。", 404);
        const full = path.join(rootDir, asset);
        const real = await fs.realpath(full).catch(() => null);
        if (!real || real !== full)
          throw new SafeError("NOT_FOUND", "未找到。", 404);
        const data = await fs.readFile(real);
        res.writeHead(200, {
          "Content-Type": types[path.extname(asset)],
          "Content-Length": data.length,
        });
        res.end(req.method === "HEAD" ? undefined : data);
        return;
      }
      if (
        req.method === "POST" &&
        (!equal(req.headers["x-csrf-token"], csrf) ||
          req.headers.origin !== origin)
      )
        throw new SafeError("CSRF", "请刷新本地页面后再操作。", 403);
      if (!["GET", "POST"].includes(req.method))
        throw new SafeError("METHOD_NOT_ALLOWED", "不支持的方法。", 405);
      const body = req.method === "POST" ? await readBody(req) : null;
      const route = `${req.method} ${pathname}`;
      if (route === "GET /api/session") return send(200, { csrfToken: csrf });
      if (route === "GET /api/config")
        return send(200, await configStore.public());
      if (route === "POST /api/config")
        return send(200, await configStore.update(body));
      if (route === "GET /api/wiki/graph" && wiki)
        return send(200, await wiki.graph());
      if (route === "GET /api/wiki/search" && wiki)
        return send(
          200,
          await wiki.search(Object.fromEntries(url.searchParams)),
        );
      if (route === "GET /api/wiki/page" && wiki)
        return send(200, await wiki.page(url.searchParams.get("id")));
      if (route === "GET /api/wiki/lint" && wiki)
        return send(200, await wiki.lint());
      if (route === "POST /api/wiki/ingest" && wiki)
        return send(200, await wiki.ingestRaw(body));
      if (route === "GET /api/wiki/proposals" && wiki)
        return send(200, await wiki.proposals());
      if (route === "POST /api/wiki/review" && wiki)
        return send(
          200,
          await wiki.review(body.id, {
            approved: body.approved,
            reviewer: "本地人工审核",
            note: body.note,
          }),
        );
      if (route === "POST /api/wiki/publish" && wiki)
        return send(200, await wiki.publish(body.id));
      if (route === "POST /api/wiki/proposal" && wiki)
        return send(200, await wiki.createProposal(body));
      if (
        ["GET /api/evaluation/report", "GET /api/evaluation/status"].includes(
          route,
        ) &&
        evaluation
      )
        return send(
          200,
          await evaluation.status(url.searchParams.get("id") || undefined),
        );
      if (route === "POST /api/evaluation/cancel" && evaluation)
        return send(200, await evaluation.cancel(body.id));
      if (route === "GET /api/evaluation/export" && evaluation)
        return send(
          200,
          await evaluation.export(url.searchParams.get("id") || undefined),
        );
      if (
        [
          "POST /api/ai",
          "POST /api/connection/test",
          "POST /api/evaluation/run",
          "POST /api/wiki/compile",
        ].includes(route)
      ) {
        operation =
          route === "POST /api/wiki/compile"
            ? "compile"
            : route === "POST /api/ai" && ACTIONS.includes(body.action)
              ? body.action
              : null;
        if (active)
          throw new SafeError("BUSY", "已有模型请求正在执行，请稍候。", 409);
        active++;
        try {
          const config = await configStore.read();
          if (route === "POST /api/evaluation/run" && evaluation)
            return send(200, await evaluation.start(body));
          if (route === "POST /api/wiki/compile" && wiki) {
            const source = await wiki.page(body.id);
            if (source.kind !== "raw")
              throw new SafeError("INVALID_SOURCE", "仅可编译原始资料。");
            const output = await model({
              config,
              action: "knowledge",
              query:
                "将这份不可信原始资料编译成待人工审核的知识建议。必须引用其 sourceId 并列明限制。",
              sources: [{ ...source, sourceId: source.id }],
            });
            const r = output.result;
            if (!r.citations.length)
              throw new SafeError(
                "MISSING_CITATIONS",
                "编译结果缺少来源引用，未保存。",
                502,
              );
            output.proposal = await wiki.createProposal({
              targetId: body.targetId,
              title: source.title,
              markdown: `# ${r.summary}\n\n${(r.steps || []).map((s) => `- ${s}`).join("\n")}\n\n## 限制\n${r.limitations.map((s) => `- ${s}`).join("\n")}`,
              sourceIds: r.citations,
              family: source.family,
              model: source.model,
              version: source.version,
              modelInfo: { provider: output.provider, model: output.model },
            });
            return send(200, output);
          }
          if (route === "POST /api/connection/test")
            return send(
              200,
              await model({
                config,
                action: "diagnosis",
                query:
                  "连接测试。只返回 summary:连接成功, citations:[], limitations:[仅验证服务响应，不代表运维结论正确]。",
                sources: [],
              }),
            );
          if (route !== "POST /api/ai")
            throw new SafeError("NOT_AVAILABLE", "评测模块未加载。", 503);
          if (!ACTIONS.includes(body.action))
            throw new SafeError("INVALID_ACTION", "不支持的 AI 操作。");
          const supplied = body.workorder || {};
          if (typeof supplied !== "object" || Array.isArray(supplied))
            throw new SafeError("INVALID_INPUT", "工单格式无效。");
          const workorder = Object.fromEntries(
            [
              "id",
              "workorderVersion",
              "scenario",
              "phase",
              "title",
              "deviceId",
              "deviceType",
              "family",
              "model",
              "version",
              "quality",
              "description",
              "evidence",
              "checks",
              "tests",
              "scenarioEvidence",
            ]
              .filter((k) => Object.hasOwn(supplied, k))
              .map((k) => [k, supplied[k]]),
          );
          const query = body.query || "";
          if (typeof query !== "string")
            throw new SafeError("INVALID_INPUT", "问题必须为文本。");
          const retrieved = wiki
            ? await wiki.retrieve({
                query: query || JSON.stringify(workorder),
                family: workorder.family,
                model: workorder.model,
                version: workorder.version,
                limit: 5,
              })
            : [];
          const sources = retrieved.map((s) => ({ ...s, sourceId: s.id }));
          const output = await model({
            config,
            action: body.action,
            workorder,
            query,
            sources,
          });
          if (
            body.action === "knowledge" &&
            wiki &&
            output.result.citations.length
          ) {
            const r = output.result;
            output.proposal = await wiki.createProposal({
              title: r.summary.slice(0, 120),
              markdown: `# ${r.summary}\n\n${(r.steps || []).map((s) => `- ${s}`).join("\n")}\n\n## 限制\n${r.limitations.map((s) => `- ${s}`).join("\n")}`,
              sourceIds: r.citations,
              family: workorder.family,
              model: workorder.model,
              version: workorder.version,
              workorderId: workorder.id,
              modelInfo: { provider: output.provider, model: output.model },
            });
          }
          return send(200, output);
        } finally {
          active--;
        }
      }
      throw new SafeError("NOT_FOUND", "接口未找到。", 404);
    } catch (e) {
      if (operation && wiki)
        await wiki
          .recordFailure({
            action: operation,
            code: e instanceof SafeError ? e.code : "REQUEST_FAILED",
          })
          .catch(() => {});
      if (res.headersSent) {
        res.end();
        return;
      }
      send(
        e instanceof SafeError
          ? e.status
          : [400, 404, 409].includes(e.status)
            ? e.status
            : 500,
        {
          ...(e instanceof SafeError && e.trace ? { trace: e.trace } : {}),
          error: {
            code: e instanceof SafeError ? e.code : "REQUEST_FAILED",
            message:
              e instanceof SafeError
                ? e.message
                : [400, 404, 409].includes(e.status)
                  ? "操作未完成。请检查来源、适用范围及审核状态。"
                  : "请求未完成，请检查本地服务。",
          },
        },
      );
    }
  });
  server.requestTimeout = 70000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
export async function startServer() {
  let wiki = null,
    evaluation = null;
  try {
    const { WikiStore } = await import("./server/wiki.mjs");
    wiki = new WikiStore({
      rootDir: root,
      runtimeDir: path.join(root, ".runtime/wiki"),
    });
  } catch (e) {
    if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
  }
  try {
    const module = await import("./server/evaluation.mjs");
    evaluation = module.createEvaluationManager
      ? module.createEvaluationManager({
          invokeStructured,
          getConfig: () => createConfigStore(root).read(),
        })
      : null;
  } catch (e) {
    if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
  }
  const server = createAppServer({ wiki, evaluation });
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("Invalid PORT");
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `PowerEnvOpt 本地服务：http://127.0.0.1:${port}\n模型调用仅在手动确认操作后触发。按 Ctrl+C 停止。`,
    ),
  );
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  startServer().catch(() => {
    console.error("本地服务启动失败。");
    process.exitCode = 1;
  });
