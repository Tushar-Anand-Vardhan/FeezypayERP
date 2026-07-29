import type { AuthError } from "@supabase/supabase-js";

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password) => /[0-9]/.test(password),
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string) {
  if (!email.trim()) {
    return "Email is required.";
  }
  if (!EMAIL_PATTERN.test(email)) {
    return "Please enter a valid email address.";
  }
  return null;
}

export function getPasswordRuleResults(password: string) {
  return PASSWORD_RULES.map((rule) => ({
    ...rule,
    met: rule.test(password),
  }));
}

export function isPasswordValid(password: string) {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function getPasswordValidationError(password: string) {
  if (!password) {
    return "Password is required.";
  }
  if (!isPasswordValid(password)) {
    return "Password must meet all requirements below.";
  }
  return null;
}

export function formatAuthError(error: AuthError | null) {
  if (!error) {
    return null;
  }

  return error.message;
}
