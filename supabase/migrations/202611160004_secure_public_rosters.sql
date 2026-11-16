-- Verified normal-game answer rosters must never be sent to the browser before a correct guess or game completion.
-- The start endpoint sends only opaque player IDs and non-name hints; completion reveals missed names.
drop function if exists public.finish_normal_game_session(uuid,uuid,boolean);

create function public.finish_normal_game_session(
  p_session_id uuid,
  p_user_id uuid,
  p_give_up boolean
)
returns table(team_id text, score integer, total integer, missed_players jsonb)
language plpgsql security definer set search_path=public
as $$
declare
  v_session public.normal_game_sessions%rowtype;
  v_roster jsonb;
  v_score integer;
  v_total integer;
  v_found text[];
  v_missed jsonb;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_session
  from public.normal_game_sessions
  where id=p_session_id and user_id=p_user_id
  for update;

  if not found or v_session.finished_at is not null then
    raise exception 'Normal game session unavailable or already submitted';
  end if;
  if v_now < v_session.started_at or v_now-v_session.started_at > interval '180 seconds' then
    raise exception 'Normal game session expired';
  end if;
  if not p_give_up and v_now-v_session.started_at < interval '120 seconds' then
    raise exception 'Normal game timer has not ended';
  end if;
  if not exists(select 1 from public.arcade_teams t where t.id=v_session.team_id and t.verified=true) then
    raise exception 'Normal game squad is no longer verified';
  end if;

  select roster into v_roster
  from public.arcade_team_answers
  where team_id=v_session.team_id;
  if v_roster is null then
    raise exception 'Normal answer roster unavailable';
  end if;

  v_total:=jsonb_array_length(v_roster);
  select count(*)::integer into v_score
  from public.normal_game_session_guesses
  where session_id=p_session_id;
  select coalesce(array_agg(player_id),'{}'::text[]) into v_found
  from public.normal_game_session_guesses
  where session_id=p_session_id;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',p.value->>'id',
      'name',p.value->>'name',
      'position',coalesce(p.value->>'position',''),
      'club',coalesce(p.value->>'club',''),
      'rarity',p.value->>'rarity'
    ) order by p.ordinality),
    '[]'::jsonb
  ) into v_missed
  from jsonb_array_elements(v_roster) with ordinality as p(value,ordinality)
  where not (coalesce(p.value->>'id','')=any(v_found));

  update public.normal_game_sessions set finished_at=v_now where id=p_session_id;
  insert into public.normal_game_results(user_id,team_id,score,total)
  values(p_user_id,v_session.team_id,v_score,v_total)
  on conflict(user_id,team_id) where user_id is not null
  do update set score=excluded.score,total=excluded.total,played_at=excluded.played_at;

  return query select v_session.team_id,v_score,v_total,v_missed;
end;
$$;

revoke all on function public.finish_normal_game_session(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_normal_game_session(uuid,uuid,boolean) to service_role;

create or replace function public.record_normal_player_guess(
  p_session_id uuid,
  p_user_id uuid,
  p_player_id text
)
returns table(is_correct boolean,is_duplicate boolean,score integer,total integer)
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
  if clock_timestamp()<v_session.started_at or clock_timestamp()-v_session.started_at>interval '120 seconds' then
    raise exception 'Normal game timer expired';
  end if;
  if not exists(select 1 from public.arcade_teams t where t.id=v_session.team_id and t.verified=true) then
    raise exception 'Normal game squad is no longer verified';
  end if;
  select roster into v_roster from public.arcade_team_answers where team_id=v_session.team_id;
  if v_roster is null then raise exception 'Normal answer roster unavailable'; end if;
  v_total:=jsonb_array_length(v_roster);
  if not exists(select 1 from jsonb_array_elements(v_roster) as p(value) where p.value->>'id'=p_player_id) then
    raise exception 'Player does not belong to this squad';
  end if;
  insert into public.normal_game_session_guesses(session_id,player_id)
  values(p_session_id,p_player_id) on conflict(session_id,player_id) do nothing;
  get diagnostics v_rows=row_count;
  select count(*)::integer into v_score from public.normal_game_session_guesses where session_id=p_session_id;
  return query select v_rows=1,v_rows=0,v_score,v_total;
end;
$$;
revoke all on function public.record_normal_player_guess(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_normal_player_guess(uuid,uuid,text) to service_role;
