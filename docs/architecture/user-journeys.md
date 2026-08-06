# FeezypayERP — User Journeys

> **Phase:** Post–0.5 product architecture (design)  
> **Created:** 2026-08-06  
> **Status:** Target journeys for all personas. **Today shipped:** School Admin onboarding + dashboard only. Other personas = `NOT BUILT` (schema-ready where noted).  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`rbac.md`](rbac.md) · [`business-engines.md`](business-engines.md) · [`notification-engine.md`](notification-engine.md) · [`ai-architecture.md`](ai-architecture.md) · [`system-events.md`](system-events.md) · [`domain-model.md`](domain-model.md)  
> **Rule:** Journeys describe *product intent* under RBAC scopes (● school / ◐ attribute-scoped / self / linked). Engines never owned by personas — personas *use* engines.

---

## 1. How to read this document

| Column / section | Meaning |
|------------------|---------|
| **Daily tasks** | Typical school-day / week activities (not exhaustive yearly ops) |
| **Engines** | E01–E28 IDs from business-engines |
| **Create** | Data the persona authors (writes) |
| **Consume** | Data they primarily read |
| **Approvals** | Where they **give** or **need** Approve / Publish / Lock |
| **Notifications** | Types from notification-engine (via E18→E19) |
| **AI** | Services from ai-architecture (propose/draft only; accept = human) |

**Admin** = School Admin (tenant office / SaaS owner for the school).  
Vice Principal is omitted here (similar to Principal with fewer lock/delete rights — see `rbac.md`).

---

## 2. Journey map (at a glance)

```text
                    ┌──────────── School Admin ────────────┐
                    │  Setup · people · fees · year close  │
                    └───────────┬──────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
         Principal            HOD             Teachers
         school ops        department       class delivery
              │                 │                 │
              └────────┬────────┴────────┬────────┘
                       ▼                 ▼
                    Parents           Students
                   linked child         self
```

---

## 3. School Admin

**Maturity:** Primary shipped persona today (onboarding wizard, dashboard). Portals for others not built.

### 3.1 Daily / weekly tasks

| Cadence | Tasks |
|---------|--------|
| **Setup (once / year)** | Complete onboarding; configure year, classes, subjects, houses; import staff/students; publish timetable; define exams; enable fee plans |
| **Daily** | Admit/transfer students; hire/end staff; respond to fee payment issues; publish announcements; review overdue fees & attendance thresholds; invite teachers |
| **Weekly** | Review delivery logs / failed imports; approve waivers; check audit of sensitive actions |
| **Term / year** | Activate/close academic year; promotion batch; archive catalogs; issue bulk documents |

### 3.2 Engines interacted with

| Heavy use | Supporting |
|-----------|------------|
| E01 Tenancy, E02 Access, E03 AuthZ, E04 Identity, E05 Workforce, E06 Enrollment, E07 Config, E08 Calendar, E09 Structure, E10 Timetable, E11 Assessment, E15 Fee, E16 Payments, E18 Comms, E19 Notify, E25 Onboarding, E26 Ingestion, E27 Media, E28 Audit | E12–E14, E17, E20–E23 (as features ship), E24 (optional) |

### 3.3 Data created

- School profile / onboarding completion  
- Academic years, terms, holidays  
- Classes, sections, subjects, houses, clubs  
- Staff employments + invites; student admissions + placements; parent links  
- Timetable grids; exam definitions  
- Fee heads/plans/invoices; announcements  
- Role grants / custom roles (future); CSV import jobs  
- Channel/quiet-hours settings  

### 3.4 Data consumed

- Full-school dashboards (attendance %, fee collection, enrollment headcount)  
- Delivery attempt logs; audit trail  
- Payment statuses; document issue status  
- Analytics narrations (future)  

### 3.5 Approvals

| They approve / publish / lock | They rarely need approval from |
|-------------------------------|--------------------------------|
| Fee waivers; invoice void; year close/unlock; timetable publish; exam/results publish (or delegate); announcements; promotion; role grants; AI accepts that mutate school-wide config | Platform Super Admin for tenant suspend |

### 3.6 Notifications received

| Type | Why |
|------|-----|
| `tenant.welcome` / onboarding complete | Setup |
| `workforce.teacher_joined` (optional) | Staffing |
| `attendance.threshold_breached` | Ops risk |
| `conduct.incident` | Policy |
| `fee.payment_failed` (ops view) | Collections |
| `system.security_alert` | Access anomalies |
| Ingestion commit/fail digests | Data quality |

### 3.7 AI tools

| Service | Use |
|---------|-----|
| `ai.analytics.narrate` | Dashboard NL summary |
| `ai.insight.fee_risk` / `attendance_risk` | Risk lists |
| `ai.suggest.timetable` / `placement` | Conflict / balance hints |
| `ai.draft.communication` | Announcement drafts |
| `ai.chat.assistant` | Policy / “how do I…” over school data |
| Future: fee recovery / rollover assistants | Propose only |

---

## 4. Principal

**Maturity:** Target (employment designation / grant). Not a separate login today.

### 4.1 Daily / weekly tasks

| Cadence | Tasks |
|---------|--------|
| **Daily** | Review school-wide academics & discipline; approve sensitive conduct; check fee waiver requests; message parents on school events |
| **Weekly** | Publish or approve exam calendars; review HOD department health; PTM / event oversight |
| **Term** | Results publish oversight; report-card readiness; promotion decisions |
| **Year** | Participate in year close / rollover sign-off (with Admin) |

### 4.2 Engines interacted with

| Heavy use | Supporting |
|-----------|------------|
| E05, E06, E08–E13, E15, E17, E18, E20, E21, E22, E23 | E01 (read), E03, E04, E07, E09, E10, E14 (need-to-know), E19 (receive), E28 (read) |

*Typically less:* E25 onboarding (Admin-owned), E16 provider ops, E26 bulk (unless delegated).

### 4.3 Data created

- Approvals on promotions, waivers, serious incidents  
- Announcements / event publish (school-wide)  
- Assessment publish/lock decisions  
- Optional timetable publish approval  
- AI-accepted academic/ops suggestions  

### 4.4 Data consumed

- School ● academics, attendance, conduct, fees (read + approve)  
- Staffing overview; enrollment counts  
- Report cards / certificates status  
- Analytics dashboards  

### 4.5 Approvals

| They approve | Escalate to Admin |
|--------------|-------------------|
| Promotion; fee waiver; assessment publish (policy); serious conduct; many AI school-wide accepts | Year unlock; SaaS/tenant; destructive deletes; role grant of school_admin |

### 4.6 Notifications received

| Type | Why |
|------|-----|
| `attendance.threshold_breached` | Escalation |
| `conduct.incident` | Oversight |
| `assessment.results_published` (confirmation) | Academic cycle |
| `engagement.event_*` | School occasions |
| `fee.invoice_overdue` digests (optional) | Collections awareness |
| `document.ready` (bulk) | Issuance |

### 4.7 AI tools

| Service | Use |
|---------|-----|
| Principal / Admin suite in `ai-architecture` §9.4 | Narrate school, risk lists, placement/timetable suggestions, announcement drafts |
| `ai.insight.academic` | Cohort performance |

---

## 5. HOD (Head of Department)

**Maturity:** Target (`is_hod` + `department_id` on employment). Staff onboarding captures HOD today as **data**, not portal.

### 5.1 Daily / weekly tasks

| Cadence | Tasks |
|---------|--------|
| **Daily** | Support department teachers; review subject coverage vs timetable |
| **Weekly** | Department assessment progress; moderate subject marks entry quality |
| **Term** | Align department exams; review lesson-plan coverage |
| **As needed** | Request staffing / subject eligibility changes (Admin/Pri execute) |

### 5.2 Engines interacted with

| Heavy use (◐ department) | Supporting |
|---------------------------|------------|
| E05 (dept staff), E07 (subjects), E10, E11, E12, E18, E23 | E06 (read students in dept classes), E08–E09 (read), E13, E21/E22 (◐), E19 |

*Usually not:* E15 Fee money ops, E16, E01 lifecycle, E25.

### 5.3 Data created

- Department-scoped assessment edits / publish (policy)  
- Timetable suggestions or dept grid edits where allowed  
- Conduct notes for dept students (policy)  
- Announcements to dept audience  
- Lesson-plan reviews / shares  

### 5.4 Data consumed

- Teachers & subjects in department  
- Timetable slots for dept subjects  
- Marks / attendance for dept classes  
- Department analytics  

### 5.5 Approvals

| They approve (◐) | Escalate |
|------------------|----------|
| Dept assessment publish (if granted); dept timetable edits; some incident severity | School-wide publish; fee; year close; hiring |

### 5.6 Notifications received

| Type | Why |
|------|-----|
| `assessment.exam_published` | Dept exams |
| `timetable` publish affecting dept | Scheduling |
| Teacher invite/join in dept (optional) | Staffing |
| Attendance digests for dept sections (optional) | Ops |

### 5.7 AI tools

| Service | Use |
|---------|-----|
| `ai.insight.academic` (dept scope) | Subject/cohort gaps |
| `ai.draft.lesson_plan` (review) | Support teachers |
| `ai.suggest.timetable` (dept) | Load balancing hints |
| `ai.chat.assistant` | Dept-scoped Q&A |

---

## 6. Teacher

**Maturity:** Target (employment + invite + first-login). Identity/employment **shipped** as data; portal `NOT BUILT`.

### 6.1 Daily / weekly tasks

| Cadence | Tasks |
|---------|--------|
| **Daily** | Mark attendance for assigned sections; teach per timetable; log conduct if needed; message class parents (draft→send) |
| **Weekly** | Enter / update marks for own subjects; share lesson plans; review absent alerts follow-up |
| **Term** | Complete assessment entry; draft report remarks; prepare PTM notes |
| **Ongoing** | Keep profile complete; manage own timetable view |

### 6.2 Engines interacted with

| Heavy use (◐ own sections/subjects) | Supporting |
|-------------------------------------|------------|
| E10 Timetable, E11 Assessment, E12 Attendance, E13 Conduct, E18 Comms, E04 Identity (self), E23 AI | E06 (class roster), E08 calendar, E09 structure (read), E14 (emergency flags only), E17 events, E19, E20 (remarks → cards), E27 (own media) |

*Not:* Fee approve/void, year close, role grants, school onboarding.

### 6.3 Data created

- Attendance records  
- Assessment results (own subjects)  
- Lesson plans; draft announcements / messages  
- Conduct incidents (scoped)  
- Report-card narrative drafts (accepted into E11/E20)  
- Self profile updates  

### 6.4 Data consumed

- Own timetable & teaching assignments  
- Class/section roster (placements)  
- Published calendar, exams, school announcements  
- Own students’ prior published results (policy)  

### 6.5 Approvals

| They approve | Need approval from |
|--------------|-------------------|
| Own lesson-plan share; own AI drafts before send | HOD/Pri/Admin for exam publish, results lock, school-wide announcements |

### 6.6 Notifications received

| Type | Why |
|------|-----|
| `attendance.marked_digest` | Class teacher summary |
| `assessment.exam_published` | Upcoming exams |
| `timetable.grid.published` (via type) | Schedule changes |
| `engagement.event_*` | School events |
| `communication.announcement` | School news |
| Invite / profile-complete reminders | Access |

### 6.7 AI tools

| Service | Use |
|---------|-----|
| `ai.draft.lesson_plan` | Planning |
| `ai.draft.report_narrative` | Remarks |
| `ai.draft.communication` | Parent messages |
| `ai.insight.attendance_risk` | Own sections |
| `ai.chat.assistant` | “What’s my next period?” / policy |

---

## 7. Parent / Guardian

**Maturity:** Target (parent profile + links shipped as data; portal `NOT BUILT`).

### 7.1 Daily / weekly tasks

| Cadence | Tasks |
|---------|--------|
| **Daily** | Check child attendance alerts; read school messages |
| **Weekly** | Review fees due; pay invoices; track homework/exams |
| **Term** | View published results & report cards; attend events / PTM RSVP (future) |
| **Ongoing** | Keep contact/consent preferences; update limited profile/health (policy) |

### 7.2 Engines interacted with

| Heavy use (linked children only) | Supporting |
|----------------------------------|------------|
| E06 Enrollment (read), E12 Attendance (read), E11 Assessment (published), E15 Fee, E16 Payments, E18/E19, E20 Documents, E04 self, E23 Parent AI | E08 calendar, E10 timetable (child), E17 events, E14 health (linked edit/read), E27 |

*Not:* Workforce, Structure edits, Timetable publish, Audit, Onboarding wizard.

### 7.3 Data created

- Payment intents (own invoices)  
- Consent / channel preferences  
- Limited profile & health updates (policy)  
- Draft questions to teacher (via E18)  
- Event RSVP (future)  

### 7.4 Data consumed

- Linked children’s placements, timetable, attendance, published results  
- Invoices, receipts, report cards  
- Announcements & event info for audience  
- Absence / overdue / results notifications  

### 7.5 Approvals

| They approve | Need approval from |
|--------------|-------------------|
| Own payment confirmation; consent opt-in/out | School for concessions/waivers; school for official docs |

### 7.6 Notifications received

| Type | Why |
|------|-----|
| `enrollment.student_admitted` / withdrawn | Lifecycle |
| `attendance.absent_alert` / `threshold_breached` | Presence |
| `assessment.exam_published` / `results_published` | Academics |
| `fee.invoice_*` / `payment_*` | Fees |
| `document.ready` | Report cards / certificates |
| `conduct.incident` (policy) | Behaviour |
| `engagement.event_*` / announcements | School life |

### 7.7 AI tools

| Service | Use |
|---------|-----|
| Parent AI chat | “Is fee due?”, “Was my child absent?” (linked only) |
| `ai.draft.communication` | Draft message to class teacher |
| Explain published grades (plain language) | Own child results only |

---

## 8. Student

**Maturity:** Target (admission/placement shipped as data; portal `NOT BUILT`). Age/consent rules apply (RBAC-4).

### 8.1 Daily / weekly tasks

| Cadence | Tasks |
|---------|--------|
| **Daily** | View timetable; check announcements; see attendance status |
| **Weekly** | Track upcoming exams; review homework/lesson materials (when shared) |
| **Term** | View published results; download report card when issued |
| **Ongoing** | Complete profile (age-appropriate); optional self-pay if payer |

### 8.2 Engines interacted with

| Heavy use (self) | Supporting |
|------------------|------------|
| E10 Timetable, E11 Assessment (published), E12 Attendance (self), E08 Calendar, E18/E19, E20 Documents, E04 self, E23 Student AI | E06 admission read, E15/E16 if self-payer, E17 events, E27 own media |

*Not:* Other students’ data; fee admin; staffing; structure; audit.

### 8.3 Data created

- Self profile fields (gated)  
- Own media (photo) where allowed  
- Payment intent if designated payer  
- AI study Q&A (no OLTP write)  

### 8.4 Data consumed

- Own timetable, calendar, published exams/results  
- Own attendance summary  
- Own documents / report cards  
- School announcements aimed at students  

### 8.5 Approvals

| They approve | Need approval from |
|--------------|-------------------|
| Own profile completion; own payments | Parent/school for most academic/official actions |

### 8.6 Notifications received

| Type | Why |
|------|-----|
| `assessment.exam_published` / `results_published` | Academics |
| `engagement.event_*` / announcements | School life |
| `document.ready` | Report card |
| `fee.*` | Only if self is payer |
| Timetable publish affecting them | Schedule |

### 8.7 AI tools

| Service | Use |
|---------|-----|
| Student AI chat | Timetable / exam dates / explain **own** published grades |
| Study tips from published materials | School library + self results |
| **Must not** | Peer data, sibling fees, staff PII |

---

## 9. Cross-persona workflows (examples)

### 9.1 Absence → parent alert

```text
Teacher marks absent (E12)
  → event attendance.record.marked
  → E18 composes attendance.absent_alert
  → E19 delivers to Parent (whatsapp/sms/push/in_app)
  → threshold? → Parents + Admin notified; optional Fee fine command (E15)
```

### 9.2 Results → report card

```text
Teacher enters marks (E11) → HOD/Pri/Admin publish results
  → Students/Parents notified
  → Teacher AI drafts remarks → teacher accept
  → E20 issues ReportCard (pinned template)
  → document.ready → Parent/Student
```

### 9.3 Fee due → pay

```text
Admin/system creates invoice (E15)
  → Parent notified (fee.invoice_created / overdue)
  → Parent pays (E16) → payment.succeeded
  → E15 ledger post → receipt (E20) → notify payer
```

### 9.4 Teacher invite

```text
Admin invites (E05) → access.invite (E19 email)
  → Teacher binds auth (E02/E04) → profile wizard
  → employment invited→active → workforce.teacher.joined
  → optional Admin notify
```

---

## 10. Maturity matrix

| Persona | Data in DB today | Login portal | Journey status |
|---------|------------------|--------------|----------------|
| School Admin | Yes | Yes | **Live** (subset: onboarding-heavy) |
| Principal | Via designation (future) | No | Target |
| HOD | `is_hod` on employment | No | Target (flag shipped) |
| Teacher | Employment + profile | No (invite blocked by F11) | Target |
| Parent | Links + profiles | No | Target |
| Student | Admission + placement | No | Target |

---

## 11. Placement rule

New UX features must name:

1. Persona(s)  
2. Daily-task category  
3. Engines touched  
4. Create vs consume  
5. Approval step (if any)  
6. Notification types  
7. AI service (if any)  

Align with `rbac.md`, `notification-engine.md`, and `ai-architecture.md`.

---

## 12. Maintenance

| Change | Action |
|--------|--------|
| New persona task | Update that persona section |
| New notify type | Add to receive lists |
| New AI service | Add to AI tools |
| Portal ships | Flip maturity matrix |

---

*End of user journeys. Companion: MASTER §27.*
