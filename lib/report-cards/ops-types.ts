/** Report Card Engine (E20 issue / generation) — types. */

export type ReportCardOpsActionResult =
  | {
      success: true;
      message: string;
      id?: string;
      issueId?: string;
      versionId?: string;
      version?: number;
    }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

/** draft → published (legacy issued) → locked; revoked terminal */
export type ReportCardIssueStatus =
  | "draft"
  | "published"
  | "locked"
  | "issued"
  | "revoked";

export type ReportCardVersionStatus =
  | "draft"
  | "published"
  | "locked"
  | "issued"
  | "superseded"
  | "revoked";

export type CreateReportCardDraftInput = {
  studentProfileId: string;
  academicYearId: string;
  templateId: string;
  termId?: string | null;
  title?: string;
  teacherRemarks?: string | null;
  principalRemarks?: string | null;
};

export type UpdateReportCardRemarksInput = {
  issueId: string;
  teacherRemarks?: string | null;
  principalRemarks?: string | null;
};

export type FillReportCardFieldsInput = {
  issueId: string;
  /** field_key → narrative value (assigned fields only) */
  fields: Record<string, string | null>;
};

export type RegenerateReportCardInput = {
  issueId: string;
  /** When true, creates a new draft version even if current is published/locked (reissue path). */
  asNewVersion?: boolean;
};

export type IssueReportCardInput = {
  issueId: string;
  notes?: string | null;
};

export type LockReportCardInput = {
  issueId: string;
};

/** Pointers to source engine facts — never duplicated marks rows. */
export type ReportCardSourceRefs = {
  examResultIds: string[];
  examDefinitionIds: string[];
  gradeCalculationRunIds: string[];
  gradeCalculationResultIds: string[];
  attendanceRecordIds?: string[];
  conductIncidentIds: string[];
  achievementIds: string[];
  observationRecordIds: string[];
  curriculumProgressIds: string[];
  houseMembershipIds: string[];
  clubMembershipIds: string[];
  studentAcademicYearId: string | null;
  templateId: string;
  templateVersionId: string | null;
  academicYearId: string;
  termId: string | null;
};

export type ReportCardPresentationSnapshot = {
  generatedAt: string;
  student: {
    studentProfileId: string;
    personId: string | null;
    fullName: string | null;
    admissionNumber: string | null;
    globalId: string | null;
  };
  placement: {
    studentAcademicYearId: string | null;
    classId: string | null;
    className: string | null;
    sectionId: string | null;
    sectionName: string | null;
    rollNumber: string | null;
    promotionStatus: string | null;
    enrollmentStatus: string | null;
  };
  template: {
    templateId: string;
    templateName: string | null;
    templateVersionId: string | null;
    templateVersion: number | null;
  };
  /** Prefer E33 published results; E11 fallback — ids in source_refs */
  assessments: Array<{
    source: "grade_calculation" | "exam_result";
    resultId: string;
    examResultId?: string;
    examDefinitionId?: string | null;
    examName?: string | null;
    subjectId: string | null;
    subjectName: string | null;
    marksObtained: number | null;
    maxMarks: number | null;
    percentage: number | null;
    gradeLabel: string | null;
    gradePoints: number | null;
    passStatus: string | null;
    resultKind?: string | null;
    isAbsent: boolean;
    teacherRemark: string | null;
    workflowStatus: string | null;
  }>;
  gradeSummary: {
    subjectResults: Array<{
      resultId: string;
      subjectId: string | null;
      subjectName: string | null;
      percentage: number | null;
      letterGrade: string | null;
      gradePoints: number | null;
      passStatus: string | null;
    }>;
    termResult: {
      resultId: string;
      percentage: number | null;
      letterGrade: string | null;
      gradePoints: number | null;
      passStatus: string | null;
    } | null;
    overallResult: {
      resultId: string;
      percentage: number | null;
      letterGrade: string | null;
      gradePoints: number | null;
      passStatus: string | null;
    } | null;
  };
  attendance: {
    totalRecords: number;
    byStatus: Record<string, number>;
    presentRate: number | null;
  };
  teacherRemarksFromAssessments: string[];
  teacherRemarks: string | null;
  principalRemarks: string | null;
  fieldValues: Record<string, string | null>;
  coCurricular: {
    houses: Array<{
      membershipId: string;
      houseId: string;
      houseName: string | null;
      role: string | null;
    }>;
    clubs: Array<{
      membershipId: string;
      clubId: string;
      clubName: string | null;
      role: string | null;
    }>;
  };
  behaviour: Array<{
    incidentId: string;
    occurredOn: string;
    severity: string;
    category: string;
    title: string;
    status: string;
  }>;
  achievements: Array<{
    achievementId: string;
    title: string;
    category: string | null;
    awardedOn: string | null;
    description: string | null;
  }>;
  curriculumCompletion: {
    sectionId: string | null;
    totalNodes: number;
    completedNodes: number;
    completionPct: number | null;
    progressIds: string[];
  };
  observations: Array<{
    recordId: string;
    categoryId: string | null;
    categoryName: string | null;
    subjectId: string | null;
    subjectName: string | null;
    title: string | null;
    recordedOn: string | null;
    summary: string | null;
  }>;
  promotionStatus: string | null;
};

export const REPORT_CARD_ISSUE_STATUSES: ReportCardIssueStatus[] = [
  "draft",
  "published",
  "locked",
  "issued",
  "revoked",
];

export const REPORT_CARD_VERSION_STATUSES: ReportCardVersionStatus[] = [
  "draft",
  "published",
  "locked",
  "issued",
  "superseded",
  "revoked",
];

export function isPublishedStatus(status: string): boolean {
  return status === "published" || status === "issued" || status === "locked";
}

export function isLockedStatus(status: string): boolean {
  return status === "locked";
}
