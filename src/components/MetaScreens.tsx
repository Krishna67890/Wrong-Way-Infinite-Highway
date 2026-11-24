import React, { useState } from 'react';
import {
  ArrowLeft,
  Award,
  Check,
  Coins,
  Flag,
  Lock,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  Siren,
  Target,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  BOSSES,
  GAME_MODES,
  getCarById,
  getModeById,
  getWorldById,
  WORLDS,
  xpRequiredForLevel,
} from '../game/data';
import { getAchievementProgress } from '../game/storage';
import {
  AchievementCategory,
  AchievementTier,
  BossType,
  CameraPreset,
  ControlScheme,
  GameModeId,
  GameSettings,
  GraphicsQuality,
  PlayerProgress,
  RunSummary,
  WorldId,
} from '../game/types';

/* ---------------- WORLD SELECTION SCREEN ---------------- */
interface WorldsScreenProps {
  progress: PlayerProgress;
  onSelectWorld: (id: WorldId) => void;
  onUnlockWorld: (id: WorldId) => void;
  onDriveNow: () => void;
  onBack: () => void;
}

export const WorldsScreen: React.FC<WorldsScreenProps> = ({
  progress,
  onSelectWorld,
  onUnlockWorld,
  onDriveNow,
  onBack,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl bg-[#090d16]/92 border border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Highway Environments</h2>
            <p className="text-xs text-slate-400">Select an unlocked biome for live 3D preview</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-white/10 px-3 py-1.5 font-mono-num text-sm font-bold text-amber-300">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{progress.coins.toLocaleString()}</span>
          </div>
          <button
            type="button"
            onClick={onDriveNow}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-display font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>DRIVE</span>
          </button>
        </div>
      </div>

      <div className="pointer-events-auto mx-auto w-full max-w-5xl rounded-xl bg-[#090d16]/94 border border-white/12 p-3.5 sm:p-4 max-h-[calc(100dvh-4.5rem)] overflow-y-auto custom-scroll">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {WORLDS.map((w) => {
            const unlocked = progress.unlockedWorlds.includes(w.id);
            const selected = progress.selectedWorld === w.id;
            const canAfford = progress.coins >= w.unlockCost;
            return (
              <div
                key={w.id}
                className={`flex flex-col justify-between rounded-lg border p-3.5 transition-colors ${
                  selected
                    ? 'bg-slate-800/90 border-amber-400'
                    : 'bg-slate-900/85 border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-display font-bold text-sm text-white">{w.name}</span>
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: w.accentGlow }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 leading-snug mb-2">{w.subtitle}</p>
                  <div className="text-[11px] text-slate-300 mb-3">
                    {w.weather.toUpperCase()} · {w.coinMultiplier}x Coins
                  </div>
                </div>

                {unlocked ? (
                  <button
                    type="button"
                    onClick={() => onSelectWorld(w.id)}
                    className={`w-full rounded-md py-2 text-xs font-display font-bold tracking-wide cursor-pointer ${
                      selected
                        ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {selected ? 'SELECTED' : 'SELECT WORLD'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onUnlockWorld(w.id)}
                    className={`w-full flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-display font-bold ${
                      canAfford
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{w.unlockCost.toLocaleString()}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------------- GAME MODES SCREEN ---------------- */
interface ModesScreenProps {
  selectedMode: GameModeId;
  onSelectMode: (id: GameModeId) => void;
  onDriveNow: () => void;
  onBack: () => void;
}

export const ModesScreen: React.FC<ModesScreenProps> = ({
  selectedMode,
  onSelectMode,
  onDriveNow,
  onBack,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-black/55">
      <div className="w-full max-w-4xl rounded-xl bg-[#090d16]/96 border border-white/12 p-5 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h2 className="font-display text-xl font-bold text-white">Select Game Mode</h2>
          </div>
          <button
            type="button"
            onClick={onDriveNow}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2 text-xs font-display font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>START RUN</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {GAME_MODES.map((m) => {
            const active = selectedMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMode(m.id)}
                className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-800/90 border-amber-400'
                    : 'bg-slate-900/80 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-display text-base font-bold text-white">{m.name}</span>
                  <Flag className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-slate-500'}`} />
                </div>
                <div className="text-xs font-semibold text-cyan-300 mb-2">{m.subtitle}</div>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">{m.rules}</p>
                <div className="text-[11px] font-mono-num text-amber-300">
                  {m.coinMultiplier}x Coins · {m.xpMultiplier}x XP
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------------- BOSS EVENTS SCREEN ---------------- */
interface EventsScreenProps {
  selectedBoss: BossType;
  totalEscapes: number;
  onSelectBoss: (boss: BossType) => void;
  onLaunchBossChase: () => void;
  onBack: () => void;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  selectedBoss,
  totalEscapes,
  onSelectBoss,
  onLaunchBossChase,
  onBack,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-black/60">
      <div className="w-full max-w-4xl rounded-xl bg-[#090d16]/96 border border-white/12 p-5 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scroll">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h2 className="font-display text-xl font-bold text-white">Boss Chase Events</h2>
              <p className="text-xs text-slate-400">
                Survive a 60-second pursuit against highway interceptors · {totalEscapes} Escaped
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLaunchBossChase}
            className="flex items-center gap-2 rounded-lg bg-rose-500 px-5 py-2.5 text-xs font-display font-bold text-white hover:bg-rose-400 cursor-pointer"
          >
            <Siren className="w-4 h-4" />
            <span>LAUNCH BOSS ESCAPE</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {BOSSES.map((b) => {
            const active = selectedBoss === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelectBoss(b.id)}
                className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-800/90 border-rose-400'
                    : 'bg-slate-900/80 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-display text-lg font-bold text-white">{b.name}</span>
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-white/30"
                    style={{ backgroundColor: b.accent }}
                  />
                </div>
                <div className="text-xs font-semibold text-rose-300 mb-2">{b.subtitle}</div>
                <p className="text-xs text-slate-300 mb-3">
                  Swerves across lanes to intercept your wrong-way run. Dodge traffic, burn nitro, and hold out for 60 seconds.
                </p>
                <div className="font-mono-num text-xs font-bold text-amber-300">
                  Bounty: +{b.rewardCoins.toLocaleString()} Coins · +450 XP
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------------- LEADERBOARD & RECORDS SCREEN ---------------- */
interface LeaderboardScreenProps {
  progress: PlayerProgress;
  onBack: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  progress,
  onBack,
}) => {
  const [sharedMsg, setSharedMsg] = useState<string | null>(null);

  const handleShare = async () => {
    const text = `HIGHWAY HAVOC: WRONG WAY — Personal Best: ${progress.bestDistance.toLocaleString()}m | High Score: ${progress.highScore.toLocaleString()} | Max Combo: x${progress.bestCombo}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'HIGHWAY HAVOC: WRONG WAY', text });
        setSharedMsg('Shared!');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setSharedMsg('Record copied to clipboard');
      }
    } catch {
      setSharedMsg('Ready to share');
    }
    window.setTimeout(() => setSharedMsg(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-black/60">
      <div className="w-full max-w-4xl rounded-xl bg-[#090d16]/96 border border-white/12 p-5 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scroll">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h2 className="font-display text-xl font-bold text-white">Records &amp; Leaderboard</h2>
              <p className="text-xs text-slate-400">
                Local career records saved on this device (Global online board requires cloud backend)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-display font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{sharedMsg ?? 'SHARE RECORD'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3.5">
            <div className="text-xs text-slate-400">Best Distance</div>
            <div className="font-display text-2xl font-bold text-amber-300 tabular-nums">
              {progress.bestDistance.toLocaleString()}m
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3.5">
            <div className="text-xs text-slate-400">Best Score</div>
            <div className="font-display text-2xl font-bold text-white tabular-nums">
              {progress.highScore.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3.5">
            <div className="text-xs text-slate-400">Best Near-Miss Combo</div>
            <div className="font-display text-2xl font-bold text-cyan-300 tabular-nums">
              x{progress.bestCombo}
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3.5">
            <div className="text-xs text-slate-400">Most Coins (1 Run)</div>
            <div className="font-display text-2xl font-bold text-emerald-300 tabular-nums">
              {progress.mostCoinsRun.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="flex items-center gap-2 font-display text-sm font-bold text-white">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Personal Top 10 Runs</span>
            </span>
            <span className="text-xs text-slate-400">Total Runs: {progress.totalRuns}</span>
          </div>

          {progress.runHistory.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              Complete your first run to record a personal leaderboard entry.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {progress.runHistory.map((r, idx) => {
                const car = getCarById(r.carId);
                const world = getWorldById(r.worldId);
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono-num text-xs font-bold text-amber-400 w-6">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-white">{car.name}</div>
                        <div className="text-xs text-slate-400">
                          {world.name} · Max x{r.maxCombo} Combo
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 font-mono-num text-xs">
                      <span className="text-white font-bold">{r.distance.toLocaleString()}m</span>
                      <span className="text-cyan-300">{r.score.toLocaleString()} pts</span>
                      <span className="text-amber-300">+{r.coins.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------------- MISSIONS SCREEN ---------------- */
interface MissionsScreenProps {
  progress: PlayerProgress;
  onClaimMission: (id: string) => void;
  onClaimEndlessMission: (id: string) => void;
  onBack: () => void;
}

function getNextDailyResetLabel(): string {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const diffMs = Math.max(0, tomorrow.getTime() - now.getTime());
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

export const MissionsScreen: React.FC<MissionsScreenProps> = ({
  progress,
  onClaimMission,
  onClaimEndlessMission,
  onBack,
}) => {
  const resetCountdown = getNextDailyResetLabel();

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-black/55">
      <div className="w-full max-w-4xl rounded-xl bg-[#090d16]/96 border border-white/12 p-5 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scroll">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Daily &amp; Unlimited Missions
              </h2>
              <p className="text-xs text-slate-400">
                Daily Date: {progress.dailyDateKey} (Next Day Reset in {resetCountdown}) · Completed: {progress.totalMissionsCompleted} · Car Parts: {progress.carParts}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-mono-num text-sm font-bold text-amber-300">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{progress.coins.toLocaleString()}</span>
          </div>
        </div>

        {/* Unlimited Never-Stop Endless Contracts */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-cyan-300">
              Unlimited Endless Contracts · Never Stop Progression
            </h3>
            <span className="text-[11px] font-mono-num text-slate-400">
              Auto-replaces on claim (#{progress.endlessMissionCounter} Active)
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {progress.endlessMissions.map((m) => {
              const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
              const ready = m.progress >= m.target;
              return (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-slate-900/95 border border-cyan-500/25 p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-display font-bold text-base text-white">{m.title}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{m.description}</p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-cyan-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono-num text-xs text-slate-300">
                        {m.progress.toLocaleString()} / {m.target.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <div className="text-xs font-mono-num text-amber-300">
                      +{m.rewardCoins.toLocaleString()} Coins · +{m.rewardXp} XP · +{m.rewardParts} Parts
                    </div>
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => onClaimEndlessMission(m.id)}
                      className={`rounded-md px-4 py-1.5 text-xs font-display font-bold ${
                        ready
                          ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {ready ? 'CLAIM & NEXT TIER' : 'IN PROGRESS'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Missions (Auto-refresh every new calendar day) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-amber-300">
              Daily Missions · Refreshes Every New Day
            </h3>
            <span className="text-[11px] font-mono-num text-slate-400">
              New set in {resetCountdown}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {progress.dailyMissions.map((m) => {
              const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
              const ready = !m.claimed && m.progress >= m.target;
              return (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-slate-900/90 border border-white/10 p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="font-display font-bold text-base text-white">{m.title}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{m.description}</p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono-num text-xs text-slate-300">
                        {m.progress.toLocaleString()} / {m.target.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <div className="text-xs font-mono-num text-amber-300">
                      +{m.rewardCoins} Coins · +{m.rewardXp} XP · +{m.rewardParts} Parts
                    </div>
                    {m.claimed ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 text-xs font-bold text-emerald-300">
                        <Check className="w-3.5 h-3.5" />
                        <span>CLAIMED</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() => onClaimMission(m.id)}
                        className={`rounded-md px-4 py-1.5 text-xs font-display font-bold ${
                          ready
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {ready ? 'CLAIM REWARD' : 'IN PROGRESS'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- ACHIEVEMENTS SCREEN ---------------- */
interface AchievementsScreenProps {
  progress: PlayerProgress;
  onClaimAchievement: (id: string) => void;
  onBack: () => void;
}

const TIER_STYLES: Record<AchievementTier, string> = {
  Bronze: 'bg-orange-950/70 text-orange-300 border-orange-500/40',
  Silver: 'bg-slate-700/70 text-slate-200 border-slate-400/45',
  Gold: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
  Platinum: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50',
  Mythic: 'bg-purple-500/25 text-purple-200 border-purple-400/60',
};

const ACH_CATEGORIES: ('All' | AchievementCategory)[] = [
  'All',
  'Survival',
  'Speed',
  'Combat',
  'Garage',
  'Mastery',
];

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({
  progress,
  onClaimAchievement,
  onBack,
}) => {
  const [catFilter, setCatFilter] = useState<'All' | AchievementCategory>('All');
  const filtered =
    catFilter === 'All'
      ? ACHIEVEMENTS
      : ACHIEVEMENTS.filter((a) => a.category === catFilter);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-black/55">
      <div className="w-full max-w-4xl rounded-xl bg-[#090d16]/96 border border-white/12 p-5 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scroll">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h2 className="font-display text-xl font-bold text-white">Advanced Achievements</h2>
              <p className="text-xs text-slate-400">
                {progress.claimedAchievements.length} / {ACHIEVEMENTS.length} Claimed across 5 Ranks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-mono-num text-sm font-bold text-amber-300">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{progress.coins.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {ACH_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCatFilter(c)}
              className={`rounded-md px-3 py-1 text-xs font-semibold cursor-pointer ${
                catFilter === c
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-900 border border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((ach) => {
            const cur = getAchievementProgress(progress, ach);
            const pct = Math.min(100, Math.round((cur / ach.target) * 100));
            const claimed = progress.claimedAchievements.includes(ach.id);
            const ready = !claimed && cur >= ach.target;
            return (
              <div
                key={ach.id}
                className="flex flex-col justify-between gap-3 rounded-xl bg-slate-900/90 border border-white/10 p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-display font-bold text-sm text-white">
                      <Award className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>{ach.title}</span>
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-display font-bold uppercase ${TIER_STYLES[ach.tier]}`}
                    >
                      {ach.tier}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-num text-amber-300 mt-1">
                    {ach.rewardLabel}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{ach.description}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-300 mb-1">
                    <span>{ach.category}</span>
                    <span>
                      {Math.min(cur, ach.target).toLocaleString()} / {ach.target.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mb-3">
                    <div className="h-full bg-purple-400" style={{ width: `${pct}%` }} />
                  </div>

                  {claimed ? (
                    <div className="text-center rounded-md bg-emerald-500/20 border border-emerald-400/30 py-1.5 text-xs font-bold text-emerald-300">
                      CLAIMED
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => onClaimAchievement(ach.id)}
                      className={`w-full rounded-md py-1.5 text-xs font-display font-bold ${
                        ready
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {ready ? 'CLAIM REWARD' : 'LOCKED'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------------- SETTINGS SCREEN ---------------- */
interface SettingsScreenProps {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
  onReplayTutorial: () => void;
  onResetAll: () => void;
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onChange,
  onReplayTutorial,
  onResetAll,
  onBack,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-black/65">
      <div className="w-full max-w-xl rounded-xl bg-[#090d16]/96 border border-white/12 p-5 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scroll">
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h2 className="font-display text-xl font-bold text-white">Game Settings</h2>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-slate-900/80 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Audio &amp; Vibration</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ vibration: !settings.vibration })}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold cursor-pointer ${
                    settings.vibration
                      ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {settings.vibration ? 'HAPTICS ON' : 'HAPTICS OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ muted: !settings.muted })}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold cursor-pointer ${
                    settings.muted
                      ? 'bg-rose-500/20 border border-rose-400/40 text-rose-300'
                      : 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                  }`}
                >
                  {settings.muted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span>{settings.muted ? 'MUTED' : 'ACTIVE'}</span>
                </button>
              </div>
            </div>

            <label className="block text-xs text-slate-300">
              <div className="flex justify-between mb-1">
                <span>Master Volume</span>
                <span className="font-mono-num">{Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) => onChange({ masterVolume: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </label>

            <label className="block text-xs text-slate-300">
              <div className="flex justify-between mb-1">
                <span>Engine &amp; SFX Volume</span>
                <span className="font-mono-num">{Math.round(settings.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => onChange({ sfxVolume: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </label>

            <label className="block text-xs text-slate-300">
              <div className="flex justify-between mb-1">
                <span>Synth Music Volume</span>
                <span className="font-mono-num">{Math.round(settings.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) => onChange({ musicVolume: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </label>
          </div>

          <div className="rounded-lg bg-slate-900/80 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Tilt Steering (Accelerometer)</div>
                <div className="text-xs text-slate-400">Steer by tilting Android phone left/right</div>
              </div>
              <button
                type="button"
                onClick={() => onChange({ tiltSteering: !settings.tiltSteering })}
                className={`rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  settings.tiltSteering
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {settings.tiltSteering ? 'ENABLED' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/80 border border-white/10 p-4">
            <div className="text-sm font-semibold text-white mb-2.5">Graphics Quality (Android FPS)</div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onChange({ graphics: q })}
                  className={`rounded-md py-2 text-xs font-display font-bold uppercase cursor-pointer ${
                    settings.graphics === q
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/80 border border-white/10 p-4 space-y-4">
            <div>
              <div className="text-sm font-semibold text-white mb-2">Camera Perspective</div>
              <div className="grid grid-cols-3 gap-2">
                {(['chase', 'low', 'high'] as CameraPreset[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange({ cameraPreset: c })}
                    className={`rounded-md py-2 text-xs font-display font-bold uppercase cursor-pointer ${
                      settings.cameraPreset === c
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-white mb-2">Touch Control Mode</div>
              <div className="grid grid-cols-3 gap-2">
                {(['hybrid', 'swipe', 'buttons'] as ControlScheme[]).map((cs) => (
                  <button
                    key={cs}
                    type="button"
                    onClick={() => onChange({ controlScheme: cs })}
                    className={`rounded-md py-2 text-xs font-display font-bold uppercase cursor-pointer ${
                      settings.controlScheme === cs
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cs}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/80 border border-white/10 p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Playable Tutorial</div>
              <div className="text-xs text-slate-400">Show interactive lane &amp; nitro prompts on next run</div>
            </div>
            <button
              type="button"
              onClick={onReplayTutorial}
              className="rounded-md bg-slate-800 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"
            >
              Reset Tutorial
            </button>
          </div>

          <div className="rounded-lg bg-slate-900/80 border border-rose-500/25 p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Reset Career Save</div>
              <div className="text-xs text-slate-400">Clears coins, unlocked cars, upgrades, and best records</div>
            </div>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="rounded-md bg-rose-500/20 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/30 cursor-pointer"
              >
                Reset
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetAll();
                    setConfirmReset(false);
                  }}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- PAUSE MODAL ---------------- */
interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onGarage: () => void;
  onHome: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onSettings,
  onGarage,
  onHome,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65">
      <div className="w-full max-w-sm rounded-xl bg-[#090d16]/96 border border-white/15 p-6 text-center">
        <h2 className="font-display text-2xl font-bold text-white mb-1">RUN PAUSED</h2>
        <p className="text-xs text-slate-400 mb-6">Wrong-way traffic frozen</p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-lg bg-amber-500 py-3 font-display font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            RESUME
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-lg bg-slate-800 border border-white/10 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer"
          >
            Restart Run
          </button>
          <button
            type="button"
            onClick={onSettings}
            className="w-full rounded-lg bg-slate-800 border border-white/10 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onGarage}
            className="w-full rounded-lg bg-slate-800 border border-white/10 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer"
          >
            Garage
          </button>
          <button
            type="button"
            onClick={onHome}
            className="w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- GAME OVER MODAL ---------------- */
interface GameOverModalProps {
  summary: RunSummary;
  progress: PlayerProgress;
  canRevive: boolean;
  bonusClaimed: boolean;
  nativeAdsReady: boolean;
  adLoading: boolean;
  onClaimOptionalBonus: () => void;
  onWatchAdRevive: () => void;
  onRevive: () => void;
  onRetry: () => void;
  onGarage: () => void;
  onHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  progress,
  canRevive,
  bonusClaimed,
  nativeAdsReady,
  adLoading,
  onClaimOptionalBonus,
  onWatchAdRevive,
  onRevive,
  onRetry,
  onGarage,
  onHome,
}) => {
  const car = getCarById(summary.carId);
  const world = getWorldById(summary.worldId);
  const mode = getModeById(summary.modeId);
  const xpNeeded = xpRequiredForLevel(progress.level);
  const xpPct = Math.min(100, Math.round((progress.xp / xpNeeded) * 100));
  const totalRunCoins = summary.coinsEarned + summary.modeBonusCoins;
  const reviveAffordable = progress.reviveTokens > 0 || progress.coins >= 250;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/72">
      <div className="w-full max-w-lg rounded-xl bg-[#090d16]/96 border border-white/15 p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scroll">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-400">
              Wrecked on {world.name}
            </div>
            <h2 className="font-display text-3xl font-bold text-white">RUN COMPLETE</h2>
            <div className="text-xs text-slate-400 mt-0.5">
              {car.name} · {mode.name}
            </div>
          </div>
          {summary.isNewBestDistance && (
            <div className="rounded bg-amber-500 px-3 py-1 font-display text-xs font-bold text-slate-950">
              NEW BEST DISTANCE
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Final Distance</div>
            <div className="font-display text-xl font-bold text-white tabular-nums">
              {summary.distance.toLocaleString()}m
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Best Distance</div>
            <div className="font-display text-xl font-bold text-amber-300 tabular-nums">
              {progress.bestDistance.toLocaleString()}m
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Coins Earned</div>
            <div className="font-display text-xl font-bold text-amber-400 tabular-nums">
              +{totalRunCoins.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Near Misses</div>
            <div className="font-display text-xl font-bold text-cyan-300 tabular-nums">
              {summary.nearMisses} (Max x{summary.maxCombo})
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Peak Speed</div>
            <div className="font-display text-xl font-bold text-white tabular-nums">
              {summary.maxSpeedKmh} km/h
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">XP Gained</div>
            <div className="font-display text-xl font-bold text-emerald-400 tabular-nums">
              +{summary.xpEarned}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-300 mb-1">
            <span>Driver Level {progress.level}</span>
            <span className="font-mono-num">
              {progress.xp} / {xpNeeded} XP
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-400" style={{ width: `${xpPct}%` }} />
          </div>
        </div>

        {/* Rewarded 2x Coin Bonus (AdMob on Android APK, single-claim bonus on web preview) */}
        {totalRunCoins > 0 && !bonusClaimed && (
          <button
            type="button"
            disabled={adLoading}
            onClick={onClaimOptionalBonus}
            className="w-full mb-2.5 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 py-2.5 font-display font-bold text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60 cursor-pointer"
          >
            <Coins className="w-4 h-4" />
            <span>
              {adLoading
                ? 'LOADING AD...'
                : nativeAdsReady
                  ? `WATCH AD · 2X COINS (+${totalRunCoins.toLocaleString()})`
                  : `OPTIONAL BONUS · CLAIM +${totalRunCoins.toLocaleString()} EXTRA COINS`}
            </span>
          </button>
        )}

        {canRevive && (
          <div className="flex flex-col gap-2 mb-3">
            <button
              type="button"
              disabled={adLoading}
              onClick={onWatchAdRevive}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-500 py-2.5 font-display font-bold text-sm text-white hover:bg-purple-400 disabled:opacity-60 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{adLoading ? 'LOADING AD...' : 'WATCH AD · FREE REVIVE'}</span>
            </button>
            <button
              type="button"
              disabled={!reviveAffordable || adLoading}
              onClick={onRevive}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 font-display font-bold text-sm transition-colors ${
                reviveAffordable
                  ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {progress.reviveTokens > 0
                  ? `REVIVE NOW (USE 1 TOKEN · ${progress.reviveTokens} LEFT)`
                  : 'REVIVE NOW (250 COINS)'}
              </span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={adLoading}
            onClick={onRetry}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-3 font-display font-bold text-sm text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RETRY</span>
          </button>
          <button
            type="button"
            disabled={adLoading}
            onClick={onGarage}
            className="rounded-lg bg-slate-800 border border-white/10 py-3 text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer"
          >
            Garage
          </button>
          <button
            type="button"
            disabled={adLoading}
            onClick={onHome}
            className="rounded-lg bg-slate-800 border border-white/10 py-3 text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer"
          >
            Menu
          </button>
        </div>
      </div>
    </div>
  );
};
