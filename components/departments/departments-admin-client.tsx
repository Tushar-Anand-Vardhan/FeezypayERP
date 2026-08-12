"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveDepartmentAction,
  createDepartmentAction,
} from "@/lib/departments/departments-actions";

type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parent_department_id: string | null;
  cost_center_code: string | null;
};

type Props = {
  departments: DepartmentRow[];
  canEdit: boolean;
};

export function DepartmentsAdminClient({ departments, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [costCenter, setCostCenter] = useState("");

  const byId = new Map(departments.map((d) => [d.id, d]));

  function run(
    action: () => Promise<{
      success: boolean;
      error?: string;
      message?: string;
    }>,
  ) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setMessage(result.message ?? "Saved.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {message ? (
        <p className="rounded-xl border border-feezy-indigo/20 bg-feezy-indigo/5 px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Departments</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {departments.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">
              No departments yet.
            </li>
          ) : (
            departments.map((d) => {
              const parent = d.parent_department_id
                ? byId.get(d.parent_department_id)
                : null;
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {d.name}
                      {d.code ? (
                        <span className="ml-2 text-xs text-muted">{d.code}</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {parent ? `Under ${parent.name}` : "Top-level"}
                      {d.cost_center_code
                        ? ` · Cost centre ${d.cost_center_code}`
                        : ""}
                      {d.description ? ` · ${d.description}` : ""}
                    </div>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-muted hover:text-foreground"
                      onClick={() =>
                        run(() => archiveDepartmentAction(d.id))
                      }
                    >
                      Archive
                    </button>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>

      {canEdit ? (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Add department</h2>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() =>
                createDepartmentAction({
                  name,
                  code: code || undefined,
                  description: description || undefined,
                  parentDepartmentId: parentId || null,
                  costCenterCode: costCenter || null,
                }),
              );
              setName("");
              setCode("");
              setDescription("");
              setParentId("");
              setCostCenter("");
            }}
          >
            <Field label="Name" value={name} onChange={setName} />
            <Field
              label="Code"
              value={code}
              onChange={setCode}
              required={false}
            />
            <Field
              label="Description"
              value={description}
              onChange={setDescription}
              required={false}
            />
            <Field
              label="Cost centre"
              value={costCenter}
              onChange={setCostCenter}
              required={false}
            />
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Parent
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Create department"}
            </button>
          </form>
        </section>
      ) : (
        <p className="text-sm text-muted">
          You can view departments. Ask an admin for department edit access to
          add or archive.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      />
    </label>
  );
}
