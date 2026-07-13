/**
 * Lightweight client-side validation helpers.
 * These run before hitting the network and give instant feedback.
 */

/** Basic email format check — matches the same pattern class-validator uses. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Strip non-digit characters (for OTP fields on web where keyboardType is ignored). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}
