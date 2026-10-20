import fs from "node:fs/promises";
import path from "node:path";
export const defaults = Object.freeze({
  provider: "deepseek",
  model: "deepseek-flash",
  baseURL: "https://api.deepseek.com",
  timeoutMs: 30000,
  maxRetries: 0,
  apiKey: "",
});
export class SafeError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export function validateConfig(input) {
  const c = { ...defaults, ...input };
  if (!["deepseek", "qwen", "local"].includes(c.provider))
    throw new SafeError(
      "INVALID_PROVIDER",
      "请选择 DeepSeek、Qwen 或本地模型。",
    );
  if (
    typeof c.model !== "string" ||
    !c.model.trim() ||
    c.model.length > 160 ||
    /[\r\n]/.test(c.model)
  )
    throw new SafeError("INVALID_MODEL", "模型名称无效。");
  let u;
  try {
    u = new URL(c.baseURL);
  } catch {
    throw new SafeError("INVALID_URL", "模型服务地址无效。");
  }
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname.includes("..")
  )
    throw new SafeError("INVALID_URL", "地址不得包含凭据、查询参数或片段。");
  if (
    c.provider === "local"
      ? !(local && ["http:", "https:"].includes(u.protocol))
      : u.protocol !== "https:"
  )
    throw new SafeError(
      "INVALID_URL",
      "云服务必须使用 HTTPS；本地模型只允许回环地址。",
    );
  if (c.provider === "deepseek" && u.hostname !== "api.deepseek.com")
    throw new SafeError(
      "INVALID_URL",
      "DeepSeek 密钥只能发送至 api.deepseek.com。",
    );
  if (
    c.provider === "qwen" &&
    !(
      [
        "dashscope.aliyuncs.com",
        "dashscope-intl.aliyuncs.com",
        "dashscope-us.aliyuncs.com",
        "cn-hongkong.dashscope.aliyuncs.com",
      ].includes(u.hostname) ||
      /^[a-zA-Z0-9-]+\.(?:ap-southeast-1|us-east-1|cn-beijing|cn-hongkong|ap-northeast-1)\.maas\.aliyuncs\.com$/.test(
        u.hostname,
      )
    )
  )
    throw new SafeError(
      "INVALID_URL",
      "Qwen 密钥只能发送至官方 DashScope/Model Studio 地址。",
    );
  if (
    !Number.isInteger(c.timeoutMs) ||
    c.timeoutMs < 1000 ||
    c.timeoutMs > 60000
  )
    throw new SafeError("INVALID_TIMEOUT", "超时必须为 1000–60000 毫秒。");
  if (!Number.isInteger(c.maxRetries) || c.maxRetries < 0 || c.maxRetries > 1)
    throw new SafeError("INVALID_RETRIES", "重试次数只能为 0 或 1。");
  if (
    typeof c.apiKey !== "string" ||
    c.apiKey.length > 4096 ||
    /[\r\n]/.test(c.apiKey)
  )
    throw new SafeError("INVALID_KEY", "密钥格式无效。");
  return {
    provider: c.provider,
    model: c.model.trim(),
    baseURL: u.href.replace(/\/$/, ""),
    timeoutMs: c.timeoutMs,
    maxRetries: c.maxRetries,
    apiKey: c.apiKey,
  };
}
export function redactConfig(c) {
  const { apiKey, ...safe } = c;
  return { ...safe, hasKey: !!apiKey };
}
export const providerDefaults = {
  deepseek: { ...defaults },
  qwen: {
    ...defaults,
    provider: "qwen",
    model: "qwen-plus",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  local: {
    ...defaults,
    provider: "local",
    model: "local-model",
    baseURL: "http://127.0.0.1:11434/v1",
  },
};
export function createConfigStore(root) {
  const dir = path.join(root, ".runtime"),
    file = path.join(dir, "config.json");
  let queue = Promise.resolve();
  const initial = () => ({
    activeProvider: "deepseek",
    profiles: Object.fromEntries(
      Object.entries(providerDefaults).map(([k, v]) => [k, { ...v }]),
    ),
  });
  return {
    async readAll() {
      try {
        const raw = JSON.parse(await fs.readFile(file, "utf8"));
        const result = initial();
        if (raw.profiles) {
          if (!["deepseek", "qwen", "local"].includes(raw.activeProvider))
            throw Error();
          result.activeProvider = raw.activeProvider;
          for (const provider of Object.keys(providerDefaults))
            result.profiles[provider] = validateConfig({
              ...providerDefaults[provider],
              ...raw.profiles[provider],
              provider,
            });
        } else {
          const old = validateConfig(raw);
          result.activeProvider = old.provider;
          result.profiles[old.provider] = old;
        }
        await fs.chmod(dir, 0o700);
        await fs.chmod(file, 0o600);
        return result;
      } catch (e) {
        if (e.code === "ENOENT") return initial();
        throw new SafeError(
          "CONFIG_UNREADABLE",
          "本地配置无法读取，请检查运行目录。",
          500,
        );
      }
    },
    async read() {
      const all = await this.readAll();
      return all.profiles[all.activeProvider];
    },
    async public() {
      const all = await this.readAll();
      return {
        ...redactConfig(all.profiles[all.activeProvider]),
        activeProvider: all.activeProvider,
        profiles: Object.fromEntries(
          Object.entries(all.profiles).map(([p, c]) => [p, redactConfig(c)]),
        ),
      };
    },
    update(input) {
      const run = async () => {
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new SafeError("INVALID_CONFIG", "配置必须是对象。");
        const all = await this.readAll();
        const provider = input.provider || all.activeProvider;
        if (!Object.hasOwn(providerDefaults, provider))
          throw new SafeError("INVALID_PROVIDER", "请选择有效服务商。");
        const old = all.profiles[provider];
        const changed =
          input.baseURL && input.baseURL.replace(/\/$/, "") !== old.baseURL;
        const key = input.clearKey
          ? ""
          : input.apiKey || (!changed ? old.apiKey : "");
        const next = validateConfig({
          ...old,
          ...input,
          provider,
          apiKey: key,
        });
        all.profiles[provider] = next;
        all.activeProvider = provider;
        await fs.mkdir(dir, { recursive: true, mode: 0o700 });
        await fs.chmod(dir, 0o700);
        const temp = path.join(dir, `config-${process.pid}-${Date.now()}.tmp`);
        await fs.writeFile(temp, JSON.stringify(all, null, 2), {
          mode: 0o600,
          flag: "wx",
        });
        await fs.rename(temp, file);
        await fs.chmod(file, 0o600);
        return this.public();
      };
      const next = queue.then(run, run);
      queue = next.catch(() => {});
      return next;
    },
  };
}
