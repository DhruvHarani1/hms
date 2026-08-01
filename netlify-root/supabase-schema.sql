-- ═══════════════════════════════════════════════════════════════════════════
-- AIG Engineering Pulse — Supabase schema (matches netlify/functions/db.js)
-- Run once in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists submissions (
  id         bigint generated always as identity primary key,
  form_id    text  not null,          -- 'leave', 'reimbursement', 'attendance', ...
  excel_row  int   not null,          -- row number in the Excel file (row 2 = first data row)
  ref        text,                    -- 'LR-2026-123' (first cell of the row)
  vals       jsonb not null,          -- the full row, exact same order as Excel columns
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, excel_row)         -- upsert key used by db.js (on_conflict)
);

create index if not exists idx_sub_form on submissions (form_id, excel_row);
create index if not exists idx_sub_ref  on submissions (ref);

create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch on submissions;
create trigger trg_touch before update on submissions
  for each row execute function touch_updated_at();

-- RLS on with no public policies: the anon key can do NOTHING.
-- The portal only reaches this table via the Netlify function using the
-- service_role key, which bypasses RLS. Safe default.
alter table submissions enable row level security;

-- Sanity check after running:  select count(*) from submissions;
