/** 24h "HH:MM", 00:00–23:59. "24:00" is allowed as an end-of-day closing time. */
export const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}
