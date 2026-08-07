"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDepartmentResourceAction } from "@/lib/departments/resources-actions";

type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  resourceType: string;
  url: string | null;
};

type Props = {
  departments: Array<{ id: string; name: string }>;
  selectedDepartmentId: string | null;
  resources: ResourceRow[];
  canCreate: boolean;
};

export function TeacherResourcesClient({
  departments,
  selectedDepartmentId,
  resources,
  canCreate,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {departments.length > 0 ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Department</span>
          <select
            className="max-w-sm rounded-lg border border-border bg-background px-3 py-2"
            value={selectedDepartmentId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              router.push(
                v
                  ? `/dashboard/teacher/resources?department=${v}`
                  : "/dashboard/teacher/resources",
              );
            }}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-muted">No departments available.</p>
      )}

      {canCreate && selectedDepartmentId ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await createDepartmentResourceAction({
                departmentId: selectedDepartmentId,
                title,
                url,
                resourceType: "link",
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage(result.message);
              setTitle("");
              setUrl("");
              router.refresh();
            });
          }}
        >
          <h2 className="text-sm font-semibold">Add link resource</h2>
          <input
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={pending}
            className="w-fit rounded-md bg-feezy-indigo px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add resource
          </button>
        </form>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border">
        {resources.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No resources yet.</li>
        ) : (
          resources.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <span className="font-medium">{r.title}</span>
              <span className="text-muted">
                {" "}
                · {r.resourceType}
                {r.url ? (
                  <>
                    {" · "}
                    <a
                      href={r.url}
                      className="text-feezy-indigo hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      open
                    </a>
                  </>
                ) : null}
              </span>
              {r.description ? (
                <p className="mt-1 text-muted">{r.description}</p>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {message ? <p className="text-sm text-feezy-indigo">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
