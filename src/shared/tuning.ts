/** Every gameplay number lives here so it can be tuned in one place. */
export const TILE = 32;
export const VIEW_W = 960;
export const VIEW_H = 540;

export const TUNING = {
  gravity: 1300,
  player: {
    bodyW: 20,
    bodyH: 40,
    maxSpeedX: 230,
    groundAccel: 2200,
    airAccel: 1500,
    groundDrag: 2000,
    airDrag: 500,
    maxFall: 720,
    jumpVelocity: -540,
    /** Extra gravity (× world gravity) by jump phase, for a weighty but floaty-at-the-top arc. */
    fallGravity: 0.6,
    releaseGravity: 1.4,
    apexGravity: -0.45,
    apexThreshold: 95,
    fastFallGravity: 1.1,
    maxFallFast: 900,
    turnAccelMultiplier: 1.9,
    cornerCorrectPx: 9,
    coyoteMs: 110,
    jumpBufferMs: 130,
    maxHealth: 5,
    invulnMs: 900,
    knockbackX: 220,
    knockbackY: -240,
  },
  dash: {
    speed: 560,
    durationMs: 170,
    cooldownMs: 320,
  },
  energy: {
    chargeMs: 10000,
    siphonWindowMs: 320,
    siphonCooldownMs: 380,
    siphonRadius: 100,
    torchRelightMs: 5000,
  },
  fireball: {
    speed: 560,
    lifeMs: 1400,
    damage: 1,
  },
  archer: {
    hp: 2,
    patrolSpeed: 60,
    detectRangeX: 380,
    detectRangeY: 150,
    windupMs: 650,
    cooldownMs: 1500,
    arrowSpeed: 300,
  },
  brute: {
    hp: 4,
    patrolSpeed: 55,
    chargeSpeed: 330,
    detectRangeX: 300,
    windupMs: 500,
    chargeMs: 1300,
    stunMs: 1400,
  },
  barrel: {
    fuseMs: 280,
    radius: 110,
    damage: 3,
  },
  brazierBurnMs: 14000,
} as const;
