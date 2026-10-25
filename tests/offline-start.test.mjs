import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { bundleSource } from '../build-offline.mjs';

const root = new URL('../', import.meta.url);

test('folder startup script is a current classic bundle', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const bundled = await readFile(new URL('src/game-classic.js', root), 'utf8');
  assert.match(html, /<script defer src="\.\/src\/game-classic\.js"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]+type="module"/);
  assert.equal(bundled, await bundleSource());
});

test('folder startup opens the stage through the actual menu buttons', async () => {
  const bundled = await readFile(new URL('src/game-classic.js', root), 'utf8');
  const makeElement = () => ({
    hidden: false,
    style: {},
    classList: { toggle() {} },
    textContent: '',
    addEventListener(type, callback) { this[type] = callback; },
    querySelector() { return { focus() {} }; }
  });
  const elements = new Map();
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get(target, key) {
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    return target[key] ?? (() => {});
  }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = { ...makeElement(), getContext() { return ctx; }, focus() {} };
  elements.set('#game', canvas);
  for (const selector of ['#titleScreen', '#mapScreen', '#pauseScreen', '#settingsScreen', '#missScreen', '#gameOverScreen', '#witchScreen', '#resultScreen', '#hud', '#bookCount', '#scoreCount', '#resultScore', '#resultTotalScore', '#bestScore', '#flightDistance', '#flightRise', '#flightTime', '#flightTarget', '#stallFill', '#stallText', '.stall-wrap', '#retryCountdown', '#bgmVolume', '#seVolume', '#bgmVolumeValue', '#seVolumeValue']) {
    elements.set(selector, makeElement());
  }
  const buttons = ['map', 'play', 'retry', 'settings', 'close-settings', 'resume', 'preview-se'].map(action => ({
    dataset: { action },
    addEventListener(type, callback) { if (type === 'click') this.click = callback; }
  }));
  const document = {
    querySelector(selector) { return elements.get(selector) ?? makeElement(); },
    querySelectorAll() { return buttons; },
    addEventListener() {}
  };
  const saved = new Map();
  const window = { addEventListener() {}, localStorage: {
    getItem(key) { return saved.get(key) ?? null; },
    setItem(key, value) { saved.set(key, value); }
  } };
  let frame;
  const context = { document, window, performance: { now: () => 0 }, requestAnimationFrame(callback) { frame = callback; } };
  runInNewContext(bundled, context, { filename: 'game-classic.js' });
  assert.equal(window.__catPrototype.state, 'TITLE');
  assert.equal(elements.get('#bgmVolume').value, '40');
  assert.equal(elements.get('#seVolume').value, '65');
  buttons[3].click();
  assert.equal(window.__catPrototype.state, 'SETTINGS');
  const bgmSlider = elements.get('#bgmVolume');
  const seSlider = elements.get('#seVolume');
  bgmSlider.value = '0';
  bgmSlider.input();
  seSlider.value = '80';
  seSlider.input();
  assert.equal(elements.get('#bgmVolumeValue').textContent, '0%');
  assert.equal(elements.get('#seVolumeValue').textContent, '80%');
  assert.equal(saved.get('cat-is-liquid-bgm-volume'), '0');
  assert.equal(saved.get('cat-is-liquid-se-volume'), '80');
  buttons[4].click();
  assert.equal(window.__catPrototype.state, 'TITLE');
  buttons[0].click();
  assert.equal(window.__catPrototype.state, 'STAGE_MAP');
  buttons[1].click();
  assert.equal(window.__catPrototype.state, 'PLAYING');
  assert.equal(elements.get('#hud').hidden, false);
  assert.ok(window.__catPrototype.stage);
  assert.equal(window.__catPrototype.run.lives, 3);
  window.__catPrototype.pause();
  assert.equal(window.__catPrototype.state, 'PAUSED');
  buttons[3].click();
  assert.equal(window.__catPrototype.state, 'SETTINGS');
  buttons[4].click();
  assert.equal(window.__catPrototype.state, 'PAUSED');
  assert.equal(elements.get('#hud').hidden, false);
  buttons[5].click();
  assert.equal(window.__catPrototype.state, 'PLAYING');
  assert.doesNotMatch(await readFile(new URL('index.html', root), 'utf8'), /id="attemptScoreCount"/);
  window.__catPrototype.run.score = 1234;
  window.__catPrototype.run.coinProgress = 17;
  let now = 16;
  frame(now); // 最初の描画フレーム
  for (let i = 0; i < 3; i++) {
    const stage = window.__catPrototype.stage;
    stage.cat.x = 14000;
    stage.cat.y = 900;
    stage.cat.grounded = false;
    now += 17;
    frame(now);
    assert.equal(window.__catPrototype.run.lives, 2 - i);
    assert.equal(window.__catPrototype.run.score, 1234);
    assert.equal(window.__catPrototype.run.coinProgress, 17);
    if (i < 2) {
      assert.equal(window.__catPrototype.state, 'MISS');
      assert.equal(elements.get('#retryCountdown').textContent, '3');
      for (let tick = 0; tick < 29; tick++) { now += 100; frame(now); }
      assert.equal(window.__catPrototype.state, 'MISS');
      assert.equal(elements.get('#retryCountdown').textContent, '1');
      now += 100;
      frame(now);
      assert.equal(window.__catPrototype.state, 'PLAYING');
      assert.equal(window.__catPrototype.stage.coins.filter(coin => coin.collected).length, 0);
    }
  }
  assert.equal(window.__catPrototype.state, 'GAME_OVER');
  buttons[2].click();
  assert.equal(window.__catPrototype.state, 'PLAYING');
  assert.equal(window.__catPrototype.run.lives, 3);
  assert.equal(window.__catPrototype.run.score, 0);
  assert.equal(window.__catPrototype.run.coinProgress, 0);
  window.__catPrototype.run.score = 500;
  const lastStage = window.__catPrototype.stage;
  lastStage.cat.x = 21930;
  lastStage.cat.y = 500;
  now += 17;
  frame(now);
  assert.equal(window.__catPrototype.state, 'RESULT');
  assert.equal(window.__catPrototype.bestScore, 500);
  assert.equal(saved.get('cat-is-liquid-best-stage-score-v2'), '500');
  buttons[2].click();
  assert.equal(window.__catPrototype.run.score, 0);
  assert.equal(window.__catPrototype.bestScore, 500);

  // ミスで合計点は残るが、次のクリア挑戦は0点から始まり、ボタンなしで自動復帰する。
  window.__catPrototype.run.score = 2000;
  window.__catPrototype.run.coinProgress = 12;
  const failedStage = window.__catPrototype.stage;
  failedStage.cat.x = 14000;
  failedStage.cat.y = 900;
  failedStage.cat.grounded = false;
  now += 17;
  frame(now);
  assert.equal(window.__catPrototype.state, 'MISS');
  assert.equal(window.__catPrototype.run.lives, 2);
  for (let i = 0; i < 29; i++) { now += 100; frame(now); }
  assert.equal(window.__catPrototype.state, 'MISS');
  now += 100;
  frame(now);
  assert.equal(window.__catPrototype.state, 'PLAYING');
  assert.equal(window.__catPrototype.run.score, 2000);
  assert.equal(window.__catPrototype.run.coinProgress, 12);
  assert.equal(window.__catPrototype.attemptScore, 0);
  assert.ok(window.__catPrototype.stage.coins.every(coin => !coin.collected));
  window.__catPrototype.run.score += 600;
  const clearStage = window.__catPrototype.stage;
  clearStage.cat.x = 21930;
  clearStage.cat.y = 500;
  now += 17;
  frame(now);
  assert.equal(window.__catPrototype.state, 'RESULT');
  assert.equal(window.__catPrototype.run.score, 2600);
  assert.equal(window.__catPrototype.bestScore, 600);
  assert.equal(elements.get('#resultScore').textContent, '600');
  assert.equal(elements.get('#resultTotalScore').textContent, '2,600');
  assert.equal(saved.get('cat-is-liquid-best-stage-score-v2'), '600');

  // 逆走も通常のミスと同様に残機を減らし、自動再挑戦する。
  buttons[2].click();
  const reverseStage = window.__catPrototype.stage;
  reverseStage.cat.x = 2200;
  reverseStage.cat.y = 681;
  reverseStage.cat.vx = -1;
  now += 17;
  frame(now);
  assert.equal(window.__catPrototype.state, 'MISS');
  assert.equal(window.__catPrototype.run.lives, 2);
  assert.equal(elements.get('#scoreCount').textContent, '0');
});
