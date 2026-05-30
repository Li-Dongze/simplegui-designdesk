import type {
  AbstractKey,
  DinoCloudState,
  DinoGameOverlay,
  DinoObstacleKind,
  DinoObstacleState,
  DinoStarState,
  MonoBitmap,
} from "@/types/project";
import { drawSpriteMask, drawSpriteMaskScaled, getChromeDinoSpritePack } from "@/utils/chromeDinoSprites";

const LCD_WIDTH = 128;
const LCD_HEIGHT = 64;
const GROUND_Y = 54;
const DINO_X = 18;

const DINO_STAND_WIDTH = 18;
const DINO_STAND_HEIGHT = 20;
const DINO_DUCK_WIDTH = 24;
const DINO_DUCK_HEIGHT = 10;

const BASE_SPEED = 36;
const MAX_SPEED = 78;
const ACCELERATION = 2.8;
const GRAVITY = 285;
const INITIAL_JUMP_VELOCITY = -134;
const DROP_VELOCITY = -62;
const SPEED_DROP_COEFFICIENT = 2.9;
const MIN_JUMP_RISE = 15;
const MAX_JUMP_RISE = 30;
const MAX_STEP_MS = 80;

const RUN_FRAME_MS = 84;
const DUCK_FRAME_MS = 120;
const DUCK_HOLD_MS = 150;

const CLOUD_SPEED_RATIO = 0.22;
const CLOUD_FREQUENCY = 0.45;
const MAX_CLOUDS = 4;
const MIN_CLOUD_GAP = 24;
const MAX_CLOUD_GAP = 60;
const MIN_CLOUD_Y = 4;
const MAX_CLOUD_Y = 16;

const NIGHT_SCORE_INTERVAL = 140;
const NIGHT_FADE_PER_MS = 0.0018;
const MOON_SPEED_RATIO = 0.17;
const STAR_SPEED_RATIO = 0.22;

const MAX_OBSTACLE_DUPLICATION = 2;
const MAX_OBSTACLE_GROUP = 3;
const MAX_GAP_COEFFICIENT = 1.5;

type Rect = { x: number; y: number; width: number; height: number };
type ObstacleConfig = {
  kind: DinoObstacleKind;
  width: number;
  height: number;
  yPos: number | number[];
  minGap: number;
  minSpeed: number;
  multipleSpeed: number;
  speedOffset: number;
  numFrames: 1 | 2;
  frameRateMs: number;
  collisionBoxes: Rect[];
};

const OBSTACLE_CONFIGS: Record<DinoObstacleKind, ObstacleConfig> = {
  cactusSmall: {
    kind: "cactusSmall",
    width: 7,
    height: 13,
    yPos: GROUND_Y - 13 + 1,
    minGap: 24,
    minSpeed: 0,
    multipleSpeed: 42,
    speedOffset: 0,
    numFrames: 1,
    frameRateMs: 1000,
    collisionBoxes: [
      { x: 0, y: 2, width: 2, height: 10 },
      { x: 2, y: 0, width: 3, height: 13 },
      { x: 5, y: 2, width: 2, height: 6 },
    ],
  },
  cactusLarge: {
    kind: "cactusLarge",
    width: 9,
    height: 18,
    yPos: GROUND_Y - 18 + 1,
    minGap: 26,
    minSpeed: 0,
    multipleSpeed: 54,
    speedOffset: 0,
    numFrames: 1,
    frameRateMs: 1000,
    collisionBoxes: [
      { x: 0, y: 4, width: 2, height: 14 },
      { x: 2, y: 0, width: 3, height: 18 },
      { x: 5, y: 3, width: 4, height: 11 },
    ],
  },
  pterodactyl: {
    kind: "pterodactyl",
    width: 16,
    height: 12,
    yPos: [GROUND_Y - 10 + 1, GROUND_Y - 17 + 1, GROUND_Y - 24 + 1],
    minGap: 34,
    minSpeed: 48,
    multipleSpeed: 999,
    speedOffset: 4,
    numFrames: 2,
    frameRateMs: 150,
    collisionBoxes: [
      { x: 6, y: 5, width: 6, height: 2 },
      { x: 6, y: 7, width: 8, height: 2 },
      { x: 1, y: 4, width: 2, height: 2 },
      { x: 3, y: 2, width: 2, height: 3 },
      { x: 5, y: 2, width: 2, height: 4 },
    ],
  },
};

const DINO_RUNNING_BOXES: Rect[] = [
  { x: 9, y: 0, width: 6, height: 6 },
  { x: 1, y: 7, width: 12, height: 4 },
  { x: 4, y: 14, width: 6, height: 3 },
  { x: 1, y: 10, width: 11, height: 2 },
  { x: 3, y: 12, width: 8, height: 2 },
  { x: 3, y: 15, width: 7, height: 2 },
];

const DINO_DUCKING_BOXES: Rect[] = [
  { x: 1, y: 6, width: 21, height: 9 },
];

const FONT_5X7: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  "=": ["00000", "11111", "00000", "11111", "00000", "00000", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00110", "00001", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00111", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "10000", "10000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "11100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
};

function nextRandom(seed: number): { seed: number; value: number } {
  const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
  return { seed: nextSeed, value: nextSeed / 0x100000000 };
}

function getRandomInt(rngState: number, min: number, max: number): { rngState: number; value: number } {
  const sample = nextRandom(rngState);
  const value = min + Math.floor(sample.value * (max - min + 1));
  return { rngState: sample.seed, value };
}

function clampStepMs(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return 0;
  }
  return Math.min(MAX_STEP_MS, deltaMs);
}

function isGrounded(state: DinoGameOverlay): boolean {
  return Math.abs(state.dinoBottomY - state.groundY) < 0.1;
}

function pushHistory(history: DinoObstacleKind[], kind: DinoObstacleKind): DinoObstacleKind[] {
  return [kind, ...history].slice(0, MAX_OBSTACLE_DUPLICATION);
}

function duplicateCount(history: DinoObstacleKind[], kind: DinoObstacleKind): number {
  let count = 0;
  for (const item of history) {
    count = item === kind ? count + 1 : 0;
  }
  return count;
}

function pickObstacleKind(
  rngState: number,
  speed: number,
  history: DinoObstacleKind[],
): { rngState: number; kind: DinoObstacleKind } {
  const candidateKinds: DinoObstacleKind[] = ["cactusSmall", "cactusLarge", "pterodactyl"];
  let seed = rngState;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const indexSample = getRandomInt(seed, 0, candidateKinds.length - 1);
    seed = indexSample.rngState;
    const kind = candidateKinds[indexSample.value] as DinoObstacleKind;
    const config = OBSTACLE_CONFIGS[kind];
    if (speed < config.minSpeed) {
      continue;
    }
    if (duplicateCount(history, kind) >= MAX_OBSTACLE_DUPLICATION) {
      continue;
    }
    return { rngState: seed, kind };
  }

  return { rngState: seed, kind: "cactusSmall" };
}

function buildObstacleCollisionBoxes(obstacle: DinoObstacleState): Rect[] {
  const config = OBSTACLE_CONFIGS[obstacle.kind];
  if (obstacle.kind === "pterodactyl") {
    return config.collisionBoxes;
  }

  const boxes = config.collisionBoxes.map((box) => ({ ...box }));
  if (obstacle.groupSize > 1 && boxes.length >= 3) {
    boxes[1].width = obstacle.width - boxes[0].width - boxes[2].width;
    boxes[2].x = obstacle.width - boxes[2].width;
  }
  return boxes;
}

function spawnObstacle(
  screenWidth: number,
  speed: number,
  history: DinoObstacleKind[],
  rngState: number,
): { rngState: number; obstacle: DinoObstacleState; history: DinoObstacleKind[] } {
  const picked = pickObstacleKind(rngState, speed, history);
  let seed = picked.rngState;
  const config = OBSTACLE_CONFIGS[picked.kind];

  let groupSize = 1;
  if (picked.kind !== "pterodactyl") {
    const groupSample = getRandomInt(seed, 1, MAX_OBSTACLE_GROUP);
    seed = groupSample.rngState;
    groupSize = speed >= config.multipleSpeed ? groupSample.value : 1;
  }

  let obstacleY = 0;
  if (Array.isArray(config.yPos)) {
    const yIndex = getRandomInt(seed, 0, config.yPos.length - 1);
    seed = yIndex.rngState;
    obstacleY = config.yPos[yIndex.value] ?? config.yPos[0];
  } else {
    obstacleY = config.yPos;
  }

  let speedOffset = 0;
  if (config.speedOffset !== 0) {
    const signSample = getRandomInt(seed, 0, 1);
    seed = signSample.rngState;
    speedOffset = signSample.value === 0 ? -config.speedOffset : config.speedOffset;
  }

  const width = config.width * groupSize;
  const minGap = Math.round(width + config.minGap + (speed * 0.55));
  const maxGap = Math.max(minGap, Math.round(minGap * MAX_GAP_COEFFICIENT));
  const gapSample = getRandomInt(seed, minGap, maxGap);
  seed = gapSample.rngState;

  const obstacle: DinoObstacleState = {
    kind: picked.kind,
    x: screenWidth + gapSample.value,
    y: obstacleY,
    width,
    height: config.height,
    groupSize,
    gap: gapSample.value,
    speedOffset,
    frame: 0,
    frameElapsedMs: 0,
  };

  return {
    rngState: seed,
    obstacle,
    history: pushHistory(history, picked.kind),
  };
}

function spawnCloud(
  screenWidth: number,
  rngState: number,
): { rngState: number; cloud: DinoCloudState } {
  const ySample = getRandomInt(rngState, MIN_CLOUD_Y, MAX_CLOUD_Y);
  const gapSample = getRandomInt(ySample.rngState, MIN_CLOUD_GAP, MAX_CLOUD_GAP);
  return {
    rngState: gapSample.rngState,
    cloud: {
      x: screenWidth + gapSample.value,
      y: ySample.value,
      gap: gapSample.value,
    },
  };
}

function createStars(screenWidth: number, rngState: number): { rngState: number; stars: DinoStarState[] } {
  const stars: DinoStarState[] = [];
  let seed = rngState;
  const segment = Math.floor(screenWidth / 2);

  for (let index = 0; index < 2; index += 1) {
    const xSample = getRandomInt(seed, segment * index, Math.max(segment * (index + 1) - 1, segment * index));
    const ySample = getRandomInt(xSample.rngState, 2, 22);
    seed = ySample.rngState;
    stars.push({ x: xSample.value, y: ySample.value });
  }

  return { rngState: seed, stars };
}

function getDinoSize(state: DinoGameOverlay): { width: number; height: number } {
  if (state.duckingMs > 0 && isGrounded(state)) {
    return { width: DINO_DUCK_WIDTH, height: DINO_DUCK_HEIGHT };
  }
  return { width: DINO_STAND_WIDTH, height: DINO_STAND_HEIGHT };
}

function getDinoRect(state: DinoGameOverlay): Rect {
  const size = getDinoSize(state);
  return {
    x: Math.round(state.dinoX),
    y: Math.round(state.dinoBottomY) - size.height + 1,
    width: size.width,
    height: size.height,
  };
}

function rectOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function createAbsoluteBoxes(base: Rect, boxes: Rect[]): Rect[] {
  return boxes.map((box) => ({
    x: base.x + box.x,
    y: base.y + box.y,
    width: box.width,
    height: box.height,
  }));
}

function checkCollision(state: DinoGameOverlay): boolean {
  const firstObstacle = state.obstacles[0];
  if (!firstObstacle) {
    return false;
  }

  const dinoRect = getDinoRect(state);
  const obstacleRect: Rect = {
    x: Math.round(firstObstacle.x),
    y: firstObstacle.y,
    width: firstObstacle.width,
    height: firstObstacle.height,
  };

  if (!rectOverlap(dinoRect, obstacleRect)) {
    return false;
  }

  const dinoBoxes = state.duckingMs > 0 && isGrounded(state) ? DINO_DUCKING_BOXES : DINO_RUNNING_BOXES;
  const obstacleBoxes = buildObstacleCollisionBoxes(firstObstacle);
  const dinoDetail = createAbsoluteBoxes(dinoRect, dinoBoxes);
  const obstacleDetail = createAbsoluteBoxes(obstacleRect, obstacleBoxes);

  for (const dinoBox of dinoDetail) {
    for (const obstacleBox of obstacleDetail) {
      if (rectOverlap(dinoBox, obstacleBox)) {
        return true;
      }
    }
  }

  return false;
}

export function createDinoGameOverlay(nowMs = Date.now(), seed = (Date.now() >>> 0)): DinoGameOverlay {
  const initialObstacle = spawnObstacle(LCD_WIDTH, BASE_SPEED, [], seed);
  const cloudSample = spawnCloud(LCD_WIDTH, initialObstacle.rngState);
  const starSample = createStars(LCD_WIDTH, cloudSample.rngState);

  return {
    name: "Google Dino",
    width: LCD_WIDTH,
    height: LCD_HEIGHT,
    groundY: GROUND_Y,
    dinoX: DINO_X,
    dinoBottomY: GROUND_Y,
    dinoVy: 0,
    duckingMs: 0,
    obstacleX: initialObstacle.obstacle.x,
    obstacleWidth: initialObstacle.obstacle.width,
    obstacleHeight: initialObstacle.obstacle.height,
    speed: BASE_SPEED,
    score: 0,
    gameOver: false,
    rngState: starSample.rngState,
    runFrame: 0,
    runFrameElapsedMs: 0,
    nextNightScore: NIGHT_SCORE_INTERVAL,
    nightActive: false,
    nightOpacity: 0,
    moonX: LCD_WIDTH - 26,
    moonPhase: 0,
    groundOffset: 0,
    obstacles: [initialObstacle.obstacle],
    obstacleHistory: initialObstacle.history,
    clouds: [cloudSample.cloud],
    stars: starSample.stars,
    drawStars: false,
    lastWallClockMs: Math.max(0, Math.floor(nowMs)),
  };
}

export function handleDinoGameKey(state: DinoGameOverlay, key: AbstractKey): DinoGameOverlay {
  if (state.gameOver) {
    if (key === "up" || key === "down" || key === "enter") {
      return createDinoGameOverlay(Date.now(), state.rngState ^ 0x9e3779b9);
    }
    return state;
  }

  if (key !== "up" && key !== "down") {
    return state;
  }

  if (isGrounded(state)) {
    return {
      ...state,
      dinoVy: INITIAL_JUMP_VELOCITY,
      duckingMs: 0,
    };
  }

  if (key === "down") {
    return {
      ...state,
      dinoVy: Math.max(state.dinoVy, 60),
      duckingMs: DUCK_HOLD_MS,
    };
  }

  return state;
}

function updateNightState(state: DinoGameOverlay, stepMs: number, stepSeconds: number): DinoGameOverlay {
  let nextNightScore = state.nextNightScore;
  let nightActive = state.nightActive;
  let moonPhase = state.moonPhase;
  let nightOpacity = state.nightOpacity;
  let drawStars = state.drawStars;
  let moonX = state.moonX;
  let stars = state.stars.map((star) => ({ ...star }));

  if (state.score >= nextNightScore) {
    nextNightScore += NIGHT_SCORE_INTERVAL;
    nightActive = !nightActive;
    if (nightActive) {
      moonPhase = (moonPhase + 1) % 7;
      drawStars = true;
    } else {
      drawStars = false;
    }
  }

  const direction = nightActive ? 1 : -1;
  nightOpacity = Math.max(0, Math.min(1, nightOpacity + direction * NIGHT_FADE_PER_MS * stepMs));

  if (nightOpacity > 0.01) {
    moonX -= state.speed * MOON_SPEED_RATIO * stepSeconds;
    if (moonX < -22) {
      moonX = state.width + 8;
    }

    stars = stars.map((star) => {
      let x = star.x - (state.speed * STAR_SPEED_RATIO * stepSeconds);
      if (x < -2) {
        x = state.width + 2;
      }
      return { ...star, x };
    });
  }

  return {
    ...state,
    nextNightScore,
    nightActive,
    moonPhase,
    nightOpacity,
    drawStars,
    moonX,
    stars,
  };
}

function updateClouds(
  clouds: DinoCloudState[],
  speed: number,
  stepSeconds: number,
  rngState: number,
): { clouds: DinoCloudState[]; rngState: number } {
  let seed = rngState;
  let nextClouds = clouds
    .map((cloud) => ({ ...cloud, x: cloud.x - speed * CLOUD_SPEED_RATIO * stepSeconds }))
    .filter((cloud) => cloud.x + 14 > 0);

  if (nextClouds.length === 0) {
    const spawned = spawnCloud(LCD_WIDTH, seed);
    seed = spawned.rngState;
    nextClouds = [spawned.cloud];
  } else {
    const lastCloud = nextClouds[nextClouds.length - 1];
    const space = LCD_WIDTH - lastCloud.x;
    const randomSample = nextRandom(seed);
    seed = randomSample.seed;
    if (
      nextClouds.length < MAX_CLOUDS &&
      space > lastCloud.gap &&
      randomSample.value < CLOUD_FREQUENCY
    ) {
      const spawned = spawnCloud(LCD_WIDTH, seed);
      seed = spawned.rngState;
      nextClouds.push(spawned.cloud);
    }
  }

  return { clouds: nextClouds, rngState: seed };
}

function updateObstacles(
  state: DinoGameOverlay,
  stepMs: number,
  stepSeconds: number,
): { obstacles: DinoObstacleState[]; obstacleHistory: DinoObstacleKind[]; rngState: number } {
  const speed = state.speed;
  const updated = state.obstacles
    .map((obstacle) => {
      const config = OBSTACLE_CONFIGS[obstacle.kind];
      const obstacleSpeed = speed + obstacle.speedOffset;
      let frameElapsedMs = obstacle.frameElapsedMs + stepMs;
      let frame = obstacle.frame;

      if (config.numFrames > 1 && frameElapsedMs >= config.frameRateMs) {
        frame = frame === 0 ? 1 : 0;
        frameElapsedMs = 0;
      }

      return {
        ...obstacle,
        x: obstacle.x - obstacleSpeed * stepSeconds,
        frame,
        frameElapsedMs,
      };
    })
    .filter((obstacle) => obstacle.x + obstacle.width > 0);

  let obstacles = updated;
  let history = [...state.obstacleHistory];
  let rngState = state.rngState;

  if (obstacles.length > 0) {
    const last = obstacles[obstacles.length - 1];
    if (last.x + last.width + last.gap < state.width) {
      const spawned = spawnObstacle(state.width, speed, history, rngState);
      rngState = spawned.rngState;
      history = spawned.history;
      obstacles = [...obstacles, spawned.obstacle];
    }
  } else {
    const spawned = spawnObstacle(state.width, speed, history, rngState);
    rngState = spawned.rngState;
    history = spawned.history;
    obstacles = [spawned.obstacle];
  }

  return { obstacles, obstacleHistory: history, rngState };
}

export function advanceDinoGame(state: DinoGameOverlay, wallClockMs: number): DinoGameOverlay {
  const now = Number.isFinite(wallClockMs)
    ? Math.max(0, Math.floor(wallClockMs))
    : state.lastWallClockMs;
  const stepMs = clampStepMs(now - state.lastWallClockMs);

  if (stepMs <= 0) {
    return {
      ...state,
      lastWallClockMs: now,
    };
  }

  if (state.gameOver) {
    return {
      ...state,
      lastWallClockMs: now,
    };
  }

  const stepSeconds = stepMs / 1000;
  const speed = Math.min(MAX_SPEED, state.speed + ACCELERATION * stepSeconds);

  let runFrameElapsedMs = state.runFrameElapsedMs + stepMs;
  let runFrame = state.runFrame;
  const framePeriod = state.duckingMs > 0 && isGrounded(state) ? DUCK_FRAME_MS : RUN_FRAME_MS;
  if (runFrameElapsedMs >= framePeriod) {
    runFrame = runFrame === 0 ? 1 : 0;
    runFrameElapsedMs = 0;
  }

  let duckingMs = Math.max(0, state.duckingMs - stepMs);
  const airborne = state.dinoBottomY < state.groundY - 0.1;
  const speedDropActive = duckingMs > 0 && airborne;
  let dinoVy = state.dinoVy;
  let dinoBottomY = state.dinoBottomY;

  if (speedDropActive) {
    dinoBottomY += dinoVy * SPEED_DROP_COEFFICIENT * stepSeconds;
  } else {
    dinoBottomY += dinoVy * stepSeconds;
  }
  dinoVy += GRAVITY * stepSeconds;

  if ((state.groundY - dinoBottomY) >= MIN_JUMP_RISE && dinoVy < DROP_VELOCITY) {
    dinoVy = DROP_VELOCITY;
  }
  if ((state.groundY - dinoBottomY) >= MAX_JUMP_RISE) {
    dinoVy = Math.max(dinoVy, DROP_VELOCITY);
  }

  if (dinoBottomY > state.groundY) {
    dinoBottomY = state.groundY;
    dinoVy = 0;
    duckingMs = 0;
  }

  const cloudResult = updateClouds(state.clouds, speed, stepSeconds, state.rngState);
  const baseState: DinoGameOverlay = {
    ...state,
    speed,
    score: state.score + (speed * stepSeconds * 0.42),
    runFrame,
    runFrameElapsedMs,
    dinoBottomY,
    dinoVy,
    duckingMs,
    clouds: cloudResult.clouds,
    rngState: cloudResult.rngState,
    groundOffset: (state.groundOffset + speed * stepSeconds) % 8,
    lastWallClockMs: now,
  };

  const obstacleResult = updateObstacles(baseState, stepMs, stepSeconds);
  const withObstacles: DinoGameOverlay = {
    ...baseState,
    obstacles: obstacleResult.obstacles,
    obstacleHistory: obstacleResult.obstacleHistory,
    rngState: obstacleResult.rngState,
    obstacleX: obstacleResult.obstacles[0]?.x ?? -1000,
    obstacleWidth: obstacleResult.obstacles[0]?.width ?? 0,
    obstacleHeight: obstacleResult.obstacles[0]?.height ?? 0,
  };

  const withNight = updateNightState(withObstacles, stepMs, stepSeconds);
  if (checkCollision(withNight)) {
    return {
      ...withNight,
      gameOver: true,
      dinoVy: 0,
    };
  }

  return withNight;
}

function setPixel(pixels: Uint8Array, width: number, height: number, x: number, y: number) {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }
  pixels[y * width + x] = 1;
}

function hLine(pixels: Uint8Array, width: number, height: number, x1: number, x2: number, y: number) {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  for (let x = left; x <= right; x += 1) {
    setPixel(pixels, width, height, x, y);
  }
}

function vLine(pixels: Uint8Array, width: number, height: number, x: number, y1: number, y2: number) {
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  for (let y = top; y <= bottom; y += 1) {
    setPixel(pixels, width, height, x, y);
  }
}

function fillRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
) {
  if (rectWidth <= 0 || rectHeight <= 0) {
    return;
  }
  for (let row = 0; row < rectHeight; row += 1) {
    for (let col = 0; col < rectWidth; col += 1) {
      setPixel(pixels, width, height, x + col, y + row);
    }
  }
}

function drawText5x7(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  text: string,
) {
  let cursorX = x;
  const normalized = text.toUpperCase();
  for (const char of normalized) {
    const glyph = FONT_5X7[char] ?? FONT_5X7[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      const rowBits = glyph[row];
      for (let col = 0; col < rowBits.length; col += 1) {
        if (rowBits[col] === "1") {
          setPixel(pixels, width, height, cursorX + col, y + row);
        }
      }
    }
    cursorX += 6;
  }
}

function drawDino(
  pixels: Uint8Array,
  width: number,
  height: number,
  state: DinoGameOverlay,
  useSpritePack: ReturnType<typeof getChromeDinoSpritePack>,
) {
  const rect = getDinoRect(state);
  const ducking = state.duckingMs > 0 && isGrounded(state);

  if (useSpritePack) {
    const sprite = state.gameOver
      ? useSpritePack.trexCrash
      : ducking
        ? useSpritePack.trexDuck[state.runFrame]
        : state.dinoBottomY < state.groundY - 0.1
          ? useSpritePack.trexJump
          : useSpritePack.trexRun[state.runFrame];
    drawSpriteMaskScaled(
      pixels,
      width,
      height,
      sprite,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
    return;
  }

  if (ducking) {
    fillRect(pixels, width, height, rect.x + 2, rect.y + 5, 21, 5);
    fillRect(pixels, width, height, rect.x + 21, rect.y + 2, 6, 5);
    fillRect(pixels, width, height, rect.x + 4, rect.y + 10, 5, 2);
    fillRect(pixels, width, height, rect.x + (state.runFrame === 0 ? 14 : 16), rect.y + 10, 5, 2);
    setPixel(pixels, width, height, rect.x + 25, rect.y + 4);
    return;
  }

  fillRect(pixels, width, height, rect.x + 5, rect.y + 7, 10, 10);
  fillRect(pixels, width, height, rect.x + 9, rect.y + 0, 8, 8);
  fillRect(pixels, width, height, rect.x + 16, rect.y + 2, 4, 4);
  fillRect(pixels, width, height, rect.x + 5, rect.y + 17, 4, 6);
  if (state.runFrame === 0) {
    fillRect(pixels, width, height, rect.x + 11, rect.y + 17, 4, 5);
  } else {
    fillRect(pixels, width, height, rect.x + 13, rect.y + 18, 4, 5);
  }
  setPixel(pixels, width, height, rect.x + 14, rect.y + 3);
}

function drawCactus(
  pixels: Uint8Array,
  width: number,
  height: number,
  obstacle: DinoObstacleState,
  useSpritePack: ReturnType<typeof getChromeDinoSpritePack>,
) {
  if (useSpritePack) {
    const sprites = obstacle.kind === "cactusLarge"
      ? useSpritePack.cactusLarge
      : useSpritePack.cactusSmall;
    const index = Math.max(0, Math.min(2, obstacle.groupSize - 1));
    const sprite = sprites[index];
    drawSpriteMaskScaled(
      pixels,
      width,
      height,
      sprite,
      obstacle.x,
      obstacle.y,
      obstacle.width,
      obstacle.height,
    );
    return;
  }

  const segmentWidth = obstacle.width / obstacle.groupSize;
  for (let index = 0; index < obstacle.groupSize; index += 1) {
    const x = Math.round(obstacle.x + segmentWidth * index);
    const bodyW = Math.max(2, Math.round(segmentWidth * 0.42));
    const bodyX = x + Math.max(0, Math.round((segmentWidth - bodyW) / 2));
    fillRect(pixels, width, height, bodyX, obstacle.y, bodyW, obstacle.height);
    fillRect(pixels, width, height, bodyX - 1, obstacle.y + 4, 1, 5);
    fillRect(pixels, width, height, bodyX + bodyW, obstacle.y + Math.round(obstacle.height * 0.4), 1, 5);
  }
}

function drawPterodactyl(
  pixels: Uint8Array,
  width: number,
  height: number,
  obstacle: DinoObstacleState,
  useSpritePack: ReturnType<typeof getChromeDinoSpritePack>,
) {
  if (useSpritePack) {
    const sprite = useSpritePack.pterodactyl[obstacle.frame];
    drawSpriteMaskScaled(
      pixels,
      width,
      height,
      sprite,
      obstacle.x,
      obstacle.y,
      obstacle.width,
      obstacle.height,
    );
    return;
  }

  const x = Math.round(obstacle.x);
  const y = obstacle.y;
  const wingUp = obstacle.frame === 0;

  fillRect(pixels, width, height, x + 7, y + 6, 8, 4);
  fillRect(pixels, width, height, x + 15, y + 7, 4, 2);
  fillRect(pixels, width, height, x + 3, y + 7, 4, 2);
  fillRect(pixels, width, height, x + 1, y + (wingUp ? 4 : 8), 6, 2);
  fillRect(pixels, width, height, x + 13, y + (wingUp ? 2 : 6), 7, 2);
  setPixel(pixels, width, height, x + 16, y + 6);
}

function drawObstacle(
  pixels: Uint8Array,
  width: number,
  height: number,
  obstacle: DinoObstacleState,
  useSpritePack: ReturnType<typeof getChromeDinoSpritePack>,
) {
  if (obstacle.kind === "pterodactyl") {
    drawPterodactyl(pixels, width, height, obstacle, useSpritePack);
    return;
  }
  drawCactus(pixels, width, height, obstacle, useSpritePack);
}

function drawCloud(
  pixels: Uint8Array,
  width: number,
  height: number,
  cloud: DinoCloudState,
  useSpritePack: ReturnType<typeof getChromeDinoSpritePack>,
) {
  if (useSpritePack) {
    drawSpriteMask(
      pixels,
      width,
      height,
      useSpritePack.cloud,
      cloud.x,
      cloud.y,
    );
    return;
  }

  const x = Math.round(cloud.x);
  const y = cloud.y;
  fillRect(pixels, width, height, x + 2, y + 2, 10, 3);
  fillRect(pixels, width, height, x, y + 4, 14, 2);
}

function drawMoon(
  pixels: Uint8Array,
  width: number,
  height: number,
  xPos: number,
  yPos: number,
  phase: number,
  useSpritePack: ReturnType<typeof getChromeDinoSpritePack>,
) {
  if (useSpritePack) {
    const moon = useSpritePack.moon[phase % useSpritePack.moon.length];
    drawSpriteMask(
      pixels,
      width,
      height,
      moon,
      xPos,
      yPos,
    );
    return;
  }

  const x = Math.round(xPos);
  const radius = 5;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if ((dx * dx) + (dy * dy) <= radius * radius) {
        setPixel(pixels, width, height, x + dx, yPos + dy);
      }
    }
  }

  const cut = 1 + (phase % 5);
  fillRect(pixels, width, height, x - radius + cut, yPos - radius, radius, radius * 2);
}

function centerTextX(width: number, text: string): number {
  return Math.max(0, Math.floor((width - (text.length * 6 - 1)) / 2));
}

export function renderDinoGameBitmap(state: DinoGameOverlay): MonoBitmap {
  const width = state.width;
  const height = state.height;
  const pixels = new Uint8Array(width * height);
  const spritePack = getChromeDinoSpritePack();

  if (state.nightOpacity > 0.35 && state.drawStars) {
    for (const star of state.stars) {
      if (spritePack) {
        drawSpriteMask(pixels, width, height, spritePack.star, star.x, star.y);
      } else {
        setPixel(pixels, width, height, Math.round(star.x), star.y);
        if (state.nightOpacity > 0.7) {
          setPixel(pixels, width, height, Math.round(star.x) + 1, star.y);
        }
      }
    }
    drawMoon(pixels, width, height, state.moonX, 6, state.moonPhase, spritePack);
  }

  for (const cloud of state.clouds) {
    drawCloud(pixels, width, height, cloud, spritePack);
  }

  const groundY = state.groundY + 1;
  hLine(pixels, width, height, 0, width - 1, groundY);
  for (let dash = 0; dash < width; dash += 8) {
    const x = (dash + Math.round(state.groundOffset)) % width;
    hLine(pixels, width, height, x, Math.min(width - 1, x + 3), groundY + 2);
  }
  vLine(pixels, width, height, width - 1, groundY, groundY + 2);

  drawDino(pixels, width, height, state, spritePack);

  for (const obstacle of state.obstacles) {
    drawObstacle(pixels, width, height, obstacle, spritePack);
  }

  drawText5x7(pixels, width, height, 2, 2, `SCORE:${Math.floor(state.score)}`);
  drawText5x7(pixels, width, height, 2, 10, `SPD:${Math.floor(state.speed)}`);

  if (state.gameOver) {
    const line1 = "GAME OVER";
    const line2 = "UP/DOWN=JUMP";
    drawText5x7(pixels, width, height, centerTextX(width, line1), 22, line1);
    drawText5x7(pixels, width, height, centerTextX(width, line2), 32, line2);
  }

  const rows: string[] = [];
  for (let y = 0; y < height; y += 1) {
    let row = "";
    for (let x = 0; x < width; x += 1) {
      row += pixels[y * width + x] ? "1" : "0";
    }
    rows.push(row);
  }

  return { width, height, rows };
}
