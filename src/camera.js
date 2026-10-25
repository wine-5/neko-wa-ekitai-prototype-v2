import { CONFIG as C } from './config.js';
import { terrainHeight } from './physics.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const ease = (response, dt) => 1 - Math.exp(-response * dt);

export function updateCamera(stage, dt) {
  const clearance = Math.max(0, terrainHeight(stage.cat.x) - stage.cat.y);
  const desiredZoom = clamp(C.cameraFramingHeight / Math.max(C.cameraFramingHeight, clearance), C.cameraMinZoom, 1);
  stage.cameraZoom += (desiredZoom - stage.cameraZoom) * ease(C.cameraZoomResponse, dt);

  const visibleWidth = C.width / stage.cameraZoom;
  const targetX = clamp(stage.cat.x - C.width * C.cameraAnchor / stage.cameraZoom, 0, Math.max(0, C.stageEnd - visibleWidth));
  const targetY = Math.min(0, stage.cat.y - C.height * C.cameraVerticalAnchor / stage.cameraZoom);
  stage.cameraX += (targetX - stage.cameraX) * ease(C.cameraHorizontalResponse, dt);
  stage.cameraY += (targetY - stage.cameraY) * ease(C.cameraVerticalResponse, dt);
}
