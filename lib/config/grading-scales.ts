import type { GradingBand, GradingScaleInput } from "@/lib/config/types";
import { slugCode } from "@/lib/config/codes";

export function trimGradingScaleInput(input: GradingScaleInput): GradingScaleInput {
  return {
    id: input.id,
    code: slugCode(input.code || input.name, "GRD"),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    bands: (input.bands ?? []).map((band) => ({
      min: Number(band.min),
      max: Number(band.max),
      grade: String(band.grade ?? "").trim(),
      label: band.label?.trim() || undefined,
    })),
  };
}

export function validateGradingBands(bands: GradingBand[]): Record<string, string> {
  const errors: Record<string, string> = {};

  if (bands.length === 0) {
    errors.bands = "Add at least one grade band.";
    return errors;
  }

  bands.forEach((band, index) => {
    if (!Number.isFinite(band.min) || !Number.isFinite(band.max)) {
      errors[`band-${index}`] = "Min and max must be numbers.";
      return;
    }
    if (band.min > band.max) {
      errors[`band-${index}`] = "Min cannot exceed max.";
    }
    if (!band.grade) {
      errors[`band-${index}-grade`] = "Grade label is required.";
    }
  });

  return errors;
}

export function validateGradingScaleInput(
  input: GradingScaleInput,
): Record<string, string> {
  const trimmed = trimGradingScaleInput(input);
  const errors: Record<string, string> = {};

  if (!trimmed.name) {
    errors.name = "Scale name is required.";
  }
  if (!trimmed.code) {
    errors.code = "Scale code is required.";
  }

  return { ...errors, ...validateGradingBands(trimmed.bands) };
}
