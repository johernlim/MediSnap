/**
 * The daily-adherence streak shown on the settings screen.
 *
 * A day counts when every dose scheduled for it was taken and none was missed.
 * One missed dose resets the streak to zero, the same day.
 *
 * All of this is pure: it takes reminders and dose logs and returns numbers, so
 * the rules can be tested without Firestore or a device clock.
 */

export const MILESTONES = [7, 30, 100];

/** How far back to look. Beyond this a streak is not worth reconstructing. */
export const MAX_LOOKBACK_DAYS = 130;

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Local calendar day as YYYY-MM-DD. Not toISOString, which shifts by timezone. */
export function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

/**
 * How many doses a reminder expects on a given date.
 *
 * Paused reminders expect nothing. Weekly and monthly ones only land on their
 * own day, so an ordinary Tuesday cannot break a streak built on a Sunday-only
 * medication.
 */
export function expectedDosesOn(reminder, date) {
  if (!reminder || reminder.reminder_status !== 'Active') return 0;

  const times = (reminder.reminder_times || []).filter(
    (value) => String(value || '').trim() !== ''
  );

  if (!times.length) return 0;

  const d = date instanceof Date ? date : new Date(date);

  switch (reminder.repeat_type) {
    case 'Daily':
      return times.length;
    case 'Weekly':
      return WEEKDAY_NAMES[d.getDay()] === reminder.weekly_day ? times.length : 0;
    case 'Monthly':
      return Number(reminder.monthly_day) === d.getDate() ? times.length : 0;
    default:
      return 0;
  }
}

/** Total doses expected across every reminder on one date. */
export function expectedTotalOn(reminders, date) {
  return (reminders || []).reduce(
    (sum, reminder) => sum + expectedDosesOn(reminder, date),
    0
  );
}

/**
 * Rolls reminders and logs into one summary per day, newest first.
 *
 * @param {Array} reminders
 * @param {Array} logs  dose_logs entries with { status, loggedAt: Date }
 * @param {Date}  today
 * @param {number} lookbackDays
 */
export function summarizeDays(reminders, logs, today, lookbackDays = 60) {
  const byDay = {};

  for (const log of logs || []) {
    const when = log.loggedAt instanceof Date ? log.loggedAt : null;
    if (!when) continue;

    const key = dayKey(when);
    if (!byDay[key]) byDay[key] = { taken: 0, missed: 0 };

    if (log.status === 'taken') byDay[key].taken += 1;
    if (log.status === 'missed') byDay[key].missed += 1;
  }

  const summaries = [];

  for (let offset = 0; offset < lookbackDays; offset += 1) {
    const date = addDays(today, -offset);
    const key = dayKey(date);
    const counts = byDay[key] || { taken: 0, missed: 0 };
    const expected = expectedTotalOn(reminders, date);

    summaries.push({
      date: key,
      expected,
      taken: counts.taken,
      missed: counts.missed,
      // A day with nothing scheduled is neutral: it neither builds a streak
      // nor breaks one.
      neutral: expected === 0,
      complete: expected > 0 && counts.missed === 0 && counts.taken >= expected,
      broken: counts.missed > 0,
    });
  }

  return summaries;
}

/**
 * Consecutive complete days, counting back from today.
 *
 * Today is treated gently: a day still in progress does not break the streak,
 * because the evening dose has not come round yet. A missed dose today does
 * break it immediately.
 */
export function computeStreak(summaries) {
  if (!summaries?.length) return 0;

  let count = 0;
  let index = 0;

  const todaySummary = summaries[0];

  if (todaySummary.broken) return 0;

  if (todaySummary.complete) {
    count += 1;
  }

  // Whether or not today is finished, the run continues from yesterday.
  index = 1;

  while (index < summaries.length) {
    const day = summaries[index];

    if (day.neutral) {
      index += 1;
      continue;
    }

    if (!day.complete) break;

    count += 1;
    index += 1;
  }

  return count;
}

/** The highest milestone this streak has reached, or null. */
export function milestoneReached(streak) {
  const hit = MILESTONES.filter((value) => streak >= value);
  return hit.length ? hit[hit.length - 1] : null;
}

/**
 * The milestone worth celebrating right now: reached, and not already shown.
 */
export function pendingMilestone(streak, celebrated) {
  const seen = new Set((celebrated || []).map(Number));

  for (const value of MILESTONES) {
    if (streak >= value && !seen.has(value)) {
      return value;
    }
  }

  return null;
}

/** Copy for the milestone popup. */
export function milestoneMessage(milestone) {
  switch (milestone) {
    case 7:
      return {
        title: 'One week without missing a dose',
        body: 'Seven days in a row. This is the hardest part of any new routine, and you have already done it. Keep the streak going.',
        cta: 'Keep it up',
      };
    case 30:
      return {
        title: 'A full month on schedule',
        body: 'Thirty days of taking every dose on time. Your treatment works best exactly like this — steady, and without gaps.',
        cta: 'Brilliant',
      };
    case 100:
      return {
        title: '100 days',
        body: 'One hundred days without a single missed dose. That is not luck, that is a habit. Few people manage this.',
        cta: 'Thank you',
      };
    default:
      return {
        title: `${milestone} day streak`,
        body: 'Another milestone reached. Keep following your schedule.',
        cta: 'Keep it up',
      };
  }
}

/** The line under the fire on the settings screen. */
export function describeStreak(streak) {
  if (streak === 0) {
    return 'Take every dose today to start a streak.';
  }

  if (streak === 1) {
    return '1 day without a missed dose.';
  }

  const next = MILESTONES.find((value) => value > streak);

  if (!next) {
    return `${streak} days without a missed dose.`;
  }

  const away = next - streak;

  return `${streak} days without a missed dose. ${away} more to reach ${next}.`;
}
