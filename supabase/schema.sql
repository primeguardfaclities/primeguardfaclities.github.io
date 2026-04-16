create table if not exists public.users (
  employee_id text primary key,
  full_name text not null,
  designation text not null,
  location text not null,
  username text not null unique,
  password text not null,
  role text not null check (role in ('employee', 'guard', 'manager'))
);

create table if not exists public.attendance (
  employee_id text not null references public.users(employee_id) on delete cascade,
  date date not null,
  full_name text not null,
  designation text not null,
  location text not null,
  check_in text default '',
  check_out text default '',
  primary key (employee_id, date)
);

create index if not exists attendance_location_idx on public.attendance(location);
create index if not exists attendance_full_name_idx on public.attendance(full_name);
create index if not exists users_location_idx on public.users(location);

insert into public.users (employee_id, full_name, designation, location, username, password, role)
values
  ('100001', 'Employee', 'Security Guard', 'Rohtak', 'employee', 'PrimeEmployee@2026', 'employee'),
  ('100002', 'Guard 1', 'Security Guard', 'New Delhi', 'guard1', 'Guard@2026', 'guard'),
  ('100003', 'Rohtak Manager', 'Manager', 'Rohtak', 'manager', 'Manager@2026', 'manager'),
  ('100004', 'New Delhi Manager', 'Manager', 'New Delhi', 'manager-delhi', 'ManagerDelhi@2026', 'manager'),
  ('100005', 'Zirakpur Manager', 'Manager', 'Zirakpur', 'manager-zirakpur', 'ManagerZirakpur@2026', 'manager')
on conflict (employee_id) do nothing;
