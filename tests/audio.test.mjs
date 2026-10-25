import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio.js';

test('BGMとSEの音量を別々に保存し、次回起動で復元する', () => {
  const saved = new Map();
  const win = { localStorage: {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value)
  } };
  const audio = createAudio(win);
  assert.equal(audio.getVolume('bgm'), 40);
  assert.equal(audio.getVolume('se'), 65);
  audio.setVolume('bgm', 0);
  audio.setVolume('se', 75);
  assert.equal(audio.getVolume('bgm'), 0);
  assert.equal(audio.getVolume('se'), 75);
  assert.equal(saved.get('cat-is-liquid-bgm-volume'), '0');
  assert.equal(saved.get('cat-is-liquid-se-volume'), '75');
  const reopened = createAudio(win);
  assert.equal(reopened.getVolume('bgm'), 0);
  assert.equal(reopened.getVolume('se'), 75);
});

test('仮BGMとSEは独立してミュートできる', () => {
  const gains = [];
  let tones = 0;
  class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    createGain() {
      const node = { gain: {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {}
      }, connect() {} };
      gains.push(node);
      return node;
    }
    createOscillator() {
      tones++;
      return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
    }
  }
  const audio = createAudio({ AudioContext: FakeAudioContext });
  assert.equal(audio.unlock(), true);
  audio.update(true);
  assert.ok(tones > 0);
  const bgmGain = gains[0];
  const seGain = gains[1];
  assert.ok(bgmGain.gain.value > 0);
  assert.ok(seGain.gain.value > 0);
  const beforeCue = tones;
  audio.play('coin');
  assert.ok(tones > beforeCue);
  audio.setVolume('bgm', 0);
  assert.equal(bgmGain.gain.value, 0);
  assert.ok(seGain.gain.value > 0);
  audio.setVolume('se', 0);
  assert.equal(seGain.gain.value, 0);
  const mutedCount = tones;
  audio.play('coin');
  assert.equal(tones, mutedCount);
});
