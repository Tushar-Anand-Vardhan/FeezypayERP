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

export type ReportCardIssueStatus = "draft" | "issued" | "revoked";

export type ReportCardVersionStatus =
  | "draft"
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

export type RegenerateReportCardInput = {
  issueId: string;
  /** When true, creates a new draft version even if current is issued (reissue path). */
  asNewVersion?: boolean;
};

export type IssueReportCardInput = {
  issueId: string;
  notes?: string | null;
};

/** Pointers to source engine facts — never duplicated marks rows. */
export type ReportCardSourceRefs = {
  examResultIds: string[];
  examDefinitionIds: string[];
  attendanceRecordIds?: string[];
  conductIncidentIds: string[];
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
  /** Derived from exam_results — ids in source_refs; values here for reprint display only */
  assessments: Array<{
    examResultId: string;
    examDefinitionId: string;
    examName: string | null;
    subjectId: string;
    subjectName: string | null;
    marksObtained: number | null;
    maxMarks: number | null;
    gradeLabel: string | null;
    isAbsent: boolean;
    teacherRemark: string | null;
    workflowStatus: string | null;
  }>;
  attendance: {
    totalRecords: number;
    byStatus: Record<string, number>;
    presentRate: number | null;
  };
  teacherRemarksFromAssessments: string[];
  teacherRemarks: string | null;
  principalRemarks: string | null;
  coCurricular: {
    houses: Array<{ membershipId: string; houseId: string; houseName: string | null; role: string | null }>;
    clubs: Array<{ membershipId: string; clubId: string; clubName: string | null; role: string | null }>;
  };
  behaviour: Array<{
    incidentId: string;
    occurredOn: string;
    severity: string;
    category: string;
    title: string;
    status: string;
  }>;
  promotionStatus: string | null;
};

export const REPORT_CARD_ISSUE_STATUSES: ReportCardIssueStatus[] = [
  "draft",
  "issued",
  "revoked",
];

export const REPORT_CARD_VERSION_STATUSES: ReportCardVersionStatus[] = [
  "draft",
  "issued",
  "superseded",
  "revoked",
];
