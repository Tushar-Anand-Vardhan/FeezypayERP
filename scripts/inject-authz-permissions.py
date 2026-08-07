#!/usr/bin/env python3
"""Inject permission keys into getAuthenticatedSchoolContext() call sites."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "lib"

# Directory / filename → default permission
DIR_DEFAULTS: list[tuple[str, str]] = [
    ("lib/attendance/query", "attendance.record.read"),
    ("lib/attendance/records", "attendance.record.create"),
    ("lib/attendance/session", "attendance.session.approve"),
    ("lib/attendance/leave", "attendance.leave.decide"),
    ("lib/assessment/results-query", "assessment.results.read"),
    ("lib/assessment/results-actions", "assessment.results.enter"),
    ("lib/assessment/mark-session", "assessment.results.publish"),
    ("lib/assessment/teacher-assessments", "assessment.results.enter"),
    ("lib/assessment/exam-", "assessment.config.edit"),
    ("lib/assessment/policies", "assessment.config.edit"),
    ("lib/assessment/schedules", "assessment.config.edit"),
    ("lib/assessment/components", "assessment.config.edit"),
    ("lib/assessment/categories", "assessment.config.edit"),
    ("lib/assessment/exam-types", "assessment.config.edit"),
    ("lib/homework/query", "homework.read"),
    ("lib/homework/submission", "homework.grade"),
    ("lib/homework/homework", "homework.assign"),
    ("lib/behaviour/query", "conduct.incident.read"),
    ("lib/behaviour/remarks", "conduct.incident.record"),
    ("lib/behaviour/follow-up", "conduct.incident.approve"),
    ("lib/events/query", "engagement.event.read"),
    ("lib/events/activity", "engagement.event.create"),
    ("lib/events/staff", "engagement.event.create"),
    ("lib/events/participants", "engagement.event.create"),
    ("lib/events/certificate", "engagement.event.create"),
    ("lib/report-cards/issue-query", "document.report_card.read"),
    ("lib/report-cards/issue-actions", "document.report_card.issue"),
    ("lib/report-cards/", "document.template.edit"),
    ("lib/communications/message", "communication.message.publish"),
    ("lib/communications/query", "communication.message.read"),
    ("lib/communications/", "communication.config.edit"),
    ("lib/notifications/", "communication.message.read"),
    ("lib/calendar/events", "calendar.event.create"),
    ("lib/calendar/", "calendar.year.edit"),
    ("lib/departments/", "workforce.department.edit"),
    ("lib/houses-clubs/", "config.catalog.edit"),
    ("lib/subjects/", "config.catalog.edit"),
    ("lib/timetable/", "timetable.grid.edit"),
    ("lib/policies/", "config.catalog.edit"),
    ("lib/config/", "config.catalog.edit"),
    ("lib/config-dashboard/", "config.catalog.read"),
    ("lib/editing/", "config.catalog.edit"),
    ("lib/teacher-workspace/", "workforce.workspace.read"),
    ("lib/principal-dashboard/", "analytics.dashboard.read"),
    ("lib/student-analytics/", "analytics.dashboard.read"),
    ("lib/teacher-analytics/", "analytics.dashboard.read"),
    ("lib/student-profile/", "enrollment.admission.read"),
    ("lib/onboarding/", "onboarding.wizard.edit"),
    ("lib/auth/invites", "access.invite.create"),
]


def permission_for(path: Path) -> str:
    rel = str(path.relative_to(ROOT.parent)).replace("\\", "/")
    name = path.name
    if "query" in name:
        # Prefer read variants when mapped
        for prefix, key in DIR_DEFAULTS:
            if prefix in rel and key.endswith(".read"):
                return key
            if prefix in rel and ".read" in key:
                return key
    for prefix, key in DIR_DEFAULTS:
        if prefix in rel:
            return key
    return "tenant.school.read"


def transform(content: str, key: str) -> str:
    # Only replace bare calls with no args
    pattern = re.compile(r"getAuthenticatedSchoolContext\(\s*\)")
    if not pattern.search(content):
        return content
    return pattern.sub(f'getAuthenticatedSchoolContext("{key}")', content)


def main() -> None:
    changed = 0
    for path in ROOT.rglob("*-actions.ts"):
        text = path.read_text()
        key = permission_for(path)
        new = transform(text, key)
        if new != text:
            path.write_text(new)
            changed += 1
            print(f"{path.relative_to(ROOT.parent)} -> {key}")
    print(f"updated {changed} files")


if __name__ == "__main__":
    main()
