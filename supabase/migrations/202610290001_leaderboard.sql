-- Run in the Supabase SQL editor, or apply with Supabase migrations.
begin;
create table public.leaderboard (
  player_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  score integer not null check (score between 0 and 100000),
  achieved_at timestamptz not null default now()
);
create index leaderboard_ranking on public.leaderboard (score desc, achieved_at, player_id);
alter table public.leaderboard enable row level security;
revoke all on public.leaderboard from anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
create policy "Anyone can view scores" on public.leaderboard for select to anon, authenticated using (true);

-- The caller cannot choose an identity or overwrite someone else's score.
-- Atomic max keeps concurrent submissions and retries from lowering a best.
create function public.submit_score(p_nickname text, p_score integer)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to submit a score'; end if;
  if p_nickname is null or p_nickname !~ '^[[:alnum:] _-]{2,20}$' or p_nickname <> btrim(p_nickname) then
    raise exception 'Invalid nickname';
  end if;
  if p_score is null or p_score < 0 or p_score > 100000 then raise exception 'Invalid score'; end if;
  insert into public.leaderboard as current (player_id, nickname, score)
    values (uid, p_nickname, p_score)
    on conflict (player_id) do update set
      nickname = excluded.nickname,
      score = greatest(current.score, excluded.score),
      achieved_at = case when excluded.score > current.score then now() else current.achieved_at end;
end;
$$;
revoke all on function public.submit_score(text, integer) from public, anon;
grant execute on function public.submit_score(text, integer) to authenticated;
alter publication supabase_realtime add table public.leaderboard;
commit;
