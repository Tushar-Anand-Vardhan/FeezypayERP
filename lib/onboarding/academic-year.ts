export function deriveAcademicYearLabel(
  academicYearStartMonth: number,
  referenceDate = new Date(),
): string {
  const currentMonth = referenceDate.getMonth() + 1;
  const currentYear = referenceDate.getFullYear();

  const startYear =
    currentMonth >= academicYearStartMonth ? currentYear : currentYear - 1;
  const endYearShort = (startYear + 1) % 100;

  return `${startYear}-${String(endYearShort).padStart(2, "0")}`;
}
