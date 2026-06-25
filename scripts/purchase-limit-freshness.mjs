const DAY_MS = 24 * 60 * 60 * 1000;

export const PURCHASE_LIMIT_SNAPSHOT_WARN_AGE_DAYS = 5;
export const PURCHASE_LIMIT_SNAPSHOT_FAIL_AGE_DAYS = 10;

function formatValue(value) {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

function parseCalendarDay(value, fieldName) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? "").trim());
  if (!match) {
    throw new Error(`${fieldName} must start with YYYY-MM-DD, got ${formatValue(value)}`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} is not a valid calendar date, got ${formatValue(value)}`);
  }

  return {
    dayIndex: Math.floor(timestamp / DAY_MS),
    date: `${yearText}-${monthText}-${dayText}`,
  };
}

export function evaluatePurchaseLimitSnapshotFreshness(meta, {
  asOfDate,
  releaseLabel = "the release",
  warnAgeDays = PURCHASE_LIMIT_SNAPSHOT_WARN_AGE_DAYS,
  failAgeDays = PURCHASE_LIMIT_SNAPSHOT_FAIL_AGE_DAYS,
  snapshotPath = "purchase limit snapshot",
} = {}) {
  const fetchedAt = meta?.purchaseLimitFetchedAt;
  if (!fetchedAt) {
    return {
      status: "fail",
      passed: false,
      message: `${snapshotPath} is missing purchaseLimitFetchedAt; refresh the purchase limit snapshot before publishing ${releaseLabel}.`,
    };
  }

  try {
    const fetched = parseCalendarDay(fetchedAt, "purchaseLimitFetchedAt");
    const asOf = parseCalendarDay(asOfDate ?? new Date().toISOString().slice(0, 10), "asOfDate");
    const rawAgeDays = asOf.dayIndex - fetched.dayIndex;
    const ageDays = Math.max(0, rawAgeDays);
    const status = ageDays >= failAgeDays ? "fail" : ageDays >= warnAgeDays ? "warn" : "ok";
    const ageText = rawAgeDays >= 0
      ? `${ageDays} calendar day(s) old as of ${asOf.date}`
      : `${Math.abs(rawAgeDays)} calendar day(s) newer than ${asOf.date}`;
    const source = meta?.purchaseLimitSource || "N/A";
    const rows = meta?.purchaseLimitCount ?? "N/A";

    return {
      status,
      passed: status !== "fail",
      ageDays,
      fetchedDate: fetched.date,
      asOfDate: asOf.date,
      message: `${snapshotPath} purchaseLimitFetchedAt=${fetchedAt} is ${ageText}; rows=${rows}; source=${source}; warn >= ${warnAgeDays}d, fail >= ${failAgeDays}d. Refresh outputs/fund_purchase_limit_snapshot.csv before publishing ${releaseLabel}.`,
    };
  } catch (error) {
    return {
      status: "fail",
      passed: false,
      message: `${snapshotPath} has invalid purchase limit freshness metadata: ${error.message}`,
    };
  }
}
