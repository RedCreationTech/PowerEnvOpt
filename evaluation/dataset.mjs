// SERVER ONLY: held-out synthetic labels. Never serve this directory or import it in browser code.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
export const VERSION = "powerenv-synthetic-v2";
export const SEED = 20261020;
export const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
function rng(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function buildDataset() {
  const random = rng(SEED),
    cases = [];
  for (const task of ["R08", "R09", "R10"])
    for (let i = 0; i < 12; i++) {
      const base =
        task === "R08"
          ? 70 + i * 1.7
          : task === "R09"
            ? 20 + i * 0.6
            : 180 + i * 37;
      const slope =
          (random() - 0.45) *
          (task === "R10" ? 8 : task === "R08" ? 0.14 : 0.18),
        amplitude = task === "R10" ? 12 : task === "R08" ? 0.12 : 0.55;
      const phase = random() * Math.PI * 2;
      const seq = Array.from({ length: 27 }, (_, t) =>
        Number(
          (
            base +
            slope * t +
            amplitude * Math.sin((t * Math.PI) / 6 + phase) +
            amplitude * 0.12 * Math.sin(t * 1.7)
          ).toFixed(5),
        ),
      );
      const scenario =
        i < 4
          ? "normal"
          : i < 7
            ? "degradation"
            : i < 9
              ? "regime_shift"
              : i === 9
                ? "out_of_distribution"
                : "sensor_fault";
      if (scenario === "degradation")
        for (let t = 0; t < seq.length; t++)
          seq[t] = Number(
            (seq[t] + (task === "R08" ? -0.006 : 0.007) * t * t).toFixed(5),
          );
      if (scenario === "out_of_distribution")
        for (let t = 0; t < seq.length; t++)
          seq[t] = Number(
            (
              seq[t] + (task === "R09" ? 18 : task === "R10" ? 450 : -18)
            ).toFixed(5),
          );
      const change = task === "R08" ? -1.5 : task === "R09" ? 2.5 : 45;
      if (scenario === "regime_shift")
        for (let t = 24; t < 27; t++)
          seq[t] = Number((seq[t] + change).toFixed(5));
      if (scenario === "sensor_fault")
        seq[18 + (i % 3)] = Number(
          (seq[18 + (i % 3)] + (task === "R10" ? 220 : 12)).toFixed(5),
        );
      cases.push({
        id: `${task}-${String(i + 1).padStart(2, "0")}`,
        task,
        scenario,
        input: {
          kind:
            task === "R08"
              ? "equipment_efficiency"
              : task === "R09"
                ? "room_temperature"
                : "energy_consumption",
          unit: task === "R08" ? "percent" : task === "R09" ? "degC" : "kWh",
          cadence: "1 hour",
          history: seq.slice(0, 24),
          horizon: 3,
          scenario,
          quality:
            scenario === "sensor_fault"
              ? "suspect historical sensor spike; do not silently delete case"
              : "nominal",
          ...(scenario === "regime_shift"
            ? { knownNextWindowAdditiveChange: change }
            : {}),
          ...(task === "R09" ? { operatingRangeC: [15, 35] } : {}),
        },
        expected: seq.slice(24),
      });
    }
  const families = ["UPS", "HVAC", "RECTIFIER", "BATTERY", "MONITOR"];
  for (let i = 0; i < 50; i++) {
    const family = families[i % 5],
      model = `${family}-${100 + (i % 3)}`,
      version = `v${2 + (i % 2)}.0`,
      issue = [
        "设备收到启动指令后仍停机，没有温度超限或输出抖动。",
        "设备能启动但运行中发热超限，输出稳定。",
        "设备可启动且温度正常，但输出读数反复波动。",
      ][i % 3],
      topic = [
        "Failure to start after a valid start command.",
        "Excessive heat during operation with stable output.",
        "Unstable or oscillating output during otherwise normal operation.",
      ][i % 3];
    const mode =
      i < 30 ? "exact_match" : i < 40 ? "ambiguous_conflict" : "no_match";
    const candidate = (suffix, changes = {}) => ({
      sourceId: `kb-${hash(`${SEED}:${i}:${suffix}`).slice(0, 12)}`,
      family,
      model,
      version,
      applicability: topic,
      status: "approved",
      content: `Approved maintenance guidance for ${family} ${model}: isolate affected subsystem, inspect logged measurements, and request human review before changes.`,
      ...changes,
    });
    let candidates = [
      candidate("old", { version: "v1.0", status: "superseded" }),
      candidate("other-model", { model: `${family}-999` }),
      candidate("other-family", { family: family === "UPS" ? "HVAC" : "UPS" }),
      candidate("wrong-topic", {
        applicability: [
          "Unstable or oscillating output during otherwise normal operation.",
          "Failure to start after a valid start command.",
          "Excessive heat during operation with stable output.",
        ][i % 3],
        content:
          "This procedure is exclusively for the stated symptom; do not apply it to other fault modes.",
      }),
    ];
    let expected = {
      sourceId: null,
      family: null,
      model: null,
      version: null,
      reasonCode: mode === "ambiguous_conflict" ? "ambiguous" : "no_match",
    };
    if (mode === "exact_match") {
      const match = candidate("current");
      candidates.push(match);
      expected = {
        sourceId: match.sourceId,
        family,
        model,
        version,
        reasonCode: "match",
      };
    }
    if (mode === "ambiguous_conflict")
      candidates.push(
        candidate("conflict-a", {
          content: "Approved procedure requires isolation before restart.",
        }),
        candidate("conflict-b", {
          content: "Approved procedure forbids isolation before restart.",
        }),
      );
    if (mode === "no_match")
      candidates.push(candidate("draft", { status: "draft" }));
    // Deterministic rotation prevents the answer always occupying one slot.
    const rotate = i % candidates.length;
    candidates = [...candidates.slice(rotate), ...candidates.slice(0, rotate)];
    cases.push({
      id: `R11-${i + 1}`,
      task: "R11",
      scenario: mode,
      input: {
        request: {
          family,
          model,
          requiredVersion: i >= 48 ? null : version,
          issue,
        },
        selectionRules:
          "Require complete family, model and exact version; missing required metadata means no_match. Match symptom meaning and explicit negation in the request to each candidate applicability/content, not merely metadata. Use approved entries only; reject superseded and draft entries. Conflicting equally applicable approved entries require ambiguous; no eligible entry requires no_match. Do not choose a nearest model or stale version.",
        candidates,
      },
      expected,
    });
  }
  return cases;
}
export const DATASET = buildDataset();
export const DATASET_HASH = hash({
  version: VERSION,
  seed: SEED,
  cases: DATASET,
});

export const MANIFEST = JSON.parse(
  readFileSync(new URL("./manifest.json", import.meta.url), "utf8"),
);
if (
  MANIFEST.sha256 !== DATASET_HASH ||
  MANIFEST.version !== VERSION ||
  MANIFEST.seed !== SEED ||
  MANIFEST.totalCases !== DATASET.length
)
  throw new Error(
    "Frozen evaluation dataset mismatch: review and explicitly version the manifest.",
  );
