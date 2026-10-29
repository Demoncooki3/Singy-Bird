import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { comfortableHigh, detectPitch, pitchHeight } from '../src/pitch.ts';
import { Game } from '../src/game.ts';
test('YIN recognizes multiple ranges and amplitudes', () => {
  for (const rate of [44100,48000]) for (const frequency of [55,65,85,140,220,350,700]) for (const amplitude of [.025,.5]) {
    const signal = Float32Array.from({length:2048},(_,i)=>amplitude*Math.sin(2*Math.PI*frequency*i/rate));
    const result = detectPitch(signal,rate);
    assert.ok(Math.abs(result.pitch-frequency)<2, `${frequency}: ${result.pitch}`);
    assert.ok(result.confidence>.85);
  }
});
test('comfortable control reaches the top with a small pitch rise', () => {
  const top = comfortableHigh(100, 300);
  assert.ok(top < 120);
  assert.equal(pitchHeight(top, 100, top),80);
  assert.equal(comfortableHigh(100,110),110);
});
test('silence and nonperiodic noise have no pitch', () => {
  assert.equal(detectPitch(new Float32Array(2048),48000).pitch,0);
  let seed=9;
  const noise=Float32Array.from({length:2048},()=>{seed=(seed*16807)%2147483647;return (seed/2147483647-.5)*.2;});
  assert.equal(detectPitch(noise,48000).pitch,0);
});
test('pitch mapping clamps and uses musical intervals', () => {
  assert.equal(pitchHeight(50,100,400),445);
  assert.equal(pitchHeight(800,100,400),80);
  assert.equal(pitchHeight(200,100,400),262.5);
});
test('bird eases toward pitch and falls in silence', () => {
  const game = new Game(); game.move(.04,80); assert.ok(game.y<265); assert.ok(265-game.y<=390*.04);
  const y=game.y; game.move(.04,null); assert.ok(game.y>y);
});
test('pipes score once, collide, and reset cleanly', () => {
  const game=new Game(); game.pipes=[{x:130,center:265,gap:255,scored:false}];
  assert.ok(game.update(.016,265,()=>.5)); assert.equal(game.score,1);
  game.update(.016,265,()=>.5); assert.equal(game.score,1);
  game.pipes=[{x:220,center:100,gap:180,scored:false}]; assert.equal(game.update(.016,400),false);
  game.reset(); assert.equal(game.pipes.length,0); assert.equal(game.score,0); assert.equal(game.y,265);
});
test('generated gaps stay reachable and difficulty bounded', () => {
  const game=new Game(); let center=265;
  for(let n=0;n<100;n++) {game.pipes=[];game.score=n;game.y=265;game.update(.016,265,()=>n%2);const p=game.pipes[0];assert.ok(Math.abs(p.center-center)<=75);assert.ok(p.gap>=180);center=p.center;}
});
