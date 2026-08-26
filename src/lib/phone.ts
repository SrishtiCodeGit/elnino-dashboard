/** Strips everything except digits and a leading "+" — so "+1 555 010
 * 0123", "+1-555-010-0123", and "+15550100123" all normalize to the same
 * value before validation/sending. Used by both the client (Agent
 * Sentinel's phone field) and the server (/api/risk-check, sms.ts) so the
 * two can't quietly drift into accepting different formats. */
export function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, "");
}

/** E.164-ish: leading +, 8-15 digits. Real validation happens at Vonage —
 * this just filters out obviously-wrong input before we bother sending. */
export function isValidPhone(input: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(input));
}
