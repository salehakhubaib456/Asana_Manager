/**
 * Password validation and strength for signup.
 * Rules: 8–12 chars, uppercase + lowercase, number, special (!@#), no common passwords.
 */

export const PASSWORD = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 12,
  SPECIAL_CHARS: "!@#$%^&*()_+-=[]{}|;:',.<>?/",
} as const;

const COMMON_PASSWORDS = new Set(
  [
    "123456", "12345678", "123456789", "1234567890", "password", "password1",
    "password123", "qwerty", "abc123", "111111", "123123", "admin", "letmein",
    "welcome", "monkey", "dragon", "master", "login", "princess", "football",
    "iloveyou", "admin123", "root", "pass", "passw0rd", "passwort", "qwerty123",
    "admin@123", "welcome1", "changeme", "password2", "1234", "12345", "sunshine",
    "shadow", "ashley", "bailey", "access", "trustno1", "superman", "qazwsx",
  ].map((s) => s.toLowerCase())
);

export type PasswordStrength = "weak" | "medium" | "strong";

export interface PasswordChecks {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
  notCommon: boolean;
}

export function getPasswordChecks(password: string): PasswordChecks {
  const lower = password.toLowerCase();
  return {
    length: password.length >= PASSWORD.MIN_LENGTH && password.length <= PASSWORD.MAX_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{}|;':",.<>?/\\]/.test(password),
    notCommon: !COMMON_PASSWORDS.has(lower),
  };
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "weak";
  const checks = getPasswordChecks(password);
  const met = [
    checks.length,
    checks.uppercase,
    checks.lowercase,
    checks.number,
    checks.special,
    checks.notCommon,
  ].filter(Boolean).length;
  if (met >= 5 && checks.length && checks.notCommon) return "strong";
  if (met >= 3) return "medium";
  return "weak";
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  const checks = getPasswordChecks(password);
  if (password.length < PASSWORD.MIN_LENGTH)
    return { valid: false, error: `Password must be at least ${PASSWORD.MIN_LENGTH} characters` };
  if (password.length > PASSWORD.MAX_LENGTH)
    return { valid: false, error: `Password must be at most ${PASSWORD.MAX_LENGTH} characters` };
  if (!checks.uppercase)
    return { valid: false, error: "Password must include at least one uppercase letter" };
  if (!checks.lowercase)
    return { valid: false, error: "Password must include at least one lowercase letter" };
  if (!checks.number)
    return { valid: false, error: "Password must include at least one number" };
  if (!checks.special)
    return { valid: false, error: "Password must include at least one special character (!@# etc.)" };
  if (!checks.notCommon)
    return { valid: false, error: "This password is too common. Choose a stronger one." };
  return { valid: true };
}
