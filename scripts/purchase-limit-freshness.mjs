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

function currentLocalCalendarDay() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function evaluatePurchaseLimitSnapshotFreshness(meta, {
  verificationDate,
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
    const asOf = parseCalendarDay(
      verificationDate ?? currentLocalCalendarDay(),
      "verificationDate",
    );
    const rawAgeDays = asOf.dayIndex - fetched.dayIndex;
    if (rawAgeDays < 0) {
      return {
        status: "fail",
        passed: false,
        reasonCode: "future_snapshot",
        ageDays: rawAgeDays,
        fetchedDate: fetched.date,
        asOfDate: asOf.date,
        message: `${snapshotPath} purchaseLimitFetchedAt=${fetchedAt} is ${Math.abs(rawAgeDays)} calendar day(s) later than verification date ${asOf.date}; future snapshots are not publishable for ${releaseLabel}.`,
      };
    }
    const ageDays = rawAgeDays;
    const status = ageDays >= failAgeDays ? "fail" : ageDays >= warnAgeDays ? "warn" : "ok";
    const ageText = `${ageDays} calendar day(s) old as of ${asOf.date}`;
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
