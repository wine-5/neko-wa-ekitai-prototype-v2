import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG as C } from '../src/config.js';
import { newStage, stepStage, terrainSlope } from '../src/physics.js';
import { newRun, collectCoin, landingPoints, loseLife } from '../src/scoring.js';

test('50枚ごとに1UPし、残機9でも得点と進捗リセットは行う', () => {
  const run = newRun();
  assert.deepEqual(run, { lives: 3, score: 0, coinProgress: 0 });
  for (let i = 0; i < 49; i++) assert.equal(collectCoin(run), false);
  assert.deepEqual(run, { lives: 3, score: 4900, coinProgress: 49 });
  assert.equal(collectCoin(run), true);
  assert.deepEqual(run, { lives: 4, score: 5000, coinProgress: 0 });
  run.lives = 9;
  run.coinProgress = 49;
  assert.equal(collectCoin(run), false);
  assert.deepEqual(run, { lives: 9, score: 5100, coinProgress: 0 });
});

test('飛翔と着地は0.5秒以上だけ、完了単位で加点する', () => {
  assert.equal(landingPoints({ duration: .499, distance: 900, speed: 900 }), 0);
  assert.equal(landingPoints({ duration: 10.33, distance: 6372, speed: 883 }), 2790);
  assert.equal(landingPoints({ duration: 11.32, distance: 7060, speed: 654 }), 2830);
  assert.equal(landingPoints({ duration: .59, distance: 199, speed: 399 }), 70);
});

test('既存の滑空経路で50枚以上を取れ、ミス後は得点と進捗を保持しコインを再配置する', () => {
  const run = newRun();
  const stage = newStage();
  assert.equal(stage.coins.length, 60);
  let collected = 0;
  for (let i = 0; i < 60 / C.fixedStep && !stage.outcome; i++) {
    const phase = stage.cat.x % C.terrainPeriod;
    const held = stage.flights === 0 ? stage.cat.x < 2860 : stage.cat.grounded && (terrainSlope(stage.cat.x) > 0 || (phase >= 2700 && phase < 2900));
    stepStage(stage, held);
    for (const event of stage.events.splice(0)) {
      if (event.type === 'coin') { collected++; collectCoin(run); }
      if (event.type === 'landing') run.score += landingPoints(event);
    }
  }
  assert.equal(stage.outcome, 'all_books');
  assert.ok(collected >= 50);
  assert.equal(run.lives, 4);
  assert.equal(run.coinProgress, collected - 50);
  const score = run.score;
  assert.equal(loseLife(run), true);
  const retry = newStage();
  assert.equal(run.lives, 3);
  assert.equal(run.score, score);
  assert.equal(run.coinProgress, collected - 50);
  assert.equal(retry.coins.filter(coin => coin.collected).length, 0);
  assert.equal(retry.count, 0);
});
