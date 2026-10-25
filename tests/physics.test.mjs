import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG as C } from '../src/config.js';
import { newStage, stepStage, terrainHeight, terrainSlope, hasGround } from '../src/physics.js';
import { updateCamera } from '../src/camera.js';
import { render } from '../src/render.js';

test('初速、自動移動、坂による加減速', () => {
  const stage = newStage();
  assert.equal(stage.cat.vx, C.initialSpeed);
  const start = stage.cat.x;
  while (stage.cat.x < 1800) stepStage(stage, true);
  const downSpeed = stage.cat.vx;
  while (stage.cat.x < 2750) stepStage(stage, false);
  assert.ok(stage.cat.x > start);
  assert.ok(downSpeed > C.initialSpeed);
  assert.ok(stage.cat.vx < downSpeed);
});

test('長い下り坂とジャンプ台の先も山谷が連続し、平坦区間がない', () => {
  assert.ok(2200 - 600 >= 1500);
  assert.ok(terrainHeight(2200) - terrainHeight(600) >= 200);
  assert.ok(terrainHeight(2700) - terrainHeight(3200) >= 250);
  for (let x = 3300; x <= 10000; x += 100) assert.equal(hasGround(x), true);
  const heights = C.terrainProfile.filter(p => p.x >= 3550 && p.x <= 10000).map(p => p.y);
  let turns = 0;
  for (let i = 1; i < heights.length - 1; i++) {
    if ((heights[i] - heights[i - 1]) * (heights[i + 1] - heights[i]) < 0) turns++;
  }
  assert.ok(turns >= 10, `山谷の数: ${turns}`);
  assert.ok(C.terrainProfile.every((p, i, points) => i === 0 || p.y !== points[i - 1].y));
  assert.equal(C.gaps[0].start, 13300);
});

test('離すだけで固定ジャンプせず、頂上では速度に応じて飛ぶ', () => {
  const flat = newStage();
  stepStage(flat, false);
  assert.equal(flat.cat.grounded, true);
  const released = newStage();
  released.cat.x = 3190;
  released.cat.y = terrainHeight(3190) - C.catRadius;
  released.cat.vx = 500;
  stepStage(released, false);
  assert.equal(released.cat.grounded, false);
  const held = newStage();
  held.cat.x = 3190;
  held.cat.y = terrainHeight(3190) - C.catRadius;
  held.cat.vx = 500;
  stepStage(held, true);
  assert.equal(held.cat.grounded, true);
});

test('上り坂で長押しを離すとその場で離陸し、平地では離陸しない', () => {
  const ramp = newStage();
  ramp.cat.x = 2900;
  ramp.cat.y = terrainHeight(2900) - C.catRadius;
  ramp.cat.vx = 650;
  ramp.wasHeld = true;
  stepStage(ramp, false);
  assert.equal(ramp.cat.grounded, false);
  assert.ok(ramp.cat.vy < 0);
  assert.ok(ramp.cat.vy < terrainSlope(2900) * 650);
  assert.ok(ramp.cat.x < 2910);

  const flat = newStage();
  flat.wasHeld = true;
  stepStage(flat, false);
  assert.equal(flat.cat.grounded, true);
});

test('ジャンプ台で離したまま起伏の上を連続10秒以上滑空する', () => {
  const stage = newStage();
  while (stage.cat.x < 2860 && !stage.outcome) stepStage(stage, true);
  const releasedAt = stage.cat.x;
  stepStage(stage, false);
  assert.equal(stage.cat.grounded, false);
  assert.ok(stage.cat.x - releasedAt < 10);
  let highest = stage.cat.y;
  let landingX = 0;
  let deepestPenetration = 0;
  while (stage.cat.x < 9500 && !stage.outcome) {
    const wasAirborne = !stage.cat.grounded;
    stepStage(stage, false);
    highest = Math.min(highest, stage.cat.y);
    if (!stage.cat.grounded && hasGround(stage.cat.x)) {
      deepestPenetration = Math.max(deepestPenetration, stage.cat.y - (terrainHeight(stage.cat.x) - C.catRadius));
    }
    if (wasAirborne && stage.cat.grounded && !landingX) landingX = stage.cat.x;
  }
  assert.equal(stage.outcome, null);
  assert.ok(landingX > 9000);
  assert.ok(landingX - releasedAt > 6000);
  assert.ok(terrainHeight(releasedAt) - C.catRadius - highest > 150);
  assert.ok(stage.flight.lastDistance > 6000);
  assert.ok(stage.flight.lastRise > 150);
  assert.ok(stage.flight.lastDuration >= C.flightTargetSeconds, `滞空 ${stage.flight.lastDuration.toFixed(3)} 秒`);
  assert.ok(highest < -500, `上昇が弱い: y=${highest.toFixed(1)}`);
  assert.ok(deepestPenetration <= 0.1, `地形を${deepestPenetration.toFixed(1)}px貫通した`);
});

test('ジャンプ台で離す位置がずれても斜面を貫通しない', () => {
  for (const releaseAt of [2800, 2840, 2860, 2900, 2940]) {
    const stage = newStage();
    while (stage.cat.x < releaseAt) stepStage(stage, true);
    stepStage(stage, false);
    for (let i = 0; i < 1500 && !stage.outcome && stage.cat.x < 9600; i++) {
      stepStage(stage, false);
      if (hasGround(stage.cat.x)) {
        assert.ok(stage.cat.y <= terrainHeight(stage.cat.x) - C.catRadius + 0.1,
          `離す位置${releaseAt}: 地形を貫通`);
      }
    }
  }
});

test('空中の長押しで落下加速度が強くなる', () => {
  const normal = newStage();
  const heavy = newStage();
  for (const stage of [normal, heavy]) {
    stage.cat.x = 1000;
    stage.cat.y = 180;
    stage.cat.vx = 300;
    stage.cat.vy = 0;
    stage.cat.grounded = false;
  }
  stepStage(normal, false);
  stepStage(heavy, true);
  assert.ok(heavy.cat.vy > normal.cat.vy);
});

test('穴は死亡ライン通過でミスになる', () => {
  const stage = newStage();
  stage.cat.x = (C.gaps[0].start + C.gaps[0].end) / 2;
  stage.cat.y = C.deathY + C.catRadius + 1;
  stage.cat.grounded = false;
  assert.equal(stepStage(stage, false), 'fall');
});

test('穴の内側から着地斜面へ横入りしても地形を貫通しない', () => {
  const stage = newStage();
  const edge = C.gaps[0].end;
  stage.cat.x = edge - 2;
  stage.cat.y = terrainHeight(edge) - C.catRadius + 100;
  stage.cat.vx = 400;
  stage.cat.vy = 0;
  stage.cat.grounded = false;
  stepStage(stage, false);
  assert.ok(stage.cat.x < edge);
  assert.equal(stage.cat.vx, 0);
  assert.equal(stage.cat.grounded, false);
});

test('低速死亡は接地中の連続1.0秒で、速度回復と空中でリセットする', () => {
  const stage = newStage();
  const valley = 2200;
  stage.cat.x = valley;
  stage.cat.y = terrainHeight(valley) - C.catRadius;
  stage.cat.vx = 0;
  for (let i = 0; i < 119; i++) assert.equal(stepStage(stage, false), null);
  assert.equal(stepStage(stage, false), 'stall');

  const recovered = newStage();
  recovered.cat.x = valley;
  recovered.cat.y = terrainHeight(valley) - C.catRadius;
  recovered.cat.vx = 0;
  for (let i = 0; i < 60; i++) stepStage(recovered, false);
  assert.ok(recovered.stallTime > 0);
  recovered.cat.vx = 150;
  stepStage(recovered, false);
  assert.equal(recovered.stallTime, 0);
  recovered.cat.grounded = false;
  recovered.cat.y = 200;
  recovered.cat.vx = 0;
  stepStage(recovered, false);
  assert.equal(recovered.stallTime, 0);
});

test('接地中に左へ動き始めたら即座に逆走ミスになり、空中移動ではならない', () => {
  const reverse = newStage();
  reverse.cat.x = 2200;
  reverse.cat.y = terrainHeight(2200) - C.catRadius;
  reverse.cat.vx = -1;
  assert.equal(stepStage(reverse, false), 'reverse');
  assert.ok(reverse.cat.x < 2200);
  assert.ok(reverse.stallTime < C.stallDuration);

  const airborne = newStage();
  airborne.cat.x = 2200;
  airborne.cat.y = 100;
  airborne.cat.vx = -100;
  airborne.cat.vy = 0;
  airborne.cat.grounded = false;
  assert.equal(stepStage(airborne, false), null);
});

test('本は接触で1回だけ取得し、リトライ相当の再生成で初期化する', () => {
  const stage = newStage();
  stage.cat.x = stage.books[0].x;
  stage.cat.y = stage.books[0].y;
  stage.cat.grounded = false;
  stage.cat.vx = 0;
  stepStage(stage, false);
  stepStage(stage, false);
  assert.equal(stage.count, 1);
  assert.equal(stage.outcome, null);
  assert.equal(stage.books[0].collected, true);
  const retry = newStage();
  assert.equal(retry.count, 0);
  assert.ok(retry.books.every(book => !book.collected));
  assert.equal(retry.cameraX, 0);
  assert.equal(retry.cameraY, 0);
  assert.equal(retry.cameraZoom, 1);
  assert.equal(retry.stallTime, 0);
  assert.equal(retry.elapsed, 0);
  assert.equal(retry.flight.lastDistance, 0);
});

test('本0〜2冊のゴールは通常クリア、本3冊は特別クリア', () => {
  for (let count = 0; count <= 3; count++) {
    const stage = newStage();
    stage.count = count;
    stage.cat.x = C.stageEnd - 82;
    stage.cat.y = terrainHeight(stage.cat.x) - C.catRadius;
    stage.cat.vx = 500;
    assert.equal(stepStage(stage, false), count === 3 ? 'all_books' : 'normal');
  }
});

test('試験操作では飛翔・着地・3冊回収を経て30〜60秒でクリアする', () => {
  const stage = newStage();
  let airborne = false;
  let landed = false;
  let previousGrounded = true;
  let maximumFlight = 0;
  let minimumScreenY = Infinity;
  let maximumScreenY = -Infinity;
  let minimumZoom = 1;
  for (let i = 0; i < 60 / C.fixedStep && !stage.outcome; i++) {
    const phase = stage.cat.x % C.terrainPeriod;
    const terrainHold = terrainSlope(stage.cat.x) > 0 || (phase >= 2700 && phase < 2900);
    const held = stage.flights === 0 ? stage.cat.x < 2860 : stage.cat.grounded && terrainHold;
    stepStage(stage, held);
    updateCamera(stage, C.fixedStep);
    const screenY = (stage.cat.y - stage.cameraY) * stage.cameraZoom;
    minimumScreenY = Math.min(minimumScreenY, screenY);
    maximumScreenY = Math.max(maximumScreenY, screenY);
    minimumZoom = Math.min(minimumZoom, stage.cameraZoom);
    if (!stage.cat.grounded) airborne = true;
    if (!stage.cat.grounded) maximumFlight = Math.max(maximumFlight, terrainHeight(stage.cat.x) - stage.cat.y);
    if (!previousGrounded && stage.cat.grounded) landed = true;
    previousGrounded = stage.cat.grounded;
  }
  assert.equal(stage.outcome, 'all_books');
  assert.equal(stage.count, 3);
  assert.ok(airborne && landed);
  assert.ok(maximumFlight > 180);
  assert.ok(stage.flight.bestDuration >= C.flightTargetSeconds);
  assert.ok(minimumZoom < 0.5);
  assert.ok(minimumScreenY > C.catRadius && maximumScreenY < C.height - C.catRadius);
  assert.ok(stage.elapsed >= 30 && stage.elapsed <= 60);
});

test('Canvas描画はタイトルとプレイ中の遠景を描ける', () => {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      return target[key] ?? (() => {});
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  assert.doesNotThrow(() => render(ctx, null, 'TITLE', 0));
  const stage = newStage();
  stage.cameraX = 8100;
  stage.cameraY = -1800;
  stage.cameraZoom = 0.3;
  assert.doesNotThrow(() => render(ctx, stage, 'PLAYING', 5));
});
