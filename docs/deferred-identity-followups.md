# Deferred work after Global Identity Architecture (Steps 0–8)

Do **not** start these until the identity model is live and onboarding smoke-tested.

## 1. Student bulk input UX
- Year-start CSV vs mid-year single admission flows
- Minimize required fields on first pass; progressive enrichment later
- Field guide for schools (what is personal vs school vs year-varying)

## 2. Academic results (append-only)
- `exam_results` / subject-level results linked to `student_academic_years` + `exam_definitions`
- Never overwrite prior year marks

## 3. Attendance
- Daily attendance tables; summaries derived, not duplicated

## 4. Behaviour & remarks
- Dated incident/remark records linked to student profile + academic year

## 5. Health records
- Belong on `student_profiles` / related health tables (lifelong), not school admissions

## 6. Teacher invite + first-login profile wizard
- Employment `status=invited` → auth user attach to `persons.auth_user_id`
- Gate app access until `persons.profile_completed_at` is set
- Populate `teacher_profiles` career fields on first login

## 7. Teacher marketplace / public profiles
- Public subset of `teacher_profiles` + verification

## 8. Transfers & certificates
- New `student_admissions` / `teacher_employments` rows; never overwrite history
- Transfer certificate generation from admission + academic year timeline
