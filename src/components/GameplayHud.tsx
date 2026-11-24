import React, { useEffect, useRef } from 'react';
import {
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Flame,
  Heart,
  Magnet,
  Pause,
  Shield,
  Siren,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { ControlScheme, LiveHudSnapshot } from '../game/types';

interface GameplayHudProps {
  hud: LiveHudSnapshot;
  controlScheme: ControlScheme;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onMoveLane: (dir: -1 | 1) => void;
  onNitroChange: (active: boolean) => void;
  onBrakeChange: (active: boolean) => void;
  onTriggerAbility: () => void;
}

export const GameplayHud: React.FC<GameplayHudProps> = ({
  hud,
  controlScheme,
  muted,
  onToggleMute,
  onPause,
  onMoveLane,
  onNitroChange,
  onBrakeChange,
  onTriggerAbility,
}) => {
  const touchStartRef = useRef<{ x: number; y: number; handled: boolean } | null>(null);
  const swipeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (swipeTimerRef.current !== null) {
        window.clearTimeout(swipeTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (controlScheme === 'buttons') return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, handled: false };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (controlScheme === 'buttons' || !touchStartRef.current || touchStartRef.current.handled) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;

    if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy)) {
      touchStartRef.current.handled = true;
      onMoveLane(dx > 0 ? 1 : -1);
    } else if (Math.abs(dy) > 32 && Math.abs(dy) > Math.abs(dx)) {
      touchStartRef.current.handled = true;
      if (swipeTimerRef.current !== null) {
        window.clearTimeout(swipeTimerRef.current);
      }
      if (dy < 0) {
        onNitroChange(true);
        swipeTimerRef.current = window.setTimeout(() => {
          swipeTimerRef.current = null;
          onNitroChange(false);
        }, 900);
      } else {
        onBrakeChange(true);
        swipeTimerRef.current = window.setTimeout(() => {
          swipeTimerRef.current = null;
          onBrakeChange(false);
        }, 650);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  const healthPct = Math.max(0, Math.min(100, Math.round((hud.health / hud.maxHealth) * 100)));
  const healthBarColor =
    hud.healthStage === 'normal'
      ? 'bg-emerald-500'
      : hud.healthStage === 'minor'
        ? 'bg-amber-400'
        : hud.healthStage === 'warning'
          ? 'bg-orange-500'
          : 'bg-rose-500';

  const showTouchButtons = controlScheme === 'buttons' || controlScheme === 'hybrid';

  const tutorialHint =
    hud.tutorialStep === 0
      ? 'TUTORIAL 1/3 · Swipe Left/Right (or A / D) to change lanes'
      : hud.tutorialStep === 1
        ? 'TUTORIAL 2/3 · Tap NITRO (or Space) for a boost'
        : hud.tutorialStep === 2
          ? 'TUTORIAL 3/3 · Pass close to oncoming traffic for a Near Miss'
          : null;

  return (
    <div
      className="fixed inset-0 z-20 select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {hud.damageFlash > 0.01 && (
        <div
          className="pointer-events-none fixed inset-0 border-[10px] border-rose-500/80 bg-rose-600/20 transition-opacity duration-75"
          style={{ opacity: Math.min(1, hud.damageFlash) }}
        />
      )}
      {hud.lowHealthWarning && (
        <div className="pointer-events-none fixed inset-0 border-4 border-rose-500/55 shadow-[inset_0_0_70px_rgba(244,63,94,0.35)]" />
      )}

      {/* Top HUD Bar */}
      <div className="pointer-events-none flex items-start justify-between gap-2 p-2.5 sm:p-4">
        {/* Top-Left: Hull Integrity, Active Power-ups & Side Event Feed (Wrong Way, Near Miss, Crash, Combos) */}
        <div className="flex flex-col gap-1.5 min-w-[160px] sm:min-w-[220px] max-w-[260px]">
          <div className="rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-200 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Heart
                  className={`w-3.5 h-3.5 ${
                    hud.healthStage === 'critical'
                      ? 'text-rose-400'
                      : hud.healthStage === 'warning'
                        ? 'text-orange-400'
                        : 'text-emerald-400'
                  }`}
                />
                <span>Hull Integrity</span>
              </span>
              <span className="font-mono-num font-bold text-white">{healthPct}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-sm bg-slate-800">
              <div
                className={`h-full transition-all duration-150 ${healthBarColor}`}
                style={{ width: `${healthPct}%` }}
              />
            </div>
            {hud.healthStage === 'warning' && (
              <div className="mt-1 text-[10px] font-semibold text-orange-400">
                ENGINE WARNING · SEEK REPAIR
              </div>
            )}
            {hud.healthStage === 'critical' && (
              <div className="mt-1 text-[10px] font-bold text-rose-400">
                CRITICAL HULL · LIGHTS FAILING
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {hud.activePowerUps.shieldRemaining > 0 && (
              <div className="flex items-center gap-1.5 rounded bg-[#090d16]/90 border border-cyan-400/40 px-2 py-0.5 text-xs font-mono-num text-cyan-300">
                <Shield className="w-3.5 h-3.5" />
                <span>{hud.activePowerUps.shieldRemaining.toFixed(1)}s</span>
              </div>
            )}
            {hud.activePowerUps.magnetRemaining > 0 && (
              <div className="flex items-center gap-1.5 rounded bg-[#090d16]/90 border border-amber-400/40 px-2 py-0.5 text-xs font-mono-num text-amber-300">
                <Magnet className="w-3.5 h-3.5" />
                <span>{hud.activePowerUps.magnetRemaining.toFixed(1)}s</span>
              </div>
            )}
            {hud.activePowerUps.slowMoRemaining > 0 && (
              <div className="flex items-center gap-1.5 rounded bg-[#090d16]/90 border border-purple-400/40 px-2 py-0.5 text-xs font-mono-num text-purple-300">
                <Clock className="w-3.5 h-3.5" />
                <span>{hud.activePowerUps.slowMoRemaining.toFixed(1)}s</span>
              </div>
            )}
          </div>

          {/* Side Event & Alert Feed (Combos, Notifications, Boss Warnings, Tutorial Hints) */}
          <div className="flex flex-col items-start gap-1 mt-1">
            {hud.boss.active && (
              <div className="rounded-lg bg-rose-950/90 border border-rose-400/60 px-3 py-1.5 w-full">
                <div className="flex items-center justify-between gap-2 text-[11px] font-display font-bold text-rose-200">
                  <span className="flex items-center gap-1">
                    <Siren className="w-3.5 h-3.5 text-rose-400" />
                    <span>{hud.boss.bossName.toUpperCase()}</span>
                  </span>
                  <span className="font-mono-num text-amber-300">{hud.boss.remainingSec}s</span>
                </div>
                <div className="mt-1 h-1 w-full rounded-full bg-rose-900 overflow-hidden">
                  <div
                    className="h-full bg-rose-400 transition-all duration-150"
                    style={{
                      width: `${Math.round((hud.boss.remainingSec / hud.boss.totalSec) * 100)}%`,
                    }}
                  />
                </div>
                {hud.boss.warningText && (
                  <div className="mt-0.5 text-[10px] font-bold text-amber-300">
                    {hud.boss.warningText}
                  </div>
                )}
              </div>
            )}

            {tutorialHint && (
              <div className="rounded-lg bg-cyan-950/90 border border-cyan-400/60 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                {tutorialHint}
              </div>
            )}

            {hud.comboCount > 0 && (
              <div className="rounded bg-amber-500/95 px-2.5 py-1 text-slate-950 font-display font-bold text-xs tracking-wide shadow flex items-center gap-2">
                <span>NEAR MISS x{hud.comboCount}</span>
                <div className="h-1 w-10 bg-slate-950/25 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-950"
                    style={{ width: `${Math.round(hud.comboTimerRatio * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {hud.notifications.slice(-1).map((n) => {
              const toneCls =
                n.tone === 'emerald'
                  ? 'border-emerald-400/50 bg-emerald-950/85 text-emerald-300'
                  : n.tone === 'cyan'
                    ? 'border-cyan-400/50 bg-cyan-950/85 text-cyan-300'
                    : n.tone === 'rose'
                      ? 'border-rose-400/50 bg-rose-950/85 text-rose-300'
                      : 'border-amber-400/50 bg-amber-950/85 text-amber-300';
              return (
                <div
                  key={n.id}
                  className={`rounded-md border px-2.5 py-1 text-[11px] sm:text-xs font-semibold tracking-wide shadow-md ${toneCls}`}
                >
                  {n.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top-Center: Distance & Time Only (Compact to Keep Road Vision Clear) */}
        <div className="flex flex-col items-center text-center">
          <div className="rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-1.5 sm:px-5">
            <div className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white tabular-nums">
              {hud.distanceM.toLocaleString()}
              <span className="ml-1 text-xs sm:text-sm font-semibold text-amber-400">m</span>
            </div>
            <div className="text-[10px] font-medium text-slate-400">{hud.worldLabel}</div>
            {hud.timeRemainingSec !== null && (
              <div
                className={`font-mono-num text-xs font-bold ${
                  hud.timeRemainingSec <= 10 ? 'text-rose-400' : 'text-cyan-300'
                }`}
              >
                {hud.timeRemainingSec}s REMAINING
              </div>
            )}
            {hud.modeProgressLabel && (
              <div className="text-[10px] font-medium text-slate-300 whitespace-nowrap">
                {hud.modeProgressLabel}
              </div>
            )}
          </div>
        </div>

        {/* Top-Right: Coins & Audio/Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-[#090d16]/90 border border-white/12 px-3 py-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono-num text-sm sm:text-base font-bold text-amber-300">
              {hud.runCoins.toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#090d16]/90 border border-white/12 text-slate-200 hover:border-amber-400/60 hover:text-white transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause game"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#090d16]/90 border border-white/12 text-slate-200 hover:border-amber-400/60 hover:text-white transition-colors"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom HUD Cluster */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex items-end justify-between gap-2 sm:gap-4 p-2.5 sm:p-5">
        <div className="flex items-end gap-2 sm:gap-3">
          {showTouchButtons && (
            <button
              type="button"
              onClick={() => onMoveLane(-1)}
              aria-label="Steer Left"
              className="pointer-events-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-[#090d16]/85 border border-white/20 text-white active:bg-amber-500 active:text-slate-950 touch-none"
            >
              <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          )}
          <div className="rounded-lg bg-[#090d16]/90 border border-white/12 px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 min-w-[130px] sm:min-w-[165px]">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-2xl sm:text-4xl font-bold text-white tabular-nums leading-none">
                {hud.speedKmh}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400">km/h</span>
            </div>
            <div className="mt-1 sm:mt-2 flex items-center justify-between text-[10px] sm:text-[11px] font-medium text-cyan-300">
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                <span>NITRO</span>
              </span>
              <span className="font-mono-num">{Math.round(hud.nitroRatio * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 sm:h-2 w-full rounded-sm bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  hud.nitroActive ? 'bg-cyan-300' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.round(hud.nitroRatio * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center gap-1">
          <div className="rounded bg-[#090d16]/80 border border-white/10 px-3 py-1 text-xs text-slate-300">
            Swipe / A-D: Steer · Space: Nitro · E: Car Ability · S: Brake · Esc: Pause
          </div>
          {hud.ability.mode === 'passive' && (
            <div className="flex items-center gap-1.5 rounded bg-[#090d16]/85 border border-cyan-400/35 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
              <Sparkles className="w-3 h-3" />
              <span>PASSIVE: {hud.ability.name}</span>
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-end gap-1.5 sm:gap-2">
          {hud.ability.mode === 'active' && (
            <button
              type="button"
              onClick={onTriggerAbility}
              disabled={!hud.ability.ready && hud.ability.activeRemaining <= 0}
              className={`flex h-11 sm:h-12 px-2.5 sm:px-3.5 items-center gap-1 sm:gap-1.5 rounded-lg border text-xs font-display font-bold transition-colors touch-none ${
                hud.ability.activeRemaining > 0
                  ? 'bg-purple-500 border-purple-300 text-white shadow-lg'
                  : hud.ability.ready
                    ? 'bg-amber-500 border-amber-300 text-slate-950 hover:bg-amber-400 cursor-pointer'
                    : 'bg-[#090d16]/90 border-white/15 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>
                {hud.ability.activeRemaining > 0
                  ? `${hud.ability.activeRemaining.toFixed(1)}s`
                  : hud.ability.ready
                    ? hud.ability.name.toUpperCase()
                    : `${Math.ceil(hud.ability.cooldownRemaining)}s`}
              </span>
            </button>
          )}
          <button
            type="button"
            onPointerDown={() => onBrakeChange(true)}
            onPointerUp={() => onBrakeChange(false)}
            onPointerLeave={() => onBrakeChange(false)}
            onPointerCancel={() => onBrakeChange(false)}
            onTouchStart={(e) => { e.preventDefault(); onBrakeChange(true); }}
            onTouchEnd={(e) => { e.preventDefault(); onBrakeChange(false); }}
            onTouchCancel={(e) => { e.preventDefault(); onBrakeChange(false); }}
            className={`flex h-11 sm:h-12 px-2.5 sm:px-3.5 items-center gap-1 sm:gap-1.5 rounded-lg border text-xs font-semibold transition-colors touch-none ${
              hud.braking
                ? 'bg-rose-500 border-rose-400 text-white'
                : 'bg-[#090d16]/90 border-white/15 text-slate-200 hover:border-rose-400/60'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>BRAKE</span>
          </button>
          <button
            type="button"
            onPointerDown={() => onNitroChange(true)}
            onPointerUp={() => onNitroChange(false)}
            onPointerLeave={() => onNitroChange(false)}
            onPointerCancel={() => onNitroChange(false)}
            onTouchStart={(e) => { e.preventDefault(); onNitroChange(true); }}
            onTouchEnd={(e) => { e.preventDefault(); onNitroChange(false); }}
            onTouchCancel={(e) => { e.preventDefault(); onNitroChange(false); }}
            className={`flex h-11 sm:h-12 px-3 sm:px-4 items-center gap-1 sm:gap-1.5 rounded-lg border text-xs font-semibold transition-colors touch-none ${
              hud.nitroActive
                ? 'bg-cyan-400 border-cyan-300 text-slate-950'
                : 'bg-[#090d16]/90 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/20'
            }`}
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>NITRO</span>
          </button>
          {showTouchButtons && (
            <button
              type="button"
              onClick={() => onMoveLane(1)}
              aria-label="Steer Right"
              className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-[#090d16]/85 border border-white/20 text-white active:bg-amber-500 active:text-slate-950 touch-none"
            >
              <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
