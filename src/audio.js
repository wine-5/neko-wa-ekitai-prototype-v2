// HTML試作用の仮音声。外部素材なしでWeb Audio APIから生成する。
const KEYS = { bgm: 'cat-is-liquid-bgm-volume', se: 'cat-is-liquid-se-volume' };
const DEFAULTS = { bgm: 40, se: 65 };
const MELODY = [293.66, 349.23, 440, 587.33, 523.25, 440, 349.23, 329.63,
  293.66, 349.23, 440, 659.25, 587.33, 440, 349.23, 261.63];

function clampPercent(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

export function createAudio(win) {
  const volumes = { ...DEFAULTS };
  for (const channel of ['bgm', 'se']) {
    try {
      const saved = win.localStorage?.getItem(KEYS[channel]);
      if (saved !== null && saved !== undefined) volumes[channel] = clampPercent(saved, DEFAULTS[channel]);
    } catch { /* file://で保存できない場合も音は鳴らせる */ }
  }

  let context = null;
  let bgmBus = null;
  let seBus = null;
  let nextNote = 0;
  let noteIndex = 0;
  let musicActive = false;

  const level = channel => (volumes[channel] / 100) ** 2 * (channel === 'bgm' ? 0.55 : 0.42);
  function applyVolumes() {
    if (bgmBus) bgmBus.gain.value = musicActive ? level('bgm') : 0;
    if (seBus) seBus.gain.value = level('se');
  }

  function tone(frequency, at, duration, bus, type = 'sine', strength = 0.2, endFrequency = frequency) {
    if (!context || !bus) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, strength), at + Math.min(0.018, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  function unlock() {
    if (!context) {
      const AudioContext = win.AudioContext || win.webkitAudioContext;
      if (!AudioContext) return false;
      try {
        context = new AudioContext();
        bgmBus = context.createGain();
        seBus = context.createGain();
        bgmBus.connect(context.destination);
        seBus.connect(context.destination);
        applyVolumes();
      } catch { context = null; return false; }
    }
    if (context.state === 'suspended') context.resume()?.catch?.(() => {});
    return true;
  }

  function getVolume(channel) { return volumes[channel]; }

  function setVolume(channel, value) {
    if (!(channel in volumes)) return;
    volumes[channel] = clampPercent(value, volumes[channel]);
    applyVolumes();
    try { win.localStorage?.setItem(KEYS[channel], String(volumes[channel])); } catch { /* 保存不可でも操作は続ける */ }
  }

  function update(active) {
    if (!context) return;
    if (musicActive !== active) {
      musicActive = active;
      if (active) nextNote = context.currentTime + 0.03;
      applyVolumes();
    }
    if (!active || context.state !== 'running' || volumes.bgm === 0) return;
    const now = context.currentTime;
    if (nextNote < now) nextNote = now + 0.03;
    while (nextNote < now + 0.16) {
      tone(MELODY[noteIndex % MELODY.length], nextNote, 0.52, bgmBus, 'triangle', 0.16);
      if (noteIndex % 4 === 0) tone(MELODY[noteIndex % MELODY.length] / 2, nextNote, 1.4, bgmBus, 'sine', 0.11);
      noteIndex++;
      nextNote += 0.48;
    }
  }

  function play(kind) {
    if (!context || volumes.se === 0) return;
    const now = context.currentTime + 0.005;
    if (kind === 'coin') {
      tone(740, now, 0.11, seBus, 'sine', 0.36, 1050);
      tone(1110, now + 0.07, 0.16, seBus, 'sine', 0.25);
    } else if (kind === 'oneUp') {
      [523, 659, 784, 1046].forEach((pitch, i) => tone(pitch, now + i * 0.09, 0.24, seBus, 'triangle', 0.3));
    } else if (kind === 'landing') {
      tone(220, now, 0.14, seBus, 'triangle', 0.23, 170);
    } else if (kind === 'miss') {
      tone(330, now, 0.44, seBus, 'triangle', 0.3, 120);
    } else if (kind === 'clear') {
      [392, 523, 659, 784].forEach((pitch, i) => tone(pitch, now + i * 0.12, 0.42, seBus, 'sine', 0.28));
    } else {
      tone(600, now, 0.09, seBus, 'sine', 0.18, 800);
    }
  }

  return { unlock, getVolume, setVolume, update, play };
}
