# FeezypayERP — AI Architecture

> **Phase:** 0.5 — Architecture (design-only)  
> **Created:** 2026-08-06  
> **Status:** Canonical design for **E23 AI** — **runtime `NOT BUILT`**  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md) · [`system-events.md`](system-events.md) · [`rbac.md`](rbac.md) · [`versioning.md`](versioning.md) · [`audit-log.md`](audit-log.md) · [`notification-engine.md`](notification-engine.md)  
> **Rule (P8):** AI **consumes** structured ERP data and **never** becomes the source of truth. Humans (or explicit engine commands under human AuthZ) commit changes.

---

## 1. Non-negotiables

| Rule | Meaning |
|------|---------|
| **No shadow ERP** | AI must not invent parallel students, fees, marks, or admissions |
| **Propose ≠ commit** | Models emit `AISuggestion` / drafts; OLTP writes only via owning engines |
| **AuthZ inherited** | Tools run with the **user’s** permission keys (or a narrower allowlist), never elevated service role for OLTP |
| **Tenant isolation** | Retrieval and memory are `school_id`-scoped; no cross-school RAG without Super Admin + anonymization policy |
| **Structured first** | Prefer engine APIs / Analytics marts over scraping UI or free-text dumps of PII |
| **Versioning honored** | Accepted suggestions follow [`versioning.md`](versioning.md) (no history rewrite) |
| **Audited** | Propose optional; **accept always** audited as human actor ([`audit-log.md`](audit-log.md)) |
| **Redaction** | No Aadhaar, secrets, full medical narratives, or raw payment PANs in prompts/logs |

```text
  User prompt / scheduled job
        │
        ▼
  E23 AI Orchestrator  ──reads──▶  E22 Analytics marts
        │                 ──reads──▶  Engine query APIs (ACL)
        │                 ──RAG───▶  ACL-scoped embeddings / docs
        ▼
  Model output
        ├── Draft / insight / answer (read-only UX)
        └── AISuggestion ──human accept──▶ command ──▶ owning engine write
                                                      └── domain event + audit
```

---

## 2. AI services (capability catalog)

Services are **products of E23**, not separate truth stores.

| Service ID | Purpose | Typical personas | Writes OLTP? |
|------------|---------|------------------|--------------|
| `ai.chat.assistant` | Q&A over allowed school data | All (scoped) | No |
| `ai.draft.communication` | Draft announcement / message copy | Teacher, Adm, Pri | No → E18 on accept |
| `ai.draft.lesson_plan` | Lesson plan outline | Teacher, HOD | No → E10 on accept |
| `ai.draft.report_narrative` | Report-card remarks / summaries | Teacher, Pri | No → E20/E11 on accept |
| `ai.suggest.timetable` | Conflict / swap suggestions | Adm, Pri, HOD | No → E10 on accept |
| `ai.suggest.placement` | Section balancing hints | Adm, Pri | No → E06 on accept |
| `ai.insight.fee_risk` | Overdue / default risk scores | Adm, accountant, Pri | No (insight only) |
| `ai.insight.attendance_risk` | Chronic absence patterns | Adm, Tch, Pri | No |
| `ai.insight.academic` | Cohort / subject performance | Tch, HOD, Pri | No |
| `ai.analytics.narrate` | Natural-language dashboard summary | Adm, Pri, HOD | No |
| `ai.agent.ops` | Future multi-step agent (allowlisted tools) | Adm, Pri, SA | Only via accept/tools under AuthZ |
| `ai.moderate.content` | Flag unsafe announcement drafts | System + Adm | No |

Each service declares: allowed tools, max tokens, knowledge scopes, whether suggestions are required, retention of prompt logs.

---

## 3. Knowledge sources

| Source | Owner | What AI may use | Notes |
|--------|-------|-----------------|-------|
| **OLTP read APIs** | Domain engines | Ids + authorized fields via E03 | Prefer typed DTOs, not `SELECT *` |
| **Analytics marts** | E22 | Aggregates, trends, risk features | Primary for insights |
| **Published documents** | E20 / E27 | Issued report cards metadata, handbooks | ACL; prefer text extracts already cleared |
| **Lesson plans / curriculum packs** | E10 / E07 | Teacher’s own + school library | |
| **Announcement / template library** | E18 | Prior copy (school-scoped) | Pin template versions |
| **Policy / help docs** | Platform | Product help, grading policy text | Global non-PII |
| **Embeddings index** | E23 | Chunks of allowed docs + structured summaries | Per-school index; ACL filters at query time |
| **Event stream features** | E22 from catalogue events | Fresh signals (results published, overdue) | Not raw PII payloads |

**Forbidden as knowledge:** other schools’ raw data; Aadhaar hashes; payment provider secrets; health free-text unless E14 grant + explicit service allowlist; audit log full diffs (use aggregates).

---

## 4. Prompt context

Every model call builds a **Context Bundle** (structured JSON + short prose), not an unbounded chat dump.

### 4.1 Bundle layers

| Layer | Content |
|-------|---------|
| **System** | Role instructions, P8 rules, “do not invent ids”, output schema |
| **AuthZ** | Persona, school_id, permission key summary, data scopes |
| **Task** | Service ID, user question, target entity refs |
| **Structured facts** | Typed objects from tools/APIs (student summary DTO, fee snapshot, …) |
| **Retrieved chunks** | Top-k RAG hits with citations (`source_id`, title) |
| **Memory** | Allowed session/school memory snippets (§6) |
| **Output contract** | JSON schema for suggestion vs answer |

### 4.2 Grounding rules

1. Model must cite `source_ref` for numeric claims (marks, balances, %).  
2. If data missing → say unknown; **never fabricate** admission numbers or amounts.  
3. Entity references only by id returned from tools.  
4. Prompt logs store bundle **redacted** (truncate; strip emails/phones where possible).

### 4.3 Token budget

Prefer: structured facts > retrieved policy > chat history. Drop oldest memory first; never drop AuthZ layer.

---

## 5. Retrieval strategy (RAG)

```text
  Query → rewrite (optional) → embed
       → vector search (school_id filter + ACL tags)
       → optional keyword/SQL hybrid
       → rerank → top-k chunks → prompt
```

| Concern | Design |
|---------|--------|
| **Partition** | One logical collection per `school_id` (or hard filter) |
| **ACL tags** | Chunks tagged `audience=staff\|parent\|student\|admin` + optional `section_id` |
| **Hybrid** | Structured lookup by id first; RAG for docs/policies/narratives |
| **Freshness** | Re-index on `document.artifact.issued`, handbook upload, lesson_plan.shared |
| **PII** | Embed summaries (“Student S scored …”) only if service allows; prefer aggregates for Analytics AI |
| **Citations** | Return chunk ids to UI for “Why this answer?” |

**Not RAG:** live fee balance — use Fee read tool. RAG supplements unstructured text.

---

## 6. Memory

| Type | Scope | Retention | Contents |
|------|-------|-----------|----------|
| **Session memory** | User × conversation | Days / until clear | Recent turns, tool results refs |
| **User preference memory** | Person | Until cleared | Tone, locale, “prefer bullet remarks” |
| **School playbook memory** | School (admin-curated) | Until archived | “We use CBSE remark style…”, grading norms |
| **Episode memory** | Suggestion thread | With suggestion lifecycle | Why suggestion was made |
| **Forbidden long-term raw memory** | — | — | Full student dossiers, chat logs of other users |

Rules:

- Memory is **not** OLTP truth; engines remain authoritative on next read.  
- Cross-user memory sharing only via school playbook (admin).  
- Parents never inherit teacher session memory.  
- Export/delete memory with person erasure requests (except required audit of accepts).

---

## 7. Permissions

AI sits behind **E03** like any feature.

| Check | When |
|-------|------|
| `ai.suggestion.request` / service flag | Start a service |
| Data scope of tools | Same as if user queried UI (◐ section, linked children, …) |
| `ai.suggestion.accept` | Accept writes — then **re-check** target engine permission keys |
| Health / fee sensitive tools | Extra keys (`health.*`, `fee.*`) |
| Student AI | Self only; no sibling/peer PII |
| Parent AI | Linked admissions only |
| Super Admin | Platform help; school tools only with explicit school context + audit |

**Elevation ban:** E23 workers must not use service role to read all persons. Use user JWT or a **scoped** read token minted for that request’s ACL.

Deny tool results → model sees “unauthorized,” not empty inventable gaps presented as zero.

---

## 8. Tool calling

### 8.1 Pattern

Tools are **thin wrappers** over engine query/command APIs.

| Tool class | Examples | Side effect |
|------------|----------|-------------|
| **Read tools** | `get_student_summary`, `list_overdue_invoices`, `get_section_attendance_stats` | None |
| **Search tools** | `search_school_docs`, `search_lesson_plans` | None |
| **Draft tools** | `create_suggestion` | Writes `AISuggestion` only |
| **Command tools** | `submit_accepted_command` | Only after human confirm in UX (or explicit confirm flag) |

Agents may chain read tools; **command tools require human confirmation gate** in product UX for v1–v2.

### 8.2 Allowlist (examples)

| Tool | Engines | Personas |
|------|---------|----------|
| `get_my_timetable` | E10 | Tch, Stu |
| `get_child_fee_status` | E15 | Par |
| `get_section_marks_aggregate` | E11/E22 | Tch, HOD |
| `propose_lesson_plan` | E23→E10 | Tch |
| `propose_announcement_draft` | E23→E18 | Tch, Adm |
| `propose_timetable_swap` | E23→E10 | Adm, Pri |
| `narrate_dashboard` | E22 | Adm, Pri |

Unknown tool names rejected. Arguments schema-validated. Dangerous params (`school_id` override) stripped to session school.

### 8.3 Accept path

```text
ai.suggestion.proposed
  → user reviews diff / draft
  → ai.suggestion.accepted (sync)
  → command to owning engine (AuthZ as user)
  → versioning + audit + domain events
```

Reject/expiry: no OLTP change.

---

## 9. Persona experiences

### 9.1 Teacher AI

| Capability | Service | Data scope |
|------------|---------|------------|
| Lesson planning assistant | `ai.draft.lesson_plan` | Own subjects/sections + curriculum pack |
| Remark / narrative drafts | `ai.draft.report_narrative` | Own class students |
| Attendance risk for my sections | `ai.insight.attendance_risk` | ◐ sections |
| Draft parent message | `ai.draft.communication` | Must not reveal unallowed peer data |
| Timetable “what do I teach next?” | `ai.chat.assistant` | Own employment slots |

**Must not:** change marks, attendance, or fees silently; see other teachers’ private lesson notes without share.

### 9.2 Student AI

| Capability | Scope |
|------------|-------|
| “What’s my timetable / homework / exam dates?” | Self admission |
| Study tips from published materials | School library + own results summary |
| Explain published grades in plain language | Own published results only |

**Must not:** other students’ data; unpaid invoice details of siblings; staff PII; generate official certificates (E20 only).

### 9.3 Parent AI

| Capability | Scope |
|------------|-------|
| Child attendance / fee / results Q&A | Linked children |
| Draft question to class teacher | E18 draft → parent sends |
| Fee due reminders explained | Linked invoices |

**Must not:** unlinked children; school-wide analytics; staff contact spam automation without E18/E19.

### 9.4 Principal AI (and School Admin / VP)

| Capability | Scope |
|------------|-------|
| School-wide academic / fee / attendance narration | ● school (AuthZ) |
| Timetable conflict suggestions | E10 propose |
| Placement balancing hints | E06 propose |
| Announcement drafts | E18 |
| Risk lists (fee default, chronic absence) | E22 features |
| Policy Q&A | School playbooks + help docs |

**Must not:** bypass year locks / versioning; mass-mutate via agent without confirmations.

### 9.5 Analytics AI

| Capability | Source |
|------------|--------|
| NL summary of dashboards | E22 marts |
| Anomaly hints (“absence spike in 8-B”) | E22 + events |
| Cohort comparisons within school | Aggregates only |
| Optional anonymized benchmark later | Platform policy |

**Must not:** write marts or OLTP; present unverifiable precision; expose row-level PII in school-wide chat when aggregate suffices.

---

## 10. Lesson planning

| Step | Owner |
|------|-------|
| Teacher asks for plan (subject, section, period, objectives) | E23 |
| Retrieve curriculum + prior plans + timetable slot | RAG + E10/E07 tools |
| Draft `LessonPlan` suggestion (objectives, activities, resources) | E23 |
| Teacher edits & accepts | UX |
| Persist lesson plan | **E10** write |
| Optional share → notify | E18/E19 |

AI output is a **draft artifact**, not the scheduled TimetableSlot truth.

---

## 11. Report generation (AI-assisted)

Distinguish:

| Kind | Truth owner | AI role |
|------|-------------|---------|
| **Marks / grades** | E11 | Never invent; may explain published results |
| **Narrative remarks** | Teacher accepts → stored per policy (E11/E20) | Draft only |
| **Report card PDF** | **E20** render from results + template version | May draft remark fields beforehand |
| **Analytics PDF/CSV** | E21 | May narrate; generation still E21 job |

Flow for remarks:

1. Load structured results (tool)  
2. Draft remark text (service `ai.draft.report_narrative`)  
3. Teacher accepts → engine stores remark  
4. E20 issues PDF with pinned template + snapshot ([`versioning.md`](versioning.md))

---

## 12. Future AI agents

### 12.1 Evolution

| Stage | Behavior |
|-------|----------|
| **L0** | Single-shot complete (draft/insight) |
| **L1** | Tool-calling read loops + one suggestion |
| **L2** | Multi-step agent with allowlisted tools + **confirm each write** |
| **L3** | Supervised autonomy for low-risk ops (e.g. draft weekly digest) with budget caps |
| **L4** | Cross-engine workflows (rollover assistant) — still no silent OLTP; checklist + human sign-off |

### 12.2 Agent constraints

- Hard max tool calls / wall time / cost per run  
- School kill switch  
- Write tools disabled unless `agent.write_enabled` and persona allowed  
- Simulation mode: show planned commands without executing  
- All accepts → audit + `ai.suggestion.accepted`  

### 12.3 Example future agents

| Agent | Goal | Tools |
|-------|------|-------|
| Onboarding copilot | Suggest next incomplete wizard step | E25 progress read |
| Fee recovery assistant | Rank overdue; draft reminders | E15/E18 propose only |
| Timetable repair agent | Propose swaps for conflicts | E10 |
| Year rollover assistant | Checklist across engines | Reads + suggestions; humans execute |
| Safety monitor | Flag anomalous access patterns | E28 aggregates + E02 |

---

## 13. Model ops & safety

| Topic | Design |
|-------|--------|
| **Providers** | Swappable LLM APIs; school/platform keys in config |
| **Eval** | Golden questions per persona; hallucination rate on id/amount tasks |
| **PII egress** | Prefer VPC/EU-IN regions as policy; DLP filter before provider |
| **Jailbreak** | System prompt + output filter; tool allowlist beats prompt text |
| **Children** | Student AI safer defaults; no social engineering content |
| **Logging** | Prompt/response metadata in E23; redacted; retention shorter than T3 financial audit |

---

## 14. Events

| Event | When |
|-------|------|
| `ai.suggestion.proposed` | Suggestion stored |
| `ai.suggestion.accepted` | Human accept → command path |
| (future) `ai.run.completed` | Insight-only run for analytics of AI usage |
| (future) `ai.run.failed` | Safety/provider failure |

Consumers: UI, E28 audit, E22 usage metrics — **not** Fee/Enrollment writers except via accept command.

---

## 15. Anti-patterns (reject)

| Anti-pattern | Correct |
|--------------|---------|
| Chat handler `INSERT` into admissions | Suggestion → E06 command |
| Fine-tune on raw cross-tenant PII | Anonymized opt-in policy or don’t |
| Agent with service_role ORM | User-scoped tools |
| RAG over entire `persons` table | Structured tools + ACL |
| AI “fixes” ledger balances | E15 compensating entries only |
| Storing model answers as marks | E11 results only |

---

## 16. Implementation roadmap (no code now)

1. Read-only Teacher/Admin chat over Analytics + help docs.  
2. `AISuggestion` store + accept → one pilot command (e.g. announcement draft → E18).  
3. Lesson plan drafts → E10.  
4. Fee/attendance insight cards (no write).  
5. Parent/Student scoped assistants.  
6. Tool-calling agents with confirm gates.  
7. School embeddings index with ACL tags.

---

## 17. Placement rule for features

Any AI feature must state:

1. Service ID  
2. Personas + AuthZ keys  
3. Knowledge sources + tools  
4. Whether output is answer, draft, or suggestion  
5. Accept path engine (if any)  
6. Memory scope  
7. Redaction / logging policy  

If it writes ERP truth without an owning engine — **reject**.

---

## 18. Relation to other docs

| Doc | Role |
|-----|------|
| `business-engines.md` E23 / P8 | Engine boundary |
| `domain-model.md` AISuggestion | Entity |
| `system-events.md` | `ai.suggestion.*` |
| `rbac.md` | Persona × AI permissions |
| `versioning.md` | Accept cannot rewrite history |
| `audit-log.md` | Accept auditing |
| `notification-engine.md` | AI drafts may become E18 messages → E19 |
| `MASTER.md` §25 | Index |

---

## 19. Maintenance

| Change | Action |
|--------|--------|
| New AI surface | Add service row + tools + persona scope |
| New tool | Allowlist + AuthZ + engine owner |
| Provider change | Config only; keep P8 invariants |

---

*End of AI architecture.*
