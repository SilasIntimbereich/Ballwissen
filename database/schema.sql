-- Initial Supabase schema. Online modes stay disabled until secure server functions are deployed.
create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text not null default 'Player',created_at timestamptz not null default now());
create table if not exists public.game_results(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,tournament_year int not null,team_id text not null,mode text not null check(mode in('daily-common','daily-niche','daily-legendary','easy','hard')),score int not null check(score>=0),total int not null check(total>=score),played_at timestamptz not null default now());
create index if not exists game_results_team_time_idx on public.game_results(team_id,played_at desc);
create index if not exists game_results_user_time_idx on public.game_results(user_id,played_at desc);
alter table public.profiles enable row level security;alter table public.game_results enable row level security;
create policy "Users read own profile" on public.profiles for select using(auth.uid()=id);
create policy "Users update own profile" on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);
create policy "Users read own results" on public.game_results for select using(auth.uid()=user_id);
-- No client insert policy: result writes require a trusted server-side validator.
