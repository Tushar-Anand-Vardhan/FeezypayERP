import { createHash } from "crypto";

export function normalizeAadhaar(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 12) {
    return null;
  }
  return digits;
}

export function hashAadhaar(raw: string): {
  hash: string;
  last4: string;
} | null {
  const normalized = normalizeAadhaar(raw);
  if (!normalized) {
    return null;
  }

  return {
    hash: createHash("sha256").update(normalized).digest("hex"),
    last4: normalized.slice(-4),
  };
}

export function validateAadhaarInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (!normalizeAadhaar(trimmed)) {
    return "Aadhaar must be exactly 12 digits.";
  }
  return null;
}
