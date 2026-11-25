import React, { useEffect, useState } from 'react';
import {
  Award,
  Car,
  Coins,
  Compass,
  Flag,
  Gift,
  Info,
  Play,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Wrench,
} from 'lucide-react';
import {
  CARS,
  WORLDS,
  getCarById,
  getModeById,
  getWorldById,
  xpRequiredForLevel,
} from '../game/data';
import { getTodayDateKey } from '../game/storage';
import { CarClass, PlayerProgress, ScreenId } from '../game/types';

export const CLASS_BADGE_STYLES: Record<CarClass, string> = {
  Normal: 'bg-slate-700/90 text-slate-100 border-slate-400/40',
  Fast: 'bg-sky-500/20 text-sky-300 border-sky-400/50',
  Turbo: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
  Armored: 'bg-zinc-400/20 text-zinc-200 border-zinc-300/45',
  Ability: 'bg-purple-500/25 text-purple-300 border-purple-400/55',
  Hyper: 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60',
  Executive: 'bg-amber-900/40 text-amber-200 border-amber-400/50',
  Legend: 'bg-amber-500/25 text-amber-300 border-amber-400/70',
};

interface SplashScreenProps {
  onEnter: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onEnter }) => {
  const [loadPct, setLoadPct] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 1250;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setLoadPct(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ready = loadPct >= 100;

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between gap-4 overflow-y-auto custom-scroll p-4 sm:p-8 bg-gradient-to-r from-[#070a12]/94 via-[#070a12]/65 to-[#070a12]/30"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
        <div className="text-[11px] sm:text-xs font-semibold tracking-widest text-amber-400 uppercase">
          3D Six-Lane Wrong-Way Highway · Web &amp; Android
        </div>
        <div className="rounded-lg border border-white/15 bg-[#090d16]/90 px-3 py-1.5 text-right">
          <div className="font-display text-[11px] sm:text-sm font-bold tracking-wider uppercase rgb-credit-text">
            Developed By Krishna Patil Rajput
          </div>
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-300">
            Real Name: <span className="text-white font-semibold">Krishna Ajaysing Patil</span>
          </div>
        </div>
      </div>

      <div className="max-w-xl my-auto py-1">
        <svg
          viewBox="0 0 520 124"
          className="w-full max-w-sm sm:max-w-lg mb-2 sm:mb-3"
          aria-label="HIGHWAY HAVOC: WRONG WAY"
        >
          <polygon points="0,12 22,12 10,58 0,58" fill="#f59e0b" />
          <polygon points="28,12 40,12 28,58 16,58" fill="#ef4444" />
          <text
            x="52"
            y="54"
            fill="#ffffff"
            fontFamily="Chakra Petch, sans-serif"
            fontWeight="700"
            fontSize="44"
            letterSpacing="2"
          >
            HIGHWAY HAVOC
          </text>
          <rect x="52" y="68" width="440" height="2" fill="#f59e0b" opacity="0.75" />
          <text
            x="52"
            y="98"
            fill="#fbbf24"
            fontFamily="Chakra Petch, sans-serif"
            fontWeight="700"
            fontSize="22"
            letterSpacing="6"
          >
            WRONG WAY
          </text>
        </svg>

        {/* Center RGB Developer Showcase Card */}
        <div className="mb-3 sm:mb-5 rounded-xl border border-white/15 bg-[#090d16]/92 px-4 py-3 max-w-md">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-400 mb-0.5">
            Game Creator &amp; Lead Developer
          </div>
          <div className="font-display text-base sm:text-xl font-bold tracking-wide rgb-credit-text">
            Developed By Krishna Patil Rajput
          </div>
          <div className="text-xs sm:text-sm text-slate-200 mt-0.5">
            Real Name: <span className="font-semibold text-white">Krishna Ajaysing Patil</span>
          </div>

          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-300 mb-1">
              <span>
                {ready
                  ? `3D Wrong-Way Traffic & ${CARS.length} Vehicles Ready`
                  : 'Initializing 3D Highway Engine...'}
              </span>
              <span className="text-cyan-300 font-bold">{loadPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rgb-credit-bar transition-all duration-75"
                style={{ width: `${loadPct}%` }}
              />
            </div>
          </div>
        </div>

        <p className="text-slate-300 text-xs sm:text-base max-w-md mb-4 sm:mb-6 leading-relaxed">
          Weave head-on through incoming six-lane highway traffic, launch off Stunt Ramps, unlock {CARS.length} vehicles including Police Cruisers, Rescue Ambulances &amp; Fire Brigade Engines, and conquer endless missions.
        </p>

        <button
          type="button"
          onClick={onEnter}
          className="inline-flex items-center gap-2.5 sm:gap-3 rounded-lg bg-amber-500 px-6 py-3 sm:px-8 sm:py-4 font-display text-sm sm:text-lg font-bold tracking-wider text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-lg"
        >
          <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          <span>{ready ? 'ENTER GARAGE & HIGHWAY' : 'SKIP & ENTER HIGHWAY'}</span>
        </button>
      </div>

      <div className="text-[11px] sm:text-xs text-slate-400 shrink-0">
        Swipe / A-D / Buttons: Change Lanes · Nitro / Space: Boost · E / Ability: Car Power · S: Brake · Esc: Pause
      </div>
    </div>
  );
};

interface MainMenuProps {
  progress: PlayerProgress;
  onStartDrive: () => void;
  onNavigate: (screen: ScreenId) => void;
  onClaimDailyBonus: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  progress,
  onStartDrive,
  onNavigate,
  onClaimDailyBonus,
}) => {
  const car = getCarById(progress.equippedCar);
  const world = getWorldById(progress.selectedWorld);
  const mode = getModeById(progress.selectedMode);
  const xpNeeded = xpRequiredForLevel(progress.level);
  const xpPct = Math.min(100, Math.round((progress.xp / xpNeeded) * 100));
  const claimableDaily = progress.dailyMissions.filter(
    (m) => !m.claimed && m.progress >= m.target,
  ).length;
  const claimableEndless = progress.endlessMissions.filter(
    (m) => m.progress >= m.target,
  ).length;
  const claimableMissions = claimableDaily + claimableEndless;
  const dailyReady = progress.lastDailyBonusDate !== getTodayDateKey();

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between gap-3 overflow-y-auto custom-scroll p-3 sm:p-6 pointer-events-none"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      {/* Top Status Strip */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 rounded-xl bg-[#090d16]/90 border border-white/10 px-3 sm:px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="font-display text-base sm:text-xl font-bold tracking-wide text-white truncate">
              HIGHWAY HAVOC
            </div>
            <div className="text-[10px] sm:text-[11px] font-semibold rgb-credit-text truncate">
              Developed By Krishna Patil Rajput
            </div>
            <div className="text-[10px] text-slate-300 truncate hidden sm:block">
              Real Name: Krishna Ajaysing Patil
            </div>
          </div>
          <div className="hidden sm:block h-8 w-px bg-white/10" />
          <div className="hidden xs:block">
            <div className="text-[11px] sm:text-xs text-slate-300 font-medium">
              Lv.{progress.level}
            </div>
            <div className="mt-1 h-1.5 w-16 sm:w-28 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-amber-400" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          {dailyReady && (
            <button
              type="button"
              onClick={onClaimDailyBonus}
              className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] sm:text-xs font-display font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>DAILY</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 border border-white/10 px-2.5 py-1 font-mono-num font-bold text-amber-300">
            <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span>{progress.coins.toLocaleString()}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-300 font-mono-num">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>{progress.reviveTokens} Revive</span>
          </div>
          <div className="hidden md:block text-slate-300 font-mono-num">
            Best:{' '}
            <span className="text-white font-semibold">
              {progress.bestDistance.toLocaleString()}m
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            aria-label="Open Settings"
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-slate-800/90 border border-white/10 text-slate-200 hover:border-amber-400/60 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Left Control Column */}
      <div className="my-auto flex flex-col items-start justify-start mr-auto w-full max-w-sm sm:max-w-md">
        <div className="pointer-events-auto w-full rounded-xl bg-[#090d16]/92 border border-white/15 p-4 sm:p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400">
              Equipped · {car.rarity}
            </div>
            <span
              className={`rounded border px-2 py-0.5 font-display text-[10px] sm:text-[11px] font-bold uppercase ${CLASS_BADGE_STYLES[car.carClass]}`}
            >
              {car.carClass} Class
            </span>
          </div>
          <div className="font-display text-xl sm:text-2xl font-bold text-white truncate">
            {car.name}
          </div>
          <div className="text-xs text-slate-400 mb-2.5 sm:mb-3">
            {car.tierLabel} · Base {car.baseStats.topSpeed} km/h
          </div>

          <div className="mb-3 sm:mb-4 rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{car.ability.name}</span>
              <span className="ml-auto text-[10px] font-mono-num uppercase text-amber-300 shrink-0">
                {car.ability.mode}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-300 leading-snug">
              {car.ability.description}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3.5 sm:mb-5">
            <button
              type="button"
              onClick={() => onNavigate('worlds')}
              className="text-left rounded-lg bg-slate-900/90 border border-white/10 px-2.5 sm:px-3 py-2 hover:border-amber-400/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Environment</span>
              </div>
              <div className="mt-0.5 text-xs sm:text-sm font-semibold text-white truncate">
                {world.name}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('modes')}
              className="text-left rounded-lg bg-slate-900/90 border border-white/10 px-2.5 sm:px-3 py-2 hover:border-amber-400/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Flag className="w-3.5 h-3.5 text-amber-400" />
                <span>Game Mode</span>
              </div>
              <div className="mt-0.5 text-xs sm:text-sm font-semibold text-white truncate">
                {mode.name}
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={onStartDrive}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-3 sm:py-4 font-display text-lg sm:text-xl font-bold tracking-wider text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-lg"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>PLAY HIGHWAY</span>
          </button>
        </div>
      </div>

      {/* Bottom Dock Navigation */}
      <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto pb-1 custom-scroll shrink-0 sm:flex-wrap sm:justify-start">
        <button
          type="button"
          onClick={() => onNavigate('garage')}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:border-amber-400/60 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Car className="w-4 h-4 text-amber-400" />
          <span>
            Garage ({progress.unlockedCars.length}/{CARS.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('upgrades')}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:border-amber-400/60 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Wrench className="w-4 h-4 text-cyan-400" />
          <span>Upgrades</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('worlds')}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:border-amber-400/60 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Compass className="w-4 h-4 text-emerald-400" />
          <span>
            Worlds ({progress.unlockedWorlds.length}/{WORLDS.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('missions')}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:border-amber-400/60 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Target className="w-4 h-4 text-rose-400" />
          <span>
            Missions{claimableMissions > 0 ? ` (${claimableMissions})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('achievements')}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:border-amber-400/60 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Award className="w-4 h-4 text-purple-400" />
          <span>Achievements</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('leaderboard')}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:border-amber-400/60 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Trophy className="w-4 h-4 text-amber-300" />
          <span>Records</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('about')}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:border-cyan-400/60 hover:text-cyan-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Info className="w-4 h-4 text-cyan-400" />
          <span>About</span>
        </button>
      </div>
    </div>
  );
};
