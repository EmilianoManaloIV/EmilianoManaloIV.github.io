// Talk status from the session times. Pure functions with no DOM access, so the
// time boundaries can be unit-tested in Node. Times are epoch milliseconds.

// "tba" when the times are missing or invalid, then upcoming, live, ended.
export function talkStatus(now, start, end) {
  if (!(start < end)) return { state: "tba" };
  if (now < start) return { state: "upcoming", ms: start - now };
  if (now < end) return { state: "live" };
  return { state: "ended" };
}

// Countdown rounded up to the minute, so it never reads "in 0m" before the start.
export function formatCountdown(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (days) return `in ${days}d ${pad(hours)}h`;
  if (hours) return `in ${hours}h ${pad(mins)}m`;
  return `in ${mins}m`;
}
