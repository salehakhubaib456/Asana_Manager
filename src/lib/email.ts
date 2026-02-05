/**
 * Email validation – structured format only.
 * Local part (before @) must contain at least one letter (e.g. user456@... valid, 456@... invalid).
 */

/** Local part must contain at least one letter; no purely numeric usernames like 456@gmail.com */
const STRUCTURED_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]*[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  const trimmed = email?.trim();
  if (!trimmed) return false;
  return STRUCTURED_EMAIL_REGEX.test(trimmed);
}

export const INVALID_EMAIL_MESSAGE = "Invalid email address";
