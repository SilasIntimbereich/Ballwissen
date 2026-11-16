-- Keep score buckets in numeric order and calculate percentiles against other completed attempts.
create or replace function public.team_score_distribution(p_team_id text)
returns table(score_bucket text, player_count bigint, percentage numeric)
language sql stable security definer set search_path=public
as $$
 with bucketed as (
  select
   case when total=0 then 0 else least(90,(floor((score::numeric/total)*10)*10)::int) end bucket_start,
   count(*)::bigint n
  from public.normal_game_results
  where team_id=p_team_id
  group by 1
 )
 select
  case when bucket_start=0 and not exists (
    select 1 from public.normal_game_results r where r.team_id=p_team_id and r.total>0 and
      least(90,(floor((r.score::numeric/r.total)*10)*10)::int)=0
  ) then '0%' else bucket_start::text||'–'||(bucket_start+10)::text||'%' end,
  n,
  round(100.0*n/nullif(sum(n) over(),0),1)
 from bucketed
 order by bucket_start;
$$;
revoke all on function public.team_score_distribution(text) from public;
grant execute on function public.team_score_distribution(text) to anon,authenticated;

create or replace function public.team_percentile(p_team_id text,p_score int,p_total int)
returns numeric language sql stable security definer set search_path=public
as $$
 with ratios as (
  select case when total=0 then 0::numeric else score::numeric/total end ratio
  from public.normal_game_results where team_id=p_team_id
 )
 select coalesce(round(
   100.0*count(*) filter (
     where ratio < case when p_total=0 then 0::numeric else p_score::numeric/p_total end
   ) / nullif(count(*)-1,0),1
 ),0)
 from ratios;
$$;
revoke all on function public.team_percentile(text,int,int) from public;
grant execute on function public.team_percentile(text,int,int) to anon,authenticated;

drop function if exists public.daily_common_leaderboard();
create function public.daily_common_leaderboard()
returns table(rank bigint, display_name text, points bigint, is_current_user boolean)
language sql stable security definer set search_path=public
as $$
 with sums as (
  select user_id,sum(score)::bigint points
  from public.daily_attempts
  where mode='daily-common'
    and challenge_date between current_date-6 and current_date
    and finished_at is not null
  group by user_id
 ), ranked as (
  select
   row_number() over(order by s.points desc,s.user_id)::bigint rank,
   s.user_id,
   coalesce(p.display_name,'Player') display_name,
   s.points
  from sums s left join public.profiles p on p.id=s.user_id
 )
 select r.rank,r.display_name,r.points,(r.user_id=auth.uid()) is_current_user
 from ranked r
 where r.rank<=10 or r.user_id=auth.uid()
 order by r.rank;
$$;
revoke all on function public.daily_common_leaderboard() from public;
grant execute on function public.daily_common_leaderboard() to anon,authenticated;
