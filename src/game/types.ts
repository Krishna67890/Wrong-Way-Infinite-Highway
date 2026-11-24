export type ScreenId =
  | 'splash'
  | 'menu'
  | 'garage'
  | 'upgrades'
  | 'worlds'
  | 'modes'
  | 'events'
  | 'leaderboard'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'missions'
  | 'achievements'
  | 'settings';

export type CarId = string;

export type CarCategory =
  | 'sports'
  | 'supercar'
  | 'hypercar'
  | 'luxury'
  | 'limousine'
  | 'special';

export type CarClass =
  | 'Normal'
  | 'Fast'
  | 'Turbo'
  | 'Ability'
  | 'Armored'
  | 'Hyper'
  | 'Executive'
  | 'Legend';

export type CarAbilityId =
  | 'steady_grip'
  | 'quick_snap'
  | 'slipstream'
  | 'overboost'
  | 'apex_magnet'
  | 'titanium_armor'
  | 'phase_ghost'
  | 'shockwave_ram'
  | 'emp_pulse'
  | 'track_precision'
  | 'time_warp'
  | 'aero_downforce'
  | 'quad_overdrive'
  | 'phantom_blink'
  | 'vip_convoy'
  | 'sovereign_zenith';

export interface CarAbilityDefinition {
  id: CarAbilityId;
  name: string;
  mode: 'passive' | 'active';
  badge: string;
  description: string;
  cooldownSec: number;
  durationSec: number;
  accentHex: string;
}

export type CarRarity =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Epic'
  | 'Luxury'
  | 'Exotic'
  | 'Legendary';

export type CarBodyStyle =
  | 'hatchback'
  | 'coupe'
  | 'gt'
  | 'turbo'
  | 'angular_super'
  | 'berlinetta'
  | 'aero_super'
  | 'luxury_sedan'
  | 'w16_hyper'
  | 'nordic_hyper'
  | 'limousine'
  | 'police'
  | 'cyber'
  | 'legendary';

export type DecalStyle = 'clean' | 'stripes' | 'neon_trim' | 'carbon_hood';

export type UpgradeStatKey =
  | 'engine'
  | 'turbo'
  | 'tires'
  | 'handling'
  | 'brakes'
  | 'armor'
  | 'nitro'
  | 'repair';

export interface CarStats {
  topSpeed: number; // km/h
  acceleration: number; // 1 - 100
  tireGrip: number; // 1 - 100 (lane change speed)
  handling: number; // 1 - 100 (steering response)
  braking: number; // 1 - 100
  damageResistance: number; // 0 - 0.55
  nitroCapacity: number; // seconds
  repairEfficiency: number; // multiplier e.g. 1.0 - 1.45
}

export interface CarAudioProfile {
  baseFreq: number;
  harmonicRatio: number;
  exhaustGrowl: number;
  pitchScale: number;
}

export interface CarDefinition {
  id: CarId;
  name: string;
  category: CarCategory;
  carClass: CarClass;
  rarity: CarRarity;
  tierLabel: string;
  description: string;
  price: number;
  requiredLevel: number;
  bodyStyle: CarBodyStyle;
  defaultColor: string;
  accentColor: string;
  underglowColor?: string;
  paletteOptions: string[];
  baseStats: CarStats;
  ability: CarAbilityDefinition;
  audio: CarAudioProfile;
}

export type CarUpgradeLevels = Record<UpgradeStatKey, number>;

export type WorldId =
  | 'neon_city'
  | 'desert_highway'
  | 'green_forest'
  | 'snow_mountains'
  | 'coastal_road'
  | 'rainy_highway'
  | 'sunset_highway'
  | 'cyber_highway';

export type WeatherType = 'clear' | 'rain' | 'snow' | 'dust' | 'mist';

export interface WorldDefinition {
  id: WorldId;
  name: string;
  subtitle: string;
  unlockCost: number;
  requiredLevel: number;
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  fogDensity: number;
  roadColor: string;
  shoulderColor: string;
  laneLineColor: string;
  edgeLineColor: string;
  ambientSky: string;
  ambientGround: string;
  sunColor: string;
  sunIntensity: number;
  accentGlow: string;
  weather: WeatherType;
  isNight: boolean;
  propTheme:
    | 'city'
    | 'desert'
    | 'forest'
    | 'snow'
    | 'coastal'
    | 'rain'
    | 'sunset'
    | 'cyber';
  coinMultiplier: number;
}

export type GameModeId =
  | 'endless'
  | 'coin_rush'
  | 'time_trial'
  | 'traffic_challenge'
  | 'boss_escape'
  | 'daily_challenge';

export interface GameModeDefinition {
  id: GameModeId;
  name: string;
  subtitle: string;
  rules: string;
  coinMultiplier: number;
  xpMultiplier: number;
  trafficDensityScale: number;
  coinSpawnScale: number;
  timeLimitSec?: number;
  targetDistanceM?: number;
  targetNearMisses?: number;
}

export type TrafficVehicleType =
  | 'sedan'
  | 'suv'
  | 'sports'
  | 'supercar'
  | 'bus'
  | 'truck'
  | 'van'
  | 'motorbike'
  | 'limousine';

export type BossType =
  | 'black_hypercar'
  | 'police_interceptor'
  | 'highway_hunter'
  | 'cyber_beast';

export type RepairPickupTier = 'small' | 'medium' | 'large' | 'legendary';

export type PowerUpType =
  | 'nitro'
  | 'magnet'
  | 'shield'
  | 'slow_mo'
  | 'emergency_repair';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type ControlScheme = 'hybrid' | 'swipe' | 'buttons';
export type CameraPreset = 'chase' | 'low' | 'high';

export interface GameSettings {
  graphics: GraphicsQuality;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  vibration: boolean;
  tiltSteering: boolean;
  tiltSensitivity: number;
  controlScheme: ControlScheme;
  cameraPreset: CameraPreset;
}

export type MissionMetric =
  | 'distance'
  | 'coins'
  | 'near_misses'
  | 'nitro_uses'
  | 'repairs'
  | 'survival_seconds'
  | 'no_damage_distance'
  | 'reach_200_kmh'
  | 'boss_escapes'
  | 'smashes'
  | 'high_speed_kmh';

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardXp: number;
  rewardParts: number;
  claimed: boolean;
}

export interface EndlessMission {
  id: string;
  tier: number;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardXp: number;
  rewardParts: number;
}

export type AchievementTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Mythic';
export type AchievementCategory = 'Survival' | 'Speed' | 'Combat' | 'Garage' | 'Mastery';

export type AchievementMetric =
  | 'runs'
  | 'best_distance'
  | 'total_distance'
  | 'top_speed_hit'
  | 'no_damage_distance'
  | 'total_near_misses'
  | 'best_combo'
  | 'repairs_collected'
  | 'total_coins'
  | 'cars_unlocked'
  | 'nitro_uses'
  | 'crashes_survived_run'
  | 'has_hypercar'
  | 'has_limousine'
  | 'player_level'
  | 'total_smashes'
  | 'boss_escapes'
  | 'missions_completed'
  | 'upgrade_levels';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  category: AchievementCategory;
  metric: AchievementMetric;
  target: number;
  rewardCoins: number;
  rewardXp: number;
  rewardLabel: string;
}

export interface RunRecord {
  id: string;
  dateIso: string;
  carId: CarId;
  worldId: WorldId;
  modeId: GameModeId;
  distance: number;
  score: number;
  coins: number;
  maxCombo: number;
}

export interface PlayerProgress {
  coins: number;
  carParts: number;
  xp: number;
  level: number;
  highScore: number;
  bestDistance: number;
  bestCombo: number;
  mostCoinsRun: number;
  totalDistance: number;
  totalRuns: number;
  totalNearMisses: number;
  totalCoinsEarned: number;
  totalRepairsCollected: number;
  totalNitroUses: number;
  totalBossEscapes: number;
  totalSmashes: number;
  totalMissionsCompleted: number;
  maxSpeedReached: number;
  maxNoDamageDistance: number;
  maxCrashesSurvivedInRun: number;
  reviveTokens: number;
  tutorialCompleted: boolean;
  lastDailyBonusDate: string;
  dailyStreak: number;
  unlockedCars: CarId[];
  equippedCar: CarId;
  carColors: Record<string, string>;
  carDecals: Record<string, DecalStyle>;
  carUpgrades: Record<string, CarUpgradeLevels>;
  unlockedWorlds: WorldId[];
  selectedWorld: WorldId;
  selectedMode: GameModeId;
  selectedBoss: BossType;
  dailyDateKey: string;
  dailyMissions: DailyMission[];
  endlessMissions: EndlessMission[];
  endlessMissionCounter: number;
  claimedAchievements: string[];
  runHistory: RunRecord[];
  settings: GameSettings;
}

export interface HudNotification {
  id: number;
  text: string;
  tone: 'emerald' | 'cyan' | 'amber' | 'rose' | 'white';
}

export interface ActivePowerUpState {
  magnetRemaining: number;
  magnetDuration: number;
  shieldRemaining: number;
  shieldDuration: number;
  slowMoRemaining: number;
  slowMoDuration: number;
}

export interface AbilityHudState {
  id: CarAbilityId;
  name: string;
  mode: 'passive' | 'active';
  activeRemaining: number;
  durationSec: number;
  cooldownRemaining: number;
  cooldownSec: number;
  ready: boolean;
  accentHex: string;
}

export interface BossHudState {
  active: boolean;
  bossName: string;
  bossType: BossType;
  remainingSec: number;
  totalSec: number;
  warningText: string | null;
}

export interface RunSummary {
  distance: number;
  score: number;
  coinsEarned: number;
  nearMisses: number;
  maxCombo: number;
  maxSpeedKmh: number;
  xpEarned: number;
  smashes: number;
  repairsCollected: number;
  nitroUses: number;
  nitroSeconds: number;
  survivalSeconds: number;
  maxNoDamageDistance: number;
  crashesTaken: number;
  bossEscaped: boolean;
  isNewBestDistance: boolean;
  isNewHighScore: boolean;
  modeCompleted: boolean;
  modeBonusCoins: number;
  worldId: WorldId;
  modeId: GameModeId;
  carId: CarId;
}

export interface LiveHudSnapshot {
  health: number;
  maxHealth: number;
  healthStage: 'normal' | 'minor' | 'warning' | 'critical';
  speedKmh: number;
  distanceM: number;
  score: number;
  runCoins: number;
  nitroRatio: number;
  nitroActive: boolean;
  braking: boolean;
  comboCount: number;
  comboTimerRatio: number;
  nearMisses: number;
  timeRemainingSec: number | null;
  modeProgressLabel: string | null;
  worldLabel: string;
  damageFlash: number;
  lowHealthWarning: boolean;
  activePowerUps: ActivePowerUpState;
  ability: AbilityHudState;
  boss: BossHudState;
  tutorialStep: number; // 0 = steer, 1 = nitro, 2 = near-miss/ready, -1 = done
  canRevive: boolean;
  notifications: HudNotification[];
}
