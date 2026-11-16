-- Include rarity on missed Daily players so every reveal uses the same player-level category.
create or replace function public.complete_daily_team(
  p_attempt_id uuid,
  p_user_id uuid,
  p_sequence smallint,
  p_give_up boolean
)
returns table(
  score integer,
  total integer,
  combined_score integer,
  combined_total integer,
  finished boolean,
  next_sequence integer,
  missed_players jsonb
)
language plpgsql security definer set search_path=public
as $$
declare
  v_attempt public.daily_attempts%rowtype;
  v_team_id text;
  v_roster jsonb;
  v_team_score integer;
  v_team_total integer;
  v_found text[];
  v_missed jsonb;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_attempt
  from public.daily_attempts
  where id=p_attempt_id and user_id=p_user_id
  for update;

  if not found or v_attempt.finished_at is not null then
    raise exception 'Daily attempt unavailable';
  end if;
  if p_sequence <> v_attempt.completed_teams + 1 then
    raise exception 'Daily sequence mismatch';
  end if;
  if v_now < v_attempt.current_team_started_at then
    raise exception 'Invalid Daily timer';
  end if;
  if not p_give_up and v_now-v_attempt.current_team_started_at < interval '120 seconds' then
    raise exception 'Daily timer has not ended';
  end if;

  select team_id into v_team_id
  from public.daily_challenges
  where challenge_date=v_attempt.challenge_date and mode=v_attempt.mode and sequence=p_sequence;
  if v_team_id is null then raise exception 'Daily challenge team unavailable'; end if;
  if exists(select 1 from public.daily_excluded_squads x where x.team_id=v_team_id) then
    raise exception 'Excluded Daily squad';
  end if;
  if not exists(select 1 from public.arcade_teams t where t.id=v_team_id and t.verified=true) then
    raise exception 'Daily squad is not verified';
  end if;

  select roster into v_roster from public.arcade_team_answers where team_id=v_team_id;
  if v_roster is null then raise exception 'Daily answer roster unavailable'; end if;

  select dat.score,dat.found_player_ids into v_team_score,v_found
  from public.daily_attempt_teams dat
  where dat.attempt_id=p_attempt_id and dat.sequence=p_sequence;
  v_team_score:=coalesce(v_team_score,0);
  v_found:=coalesce(v_found,'{}'::text[]);
  v_team_total:=jsonb_array_length(v_roster);

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',p.value->>'id',
      'name',p.value->>'name',
      'position',coalesce(p.value->>'position',''),
      'club',coalesce(p.value->>'club',''),
      'rarity',coalesce(p.value->>'rarity','Ball Knowledge')
    ) order by p.ordinality),
    '[]'::jsonb
  ) into v_missed
  from jsonb_array_elements(v_roster) with ordinality as p(value,ordinality)
  where not (coalesce(p.value->>'id','')=any(v_found));

  update public.daily_attempts
  set score=v_attempt.score+v_team_score,
      total=v_attempt.total+v_team_total,
      completed_teams=p_sequence,
      current_team_started_at=v_now,
      finished_at=case when p_sequence=3 then v_now else null end
  where id=p_attempt_id;

  return query select v_team_score,v_team_total,v_attempt.score+v_team_score,
    v_attempt.total+v_team_total,p_sequence=3,
    case when p_sequence=3 then null else p_sequence+1 end,v_missed;
end;
$$;
revoke all on function public.complete_daily_team(uuid,uuid,smallint,boolean) from public,anon,authenticated;
grant execute on function public.complete_daily_team(uuid,uuid,smallint,boolean) to service_role;
