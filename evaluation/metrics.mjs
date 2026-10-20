export const exactTuple = (a, b) =>
  ["sourceId", "family", "model", "version", "reasonCode"].every(
    (k) => a?.[k] === b?.[k],
  );
const valid = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length > 0 &&
  a.length === b.length &&
  a.every(Number.isFinite) &&
  b.every(Number.isFinite);
export function rSquared(expected, predicted) {
  if (!valid(expected, predicted)) return null;
  const mean = expected.reduce((a, b) => a + b, 0) / expected.length,
    sst = expected.reduce((a, b) => a + (b - mean) ** 2, 0);
  return sst === 0
    ? null
    : 1 - expected.reduce((a, b, i) => a + (b - predicted[i]) ** 2, 0) / sst;
}
export function mae(expected, predicted) {
  return valid(expected, predicted)
    ? expected.reduce((a, b, i) => a + Math.abs(b - predicted[i]), 0) /
        expected.length
    : null;
}
export function wape(expected, predicted) {
  if (!valid(expected, predicted)) return null;
  const den = expected.reduce((a, b) => a + Math.abs(b), 0);
  return den === 0
    ? null
    : expected.reduce((a, b, i) => a + Math.abs(b - predicted[i]), 0) / den;
}
export function passes(task, value) {
  return (
    Number.isFinite(value) &&
    (task === "R08"
      ? value > 0.97
      : task === "R11"
        ? value >= 0.94
        : value < 0.05)
  );
}
export function aggregate(rows) {
  return Object.fromEntries(
    ["R08", "R09", "R10", "R11"].map((task) => {
      const group = rows.filter((r) => r.task === task),
        ok = group.filter(
          (r) =>
            r.status === "ok" &&
            (task === "R11"
              ? r.expected &&
                r.prediction &&
                typeof r.expected === "object" &&
                typeof r.prediction === "object"
              : valid(r.expected, r.prediction)),
        ),
        failed = group.length - ok.length;
      const expected = ok.flatMap((r) => r.expected),
        predicted = ok.flatMap((r) => r.prediction);
      const withinSST =
        task === "R08"
          ? ok.reduce((sum, r) => {
              const mean =
                r.expected.reduce((a, b) => a + b, 0) / r.expected.length;
              return sum + r.expected.reduce((a, b) => a + (b - mean) ** 2, 0);
            }, 0)
          : 0;
      const withinSSE =
        task === "R08"
          ? ok.reduce(
              (sum, r) =>
                sum +
                r.expected.reduce(
                  (a, b, i) => a + (b - r.prediction[i]) ** 2,
                  0,
                ),
              0,
            )
          : 0;
      const value =
        task === "R08"
          ? withinSST === 0
            ? null
            : 1 - withinSSE / withinSST
          : task === "R09"
            ? mae(expected, predicted) === null
              ? null
              : mae(expected, predicted) / 20
            : task === "R10"
              ? wape(expected, predicted)
              : group.length
                ? ok.filter((r) => exactTuple(r.expected, r.prediction))
                    .length / group.length
                : null;
      return [
        task,
        {
          metric:
            task === "R08"
              ? "within-series pooled R² (provisional)"
              : task === "R09"
                ? "MAE / fixed 20°C operating span"
                : task === "R10"
                  ? "WAPE"
                  : "exact knowledge source/family/model/version/reason tuple accuracy",
          value,
          threshold:
            task === "R08" ? "> 0.97" : task === "R11" ? ">= 0.94" : "< 0.05",
          totalCases: group.length,
          validCases: ok.length,
          failedCases: failed,
          coverage: group.length ? ok.length / group.length : 0,
          pass: group.length > 0 && failed === 0 && passes(task, value),
          ...(task === "R09"
            ? { maeC: mae(expected, predicted), normalizationSpanC: 20 }
            : {}),
          ...(task === "R08"
            ? {
                officialDefinitionPending: true,
                pooledGlobalR2: rSquared(expected, predicted),
                withinSeriesSST: withinSST,
              }
            : {}),
          numericMetricsExcludeFailedCases: task !== "R11",
        },
      ];
    }),
  );
}
// Independent classical comparator; never used as a model answer fallback.
export function numericalBaseline(input) {
  const ys = input.history.slice(-6),
    n = ys.length,
    xmean = (n - 1) / 2,
    ymean = ys.reduce((a, b) => a + b, 0) / n;
  const slope =
    ys.reduce((a, y, i) => a + (i - xmean) * (y - ymean), 0) /
    ys.reduce((a, _, i) => a + (i - xmean) ** 2, 0);
  return Array.from(
    { length: input.horizon },
    (_, i) =>
      ymean +
      slope * (n + i - xmean) +
      (Number.isFinite(input.knownNextWindowAdditiveChange)
        ? input.knownNextWindowAdditiveChange
        : 0),
  );
}
