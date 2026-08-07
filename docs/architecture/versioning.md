# FeezypayERP — Versioning & Editing Architecture

> **Phase:** 0.5 — Architecture (design-only)  
> **Created:** 2026-08-06  
> **Status:** Canonical mutation rules — **framework shipped** (`lib/editing/`, `audit_entries`, `config_change_history`); remaining modules adopting gates incrementally  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md) · [`system-events.md`](system-events.md) · [`rbac.md`](rbac.md) · [`audit-log.md`](audit-log.md) · [`configuration-editing-framework.md`](configuration-editing-framework.md)  
> **Rule:** Configuration must stay editable **without corrupting historical operational data**.

---

## 1. Problem

Schools constantly rename classes, swap teachers, tweak grading, and redesign report cards. If operational rows (marks, attendance, invoices, issued PDFs) store only a live FK to a mutable config row, **yesterday’s report silently becomes wrong**.

This document defines:

1. How each major entity may be edited, deleted, or archived  
2. Whether edits create history  
3. Whether edits affect **past**, **future**, or **neither** (identity-preserving rename)  
4. Dangerous scenarios and hard guards  

Aligned with business-engines **P3** (append history for life events) and domain-model invariants.

---

## 2. Core principles

### 2.1 Two kinds of data

| Kind | Examples | Mutation rule |
|------|----------|---------------|
| **Configuration** | Subject catalog, department names, grading scales, period bells, document templates, fee heads | Must remain editable; prefer **version / archive / effective-date**, not silent rewrite of history |
| **Operational fact** | AssessmentResult, AttendanceRecord, LedgerEntry, Payment, IssuedDocument, AuditEntry, Placement row | Prefer **append-only** or **compensating** writes; never rewrite meaning after lock/publish |

### 2.2 Three effects of an edit

| Effect | Meaning | When allowed |
|--------|---------|--------------|
| **Identity-preserving** | Same `id`; display fields change; historical FKs still correct *as ids*; labels on old UIs may update unless snapshotted | Cosmetic renames (Class “VIII” → “8”) when no semantic change |
| **Forward-only** | New version / new row becomes default for *new* work; old ops keep old version id | Grading scales, templates, fee plans, period grids |
| **Historical rewrite** | Past facts change meaning | **Forbidden** by default; only via explicit correction workflow + audit |

### 2.3 Snapshot vs live reference

Operational records that must reprint identically later must either:

1. **Pin a version id** (`grading_scale_version_id`, `template_version_id`), or  
2. **Snapshot immutable fields** at issue time (marks, grade letter, student name as printed, template hash)

Live “always join current Subject.name” is OK for **admin lists**, not for **issued report cards / ledgers**.

### 2.4 Academic year as natural version boundary

Many configs are **year-scoped** (Class, Section, Period, Timetable, Assessment definitions, FeePlan). Prefer:

- New AcademicYear → new structure rows (or cloned year pack)  
- Closed year → **Lock** (RBAC); config edits on closed years denied or require unlock + audit  

School-global catalogs (Subject, Department, House) span years → **archive + version**, do not delete if referenced.

### 2.5 Delete policy (default)

| Prefer | Over |
|--------|------|
| **Archive** (`archived_at` / `status=archived`) | Hard `DELETE` |
| **End** employment / **withdraw** admission | Wipe person |
| **Supersede** version | Mutate published version in place |
| **Void + compensating ledger** | Delete payment/ledger |

Hard delete only if: never referenced, or still in draft, or Super Admin purge with audit (rare).

### 2.6 Edit strategies (taxonomy)

| Code | Strategy | History? | Past ops? | Future ops? |
|------|----------|----------|-----------|-------------|
| **M** | Mutable in place (cosmetic / unlocked draft) | Optional audit | Labels may change; meaning must not | Yes |
| **R** | Soft rename (same id, display only) | Audit recommended | Display may change unless snapshotted | Yes |
| **V** | Versioned config (new immutable version row) | Yes (versions) | Keep old version id | Use latest / effective |
| **E** | Effective-dated (`valid_from` / `valid_to`) | Yes | Unaffected before cutover | New window |
| **A** | Append-only operational | Yes (new rows) | Never rewrite | N/A |
| **C** | Compensating correction | Yes | Logical fix without erase | N/A |
| **X** | Immutable after publish/lock | N/A | N/A | Requires unlock or new version |
| **K** | Archive-only retirement | Soft | Retained for FK | Hidden from pickers |

Entities may combine strategies (e.g. Assessment definition: **M** while draft → **X** after publish → corrections via **V**/**C**).

---

## 3. Decision matrix — major entities

Legend for columns:

| Column | Question |
|--------|----------|
| **Edit?** | May fields change after create? |
| **Delete?** | Hard delete allowed? |
| **Archive?** | Soft-retire preferred? |
| **Hist?** | Should edits create history / versions? |
| **→Past?** | Do edits change historical operational meaning? |
| **→Future?** | Do edits affect only future operations? |
| **Strat** | Primary strategy code(s) |

Answers: **Y** / **N** / **Cond** (conditional) / **Pin** (past pinned via version/snapshot).

### 3.1 Tenancy & access

| Entity | Edit? | Delete? | Archive? | Hist? | →Past? | →Future? | Strat | Notes |
|--------|-------|---------|----------|-------|--------|----------|-------|-------|
| School | Y | N | Y (suspend) | Y audit | N* | Y | M/K | *Name/logo change may affect reprints unless docs snapshot |
| SchoolAdminMembership | Cond | Cond | Y revoke | Y | N | Y | A/K | Transfer = end + new |
| AuthUser | Y self | N† | Y disable | Platform | N | Y | M/K | †Supabase-owned |
| Permission / RolePermission | Y | Cond | Y | Y | N | Y | V | Changing grants is forward; audit required |

### 3.2 Identity & people links

| Entity | Edit? | Delete? | Archive? | Hist? | →Past? | →Future? | Strat | Notes |
|--------|-------|---------|----------|-------|--------|----------|-------|-------|
| Person | Y | N | Soft future | Audit | Cond‡ | Y | M | ‡Legal name on old docs: snapshot at issue |
| PersonRole | Cond | Cond | — | Y | N | Y | A | Grant/revoke rows |
| TeacherProfile | Y | N | Soft | Audit | N | Y | M | Career fields |
| StudentProfile | Y | N | Soft | Audit | Cond‡ | Y | M | Medical cols → E14 rules |
| ParentProfile | Y | N | Soft | Audit | N | Y | M | |
| TeacherEmployment | Cond | N | Y end | **Y** | **N** | Y | **A**/K | Status/end_date; don’t rewrite past job |
| EmploymentSubject | Y | Y§ | — | Cond | N | Y | M/E | §Replace set; eligibility is forward |
| Department | Y | N | **Y** | Audit | **Pin** | Y | **R**/K | Rename OK; never delete if employments |
| StudentAdmission | Cond | N | Withdraw | **Y** | **N** | Y | **A**/K | New admission on transfer |
| StudentPlacement | Cond | N | Complete | **Y** | **N** | Y | **A** | Year rows append-only |
| StudentParentLink | Y | Soft | Y | Audit | N | Y | M/K | |

### 3.3 Academic setup (configuration-heavy)

| Entity | Edit? | Delete? | Archive? | Hist? | →Past? | →Future? | Strat | Notes |
|--------|-------|---------|----------|-------|--------|----------|-------|-------|
| AcademicYear | Cond | N | Close | Y | **N** | Lock | X/K | Closed → no structural mutate |
| Term | Cond | Cond | Y | Audit | Pin | Y | M/X | Locked with year |
| Holiday | Y | Y if unused | Y | Audit | N | Y | M | |
| Subject | Y | N | **Y** | Audit | **Pin** | Y | **R**/K | Rename; archive if retiring |
| ClassSubject | Y | Y§ | — | Cond | N | Y | M | Year-scoped offer list |
| GradingScale | Cond | N | Y | **Y** | **Pin** | **Y** | **V** | New version; results keep old id |
| Class | Y | N | With year | Audit | **Pin** | Y | **R**/X | Rename display; code stable |
| Section | Y | N | With year | Audit | **Pin** | Y | **R**/X | |
| PromotionRule | Y | Cond | Y | **Y** | N | **Y** | V/E | Apply at rollover time |
| House / Club | Y | N | **Y** | Audit | Pin | Y | R/K | |
| HouseMembership / ClubMembership | Cond | Soft | Y | Y | N | Y | A/K | Dated membership |
| Period | Cond | Cond | Y | **Y** | **Pin** | **Y** | **V**/X | Bell changes → new grid version |
| TimetableSlot | Cond | Cond | Supersede | **Y** | **Pin** | **Y** | V/X | Published grid immutable |
| TeachingAssignment | Cond | Soft | Y | Cond | N | Y | M/A | Prefer reassign forward |
| Curriculum (pack) | Cond | N | **Y** | **Y** | Pin | Y | **V**/K | Publish → version snapshot; clone draft |
| CurriculumVersion | N | N | — | **Y** | **Pin** | Y | **V** | Immutable after publish |
| CurriculumTopicProgress | Cond | Soft | — | Cond | N | Y | **A** | Pins curriculum_version_id |
| AssessmentFramework | Cond | N | **Y** | **Y** | Pin | Y | **V**/K | Publish → version snapshot; clone draft |
| AssessmentFrameworkVersion | N | N | — | **Y** | **Pin** | Y | **V** | Immutable after publish |
| AssessmentRecord | Cond | Soft | Y | Audit | N | Y | **M**/X | Edit until lock |
| AssessmentRecordMark | Cond | N | — | **Y** | via supersede | N/A | **A** | Never overwrite; is_current pointer |

### 3.4 Academic operations

| Entity | Edit? | Delete? | Archive? | Hist? | →Past? | →Future? | Strat | Notes |
|--------|-------|---------|----------|-------|--------|----------|-------|-------|
| Assessment (definition) | Cond | Draft only | Y | Cond | Pin | Y | M→X | After publish: new version or limited metadata |
| AssessmentSchedule | Cond | Cond | — | Cond | Pin | Y | M/X | |
| AssessmentResult | Cond | N | — | **Y** | via **C** | N/A | **A**/C | Never overwrite; correction row |
| AttendanceRecord | Cond | N | — | **Y** | via **C** | N/A | A/C | Same-day window then lock |
| ConductIncident | Cond | N | Y | Y | via C | N/A | A/C | |
| HealthIncident | Cond | N | Y | Y | via C | N/A | A/C | |
| LessonPlan | Y | Soft | Y | Cond | N | Y | M/K | |

### 3.5 Commercial

| Entity | Edit? | Delete? | Archive? | Hist? | →Past? | →Future? | Strat | Notes |
|--------|-------|---------|----------|-------|--------|----------|-------|-------|
| FeeHead | Y | N | **Y** | Audit | Pin | Y | R/K | |
| FeePlan | Cond | N | Y | **Y** | **Pin** | **Y** | **V**/E | Year/plan versions |
| Invoice | Cond | N void | Y | Y | via void | N/A | X/C | |
| LedgerEntry | N | N | — | **Y** | via **C** | N/A | **A**/C | Reversal entry |
| Payment | N | N | — | Y | refund **C** | N/A | A/C | Provider truth |

### 3.6 Engagement & output

| Entity | Edit? | Delete? | Archive? | Hist? | →Past? | →Future? | Strat | Notes |
|--------|-------|---------|----------|-------|--------|----------|-------|-------|
| CalendarEvent | Cond | Soft | Y | Cond | N | Y | M→X | After publish: limited |
| Competition | Cond | Soft | Y | Cond | N | Y | M/K | |
| Announcement | Cond | Soft | Y | Cond | N | Y | M→X | |
| MessageTemplate | Cond | N | Y | **Y** | **Pin** | **Y** | **V** | Sent messages pin version |
| NotificationDelivery | N | N | Y | A | N | N/A | A | Immutable send log |
| DocumentTemplate | Cond | N | Y | **Y** | **Pin** | **Y** | **V** | Report card templates |
| IssuedDocument / ReportCard | N | N | Y | Reissue **V** | **N** | N/A | X + snapshot | Reissue = new artifact |
| ReportJob | N | Soft | Y | A | N | N/A | A | |
| AnalyticsBatch | N | Soft | Y | A | N | N/A | A | |
| AISuggestion | Y status | Soft | Y | A | N | N/A | A | Accept ≠ mutate history |
| MarketplaceListing | Y | Soft | Y | Cond | N | Y | M/K | |
| OnboardingProgress | Y | N | Complete | Audit | N | Y | M | Wizard flags |
| IngestionJob | N | Soft | Y | A | N | N/A | A | |
| MediaAsset | Cond | Soft | Y | Cond | Pin if issued | Y | M/K | Don’t delete if doc-pinned |
| AuditEntry | N | N | Cold store | A | N | N/A | A | Immutable |

---

## 4. Configuration objects — editing playbook

### 4.1 Changing class names

| | |
|--|--|
| **Allowed** | Display name / label rename (**R**) while year open |
| **Not allowed** | Reusing class row to mean a different grade (Class 8 → Class 9) |
| **Past** | Placements/results keep `class_id`; reprints use snapshot or current label per product choice — **prefer snapshot on ReportCard** |
| **Future** | New name everywhere in open year |
| **Prevention** | Separate `code` (stable) from `name` (mutable); block “semantic” field changes if placements exist — force new Class |

### 4.2 Changing subjects

| | |
|--|--|
| **Allowed** | Rename (**R**); archive subject; change ClassSubject offers for open year |
| **Not allowed** | Delete subject with EmploymentSubject / TimetableSlot / AssessmentResult refs; merge two subjects by renaming one into the other without migration |
| **Past** | Results/slots keep `subject_id`; grade meaning unchanged |
| **Future** | Archived subjects hidden from pickers; new ClassSubject rows |
| **Prevention** | FK RESTRICT + archive; merge tool = explicit remap job with audit |

### 4.3 Changing grading systems

| | |
|--|--|
| **Allowed** | Create **GradingScale version N+1**; set as default for new assessments |
| **Not allowed** | Edit bands on a scale already referenced by published results |
| **Past** | Results pin `grading_scale_version_id` (+ snapshot letter/GPA) |
| **Future** | New assessments use latest version |
| **Prevention** | Versions immutable after first publish use; UI “Edit scale” clones |

### 4.4 Changing departments

| | |
|--|--|
| **Allowed** | Rename; archive; reassign HOD going forward |
| **Not allowed** | Delete department with employments; move historical employment.department_id silently for past years’ meaning without audit |
| **Past** | Employment history rows retain department_id at time of job (or snapshot name on HR letters) |
| **Future** | New employments / HOD flags use new dept |
| **Prevention** | End+rehire or dated department assignment (**E**) if transfers mid-year matter |

### 4.5 Changing teachers (assignments)

| | |
|--|--|
| **Allowed** | End employment (**A**); new employment; change class teacher; reassign TimetableSlot on **unpublished** or via new grid version |
| **Not allowed** | Overwrite `teacher_employment_id` on past Attendance/AssessmentResult; delete employment that slots reference |
| **Past** | Marks/attendance remain tied to employment id who recorded / who taught then |
| **Future** | New grid version / new assignments |
| **Prevention** | Timetable references **employment ids**; published grid **X**; staff change mid-term = supersede slots from effective date |

### 4.6 Changing report card templates

| | |
|--|--|
| **Allowed** | New **DocumentTemplate version**; draft edit; publish version |
| **Not allowed** | Mutate template body already used by IssuedDocument |
| **Past** | Issued docs store `template_version_id` + PDF/media + field snapshot |
| **Future** | Generate with latest published version |
| **Prevention** | Issue pins version; “Edit template” clones; reissue = new document event |

### 4.7 Changing timetable periods

| | |
|--|--|
| **Allowed** | Edit draft Periods; publish new **timetable grid version**; archive old |
| **Not allowed** | Change start/end of Period rows already used by published slots / historical attendance-by-period |
| **Past** | Old grid version remains readable |
| **Future** | Active published version only |
| **Prevention** | Period belongs to grid version; attendance stores `period_id` from that version |

### 4.8 Additional high-risk configs

| Change | Strategy | Guard |
|--------|----------|-------|
| Fee heads / plans | V/E | Invoices pin plan/head version; don’t edit posted plan |
| Exam definition after publish | X or V | Metadata-only edit or clone assessment |
| Academic year dates after ops exist | X | Unlock + impact report |
| Board / school display name | R + snapshot on certificates | |
| Capacity on Class/Section | M with validation | Don’t silently drop enrolled students |

---

## 5. Dangerous edit scenarios — prevention catalog

| # | Scenario | Harm | Prevention |
|---|----------|------|------------|
| D1 | Rename Class 8 to Class 9 in place | Wrong grade on all placements/results | Stable `code`; block grade-level field if placements exist |
| D2 | Delete Subject still on results | Orphan / cascade wipe | Archive only; FK RESTRICT |
| D3 | Edit grading bands after results published | Historical grades lie | Immutable versions; pin on result |
| D4 | Reassign teacher on past attendance | Accountability broken | Append-only attendance; employment id frozen |
| D5 | Edit report template after issue | Legal/reprint mismatch | Pin template version + PDF |
| D6 | Change Period times mid-year in place | Slot/attendance ambiguity | Grid versioning |
| D7 | Mutate closed AcademicYear structure | Cross-year corruption | Year lock; RBAC unlock |
| D8 | Overwrite AssessmentResult | Audit/compliance failure | Correction rows only |
| D9 | Delete LedgerEntry / Payment | Financial fraud risk | Compensating entries; no delete |
| D10 | “Replace all staff” wipe employments | Loses teaching history | End employments; new rows (D10 identity) |
| D11 | Change department by rewriting employment | HR history wrong | Dated assignment or end/start |
| D12 | Merge students by editing admission numbers | Fee/marks mix-up | Explicit merge command + audit |
| D13 | AI accepts suggestion that rewrites history | Silent corruption | AI only proposes; accept uses versioning rules |
| D14 | CSV re-import destructive replace | Wipes append history | Upsert/end-and-add; never delete-all+insert for people links |
| D15 | Fee plan price change applies to paid invoices | Balance lies | Plan version; invoices pin amounts |

**Product UX pattern:** if an edit would affect past ops, UI offers:

1. **Rename only** (identity-preserving), or  
2. **Create new version / clone for future**, or  
3. **Blocked** with explanation + link to correction workflow  

Never a silent third option that rewrites history.

---

## 6. Lifecycle gates (interaction with RBAC & events)

```text
Draft ──edit freely (M)──▶ Published/Active ──▶ Locked/Closed
                              │                      │
                              │ corrections          │ unlock (audited)
                              ▼                      ▼
                         Version / Compensate     rare structural fix
```

| State | Config edit | Operational edit |
|-------|-------------|------------------|
| Draft | M | M |
| Published / Active | R or V (no semantic in-place) | A/C within windows |
| Locked / Closed year | — (or unlock) | — |
| Archived | — | read-only |

Emit catalogue events on structural changes (`structure.class.changed`, `config.catalog.updated`, `timetable.grid.published`, `calendar.academic_year.closed`, etc.) so consumers refresh caches **without** assuming past facts changed.

---

## 7. Implementation patterns (design — no schema yet)

### 7.1 Version table pattern

```text
grading_scales (id, school_id, code, status)
grading_scale_versions (id, scale_id, version, bands_json, published_at, immutable)
assessment_results.grading_scale_version_id → versions.id
```

Same for `document_templates` / `message_templates` / `fee_plans` / `timetable_grids`.

### 7.2 Snapshot-on-issue pattern

At `document.report_card.generated` / certificate issue:

- Persist PDF/media  
- Persist JSON snapshot: student name, class label, subject names, grades, template_version_id  

### 7.3 Effective-dated pattern

```text
valid_from, valid_to on fee_plan_versions, department_assignments, teaching_assignments
```

Queries for “as of date D” use the covering interval.

### 7.4 Compensating entry pattern

Ledger/Payment/Result: insert reversal + optional replacement; link via `causation_id` / `corrects_id`.

### 7.5 Stable code + mutable label

```text
subjects.code  -- immutable after first use
subjects.name  -- R allowed
```

### 7.6 Reference counts before archive

App checks: active placements, open invoices, published results → warn; allow archive if only historical refs remain.

---

## 8. Year rollover (versioning at scale)

When activating a new AcademicYear:

1. **Clone or recreate** year-scoped structure (classes, sections, periods) — new ids  
2. **Carry forward** school-global catalogs (subjects, departments) — same ids, optionally archive unused  
3. **Promote** students via new Placement rows (append)  
4. **Do not** mutate prior year’s Class/Section rows to “become” next year  
5. Close prior year → Lock  

Detailed playbook remains a follow-on design doc; this file constrains it: **rollover must not edit closed-year operational facts**.

---

## 9. Onboarding today vs target

| Today (partial) | Target |
|-----------------|--------|
| Staff/student saves may replace employment-subject sets | Keep replace for eligibility; never wipe employment history |
| Student upsert-by-admission-number | OK if identity-preserving; no delete-all admissions |
| Exam definitions mutable | Add publish → lock; results append-only when built |
| No grading/template versions | Introduce **V** before Fee/Report Card GA |
| Timetable single grid | Introduce published grid version before attendance-by-period |

---

## 10. Placement rule for features

Every feature that mutates config or ops must state:

1. Entity + owner engine  
2. Strategy code (**M/R/V/E/A/C/X/K**)  
3. Effect on **past** vs **future**  
4. Snapshot / version pin if issued artifacts exist  
5. Dangerous scenario ids (D#) mitigated  

Reject designs that “UPDATE the catalog row” when historical FKs would change meaning.

---

## 11. Relation to other docs

| Doc | Role |
|-----|------|
| `domain-model.md` | Entities & lifecycles |
| `business-engines.md` | P3 append history; ownership |
| `system-events.md` | Announce structural change without rewriting facts |
| `rbac.md` | Who may edit / lock / archive / unlock |
| `audit-log.md` | Every important mutation emits AuditEntry |
| `MASTER.md` §22 | Index |

---

## 12. Maintenance

| Change | Action |
|--------|--------|
| New config entity | Add matrix row + strategy |
| New dangerous scenario | Add D# + prevention |
| Shipping Fee/Docs/Attendance | Enforce V/A/C before GA |

---

*End of versioning & editing architecture.*
