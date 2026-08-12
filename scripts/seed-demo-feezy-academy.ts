/**
 * Seed Feezypay Academy with demo logins + operational sample data.
 *
 * Uses service-role Supabase client + membership sync helpers (same tables
 * engines write). Not cookie-bound server actions (those need a browser session).
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *     npx tsx scripts/seed-demo-feezy-academy.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  syncParentMembership,
  syncStaffMembership,
  syncStudentMembership,
} from "../lib/membership/sync";

const SCHOOL_ID = "6385483b-8f79-49fc-9bd4-b19d2cef684a";
const DEMO_PASSWORD = "FeezyDemo2026!";
const YEAR_ID = "47ceace7-a65b-4b17-a4ad-60f36955fd3a";

type DemoAccount = {
  email: string;
  fullName: string;
  persona: "teacher" | "student" | "parent" | "hod";
  designation?: string;
  isHod?: boolean;
  departmentName?: string;
};

const TEACHERS: DemoAccount[] = [
  {
    email: "priya.math@feezy.demo",
    fullName: "Priya Sharma",
    persona: "teacher",
    designation: "TGT Mathematics",
    departmentName: "Math",
  },
  {
    email: "raj.science@feezy.demo",
    fullName: "Raj Gupta",
    persona: "teacher",
    designation: "TGT Science",
    departmentName: "Science",
  },
  {
    email: "anita.english@feezy.demo",
    fullName: "Anita Desai",
    persona: "hod",
    designation: "HOD English",
    isHod: true,
    departmentName: "Science",
  },
];

const STUDENTS = [
  { email: "arjun.student@feezy.demo", fullName: "Arjun Mehta", roll: "10" },
  { email: "meera.student@feezy.demo", fullName: "Meera Iyer", roll: "11" },
  { email: "kabir.student@feezy.demo", fullName: "Kabir Singh", roll: "12" },
  { email: "sara.student@feezy.demo", fullName: "Sara Khan", roll: "13" },
];

const PARENT = {
  email: "kavita.parent@feezy.demo",
  fullName: "Kavita Mehta",
};

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureAuthUser(
  supabase: SupabaseClient,
  email: string,
  fullName: string,
): Promise<string> {
  const { data: listed } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const existing = listed?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, demo: true },
    });
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, demo: true, intent: "invite" },
  });
  if (error || !data.user) {
    throw new Error(`createUser ${email}: ${error?.message}`);
  }
  return data.user.id;
}

async function ensurePerson(
  supabase: SupabaseClient,
  input: { fullName: string; email: string; authUserId: string },
): Promise<string> {
  const { data: byAuth } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();
  if (byAuth?.id) {
    await supabase
      .from("persons")
      .update({
        full_name: input.fullName,
        email: input.email,
        profile_completed_at: new Date().toISOString(),
      })
      .eq("id", byAuth.id);
    return byAuth.id;
  }

  const { data: byEmail } = await supabase
    .from("persons")
    .select("id")
    .ilike("email", input.email)
    .maybeSingle();
  if (byEmail?.id) {
    await supabase
      .from("persons")
      .update({
        full_name: input.fullName,
        auth_user_id: input.authUserId,
        profile_completed_at: new Date().toISOString(),
      })
      .eq("id", byEmail.id);
    return byEmail.id;
  }

  const { data, error } = await supabase
    .from("persons")
    .insert({
      full_name: input.fullName,
      email: input.email,
      auth_user_id: input.authUserId,
      profile_completed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new Error(`person insert ${input.email}: ${error?.message}`);
  }
  return data.id;
}

async function setActiveContext(
  supabase: SupabaseClient,
  authUserId: string,
  persona: string,
) {
  await supabase.from("user_active_context").upsert(
    {
      auth_user_id: authUserId,
      school_id: SCHOOL_ID,
      persona,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  );
}

async function main() {
  const supabase = admin();
  console.log("Seeding Feezypay Academy demo data…");

  // --- Academic year dates ---
  await supabase
    .from("academic_years")
    .update({
      start_date: "2026-04-01",
      end_date: "2027-03-31",
      status: "active",
      is_active: true,
    })
    .eq("id", YEAR_ID);

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, code")
    .eq("school_id", SCHOOL_ID)
    .is("archived_at", null);
  const subjectByName = new Map(
    (subjects ?? []).map((s) => [s.name.toLowerCase(), s]),
  );

  const { data: depts } = await supabase
    .from("departments")
    .select("id, name")
    .eq("school_id", SCHOOL_ID)
    .is("archived_at", null);
  const deptByName = new Map((depts ?? []).map((d) => [d.name, d.id]));

  // Ensure English dept exists for HOD variety
  if (!deptByName.has("English")) {
    const { data: eng } = await supabase
      .from("departments")
      .insert({
        school_id: SCHOOL_ID,
        name: "English",
        code: "ENG",
        description: "Languages department",
      })
      .select("id")
      .maybeSingle();
    if (eng?.id) deptByName.set("English", eng.id);
  }

  const { data: class10 } = await supabase
    .from("classes")
    .select("id, name")
    .eq("academic_year_id", YEAR_ID)
    .eq("name", "Class 10")
    .maybeSingle();
  if (!class10) throw new Error("Class 10 missing — finish onboarding first.");

  const { data: sectionA } = await supabase
    .from("sections")
    .select("id, name")
    .eq("class_id", class10.id)
    .eq("name", "A")
    .maybeSingle();
  if (!sectionA) throw new Error("Class 10-A missing.");

  const { data: terms } = await supabase
    .from("terms")
    .select("id, name")
    .eq("academic_year_id", YEAR_ID);
  const term1 = terms?.find((t) => t.name.includes("1")) ?? terms?.[0];

  // --- Houses ---
  const houseSpecs = [
    { name: "Red House", code: "RED", colour: "#C62828", display_order: 0 },
    { name: "Blue House", code: "BLUE", colour: "#1565C0", display_order: 1 },
    { name: "Green House", code: "GREEN", colour: "#2E7D32", display_order: 2 },
    { name: "Yellow House", code: "YELLOW", colour: "#F9A825", display_order: 3 },
  ];
  const houseIds: string[] = [];
  for (const h of houseSpecs) {
    const { data: existing } = await supabase
      .from("houses")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .ilike("name", h.name)
      .maybeSingle();
    if (existing?.id) {
      houseIds.push(existing.id);
      continue;
    }
    const { data: created, error } = await supabase
      .from("houses")
      .insert({
        school_id: SCHOOL_ID,
        academic_year_id: YEAR_ID,
        name: h.name,
        code: h.code,
        colour: h.colour,
        display_order: h.display_order,
        points_tracking_enabled: true,
      })
      .select("id")
      .maybeSingle();
    if (error) console.warn("house", h.name, error.message);
    if (created?.id) houseIds.push(created.id);
  }

  // --- Teachers ---
  const employmentByEmail = new Map<string, string>();
  for (const t of TEACHERS) {
    const authUserId = await ensureAuthUser(supabase, t.email, t.fullName);
    const personId = await ensurePerson(supabase, {
      fullName: t.fullName,
      email: t.email,
      authUserId,
    });

    let { data: tp } = await supabase
      .from("teacher_profiles")
      .select("id")
      .eq("person_id", personId)
      .maybeSingle();
    if (!tp?.id) {
      const { data: created, error } = await supabase
        .from("teacher_profiles")
        .insert({ person_id: personId })
        .select("id")
        .maybeSingle();
      if (error || !created) {
        throw new Error(`teacher_profile ${t.email}: ${error?.message}`);
      }
      tp = created;
    }

    const deptId = t.departmentName
      ? deptByName.get(t.departmentName) ??
        (t.departmentName === "English" ? deptByName.get("English") : null)
      : null;

    const { data: existingEmp } = await supabase
      .from("teacher_employments")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("teacher_profile_id", tp.id)
      .eq("status", "active")
      .maybeSingle();

    let employmentId = existingEmp?.id as string | undefined;
    if (!employmentId) {
      const { data: emp, error } = await supabase
        .from("teacher_employments")
        .insert({
          school_id: SCHOOL_ID,
          teacher_profile_id: tp.id,
          designation: t.designation ?? "Teacher",
          department_id: deptId,
          is_hod: Boolean(t.isHod),
          status: "active",
          joined_on: "2026-04-01",
          school_persona: t.isHod ? "hod" : "teacher",
          employment_type: "full_time",
        })
        .select("id")
        .maybeSingle();
      if (error || !emp) {
        throw new Error(`employment ${t.email}: ${error?.message}`);
      }
      employmentId = emp.id;
    } else {
      await supabase
        .from("teacher_employments")
        .update({
          designation: t.designation ?? "Teacher",
          department_id: deptId,
          is_hod: Boolean(t.isHod),
          school_persona: t.isHod ? "hod" : "teacher",
        })
        .eq("id", employmentId);
    }

    // Link a couple of subjects
    const subjectNames =
      t.email.includes("math")
        ? ["Math"]
        : t.email.includes("science")
          ? ["Science"]
          : ["English", "SST"];
    for (const sn of subjectNames) {
      const sub = subjectByName.get(sn.toLowerCase());
      if (!sub) continue;
      const { data: existingSub } = await supabase
        .from("employment_subjects")
        .select("id")
        .eq("employment_id", employmentId)
        .eq("subject_id", sub.id)
        .maybeSingle();
      if (!existingSub) {
        await supabase.from("employment_subjects").insert({
          employment_id: employmentId,
          subject_id: sub.id,
        });
      }
    }

    const sync = await syncStaffMembership(supabase, employmentId);
    if (!sync.ok) console.warn("staff membership", t.email, sync.error);
    await setActiveContext(
      supabase,
      authUserId,
      t.isHod ? "hod" : "teacher",
    );
    employmentByEmail.set(t.email, employmentId);
    console.log("Teacher ready:", t.email);
  }

  const priyaEmp = employmentByEmail.get("priya.math@feezy.demo")!;
  const rajEmp = employmentByEmail.get("raj.science@feezy.demo")!;
  const anitaEmp = employmentByEmail.get("anita.english@feezy.demo")!;

  // --- Periods + timetable for Class 10-A (Mon–Fri) ---
  const periodSpecs = [
    { n: 1, start: "08:00", end: "08:45" },
    { n: 2, start: "08:45", end: "09:30" },
    { n: 3, start: "09:45", end: "10:30" },
    { n: 4, start: "10:30", end: "11:15" },
    { n: 5, start: "11:30", end: "12:15" },
    { n: 6, start: "12:15", end: "13:00" },
  ];
  const periodIds: string[] = [];
  for (const p of periodSpecs) {
    const { data: existing } = await supabase
      .from("period_definitions")
      .select("id")
      .eq("academic_year_id", YEAR_ID)
      .eq("period_number", p.n)
      .maybeSingle();
    if (existing?.id) {
      periodIds.push(existing.id);
      continue;
    }
    const { data: created, error } = await supabase
      .from("period_definitions")
      .insert({
        academic_year_id: YEAR_ID,
        period_number: p.n,
        start_time: p.start,
        end_time: p.end,
      })
      .select("id")
      .maybeSingle();
    if (error) console.warn("period", p.n, error.message);
    if (created?.id) periodIds.push(created.id);
  }

  const weekdayPlan: Array<{
    day: number;
    periodIdx: number;
    subject: string;
    emp: string;
  }> = [];
  const planSubjects = [
    ["Math", priyaEmp],
    ["Science", rajEmp],
    ["English", anitaEmp],
    ["SST", anitaEmp],
    ["Math", priyaEmp],
    ["Science", rajEmp],
  ] as const;
  for (let day = 1; day <= 5; day++) {
    planSubjects.forEach(([subject, emp], periodIdx) => {
      weekdayPlan.push({ day, periodIdx, subject, emp });
    });
  }

  for (const slot of weekdayPlan) {
    const periodId = periodIds[slot.periodIdx];
    const sub = subjectByName.get(slot.subject.toLowerCase());
    if (!periodId || !sub) continue;
    const { data: existing } = await supabase
      .from("timetable_slots")
      .select("id")
      .eq("section_id", sectionA.id)
      .eq("day_of_week", slot.day)
      .eq("period_definition_id", periodId)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from("timetable_slots")
        .update({
          subject_id: sub.id,
          teacher_id: slot.emp,
          archived_at: null,
        })
        .eq("id", existing.id);
    } else {
      const { error } = await supabase.from("timetable_slots").insert({
        section_id: sectionA.id,
        day_of_week: slot.day,
        period_definition_id: periodId,
        subject_id: sub.id,
        teacher_id: slot.emp,
      });
      if (error) console.warn("slot", error.message);
    }
  }
  console.log("Timetable seeded for Class 10-A");

  // --- Calendar / holidays / events ---
  for (const h of [
    {
      title: "Independence Day",
      start_date: "2026-08-15",
      end_date: "2026-08-15",
    },
    {
      title: "Gandhi Jayanti",
      start_date: "2026-10-02",
      end_date: "2026-10-02",
    },
    {
      title: "Diwali Break",
      start_date: "2026-11-09",
      end_date: "2026-11-12",
    },
  ]) {
    const { data: exists } = await supabase
      .from("holidays")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("academic_year_id", YEAR_ID)
      .eq("title", h.title)
      .maybeSingle();
    if (exists) continue;
    const { error } = await supabase.from("holidays").insert({
      school_id: SCHOOL_ID,
      academic_year_id: YEAR_ID,
      title: h.title,
      start_date: h.start_date,
      end_date: h.end_date,
      is_all_day: true,
    });
    if (error) console.warn("holiday", h.title, error.message);
  }
  const events = [
    {
      title: "Parent-Teacher Meeting — Term 1",
      category: "ptm",
      starts_at: "2026-09-20T04:30:00Z",
      ends_at: "2026-09-20T09:30:00Z",
    },
    {
      title: "Inter-House Sports Day",
      category: "sports",
      starts_at: "2026-10-18T03:30:00Z",
      ends_at: "2026-10-18T10:30:00Z",
    },
    {
      title: "Science Exhibition",
      category: "competition",
      starts_at: "2026-11-05T04:00:00Z",
      ends_at: "2026-11-05T09:00:00Z",
    },
    {
      title: "Annual Day Rehearsal",
      category: "annual_day",
      starts_at: "2026-12-12T04:30:00Z",
      ends_at: "2026-12-12T08:30:00Z",
    },
  ];
  for (const ev of events) {
    const { data: exists } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("title", ev.title)
      .maybeSingle();
    if (exists) continue;
    await supabase.from("calendar_events").insert({
      school_id: SCHOOL_ID,
      academic_year_id: YEAR_ID,
      term_id: term1?.id ?? null,
      title: ev.title,
      description: "Demo school event",
      category: ev.category,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      is_all_day: false,
      location: "Main Campus",
      visibility: "school",
      audience: { role_keys: ["student", "parent", "teacher"] },
      approval_status: "published",
    });
  }
  console.log("Calendar events seeded");

  // --- Exam definition + schedules ---
  let examId: string | null = null;
  {
    const { data: existing } = await supabase
      .from("exam_definitions")
      .select("id")
      .eq("academic_year_id", YEAR_ID)
      .ilike("name", "Unit Test 1")
      .maybeSingle();
    if (existing?.id) {
      examId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("exam_definitions")
        .insert({
          academic_year_id: YEAR_ID,
          term_id: term1?.id ?? null,
          name: "Unit Test 1",
          category: "unit_test",
          weightage_percent: 10,
          max_marks: 40,
        })
        .select("id")
        .maybeSingle();
      if (error) console.warn("exam", error.message);
      examId = created?.id ?? null;
    }
  }

  const scheduleIds: string[] = [];
  if (examId) {
    for (const sn of ["Math", "Science", "English"]) {
      const sub = subjectByName.get(sn.toLowerCase());
      if (!sub) continue;
      const { data: existing } = await supabase
        .from("exam_subject_schedules")
        .select("id")
        .eq("exam_definition_id", examId)
        .eq("subject_id", sub.id)
        .eq("class_id", class10.id)
        .maybeSingle();
      if (existing?.id) {
        scheduleIds.push(existing.id);
        continue;
      }
      const { data: created } = await supabase
        .from("exam_subject_schedules")
        .insert({
          exam_definition_id: examId,
          subject_id: sub.id,
          class_id: class10.id,
          grading_type: "marks",
          max_marks: 40,
        })
        .select("id")
        .maybeSingle();
      if (created?.id) scheduleIds.push(created.id);
    }
  }
  console.log("Exams seeded");

  // --- Students + placements ---
  const studentProfileIds: string[] = [];
  for (let i = 0; i < STUDENTS.length; i++) {
    const st = STUDENTS[i];
    const authUserId = await ensureAuthUser(supabase, st.email, st.fullName);
    const personId = await ensurePerson(supabase, {
      fullName: st.fullName,
      email: st.email,
      authUserId,
    });

    let { data: sp } = await supabase
      .from("student_profiles")
      .select("id")
      .eq("person_id", personId)
      .maybeSingle();
    if (!sp?.id) {
      const { data: created, error } = await supabase
        .from("student_profiles")
        .insert({ person_id: personId })
        .select("id")
        .maybeSingle();
      if (error || !created) {
        throw new Error(`student_profile ${st.email}: ${error?.message}`);
      }
      sp = created;
    }
    studentProfileIds.push(sp.id);

    let { data: adm } = await supabase
      .from("student_admissions")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("student_profile_id", sp.id)
      .maybeSingle();
    if (!adm?.id) {
      const { data: created, error } = await supabase
        .from("student_admissions")
        .insert({
          school_id: SCHOOL_ID,
          student_profile_id: sp.id,
          admission_number: `FA-2026-${100 + i}`,
          status: "active",
          admitted_on: "2026-04-01",
          house_id: houseIds[i % houseIds.length] ?? null,
        })
        .select("id")
        .maybeSingle();
      if (error || !created) {
        throw new Error(`admission ${st.email}: ${error?.message}`);
      }
      adm = created;
    }

    const { data: place } = await supabase
      .from("student_academic_years")
      .select("id")
      .eq("admission_id", adm.id)
      .eq("academic_year_id", YEAR_ID)
      .maybeSingle();
    if (!place?.id) {
      await supabase.from("student_academic_years").insert({
        admission_id: adm.id,
        academic_year_id: YEAR_ID,
        class_id: class10.id,
        section_id: sectionA.id,
        roll_number: st.roll,
        enrolled_on: "2026-04-01",
        status: "active",
      });
    }

    const sync = await syncStudentMembership(supabase, adm.id);
    if (!sync.ok) console.warn("student membership", st.email, sync.error);
    await setActiveContext(supabase, authUserId, "student");
    console.log("Student ready:", st.email);
  }

  // --- Parent linked to Arjun ---
  {
    const authUserId = await ensureAuthUser(
      supabase,
      PARENT.email,
      PARENT.fullName,
    );
    const personId = await ensurePerson(supabase, {
      fullName: PARENT.fullName,
      email: PARENT.email,
      authUserId,
    });
    let { data: pp } = await supabase
      .from("parent_profiles")
      .select("id")
      .eq("person_id", personId)
      .maybeSingle();
    if (!pp?.id) {
      const { data: created, error } = await supabase
        .from("parent_profiles")
        .insert({ person_id: personId })
        .select("id")
        .maybeSingle();
      if (error || !created) {
        throw new Error(`parent_profile: ${error?.message}`);
      }
      pp = created;
    }
    const childProfileId = studentProfileIds[0];
    const { data: link } = await supabase
      .from("student_parent_links")
      .select("id")
      .eq("parent_profile_id", pp.id)
      .eq("student_profile_id", childProfileId)
      .maybeSingle();
    let linkId = link?.id;
    if (!linkId) {
      const { data: created, error } = await supabase
        .from("student_parent_links")
        .insert({
          parent_profile_id: pp.id,
          student_profile_id: childProfileId,
          relationship: "mother",
          is_primary: true,
        })
        .select("id")
        .maybeSingle();
      if (error || !created) {
        throw new Error(`parent link: ${error?.message}`);
      }
      linkId = created.id;
    }
    const sync = await syncParentMembership(supabase, linkId);
    if (!sync.ok) console.warn("parent membership", sync.error);
    await setActiveContext(supabase, authUserId, "parent");
    console.log("Parent ready:", PARENT.email);
  }

  // --- Attendance last 5 weekdays for Class 10-A students ---
  const today = new Date();
  const dates: string[] = [];
  for (let d = 0; d < 10 && dates.length < 5; d++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - d);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue;
    dates.push(dt.toISOString().slice(0, 10));
  }
  for (const date of dates) {
    for (let i = 0; i < studentProfileIds.length; i++) {
      const status =
        i === 2 && date === dates[0] ? "absent" : i === 3 ? "late" : "present";
      const { data: existing } = await supabase
        .from("attendance_records")
        .select("id")
        .eq("school_id", SCHOOL_ID)
        .eq("student_profile_id", studentProfileIds[i])
        .eq("attendance_date", date)
        .eq("scope", "daily")
        .is("superseded_at", null)
        .maybeSingle();
      if (existing) continue;
      await supabase.from("attendance_records").insert({
        school_id: SCHOOL_ID,
        student_profile_id: studentProfileIds[i],
        section_id: sectionA.id,
        attendance_date: date,
        status,
        scope: "daily",
        workflow_status: "submitted",
        visible_to_guardians: true,
        visible_to_students: true,
        recorded_by_employment_id: priyaEmp,
        late_minutes: status === "late" ? 12 : null,
      });
    }
  }
  console.log("Attendance seeded");

  // --- Published marks for Unit Test 1 ---
  if (examId) {
    for (const sn of ["Math", "Science", "English"]) {
      const sub = subjectByName.get(sn.toLowerCase());
      if (!sub) continue;
      for (let i = 0; i < studentProfileIds.length; i++) {
        const marks = 28 + ((i * 3 + sn.length) % 10);
        const { data: existing } = await supabase
          .from("exam_results")
          .select("id")
          .eq("school_id", SCHOOL_ID)
          .eq("student_profile_id", studentProfileIds[i])
          .eq("exam_definition_id", examId)
          .eq("subject_id", sub.id)
          .is("superseded_at", null)
          .maybeSingle();
        if (existing) continue;
        await supabase.from("exam_results").insert({
          school_id: SCHOOL_ID,
          student_profile_id: studentProfileIds[i],
          exam_definition_id: examId,
          subject_id: sub.id,
          academic_year_id: YEAR_ID,
          class_id: class10.id,
          section_id: sectionA.id,
          marks_obtained: marks,
          max_marks: 40,
          grade_label: marks >= 36 ? "A" : marks >= 30 ? "B" : "C",
          is_absent: false,
          workflow_status: "published",
          published_at: new Date().toISOString(),
          visible_to_guardians: true,
          visible_to_students: true,
          entered_by_employment_id: sn === "Math" ? priyaEmp : rajEmp,
          teacher_remark: "Demo result",
        });
      }
    }
  }
  console.log("Marks seeded");

  // --- Homework ---
  {
    const math = subjectByName.get("math");
    if (math) {
      const { data: existing } = await supabase
        .from("homework_assignments")
        .select("id")
        .eq("school_id", SCHOOL_ID)
        .eq("title", "Algebra practice worksheet")
        .maybeSingle();
      if (!existing) {
        await supabase.from("homework_assignments").insert({
          school_id: SCHOOL_ID,
          employment_id: priyaEmp,
          section_id: sectionA.id,
          class_id: class10.id,
          subject_id: math.id,
          academic_year_id: YEAR_ID,
          title: "Algebra practice worksheet",
          description: "Complete exercise 4.2 questions 1–10",
          assignment_kind: "homework",
          assigned_on: new Date().toISOString().slice(0, 10),
          due_on: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
          status: "assigned",
          published_at: new Date().toISOString(),
          parent_visible: true,
          visible_to_students: true,
          max_marks: 20,
        });
      }
    }
  }
  console.log("Homework seeded");

  // Enable houses flag on school
  await supabase
    .from("schools")
    .update({
      houses_enabled: true,
      houses_clubs_completed: true,
    })
    .eq("id", SCHOOL_ID);

  console.log("\n========== DEMO LOGINS ==========");
  console.log(`Password for all demo users: ${DEMO_PASSWORD}`);
  console.log("\nTeachers (Teacher Portal /dashboard/teacher):");
  for (const t of TEACHERS) {
    console.log(`  ${t.email}  (${t.fullName}, ${t.designation})`);
  }
  console.log("\nStudents (Student Portal /dashboard/student):");
  for (const s of STUDENTS) {
    console.log(`  ${s.email}  (${s.fullName}, Class 10-A)`);
  }
  console.log("\nParent (linked to Arjun Mehta):");
  console.log(`  ${PARENT.email}  (${PARENT.fullName})`);
  console.log("\nAdmin (unchanged):");
  console.log("  tushar220.tv@gmail.com  (school_admin — your password)");
  console.log("=================================\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
