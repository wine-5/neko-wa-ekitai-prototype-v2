import { CONFIG as C } from './config.js';
import { newStage, stepStage } from './physics.js';
import { updateCamera } from './camera.js';
import { render } from './render.js';
import { newRun, collectCoin, landingPoints, loseLife } from './scoring.js';
import { createAudio } from './audio.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const screens = {
  TITLE: document.querySelector('#titleScreen'),
  STAGE_MAP: document.querySelector('#mapScreen'),
  PAUSED: document.querySelector('#pauseScreen'),
  SETTINGS: document.querySelector('#settingsScreen'),
  MISS: document.querySelector('#missScreen'),
  GAME_OVER: document.querySelector('#gameOverScreen'),
  WITCH_EVENT: document.querySelector('#witchScreen'),
  RESULT: document.querySelector('#resultScreen')
};
const hud = document.querySelector('#hud');
const bookCount = document.querySelector('#bookCount');
const scoreCount = document.querySelector('#scoreCount');
const lifeCount = document.querySelector('#lifeCount');
const coinProgress = document.querySelector('#coinProgress');
const statusToast = document.querySelector('#statusToast');
const flightDistance = document.querySelector('#flightDistance');
const flightRise = document.querySelector('#flightRise');
const flightTime = document.querySelector('#flightTime');
const flightTarget = document.querySelector('#flightTarget');
const stallFill = document.querySelector('#stallFill');
const stallText = document.querySelector('#stallText');
const stallWrap = document.querySelector('.stall-wrap');
const retryCountdown = document.querySelector('#retryCountdown');
const bgmVolume = document.querySelector('#bgmVolume');
const seVolume = document.querySelector('#seVolume');
const bgmVolumeValue = document.querySelector('#bgmVolumeValue');
const seVolumeValue = document.querySelector('#seVolumeValue');
const audio = createAudio(window);

let state = 'TITLE';
let stage = null;
let run = null;
let attemptStartScore = 0;
let missTime = 0;
let inputNeedsRelease = false;
let pickupEffects = [];
let toastUntil = 0;
let bestScore = 0;
// 旧キーの値はミス前の稼ぎを含み得るため、挑戦1回分の記録には引き継がない。
const bestScoreKey = 'cat-is-liquid-best-stage-score-v2';
try { bestScore = Math.max(0, Number(window.localStorage?.getItem(bestScoreKey)) || 0); } catch { /* file:// で保存不可の場合も遊べる */ }
let held = false;
let accumulator = 0;
let lastFrame = 0;
let displayTime = 0;
let witchTime = 0;
let bestAllBooksClear = false; // 暫定：ページを開いている間のみ
let settingsReturnState = 'TITLE';

function syncAudioControls() {
  bgmVolume.value = String(audio.getVolume('bgm'));
  seVolume.value = String(audio.getVolume('se'));
  bgmVolumeValue.textContent = `${bgmVolume.value}%`;
  seVolumeValue.textContent = `${seVolume.value}%`;
}
syncAudioControls();

function setState(next) {
  state = next;
  held = false;
  if (stage && next !== 'PLAYING') stage.wasHeld = false;
  accumulator = 0;
  for (const [name, element] of Object.entries(screens)) element.hidden = name !== next;
  hud.hidden = next !== 'PLAYING' && next !== 'PAUSED';
  const screen = screens[next];
  if (screen) screen.querySelector('button')?.focus({ preventScroll: true });
  else if (next === 'PLAYING') canvas.focus?.();
}

function startStage(continueRun = false) {
  if (!continueRun || !run) run = newRun();
  if (!continueRun) inputNeedsRelease = false;
  attemptStartScore = run.score;
  missTime = 0;
  stage = newStage();
  pickupEffects = [];
  toastUntil = 0;
  statusToast.hidden = true;
  updateHud();
  setState('PLAYING');
}

function updateHud() {
  if (!stage) return;
  bookCount.textContent = String(stage.count);
  scoreCount.textContent = run.score.toLocaleString('ja-JP');
  lifeCount.textContent = String(run.lives);
  coinProgress.textContent = `${run.coinProgress} / ${C.coinsPerLife}`;
  statusToast.hidden = displayTime >= toastUntil;
  const measuredDistance = stage.flight.active ? stage.flight.distance : stage.flight.lastDistance;
  const measuredRise = stage.flight.active ? stage.flight.rise : stage.flight.lastRise;
  flightDistance.textContent = measuredDistance > 0 ? String(Math.round(measuredDistance)) : '--';
  flightRise.textContent = measuredDistance > 0 ? String(Math.round(measuredRise)) : '--';
  flightTime.textContent = stage.flight.bestDuration > 0 ? stage.flight.bestDuration.toFixed(1) : '--';
  flightTarget.textContent = stage.flight.bestDuration >= C.flightTargetSeconds
    ? `${C.flightTargetSeconds}秒達成`
    : `目標 ${C.flightTargetSeconds.toFixed(1)}秒`;
  flightTarget.classList.toggle('achieved', stage.flight.bestDuration >= C.flightTargetSeconds);
  const percent = Math.min(100, Math.round(stage.stallTime / C.stallDuration * 100));
  stallFill.style.width = `${percent}%`;
  stallText.textContent = `${percent}%`;
  stallWrap.classList.toggle('danger', percent >= 55);
}

function consumeStageEvents() {
  for (const event of stage.events.splice(0)) {
    if (event.type === 'coin') {
      const gainedLife = collectCoin(run);
      audio.play('coin');
      pickupEffects.push({
        x: (event.x - stage.cameraX) * stage.cameraZoom,
        y: (event.y - stage.cameraY) * stage.cameraZoom,
        time: displayTime,
        seed: event.x
      });
      if (gainedLife) {
        audio.play('oneUp');
        statusToast.textContent = '1UP! 残機 +1';
        toastUntil = displayTime + 1.6;
      }
    } else if (event.type === 'landing') {
      audio.play('landing');
      const points = landingPoints(event);
      if (points > 0) {
        run.score += points;
        statusToast.textContent = `飛翔・着地 +${points.toLocaleString('ja-JP')}`;
        toastUntil = displayTime + 1.5;
      }
    }
  }
}

function finish(outcome) {
  held = false;
  if (outcome === 'fall' || outcome === 'stall' || outcome === 'reverse') {
    audio.play('miss');
    document.querySelector('#missReason').textContent = outcome === 'fall' ? '穴に落ちた' : outcome === 'reverse' ? '逆走してしまった' : '止まってしまった';
    inputNeedsRelease = true;
    const canRetry = loseLife(run);
    const summary = `残機 ${run.lives}　合計 ${run.score.toLocaleString('ja-JP')}　コイン ${run.coinProgress} / ${C.coinsPerLife}`;
    document.querySelector('#missStats').textContent = summary;
    document.querySelector('#gameOverStats').textContent = summary;
    missTime = 0;
    retryCountdown.textContent = String(C.missAutoRetrySeconds);
    setState(canRetry ? 'MISS' : 'GAME_OVER');
    return;
  }
  if (outcome === 'all_books') {
    audio.play('clear');
    bestAllBooksClear = true;
    witchTime = 0;
    setState('WITCH_EVENT');
  } else {
    audio.play('clear');
    showResult();
  }
}

function showResult() {
  if (!stage) return;
  const clearAttemptScore = run.score - attemptStartScore;
  if (clearAttemptScore > bestScore) {
    bestScore = clearAttemptScore;
    try { window.localStorage?.setItem(bestScoreKey, String(bestScore)); } catch { /* 保存できなくても進行可能 */ }
  }
  document.querySelector('#resultHeading').textContent = stage.count === 3 ? '本全回収クリア' : 'ステージクリア';
  document.querySelector('#resultBooks').textContent = String(stage.count);
  document.querySelector('#resultScore').textContent = clearAttemptScore.toLocaleString('ja-JP');
  document.querySelector('#bestScore').textContent = bestScore.toLocaleString('ja-JP');
  document.querySelector('#resultTotalScore').textContent = run.score.toLocaleString('ja-JP');
  document.querySelector('#resultMessage').textContent = stage.count === 3 ? 'ご主人の魔女も、あなたを待っていた。' : '出口にたどり着いた。もう一度挑戦して本を探そう。';
  setState('RESULT');
}

function pause() {
  if (state !== 'PLAYING') return;
  setState('PAUSED');
  updateHud();
}

function resume() {
  if (state !== 'PAUSED') return;
  setState('PLAYING');
  lastFrame = performance.now();
}

function action(name) {
  audio.unlock();
  if (name !== 'preview-se') audio.play('click');
  switch (name) {
    case 'map': setState('STAGE_MAP'); break;
    case 'title': setState('TITLE'); break;
    case 'play': case 'retry': startStage(); break;
    case 'settings':
      if (state === 'TITLE' || state === 'PAUSED') {
        settingsReturnState = state;
        syncAudioControls();
        setState('SETTINGS');
      }
      break;
    case 'close-settings': if (state === 'SETTINGS') setState(settingsReturnState); break;
    case 'preview-se': if (state === 'SETTINGS') audio.play('coin'); break;
    case 'resume': resume(); break;
    case 'result': showResult(); break;
  }
}

document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('click', () => action(button.dataset.action));
});
document.querySelector('#pauseButton').addEventListener('click', () => { audio.unlock(); audio.play('click'); pause(); });
for (const [channel, input, output] of [['bgm', bgmVolume, bgmVolumeValue], ['se', seVolume, seVolumeValue]]) {
  input.addEventListener('input', () => {
    audio.unlock();
    audio.setVolume(channel, input.value);
    output.textContent = `${audio.getVolume(channel)}%`;
  });
}
seVolume.addEventListener('change', () => audio.play('coin'));

window.addEventListener('keydown', event => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (state === 'PLAYING' && !inputNeedsRelease) held = true;
  } else if (event.code === 'Escape') {
    event.preventDefault();
    if (state === 'PLAYING') pause();
    else if (state === 'PAUSED') resume();
    else if (state === 'SETTINGS') action('close-settings');
  } else if (event.code === 'Enter' && event.target === document.body) {
    if (state === 'TITLE') action('map');
    else if (state === 'STAGE_MAP') action('play');
  }
});
window.addEventListener('keyup', event => { if (event.code === 'Space') { event.preventDefault(); held = false; inputNeedsRelease = false; } });
canvas.addEventListener('pointerdown', event => { if (state === 'PLAYING' && event.button === 0 && !inputNeedsRelease) { held = true; canvas.setPointerCapture(event.pointerId); } });
canvas.addEventListener('pointerup', () => { held = false; inputNeedsRelease = false; });
canvas.addEventListener('pointercancel', () => { held = false; inputNeedsRelease = false; });
window.addEventListener('blur', () => { held = false; if (state === 'PLAYING') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { held = false; if (state === 'PLAYING') pause(); } });

function frame(now) {
  if (!lastFrame) lastFrame = now;
  const delta = Math.min((now - lastFrame) / 1000, .1);
  lastFrame = now;
  displayTime += delta;
  audio.update(!document.hidden);

  if (state === 'PLAYING' && stage) {
    accumulator += delta;
    let ticks = 0;
    while (accumulator >= C.fixedStep && ticks++ < 16 && state === 'PLAYING') {
      const result = stepStage(stage, held, C.fixedStep);
      consumeStageEvents();
      accumulator -= C.fixedStep;
      if (result) finish(result);
    }
    updateCamera(stage, delta);
    updateHud();
  } else if (state === 'WITCH_EVENT') {
    witchTime += delta;
    if (witchTime >= 3.5) showResult();
  } else if (state === 'MISS' && !document.hidden) {
    missTime += delta;
    retryCountdown.textContent = String(Math.max(0, Math.ceil(C.missAutoRetrySeconds - missTime)));
    if (missTime >= C.missAutoRetrySeconds) startStage(true);
  }
  pickupEffects = pickupEffects.filter(effect => displayTime - effect.time <= .55);
  render(ctx, stage, state, displayTime, pickupEffects);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ローカルでの受け入れテスト用。通常の操作には不要。
window.__catPrototype = {
  get state() { return state; },
  get stage() { return stage; },
  get run() { return run; },
  get attemptScore() { return run ? run.score - attemptStartScore : 0; },
  get bestScore() { return bestScore; },
  get bestAllBooksClear() { return bestAllBooksClear; },
  start: startStage,
  pause,
  resume
};
