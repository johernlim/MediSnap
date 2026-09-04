/**
 * The follow-up chain behind a single dose reminder.
 *
 * The app's JavaScript never runs when a notification fires, so "five minutes
 * with no interaction" cannot be observed. Instead the whole chain is
 * scheduled up front and cancelled when the user answers: the grace period is
 * a definition, not a measurement.
 *
 *   09:00  alarm
 *   09:30  unanswered -> reminder 1   (5 grace + 25 = 30 from the alarm)
 *   10:00  unanswered -> reminder 2
 *   10:30  unanswered -> reminder 3
 *   11:00  still unanswered -> missed
 *
 * A manual "Remind me later" is 30 minutes from the tap instead, so pressing
 * it two minutes in lands at 09:32 rather than 09:30.
 */

export const GRACE_MINUTES = 5;

/** Wait after the grace period before an unanswered alarm repeats. */
export const AUTO_RETRY_MINUTES = 25;

/** A manual snooze, measured from the moment the button is pressed. */
export const SNOOZE_MINUTES = 30;

export const MAX_SNOOZES = 3;

/** Gap between one unanswered reminder and the next: 5 grace + 25 wait. */
export const STEP_MINUTES = GRACE_MINUTES + AUTO_RETRY_MINUTES;

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function formatClock(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

/**
 * Every notification that should follow an unanswered alarm.
 *
 * @returns {Array<{attempt: number, at: Date, kind: 'snooze'|'missed'}>}
 */
export function planDoseChain(alarmAt) {
  const start = alarmAt instanceof Date ? alarmAt : new Date(alarmAt);

  if (Number.isNaN(start.getTime())) {
    return [];
  }

  const chain = [];

  for (let attempt = 1; attempt <= MAX_SNOOZES; attempt += 1) {
    chain.push({
      attempt,
      at: addMinutes(start, STEP_MINUTES * attempt),
      kind: 'snooze',
    });
  }

  chain.push({
    attempt: MAX_SNOOZES + 1,
    at: addMinutes(start, STEP_MINUTES * (MAX_SNOOZES + 1)),
    kind: 'missed',
  });

  return chain;
}

/**
 * Where a manual "Remind me later" lands: a fixed 30 minutes from the tap,
 * not from the original dose time.
 */
export function nextSnoozeAt(from) {
  const now = from instanceof Date ? from : new Date(from);
  return addMinutes(now, SNOOZE_MINUTES);
}

/** True when this snooze is the last one allowed before the dose is missed. */
export function isFinalSnooze(attemptsUsed) {
  return Number(attemptsUsed) >= MAX_SNOOZES;
}

/** How many snoozes remain after `attemptsUsed` have been spent. */
export function snoozesRemaining(attemptsUsed) {
  const used = Number(attemptsUsed) || 0;
  return Math.max(0, MAX_SNOOZES - used);
}

/**
 * The line shown under the snooze button, so the user knows the budget is
 * finite before they spend the last one.
 */
export function describeSnoozeBudget(attemptsUsed) {
  const remaining = snoozesRemaining(attemptsUsed);

  if (remaining === 0) {
    return 'No reminders left — this dose will be recorded as missed.';
  }

  if (remaining === 1) {
    return 'Last reminder. After this the dose is recorded as missed.';
  }

  return `${remaining} reminders left.`;
}
