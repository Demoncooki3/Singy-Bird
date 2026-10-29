# Hummingbird

A local-first voice-controlled arcade game. Speak or hum at any comfortable pitch to rise. Go quiet to descend. Pitch and loudness do not set flight height; sound above the calibrated room noise activates a steady lift.

## Run

Use Node.js 22+ and pnpm:

```sh
pnpm install
pnpm dev
```

Open the localhost URL printed by Vite. Allow microphone access and stay quiet during the two-second room noise check. Practice making sound to rise and going quiet to descend before starting a scored flight. Escape pauses the game.

```sh
pnpm test
pnpm build
pnpm preview
```

Deploy the `dist` directory to any HTTPS static host. Microphones require HTTPS or localhost; a plain HTTP LAN address will not work on a phone.

## Design

`src/worklet.js` measures sound level outside the UI thread with overlapping 2048-sample windows. `src/audio.ts` owns microphone resources. `src/game.ts` is a time-based simulation independent of rendering. `src/main.ts` handles room noise calibration, voice activity control, lifecycle, Canvas art, and menus. The earlier pitch detector remains in `src/pitch.ts` but is not used for gameplay. Sound activity is detected by level, so other loud sounds can also activate lift.

Audio is processed locally and is never recorded or uploaded. The personal best stays local. Players can optionally join the leaderboard to share a nickname and future scores with Supabase. Fonts load from Google Fonts with local fallbacks. There is no analytics.

## Shared all-time top 10

The leaderboard is optional: without configuration, the game works normally and clearly shows that the board is not connected. No demo scores are presented as live data.

1. Create or select a Supabase project and enable **Anonymous Sign-Ins** in Authentication settings.
2. Apply `supabase/migrations/202610290001_leaderboard.sql` using the SQL editor or Supabase CLI. The migration creates the table, enables row-level security, restricts score writes to an authenticated RPC, and enables Realtime for scores.
3. Copy `.env.example` to `.env.local` and enter your project's URL and **publishable** key from the project's Connect dialog. Never use a secret or service-role key in the browser.
4. Restart the dev server. For a published site, set the two `VITE_SUPABASE_*` variables in your build environment, rebuild, and redeploy `dist`. These public values are embedded at build time.
5. Enter a nickname and click **Join leaderboard**. Each finished run now submits automatically. Rejoining is required after a reload; anonymous identity persists in this browser's storage. Clearing storage or switching devices creates a different player.

The all-time top 10 orders by score descending, earliest achievement, then player ID. Equal or lower scores never lower an existing best or change its tie timestamp. Duplicate nicknames are allowed; identity comes from anonymous auth, not the name. Database events refresh the board immediately, with 15-second polling as a fallback. Failed uploads can be retried during the current session; they do not block gameplay. A nickname edit is published on the next score submission.

This is a casual leaderboard: the RPC validates identity and score bounds, but client-reported scores are not cheat-proof. Competitive play needs server-validated runs. Public rows contain only anonymous player IDs, nicknames, scores, and achievement times.

Verify with two independent browser profiles: join, finish runs, confirm cross-browser updates, submit a lower score, test ties, and test offline/retry. Confirm unauthenticated RPC calls and direct table writes are rejected, and that callers cannot submit as another player. A real Supabase project is needed to verify these database rules end to end.

## Manual acceptance checks

- Test microphone permission allow/deny, absent or unplugged devices, and recovery.
- Check the room noise calibration in quiet and moderately noisy environments.
- Verify low voices, speech, and hums activate equal lift, silence causes descent, and brief dropouts do not jerk the bird.
- Verify tab hiding pauses, resume counts down, retry keeps calibration, and Exit releases the microphone.
- Play desktop Chrome/Edge and mobile Safari/Chrome. Check portrait layout and real microphone latency (target approximately 150 ms).

Synthetic pitch and simulation tests do not replace physical microphone and mobile-browser testing.
