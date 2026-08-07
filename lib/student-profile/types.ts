/** Student Profile Engine — aggregation types (no duplicated OLTP blobs). */

export type StudentProfileModuleId =
  | "personal"
  | "admission"
  | "academic_history"
  | "attendance"
  | "assessments"
  | "report_cards"
  | "events"
  | "competitions"
  | "achievements"
  | "behaviour"
  | "medical"
  | "documents"
  | "parents"
  | "transport"
  | "house"
  | "club_membership"
  | "ai_summary";

export type ModuleSource = "live" | "schema_ready" | "derived" | "placeholder";

export type StudentProfileModuleDefinition = {
  id: StudentProfileModuleId;
  name: string;
  ownerEngine: string;
  description: string;
};

export type StudentProfileModulePayload<T = unknown> = {
  id: StudentProfileModuleId;
  name: string;
  ownerEngine: string;
  source: ModuleSource;
  note?: string;
  data: T;
};

export type StudentProfileActionResult =
  | { success: true; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type PersonalInformationData = {
  studentProfileId: string;
  personId: string;
  studentGlobalId: string;
  personGlobalId: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  aadhaarLast4: string | null;
  photoPath: string | null;
  address: string | null;
  profileCompletedAt: string | null;
};

export type AdmissionData = {
  admissionId: string;
  admissionNumber: string;
  status: string;
  admittedOn: string;
  exitedOn: string | null;
  houseIdPointer: string | null;
} | null;

export type AcademicHistoryRow = {
  id: string;
  academicYearId: string;
  academicYearLabel: string | null;
  classId: string;
  className: string | null;
  sectionId: string;
  sectionName: string | null;
  rollNumber: string | null;
  enrolledOn: string;
  leftOn: string | null;
  status: string;
  promotionStatus: string | null;
  enrollmentType: string;
};

export type ParentLinkRow = {
  linkId: string;
  relationship: string;
  isPrimary: boolean;
  parentProfileId: string;
  parentGlobalId: string;
  personId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
};

export type HouseMembershipRow = {
  membershipId: string;
  houseId: string;
  houseName: string | null;
  role: string;
  academicYearId: string | null;
  joinedOn: string;
  leftOn: string | null;
};

export type ClubMembershipRow = {
  membershipId: string;
  clubId: string;
  clubName: string | null;
  role: string;
  academicYearId: string | null;
  joinedOn: string;
  leftOn: string | null;
};

export type MedicalData = {
  bloodGroup: string | null;
  medicalNotes: string | null;
  incidents: Array<{
    id: string;
    occurredOn: string;
    title: string;
    severity: string;
    description: string | null;
  }>;
};

export type AssessmentModuleData = {
  classSchedules: Array<{
    scheduleId: string;
    examDefinitionId: string;
    examName: string | null;
    subjectId: string;
    subjectName: string | null;
    gradingType: string;
    maxMarks: number | null;
  }>;
  results: Array<{
    id: string;
    examDefinitionId: string;
    subjectId: string;
    marksObtained: number | null;
    maxMarks: number | null;
    gradeLabel: string | null;
    isAbsent: boolean;
    publishedAt: string | null;
  }>;
};

export type AiSummaryData = {
  status: "not_built";
  message: string;
  inputModuleIds: StudentProfileModuleId[];
};

export type StudentProfileAggregate = {
  schoolId: string;
  studentProfileId: string;
  generatedAt: string;
  modules: Record<StudentProfileModuleId, StudentProfileModulePayload>;
};

export type StudentDirectoryRow = {
  studentProfileId: string;
  personId: string;
  fullName: string;
  studentGlobalId: string;
  admissionId: string;
  admissionNumber: string;
  admissionStatus: string;
  className: string | null;
  sectionName: string | null;
  rollNumber: string | null;
};

export type PersonalInformationInput = {
  studentProfileId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: "" | "male" | "female" | "other";
  email?: string;
  phone?: string;
  address?: string;
  photoPath?: string | null;
  bloodGroup?: string;
  medicalNotes?: string;
};
