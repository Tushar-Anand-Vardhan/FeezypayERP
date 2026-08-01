-- Hard DB constraints for term date validity and non-overlapping ranges.

create extension if not exists btree_gist;

alter table public.terms
  add constraint terms_end_after_start_chk
  check (end_date > start_date);

alter table public.terms
  add constraint terms_no_overlap_per_academic_year_excl
  exclude using gist (
    academic_year_id with =,
    daterange(start_date, end_date, '[]') with &&
  );
