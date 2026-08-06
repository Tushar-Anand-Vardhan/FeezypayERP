-- Identity smoke test against live school 6385483b-8f79-49fc-9bd4-b19d2cef684a
-- Safe: uses unique smoke-test emails/aadhaar hashes; cleans up at end unless KEEP_SMOKE=1

do $$
declare
  v_school uuid := '6385483b-8f79-49fc-9bd4-b19d2cef684a';
  v_year uuid;
  v_class uuid;
  v_section uuid;
  v_term uuid;
  v_science uuid;
  v_math uuid;
  v_dept uuid;
  v_person uuid;
  v_person2 uuid;
  v_tch uuid;
  v_emp uuid;
  v_emp2 uuid;
  v_student_person uuid;
  v_student_profile uuid;
  v_admission uuid;
  v_parent_person uuid;
  v_parent_profile uuid;
  v_persons_before int;
  v_persons_after int;
  v_aadhaar_hash text := encode(digest('999988887777', 'sha256'), 'hex');
  v_dup_failed boolean := false;
  v_teacher_count int;
begin
  select id into v_year from academic_years where school_id = v_school and is_active = true limit 1;
  if v_year is null then
    raise exception 'FAIL: no active academic year';
  end if;

  select id into v_class from classes where academic_year_id = v_year order by name limit 1;
  select s.id into v_section from sections s where s.class_id = v_class order by s.name limit 1;
  select id into v_term from terms where academic_year_id = v_year limit 1;
  select id into v_science from subjects where school_id = v_school and name = 'Science' limit 1;
  select id into v_math from subjects where school_id = v_school and name = 'Math' limit 1;

  if v_class is null or v_section is null or v_science is null or v_math is null then
    raise exception 'FAIL: missing class/section/subjects for smoke school';
  end if;

  -- Ensure department
  select id into v_dept from departments where school_id = v_school and lower(name) = 'science' limit 1;
  if v_dept is null then
    insert into departments (school_id, name) values (v_school, 'Science') returning id into v_dept;
  end if;

  select count(*) into v_persons_before from persons;

  -- 1) Create multi-subject HOD with aadhaar
  insert into persons (full_name, email, phone, aadhaar_hash, aadhaar_last4)
  values ('Smoke HOD Teacher', 'smoke-hod@feezy.test', '9000000001', v_aadhaar_hash, '7777')
  returning id into v_person;

  insert into teacher_profiles (person_id) values (v_person) returning id into v_tch;
  insert into person_roles (person_id, role) values (v_person, 'teacher') on conflict do nothing;

  insert into teacher_employments (
    teacher_profile_id, school_id, employee_code, designation, department_id, is_hod, status, joined_on
  ) values (
    v_tch, v_school, 'SMOKE-HOD', 'HOD', v_dept, true, 'active', current_date
  ) returning id into v_emp;

  insert into employment_subjects (employment_id, subject_id) values
    (v_emp, v_science),
    (v_emp, v_math);

  -- 2) Duplicate email must fail
  begin
    insert into persons (full_name, email) values ('Dup Email', 'smoke-hod@feezy.test');
  exception when unique_violation then
    v_dup_failed := true;
  end;
  if not v_dup_failed then
    raise exception 'FAIL: duplicate email was allowed';
  end if;

  -- 3) Duplicate aadhaar must fail
  v_dup_failed := false;
  begin
    insert into persons (full_name, aadhaar_hash, aadhaar_last4)
    values ('Dup Aadhaar', v_aadhaar_hash, '7777');
  exception when unique_violation then
    v_dup_failed := true;
  end;
  if not v_dup_failed then
    raise exception 'FAIL: duplicate aadhaar was allowed';
  end if;

  -- 4) Re-save simulation: resolve by email, do NOT create another person
  select id into v_person2 from persons where lower(email) = 'smoke-hod@feezy.test';
  if v_person2 is distinct from v_person then
    raise exception 'FAIL: email resolve returned different person';
  end if;
  select count(*) into v_persons_after from persons where lower(email) = 'smoke-hod@feezy.test';
  if v_persons_after <> 1 then
    raise exception 'FAIL: re-save duplicated persons for smoke-hod email';
  end if;

  -- 5) Second active employment same school+profile must fail
  v_dup_failed := false;
  begin
    insert into teacher_employments (teacher_profile_id, school_id, status)
    values (v_tch, v_school, 'active');
  exception when unique_violation then
    v_dup_failed := true;
  end;
  if not v_dup_failed then
    raise exception 'FAIL: two active employments allowed for same teacher+school';
  end if;

  -- 6) End employment then create new history row — allowed
  update teacher_employments
    set status = 'ended', left_on = current_date
    where id = v_emp;
  insert into teacher_employments (
    teacher_profile_id, school_id, employee_code, designation, department_id, is_hod, status, joined_on
  ) values (
    v_tch, v_school, 'SMOKE-HOD-2', 'HOD', v_dept, true, 'active', current_date
  ) returning id into v_emp2;
  insert into employment_subjects (employment_id, subject_id) values
    (v_emp2, v_science), (v_emp2, v_math);

  -- 7) Student + guardian + optional aadhaar
  insert into persons (full_name, date_of_birth, gender, aadhaar_hash, aadhaar_last4)
  values (
    'Smoke Student',
    '2015-01-15',
    'male',
    encode(digest('111122223333', 'sha256'), 'hex'),
    '2333'
  ) returning id into v_student_person;

  insert into student_profiles (person_id) values (v_student_person) returning id into v_student_profile;
  insert into person_roles (person_id, role) values (v_student_person, 'student') on conflict do nothing;

  insert into student_admissions (
    student_profile_id, school_id, admission_number, admitted_on, status
  ) values (
    v_student_profile, v_school, 'SMOKE-ADM-001', current_date, 'active'
  ) returning id into v_admission;

  insert into student_academic_years (
    admission_id, academic_year_id, class_id, section_id, enrolled_on, status, enrollment_type
  ) values (
    v_admission, v_year, v_class, v_section, current_date, 'active', 'new_admission'
  );

  insert into persons (full_name, phone, email)
  values ('Smoke Parent', '9111111111', 'smoke-parent@feezy.test')
  returning id into v_parent_person;
  insert into parent_profiles (person_id) values (v_parent_person) returning id into v_parent_profile;
  insert into person_roles (person_id, role) values (v_parent_person, 'parent') on conflict do nothing;
  insert into student_parent_links (student_profile_id, parent_profile_id, relationship, is_primary)
  values (v_student_profile, v_parent_profile, 'father', true);

  -- 8) Timetable teacher list (active employments)
  select count(*) into v_teacher_count
  from teacher_employments
  where school_id = v_school and status = 'active';
  if v_teacher_count < 1 then
    raise exception 'FAIL: no active teachers for timetable';
  end if;

  -- 9) Ensure exams + timetable skip so review can complete
  if not exists (
    select 1 from exam_definitions where academic_year_id = v_year
  ) then
    if v_term is null then
      raise exception 'FAIL: no term for exam';
    end if;
    insert into exam_definitions (academic_year_id, term_id, name, category, max_marks, grading_type)
    values (v_year, v_term, 'Smoke Midterm', 'midterm', 100, 'marks');
  end if;

  update schools
  set
    houses_clubs_completed = true,
    timetable_skipped = true,
    onboarding_status = 'completed',
    updated_at = now()
  where id = v_school
    and onboarding_status is distinct from 'completed';

  raise notice 'PASS smoke identity checks';
  raise notice 'person=% teacher_profile=% employment=% student_admission=% teachers_active=%',
    v_person, v_tch, v_emp2, v_admission, v_teacher_count;
end $$;

-- Verification report
select 'active_teachers' as check, count(*)::text as value
from teacher_employments
where school_id = '6385483b-8f79-49fc-9bd4-b19d2cef684a' and status = 'active'
union all
select 'smoke_hod_subjects', string_agg(s.name, '|' order by s.name)
from teacher_employments te
join employment_subjects es on es.employment_id = te.id
join subjects s on s.id = es.subject_id
join teacher_profiles tp on tp.id = te.teacher_profile_id
join persons p on p.id = tp.person_id
where p.email = 'smoke-hod@feezy.test' and te.status = 'active'
union all
select 'smoke_persons_for_hod_email', count(*)::text
from persons where lower(email) = 'smoke-hod@feezy.test'
union all
select 'smoke_student_admissions', count(*)::text
from student_admissions where admission_number = 'SMOKE-ADM-001'
union all
select 'smoke_student_years', count(*)::text
from student_academic_years say
join student_admissions sa on sa.id = say.admission_id
where sa.admission_number = 'SMOKE-ADM-001'
union all
select 'smoke_parent_links', count(*)::text
from student_parent_links spl
join student_profiles sp on sp.id = spl.student_profile_id
join persons p on p.id = sp.person_id
where p.full_name = 'Smoke Student'
union all
select 'school_onboarding', onboarding_status
from schools where id = '6385483b-8f79-49fc-9bd4-b19d2cef684a'
union all
select 'timetable_skipped', timetable_skipped::text
from schools where id = '6385483b-8f79-49fc-9bd4-b19d2cef684a'
union all
select 'exams', count(*)::text
from exam_definitions ed
join academic_years ay on ay.id = ed.academic_year_id
where ay.school_id = '6385483b-8f79-49fc-9bd4-b19d2cef684a';
