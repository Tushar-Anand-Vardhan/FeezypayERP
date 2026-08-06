import { createHash } from "crypto";

/**
 * Aadhaar helpers for global identity matching.
 *
 * Storage rules:
 * - Never persist plaintext Aadhaar.
 * - Normalize to exactly 12 digits (strip spaces/dashes), then SHA-256 hex digest.
 * - Persist `aadhaar_hash` (+ optional `aadhaar_last4` for UI) on `persons` only.
 * - Match order in onboarding: aadhaar_hash first, then email.
 */

export function normalizeAadhaar(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 12) {
    return null;
  }
  return digits;
}

/** Normalize 12 digits → `{ hash: sha256 hex, last4 }`. Returns null if invalid. */
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
