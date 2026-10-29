import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validateNickname, validateScore } from '../src/leaderboard-model.ts';
test('nicknames are trimmed and constrained before publishing', () => {
  assert.equal(validateNickname('  Cloud   Hopper  '), 'Cloud Hopper');
  assert.equal(validateNickname('Bird_42'), 'Bird_42');
  for (const value of ['', 'a', 'x'.repeat(21), '<img src=x>', 'Bird\u0000']) assert.throws(() => validateNickname(value));
});
test('only bounded nonnegative integer scores can be submitted', () => {
  for (const value of [0,1,100000]) assert.equal(validateScore(value),value);
  for (const value of [-1,1.5,NaN,Infinity,100001]) assert.throws(() => validateScore(value));
});
