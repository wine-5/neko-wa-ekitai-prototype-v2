import { CONFIG as C } from './config.js';
import { terrainHeight, hasGround } from './physics.js';

const W = C.width, H = C.height;
const TAU = Math.PI * 2;
const coinImage = typeof Image === 'undefined' ? null : new Image();
const sparkImage = typeof Image === 'undefined' ? null : new Image();
if (coinImage) coinImage.src = './assets/coin-moon.png';
if (sparkImage) sparkImage.src = './assets/coin-pickup-spark.png';

const hash = n => {
  const v = Math.sin(n * 127.1 + 19.19) * 43758.5453;
  return v - Math.floor(v);
};

function star(ctx, x, y, r, color = '#d9d5ff') {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * .18, -r * .18, r, 0);
  ctx.quadraticCurveTo(r * .18, r * .18, 0, r); ctx.quadraticCurveTo(-r * .18, r * .18, -r, 0);
  ctx.quadraticCurveTo(-r * .18, -r * .18, 0, -r); ctx.fill(); ctx.restore();
}

function sky(ctx, camera, time) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#080e2d'); bg.addColorStop(.56, '#263274'); bg.addColorStop(1, '#9a75bd');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const moonX = 960 - camera * .018;
  const halo = ctx.createRadialGradient(moonX, 115, 20, moonX, 115, 170);
  halo.addColorStop(0, '#b6c7ff80'); halo.addColorStop(1, '#5d66c700');
  ctx.fillStyle = halo; ctx.fillRect(moonX - 170, -55, 340, 340);
  ctx.fillStyle = '#c6d5ff'; ctx.beginPath(); ctx.arc(moonX, 112, 58, 0, TAU); ctx.fill();
  ctx.fillStyle = '#b1c0f7'; ctx.beginPath(); ctx.arc(moonX + 16, 98, 53, 0, TAU); ctx.fill();
  for (let i = 0; i < 76; i++) {
    const x = (hash(i + 1) * 1600 - camera * .035) % 1600;
    const y = 20 + hash(i + 600) * 360;
    const twinkle = .6 + .4 * Math.sin(time * (1 + hash(i + 44) * 2) + i);
    ctx.globalAlpha = twinkle;
    if (i % 11 === 0) star(ctx, x, y, 3 + hash(i + 18) * 3);
    else { ctx.fillStyle = '#e8e4ff'; ctx.fillRect(x, y, 1.6, 1.6); }
  }
  ctx.globalAlpha = 1;

  // 遠景の塔と橋
  ctx.fillStyle = '#172150a8';
  for (let i = -1; i < 10; i++) {
    const x = i * 190 - (camera * .12 % 190);
    const top = 175 + 55 * hash(i + 80);
    ctx.fillRect(x, top, 110, H - top);
    ctx.beginPath(); ctx.moveTo(x - 12, top); ctx.lineTo(x + 55, top - 63); ctx.lineTo(x + 122, top); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9b8ddd4d';
    for (let j = 0; j < 5; j++) { ctx.fillRect(x + 28, top + 28 + j * 67, 12, 29); ctx.fillRect(x + 68, top + 28 + j * 67, 12, 29); }
    ctx.fillStyle = '#172150a8';
  }
  ctx.strokeStyle = '#c2a0df33'; ctx.lineWidth = 4;
  for (let k = 0; k < 2; k++) {
    ctx.beginPath(); ctx.moveTo(-30, 295 + k * 95); ctx.bezierCurveTo(340, 265 + k * 96, 740, 350 + k * 95, 1320, 288 + k * 95); ctx.stroke();
  }
}

function shelves(ctx, camera) {
  const spacing = 220;
  const shift = camera * .28 % spacing;
  for (let i = -1; i < 8; i++) {
    const x = i * spacing - shift;
    ctx.fillStyle = '#08152fc2'; ctx.fillRect(x, 170, 184, 455);
    ctx.strokeStyle = '#b9856799'; ctx.lineWidth = 5; ctx.strokeRect(x + 3, 170, 178, 455);
    ctx.strokeStyle = '#a2797399'; ctx.lineWidth = 2; ctx.strokeRect(x + 13, 182, 158, 430);
    ctx.fillStyle = '#caa26955';
    for (let row = 0; row < 5; row++) {
      const y = 244 + row * 74;
      ctx.fillRect(x + 15, y, 155, 5);
      for (let j = 0; j < 11; j++) {
        const bw = 7 + Math.floor(hash(i * 23 + j * 7 + row) * 7);
        const bh = 30 + hash(i * 7 + j + row * 50) * 24;
        const bx = x + 19 + j * 13.2;
        ctx.fillStyle = ['#625177', '#344778', '#72546d', '#8f6b72'][Math.floor(hash(i * 40 + j * 9 + row) * 4)];
        ctx.fillRect(bx, y - bh, bw, bh - 1);
        ctx.fillStyle = '#d5b88a88'; ctx.fillRect(bx + 2, y - bh + 7, 1, 14);
      }
    }
    ctx.fillStyle = '#d8b074'; ctx.beginPath(); ctx.arc(x + 92, 199, 5, 0, TAU); ctx.fill();
  }
  const fade = ctx.createLinearGradient(0, 200, 0, 660);
  fade.addColorStop(0, '#5261ac00'); fade.addColorStop(1, '#5363a46f');
  ctx.fillStyle = fade; ctx.fillRect(0, 200, W, 460);
}

function gapDecoration(ctx, camera, visibleWidth) {
  for (const gap of C.gaps) {
    const left = gap.start - camera, right = gap.end - camera;
    if (right < -80 || left > visibleWidth + 80) continue;
    const top = Math.min(terrainHeight(gap.start), terrainHeight(gap.end));
    const glow = ctx.createLinearGradient(0, top, 0, 720);
    glow.addColorStop(0, '#251347'); glow.addColorStop(.8, '#5b328c'); glow.addColorStop(1, '#111031');
    ctx.fillStyle = glow; ctx.fillRect(left, top, right - left, 720 - top);
    ctx.fillStyle = '#a463f799';
    for (let x = left + 6; x < right - 4; x += 20) {
      const h = 35 + hash(Math.floor(x + camera)) * 58;
      ctx.beginPath(); ctx.moveTo(x, 720); ctx.lineTo(x + 9, 720 - h); ctx.lineTo(x + 19, 720); ctx.fill();
    }
  }
}

function terrain(ctx, camera, visibleWidth) {
  const fill = ctx.createLinearGradient(0, 370, 0, H);
  fill.addColorStop(0, '#3f3b68'); fill.addColorStop(.25, '#192448'); fill.addColorStop(1, '#0a1029');
  let x = Math.max(0, Math.floor(camera / 8) * 8);
  const stop = Math.min(C.stageEnd + 2, camera + visibleWidth + 12);
  while (x < stop) {
    while (x < stop && !hasGround(x + 1)) x += 4;
    if (x >= stop) break;
    const start = x;
    let end = x;
    while (end < stop && hasGround(end + 1)) end += 4;
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(start - camera, terrainHeight(start));
    for (let wx = start + 4; wx <= end; wx += 4) ctx.lineTo(wx - camera, terrainHeight(wx));
    ctx.lineTo(end - camera, H + 10); ctx.lineTo(start - camera, H + 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#cbb797'; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(start - camera, terrainHeight(start));
    for (let wx = start + 4; wx <= end; wx += 4) ctx.lineTo(wx - camera, terrainHeight(wx));
    ctx.stroke();
    ctx.strokeStyle = '#8473b6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(start - camera, terrainHeight(start) + 8);
    for (let wx = start + 4; wx <= end; wx += 6) ctx.lineTo(wx - camera, terrainHeight(wx) + 8);
    ctx.stroke();
    ctx.strokeStyle = '#caa56436'; ctx.lineWidth = 2;
    for (let wx = Math.ceil(start / 42) * 42; wx < end; wx += 42) {
      const sy = terrainHeight(wx) + 16;
      ctx.beginPath(); ctx.moveTo(wx - camera, sy); ctx.lineTo(wx - camera - 10, sy + 70); ctx.stroke();
    }
    x = end + 4;
  }
  for (const gap of C.gaps) {
    const left = gap.start - camera, right = gap.end - camera;
    if (right < -30 || left > visibleWidth + 30) continue;
    for (const edge of [gap.start, gap.end]) {
      const sx = edge - camera;
      const sy = terrainHeight(edge);
      ctx.strokeStyle = '#fff0b4'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sx, sy - 2); ctx.lineTo(sx, sy + 48); ctx.stroke();
      star(ctx, sx, sy - 8, 7, '#ffe5a7');
    }
  }
}

function jumpMarkers(ctx, camera, time, visibleWidth) {
  const first = Math.max(0, Math.floor(camera / C.terrainPeriod) - 1);
  const last = Math.min(Math.ceil(C.stageEnd / C.terrainPeriod), Math.floor((camera + visibleWidth) / C.terrainPeriod) + 1);
  for (let cycle = first; cycle <= last; cycle++) {
    for (const marker of [
      { x: cycle * C.terrainPeriod + 1050, label: 'SPACE 長押し', color: '#a5c8ff' },
      { x: cycle * C.terrainPeriod + 2860, label: 'SPACE を離す', color: '#ffdc95' }
    ]) {
      const sx = marker.x - camera;
      if (sx < -100 || sx > visibleWidth + 100) continue;
      const ground = terrainHeight(marker.x);
      const y = ground - 100 + Math.sin(time * 2 + cycle) * 3;
      ctx.save();
      ctx.fillStyle = '#08132cdb';
      ctx.strokeStyle = marker.color;
      ctx.lineWidth = 2;
      ctx.fillRect(sx - 91, y - 18, 182, 37);
      ctx.strokeRect(sx - 91, y - 18, 182, 37);
      ctx.fillStyle = marker.color;
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.label, sx, y + 1);
      ctx.strokeStyle = marker.color;
      ctx.globalAlpha = .7;
      ctx.beginPath(); ctx.moveTo(sx, y + 20); ctx.lineTo(sx, ground - 11); ctx.stroke();
      star(ctx, sx, ground - 10, 5, marker.color);
      ctx.restore();
    }
  }
}

function book(ctx, x, y, time, index) {
  const bob = Math.sin(time * 2.8 + index * 2.7) * 7;
  ctx.save(); ctx.translate(x, y + bob); ctx.rotate(Math.sin(time * 1.5 + index) * .12);
  const halo = ctx.createRadialGradient(0, 0, 8, 0, 0, 55);
  halo.addColorStop(0, '#ffe2a177'); halo.addColorStop(1, '#e3adff00');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 55, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ead8aa'; ctx.fillRect(-16, -20, 32, 40);
  ctx.fillStyle = '#53356c'; ctx.fillRect(-13, -23, 28, 40);
  ctx.strokeStyle = '#ffda85'; ctx.lineWidth = 2.4; ctx.strokeRect(-13, -23, 28, 40);
  ctx.strokeStyle = '#efbd80'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -17); ctx.lineTo(-8, 12); ctx.stroke();
  star(ctx, 1, -4, 9, '#f7d891');
  ctx.restore();
}

function coin(ctx, x, y, zoom) {
  const diameter = 42 / Math.sqrt(zoom);
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = '#ffdc87';
  ctx.shadowBlur = 12 / Math.sqrt(zoom);
  if (coinImage?.complete && coinImage.naturalWidth) {
    ctx.drawImage(coinImage, -diameter / 2, -diameter / 2, diameter, diameter);
  } else {
    ctx.fillStyle = '#edba5b';
    ctx.beginPath(); ctx.arc(0, 0, diameter * .42, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff0b4'; ctx.lineWidth = 2 / zoom; ctx.stroke();
    ctx.fillStyle = '#243062'; ctx.beginPath(); ctx.arc(diameter * .04, -diameter * .01, diameter * .21, 0, TAU); ctx.fill();
    ctx.fillStyle = '#edba5b'; ctx.beginPath(); ctx.arc(diameter * .12, -diameter * .08, diameter * .17, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function pickupEffects(ctx, effects, time) {
  for (const effect of effects) {
    const age = time - effect.time;
    if (age < 0 || age > .55) continue;
    ctx.save();
    const fade = Math.max(0, 1 - age / .55);
    ctx.globalAlpha = fade;
    if (sparkImage?.complete && sparkImage.naturalWidth) {
      const size = 44 + age * 140;
      ctx.drawImage(sparkImage, effect.x - size / 2, effect.y - size / 2, size, size);
    } else star(ctx, effect.x, effect.y, 15 + age * 40, '#fff2b9');
    for (let i = 0; i < 5; i++) {
      const angle = i * TAU / 5 + effect.seed;
      const radius = 8 + age * 65;
      star(ctx, effect.x + Math.cos(angle) * radius, effect.y + Math.sin(angle) * radius, 2 + 4 * fade, '#ffe3a2');
    }
    ctx.fillStyle = '#fff3cf'; ctx.shadowColor = '#ffcb76'; ctx.shadowBlur = 8;
    ctx.font = 'bold 19px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('+100', effect.x, effect.y - 30 - age * 42);
    ctx.restore();
  }
}

function portal(ctx, x, y, time) {
  ctx.save(); ctx.translate(x, y);
  const halo = ctx.createRadialGradient(0, -58, 10, 0, -58, 115);
  halo.addColorStop(0, '#a97cffaa'); halo.addColorStop(1, '#9962e000');
  ctx.fillStyle = halo; ctx.fillRect(-115, -175, 230, 225);
  ctx.fillStyle = '#17264d'; ctx.strokeStyle = '#efcf88'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-55, 0); ctx.lineTo(-55, -80); ctx.bezierCurveTo(-55, -154, 55, -154, 55, -80); ctx.lineTo(55, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6947a9'; ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-44, -79); ctx.bezierCurveTo(-44, -138, 44, -138, 44, -79); ctx.lineTo(44, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e8b7ff'; ctx.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = .65 - i * .15;
    ctx.beginPath(); ctx.ellipse(0, -68, 22 + i * 11, 52 + i * 11, .2 + time * .13, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1; star(ctx, 0, -87, 15, '#fff2bd');
  ctx.restore();
}

function cat(ctx, x, y, rotation, time, large = false, scaleBoost = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); const s = (large ? 2.25 : 1) * scaleBoost; ctx.scale(s, s);
  const bob = large ? Math.sin(time * 2) * 2 : 0; ctx.translate(0, bob);
  ctx.shadowColor = '#d6baff'; ctx.shadowBlur = 12; ctx.strokeStyle = '#d1b7f6'; ctx.lineWidth = 2;
  // しっぽ
  ctx.beginPath(); ctx.moveTo(-16, 4); ctx.bezierCurveTo(-33, 10, -34, -13, -23, -15); ctx.bezierCurveTo(-14, -17, -16, -7, -24, -8); ctx.stroke();
  ctx.fillStyle = '#070917'; ctx.beginPath(); ctx.ellipse(-2, 2, 19, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(7, -25); ctx.lineTo(15, -15); ctx.lineTo(21, -25); ctx.lineTo(25, -5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(14, -6, 12, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffe86f'; ctx.beginPath(); ctx.ellipse(19, -8, 3.5, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#14121c'; ctx.fillRect(20, -12, 1.5, 8);
  ctx.strokeStyle = '#d5a56d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(13, 1, 8, .25, 2.8); ctx.stroke();
  ctx.fillStyle = '#f1cc73'; ctx.beginPath(); ctx.arc(13, 9, 2.5, 0, TAU); ctx.fill();
  ctx.restore();
}

export function render(ctx, stage, state, time, effects = []) {
  const camera = stage && state !== 'TITLE' && state !== 'STAGE_MAP' ? stage.cameraX : 0;
  const zoom = stage && state !== 'TITLE' && state !== 'STAGE_MAP' ? stage.cameraZoom : 1;
  sky(ctx, camera, time);
  const backgroundZoom = .68 + .32 * zoom;
  ctx.save();
  ctx.translate(W * (1 - backgroundZoom) * .5, H * (1 - backgroundZoom));
  ctx.scale(backgroundZoom, backgroundZoom);
  shelves(ctx, camera);
  ctx.restore();
  if (stage && state !== 'TITLE' && state !== 'STAGE_MAP') {
    ctx.save();
    ctx.translate(0, -stage.cameraY * zoom);
    ctx.scale(zoom, zoom);
    const visibleWidth = W / zoom;
    gapDecoration(ctx, camera, visibleWidth);
    terrain(ctx, camera, visibleWidth);
    jumpMarkers(ctx, camera, time, visibleWidth);
    for (const c of stage.coins) if (!c.collected && c.x >= camera - 60 && c.x <= camera + visibleWidth + 60) coin(ctx, c.x - camera, c.y, zoom);
    for (const b of stage.books) if (!b.collected) book(ctx, b.x - camera, b.y, time, b.id);
    portal(ctx, C.stageEnd - 80 - camera, terrainHeight(C.stageEnd - 80), time);
    cat(ctx, stage.cat.x - camera, stage.cat.y, stage.cat.rotation, time, false, 1 / Math.sqrt(zoom));
    ctx.restore();
  } else {
    gapDecoration(ctx, camera, W);
    terrain(ctx, camera, W);
    portal(ctx, 1030, terrainHeight(1020), time);
    cat(ctx, 943, terrainHeight(943) - 19, 0, time, true);
    book(ctx, 1090, 250, time, 1);
  }
  // 視野の上下を少し暗くして操作対象を際立たせる。
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, '#02051c55'); shade.addColorStop(.35, '#02051c00'); shade.addColorStop(.75, '#02051c00'); shade.addColorStop(1, '#02051c88');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
  pickupEffects(ctx, effects, time);
}
