# FeezypayERP — Grade Calculation Engine (E33)

> **Phase:** 3 — Academic Recording Platform  
> **Created:** 2026-08-07  
> **Owner engine:** **E33 Grade Calculation**  
> **Companions:** [`assessment-framework-engine.md`](assessment-framework-engine.md) · [`assessment-recording-engine.md`](assessment-recording-engine.md) · [`school-policy-engine.md`](school-policy-engine.md) · [`versioning.md`](versioning.md) · [`MASTER.md`](../MASTER.md)  
> **Module:** `lib/grade-calculation/` · Migration `20260807470000_grade_calculation_engine.sql`

---

## 1. Scope

Teachers **never** calculate grades manually. The engine reads pinned configuration + locked evidence and **computes** reproducible results.

| Reads | Produces |
|-------|----------|
| Assessment Framework (+ formulas / weightages) | Final marks |
| Assessment Records + current marks | Final grade (letter) |
| Grade mappings / scale bands | Grade points |
| Grace rules | Subject result |
| Optional subjects | Term result |
| Exemptions | Overall result |

| In scope | Out of scope |
|----------|--------------|
| Deterministic pure calc + persisted runs | Teacher manual grade entry |
| Configure grace / optional subjects / exemptions | Report card PDF (E20) |
| Publish computed results (immutable run) | Live UI dashboards |
| Full input snapshot for reproducibility | Auto-promotion (E06/E09 consume later) |

---

## 2. Reproducibility & audit

Every **calculation run**:

1. Pins `assessment_framework_version_id` (+ formula id when used)
2. Snapshots grace rules, optional-subject config, exemptions, and **mark row ids** used
3. Stores `inputs_fingerprint` (stable hash of snapshot)
4. Writes append-only `grade_calculation_results` + `grade_calculation_audit_log`
5. Re-run creates a **new** run version and supersedes prior `is_current` results — never silent overwrite

Same inputs ⇒ same outputs (pure functions in `lib/grade-calculation/compute.ts`).

---

## 3. Schema

| Table | Role |
|-------|------|
| `grade_calculation_grace_rules` | School/year configurable grace |
| `grade_calculation_optional_subjects` | Optional subjects + overall inclusion |
| `grade_calculation_exemptions` | Per-student exemptions |
| `grade_calculation_runs` | One compute job + full `input_snapshot` |
| `grade_calculation_results` | Subject / term / overall rows per student |
| `grade_calculation_audit_log` | Local audit |

**Run status:** `computed` \| `published` \| `superseded`  
**Result kinds:** `subject` \| `term` \| `overall`

---

## 4. Computation (v1)

1. For each framework category with evidence: average (or best-of / latest — configurable via category `aggregation` in snapshot; default **average** of locked records’ current marks).
2. Apply formula parts (weight %) → category contributions → final marks / percentage.
3. Map percentage → letter grade + grade points via `grade_bands` (from framework mapping or run config).
4. Apply grace rules if failing and under ceiling.
5. Skip / flag exempted subjects or categories.
6. Optional subjects: exclude from overall unless `include_in_overall`.
7. Aggregate subject results → term / overall.

---

## 5. AuthZ

| Key | Typical |
|-----|---------|
| `grade_calculation.read` | Teacher+ (read published) |
| `grade_calculation.configure` | Admin / HOD |
| `grade_calculation.run` | Admin / HOD |
| `grade_calculation.publish` | Admin / Principal / HOD |

Teachers do not run or configure calculations.

---

## 6. Module

```text
lib/grade-calculation/
  types.ts
  validation.ts
  compute.ts          # pure, deterministic
  fingerprint.ts
  server-helpers.ts
  audit.ts
  config-actions.ts   # grace, optional, exemptions
  run-actions.ts      # compute + publish
  query-actions.ts
  index.ts
```

---

## 7. Placement

| Concern | Owner |
|---------|-------|
| Evaluation plan / formulas | E31 |
| Evidence marks | E32 |
| **Computed grades / results** | **E33** |
| Grace policy catalog (optional) | E07 policies `grace_marks` — E33 may snapshot rules |
| Report cards | E20 reads published E33 results |

---

## 8. Tests

`npx tsx scripts/smoke-grade-calculation-validation.ts` · `npx tsc --noEmit`

---

*MASTER §64.*
