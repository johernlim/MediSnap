/**
 * Turns the medication form's structured inputs into the single `dosage` and
 * `frequency` strings that the rest of the app already expects, and back again
 * when an existing record is opened for editing.
 *
 * Keeping the stored shape as strings means MedicationItem, the reminder
 * notification text and the ERD all continue to work untouched.
 */

/** Units offered in the picker, in the order they appear. */
export const DOSE_UNITS = [
  { value: 'tablet', label: 'tablet', plural: 'tablets' },
  { value: 'capsule', label: 'capsule', plural: 'capsules' },
  { value: 'ml', label: 'ml', plural: 'ml' },
  { value: 'mg', label: 'mg', plural: 'mg' },
  { value: 'g', label: 'g', plural: 'g' },
  { value: 'drop', label: 'drop', plural: 'drops' },
  { value: 'puff', label: 'puff', plural: 'puffs' },
  { value: 'sachet', label: 'sachet', plural: 'sachets' },
  { value: 'spray', label: 'spray', plural: 'sprays' },
  { value: 'unit', label: 'unit', plural: 'units' },
];

export const DEFAULT_DOSE_UNIT = 'tablet';

/** How many times per day the chips offer before falling back to "Other". */
export const FREQUENCY_PRESETS = [1, 2, 3];

const MAX_TIMES_PER_DAY = 12;

function findUnit(value) {
  return DOSE_UNITS.find((unit) => unit.value === value) || null;
}

/**
 * "2" + "tablet" -> "2 tablets"
 *
 * Measurement units (ml, mg, g) never take a plural; countable ones do. The
 * result is what appears on the medication card and inside the reminder
 * notification, so it has to read like a sentence fragment.
 */
export function composeDosage(amount, unitValue) {
  const numeric = Number(amount);
  const unit = findUnit(unitValue);

  if (!unit || !Number.isFinite(numeric)) {
    return '';
  }

  // Drop a trailing ".0" so 2 does not display as "2.0".
  const shown = String(Number(numeric.toFixed(3)));
  const word = numeric === 1 ? unit.label : unit.plural;

  return `${shown} ${word}`;
}

/**
 * "2 tablets" -> { amount: '2', unit: 'tablet' }
 *
 * Also handles the free-text values saved before this form existed, such as
 * "500mg" with no space. When the unit cannot be recognised the amount is
 * still recovered if it is numeric, so the user only has to re-pick the unit.
 */
export function parseDosage(dosageText) {
  const text = String(dosageText || '').trim();

  const fallback = { amount: '', unit: DEFAULT_DOSE_UNIT, matched: false };

  if (!text) {
    return fallback;
  }

  const match = text.match(/^([\d]+(?:\.[\d]+)?)\s*(.*)$/);

  if (!match) {
    return fallback;
  }

  const amount = match[1];
  const rest = match[2].trim().toLowerCase();

  if (!rest) {
    return { amount, unit: DEFAULT_DOSE_UNIT, matched: false };
  }

  // Try the written form first, then the singular of a plural like "tablets".
  const singular = rest.endsWith('s') ? rest.slice(0, -1) : rest;

  const unit =
    DOSE_UNITS.find((u) => u.plural === rest || u.label === rest) ||
    DOSE_UNITS.find((u) => u.value === singular);

  if (!unit) {
    return { amount, unit: DEFAULT_DOSE_UNIT, matched: false };
  }

  return { amount, unit: unit.value, matched: true };
}

/** 3 -> "3x/day" */
export function composeFrequency(timesPerDay) {
  const numeric = Number(timesPerDay);

  if (!Number.isInteger(numeric) || numeric < 1) {
    return '';
  }

  return `${numeric}x/day`;
}

/**
 * "3x/day" -> 3, and null for anything else.
 *
 * Returning null rather than guessing matters: a record saved as
 * "Twice daily after meals" must not be silently rewritten as "1x/day". The
 * form leaves the choice unselected instead and makes the user pick.
 */
export function parseFrequency(frequencyText) {
  const text = String(frequencyText || '').trim().toLowerCase();
  const match = text.match(/^(\d+)\s*x\s*\/\s*day$/);

  if (!match) {
    return null;
  }

  const numeric = Number(match[1]);

  return numeric >= 1 && numeric <= MAX_TIMES_PER_DAY ? numeric : null;
}

/** Validates the dose amount box. Returns an error string, or '' when valid. */
export function validateDoseAmount(amount) {
  const text = String(amount || '').trim();

  if (!text) {
    return 'Please enter the dosage amount';
  }

  if (!/^\d+(\.\d+)?$/.test(text)) {
    return 'Amount must be a number';
  }

  const numeric = Number(text);

  if (numeric <= 0) {
    return 'Amount must be more than 0';
  }

  if (numeric > 10000) {
    return 'Amount looks too large';
  }

  return '';
}

/** Validates the "Other" times-per-day box. Returns an error string, or ''. */
export function validateTimesPerDay(times) {
  const text = String(times || '').trim();

  if (!text) {
    return 'Please enter how many times per day';
  }

  if (!/^\d+$/.test(text)) {
    return 'Enter a whole number';
  }

  const numeric = Number(text);

  if (numeric < 1) {
    return 'Must be at least 1 time per day';
  }

  if (numeric > MAX_TIMES_PER_DAY) {
    return `Cannot be more than ${MAX_TIMES_PER_DAY} times per day`;
  }

  return '';
}
