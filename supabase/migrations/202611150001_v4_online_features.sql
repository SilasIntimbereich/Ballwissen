create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Player',
 created_at timestamptz not null default now()
);

create table if not exists public.arcade_teams (
 id text primary key, tournament_year int not null, team_name text not null,
 team_difficulty text check(team_difficulty in ('common','niche','legendary')),
 source_url text, verified boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.arcade_team_answers (
 team_id text primary key references public.arcade_teams(id) on delete cascade,
 roster jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.daily_challenges (
 id uuid primary key default gen_random_uuid(), challenge_date date not null,
 mode text not null check(mode in ('daily-common','daily-niche','daily-legendary')),
 sequence smallint not null check(sequence between 1 and 3),
 team_id text not null references public.arcade_teams(id),
 unique(challenge_date,mode,sequence)
);
create table if not exists public.daily_attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 challenge_date date not null, mode text not null check(mode in ('daily-common','daily-niche','daily-legendary')),
 score int not null default 0 check(score>=0), total int not null default 0 check(total>=score),
 completed_teams smallint not null default 0 check(completed_teams between 0 and 3),
 started_at timestamptz not null default now(), current_team_started_at timestamptz not null default now(), finished_at timestamptz,
 unique(user_id,challenge_date,mode)
);
create table if not exists public.daily_attempt_teams (
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.daily_attempts(id) on delete cascade,
 sequence smallint not null check(sequence between 1 and 3), team_id text not null references public.arcade_teams(id),
 score int not null default 0 check(score>=0), total int not null check(total>=0),
 found_player_ids text[] not null default '{}', unique(attempt_id,sequence)
);
create table if not exists public.normal_game_results (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 team_id text not null references public.arcade_teams(id), score int not null check(score>=0),
 total int not null check(total>=score), played_at timestamptz not null default now()
);
create index if not exists daily_attempts_rank_idx on public.daily_attempts(mode,challenge_date desc,score desc);
create index if not exists normal_results_team_idx on public.normal_game_results(team_id,played_at desc);
create index if not exists arcade_teams_year_idx on public.arcade_teams(tournament_year,team_name);

alter table public.arcade_teams enable row level security;
alter table public.arcade_team_answers enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.daily_attempts enable row level security;
alter table public.daily_attempt_teams enable row level security;
alter table public.normal_game_results enable row level security;
drop policy if exists "Public read team metadata" on public.arcade_teams;
create policy "Public read team metadata" on public.arcade_teams for select using (true);
-- Deliberately no policies on arcade_team_answers: only service_role may read answer rosters.
drop policy if exists "Public read daily schedule" on public.daily_challenges;
create policy "Public read daily schedule" on public.daily_challenges for select using (true);
drop policy if exists "Users read own daily attempts" on public.daily_attempts;
create policy "Users read own daily attempts" on public.daily_attempts for select using (auth.uid()=user_id);
drop policy if exists "Users read own daily team attempts" on public.daily_attempt_teams;
create policy "Users read own daily team attempts" on public.daily_attempt_teams for select using (exists(select 1 from public.daily_attempts a where a.id=attempt_id and a.user_id=auth.uid()));

create or replace function public.team_score_distribution(p_team_id text)
returns table(score_bucket text, player_count bigint, percentage numeric)
language sql stable security definer set search_path=public
as $$
 with bucketed as (
  select case when total=0 then '0%' else (floor((score::numeric/total)*10)*10)::int::text||'–'||least(100,(floor((score::numeric/total)*10)*10+10))::int::text||'%' end bucket,count(*)::bigint n
  from normal_game_results where team_id=p_team_id group by 1
 )
 select bucket,n,round(100.0*n/nullif(sum(n) over(),0),1) from bucketed order by bucket;
$$;
create or replace function public.daily_common_leaderboard()
returns table(rank bigint, display_name text, points bigint)
language sql stable security definer set search_path=public
as $$
 with sums as (
  select user_id,sum(score)::bigint points from daily_attempts
  where mode='daily-common' and challenge_date between current_date-6 and current_date and finished_at is not null
  group by user_id
 )
 select row_number() over(order by s.points desc),coalesce(p.display_name,'Player'),s.points
 from sums s left join profiles p on p.id=s.user_id order by s.points desc limit 10;
$$;
revoke all on function public.team_score_distribution(text) from public;
grant execute on function public.team_score_distribution(text) to anon,authenticated;
revoke all on function public.daily_common_leaderboard() from public;
grant execute on function public.daily_common_leaderboard() to anon,authenticated;

-- Answer rosters remain private to service-role Edge Functions. Do not grant anon/authenticated
-- direct access to arcade_teams.roster or daily challenge write operations.


-- Automatically create the anonymous user's public profile row.
create or replace function public.handle_new_arcade_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 insert into public.profiles(id,display_name) values(new.id,'Player-'||substr(new.id::text,1,4))
 on conflict(id) do nothing;
 return new;
end;
$$;
drop trigger if exists on_arcade_user_created on auth.users;
create trigger on_arcade_user_created after insert on auth.users
for each row execute procedure public.handle_new_arcade_user();

-- Select three deterministic, shared teams per daily difficulty. A tier must be curated first.
create or replace function public.publish_daily_challenges(p_date date default current_date)
returns void language plpgsql security definer set search_path=public
as $$
declare tier text; mode_name text; selected_count int;
begin
 for tier,mode_name in
  select * from (values
   ('common','daily-common'),('niche','daily-niche'),('legendary','daily-legendary')
  ) as tiers(team_tier,daily_mode)
 loop
  select count(*) into selected_count from public.arcade_teams
   where team_difficulty=tier and verified=true;
  if selected_count<3 then
   raise exception 'Need at least three verified teams tagged % before publishing %',tier,mode_name;
  end if;
  insert into public.daily_challenges(challenge_date,mode,sequence,team_id)
  select p_date,mode_name,row_number() over(order by md5(id||p_date::text))::smallint,id
  from public.arcade_teams where team_difficulty=tier and verified=true
  order by md5(id||p_date::text) limit 3
  on conflict(challenge_date,mode,sequence) do nothing;
 end loop;
end;
$$;
revoke all on function public.publish_daily_challenges(date) from public;
grant execute on function public.publish_daily_challenges(date) to service_role;


create or replace function public.team_percentile(p_team_id text,p_score int,p_total int)
returns numeric language sql stable security definer set search_path=public
as $$
 select coalesce(round(100.0*count(*) filter (
   where case when total=0 then 0 else score::numeric/total end <
         case when p_total=0 then 0 else p_score::numeric/p_total end
 )/nullif(count(*),0),1),0)
 from public.normal_game_results where team_id=p_team_id;
$$;
revoke all on function public.team_percentile(text,int,int) from public;
grant execute on function public.team_percentile(text,int,int) to anon,authenticated;


create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Player',
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select using(auth.uid()=id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);

create table if not exists public.normal_game_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 team_id text not null references public.arcade_teams(id),
 started_at timestamptz not null default now(),
 finished_at timestamptz
);
create table if not exists public.normal_game_session_guesses (
 session_id uuid not null references public.normal_game_sessions(id) on delete cascade,
 player_id text not null,
 guessed_at timestamptz not null default now(),
 primary key(session_id,player_id)
);
alter table public.normal_game_sessions enable row level security;
alter table public.normal_game_session_guesses enable row level security;
alter table public.normal_game_session_guesses enable row level security;
drop policy if exists "Users read own normal sessions" on public.normal_game_sessions;
create policy "Users read own normal sessions" on public.normal_game_sessions for select using(auth.uid()=user_id);
