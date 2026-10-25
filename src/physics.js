import { CONFIG as C } from './config.js';

function terrainSample(x) {
  const phase = ((x % C.terrainPeriod) + C.terrainPeriod) % C.terrainPeriod;
  const points = C.terrainProfile;
  let i = 0;
  while (i < points.length - 2 && phase > points[i + 1].x) i++;
  const a = points[i], b = points[i + 1];
  const length = b.x - a.x;
  const t = (phase - a.x) / length;
  const rise = b.y - a.y;
  return {
    height: a.y + rise * (3 * t * t - 2 * t * t * t),
    slope: rise * (6 * t - 6 * t * t) / length,
    curvature: rise * (6 - 12 * t) / (length * length)
  };
}
export const terrainHeight = x => terrainSample(x).height;
export const terrainSlope = x => terrainSample(x).slope;
export const terrainCurvature = x => terrainSample(x).curvature;
export const hasGround = x => x >= 0 && x <= C.stageEnd && !C.gaps.some(g => x > g.start && x < g.end);

export function newStage() {
  return {
    cat: { x: C.initialX, y: terrainHeight(C.initialX) - C.catRadius, vx: C.initialSpeed, vy: 0, grounded: true, rotation: 0 },
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1,
    books: C.bookPositions.map((b, i) => ({ id: i, x: b.x, y: terrainHeight(b.x) - b.lift, collected: false })),
    coins: C.coinGroups.flatMap(group => Array.from({ length: group.count }, (_, i) => {
      const x = group.start + (group.end - group.start) * i / (group.count - 1);
      return { x, y: terrainHeight(x) - C.coinLift, collected: false };
    })),
    events: [],
    count: 0,
    wasHeld: false,
    flight: { active: false, startX: 0, startY: 0, startTime: 0, distance: 0, rise: 0, duration: 0, lastDistance: 0, lastRise: 0, lastDuration: 0, bestDuration: 0 },
    stallTime: 0,
    elapsed: 0,
    outcome: null,
    lastLanding: 0,
    flights: 0
  };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// 固定刻みでのみ呼ぶ。結果はミス理由・クリア種別、または null。
export function stepStage(stage, held, dt = C.fixedStep) {
  if (stage.outcome) return stage.outcome;
  const cat = stage.cat;
  const previousX = cat.x;
  const previousY = cat.y;
  const released = stage.wasHeld && !held;
  stage.wasHeld = held;
  stage.elapsed += dt;

  if (cat.grounded) {
    const slope = terrainSlope(cat.x);
    const curve = terrainCurvature(cat.x);
    const phase = ((cat.x % C.terrainPeriod) + C.terrainPeriod) % C.terrainPeriod;
    const gravity = held ? C.gravityHeld : C.gravityNormal;
    const rampRelease = released && slope < C.releaseSlopeMaximum && cat.vx > C.releaseSpeedMinimum;
    const launch = !held && phase >= 3000 && phase < 3200 && slope > -0.10 && slope < -0.045 && cat.vx > C.launchSpeedMinimum &&
      curve > C.launchCurvatureMinimum && cat.vx * cat.vx * curve > gravity * C.launchCurvatureFactor;
    if (rampRelease || launch) {
      cat.grounded = false;
      cat.vy = rampRelease
        ? slope * cat.vx - clamp(cat.vx * C.releaseLiftFactor, 0, C.releaseLiftMax)
        : slope * cat.vx - clamp((cat.vx - 130) * C.launchLiftFactor, 0, C.launchLiftMax);
      stage.flight.active = true;
      stage.flight.startX = cat.x;
      stage.flight.startY = cat.y;
      stage.flight.startTime = stage.elapsed;
      stage.flight.distance = 0;
      stage.flight.rise = 0;
      stage.flight.duration = 0;
      stage.flights++;
    } else {
      cat.vx = clamp(cat.vx + (gravity * slope / (1 + slope * slope) - C.groundDrag * cat.vx) * dt, -C.maxSpeed, C.maxSpeed);
      const nextX = cat.x + cat.vx * dt;
      if (hasGround(nextX)) {
        cat.x = nextX;
        cat.y = terrainHeight(cat.x) - C.catRadius;
        cat.vy = terrainSlope(cat.x) * cat.vx;
        cat.rotation = Math.atan(terrainSlope(cat.x));
      } else {
        cat.grounded = false;
        cat.vy = slope * cat.vx;
        stage.flight.active = true;
        stage.flight.startX = cat.x;
        stage.flight.startY = cat.y;
        stage.flight.startTime = stage.elapsed;
        stage.flight.distance = 0;
        stage.flight.rise = 0;
        stage.flight.duration = 0;
      }
    }
  }

  if (!cat.grounded) {
    cat.vy += (held ? C.gravityHeld : C.gravityAirReleased) * dt;
    cat.vx *= 1 - C.airDrag * dt;
    cat.x += cat.vx * dt;
    cat.y += cat.vy * dt;
    if (stage.flight.active) {
      stage.flight.distance = Math.max(0, cat.x - stage.flight.startX);
      stage.flight.rise = Math.max(stage.flight.rise, stage.flight.startY - cat.y);
      stage.flight.duration = stage.elapsed - stage.flight.startTime;
      stage.flight.bestDuration = Math.max(stage.flight.bestDuration, stage.flight.duration);
    }
    cat.rotation = clamp(Math.atan2(cat.vy, Math.max(120, cat.vx)) * 0.45, -0.55, 0.75);
    const groundNow = terrainHeight(cat.x) - C.catRadius;
    const groundBefore = terrainHeight(previousX) - C.catRadius;
    const fromAbove = previousY <= groundBefore + 8;
    if (hasGround(cat.x) && cat.y >= groundNow && !fromAbove && !hasGround(previousX)) {
      // 穴の内側から斜面へ横入りした場合は、縁で止めて穴へ落とす。
      const lip = C.gaps.find(gap => previousX < gap.end && cat.x >= gap.end);
      if (lip) {
        cat.x = lip.end - C.catRadius - 0.01;
        cat.vx = 0;
      }
    } else if (hasGround(cat.x) && cat.y >= groundNow) {
      cat.grounded = true;
      cat.y = groundNow;
      // 着地衝撃を接線方向へ投影。低速になることもある。
      const slope = terrainSlope(cat.x);
      cat.vx = clamp((cat.vx + cat.vy * slope) / (1 + slope * slope) * C.landingSpeedRetention, -C.maxSpeed, C.maxSpeed);
      cat.vy = slope * cat.vx;
      cat.rotation = Math.atan(slope);
      stage.lastLanding = stage.elapsed;
      if (stage.flight.active) {
        stage.flight.lastDistance = stage.flight.distance;
        stage.flight.lastRise = stage.flight.rise;
        stage.flight.lastDuration = stage.flight.duration;
        stage.events.push({ type: 'landing', duration: stage.flight.duration, distance: stage.flight.distance, speed: Math.abs(cat.vx) });
        stage.flight.active = false;
      }
    }
  }

  for (const book of stage.books) {
    if (!book.collected && Math.hypot(cat.x - book.x, cat.y - book.y) <= C.catRadius + C.bookRadius) {
      book.collected = true;
      stage.count++;
    }
  }

  for (const coin of stage.coins) {
    if (!coin.collected && Math.hypot(cat.x - coin.x, cat.y - coin.y) <= C.catRadius + C.coinRadius) {
      coin.collected = true;
      stage.events.push({ type: 'coin', x: coin.x, y: coin.y });
    }
  }

  if (cat.grounded && Math.abs(cat.vx) < C.stallSpeedThreshold) stage.stallTime += dt;
  else stage.stallTime = 0;

  // ゴール到達を同フレームの死亡より優先する。
  if (cat.x >= C.stageEnd - 80 && cat.y < C.deathY) {
    stage.outcome = stage.count === 3 ? 'all_books' : 'normal';
  } else if (cat.y - C.catRadius > C.deathY) {
    stage.outcome = 'fall';
  } else if (cat.grounded && cat.x < previousX - 1e-9) {
    // 接地中に実際の位置が左へ動き始めたら、そのフレームで逆走ミスにする。
    stage.outcome = 'reverse';
  } else if (stage.stallTime >= C.stallDuration - 1e-9) {
    stage.outcome = 'stall';
  }
  return stage.outcome;
}
