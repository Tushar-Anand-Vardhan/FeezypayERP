-- Cleanup unused stub / cutover entities (Wave post-cleanup).
-- App never wrote or read these; slots + employment_subjects remain SoT for teaching maps.
-- Keep rooms (timetable_slots.room_id FK) and club_event_links (E17 writers).

-- ---------------------------------------------------------------------------
-- 1. FUTURE stubs never wired
-- ---------------------------------------------------------------------------

drop table if exists public.house_point_ledger cascade;
drop table if exists public.subject_textbooks cascade;
drop table if exists public.timetable_substitutions cascade;
drop table if exists public.teacher_subject_assignments cascade;

-- ---------------------------------------------------------------------------
-- 2. Identity cutover maps (past the one-release retention window)
-- ---------------------------------------------------------------------------

drop table if exists public.student_id_map cascade;
drop table if exists public.teacher_id_map cascade;

-- ---------------------------------------------------------------------------
-- 3. Dead membership RPC (app uses list_auth_memberships / membership_schools)
-- ---------------------------------------------------------------------------

drop function if exists public.list_memberships_for_uid(uuid);
