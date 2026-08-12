# Parent Portal (F10)

**Status:** `SHIPPED` (Wave 6, 2026-08-13) — RO linked-child UI  
**Surface:** `/dashboard/parent/**`  
**Module:** `lib/parent-portal/` · reuses `lib/student-portal/context.ts` + student portal clients  

## Scope

- Parent persona AuthZ bundle (existing)
- Child picker from `linkedStudentProfileIds`
- Attendance, assessments, report cards, homework, announcements, behaviour (RO)
- Guardian email on student save → `createInviteAction(targetPersona: "parent")`

## Out of scope

- Write paths (fees pay may use `payment.create` later)
- Full messaging composer
