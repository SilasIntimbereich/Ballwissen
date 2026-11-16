-- Publish each Daily difficulty independently. Common and Niche can run while Legendary
-- is still awaiting three independently audited, non-excluded squads.
create or replace function public.publish_daily_challenges(p_date date default current_date)
returns void language plpgsql security definer set search_path=public
as $$
declare
  tier text;
  mode_name text;
  selected_count integer;
begin
  for tier,mode_name in
    select * from (values
      ('common','daily-common'),
      ('niche','daily-niche'),
      ('legendary','daily-legendary')
    ) as tiers(team_tier,daily_mode)
  loop
    select count(*) into selected_count
    from public.arcade_teams t
    where t.team_difficulty=tier and t.verified=true
      and not exists(select 1 from public.daily_excluded_squads x where x.team_id=t.id);

    if selected_count<3 then
      raise notice 'Skipping %: only % verified non-excluded squads are available.',mode_name,selected_count;
      continue;
    end if;

    insert into public.daily_challenges(challenge_date,mode,sequence,team_id)
    select p_date,mode_name,row_number() over(order by md5(t.id||p_date::text))::smallint,t.id
    from public.arcade_teams t
    where t.team_difficulty=tier and t.verified=true
      and not exists(select 1 from public.daily_excluded_squads x where x.team_id=t.id)
    order by md5(t.id||p_date::text)
    limit 3
    on conflict(challenge_date,mode,sequence) do nothing;
  end loop;
end;
$$;
revoke all on function public.publish_daily_challenges(date) from public;
grant execute on function public.publish_daily_challenges(date) to service_role;
