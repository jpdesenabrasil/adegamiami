
-- ADEGA MIAMI — BANCO SUPABASE
-- Cole este SQL no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'employee' check (role in ('owner','cashier','employee')),
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  client_name text not null,
  client_phone text,
  items text not null,
  value numeric(12,2) not null default 0,
  payment_method text check (payment_method in ('pix','cash','credit','debit')),
  payment_status text not null default 'paid' check (payment_status in ('paid','unpaid')),
  status text not null default 'pending' check (status in ('pending','preparing','delivered')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text,
  value numeric(12,2) not null default 0,
  due_date date not null,
  paid boolean not null default false,
  recurring boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_created_at on orders(created_at);
create index if not exists idx_orders_payment_status on orders(payment_status);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_expenses_due_date on expenses(due_date);

alter table profiles enable row level security;
alter table clients enable row level security;
alter table orders enable row level security;
alter table expenses enable row level security;

-- Helper: role do usuário atual
create or replace function public.current_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- DONO: acesso total
create policy "owner all profiles" on profiles
for all using (public.current_role()='owner')
with check (public.current_role()='owner');

create policy "owner all clients" on clients
for all using (public.current_role()='owner')
with check (public.current_role()='owner');

create policy "owner all orders" on orders
for all using (public.current_role()='owner')
with check (public.current_role()='owner');

create policy "owner all expenses" on expenses
for all using (public.current_role()='owner')
with check (public.current_role()='owner');

-- CAIXA: clientes + pedidos
create policy "cashier clients" on clients
for all using (public.current_role()='cashier')
with check (public.current_role()='cashier');

create policy "cashier orders" on orders
for all using (public.current_role()='cashier')
with check (public.current_role()='cashier');

-- FUNCIONÁRIO: somente pedidos
create policy "employee read orders" on orders
for select using (public.current_role()='employee');

create policy "employee insert orders" on orders
for insert with check (public.current_role()='employee');

create policy "employee update orders" on orders
for update using (public.current_role()='employee')
with check (public.current_role()='employee');

-- IMPORTANTE:
-- Depois de criar seu primeiro usuário em Authentication > Users,
-- rode algo assim trocando pelo UUID dele:
-- insert into profiles (id, name, role)
-- values ('UUID_DO_USUARIO', 'Administrador', 'owner');


-- Saídas manuais do caixa
create table if not exists outflows (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  value numeric(12,2) not null default 0,
  method text check (method in ('pix','cash','credit','debit','other')),
  date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_outflows_date on outflows(date);
alter table outflows enable row level security;

create policy "owner all outflows" on outflows
for all using (public.current_role()='owner')
with check (public.current_role()='owner');

create policy "cashier all outflows" on outflows
for all using (public.current_role()='cashier')
with check (public.current_role()='cashier');


alter table orders add column if not exists business_date date;
alter table orders add column if not exists paid_date date;
