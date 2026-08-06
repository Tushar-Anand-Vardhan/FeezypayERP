-- Allow free-text board values (presets + custom "Other" names).
alter table public.schools
  drop constraint if exists schools_board_check;

comment on column public.schools.board is
  'Education board affiliation. Preset values (CBSE, ICSE, State, IB) or a custom board name.';
