import { useCallback, useEffect, useRef, useState } from 'react';
import { isNativeAdsAvailable, preloadNativeAd, showRealAd } from './game/ads';
import { audioEngine } from './game/audio';
import { getCarById, getWorldById } from './game/data';
import { WrongWayEngine } from './game/engine';
import {
  applyRunToProgress,
  claimAchievementReward,
  claimDailyLoginReward,
  claimEndlessMissionReward,
  claimMissionReward,
  consumeReviveToken,
  equipCar,
  grantOptionalRunBonus,
  loadProgress,
  markTutorialCompleted,
  purchaseCar,
  refreshDailyMissionsIfNeeded,
  resetAllProgress,
  saveProgress,
  selectBoss,
  selectMode,
  selectWorld,
  setCarColor,
  setCarDecal,
  unlockWorld,
  updateSettings,
  upgradeCarStat,
} from './game/storage';
import {
  BossType,
  CarId,
  DecalStyle,
  GameModeId,
  GameSettings,
  LiveHudSnapshot,
  PlayerProgress,
  RunSummary,
  ScreenId,
  UpgradeStatKey,
  WorldId,
} from './game/types';
import { GameplayHud } from './components/GameplayHud';
import { GarageScreen } from './components/GarageScreen';
import {
  AchievementsScreen,
  EventsScreen,
  GameOverModal,
  LeaderboardScreen,
  MissionsScreen,
  ModesScreen,
  PauseModal,
  SettingsScreen,
  WorldsScreen,
} from './components/MetaScreens';
import { MainMenu, SplashScreen } from './components/TitleAndMenu';

const INITIAL_HUD: LiveHudSnapshot = {
  health: 100,
  maxHealth: 100,
  healthStage: 'normal',
  speedKmh: 0,
  distanceM: 0,
  score: 0,
  runCoins: 0,
  nitroRatio: 1,
  nitroActive: false,
  braking: false,
  comboCount: 0,
  comboTimerRatio: 0,
  nearMisses: 0,
  timeRemainingSec: null,
  modeProgressLabel: null,
  worldLabel: 'Neon City',
  damageFlash: 0,
  lowHealthWarning: false,
  activePowerUps: {
    magnetRemaining: 0,
    magnetDuration: 8.5,
    shieldRemaining: 0,
    shieldDuration: 10.0,
    slowMoRemaining: 0,
    slowMoDuration: 6.5,
  },
  ability: {
    id: 'steady_grip',
    name: 'Steady Grip',
    mode: 'passive',
    activeRemaining: 0,
    durationSec: 0,
    cooldownRemaining: 0,
    cooldownSec: 0,
    ready: false,
    accentHex: '#38bdf8',
  },
  boss: {
    active: false,
    bossName: '',
    bossType: 'black_hypercar',
    remainingSec: 0,
    totalSec: 60,
    warningText: null,
  },
  tutorialStep: -1,
  canRevive: true,
  notifications: [],
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WrongWayEngine | null>(null);

  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const progressRef = useRef<PlayerProgress>(progress);
  progressRef.current = progress;

  const [screen, setScreen] = useState<ScreenId>('splash');
  const screenRef = useRef<ScreenId>(screen);
  screenRef.current = screen;

  const [returnFromSettings, setReturnFromSettings] = useState<ScreenId>('menu');
  const [previewCarId, setPreviewCarId] = useState<CarId>(progress.equippedCar);
  const [hud, setHud] = useState<LiveHudSnapshot>(INITIAL_HUD);
  const [lastSummary, setLastSummary] = useState<RunSummary | null>(null);
  const [bonusClaimedThisRun, setBonusClaimedThisRun] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [webglError, setWebglError] = useState(false);
  const nativeAdsReady = isNativeAdsAvailable();

  const showBanner = useCallback((msg: string) => {
    setBannerMessage(msg);
    window.setTimeout(() => {
      setBannerMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  }, []);

  // Sync audio & graphics settings
  useEffect(() => {
    audioEngine.updateSettings(progress.settings);
    engineRef.current?.updateSettings(progress.settings, progress.carUpgrades);
  }, [progress.settings, progress.carUpgrades]);

  // Auto-refresh daily missions whenever a new day begins
  useEffect(() => {
    const checkRollover = () => {
      setProgress((prev) => refreshDailyMissionsIfNeeded(prev));
    };
    const timer = window.setInterval(checkRollover, 30000);
    window.addEventListener('focus', checkRollover);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkRollover);
    };
  }, []);

  // Mount Three.js engine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    try {
      const engine = new WrongWayEngine(container, progressRef.current.settings, {
        onHudUpdate: (snapshot) => {
          setHud(snapshot);
        },
        onGameOver: (rawSummary) => {
          const prev = progressRef.current;
          const summary: RunSummary = {
            ...rawSummary,
            isNewBestDistance: rawSummary.distance > prev.bestDistance,
            isNewHighScore: rawSummary.score > prev.highScore,
          };
          const updated = applyRunToProgress(prev, summary);
          progressRef.current = updated;
          setProgress(updated);
          setLastSummary(summary);
          setBonusClaimedThisRun(false);
          setAdLoading(false);
          preloadNativeAd();
          setScreen('gameover');
        },
        onTutorialComplete: () => {
          setProgress((prev) => markTutorialCompleted(prev));
        },
      });

      const p = progressRef.current;
      const car = getCarById(p.equippedCar);
      const color = p.carColors[p.equippedCar] ?? car.defaultColor;
      const decal = p.carDecals[p.equippedCar] ?? 'clean';
      engine.rebuildWorld(p.selectedWorld);
      engine.rebuildPlayerCar(p.equippedCar, color, decal);
      engine.setShowroomCar(p.equippedCar, color, decal);
      engine.setViewMode('highway_attract');
      engineRef.current = engine;
      preloadNativeAd();

      return () => {
        engine.dispose();
        engineRef.current = null;
      };
    } catch {
      setWebglError(true);
    }
  }, []);

  const unlockAudioOnGesture = useCallback(() => {
    audioEngine.unlock();
    audioEngine.startMusic();
  }, []);

  const startDrive = useCallback(
    (modeOverride?: GameModeId) => {
      unlockAudioOnGesture();
      audioEngine.playUiClick();
      const p = progressRef.current;
      const car = getCarById(p.equippedCar);
      const color = p.carColors[p.equippedCar] ?? car.defaultColor;
      const decal = p.carDecals[p.equippedCar] ?? 'clean';
      const activeMode = modeOverride ?? p.selectedMode;
      setLastSummary(null);
      setBonusClaimedThisRun(false);
      setScreen('playing');
      engineRef.current?.startNewRun({
        carId: p.equippedCar,
        colorHex: color,
        decal,
        worldId: p.selectedWorld,
        modeId: activeMode,
        bossType: p.selectedBoss,
        tutorialNeeded: !p.tutorialCompleted,
        upgradeLevels: p.carUpgrades,
      });
    },
    [unlockAudioOnGesture],
  );

  const navigateTo = useCallback(
    (next: ScreenId) => {
      unlockAudioOnGesture();
      audioEngine.playUiClick();
      const engine = engineRef.current;
      const p = progressRef.current;

      if (next === 'settings') {
        setReturnFromSettings(screenRef.current === 'paused' ? 'paused' : 'menu');
      }
      if (next === 'missions') {
        setProgress((prev) => refreshDailyMissionsIfNeeded(prev));
      }

      if (next === 'garage' || next === 'upgrades') {
        const targetCar = p.equippedCar;
        setPreviewCarId(targetCar);
        const c = getCarById(targetCar);
        const color = p.carColors[targetCar] ?? c.defaultColor;
        const decal = p.carDecals[targetCar] ?? 'clean';
        engine?.setShowroomCar(targetCar, color, decal);
        engine?.setViewMode('showroom');
      } else if (next === 'paused') {
        engine?.setViewMode('paused');
      } else if (next === 'playing') {
        engine?.setViewMode('gameplay');
      } else if (next !== 'gameover' && next !== 'settings') {
        const c = getCarById(p.equippedCar);
        const color = p.carColors[p.equippedCar] ?? c.defaultColor;
        const decal = p.carDecals[p.equippedCar] ?? 'clean';
        engine?.rebuildPlayerCar(p.equippedCar, color, decal);
        engine?.setViewMode('highway_attract');
      }

      setScreen(next);
    },
    [unlockAudioOnGesture],
  );

  // Keyboard Controls + Android App Lifecycle Pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const cur = screenRef.current;
      if (cur === 'splash') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigateTo('menu');
        }
        return;
      }

      if (cur === 'playing') {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          engineRef.current?.moveLane(-1);
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          engineRef.current?.moveLane(1);
        } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          engineRef.current?.setNitro(true);
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          engineRef.current?.setBraking(true);
        } else if (e.key === 'e' || e.key === 'E' || e.key === 'Shift') {
          e.preventDefault();
          engineRef.current?.triggerAbility();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          navigateTo('paused');
        }
      } else if (cur === 'paused') {
        if (e.key === 'Escape') {
          e.preventDefault();
          navigateTo('playing');
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (screenRef.current !== 'playing') return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        engineRef.current?.setNitro(false);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        engineRef.current?.setBraking(false);
      }
    };

    const pauseOnLeave = () => {
      engineRef.current?.setNitro(false);
      engineRef.current?.setBraking(false);
      if (screenRef.current === 'playing') {
        navigateTo('paused');
      } else {
        audioEngine.stopEngine();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        pauseOnLeave();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pauseOnLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', pauseOnLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [navigateTo]);

  // Accelerometer / Tilt Steering on Android devices
  useEffect(() => {
    if (!progress.settings.tiltSteering) return;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (screenRef.current !== 'playing') return;
      if (typeof e.gamma === 'number') {
        engineRef.current?.applyTiltSteer(e.gamma);
      }
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [progress.settings.tiltSteering]);

  const commitProgress = useCallback((next: PlayerProgress) => {
    progressRef.current = next;
    setProgress(next);
  }, []);

  // Garage Handlers
  const handleSelectPreviewCar = (carId: CarId) => {
    audioEngine.playUiClick();
    setPreviewCarId(carId);
    const p = progressRef.current;
    const car = getCarById(carId);
    const color = p.carColors[carId] ?? car.defaultColor;
    const decal = p.carDecals[carId] ?? 'clean';
    engineRef.current?.setShowroomCar(carId, color, decal);
  };

  const handleUnlockCar = (carId: CarId) => {
    const next = purchaseCar(progressRef.current, carId);
    if (!next) return;
    audioEngine.playUnlock();
    commitProgress(next);
    const car = getCarById(carId);
    const color = next.carColors[carId] ?? car.defaultColor;
    const decal = next.carDecals[carId] ?? 'clean';
    engineRef.current?.rebuildPlayerCar(carId, color, decal);
  };

  const handleEquipCar = (carId: CarId) => {
    audioEngine.playUiClick();
    const next = equipCar(progressRef.current, carId);
    commitProgress(next);
    const car = getCarById(carId);
    const color = next.carColors[carId] ?? car.defaultColor;
    const decal = next.carDecals[carId] ?? 'clean';
    engineRef.current?.rebuildPlayerCar(carId, color, decal);
  };

  const handleChangeColor = (carId: CarId, color: string) => {
    audioEngine.playUiClick();
    const next = setCarColor(progressRef.current, carId, color);
    commitProgress(next);
    const decal = next.carDecals[carId] ?? 'clean';
    engineRef.current?.setShowroomCar(carId, color, decal);
    if (next.equippedCar === carId) {
      engineRef.current?.rebuildPlayerCar(carId, color, decal);
    }
  };

  const handleChangeDecal = (carId: CarId, decal: DecalStyle) => {
    audioEngine.playUiClick();
    const next = setCarDecal(progressRef.current, carId, decal);
    commitProgress(next);
    const car = getCarById(carId);
    const color = next.carColors[carId] ?? car.defaultColor;
    engineRef.current?.setShowroomCar(carId, color, decal);
    if (next.equippedCar === carId) {
      engineRef.current?.rebuildPlayerCar(carId, color, decal);
    }
  };

  const handleUpgradeStat = (carId: CarId, stat: UpgradeStatKey) => {
    const next = upgradeCarStat(progressRef.current, carId, stat);
    if (!next) return;
    audioEngine.playUnlock();
    commitProgress(next);
  };

  // World, Mode & Boss Handlers
  const handleSelectWorld = (worldId: WorldId) => {
    audioEngine.playUiClick();
    const next = selectWorld(progressRef.current, worldId);
    commitProgress(next);
    engineRef.current?.rebuildWorld(worldId);
    setHud((h) => ({ ...h, worldLabel: getWorldById(worldId).name }));
  };

  const handleUnlockWorld = (worldId: WorldId) => {
    const next = unlockWorld(progressRef.current, worldId);
    if (!next) return;
    audioEngine.playUnlock();
    commitProgress(next);
    engineRef.current?.rebuildWorld(worldId);
    setHud((h) => ({ ...h, worldLabel: getWorldById(worldId).name }));
  };

  const handleSelectMode = (modeId: GameModeId) => {
    audioEngine.playUiClick();
    commitProgress(selectMode(progressRef.current, modeId));
  };

  const handleSelectBoss = (boss: BossType) => {
    audioEngine.playUiClick();
    commitProgress(selectBoss(progressRef.current, boss));
  };

  const handleLaunchBossChase = () => {
    const next = selectMode(progressRef.current, 'boss_escape');
    commitProgress(next);
    startDrive('boss_escape');
  };

  // Missions, Achievements & Daily Streak
  const handleClaimMission = (missionId: string) => {
    const next = claimMissionReward(progressRef.current, missionId);
    if (!next) return;
    audioEngine.playUnlock();
    commitProgress(next);
  };

  const handleClaimEndlessMission = (missionId: string) => {
    const next = claimEndlessMissionReward(progressRef.current, missionId);
    if (!next) return;
    audioEngine.playUnlock();
    commitProgress(next);
    showBanner('New Endless Contract Unlocked!');
  };

  const handleClaimAchievement = (achievementId: string) => {
    const next = claimAchievementReward(progressRef.current, achievementId);
    if (!next) return;
    audioEngine.playUnlock();
    commitProgress(next);
  };

  const handleClaimDailyBonus = () => {
    const res = claimDailyLoginReward(progressRef.current);
    if (!res) return;
    audioEngine.playUnlock();
    commitProgress(res.next);
    showBanner(`Daily Streak Day ${res.next.dailyStreak}: +${res.rewardCoins.toLocaleString()} Coins`);
  };

  // Settings, Tutorial & Revive
  const handleUpdateSettings = (patch: Partial<GameSettings>) => {
    const next = updateSettings(progressRef.current, patch);
    commitProgress(next);
  };

  const handleReplayTutorial = () => {
    audioEngine.playUiClick();
    const next = { ...progressRef.current, tutorialCompleted: false };
    saveProgress(next);
    commitProgress(next);
    showBanner('Playable tutorial enabled for your next run');
  };

  const handleResetAll = () => {
    const fresh = resetAllProgress();
    commitProgress(fresh);
    setPreviewCarId(fresh.equippedCar);
    engineRef.current?.rebuildWorld(fresh.selectedWorld);
    engineRef.current?.rebuildPlayerCar(
      fresh.equippedCar,
      fresh.carColors[fresh.equippedCar],
      fresh.carDecals[fresh.equippedCar] ?? 'clean',
    );
    engineRef.current?.setShowroomCar(
      fresh.equippedCar,
      fresh.carColors[fresh.equippedCar],
      fresh.carDecals[fresh.equippedCar] ?? 'clean',
    );
  };

  const handleRevive = () => {
    const next = consumeReviveToken(progressRef.current);
    if (!next) return;
    commitProgress(next);
    setLastSummary(null);
    setScreen('playing');
    engineRef.current?.reviveRun();
  };

  const handleWatchAdRevive = async () => {
    if (!hud.canRevive || adLoading) return;
    setAdLoading(true);
    const res = await showRealAd('free_revive');
    setAdLoading(false);
    if (!res.ok) {
      showBanner(res.message);
      return;
    }
    audioEngine.playUnlock();
    setLastSummary(null);
    setScreen('playing');
    engineRef.current?.reviveRun();
  };

  const handleWatchAdGarageCoins = async () => {
    if (adLoading) return;
    setAdLoading(true);
    const res = await showRealAd('garage_coins');
    setAdLoading(false);
    if (!res.ok) {
      showBanner(res.message);
      return;
    }
    audioEngine.playUnlock();
    setProgress((prev) => {
      const next = grantOptionalRunBonus(prev, 500);
      progressRef.current = next;
      return next;
    });
    showBanner('+500 Coins Rewarded!');
  };

  const handleClaimOptionalBonus = async () => {
    if (!lastSummary || bonusClaimedThisRun || adLoading) return;
    const bonusCoins = lastSummary.coinsEarned + lastSummary.modeBonusCoins;
    if (bonusCoins <= 0) return;

    if (nativeAdsReady) {
      setAdLoading(true);
      const res = await showRealAd('double_coins');
      setAdLoading(false);
      if (!res.ok) {
        showBanner(res.message);
        return;
      }
    }

    audioEngine.playUnlock();
    setProgress((prev) => {
      const next = grantOptionalRunBonus(prev, bonusCoins);
      progressRef.current = next;
      return next;
    });
    setBonusClaimedThisRun(true);
    showBanner(`+${bonusCoins.toLocaleString()} Bonus Coins Added!`);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#080a0f]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={mountRef} className="fixed inset-0 z-0" />

      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080a0f] p-6 text-center">
          <div className="max-w-md rounded-xl border border-white/15 bg-slate-900 p-6">
            <h1 className="font-display text-2xl font-bold text-white mb-2">
              3D Graphics Unavailable
            </h1>
            <p className="text-sm text-slate-300">
              Your device could not initialize WebGL hardware acceleration. Please enable WebGL and reload.
            </p>
          </div>
        </div>
      )}

      {bannerMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-500 px-4 py-2 font-display text-xs font-bold text-slate-950 shadow-lg">
          {bannerMessage}
        </div>
      )}

      {screen === 'splash' && (
        <SplashScreen onEnter={() => navigateTo('menu')} />
      )}

      {screen === 'menu' && (
        <MainMenu
          progress={progress}
          onStartDrive={() => startDrive()}
          onNavigate={navigateTo}
          onClaimDailyBonus={handleClaimDailyBonus}
        />
      )}

      {(screen === 'garage' || screen === 'upgrades') && (
        <GarageScreen
          initialTab={screen === 'upgrades' ? 'upgrades' : 'garage'}
          progress={progress}
          previewCarId={previewCarId}
          adLoading={adLoading}
          onWatchAdCoins={handleWatchAdGarageCoins}
          onSelectPreviewCar={handleSelectPreviewCar}
          onUnlockCar={handleUnlockCar}
          onEquipCar={handleEquipCar}
          onChangeColor={handleChangeColor}
          onChangeDecal={handleChangeDecal}
          onUpgradeStat={handleUpgradeStat}
          onDriveNow={() => startDrive()}
          onBack={() => navigateTo('menu')}
        />
      )}

      {screen === 'worlds' && (
        <WorldsScreen
          progress={progress}
          onSelectWorld={handleSelectWorld}
          onUnlockWorld={handleUnlockWorld}
          onDriveNow={() => startDrive()}
          onBack={() => navigateTo('menu')}
        />
      )}

      {screen === 'modes' && (
        <ModesScreen
          selectedMode={progress.selectedMode}
          onSelectMode={handleSelectMode}
          onDriveNow={() => startDrive()}
          onBack={() => navigateTo('menu')}
        />
      )}

      {screen === 'events' && (
        <EventsScreen
          selectedBoss={progress.selectedBoss}
          totalEscapes={progress.totalBossEscapes}
          onSelectBoss={handleSelectBoss}
          onLaunchBossChase={handleLaunchBossChase}
          onBack={() => navigateTo('menu')}
        />
      )}

      {screen === 'leaderboard' && (
        <LeaderboardScreen
          progress={progress}
          onBack={() => navigateTo('menu')}
        />
      )}

      {screen === 'missions' && (
        <MissionsScreen
          progress={progress}
          onClaimMission={handleClaimMission}
          onClaimEndlessMission={handleClaimEndlessMission}
          onBack={() => navigateTo('menu')}
        />
      )}

      {screen === 'achievements' && (
        <AchievementsScreen
          progress={progress}
          onClaimAchievement={handleClaimAchievement}
          onBack={() => navigateTo('menu')}
        />
      )}

      {screen === 'settings' && (
        <SettingsScreen
          settings={progress.settings}
          onChange={handleUpdateSettings}
          onReplayTutorial={handleReplayTutorial}
          onResetAll={handleResetAll}
          onBack={() => navigateTo(returnFromSettings)}
        />
      )}

      {screen === 'playing' && (
        <GameplayHud
          hud={hud}
          controlScheme={progress.settings.controlScheme}
          muted={progress.settings.muted}
          onToggleMute={() => handleUpdateSettings({ muted: !progress.settings.muted })}
          onPause={() => navigateTo('paused')}
          onMoveLane={(dir) => engineRef.current?.moveLane(dir)}
          onNitroChange={(active) => engineRef.current?.setNitro(active)}
          onBrakeChange={(active) => engineRef.current?.setBraking(active)}
          onTriggerAbility={() => engineRef.current?.triggerAbility()}
        />
      )}

      {screen === 'paused' && (
        <PauseModal
          onResume={() => navigateTo('playing')}
          onRestart={() => startDrive()}
          onSettings={() => navigateTo('settings')}
          onGarage={() => navigateTo('garage')}
          onHome={() => navigateTo('menu')}
        />
      )}

      {screen === 'gameover' && lastSummary && (
        <GameOverModal
          summary={lastSummary}
          progress={progress}
          canRevive={hud.canRevive}
          bonusClaimed={bonusClaimedThisRun}
          nativeAdsReady={nativeAdsReady}
          adLoading={adLoading}
          onClaimOptionalBonus={handleClaimOptionalBonus}
          onWatchAdRevive={handleWatchAdRevive}
          onRevive={handleRevive}
          onRetry={() => startDrive()}
          onGarage={() => navigateTo('garage')}
          onHome={() => navigateTo('menu')}
        />
      )}
    </div>
  );
}
