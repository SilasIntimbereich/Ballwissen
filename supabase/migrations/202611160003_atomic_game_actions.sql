-- Serialize scored guesses and completion operations to prevent races and duplicate submissions.
-- Score distributions represent unique players per squad, not repeated attempts.
with ranked_results as (
  select id,row_number() over(partition by user_id,team_id order by played_at desc,id desc) as rn
  from public.normal_game_results
  where user_id is not null
)
delete from public.normal_game_results r
using ranked_results x
where r.id=x.id and x.rn>1;
create unique index if not exists normal_results_user_team_unique_idx
on public.normal_game_results(user_id,team_id)
where user_id is not null;

create or replace function public.record_daily_player_guess(
  p_attempt_id uuid,
  p_user_id uuid,
  p_sequence smallint,
  p_team_id text,
  p_player_id text
)
returns table(is_correct boolean, is_duplicate boolean, score integer, total integer)
language plpgsql security definer set search_path=public
as $$
declare
  v_attempt public.daily_attempts%rowtype;
  v_challenge_team text;
  v_roster jsonb;
  v_found text[];
  v_total integer;
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
  if clock_timestamp() < v_attempt.current_team_started_at
     or clock_timestamp() - v_attempt.current_team_started_at > interval '120 seconds' then
    raise exception 'Daily timer expired';
  end if;

  select team_id into v_challenge_team
  from public.daily_challenges
  where challenge_date=v_attempt.challenge_date
    and mode=v_attempt.mode
    and sequence=p_sequence;
  if v_challenge_team is distinct from p_team_id then
    raise exception 'Daily challenge team mismatch';
  end if;
  if exists (select 1 from public.daily_excluded_squads x where x.team_id=p_team_id) then
    raise exception 'Excluded Daily squad';
  end if;
  if not exists (select 1 from public.arcade_teams t where t.id=p_team_id and t.verified=true) then
    raise exception 'Daily squad is not verified';
  end if;

  select roster into v_roster
  from public.arcade_team_answers
  where team_id=p_team_id;
  if v_roster is null then
    raise exception 'Daily answer roster unavailable';
  end if;
  v_total := jsonb_array_length(v_roster);
  if not exists (
    select 1 from jsonb_array_elements(v_roster) as p(value)
    where p.value->>'id'=p_player_id
  ) then
    raise exception 'Player does not belong to this squad';
  end if;

  select found_player_ids into v_found
  from public.daily_attempt_teams
  where attempt_id=p_attempt_id and sequence=p_sequence;
  v_found := coalesce(v_found,'{}'::text[]);

  if p_player_id=any(v_found) then
    return query select false,true,cardinality(v_found),v_total;
    return;
  end if;

  v_found := array_append(v_found,p_player_id);
  insert into public.daily_attempt_teams(attempt_id,sequence,team_id,score,total,found_player_ids)
  values(p_attempt_id,p_sequence,p_team_id,cardinality(v_found),v_total,v_found)
  on conflict(attempt_id,sequence) do update
    set team_id=excluded.team_id,
        score=excluded.score,
        total=excluded.total,
        found_player_ids=excluded.found_player_ids;

  return query select true,false,cardinality(v_found),v_total;
end;
$$;

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
  if not p_give_up and v_now - v_attempt.current_team_started_at < interval '120 seconds' then
    raise exception 'Daily timer has not ended';
  end if;

  select team_id into v_team_id
  from public.daily_challenges
  where challenge_date=v_attempt.challenge_date
    and mode=v_attempt.mode
    and sequence=p_sequence;
  if v_team_id is null then
    raise exception 'Daily challenge team unavailable';
  end if;
  if exists (select 1 from public.daily_excluded_squads x where x.team_id=v_team_id) then
    raise exception 'Excluded Daily squad';
  end if;
  if not exists (select 1 from public.arcade_teams t where t.id=v_team_id and t.verified=true) then
    raise exception 'Daily squad is not verified';
  end if;

  select roster into v_roster
  from public.arcade_team_answers
  where team_id=v_team_id;
  if v_roster is null then
    raise exception 'Daily answer roster unavailable';
  end if;

  select dat.score,dat.found_player_ids into v_team_score,v_found
  from public.daily_attempt_teams dat
  where dat.attempt_id=p_attempt_id and dat.sequence=p_sequence;
  v_team_score := coalesce(v_team_score,0);
  v_found := coalesce(v_found,'{}'::text[]);
  v_team_total := jsonb_array_length(v_roster);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name',p.value->>'name',
        'position',coalesce(p.value->>'position',''),
        'club',coalesce(p.value->>'club','')
      ) order by p.ordinality
    ),
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

  return query select
    v_team_score,
    v_team_total,
    v_attempt.score+v_team_score,
    v_attempt.total+v_team_total,
    p_sequence=3,
    case when p_sequence=3 then null else p_sequence+1 end,
    v_missed;
end;
$$;

create or replace function public.record_normal_player_guess(
  p_session_id uuid,
  p_user_id uuid,
  p_player_id text
)
returns table(is_correct boolean, is_duplicate boolean, score integer, total integer)
language plpgsql security definer set search_path=public
as $$
declare
  v_session public.normal_game_sessions%rowtype;
  v_roster jsonb;
  v_total integer;
  v_score integer;
  v_rows integer;
begin
  select * into v_session
  from public.normal_game_sessions
  where id=p_session_id and user_id=p_user_id
  for update;

  if not found or v_session.finished_at is not null then
    raise exception 'Normal game session unavailable';
  end if;
  if clock_timestamp() < v_session.started_at
     or clock_timestamp() - v_session.started_at > interval '120 seconds' then
    raise exception 'Normal game timer expired';
  end if;

  select roster into v_roster
  from public.arcade_team_answers
  where team_id=v_session.team_id;
  if v_roster is null then
    raise exception 'Normal answer roster unavailable';
  end if;
  v_total := jsonb_array_length(v_roster);
  if not exists (
    select 1 from jsonb_array_elements(v_roster) as p(value)
    where p.value->>'id'=p_player_id
  ) then
    raise exception 'Player does not belong to this squad';
  end if;

  insert into public.normal_game_session_guesses(session_id,player_id)
  values(p_session_id,p_player_id)
  on conflict(session_id,player_id) do nothing;
  get diagnostics v_rows = row_count;
  select count(*)::integer into v_score
  from public.normal_game_session_guesses
  where session_id=p_session_id;

  return query select v_rows=1,v_rows=0,v_score,v_total;
end;
$$;

create or replace function public.finish_normal_game_session(
  p_session_id uuid,
  p_user_id uuid,
  p_give_up boolean
)
returns table(team_id text, score integer, total integer)
language plpgsql security definer set search_path=public
as $$
declare
  v_session public.normal_game_sessions%rowtype;
  v_roster jsonb;
  v_score integer;
  v_total integer;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_session
  from public.normal_game_sessions
  where id=p_session_id and user_id=p_user_id
  for update;

  if not found or v_session.finished_at is not null then
    raise exception 'Normal game session unavailable or already submitted';
  end if;
  if v_now < v_session.started_at or v_now - v_session.started_at > interval '180 seconds' then
    raise exception 'Normal game session expired';
  end if;
  if not p_give_up and v_now - v_session.started_at < interval '120 seconds' then
    raise exception 'Normal game timer has not ended';
  end if;

  select roster into v_roster
  from public.arcade_team_answers
  where team_id=v_session.team_id;
  if v_roster is null then
    raise exception 'Normal answer roster unavailable';
  end if;
  v_total := jsonb_array_length(v_roster);
  select count(*)::integer into v_score
  from public.normal_game_session_guesses
  where session_id=p_session_id;

  update public.normal_game_sessions
  set finished_at=v_now
  where id=p_session_id;
  insert into public.normal_game_results(user_id,team_id,score,total)
  values(p_user_id,v_session.team_id,v_score,v_total)
  on conflict(user_id,team_id) where user_id is not null
  do update set score=excluded.score,total=excluded.total,played_at=excluded.played_at;

  return query select v_session.team_id,v_score,v_total;
end;
$$;

revoke all on function public.record_daily_player_guess(uuid,uuid,smallint,text,text) from public,anon,authenticated;
revoke all on function public.complete_daily_team(uuid,uuid,smallint,boolean) from public,anon,authenticated;
revoke all on function public.record_normal_player_guess(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.finish_normal_game_session(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.record_daily_player_guess(uuid,uuid,smallint,text,text) to service_role;
grant execute on function public.complete_daily_team(uuid,uuid,smallint,boolean) to service_role;
grant execute on function public.record_normal_player_guess(uuid,uuid,text) to service_role;
grant execute on function public.finish_normal_game_session(uuid,uuid,boolean) to service_role;
