import { CONFIG as C } from './config.js';

export function newRun() {
  return { lives: C.initialLives, score: 0, coinProgress: 0 };
}

export function collectCoin(run) {
  run.score += C.coinScore;
  run.coinProgress++;
  if (run.coinProgress >= C.coinsPerLife) {
    run.coinProgress = 0;
    if (run.lives < C.maxLives) {
      run.lives++;
      return true;
    }
  }
  return false;
}

export function landingPoints({ duration, distance, speed }) {
  if (duration + 1e-9 < C.minimumScoredFlight) return 0;
  const timePoints = Math.floor((duration + 1e-8) / C.flightTimeUnit) * C.flightTimeUnitScore;
  const distancePoints = Math.floor((distance + 1e-8) / C.flightDistanceUnit) * C.flightDistanceUnitScore;
  const speedPoints = C.landingSpeedScores.find(tier => speed >= tier.speed)?.score ?? 0;
  return timePoints + distancePoints + speedPoints;
}

export function loseLife(run) {
  run.lives = Math.max(0, run.lives - 1);
  return run.lives > 0;
}
