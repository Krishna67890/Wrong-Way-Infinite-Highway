import {
  ACHIEVEMENTS,
  CARS,
  createEmptyUpgrades,
  generateDailyMissions,
  generateEndlessMission,
  getCarById,
  getUpgradeCost,
  getWorldById,
  UPGRADE_MAX_LEVEL,
  xpRequiredForLevel,
} from './data';
import {
  Achievement,
  BossType,
  CarId,
  DecalStyle,
  GameModeId,
  GameSettings,
  MissionMetric,
  PlayerProgress,
  RunRecord,
  RunSummary,
  UpgradeStatKey,
  WorldId,
} from './types';

const STORAGE_KEY = 'highway_havoc_wrong_way_save_v2';

export function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createDefaultProgress(): PlayerProgress {
  const dateKey = getTodayDateKey();
  const defaultColors: Record<string, string> = {};
  const defaultDecals: Record<string, DecalStyle> = {};
  const defaultUpgrades: Record<string, ReturnType<typeof createEmptyUpgrades>> = {};
  for (const car of CARS) {
    defaultColors[car.id] = car.defaultColor;
    defaultDecals[car.id] = 'clean';
    defaultUpgrades[car.id] = createEmptyUpgrades();
  }
  return {
    coins: 0,
    carParts: 0,
    xp: 0,
    level: 1,
    highScore: 0,
    bestDistance: 0,
    bestCombo: 0,
    mostCoinsRun: 0,
    totalDistance: 0,
    totalRuns: 0,
    totalNearMisses: 0,
    totalCoinsEarned: 0,
    totalRepairsCollected: 0,
    totalNitroUses: 0,
    totalBossEscapes: 0,
    totalSmashes: 0,
    totalMissionsCompleted: 0,
    maxSpeedReached: 0,
    maxNoDamageDistance: 0,
    maxCrashesSurvivedInRun: 0,
    reviveTokens: 1,
    tutorialCompleted: false,
    lastDailyBonusDate: '',
    dailyStreak: 0,
    unlockedCars: ['starter'],
    equippedCar: 'starter',
    carColors: defaultColors,
    carDecals: defaultDecals,
    carUpgrades: defaultUpgrades,
    unlockedWorlds: ['neon_city', 'desert_highway'],
    selectedWorld: 'neon_city',
    selectedMode: 'endless',
    selectedBoss: 'black_hypercar',
    dailyDateKey: dateKey,
    dailyMissions: generateDailyMissions(dateKey),
    endlessMissions: [
      generateEndlessMission(1),
      generateEndlessMission(2),
      generateEndlessMission(3),
    ],
    endlessMissionCounter: 3,
    claimedAchievements: [],
    runHistory: [],
    settings: {
      graphics: 'high',
      masterVolume: 0.8,
      musicVolume: 0.45,
      sfxVolume: 0.85,
      muted: false,
      vibration: true,
      tiltSteering: false,
      tiltSensitivity: 1.0,
      controlScheme: 'hybrid',
      cameraPreset: 'chase',
    },
  };
}

export function loadProgress(): PlayerProgress {
  const fallback = createDefaultProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const today = getTodayDateKey();
    const mergedUpgrades: Record<string, ReturnType<typeof createEmptyUpgrades>> = {};
    for (const car of CARS) {
      mergedUpgrades[car.id] = {
        ...createEmptyUpgrades(),
        ...(parsed.carUpgrades?.[car.id] ?? {}),
      };
    }

    const numOr = (val: unknown, def: number): number =>
      typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : def;

    const merged: PlayerProgress = {
      ...fallback,
      ...parsed,
      coins: numOr(parsed.coins, fallback.coins),
      carParts: numOr(parsed.carParts, fallback.carParts),
      xp: numOr(parsed.xp, fallback.xp),
      level: Math.max(1, numOr(parsed.level, fallback.level)),
      highScore: numOr(parsed.highScore, fallback.highScore),
      bestDistance: numOr(parsed.bestDistance, fallback.bestDistance),
      bestCombo: numOr(parsed.bestCombo, fallback.bestCombo),
      mostCoinsRun: numOr(parsed.mostCoinsRun, fallback.mostCoinsRun),
      totalDistance: numOr(parsed.totalDistance, fallback.totalDistance),
      totalRuns: numOr(parsed.totalRuns, fallback.totalRuns),
      totalNearMisses: numOr(parsed.totalNearMisses, fallback.totalNearMisses),
      totalCoinsEarned: numOr(parsed.totalCoinsEarned, fallback.totalCoinsEarned),
      totalRepairsCollected: numOr(parsed.totalRepairsCollected, fallback.totalRepairsCollected),
      totalNitroUses: numOr(parsed.totalNitroUses, fallback.totalNitroUses),
      totalBossEscapes: numOr(parsed.totalBossEscapes, fallback.totalBossEscapes),
      totalSmashes: numOr(parsed.totalSmashes, fallback.totalSmashes),
      totalMissionsCompleted: numOr(parsed.totalMissionsCompleted, fallback.totalMissionsCompleted),
      maxSpeedReached: numOr(parsed.maxSpeedReached, fallback.maxSpeedReached),
      maxNoDamageDistance: numOr(parsed.maxNoDamageDistance, fallback.maxNoDamageDistance),
      maxCrashesSurvivedInRun: numOr(parsed.maxCrashesSurvivedInRun, fallback.maxCrashesSurvivedInRun),
      reviveTokens: numOr(parsed.reviveTokens, fallback.reviveTokens),
      dailyStreak: numOr(parsed.dailyStreak, fallback.dailyStreak),
      settings: {
        ...fallback.settings,
        ...(parsed.settings ?? {}),
      },
      carColors: {
        ...fallback.carColors,
        ...(parsed.carColors ?? {}),
      },
      carDecals: {
        ...fallback.carDecals,
        ...(parsed.carDecals ?? {}),
      },
      carUpgrades: mergedUpgrades,
      unlockedCars:
        Array.isArray(parsed.unlockedCars) && parsed.unlockedCars.length > 0
          ? Array.from(new Set(['starter', ...parsed.unlockedCars]))
          : fallback.unlockedCars,
      unlockedWorlds:
        Array.isArray(parsed.unlockedWorlds) && parsed.unlockedWorlds.length > 0
          ? Array.from(new Set(['neon_city', 'desert_highway', ...parsed.unlockedWorlds]))
          : fallback.unlockedWorlds,
      endlessMissions:
        Array.isArray(parsed.endlessMissions) && parsed.endlessMissions.length >= 3
          ? parsed.endlessMissions.slice(0, 3)
          : fallback.endlessMissions,
      endlessMissionCounter:
        typeof parsed.endlessMissionCounter === 'number' && parsed.endlessMissionCounter >= 3
          ? parsed.endlessMissionCounter
          : fallback.endlessMissionCounter,
      claimedAchievements: Array.isArray(parsed.claimedAchievements)
        ? Array.from(new Set(parsed.claimedAchievements))
        : [],
      runHistory: Array.isArray(parsed.runHistory) ? parsed.runHistory.slice(0, 12) : [],
    };
    if (
      parsed.dailyDateKey !== today ||
      !Array.isArray(parsed.dailyMissions) ||
      parsed.dailyMissions.length === 0
    ) {
      merged.dailyDateKey = today;
      merged.dailyMissions = generateDailyMissions(today);
    }
    if (!merged.unlockedCars.includes(merged.equippedCar)) {
      merged.equippedCar = 'starter';
    }
    if (!merged.unlockedWorlds.includes(merged.selectedWorld)) {
      merged.selectedWorld = 'neon_city';
    }
    return merged;
  } catch {
    return fallback;
  }
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function refreshDailyMissionsIfNeeded(prev: PlayerProgress): PlayerProgress {
  const today = getTodayDateKey();
  if (prev.dailyDateKey === today && prev.dailyMissions.length > 0) return prev;
  const next: PlayerProgress = {
    ...prev,
    dailyDateKey: today,
    dailyMissions: generateDailyMissions(today),
  };
  saveProgress(next);
  return next;
}

export function addXpToProgress(progress: PlayerProgress, gainXp: number): PlayerProgress {
  let xp = progress.xp + Math.max(0, Math.floor(gainXp));
  let level = progress.level;
  while (xp >= xpRequiredForLevel(level)) {
    xp -= xpRequiredForLevel(level);
    level += 1;
  }
  return { ...progress, xp, level };
}

function advanceMissionProgress(
  metric: MissionMetric,
  currentProgress: number,
  target: number,
  summary: RunSummary,
  totalRunCoins: number,
): number {
  let nextProg = currentProgress;
  if (metric === 'distance') nextProg += summary.distance;
  else if (metric === 'coins') nextProg += totalRunCoins;
  else if (metric === 'near_misses') nextProg += summary.nearMisses;
  else if (metric === 'nitro_uses') nextProg += summary.nitroUses;
  else if (metric === 'repairs') nextProg += summary.repairsCollected;
  else if (metric === 'survival_seconds') nextProg += Math.round(summary.survivalSeconds);
  else if (metric === 'smashes') nextProg += summary.smashes;
  else if (metric === 'no_damage_distance') {
    nextProg = Math.max(nextProg, summary.maxNoDamageDistance);
  } else if (metric === 'high_speed_kmh') {
    nextProg = Math.max(nextProg, summary.maxSpeedKmh);
  } else if (metric === 'reach_200_kmh') {
    if (summary.maxSpeedKmh >= 200) nextProg = 1;
  } else if (metric === 'boss_escapes') {
    nextProg += summary.bossEscaped ? 1 : 0;
  }
  return Math.min(target, nextProg);
}

export function applyRunToProgress(prev: PlayerProgress, summary: RunSummary): PlayerProgress {
  const refreshed = refreshDailyMissionsIfNeeded(prev);
  const totalRunCoins = summary.coinsEarned + summary.modeBonusCoins;
  const record: RunRecord = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    dateIso: new Date().toISOString(),
    carId: summary.carId,
    worldId: summary.worldId,
    modeId: summary.modeId,
    distance: summary.distance,
    score: summary.score,
    coins: totalRunCoins,
    maxCombo: summary.maxCombo,
  };

  const nextHistory = [record, ...refreshed.runHistory]
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 10);

  let next: PlayerProgress = {
    ...refreshed,
    coins: refreshed.coins + totalRunCoins,
    highScore: Math.max(refreshed.highScore, summary.score),
    bestDistance: Math.max(refreshed.bestDistance, summary.distance),
    bestCombo: Math.max(refreshed.bestCombo, summary.maxCombo),
    mostCoinsRun: Math.max(refreshed.mostCoinsRun, totalRunCoins),
    totalDistance: refreshed.totalDistance + summary.distance,
    totalRuns: refreshed.totalRuns + 1,
    totalNearMisses: refreshed.totalNearMisses + summary.nearMisses,
    totalCoinsEarned: refreshed.totalCoinsEarned + totalRunCoins,
    totalRepairsCollected: refreshed.totalRepairsCollected + summary.repairsCollected,
    totalNitroUses: refreshed.totalNitroUses + summary.nitroUses,
    totalBossEscapes: refreshed.totalBossEscapes + (summary.bossEscaped ? 1 : 0),
    totalSmashes: refreshed.totalSmashes + summary.smashes,
    maxSpeedReached: Math.max(refreshed.maxSpeedReached, summary.maxSpeedKmh),
    maxNoDamageDistance: Math.max(refreshed.maxNoDamageDistance, summary.maxNoDamageDistance),
    maxCrashesSurvivedInRun: Math.max(refreshed.maxCrashesSurvivedInRun, summary.crashesTaken),
    runHistory: nextHistory,
    dailyMissions: refreshed.dailyMissions.map((m) =>
      m.claimed
        ? m
        : {
            ...m,
            progress: advanceMissionProgress(
              m.metric,
              m.progress,
              m.target,
              summary,
              totalRunCoins,
            ),
          },
    ),
    endlessMissions: refreshed.endlessMissions.map((m) => ({
      ...m,
      progress: advanceMissionProgress(
        m.metric,
        m.progress,
        m.target,
        summary,
        totalRunCoins,
      ),
    })),
  };

  next = addXpToProgress(next, summary.xpEarned);
  saveProgress(next);
  return next;
}

export function claimDailyLoginReward(prev: PlayerProgress): {
  next: PlayerProgress;
  rewardCoins: number;
} | null {
  const refreshed = refreshDailyMissionsIfNeeded(prev);
  const today = getTodayDateKey();
  if (refreshed.lastDailyBonusDate === today) return null;
  const streak = refreshed.dailyStreak + 1;
  const rewardCoins = Math.min(2500, 300 + (streak - 1) * 150);
  const next: PlayerProgress = {
    ...refreshed,
    coins: refreshed.coins + rewardCoins,
    totalCoinsEarned: refreshed.totalCoinsEarned + rewardCoins,
    lastDailyBonusDate: today,
    dailyStreak: streak,
  };
  saveProgress(next);
  return { next, rewardCoins };
}

export function markTutorialCompleted(prev: PlayerProgress): PlayerProgress {
  if (prev.tutorialCompleted) return prev;
  const next = { ...prev, tutorialCompleted: true };
  saveProgress(next);
  return next;
}

export function purchaseCar(prev: PlayerProgress, carId: CarId): PlayerProgress | null {
  if (prev.unlockedCars.includes(carId)) return null;
  const car = getCarById(carId);
  if (prev.coins < car.price) return null;
  const next: PlayerProgress = {
    ...prev,
    coins: prev.coins - car.price,
    unlockedCars: [...prev.unlockedCars, carId],
    equippedCar: carId,
  };
  saveProgress(next);
  return next;
}

export function equipCar(prev: PlayerProgress, carId: CarId): PlayerProgress {
  if (!prev.unlockedCars.includes(carId)) return prev;
  const next = { ...prev, equippedCar: carId };
  saveProgress(next);
  return next;
}

export function setCarColor(prev: PlayerProgress, carId: CarId, color: string): PlayerProgress {
  const next: PlayerProgress = {
    ...prev,
    carColors: { ...prev.carColors, [carId]: color },
  };
  saveProgress(next);
  return next;
}

export function setCarDecal(prev: PlayerProgress, carId: CarId, decal: DecalStyle): PlayerProgress {
  const next: PlayerProgress = {
    ...prev,
    carDecals: { ...prev.carDecals, [carId]: decal },
  };
  saveProgress(next);
  return next;
}

export function upgradeCarStat(
  prev: PlayerProgress,
  carId: CarId,
  stat: UpgradeStatKey,
): PlayerProgress | null {
  if (!prev.unlockedCars.includes(carId)) return null;
  const car = getCarById(carId);
  const currentLevels = { ...createEmptyUpgrades(), ...(prev.carUpgrades[carId] ?? {}) };
  const lvl = currentLevels[stat] ?? 0;
  if (lvl >= UPGRADE_MAX_LEVEL) return null;
  const cost = getUpgradeCost(car.price, lvl);
  if (prev.coins < cost) return null;
  const next: PlayerProgress = {
    ...prev,
    coins: prev.coins - cost,
    carUpgrades: {
      ...prev.carUpgrades,
      [carId]: {
        ...currentLevels,
        [stat]: lvl + 1,
      },
    },
  };
  saveProgress(next);
  return next;
}

export function unlockWorld(prev: PlayerProgress, worldId: WorldId): PlayerProgress | null {
  if (prev.unlockedWorlds.includes(worldId)) return null;
  const world = getWorldById(worldId);
  if (prev.coins < world.unlockCost) return null;
  const next: PlayerProgress = {
    ...prev,
    coins: prev.coins - world.unlockCost,
    unlockedWorlds: [...prev.unlockedWorlds, worldId],
    selectedWorld: worldId,
  };
  saveProgress(next);
  return next;
}

export function selectWorld(prev: PlayerProgress, worldId: WorldId): PlayerProgress {
  if (!prev.unlockedWorlds.includes(worldId)) return prev;
  const next = { ...prev, selectedWorld: worldId };
  saveProgress(next);
  return next;
}

export function selectMode(prev: PlayerProgress, modeId: GameModeId): PlayerProgress {
  const next = { ...prev, selectedMode: modeId };
  saveProgress(next);
  return next;
}

export function selectBoss(prev: PlayerProgress, bossId: BossType): PlayerProgress {
  const next = { ...prev, selectedBoss: bossId };
  saveProgress(next);
  return next;
}

export function claimMissionReward(prev: PlayerProgress, missionId: string): PlayerProgress | null {
  const targetMission = prev.dailyMissions.find((m) => m.id === missionId);
  if (!targetMission || targetMission.claimed || targetMission.progress < targetMission.target) {
    return null;
  }
  let next: PlayerProgress = {
    ...prev,
    coins: prev.coins + targetMission.rewardCoins,
    carParts: prev.carParts + targetMission.rewardParts,
    totalCoinsEarned: prev.totalCoinsEarned + targetMission.rewardCoins,
    totalMissionsCompleted: prev.totalMissionsCompleted + 1,
    dailyMissions: prev.dailyMissions.map((m) =>
      m.id === missionId ? { ...m, claimed: true } : m,
    ),
  };
  next = addXpToProgress(next, targetMission.rewardXp);
  saveProgress(next);
  return next;
}

export function claimEndlessMissionReward(
  prev: PlayerProgress,
  missionId: string,
): PlayerProgress | null {
  const targetMission = prev.endlessMissions.find((m) => m.id === missionId);
  if (!targetMission || targetMission.progress < targetMission.target) {
    return null;
  }
  const nextCounter = prev.endlessMissionCounter + 1;
  const replacement = generateEndlessMission(nextCounter);

  let next: PlayerProgress = {
    ...prev,
    coins: prev.coins + targetMission.rewardCoins,
    carParts: prev.carParts + targetMission.rewardParts,
    totalCoinsEarned: prev.totalCoinsEarned + targetMission.rewardCoins,
    totalMissionsCompleted: prev.totalMissionsCompleted + 1,
    endlessMissionCounter: nextCounter,
    endlessMissions: prev.endlessMissions.map((m) =>
      m.id === missionId ? replacement : m,
    ),
  };
  next = addXpToProgress(next, targetMission.rewardXp);
  saveProgress(next);
  return next;
}

export function getAchievementProgress(progress: PlayerProgress, ach: Achievement): number {
  switch (ach.metric) {
    case 'runs':
      return progress.totalRuns;
    case 'best_distance':
      return progress.bestDistance;
    case 'total_distance':
      return progress.totalDistance;
    case 'top_speed_hit':
      return progress.maxSpeedReached;
    case 'no_damage_distance':
      return progress.maxNoDamageDistance;
    case 'total_near_misses':
      return progress.totalNearMisses;
    case 'best_combo':
      return progress.bestCombo;
    case 'repairs_collected':
      return progress.totalRepairsCollected;
    case 'total_coins':
      return progress.totalCoinsEarned;
    case 'cars_unlocked':
      return progress.unlockedCars.length;
    case 'nitro_uses':
      return progress.totalNitroUses;
    case 'crashes_survived_run':
      return progress.maxCrashesSurvivedInRun;
    case 'total_smashes':
      return progress.totalSmashes;
    case 'boss_escapes':
      return progress.totalBossEscapes;
    case 'missions_completed':
      return progress.totalMissionsCompleted;
    case 'upgrade_levels': {
      let total = 0;
      for (const carId of Object.keys(progress.carUpgrades)) {
        const upg = progress.carUpgrades[carId];
        for (const k of Object.keys(upg) as UpgradeStatKey[]) {
          total += upg[k] ?? 0;
        }
      }
      return total;
    }
    case 'has_hypercar': {
      const hyperIds = CARS.filter((c) => c.category === 'hypercar').map((c) => c.id);
      return progress.unlockedCars.some((id) => hyperIds.includes(id)) ? 1 : 0;
    }
    case 'has_limousine': {
      const limoIds = CARS.filter((c) => c.category === 'limousine').map((c) => c.id);
      return progress.unlockedCars.some((id) => limoIds.includes(id)) ? 1 : 0;
    }
    case 'player_level':
      return progress.level;
    default:
      return 0;
  }
}

export function claimAchievementReward(
  prev: PlayerProgress,
  achievementId: string,
): PlayerProgress | null {
  if (prev.claimedAchievements.includes(achievementId)) return null;
  const ach = ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!ach) return null;
  const currentVal = getAchievementProgress(prev, ach);
  if (currentVal < ach.target) return null;

  let next: PlayerProgress = {
    ...prev,
    coins: prev.coins + ach.rewardCoins,
    totalCoinsEarned: prev.totalCoinsEarned + ach.rewardCoins,
    claimedAchievements: [...prev.claimedAchievements, achievementId],
  };
  next = addXpToProgress(next, ach.rewardXp);
  saveProgress(next);
  return next;
}

export function consumeReviveToken(prev: PlayerProgress): PlayerProgress | null {
  if (prev.reviveTokens > 0) {
    const next = { ...prev, reviveTokens: prev.reviveTokens - 1 };
    saveProgress(next);
    return next;
  }
  if (prev.coins >= 250) {
    const next = { ...prev, coins: prev.coins - 250 };
    saveProgress(next);
    return next;
  }
  return null;
}

export function grantOptionalRunBonus(prev: PlayerProgress, bonusCoins: number): PlayerProgress {
  const safeBonus = Math.max(0, Math.min(5000, Math.round(bonusCoins)));
  const next: PlayerProgress = {
    ...prev,
    coins: prev.coins + safeBonus,
    totalCoinsEarned: prev.totalCoinsEarned + safeBonus,
  };
  saveProgress(next);
  return next;
}

export function updateSettings(
  prev: PlayerProgress,
  patch: Partial<GameSettings>,
): PlayerProgress {
  const next: PlayerProgress = {
    ...prev,
    settings: { ...prev.settings, ...patch },
  };
  saveProgress(next);
  return next;
}

export function resetAllProgress(): PlayerProgress {
  const fresh = createDefaultProgress();
  saveProgress(fresh);
  return fresh;
}
