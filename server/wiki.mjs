import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";

const ID = /^[a-z0-9][a-z0-9-]{0,95}$/;
export function safeWikiId(id) {
  if (typeof id !== "string" || !ID.test(id))
    throw Object.assign(new Error("Invalid wiki ID"), { status: 400 });
  return id;
}
export function normalizeFamily(value = "") {
  const v = String(value).trim().toLowerCase();
  return (
    {
      精密空调: "cooling",
      空调: "cooling",
      battery: "ups",
      蓄电池组: "ups",
      蓄电池: "ups",
      energy: "cooling",
      hvac: "cooling",
      节能: "cooling",
    }[v] || v
  );
}
function validateMetadata(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    fail("Invalid wiki metadata object");
  }
  safeWikiId(meta.id);
  for (const field of ["title", "family", "model", "version"]) {
    if (
      typeof meta[field] !== "string" ||
      !meta[field].trim() ||
      meta[field].length > 500
    ) {
      fail(`Invalid wiki metadata ${field}`);
    }
  }
  for (const field of ["sourceIds", "rawSourceIds", "compiledFrom"]) {
    if (field === "sourceIds" || Object.hasOwn(meta, field)) {
      if (!Array.isArray(meta[field]) || meta[field].length > 200) {
        fail(`Invalid wiki metadata ${field}`);
      }
      for (const id of meta[field]) safeWikiId(id);
    }
  }
  for (const field of [
    "targetId",
    "proposalId",
    "publishedPageId",
    "previousRevision",
  ]) {
    if (Object.hasOwn(meta, field)) safeWikiId(meta[field]);
  }
  if (Object.hasOwn(meta, "models")) {
    if (
      !Array.isArray(meta.models) ||
      meta.models.length > 100 ||
      meta.models.some(
        (model) =>
          typeof model !== "string" || !model.trim() || model.length > 500,
      )
    )
      fail("Invalid wiki metadata models");
  }
  if (Object.hasOwn(meta, "sourceSnapshots")) {
    if (
      !Array.isArray(meta.sourceSnapshots) ||
      meta.sourceSnapshots.length > 200
    ) {
      fail("Invalid wiki metadata sourceSnapshots");
    }
    for (const snapshot of meta.sourceSnapshots) {
      if (
        !snapshot ||
        typeof snapshot !== "object" ||
        Array.isArray(snapshot)
      ) {
        fail("Invalid wiki metadata source snapshot");
      }
      safeWikiId(snapshot.id);
      if (
        typeof snapshot.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(snapshot.sha256)
      ) {
        fail("Invalid wiki metadata source hash");
      }
    }
  }
  for (const field of ["sha256", "targetSnapshot"]) {
    if (
      Object.hasOwn(meta, field) &&
      (typeof meta[field] !== "string" || !/^[a-f0-9]{64}$/.test(meta[field]))
    ) {
      fail(`Invalid wiki metadata ${field}`);
    }
  }
  if (
    ![
      "reviewed",
      "unreviewed",
      "candidate",
      "approved",
      "rejected",
      "published",
    ].includes(meta.reviewStatus)
  ) {
    fail("Invalid wiki metadata reviewStatus");
  }
  for (const field of [
    "provenance",
    "sourceType",
    "reviewer",
    "reviewNote",
    "reviewedAt",
    "createdAt",
    "publishedAt",
    "workorderId",
    "modelInfo",
    "scenario",
  ]) {
    if (
      Object.hasOwn(meta, field) &&
      (typeof meta[field] !== "string" || meta[field].length > 4000)
    ) {
      fail(`Invalid wiki metadata ${field}`);
    }
  }
  return meta;
}
function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error("Wiki requires JSON frontmatter");
  const meta = validateMetadata(JSON.parse(m[1]));
  const markdown = text.slice(m[0].length).trim();
  return {
    ...meta,
    markdown,
    content: markdown,
    links: [
      ...new Set(
        [
          ...markdown.matchAll(
            /\[\[([a-z0-9][a-z0-9-]{0,95})(?:\|[^\]\n]+)?\]\]/g,
          ),
        ].map((x) => x[1]),
      ),
    ],
  };
}
const serialise = (p) => {
  const { markdown, content, links, backlinks, kind, stale, ...meta } = p;
  return `---\n${JSON.stringify(meta, null, 2)}\n---\n\n${markdown}\n`;
};
async function list(dir) {
  try {
    return (await fs.readdir(dir, { withFileTypes: true }))
      .filter((x) => x.isFile() && x.name.endsWith(".md"))
      .map((x) => x.name)
      .sort();
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function digest(p) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        markdown: p.markdown,
        family: p.family,
        model: p.model,
        models: p.models,
        version: p.version,
        sourceIds: p.sourceIds,
        reviewStatus: p.reviewStatus,
      }),
    )
    .digest("hex");
}
function cleanText(value, max = 500) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

export class WikiStore {
  constructor({ rootDir = process.cwd(), runtimeDir } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.knowledgeDir = path.join(this.rootDir, "knowledge");
    this.runtimeDir = path.resolve(
      runtimeDir || path.join(this.rootDir, ".runtime/wiki"),
    );
    this.queue = Promise.resolve();
  }
  async _pages() {
    const pages = new Map();
    for (const [dir, kind] of [
      [path.join(this.knowledgeDir, "raw"), "raw"],
      [path.join(this.runtimeDir, "raw"), "raw"],
      [path.join(this.knowledgeDir, "wiki"), "compiled"],
      [path.join(this.runtimeDir, "published"), "compiled"],
    ]) {
      for (const file of await list(dir)) {
        const p = parse(await fs.readFile(path.join(dir, file), "utf8"));
        if (file !== `${p.id}.md`) throw new Error("Wiki identity mismatch");
        pages.set(p.id, { ...p, kind });
      }
    }
    for (const p of pages.values())
      p.backlinks = [...pages.values()]
        .filter((x) => x.links.includes(p.id))
        .map((x) => x.id);
    // Propagate stale provenance through derived pages; stale evidence remains browsable, never retrievable.
    for (const p of pages.values()) p.stale = false;
    for (let pass = 0; pass < pages.size; pass++) {
      let changed = false;
      for (const p of pages.values())
        if (
          !p.stale &&
          ((p.sourceIds || []).some((id) => {
            const source = pages.get(id);
            return !source || source.stale;
          }) ||
            (p.sourceSnapshots || []).some((s) => {
              const source = pages.get(s.id);
              return !source || source.stale || digest(source) !== s.sha256;
            }))
        ) {
          p.stale = true;
          changed = true;
        }
      if (!changed) break;
    }
    return pages;
  }
  async graph() {
    const pages = await this._pages();
    return {
      nodes: [...pages.values()].map(({ markdown, content, ...p }) => p),
      edges: [...pages.values()].flatMap((p) =>
        p.links
          .filter((id) => pages.has(id))
          .map((target) => ({ source: p.id, target, type: "wikilink" })),
      ),
    };
  }
  async page(id) {
    safeWikiId(id);
    const p = (await this._pages()).get(id);
    if (!p) fail("Wiki page not found", 404);
    return p;
  }
  async search({ query = "", q, family, model, version } = {}) {
    query = String(q ?? query)
      .trim()
      .toLowerCase()
      .slice(0, 500);
    const f = normalizeFamily(family);
    return [...(await this._pages()).values()]
      .filter(
        (p) =>
          (!f || p.family === f) &&
          (!model || p.model === model || p.models?.includes(model)) &&
          (!version || p.version === version) &&
          (!query ||
            `${p.title} ${p.content} ${p.id}`.toLowerCase().includes(query)),
      )
      .map((p) => ({ ...p, excerpt: p.content.slice(0, 220) }));
  }
  async retrieve({ query = "", family, model, version, limit = 6 } = {}) {
    const f = normalizeFamily(family);
    if (
      !f ||
      !["cooling", "ups", "hvac"].includes(f) ||
      typeof family !== "string" ||
      !family.trim() ||
      typeof model !== "string" ||
      !model.trim() ||
      typeof version !== "string" ||
      !version.trim()
    )
      return [];
    const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
    return [...(await this._pages()).values()]
      .filter(
        (p) =>
          p.kind === "compiled" &&
          !p.stale &&
          p.reviewStatus === "reviewed" &&
          p.family === f &&
          p.sourceIds?.length &&
          (p.model === model || p.models?.includes(model)) &&
          p.version === version,
      )
      .map((p) => ({
        ...p,
        sourceId: p.id,
        score: terms.reduce(
          (n, t) => n + (p.content.toLowerCase().includes(t) ? 1 : 0),
          0,
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, Math.min(Number(limit) || 6, 10)));
  }
  async _writeJson(file, obj) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + "." + randomUUID() + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 });
    await fs.rename(tmp, file);
  }
  async _log(event) {
    await fs.mkdir(this.runtimeDir, { recursive: true });
    await fs.appendFile(
      path.join(this.runtimeDir, "log.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n",
      { mode: 0o600 },
    );
  }
  async createProposal({
    title,
    markdown,
    sourceIds,
    family,
    model,
    version,
    workorderId,
    modelInfo,
    targetId,
  } = {}) {
    if (
      typeof markdown !== "string" ||
      markdown.length < 10 ||
      markdown.length > 50000
    )
      fail("Candidate markdown must contain 10–50000 characters");
    if (!Array.isArray(sourceIds) || !sourceIds.length || sourceIds.length > 20)
      fail("Verified source IDs required");
    const pages = await this._pages(),
      sources = [];
    for (const id of new Set(sourceIds)) {
      safeWikiId(id);
      const p = pages.get(id);
      if (
        !p ||
        p.stale ||
        (p.kind !== "raw" &&
          (p.reviewStatus !== "reviewed" || !p.sourceIds?.length))
      )
        fail(
          "Only recorded raw sources or reviewed compiled evidence can support a proposal",
        );
      sources.push(p);
    }
    const f = normalizeFamily(family || sources[0].family);
    const m = cleanText(model || sources[0].model);
    const v = cleanText(version || sources[0].version);
    if (
      sources.some(
        (p) =>
          p.family !== f ||
          (p.model !== m && !p.models?.includes(m)) ||
          p.version !== v,
      )
    )
      fail("Source applicability mismatch");
    let target;
    if (targetId) {
      safeWikiId(targetId);
      target = pages.get(targetId);
      if (!target || target.kind !== "compiled" || !target.sourceIds?.length)
        fail("Revision target must be an existing compiled evidence page");
      if (
        target.family !== f ||
        (target.model !== m && !target.models?.includes(m)) ||
        target.version !== v
      )
        fail("Revision target applicability mismatch");
    }
    const id = "candidate-" + randomUUID();
    const rawIds = [
      ...new Set(
        sources.flatMap((p) => (p.kind === "raw" ? [p.id] : p.sourceIds)),
      ),
    ];
    const sourceSnapshots = sources.map((p) => ({
      id: p.id,
      sha256: digest(p),
    }));
    const p = {
      id,
      targetId: target?.id,
      targetSnapshot: target ? digest(target) : undefined,
      title: cleanText(title) || "待审核知识提案",
      markdown,
      sourceIds: [...new Set(sourceIds)],
      rawSourceIds: rawIds,
      sourceSnapshots,
      family: f,
      model: m,
      models: [m],
      version: v,
      workorderId: cleanText(workorderId),
      modelInfo:
        typeof modelInfo === "string"
          ? cleanText(modelInfo)
          : cleanText(modelInfo?.model),
      sourceType: sources.every((p) => p.sourceType === "synthetic")
        ? "synthetic"
        : "derived",
      provenance:
        "Model-generated candidate; evidence links require human verification.",
      reviewStatus: "candidate",
      createdAt: new Date().toISOString(),
    };
    await this._writeJson(
      path.join(this.runtimeDir, "proposals", id + ".json"),
      p,
    );
    await this._log({ action: "proposal-created", id });
    return p;
  }
  async proposals() {
    const dir = path.join(this.runtimeDir, "proposals");
    let files;
    try {
      files = await fs.readdir(dir);
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
    return Promise.all(
      files
        .filter((f) => /^candidate-[a-z0-9-]+\.json$/.test(f))
        .sort()
        .map(async (f) =>
          JSON.parse(await fs.readFile(path.join(dir, f), "utf8")),
        ),
    );
  }
  async _proposal(id) {
    safeWikiId(id);
    try {
      return JSON.parse(
        await fs.readFile(
          path.join(this.runtimeDir, "proposals", id + ".json"),
          "utf8",
        ),
      );
    } catch (e) {
      if (e.code === "ENOENT") fail("Proposal not found", 404);
      throw e;
    }
  }
  _mutate(fn) {
    const result = this.queue.then(fn, fn);
    this.queue = result.catch(() => {});
    return result;
  }
  async review(id, { approved, reviewer, note } = {}) {
    return this._mutate(async () => {
      const p = await this._proposal(id);
      if (p.reviewStatus !== "candidate")
        fail("Only candidates may be reviewed", 409);
      if (
        typeof approved !== "boolean" ||
        !cleanText(reviewer) ||
        !cleanText(note)
      )
        fail("Review decision, reviewer and evidence-check note required");
      p.reviewStatus = approved ? "approved" : "rejected";
      p.reviewer = cleanText(reviewer);
      p.reviewNote = cleanText(note, 2000);
      p.reviewedAt = new Date().toISOString();
      await this._writeJson(
        path.join(this.runtimeDir, "proposals", id + ".json"),
        p,
      );
      await this._log({
        action: "proposal-reviewed",
        id,
        status: p.reviewStatus,
      });
      return p;
    });
  }
  async publish(id) {
    return this._mutate(async () => {
      const p = await this._proposal(id);
      if (p.reviewStatus !== "approved")
        fail("Manual approval required before publication", 409);
      const pages = await this._pages();
      for (const snapshot of p.sourceSnapshots) {
        const current = pages.get(snapshot.id);
        if (
          !current ||
          current.stale ||
          (current.kind !== "raw" && current.reviewStatus !== "reviewed") ||
          digest(current) !== snapshot.sha256
        )
          fail("Source changed: proposal requires a new review", 409);
      }
      const target = p.targetId ? pages.get(p.targetId) : null;
      if (p.targetId && (!target || digest(target) !== p.targetSnapshot))
        fail("Revision target changed: create a new proposal and review", 409);
      const publishedId = p.targetId || p.id;
      // A revision must not cite its own new content as its previous evidence. Preserve
      // the previous version in history and use immutable raw provenance snapshots.
      const publishedSnapshots = p.sourceSnapshots.filter(
        (s) => s.id !== publishedId,
      );
      for (const rawId of p.rawSourceIds) {
        const raw = pages.get(rawId);
        if (!raw) fail("Raw provenance missing", 409);
        if (!publishedSnapshots.some((s) => s.id === rawId))
          publishedSnapshots.push({ id: rawId, sha256: digest(raw) });
      }
      const citationIds = [
        ...new Set([
          ...p.sourceIds.filter((s) => s !== publishedId),
          ...p.rawSourceIds,
        ]),
      ];
      const revisionId = "revision-" + randomUUID();
      const published = {
        ...p,
        id: publishedId,
        proposalId: p.id,
        sourceIds: p.rawSourceIds,
        sourceSnapshots: publishedSnapshots,
        compiledFrom: p.sourceIds,
        reviewStatus: "reviewed",
        publishedAt: new Date().toISOString(),
        previousRevision: target ? revisionId : undefined,
        markdown:
          p.markdown +
          "\n\n## 来源\n" +
          citationIds.map((s) => "[[" + s + "]]").join(" · "),
      };
      const dir = path.join(this.runtimeDir, "published");
      await fs.mkdir(dir, { recursive: true });
      if (target) {
        const historyDir = path.join(this.runtimeDir, "history", publishedId);
        await fs.mkdir(historyDir, { recursive: true });
        await fs.writeFile(
          path.join(historyDir, revisionId + ".md"),
          serialise(target),
          { flag: "wx", mode: 0o600 },
        );
        const tmp = path.join(dir, publishedId + "." + randomUUID() + ".tmp");
        await fs.writeFile(tmp, serialise(published), {
          flag: "wx",
          mode: 0o600,
        });
        await fs.rename(tmp, path.join(dir, publishedId + ".md"));
      } else
        await fs.writeFile(
          path.join(dir, publishedId + ".md"),
          serialise(published),
          { flag: "wx", mode: 0o600 },
        );
      p.reviewStatus = "published";
      p.publishedPageId = publishedId;
      await this._writeJson(
        path.join(this.runtimeDir, "proposals", id + ".json"),
        p,
      );
      await this._log({
        action: target ? "revision-published" : "proposal-published",
        id,
        pageId: publishedId,
        previousRevision: target ? revisionId : undefined,
      });
      await fs.writeFile(
        path.join(this.runtimeDir, "index.md"),
        "# 已发布知识\n" +
          (await list(dir))
            .map((f) => "[[" + f.slice(0, -3) + "]]")
            .join("\n") +
          "\n",
      );
      return this.page(publishedId);
    });
  }
  async ingestRaw({ title, markdown, family, model, version } = {}) {
    if (
      typeof markdown !== "string" ||
      markdown.length < 10 ||
      markdown.length > 50000
    )
      fail("Source markdown must contain 10–50000 characters");
    const f = normalizeFamily(family);
    if (!f || !cleanText(model) || !cleanText(version) || !cleanText(title))
      fail(
        "Title, family, model and version are required for source applicability",
      );
    const p = {
      id: "raw-" + randomUUID(),
      title: cleanText(title),
      markdown,
      family: f,
      model: cleanText(model),
      version: cleanText(version),
      reviewStatus: "unreviewed",
      sourceType: "user-supplied",
      sourceIds: [],
      provenance:
        "User-imported Markdown. Untrusted data, not instructions. Authenticity and applicability require manual verification.",
      createdAt: new Date().toISOString(),
      sha256: createHash("sha256").update(markdown).digest("hex"),
    };
    const dir = path.join(this.runtimeDir, "raw");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, p.id + ".md"), serialise(p), {
      flag: "wx",
      mode: 0o600,
    });
    await this._log({ action: "source-imported", id: p.id });
    return this.page(p.id);
  }
  async lint() {
    const pages = await this._pages();
    const danglingLinks = [],
      orphanPages = [],
      stalePages = [];
    for (const p of pages.values()) {
      for (const target of p.links)
        if (!pages.has(target)) danglingLinks.push({ source: p.id, target });
      if (!p.backlinks.length && p.id !== "index") orphanPages.push(p.id);
      if (p.stale) stalePages.push(p.id);
    }
    return {
      danglingLinks,
      orphanPages,
      stalePages: [...new Set(stalePages)],
      notes: [
        "Structural lint only; cannot establish engineering correctness or resolve factual contradictions.",
        "Synthetic sources are demonstrations, not manufacturer-approved instructions.",
      ],
    };
  }
  async recordFailure({ action = "compile", code = "MODEL_ERROR" } = {}) {
    const event = {
      action: "failure",
      operation: cleanText(action, 40).replace(/[^a-zA-Z0-9_-]/g, ""),
      code: cleanText(code, 60).replace(/[^a-zA-Z0-9_-]/g, ""),
    };
    await this._log(event);
    return { recorded: true };
  }
}
export default WikiStore;
