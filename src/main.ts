import './style.css';
import { Microphone } from './audio';
import type { Reading } from './pitch';
import { Game, BIRD_X, FLOOR } from './game';
import { mountLeaderboard } from './leaderboard';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><a class="brand" href="./"><span class="brand-icon">♫</span> hummingbird<span class="beta">VOICE ARCADE</span></a><span class="private"><i></i> Your voice stays on your device</span></header>
<main><div class="intro"><div><div class="eyebrow">A LITTLE BIRD. A LITTLE HUM. A WHOLE LOT OF FUN.</div><h1>Find your <em>flight.</em></h1><p>No tapping. Just you, your voice, and the open sky.</p></div><div class="highscore"><span>PERSONAL BEST</span><strong id="best">00</strong><small>pipes cleared</small></div></div>
<section class="game-shell" aria-label="Voice controlled bird game"><div class="game-top"><span><i id="mic-dot"></i> <span id="mic-status">MICROPHONE OFF</span></span><span id="score">SCORE <b>00</b></span><button id="pause" class="tiny" hidden>Ⅱ Pause</button></div><div class="stage"><canvas width="960" height="540" aria-label="Bird flying through a pixel landscape"></canvas><div id="panel" class="panel"></div><div id="countdown" hidden></div><span class="scene-label">THE SKY IS YOUR INSTRUMENT</span></div><div class="instrument"><div class="pitch-label">♪ <span>YOUR VOICE</span></div><span class="low">QUIET</span><div class="meter"><span id="pitch-position"></span></div><span class="low">VOICE</span><span id="note">Waiting for a hum</span></div></section>
<section class="instructions"><article><span class="step">01</span><div><h3>Make a little sound</h3><p>Allow your mic, then check the room noise.</p></div></article><article><span class="step">02</span><div><h3>Make sound. Take flight.</h3><p>Any voice or hum lifts you up. Go quiet to drift down.</p></div></article><article><span class="step">03</span><div><h3>Find your rhythm</h3><p>Glide through the gaps. Take a breath, then try again.</p></div></article></section><footer><span>Made for humming, not perfect singing.</span><span>HEADPHONES OPTIONAL · GOOD VIBES REQUIRED</span></footer></main>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = document.querySelector('canvas')!, ctx = canvas.getContext('2d')!;
const mic = new Microphone(), game = new Game();
const boardHost = document.createElement('section');
boardHost.className = 'leaderboard'; boardHost.setAttribute('aria-label', 'All-time leaderboard');
document.querySelector('.instructions')!.before(boardHost);
const leaderboard = mountLeaderboard(boardHost);
type State = 'setup' | 'calibration' | 'practice' | 'countdown' | 'playing' | 'paused' | 'gameover';
let state: State = 'setup', previousState: 'practice' | 'playing' = 'practice';
let reading: Reading = { pitch: 0, confidence: 0, volume: 0 }, lastValid = -Infinity;
let noise = 0.006, best = 0, countdown = 0, timer = 0, generation = 0;
let volumes: number[] = [];
try { best = Number(localStorage.getItem('hummingbird-best')) || 0; } catch { /* storage optional */ }
$('best').textContent = String(best).padStart(2, '0');
const median = (values: number[]) => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
function panel(html: string) { $('panel').innerHTML = html; $('panel').hidden = false; }
function button(id: string, fn: () => void) { $(id).onclick = fn; }
function controls() { $('pause').hidden = !['practice','playing'].includes(state); }
function setup(message = '') {
  $('panel').classList.remove('practice'); lastValid = -Infinity;
  generation++; clearTimeout(timer); mic.stop(); state = 'setup'; controls(); $('countdown').hidden = true;
  $('mic-status').textContent = 'MICROPHONE OFF'; $('mic-dot').classList.remove('live');
  panel(`<span class="pill">POWERED BY YOUR VOICE</span><h2>Small bird.<br>Big vocal energy.</h2><p>Use any voice or hum to rise.<br>Go quiet and gravity takes over.</p>${message ? '<p class="error" role="alert"></p>' : ''}<button id="start" class="primary">Let’s fly <span>↗</span></button><small>We’ll tune the game to your voice first.</small>`);
  if (message) document.querySelector('.error')!.textContent = message;
  button('start', () => void connect());
}
async function connect() {
  const token = ++generation;
  const connectButton = document.querySelector<HTMLButtonElement>('#start, #resume');
  if (connectButton) { connectButton.disabled = true; connectButton.textContent = 'Connecting microphone…'; }
  try {
    await mic.start(r => {
      reading = r;
      if (state === 'calibration') volumes.push(r.volume);
      if (r.volume > noise) lastValid = performance.now();
    }, () => pause(true));
    if (token !== generation) { mic.stop(); return; }
    $('mic-dot').classList.add('live'); $('mic-status').textContent = 'MICROPHONE CONNECTED'; calibrate('noise');
  } catch (e) {
    const name = (e as DOMException).name;
    setup(name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it in your browser’s site settings, then try again.' : name === 'NotFoundError' ? 'No microphone found. Connect one, then try again.' : (e as Error).message);
  }
}
function calibrate(_next: 'noise') {
  $('panel').classList.remove('practice');
  clearTimeout(timer); state = 'calibration'; volumes = []; controls();
  panel(`<span class="pill">QUICK MIC CHECK</span><h2>A moment of quiet.</h2><p>Stay quiet for two seconds while we measure your room. Then use any comfortable voice or hum—pitch doesn’t matter.</p><div class="listening"><span></span><span></span><span></span><span></span><span></span></div><p id="cal-feedback" aria-live="polite">Measuring your room…</p><button id="exit" class="secondary">Exit</button>`);
  button('exit', () => setup());
  timer = window.setTimeout(() => {
    noise = Math.max(.004, (median(volumes) || .002) * 2.5);
    lastValid = -Infinity; game.reset(); state = 'practice'; controls(); practicePanel();
  }, 2000);
}
function practicePanel() {
  panel(`<span class="pill">YOUR SKY. YOUR PACE.</span><h2>You’re ready to soar.</h2><p>Speak or hum to rise. Go quiet to descend.<br>Any pitch works. Keep your voice comfortable.</p><button id="play" class="primary">Start flying ↗</button><button id="tune" class="secondary">Recalibrate</button>`);
  $('panel').classList.add('practice'); button('play', () => startCountdown(false)); button('tune', () => { $('panel').classList.remove('practice'); calibrate('noise'); });
}
function startCountdown(resume: boolean) {
  void mic.context?.resume(); if (!resume) { game.reset(); previousState = 'playing'; }
  state = 'countdown'; countdown = 3; $('panel').hidden = true; $('panel').classList.remove('practice'); controls(); $('countdown').hidden = false;
}
function pause(lost = false) {
  if (!['playing','practice','countdown','calibration'].includes(state)) return;
  const interruptedCalibration = state === 'calibration';
  clearTimeout(timer); if (state !== 'countdown') previousState = state === 'practice' ? 'practice' : 'playing'; state = 'paused'; controls(); $('countdown').hidden = true; $('panel').classList.remove('practice');
  panel(`<span class="pill">TAKE A BREATHER</span><h2>${lost ? 'Microphone interrupted.' : 'Flight paused.'}</h2><p>${lost ? 'Reconnect your microphone to tune your voice again.' : 'Your bird will be right here when you’re ready.'}</p><button id="resume" class="primary">${lost ? 'Reconnect microphone' : 'Resume flight ↗'}</button><button id="tune" class="secondary">Recalibrate</button><button id="exit" class="secondary">Exit game</button>`);
  button('resume', () => { if (lost) void connect(); else if (interruptedCalibration) calibrate('noise'); else startCountdown(true); }); button('tune', () => { if (lost) void connect(); else calibrate('noise'); }); button('exit', () => setup());
}
function gameover() {
  leaderboard.recordScore(game.score);
  state = 'gameover'; controls(); best = Math.max(best, game.score); try { localStorage.setItem('hummingbird-best', String(best)); } catch { /* optional */ }
  $('best').textContent = String(best).padStart(2,'0');
  panel(`<span class="pill">EVERY FLIGHT IS A FRESH START</span><h2>Nice flight!</h2><p>You cleared <strong>${game.score}</strong> ${game.score === 1 ? 'pipe' : 'pipes'}. Personal best: ${best}.</p><button id="retry" class="primary">One more flight ↗</button><button id="tune" class="secondary">Recalibrate</button><button id="exit" class="secondary">Exit game</button>`);
  button('retry', () => startCountdown(false)); button('tune', () => calibrate('noise')); button('exit', () => setup());
}
button('pause', () => pause());
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => mic.stop());
window.addEventListener('keydown', e => { if (e.key === 'Escape') pause(); });
function rect(x:number,y:number,w:number,h:number,color:string) { ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),w,h); }
function cloud(x:number,y:number,s=1) { rect(x,y,70*s,16*s,'#eefbf5'); rect(x+12*s,y-12*s,42*s,18*s,'#eefbf5'); rect(x+24*s,y-20*s,22*s,12*s,'#eefbf5'); }
function draw(time:number) {
  rect(0,0,960,540,'#b9e4e3');
  cloud(65,90); cloud(360,55,.8); cloud(680,110,1.2); cloud(850,48,.6);
  rect(790,52,42,42,'#fff3bc');
  for (let i=0;i<14;i++) { const x=i*85-30; rect(x,415-(i%3)*15,110,90,'#a1cfb2'); rect(x+16,400-(i%3)*15,65,100,'#a1cfb2'); }
  for (let i=0;i<18;i++) { rect(i*62,462-(i%4)*9,70,45,'#80b695'); }
  for (const p of game.pipes) { for (const [y,h] of [[0,p.center-p.gap/2],[p.center+p.gap/2,FLOOR-p.center-p.gap/2]]) { rect(p.x,y,72,h,'#44835f'); rect(p.x+5,y,60,h,'#8dbd78'); rect(p.x+10,y,12,h,'#b7d898'); } rect(p.x-6,p.center-p.gap/2-20,84,20,'#44835f'); rect(p.x-2,p.center-p.gap/2-16,76,11,'#a4ce88'); rect(p.x-6,p.center+p.gap/2,84,20,'#44835f'); rect(p.x-2,p.center+p.gap/2+4,76,11,'#a4ce88'); }
  rect(0,FLOOR,960,8,'#42785e'); rect(0,FLOOR+8,960,8,'#a3ca7a'); rect(0,FLOOR+16,960,24,'#e0d6ab');
  for(let i=0;i<60;i++) rect(i*18-(game.distance%18),524,6,4,'#c5ba90');
  const y = state === 'setup' || state === 'calibration' ? 260 + Math.sin(time/400)*8 : game.y;
  const x=BIRD_X;
  rect(x-18,y-12,32,26,'#644c35'); rect(x-24,y-6,8,15,'#644c35'); rect(x-12,y-18,22,6,'#644c35');
  rect(x-15,y-9,27,21,'#f8ce54'); rect(x-9,y-15,18,7,'#ffe58a'); rect(x-21,y-3,16,11,'#e4a43e'); rect(x-17,y+(Math.sin(time/100)>0?0:5),14,7,'#fff0a6');
  rect(x+3,y-9,9,10,'#fff9df'); rect(x+8,y-7,4,5,'#303e38'); rect(x+13,y,12,6,'#cc7646');
}
let last = performance.now();
function frame(now:number) {
  const dt=Math.min((now-last)/1000,.04); last=now;
  const valid=now-lastValid<150;
  const target=valid ? Math.max(30, game.y - 14) : null;
  if(state==='practice') { game.move(dt,target); game.y=Math.max(30,Math.min(475,game.y)); }
  if(state==='playing' && !game.update(dt,target)) gameover();
  if(state==='countdown') { countdown-=dt; $('countdown').textContent=String(Math.ceil(countdown)); if(countdown<=0) { state=previousState; $('countdown').hidden=true; controls(); if(state==='practice') practicePanel(); } }
  $('score').innerHTML=`SCORE <b>${String(game.score).padStart(2,'0')}</b>`;
  $('pitch-position').style.left=`${Math.min(100, reading.volume / noise * 50)}%`;
  $('pitch-position').style.opacity=valid?'1':'.25';
  $('note').textContent=state==='setup' ? 'Microphone off' : valid ? 'Voice detected · rising' : 'Quiet · drifting down';
  draw(now); requestAnimationFrame(frame);
}
setup(); requestAnimationFrame(frame);

