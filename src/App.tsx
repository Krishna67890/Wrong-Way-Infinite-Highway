import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdPurpose,
  AdResult,
  isNativeAdsAvailable,
  preloadNativeAd,
  registerWebAdPresenter,
  setNativeGameplayActive,
  showRealAd,
} from './game/ads';
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
  selectMode,
  selectWorld,
  setCarColor,
  setCarDecal,
  unlockWorld,
  updateSettings,
  upgradeCarStat,
} from './game/storage';
import {
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
  AboutScreen,
  AchievementsScreen,
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
  stuntJumps: 0,
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
  const [webAdState, setWebAdState] = useState<{
    purpose: AdPurpose;
    secondsLeft: number;
    resolve: (res: AdResult) => void;
  } | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [webglError, setWebglError] = useState(false);
  const nativeAdsReady = isNativeAdsAvailable();

  const showBanner = useCallback((msg: string) => {
    setBannerMessage(msg);
    window.setTimeout(() => {
      setBannerMessage((cur) => (cur === msg ? null : cur));
    }, 3200);
  }, []);

  // Register interactive Web Sponsored Ad presenter for non-APK browser preview
  useEffect(() => {
    registerWebAdPresenter((purpose) => {
      return new Promise<AdResult>((resolve) => {
        setWebAdState({ purpose, secondsLeft: 5, resolve });
      });
    });
    return () => registerWebAdPresenter(null);
  }, []);

  useEffect(() => {
    if (!webAdState || webAdState.secondsLeft <= 0) return;
    const t = window.setTimeout(() => {
      setWebAdState((cur) =>
        cur && cur.secondsLeft > 0 ? { ...cur, secondsLeft: cur.secondsLeft - 1 } : cur,
      );
    }, 1000);
    return () => window.clearTimeout(t);
  }, [webAdState]);

  // Sync audio & graphics settings
  useEffect(() => {
    audioEngine.updateSettings(progress.settings);
    engineRef.current?.updateSettings(progress.settings, progress.carUpgrades);
  }, [progress.settings, progress.carUpgrades]);

  // Toggle native AdMob anchored banner visibility when entering/leaving gameplay
  useEffect(() => {
    setNativeGameplayActive(screen === 'playing');
  }, [screen]);

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

  // World & Mode Handlers
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
    try {
      const res = await showRealAd('free_revive');
      if (!res.ok) {
        showBanner(res.message);
        return;
      }
      audioEngine.playUnlock();
      setLastSummary(null);
      setScreen('playing');
      engineRef.current?.reviveRun();
    } finally {
      setAdLoading(false);
    }
  };

  const handleWatchAdGarageCoins = async () => {
    if (adLoading) return;
    setAdLoading(true);
    try {
      const res = await showRealAd('garage_coins');
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
    } finally {
      setAdLoading(false);
    }
  };

  const handleClaimOptionalBonus = async () => {
    if (!lastSummary || bonusClaimedThisRun || adLoading) return;
    const bonusCoins = lastSummary.coinsEarned + lastSummary.modeBonusCoins;
    if (bonusCoins <= 0) return;

    setAdLoading(true);
    try {
      const res = await showRealAd('double_coins');
      if (!res.ok) {
        showBanner(res.message);
        return;
      }

      audioEngine.playUnlock();
      setProgress((prev) => {
        const next = grantOptionalRunBonus(prev, bonusCoins);
        progressRef.current = next;
        return next;
      });
      setBonusClaimedThisRun(true);
      showBanner(`+${bonusCoins.toLocaleString()} Bonus Coins Added!`);
    } finally {
      setAdLoading(false);
    }
  };

  const handleFinishRunFromPause = () => {
    audioEngine.playUiClick();
    engineRef.current?.finishCurrentRun();
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
        <div className="fixed top-16 left-4 z-50 max-w-[80vw] sm:max-w-xs rounded-lg bg-emerald-500/95 border border-emerald-400 px-3 py-2 text-left font-display text-xs font-bold text-slate-950 shadow-lg">
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

      {screen === 'leaderboard' && (
        <LeaderboardScreen
          progress={progress}
          onBack={() => navigateTo('menu')}
          onNavigateToAbout={() => navigateTo('about')}
        />
      )}

      {screen === 'about' && (
        <AboutScreen onBack={() => navigateTo('menu')} />
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
          onFinishRun={handleFinishRunFromPause}
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

      {webAdState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/82">
          <div className="w-full max-w-sm rounded-xl bg-[#090d16] border border-amber-400/40 p-5 text-center shadow-2xl">
            <div className="text-[11px] font-display font-bold tracking-widest uppercase text-amber-400 mb-1">
              Sponsored Reward Ad
            </div>
            <h3 className="font-display text-lg font-bold text-white mb-1">
              {webAdState.purpose === 'free_revive'
                ? 'Free Highway Revive'
                : webAdState.purpose === 'double_coins'
                  ? '2x Run Coins Multiplier'
                  : '+500 Garage Bonus Coins'}
            </h3>
            <p className="text-xs text-slate-300 mb-3">
              {webAdState.purpose === 'free_revive'
                ? 'Watch to repair your hull and jump right back into traffic.'
                : webAdState.purpose === 'double_coins'
                  ? 'Watch to double every coin collected on this run.'
                  : 'Watch to add +500 bonus coins to your Garage balance.'}
            </p>
            <div className="rounded-lg bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/60 border border-cyan-400/25 p-4 mb-4">
              <div className="font-display text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1">
                Emergency &amp; Hypercar Collection
              </div>
              <div className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                Take control of the Rescue Ambulance, Highway Police Cruiser, Fire Brigade Engine, and 350+ km/h Hypercars against oncoming 6-lane traffic.
              </div>
              <div className="text-xs font-semibold text-white mb-2">
                {webAdState.secondsLeft > 0
                  ? `Reward unlocks in ${webAdState.secondsLeft}s...`
                  : 'Reward Unlocked!'}
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-300"
                  style={{ width: `${((5 - webAdState.secondsLeft) / 5) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={webAdState.secondsLeft > 0}
                onClick={() => {
                  const res = webAdState.resolve;
                  setWebAdState(null);
                  res({ ok: true, message: 'Sponsored ad reward earned!' });
                }}
                className={`w-full rounded-lg py-2.5 font-display text-sm font-bold transition-colors ${
                  webAdState.secondsLeft > 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer'
                }`}
              >
                {webAdState.secondsLeft > 0
                  ? `WAIT ${webAdState.secondsLeft}s...`
                  : 'CLAIM REWARD & CONTINUE'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = webAdState.resolve;
                  setWebAdState(null);
                  res({ ok: false, message: 'Ad closed before reward unlocked.' });
                }}
                className="w-full rounded-lg bg-slate-900 border border-white/10 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Close Ad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
