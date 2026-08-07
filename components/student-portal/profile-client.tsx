type Props = {
  personal: {
    fullName: string;
    email: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    gender: string | null;
  } | null;
  admission: {
    admissionNumber: string;
    status: string;
    admittedOn: string;
  } | null;
  house: string | null;
  clubs: string[];
  parents: string[];
};

export function StudentProfileClient({
  personal,
  admission,
  house,
  clubs,
  parents,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Read-only profile. Self-edit is not enabled in this portal version.
      </p>
      <dl className="grid gap-3 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Name</dt>
          <dd className="font-medium">{personal?.fullName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Email</dt>
          <dd>{personal?.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Phone</dt>
          <dd>{personal?.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Date of birth</dt>
          <dd>{personal?.dateOfBirth ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Gender</dt>
          <dd>{personal?.gender ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Admission #</dt>
          <dd>{admission?.admissionNumber ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Admission status</dt>
          <dd>{admission?.status ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Admitted on</dt>
          <dd>{admission?.admittedOn ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">House</dt>
          <dd>{house ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted">Clubs</dt>
          <dd>{clubs.length ? clubs.join(", ") : "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted">Parents / guardians</dt>
          <dd>{parents.length ? parents.join(", ") : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
