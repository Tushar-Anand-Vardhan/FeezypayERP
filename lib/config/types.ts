/** Configuration Engine (E07) shared types. */

export type ConfigActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type SubjectType = "scholastic" | "co_scholastic";

export type SubjectInput = {
  id?: string;
  name: string;
  code?: string;
  type: SubjectType;
};

export type SubjectRecord = {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  type: SubjectType;
  archivedAt: string | null;
};

export type HouseInput = {
  id?: string;
  name: string;
  code?: string;
  displayOrder?: number;
};

export type ClubInput = {
  id?: string;
  name: string;
  description?: string;
  displayOrder?: number;
};

export type GradingBand = {
  min: number;
  max: number;
  grade: string;
  label?: string;
};

export type GradingScaleInput = {
  id?: string;
  code: string;
  name: string;
  description?: string;
  bands: GradingBand[];
};

export type SchoolBrandingInput = {
  name: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  contactPhone: string;
  contactEmail: string;
  board: string;
  affiliationNumber: string;
  housesEnabled?: boolean;
  clubsEnabled?: boolean;
  logoPath?: string | null;
};
