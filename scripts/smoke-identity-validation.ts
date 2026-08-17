/**
 * Local validation + CSV smoke tests (no DB).
 * Run: npx tsx scripts/smoke-identity-validation.ts
 */
import assert from "node:assert/strict";
import {
  STAFF_CSV_HEADERS,
  staffRowFromCsv,
  validateStaffDraft,
  validateStaffRows,
} from "../lib/onboarding/staff";
import {
  STUDENT_CSV_HEADERS,
  studentRowFromCsv,
  validateStudentRows,
} from "../lib/onboarding/students";
import { hashAadhaar } from "../lib/identity/aadhaar";

const subjects = ["Physics", "Chemistry", "Biology", "Math"];

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("Staff CSV headers include aadhaar + subjects");
assert.ok(STAFF_CSV_HEADERS.includes("aadhaar"));
assert.ok(STAFF_CSV_HEADERS.includes("subjects"));
assert.ok(STAFF_CSV_HEADERS.includes("is_hod"));
assert.ok(STAFF_CSV_HEADERS.includes("department"));
console.log("OK headers:", STAFF_CSV_HEADERS.join(","));

section("Multi-subject CSV parse (pipe-separated)");
const multi = staffRowFromCsv({
  full_name: "Priya Sharma",
  phone: "9999999999",
  email: "priya@school.edu",
  aadhaar: "123412341234",
  employee_code: "T001",
  designation: "Teacher",
  department: "Science",
  subjects: "Physics|Chemistry",
  is_hod: "false",
});
assert.deepEqual(multi.subjectNames, ["Physics", "Chemistry"]);
console.log("OK subjects:", multi.subjectNames.join(" | "));

section("HOD without department must block");
const hodErrors = validateStaffRows(
  [
    {
      fullName: "Amit Verma",
      phone: "",
      email: "amit@school.edu",
      aadhaar: "",
      employeeCode: "T002",
      designation: "HOD",
      departmentName: "",
      subjectNames: ["Physics"],
      isHod: true,
    },
  ],
  subjects,
);
assert.equal(
  hodErrors["staff-0-departmentName"],
  "Select which department this HOD leads.",
);
console.log("OK blocked:", hodErrors["staff-0-departmentName"]);

section("HOD draft without department blocked on add");
const draftErrors = validateStaffDraft(
  {
    fullName: "Amit Verma",
    phone: "",
    email: "amit@school.edu",
    aadhaar: "",
    employeeCode: "T002",
    designation: "HOD",
    departmentName: "",
    subjectNames: ["Physics"],
    isHod: true,
  },
  subjects,
  [],
);
assert.ok(draftErrors.draftDepartmentName || draftErrors["draft-departmentName"]);
console.log("OK draft block:", draftErrors.draftDepartmentName || draftErrors["draft-departmentName"]);

section("HOD with department passes");
const hodOk = validateStaffRows(
  [
    {
      fullName: "Amit Verma",
      phone: "",
      email: "amit@school.edu",
      aadhaar: "432143214321",
      employeeCode: "T002",
      designation: "HOD",
      departmentName: "Science",
      subjectNames: ["Physics", "Chemistry", "Biology"],
      isHod: true,
    },
  ],
  subjects,
);
assert.equal(Object.keys(hodOk).length, 0);
console.log("OK HOD+department+multi-subject");

section("Invalid Aadhaar blocked");
const badAadhaar = validateStaffRows(
  [
    {
      fullName: "X",
      phone: "",
      email: "x@school.edu",
      aadhaar: "123",
      employeeCode: "",
      designation: "",
      departmentName: "",
      subjectNames: [],
      isHod: false,
    },
  ],
  subjects,
);
assert.match(badAadhaar["staff-0-aadhaar"] ?? "", /12 digits/);
console.log("OK aadhaar validation");

section("Aadhaar hash deterministic");
const h1 = hashAadhaar("1234-1234-1234");
const h2 = hashAadhaar("123412341234");
assert.ok(h1 && h2);
assert.equal(h1.hash, h2.hash);
assert.equal(h1.last4, "1234");
console.log("OK hash last4=", h1.last4);

section("Student CSV + optional aadhaar");
assert.ok(STUDENT_CSV_HEADERS.includes("aadhaar"));
const student = studentRowFromCsv({
  full_name: "Aarav Patel",
  date_of_birth: "2015-04-12",
  gender: "male",
  admission_number: "ADM001",
  aadhaar: "123456789012",
  email: "",
  class: "Class 1",
  section: "A",
  guardian_name: "Ravi Patel",
  relationship: "father",
  guardian_phone: "9888888888",
  guardian_whatsapp: "9888888888",
  guardian_email: "ravi@email.com",
  whatsapp_opt_in: "true",
});
const studentErrors = validateStudentRows(
  [student],
  [{ className: "Class 1", sectionName: "A" }],
  { requireAtLeastOne: true },
);
assert.equal(Object.keys(studentErrors).length, 0);
console.log("OK student row with aadhaar+guardian");

section("Student CSV blocking — one bad row blocks import");
const badBatch = validateStudentRows(
  [
    student,
    studentRowFromCsv({
      full_name: "Broken Row",
      admission_number: "ADM002",
      class: "Class 9",
      section: "Z",
      guardian_name: "",
    }),
  ],
  [{ className: "Class 1", sectionName: "A" }],
);
assert.ok(badBatch["student-1-section"] || badBatch["student-1-guardian"]);
assert.ok(
  String(badBatch["student-1-section"] ?? "").includes("Class 9") ||
    badBatch["student-1-guardian"],
);
console.log("OK CSV blocked on invalid row");

section("Student class alias 6 ↔ Class 6 + section case");
const aliasStudent = studentRowFromCsv({
  full_name: "Warde Shubhra",
  admission_number: "ADM010",
  class: "6",
  section: "ROSE",
  guardian_name: "Parent",
});
const aliasErrors = validateStudentRows(
  [aliasStudent],
  [
    { className: "Class 6", sectionName: "Rose" },
    { className: "Class 6", sectionName: "Lotus" },
  ],
);
assert.equal(Object.keys(aliasErrors).length, 0);
console.log("OK class/section aliases");

section("Student empty aadhaar allowed");
const noAadhaar = studentRowFromCsv({
  full_name: "No Aadhaar Kid",
  admission_number: "ADM003",
  aadhaar: "",
  class: "Class 1",
  section: "A",
  guardian_name: "Parent",
});
const noAadhaarErrors = validateStudentRows(
  [noAadhaar],
  [{ className: "Class 1", sectionName: "A" }],
);
assert.equal(Object.keys(noAadhaarErrors).length, 0);
console.log("OK empty aadhaar allowed");

console.log("\nAll validation/CSV checks passed.\n");
