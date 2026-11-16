-- Enforce the curated 50-squad Daily exclusion list inside PostgreSQL.
-- This table intentionally has no FK: migrations run before roster data is synced.
create table if not exists public.daily_excluded_squads (
  team_id text primary key,
  team_name text not null,
  tournament_year integer not null,
  created_at timestamptz not null default now()
);
alter table public.daily_excluded_squads enable row level security;

insert into public.daily_excluded_squads(team_id,team_name,tournament_year) values
  ('china-2002','China',2002),
  ('togo-2006','Togo',2006),
  ('angola-2006','Angola',2006),
  ('trinidad-and-tobago-2006','Trinidad and Tobago',2006),
  ('north-korea-2010','North Korea',2010),
  ('slovenia-2002','Slovenia',2002),
  ('slovenia-2010','Slovenia',2010),
  ('slovakia-2010','Slovakia',2010),
  ('honduras-2010','Honduras',2010),
  ('honduras-2014','Honduras',2014),
  ('panama-2018','Panama',2018),
  ('saudi-arabia-2002','Saudi Arabia',2002),
  ('saudi-arabia-2006','Saudi Arabia',2006),
  ('saudi-arabia-2018','Saudi Arabia',2018),
  ('saudi-arabia-2022','Saudi Arabia',2022),
  ('tunisia-2002','Tunisia',2002),
  ('tunisia-2006','Tunisia',2006),
  ('tunisia-2018','Tunisia',2018),
  ('tunisia-2022','Tunisia',2022),
  ('iran-2006','Iran',2006),
  ('iran-2014','Iran',2014),
  ('iran-2018','Iran',2018),
  ('iran-2022','Iran',2022),
  ('ecuador-2002','Ecuador',2002),
  ('ecuador-2006','Ecuador',2006),
  ('ecuador-2014','Ecuador',2014),
  ('ecuador-2022','Ecuador',2022),
  ('costa-rica-2002','Costa Rica',2002),
  ('costa-rica-2006','Costa Rica',2006),
  ('costa-rica-2014','Costa Rica',2014),
  ('costa-rica-2018','Costa Rica',2018),
  ('costa-rica-2022','Costa Rica',2022),
  ('cameroon-2002','Cameroon',2002),
  ('cameroon-2010','Cameroon',2010),
  ('cameroon-2014','Cameroon',2014),
  ('cameroon-2022','Cameroon',2022),
  ('ghana-2006','Ghana',2006),
  ('ghana-2010','Ghana',2010),
  ('ghana-2014','Ghana',2014),
  ('ghana-2022','Ghana',2022),
  ('ivory-coast-2006','Ivory Coast',2006),
  ('ivory-coast-2010','Ivory Coast',2010),
  ('ivory-coast-2014','Ivory Coast',2014),
  ('algeria-2010','Algeria',2010),
  ('algeria-2014','Algeria',2014),
  ('new-zealand-2010','New Zealand',2010),
  ('qatar-2022','Qatar',2022),
  ('serbia-and-montenegro-2006','Serbia and Montenegro',2006),
  ('south-africa-2002','South Africa',2002),
  ('south-africa-2010','South Africa',2010)
on conflict(team_id) do update
set team_name=excluded.team_name,tournament_year=excluded.tournament_year;

-- Remove whole Daily sets if an old schedule contains an excluded squad or repeats a team.
delete from public.daily_challenges d
where exists (
  select 1
  from public.daily_challenges bad
  join public.daily_excluded_squads x on x.team_id=bad.team_id
  where bad.challenge_date=d.challenge_date and bad.mode=d.mode
);
delete from public.daily_challenges d
where exists (
  select 1
  from public.daily_challenges a
  join public.daily_challenges b
    on b.challenge_date=a.challenge_date
   and b.mode=a.mode
   and b.team_id=a.team_id
   and b.sequence<>a.sequence
  where a.challenge_date=d.challenge_date and a.mode=d.mode
);
create unique index if not exists daily_challenges_date_mode_team_unique_idx
on public.daily_challenges(challenge_date,mode,team_id);

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
  select count(*) into selected_count
  from public.arcade_teams t
  where t.team_difficulty=tier and t.verified=true
    and not exists (
      select 1 from public.daily_excluded_squads x where x.team_id=t.id
    );
  if selected_count<3 then
   raise exception 'Need at least three verified, non-excluded teams tagged % before publishing %',tier,mode_name;
  end if;
  insert into public.daily_challenges(challenge_date,mode,sequence,team_id)
  select p_date,mode_name,row_number() over(order by md5(t.id||p_date::text))::smallint,t.id
  from public.arcade_teams t
  where t.team_difficulty=tier and t.verified=true
    and not exists (
      select 1 from public.daily_excluded_squads x where x.team_id=t.id
    )
  order by md5(t.id||p_date::text) limit 3
  on conflict(challenge_date,mode,sequence) do nothing;
 end loop;
end;
$$;
revoke all on function public.publish_daily_challenges(date) from public;
grant execute on function public.publish_daily_challenges(date) to service_role;


-- Defense in depth: even a future publisher or manual insert cannot schedule an excluded squad.
create or replace function public.reject_excluded_daily_squad()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if exists (select 1 from public.daily_excluded_squads x where x.team_id=new.team_id) then
    raise exception 'Daily challenge cannot include excluded squad %', new.team_id;
  end if;
  if not exists (select 1 from public.arcade_teams t where t.id=new.team_id and t.verified=true) then
    raise exception 'Daily challenge requires verified squad %', new.team_id;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_daily_squad_exclusions on public.daily_challenges;
create trigger enforce_daily_squad_exclusions
before insert or update of team_id on public.daily_challenges
for each row execute function public.reject_excluded_daily_squad();
revoke all on function public.reject_excluded_daily_squad() from public, anon, authenticated;

-- Only the privileged publisher and service-role backend can inspect the exclusion table.
revoke all on public.daily_excluded_squads from anon, authenticated;
