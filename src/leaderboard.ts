import { createClient } from '@supabase/supabase-js';
import { validateNickname, validateScore, type LeaderboardEntry } from './leaderboard-model';

export function mountLeaderboard(host: HTMLElement) {
  host.innerHTML = `<div class="board-heading"><div><span class="eyebrow">THE FLOCK’S FINEST</span><h2>All-time top 10</h2></div><span id="board-status" role="status">Connecting…</span></div>
    <p class="board-copy">Your best flight, up against the world. Ties go to the earliest score.</p>
    <form id="board-form"><label for="nickname">Your public nickname</label><div class="board-input"><input id="nickname" name="nickname" minlength="2" maxlength="20" placeholder="e.g. Cloud Hopper" autocomplete="nickname" required><button class="primary" type="submit">Join leaderboard</button></div><small>Joining shares your nickname and future scores automatically. One best per browser profile.</small></form>
    <p id="board-feedback" role="status"></p><ol id="board-rows" aria-label="All-time top ten scores"></ol><button id="board-refresh" class="secondary">Refresh scores</button><button id="board-retry" class="secondary" hidden>Retry score upload</button>`;
  const find = <T extends HTMLElement>(id: string) => host.querySelector<T>(`#${id}`)!;
  const status = find('board-status'), feedback = find('board-feedback');
  const input = find<HTMLInputElement>('nickname'), form = find<HTMLFormElement>('board-form');
  const rows = find('board-rows'), retry = find<HTMLButtonElement>('board-retry');
  const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    status.textContent = 'Not connected yet';
    feedback.textContent = 'The shared leaderboard needs its database connection. You can still play and save your personal best.';
    form.hidden = true; find('board-refresh').hidden = true;
    return { recordScore: (_score: number) => {} };
  }
  const client = createClient(url, key, { global: { fetch: (request, options) => fetch(request, { ...options, signal: AbortSignal.any([...(options?.signal ? [options.signal] : []), AbortSignal.timeout(10000)]) }) } });
  let playerId = '', joined = false, pending: number | null = null, uploading = false;
  let refreshing = false, refreshAgain = false, live = false;
  try { input.value = localStorage.getItem('hummingbird-nickname') || ''; } catch { /* optional */ }
  async function refresh() {
    if (refreshing) { refreshAgain = true; return; }
    refreshing = true;
    try {
      const { data, error } = await client.from('leaderboard').select('player_id,nickname,score').order('score', { ascending: false }).order('achieved_at', { ascending: true }).order('player_id').limit(10);
      if (error) throw error;
      rows.replaceChildren();
      for (const [index, entry] of (data as LeaderboardEntry[]).entries()) {
        const row = document.createElement('li');
        const rank = document.createElement('span'), name = document.createElement('span'), score = document.createElement('strong');
        rank.textContent = String(index + 1).padStart(2, '0');
        name.textContent = `${entry.nickname}${entry.player_id === playerId ? ' (you)' : ''}`;
        score.textContent = String(entry.score);
        row.classList.toggle('is-you', entry.player_id === playerId);
        row.append(rank, name, score); rows.append(row);
      }
      if (!data?.length) { const empty = document.createElement('li'); empty.textContent = 'The sky is wide open. Be the first to post a score!'; rows.append(empty); }
      status.textContent = live ? '● Live' : 'Updates every 15 seconds';
    } catch { status.textContent = 'Offline · retrying'; }
    finally { refreshing = false; if (refreshAgain) { refreshAgain = false; void refresh(); } }
  }
  async function identify() {
    const { data: session, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (session.session) { playerId = session.session.user.id; return; }
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) throw error || new Error('Sign-in failed');
    playerId = data.user.id;
  }
  async function upload() {
    if (!joined || pending === null || uploading) return;
    uploading = true; retry.hidden = true;
    const score = pending;
    try {
      await identify();
      const { error } = await client.rpc('submit_score', { p_nickname: validateNickname(input.value), p_score: validateScore(score) });
      if (error) throw error;
      if (pending === score) pending = null;
      feedback.textContent = 'Best score saved! Only a higher score replaces it.';
      void refresh();
    } catch { feedback.textContent = 'Score upload failed. Your personal best is safe. Check your connection and retry.'; retry.hidden = false; }
    finally { uploading = false; if (pending !== null && pending !== score) void upload(); }
  }
  form.onsubmit = async event => {
    event.preventDefault();
    const submit = form.querySelector<HTMLButtonElement>('button')!;
    try {
      input.value = validateNickname(input.value);
      submit.disabled = true; feedback.textContent = 'Joining…';
      await identify(); joined = true;
      try { localStorage.setItem('hummingbird-nickname', input.value); } catch { /* optional */ }
      feedback.textContent = 'You’re in! Future flights will submit automatically.';
      submit.textContent = 'Update nickname';
      await upload(); void refresh();
    } catch (e) { feedback.textContent = e instanceof Error ? e.message : 'Could not join. Try again.'; }
    finally { submit.disabled = false; }
  };
  find('board-refresh').onclick = () => void refresh(); retry.onclick = () => void upload();
  const channel = client.channel('all-time-leaderboard').on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => void refresh()).subscribe(state => {
    live = state === 'SUBSCRIBED';
    if (live) void refresh();
    else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') status.textContent = 'Reconnecting · updates every 15 seconds';
  });
  const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
  window.addEventListener('pagehide', () => { clearInterval(interval); void client.removeChannel(channel); }, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  window.addEventListener('online', () => { void refresh(); void upload(); });
  void refresh();
  return { recordScore(score: number) { if (!joined) return; pending = Math.max(pending ?? 0, validateScore(score)); void upload(); } };
}
