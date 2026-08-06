# FeezypayERP — Domain Model

> **Phase:** 0.5 — Architecture (design-only)  
> **Created:** 2026-08-06  
> **Companions:** [`docs/MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`system-events.md`](system-events.md) · [`rbac.md`](rbac.md) · [`versioning.md`](versioning.md) · [`audit-log.md`](audit-log.md) · [`notification-engine.md`](notification-engine.md) · [`ai-architecture.md`](ai-architecture.md)
> **Rules:** No SQL in this document. Entities are domain concepts; physical tables may map 1:1 or N:1 later. Owner engines must match the [ownership matrix](business-engines.md#10-ownership-matrix-exactly-one-owner).

---

## 1. How to read this model

| Term | Meaning |
|------|---------|
| **Entity** | A business noun with identity and lifecycle |
| **Owner Engine** | Sole write authority (E01–E28) |
| **Relationship** | Logical association (cardinality in prose / ER) |
| **Lifecycle** | Allowed state transitions |
| **Maturity** | `SHIPPED` · `PARTIAL` · `PLANNED` (not built) |

**Naming note:** Domain “Teacher” is not a single table. It is **Person + TeacherProfile + TeacherEmployment(s)**. Same for Student and Parent.

---

## 2. Entity catalog (index)

### 2.1 Tenancy & access

| Entity | Owner | Maturity |
|--------|-------|----------|
| [School](#school) | E01 (+ column owners E07/E08/E25) | `SHIPPED` |
| [SchoolAdminMembership](#schooladminmembership) | E01 | `SHIPPED` |
| [AuthUser](#authuser) | E02 | `SHIPPED` |
| [Permission](#permission) | E03 | `PLANNED` |
| [RolePermission](#rolepermission) | E03 | `PLANNED` |

### 2.2 Identity & people links

| Entity | Owner | Maturity |
|--------|-------|----------|
| [Person](#person) | E04 | `SHIPPED` |
| [PersonRole](#personrole) | E04 | `SHIPPED` |
| [TeacherProfile](#teacherprofile) | E04 | `SHIPPED` |
| [StudentProfile](#studentprofile) | E04 (+ E14 medical cols) | `SHIPPED` |
| [ParentProfile](#parentprofile) | E04 | `SHIPPED` |
| [TeacherEmployment](#teacheremployment) | E05 | `SHIPPED` |
| [EmploymentSubject](#employmentsubject) | E05 | `SHIPPED` |
| [Department](#department) | E05 | `SHIPPED` |
| [StudentAdmission](#studentadmission) | E06 | `SHIPPED` |
| [StudentPlacement](#studentplacement) | E06 | `SHIPPED` |
| [StudentParentLink](#studentparentlink) | E06 | `SHIPPED` |

### 2.3 Academic setup

| Entity | Owner | Maturity |
|--------|-------|----------|
| [AcademicYear](#academicyear) | E08 | `SHIPPED` |
| [Term](#term) | E08 | `SHIPPED` |
| [Holiday](#holiday) | E08 | `PLANNED` |
| [Subject](#subject) | E07 | `SHIPPED` |
| [ClassSubject](#classsubject) | E07 | `SHIPPED` |
| [GradingScale](#gradingscale) | E07 | `PLANNED` |
| [Class](#class) | E09 | `SHIPPED` |
| [Section](#section) | E09 | `SHIPPED` |
| [PromotionRule](#promotionrule) | E09 | `PLANNED` |
| [House](#house) | E07 | `SHIPPED` |
| [Club](#club) | E07 | `SHIPPED` |
| [HouseMembership](#housemembership) | E06/E07 | `PARTIAL` (via admission.house today) |
| [ClubMembership](#clubmembership) | E07 | `PLANNED` |
| [Period](#period) | E10 | `SHIPPED` |
| [TimetableSlot](#timetableslot) | E10 | `SHIPPED` |
| [TeachingAssignment](#teachingassignment) | E10 | `SHIPPED` |

### 2.4 Academic operations

| Entity | Owner | Maturity |
|--------|-------|----------|
| [Assessment](#assessment) | E11 | `PARTIAL` (definitions shipped; results planned) |
| [AssessmentSchedule](#assessmentschedule) | E11 | `SHIPPED` |
| [AssessmentResult](#assessmentresult) | E11 | `PLANNED` |
| [AttendanceRecord](#attendancerecord) | E12 | `PLANNED` |
| [ConductIncident](#conductincident) | E13 | `PLANNED` |
| [HealthIncident](#healthincident) | E14 | `PLANNED` |
| [LessonPlan](#lessonplan) | E10/E11-adjacent → **E10** (teaching) | `PLANNED` |

### 2.5 Commercial (Feezypay core)

| Entity | Owner | Maturity |
|--------|-------|----------|
| [FeeHead](#feehead) | E15 | `PLANNED` |
| [FeePlan](#feeplan) | E15 | `PLANNED` |
| [Invoice](#invoice) | E15 | `PLANNED` |
| [LedgerEntry](#ledgerentry) | E15 | `PLANNED` |
| [Payment](#payment) | E16 | `PLANNED` |

### 2.6 Engagement & output

| Entity | Owner | Maturity |
|--------|-------|----------|
| [CalendarEvent](#calendarevent) | E17 | `PLANNED` |
| [Competition](#competition) | E17 | `PLANNED` |
| [Announcement](#announcement) | E18 | `PLANNED` |
| [MessageTemplate](#messagetemplate) | E18 | `PLANNED` |
| [CommunicationConsent](#communicationconsent) | E18 | `PARTIAL` (seed fields historically) |
| [Notification](#notification) | E19 | `PLANNED` |
| [DocumentTemplate](#documenttemplate) | E20 | `PLANNED` |
| [IssuedDocument](#issueddocument) | E20 | `PLANNED` |
| [ReportCard](#reportcard) | E20 | `PLANNED` (specialization of IssuedDocument) |

### 2.7 Cross-cutting & growth

| Entity | Owner | Maturity |
|--------|-------|----------|
| [MediaAsset](#mediaasset) | E27 | `PARTIAL` |
| [ImportJob](#importjob) | E26 | `PARTIAL` |
| [AuditEntry](#auditentry) | E28 | `PLANNED` |
| [MarketplaceListing](#marketplacelisting) | E24 | `PLANNED` |
| [AISuggestion](#aisuggestion) | E23 | `PLANNED` |

---

## 3. Entity specifications

---

### School

**Purpose:** SaaS tenant and school organization root. All school-scoped data hangs off School.

**Relationships**
- 1 → * AcademicYear, Subject, Department, House, Club, FeePlan, CalendarEvent, …
- 1 → * SchoolAdminMembership
- 1 → * TeacherEmployment, StudentAdmission

**Lifecycle:** `provisioned` → `onboarding_in_progress` → `active` (`onboarding_status=completed`) → `suspended` (future) → `closed` (future). Deleting a school cascades school-scoped links; **Persons survive**.

**Owner Engine:** **E01** for id + lifecycle (`onboarding_status`). Column-level: branding **E07**, `academic_year_start_month` **E08**, wizard flags **E25**.

**Dependencies:** E02 (create-school signup), E03 (who may administer).

**Future extensions:** Multi-campus, timezone/locale, SaaS subscription, white-label.

---

### SchoolAdminMembership

**Purpose:** Binds an AuthUser to a School as school administrator (today’s `profiles` row).

**Relationships:** AuthUser 1—1 Membership; School 1—* Membership.

**Lifecycle:** Created at school signup; immutable `school_id`/`role` under current RLS; future revoke/transfer.

**Owner Engine:** **E01**

**Dependencies:** E02 (auth user exists).

**Future extensions:** Multiple admins per school; office staff subtypes; migrate toward Person-linked admin employment.

---

### AuthUser

**Purpose:** Authentication principal (Supabase `auth.users`). Proves identity credentials, not school membership.

**Relationships:** Optional 1—1 Person via `auth_user_id`; 0—1 SchoolAdminMembership.

**Lifecycle:** signup → confirmed → active → recovery → disabled.

**Owner Engine:** **E02**

**Dependencies:** None for existence; E01 only when intent=create_school; E04 when binding person.

**Future extensions:** MFA, SSO, invite-only users without new School (F11).

---

### Permission

**Purpose:** Named capability (e.g. `timetable.publish`, `fee.invoice.create`).

**Relationships:** *—* RolePermission —* PersonRole / custom roles.

**Lifecycle:** Catalog versioned by platform; school overrides later.

**Owner Engine:** **E03**

**Dependencies:** None.

**Future extensions:** Attribute-based conditions (section teacher only).

---

### RolePermission

**Purpose:** Grants a Permission to a role key (`teacher`, `parent`, custom).

**Relationships:** Permission *—*; role key string or custom role entity.

**Lifecycle:** CRUD by platform/school admin.

**Owner Engine:** **E03**

**Dependencies:** E04 `person_roles` as evidence of role keys.

**Future extensions:** Time-bound grants, delegations.

---

### Person

**Purpose:** Global human being. Match keys: Aadhaar hash + email. Never school-scoped.

**Relationships**
- 0—1 TeacherProfile, StudentProfile, ParentProfile
- * PersonRole
- 0—1 AuthUser (via auth_user_id)
- 0—1 MediaAsset (photo)

**Lifecycle:** created → enriched → `profile_completed` (timestamp set) → archived (soft, future). Never cascade-deleted by School.

**Owner Engine:** **E04**

**Dependencies:** E27 (media bytes); E02 (optional bind).

**Future extensions:** KYC verification, multiple phones, legal name history.

---

### PersonRole

**Purpose:** Declares capability class(es) on a Person (`teacher|student|parent|admin`). Multi-role allowed.

**Relationships:** Person 1—* PersonRole.

**Lifecycle:** granted on profile create; revoked rarely.

**Owner Engine:** **E04** (sole writer). **E03** interprets for AuthZ.

**Dependencies:** Teacher/Student/Parent profile creation flows.

**Future extensions:** School-scoped custom roles (then partly E03).

---

### TeacherProfile

**Purpose:** Lifelong teacher career identity (`TCH…`). Not a job at a school.

**Relationships:** Person 1—1; 1—* TeacherEmployment; optional MarketplaceListing.

**Lifecycle:** created with first teaching intent → career fields enriched on first login → active.

**Owner Engine:** **E04**

**Dependencies:** Person.

**Future extensions:** Qualifications, experience years, public bio (public slice → E24).

---

### StudentProfile

**Purpose:** Lifelong student identity (`STD…`).

**Relationships:** Person 1—1; 1—* StudentAdmission; medical fields conceptually Health.

**Lifecycle:** created → admitted (via Admission) → alumni (admission status) → profile retained.

**Owner Engine:** **E04** shell; **E14** owns `blood_group` / `medical_notes`.

**Dependencies:** Person.

**Future extensions:** Special needs flags (Health), prior school history docs (Document).

---

### ParentProfile

**Purpose:** Lifelong parent/guardian identity (`PAR…`).

**Relationships:** Person 1—1; *—* StudentProfile via StudentParentLink.

**Lifecycle:** created with first link → reusable across children/schools.

**Owner Engine:** **E04**

**Dependencies:** Person.

**Future extensions:** Custody flags, emergency-only contacts.

---

### TeacherEmployment

**Purpose:** Job relationship between TeacherProfile and School (history-preserving).

**Relationships**
- TeacherProfile *—1 School
- 0—1 Department; * EmploymentSubject
- Referenced by Section.classTeacher, TimetableSlot, TeachingAssignment

**Lifecycle:** `invited` → `active` → `ended` (re-hire = new row). Unique **active** per (School, TeacherProfile).

**Owner Engine:** **E05**

**Dependencies:** E04, E01, E07 (subject validation), E03.

**Future extensions:** Contract type, FTE, salary band (HR), multi-school concurrent jobs.

---

### EmploymentSubject

**Purpose:** Subjects an employment is **eligible** to teach (capability), not the timetable grid.

**Relationships:** TeacherEmployment *—* Subject.

**Lifecycle:** replaced on staff save; no history required initially.

**Owner Engine:** **E05**

**Dependencies:** Subject (E07).

**Future extensions:** Proficiency level, primary subject flag.

---

### Department

**Purpose:** Staff organizational unit (e.g. Science); HOD points here.

**Relationships:** School 1—*; TeacherEmployment.department optional; HOD flag on employment.

**Lifecycle:** created as needed; rename; soft-archive.

**Owner Engine:** **E05**

**Dependencies:** School.

**Future extensions:** Nested departments, cost centers.

---

### StudentAdmission

**Purpose:** Student’s relationship to a School (admission number, status, optional House).

**Relationships:** StudentProfile *—1 School; 1—* StudentPlacement; optional House.

**Lifecycle:** `active` → `withdrawn` | `transferred` | `alumni`. Unique active per (School, StudentProfile). Admission number unique per School.

**Owner Engine:** **E06**

**Dependencies:** E04, E01, E07 (House).

**Future extensions:** Application pipeline, waitlist, TC request workflow.

---

### StudentPlacement

**Purpose:** Year-bound class/section placement for an Admission (`student_academic_years`). Append-only history.

**Relationships:** Admission *—1 AcademicYear; Class; Section; optional roll number.

**Lifecycle:** `active` → `completed` | `transferred` | `withdrawn`; promotion creates new row.

**Owner Engine:** **E06**

**Dependencies:** E08, E09.

**Future extensions:** Mid-year section change as new row; stream/elective sets.

---

### StudentParentLink

**Purpose:** Associates ParentProfile to StudentProfile (relationship, primary flag).

**Relationships:** StudentProfile *—* ParentProfile.

**Lifecycle:** create/update/unlink; primary guardian constraint (app-level).

**Owner Engine:** **E06**

**Dependencies:** E04.

**Future extensions:** Legal custody, pickup authorization.

---

### AcademicYear

**Purpose:** Named school year container (exactly one `is_active` per School typically).

**Relationships:** School 1—*; 1—* Term, Class, Period, Assessment, FeePlan (future).

**Lifecycle:** created → activated → closed (new year activated).

**Owner Engine:** **E08**

**Dependencies:** School; `academic_year_start_month` policy on School (E08 column).

**Future extensions:** Parallel boards/years; rollover automation.

---

### Term

**Purpose:** Subdivision of AcademicYear (semester/trimester) with month/day or dated bounds.

**Relationships:** AcademicYear 1—*; referenced by Assessment.

**Lifecycle:** created with year; adjust dates; locked when results published (future).

**Owner Engine:** **E08**

**Dependencies:** AcademicYear.

**Future extensions:** Assessment windows as calendar blocks.

---

### Holiday

**Purpose:** Non-instructional calendar day (distinct from CalendarEvent occasions).

**Relationships:** School or AcademicYear scoped.

**Lifecycle:** scheduled → observed → cancelled.

**Owner Engine:** **E08**

**Dependencies:** AcademicYear/School.

**Future extensions:** Regional calendars, half-days.

---

### Subject

**Purpose:** Teachable subject in school catalog (scholastic / co-scholastic).

**Relationships:** School 1—*; * ClassSubject; * EmploymentSubject; used by TimetableSlot, AssessmentResult.

**Lifecycle:** created → active → archived (keep FK history).

**Owner Engine:** **E07**

**Dependencies:** School.

**Future extensions:** Subject codes aligned to board; prerequisites.

---

### ClassSubject

**Purpose:** Which subjects are offered to a Class (elective flag).

**Relationships:** Class *—* Subject.

**Lifecycle:** maintained per year structure.

**Owner Engine:** **E07**

**Dependencies:** Class (E09), Subject.

**Future extensions:** Stream-specific offerings.

---

### GradingScale

**Purpose:** Definition of marks→grade mapping / competency rubrics.

**Relationships:** Referenced by Assessment / AssessmentResult.

**Lifecycle:** versioned; old results keep scale id.

**Owner Engine:** **E07**

**Dependencies:** School.

**Future extensions:** Per-subject scales; board-prescribed scales.

---

### Class

**Purpose:** Grade/level within an AcademicYear (e.g. Class 8) with capacity.

**Relationships:** AcademicYear 1—*; 1—* Section; * ClassSubject.

**Lifecycle:** created in year setup; capacity updated; closed with year.

**Owner Engine:** **E09**

**Dependencies:** AcademicYear.

**Future extensions:** Streams (Science/Commerce) as child structure.

---

### Section

**Purpose:** Subdivision of Class (e.g. 8-A) with capacity and optional class teacher (Employment id).

**Relationships:** Class 1—*; * StudentPlacement; * TimetableSlot; classTeacher → TeacherEmployment.

**Lifecycle:** created → staffing assigned → closed.

**Owner Engine:** **E09**

**Dependencies:** Class; TeacherEmployment (E05) for class teacher FK.

**Future extensions:** Room assignment, house-homeroom mapping.

---

### PromotionRule

**Purpose:** Defines how placements advance Class N → N+1 between years.

**Relationships:** School/year scoped; produces StudentPlacement commands into E06.

**Lifecycle:** draft → active → retired.

**Owner Engine:** **E09** (rules). **E06** owns resulting placements.

**Dependencies:** Structure topology; Enrollment write API.

**Future extensions:** Conditional promotion on Assessment results.

---

### House

**Purpose:** Cross-cutting student house for sports/spirit (school catalog).

**Relationships:** School 1—*; optional on StudentAdmission; future HouseMembership.

**Lifecycle:** created when houses enabled; archive.

**Owner Engine:** **E07**

**Dependencies:** School feature flags.

**Future extensions:** Points competitions (→ Competition).

---

### Club

**Purpose:** Co-curricular club catalog entry.

**Relationships:** School 1—*; future ClubMembership.

**Lifecycle:** create/enable/archive.

**Owner Engine:** **E07**

**Dependencies:** School.

**Future extensions:** Advisors (Employment), meeting schedules (CalendarEvent).

---

### HouseMembership

**Purpose:** Explicit Person/Student ↔ House membership over time (today approximated by `admission.house_id`).

**Relationships:** StudentAdmission or StudentProfile *— House; dated.

**Lifecycle:** join → transfer → leave.

**Owner Engine:** Prefer **E06** (enrollment-adjacent) or **E07** if purely club-like — **recommend E06** for student house; keep House catalog in E07.

**Dependencies:** House, Admission/Profile.

**Future extensions:** Staff house affiliations.

---

### ClubMembership

**Purpose:** Student/staff membership in a Club.

**Relationships:** Club *—* StudentProfile or Employment.

**Lifecycle:** join → leave.

**Owner Engine:** **E07** (or E06 if treated as enrollment enrichment — prefer **E07** with Enrollment read).

**Dependencies:** Club, Identity/Enrollment.

**Future extensions:** Attendance at club sessions.

---

### Period

**Purpose:** Bell period definition within AcademicYear (number, start/end time).

**Relationships:** AcademicYear 1—*; 1—* TimetableSlot.

**Lifecycle:** defined in timetable setup; renumber carefully.

**Owner Engine:** **E10**

**Dependencies:** AcademicYear.

**Future extensions:** Day-type variants (Mon vs Sat schedule).

---

### TimetableSlot

**Purpose:** One scheduled cell: Section + weekday + Period + Subject + TeacherEmployment.

**Relationships:** Section, Period, Subject, TeacherEmployment.

**Lifecycle:** draft grid → published → superseded (versioned grids future).

**Owner Engine:** **E10**

**Dependencies:** E09, E08, E07, E05.

**Future extensions:** Room, substitution overlay, conflict resolution.

---

### TeachingAssignment

**Purpose:** Planned teacher–subject–section mapping (may overlap slots; eligibility ≠ this).

**Relationships:** TeacherEmployment, Subject, Section/Class.

**Lifecycle:** maintained with timetable planning.

**Owner Engine:** **E10**

**Dependencies:** E05 eligibility should be validated against EmploymentSubject.

**Future extensions:** Merge into slots-only model if redundant.

---

### Assessment

**Purpose:** Exam/test definition for a year (name, category, term, weightage, max marks, grading type).

**Relationships:** AcademicYear; optional Term; 1—* AssessmentSchedule; 1—* AssessmentResult.

**Lifecycle:** draft → scheduled → open → closed → published.

**Owner Engine:** **E11**

**Dependencies:** E08, E07 (grading scale optional).

**Future extensions:** Continuous evaluation components; moderation.

---

### AssessmentSchedule

**Purpose:** Per-subject sit date/time for an Assessment.

**Relationships:** Assessment 1—*; Subject.

**Lifecycle:** planned → completed.

**Owner Engine:** **E11**

**Dependencies:** Subject, Assessment.

**Future extensions:** Room allocation, invigilators (Employment).

---

### AssessmentResult

**Purpose:** Append-only marks/grades for a StudentPlacement × Assessment × Subject.

**Relationships:** StudentPlacement, Assessment, Subject; optional GradingScale.

**Lifecycle:** entered → locked → published (never overwrite; corrections = new version row).

**Owner Engine:** **E11**

**Dependencies:** E06, E07.

**Future extensions:** Remarking workflow, grade appeals.

---

### AttendanceRecord

**Purpose:** Presence fact for a student (and optionally staff) on a date / period.

**Relationships:** StudentPlacement (or Admission); optional TimetableSlot; Calendar date.

**Lifecycle:** marked → corrected (append correction event / new row).

**Owner Engine:** **E12**

**Dependencies:** E06, E09, E08, optional E10.

**Future extensions:** Biometric source, staff attendance.

---

### ConductIncident

**Purpose:** Behaviour/discipline event with severity and actions.

**Relationships:** StudentProfile + StudentPlacement; recorder Employment/Admin.

**Lifecycle:** reported → under_review → closed → appealed.

**Owner Engine:** **E13**

**Dependencies:** E04, E06, E03.

**Future extensions:** Positive merits, counseling cases.

---

### HealthIncident

**Purpose:** Clinical/health event or update beyond static blood group/notes.

**Relationships:** StudentProfile; optional MediaAsset (prescriptions).

**Lifecycle:** recorded → resolved.

**Owner Engine:** **E14**

**Dependencies:** E04; consent via E18.

**Future extensions:** Immunization schedule, chronic condition plans.

---

### LessonPlan

**Purpose:** Teacher’s plan for lessons (objectives, resources) tied to Subject/Section/time.

**Relationships:** TeacherEmployment, Subject, Section, optional Period/date; AcademicYear.

**Lifecycle:** draft → shared → completed → archived.

**Owner Engine:** **E10** (scheduling/teaching delivery context). Assessment rubrics remain E11.

**Dependencies:** E05, E07, E09, E08.

**Future extensions:** Curriculum standards mapping, AI-assisted drafts (E23 suggestions).

---

### FeeHead

**Purpose:** Atomic charge type (Tuition, Transport, Lab).

**Relationships:** School 1—*; used by FeePlan lines.

**Lifecycle:** active → archived.

**Owner Engine:** **E15**

**Dependencies:** School.

**Future extensions:** Tax codes, GL mapping.

---

### FeePlan

**Purpose:** Package of FeeHeads for a Class/Year (amounts, due rules).

**Relationships:** AcademicYear, Class (optional Section); * Invoice generation.

**Lifecycle:** draft → published → closed.

**Owner Engine:** **E15**

**Dependencies:** E08, E09.

**Future extensions:** Sibling discounts, scholarships as plan modifiers.

---

### Invoice

**Purpose:** Amount owed by a payer for an Admission/Placement period.

**Relationships:** StudentAdmission or Placement; FeePlan/lines; * LedgerEntry; * Payment.

**Lifecycle:** draft → issued → partially_paid → paid → void → overdue.

**Owner Engine:** **E15**

**Dependencies:** E06, E04 (payer Person).

**Future extensions:** Installments, line-level concessions.

---

### LedgerEntry

**Purpose:** Append-only accounting movement on a student fee account (debit invoice, credit payment, credit concession).

**Relationships:** Invoice and/or Payment reference; Admission account.

**Lifecycle:** posted (immutable); reversal = compensating entry.

**Owner Engine:** **E15**

**Dependencies:** Invoice; Payment events from E16.

**Future extensions:** Multi-currency, school chart of accounts.

---

### Payment

**Purpose:** Provider-facing money movement attempting to settle Invoice(s).

**Relationships:** Invoice *; payer Person/AuthUser; provider refs.

**Lifecycle:** created → pending → succeeded | failed → refunded.

**Owner Engine:** **E16**

**Dependencies:** E15 (invoice ids); E02 (payer session); emits events for E15 ledger.

**Future extensions:** UPI autopay, payout to school merchant accounts.

---

### CalendarEvent

**Purpose:** First-class school occasion (PTM, annual day) — not a Holiday and not a TimetableSlot.

**Relationships:** School; optional audience Class/Section; * Announcement; RSVPs future.

**Lifecycle:** draft → scheduled → published → completed | cancelled.

**Owner Engine:** **E17**

**Dependencies:** E08 (conflict awareness), E09/E06 (audience).

**Future extensions:** Ticketing via Fee/Payments.

---

### Competition

**Purpose:** Contests (inter-house, olympiad) with participants and results.

**Relationships:** School; optional House; participants StudentProfile/Placement; may link CalendarEvent.

**Lifecycle:** announced → registration → in_progress → results_published → archived.

**Owner Engine:** **E17** (occasion-like). House points may update derived scores (Analytics).

**Dependencies:** E07 House/Club, E06 participants, E18 announcements.

**Future extensions:** External competition imports, certificates (Document).

---

### Announcement

**Purpose:** Human-readable broadcast content to an audience (in-app / channels).

**Relationships:** Author admin/teacher; audience rules; optional CalendarEvent/Invoice trigger; spawns Notification.

**Lifecycle:** draft → published → expired → retracted.

**Owner Engine:** **E18**

**Dependencies:** E04 recipients via E06/E05; E19 delivery.

**Future extensions:** Threaded comments, acknowledgements.

---

### MessageTemplate

**Purpose:** Reusable copy with placeholders for fee reminders, attendance alerts, etc.

**Relationships:** School or platform library; used by Announcement/Notification composition.

**Lifecycle:** draft → active → retired (versioned).

**Owner Engine:** **E18**

**Dependencies:** None.

**Future extensions:** Locale variants, channel-specific bodies.

---

### CommunicationConsent

**Purpose:** Opt-in/out per Person/channel (WhatsApp, SMS, email).

**Relationships:** Person; channel enum.

**Lifecycle:** opted_in ↔ opted_out; audit trail.

**Owner Engine:** **E18**

**Dependencies:** Person.

**Future extensions:** Per-child consent for parents; legal basis records.

---

### Notification

**Purpose:** Delivery job attempt(s) for a message on a channel.

**Relationships:** References Announcement/message id; recipient address; provider ids.

**Lifecycle:** queued → sending → delivered | bounced | failed (retries).

**Owner Engine:** **E19**

**Dependencies:** E18 content; E04 addresses; consent check.

**Future extensions:** Push, quiet hours, provider failover — see [`notification-engine.md`](notification-engine.md).

---

### DocumentTemplate

**Purpose:** Layout for official artifacts (TC, ID card, fee receipt).

**Relationships:** School; engine data bindings (Enrollment, Assessment, Fee).

**Lifecycle:** draft → published → retired (version pin on issue).

**Owner Engine:** **E20**

**Dependencies:** Media fonts/images (E27).

**Future extensions:** DigiLocker schemas.

---

### IssuedDocument

**Purpose:** Immutable issued artifact metadata + storage pointer (verification code).

**Relationships:** Template version; subject Person/Admission; MediaAsset/PDF.

**Lifecycle:** issued → superseded | revoked (revocation record; keep bytes).

**Owner Engine:** **E20**

**Dependencies:** Domain engines for snapshot data; E27 storage.

**Future extensions:** QR verify portal, blockchain hash optional.

---

### ReportCard

**Purpose:** Published academic report for a Placement × Term/Year — specialization of IssuedDocument plus structured result snapshot.

**Relationships:** StudentPlacement; Term/AcademicYear; AssessmentResults; IssuedDocument.

**Lifecycle:** generating → issued → reissued (new version).

**Owner Engine:** **E20** (artifact). Source marks remain **E11**.

**Dependencies:** E11, E06, E04, E08.

**Future extensions:** Progressive report cards, parent portal views without PDF.

---

### MediaAsset

**Purpose:** Stored binary (logo, photo, PDF) with ACL path.

**Relationships:** Referenced by School logo path, Person photo, IssuedDocument.

**Lifecycle:** uploaded → active → deleted (GC).

**Owner Engine:** **E27**

**Dependencies:** E01 path prefix; E03 ACL.

**Future extensions:** Image transforms, virus scan, CDN.

---

### ImportJob

**Purpose:** Bulk CSV/API import with blocking validation and staging.

**Relationships:** School; produces domain entities via E04/E05/E06 APIs.

**Lifecycle:** uploaded → validating → failed | committed.

**Owner Engine:** **E26**

**Dependencies:** Domain engines for commit; E03.

**Future extensions:** Async 50k-row year-start; SFTP.

---

### AuditEntry

**Purpose:** Append-only who/what/when for mutating actions.

**Relationships:** Actor AuthUser/Person; entity refs.

**Lifecycle:** written once; never edited.

**Owner Engine:** **E28**

**Dependencies:** E02 actor id.

**Future extensions:** SIEM export, legal hold — see [`audit-log.md`](audit-log.md).

---

### MarketplaceListing

**Purpose:** Public projection of a TeacherProfile for discovery (no student data).

**Relationships:** TeacherProfile; optional verifications.

**Lifecycle:** draft → published → suspended.

**Owner Engine:** **E24**

**Dependencies:** E04, E05 (opt-in history).

**Future extensions:** Reviews, paid placement, hire → Employment invite.

---

### AISuggestion

**Purpose:** Model-proposed change awaiting human acceptance (never silent OLTP write).

**Relationships:** Target entity refs; prompt log; acceptor AuthUser.

**Lifecycle:** proposed → accepted | rejected → expired.

**Owner Engine:** **E23**

**Dependencies:** E22 features; E03 ACL; acceptance commands go to owning engines.

**Future extensions:** Tool-calling agents with strict allowlists — see [`ai-architecture.md`](ai-architecture.md).

---

## 4. Mermaid ER diagram

> Logical ER — not SQL. Cardinalities are indicative. PLANNED entities included for target architecture.

```mermaid
erDiagram
  SCHOOL ||--o{ SCHOOL_ADMIN_MEMBERSHIP : has
  AUTH_USER ||--o| SCHOOL_ADMIN_MEMBERSHIP : "admin of"
  AUTH_USER ||--o| PERSON : "bound as"

  PERSON ||--o| TEACHER_PROFILE : "may be"
  PERSON ||--o| STUDENT_PROFILE : "may be"
  PERSON ||--o| PARENT_PROFILE : "may be"
  PERSON ||--o{ PERSON_ROLE : has
  PERSON ||--o| MEDIA_ASSET : photo

  SCHOOL ||--o{ DEPARTMENT : has
  SCHOOL ||--o{ SUBJECT : catalogs
  SCHOOL ||--o{ HOUSE : catalogs
  SCHOOL ||--o{ CLUB : catalogs
  SCHOOL ||--o{ ACADEMIC_YEAR : runs
  SCHOOL ||--o{ TEACHER_EMPLOYMENT : employs
  SCHOOL ||--o{ STUDENT_ADMISSION : admits
  SCHOOL ||--o{ FEE_HEAD : defines
  SCHOOL ||--o{ CALENDAR_EVENT : hosts
  SCHOOL ||--o{ COMPETITION : hosts
  SCHOOL ||--o{ ANNOUNCEMENT : publishes

  TEACHER_PROFILE ||--o{ TEACHER_EMPLOYMENT : "works as"
  TEACHER_EMPLOYMENT }o--o| DEPARTMENT : "belongs to"
  TEACHER_EMPLOYMENT ||--o{ EMPLOYMENT_SUBJECT : eligible
  EMPLOYMENT_SUBJECT }o--|| SUBJECT : "for"

  STUDENT_PROFILE ||--o{ STUDENT_ADMISSION : "admitted via"
  STUDENT_ADMISSION }o--o| HOUSE : "optional"
  STUDENT_ADMISSION ||--o{ STUDENT_PLACEMENT : places
  STUDENT_PROFILE ||--o{ STUDENT_PARENT_LINK : "linked"
  PARENT_PROFILE ||--o{ STUDENT_PARENT_LINK : "guardian of"
  STUDENT_PROFILE ||--o{ HEALTH_INCIDENT : "health"
  STUDENT_PROFILE ||--o{ CONDUCT_INCIDENT : "conduct"

  ACADEMIC_YEAR ||--o{ TERM : contains
  ACADEMIC_YEAR ||--o{ CLASS : structures
  ACADEMIC_YEAR ||--o{ PERIOD : bells
  ACADEMIC_YEAR ||--o{ ASSESSMENT : assesses
  ACADEMIC_YEAR ||--o{ HOLIDAY : observes
  ACADEMIC_YEAR ||--o{ FEE_PLAN : prices

  CLASS ||--o{ SECTION : splits
  CLASS ||--o{ CLASS_SUBJECT : offers
  CLASS_SUBJECT }o--|| SUBJECT : "offers"
  SECTION }o--o| TEACHER_EMPLOYMENT : "class teacher"
  STUDENT_PLACEMENT }o--|| CLASS : "in"
  STUDENT_PLACEMENT }o--|| SECTION : "in"
  STUDENT_PLACEMENT }o--|| ACADEMIC_YEAR : "for"
  STUDENT_PLACEMENT }o--|| STUDENT_ADMISSION : "under"

  PERIOD ||--o{ TIMETABLE_SLOT : "used in"
  SECTION ||--o{ TIMETABLE_SLOT : "scheduled"
  TIMETABLE_SLOT }o--|| SUBJECT : teaches
  TIMETABLE_SLOT }o--|| TEACHER_EMPLOYMENT : "taught by"
  TEACHER_EMPLOYMENT ||--o{ TEACHING_ASSIGNMENT : plans
  TEACHING_ASSIGNMENT }o--|| SUBJECT : "maps"
  TEACHER_EMPLOYMENT ||--o{ LESSON_PLAN : authors
  LESSON_PLAN }o--|| SUBJECT : covers
  LESSON_PLAN }o--|| SECTION : "for"

  ASSESSMENT }o--o| TERM : "optional"
  ASSESSMENT ||--o{ ASSESSMENT_SCHEDULE : schedules
  ASSESSMENT_SCHEDULE }o--|| SUBJECT : "for"
  ASSESSMENT ||--o{ ASSESSMENT_RESULT : scores
  ASSESSMENT_RESULT }o--|| STUDENT_PLACEMENT : "of"
  ASSESSMENT_RESULT }o--|| SUBJECT : "in"
  ASSESSMENT_RESULT }o--o| GRADING_SCALE : "uses"

  STUDENT_PLACEMENT ||--o{ ATTENDANCE_RECORD : "attendance"
  ATTENDANCE_RECORD }o--o| TIMETABLE_SLOT : "optional period"

  FEE_PLAN ||--o{ INVOICE : generates
  FEE_HEAD ||--o{ FEE_PLAN : "lined in"
  INVOICE }o--|| STUDENT_ADMISSION : "bills"
  INVOICE ||--o{ LEDGER_ENTRY : posts
  PAYMENT ||--o{ LEDGER_ENTRY : "credits via event"
  PAYMENT }o--|| INVOICE : settles

  CALENDAR_EVENT ||--o{ ANNOUNCEMENT : "may trigger"
  COMPETITION }o--o| CALENDAR_EVENT : "may use"
  COMPETITION }o--o| HOUSE : "inter-house"
  ANNOUNCEMENT ||--o{ NOTIFICATION : delivers
  MESSAGE_TEMPLATE ||--o{ ANNOUNCEMENT : "renders"
  PERSON ||--o{ COMMUNICATION_CONSENT : consents

  DOCUMENT_TEMPLATE ||--o{ ISSUED_DOCUMENT : issues
  ISSUED_DOCUMENT }o--|| PERSON : "about"
  REPORT_CARD ||--|| ISSUED_DOCUMENT : "is a"
  REPORT_CARD }o--|| STUDENT_PLACEMENT : "for"
  ISSUED_DOCUMENT }o--o| MEDIA_ASSET : file

  TEACHER_PROFILE ||--o| MARKETPLACE_LISTING : "may publish"
  IMPORT_JOB }o--|| SCHOOL : "runs for"
  AUDIT_ENTRY }o--|| AUTH_USER : actor
  AI_SUGGESTION }o--o| PERSON : "about optional"
```

### 4.1 Compact core-only view (shipped spine)

```mermaid
erDiagram
  SCHOOL ||--o{ ACADEMIC_YEAR : has
  SCHOOL ||--o{ SUBJECT : has
  SCHOOL ||--o{ DEPARTMENT : has
  SCHOOL ||--o{ HOUSE : has
  SCHOOL ||--o{ CLUB : has
  PERSON ||--o| TEACHER_PROFILE : is
  PERSON ||--o| STUDENT_PROFILE : is
  PERSON ||--o| PARENT_PROFILE : is
  TEACHER_PROFILE ||--o{ TEACHER_EMPLOYMENT : employed
  TEACHER_EMPLOYMENT }o--|| SCHOOL : at
  STUDENT_PROFILE ||--o{ STUDENT_ADMISSION : admitted
  STUDENT_ADMISSION }o--|| SCHOOL : at
  STUDENT_ADMISSION ||--o{ STUDENT_PLACEMENT : places
  ACADEMIC_YEAR ||--o{ CLASS : has
  CLASS ||--o{ SECTION : has
  STUDENT_PLACEMENT }o--|| SECTION : in
  ACADEMIC_YEAR ||--o{ PERIOD : has
  SECTION ||--o{ TIMETABLE_SLOT : has
  ACADEMIC_YEAR ||--o{ ASSESSMENT : has
  PARENT_PROFILE ||--o{ STUDENT_PARENT_LINK : links
  STUDENT_PROFILE ||--o{ STUDENT_PARENT_LINK : links
```

---

## 5. Cross-cutting invariants

1. **Identity is global; membership is school-scoped** (Person vs Employment/Admission).  
2. **Append-only life events:** Employment history, Placement history, AssessmentResult, LedgerEntry, AuditEntry, IssuedDocument. Full mutation rules: [`versioning.md`](versioning.md).
3. **Timetable references Employment ids**, never TeacherProfile ids alone.  
4. **Fees reference Admission/Placement + Person**, never denormalized student names.  
5. **Holiday ≠ CalendarEvent ≠ TimetableSlot.**  
6. **Announcement (content) ≠ Notification (delivery).**  
7. **ReportCard artifact ≠ AssessmentResult facts.**  
8. **AISuggestion never silently mutates domain entities.**

---

## 6. Document maintenance

| Change | Update |
|--------|--------|
| New domain noun | Add entity section + ER + catalog row |
| Owner engine change | Align with business-engines §10 first |
| Entity shipped | Flip maturity; note MASTER chronology |

---

*End of domain model. Companion docs: MASTER.md, business-engines.md, system-events.md, rbac.md, versioning.md, audit-log.md, notification-engine.md, ai-architecture.md.*
