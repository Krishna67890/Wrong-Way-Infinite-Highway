import React, { useState } from 'react';
import {
  ArrowLeft,
  Car as CarIcon,
  Check,
  Coins,
  Lock,
  Play,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  CARS,
  createEmptyUpgrades,
  getEffectiveCarStats,
  getUpgradeCost,
  UPGRADE_LABELS,
  UPGRADE_MAX_LEVEL,
} from '../game/data';
import {
  CarCategory,
  CarId,
  DecalStyle,
  PlayerProgress,
  UpgradeStatKey,
} from '../game/types';
import { CLASS_BADGE_STYLES } from './TitleAndMenu';

interface GarageScreenProps {
  initialTab: 'garage' | 'upgrades';
  progress: PlayerProgress;
  previewCarId: CarId;
  adLoading: boolean;
  onWatchAdCoins: () => void;
  onSelectPreviewCar: (carId: CarId) => void;
  onUnlockCar: (carId: CarId) => void;
  onEquipCar: (carId: CarId) => void;
  onChangeColor: (carId: CarId, color: string) => void;
  onChangeDecal: (carId: CarId, decal: DecalStyle) => void;
  onUpgradeStat: (carId: CarId, stat: UpgradeStatKey) => void;
  onDriveNow: () => void;
  onBack: () => void;
}

const STAT_ORDER: UpgradeStatKey[] = [
  'engine',
  'turbo',
  'tires',
  'handling',
  'brakes',
  'armor',
  'nitro',
  'repair',
];

const CATEGORIES: { id: 'all' | CarCategory; label: string }[] = [
  { id: 'all', label: 'All (16)' },
  { id: 'sports', label: 'Sports' },
  { id: 'supercar', label: 'Supercars' },
  { id: 'hypercar', label: 'Hypercars' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'limousine', label: 'Limousines' },
  { id: 'special', label: 'Special' },
];

const DECALS: { id: DecalStyle; label: string }[] = [
  { id: 'clean', label: 'Clean' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'neon_trim', label: 'Neon' },
  { id: 'carbon_hood', label: 'Carbon' },
];

export const GarageScreen: React.FC<GarageScreenProps> = ({
  initialTab,
  progress,
  previewCarId,
  adLoading,
  onWatchAdCoins,
  onSelectPreviewCar,
  onUnlockCar,
  onEquipCar,
  onChangeColor,
  onChangeDecal,
  onUpgradeStat,
  onDriveNow,
  onBack,
}) => {
  const [tab, setTab] = useState<'garage' | 'upgrades'>(initialTab);
  const [categoryFilter, setCategoryFilter] = useState<'all' | CarCategory>('all');
  const [confirmBuyId, setConfirmBuyId] = useState<CarId | null>(null);

  const filteredCars =
    categoryFilter === 'all'
      ? CARS
      : CARS.filter((c) => c.category === categoryFilter);

  const car = CARS.find((c) => c.id === previewCarId) ?? CARS[0];
  const isUnlocked = progress.unlockedCars.includes(car.id);
  const isEquipped = progress.equippedCar === car.id;
  const activeColor = progress.carColors[car.id] ?? car.defaultColor;
  const activeDecal: DecalStyle = progress.carDecals[car.id] ?? 'clean';
  const upgradeLevels = {
    ...createEmptyUpgrades(),
    ...(progress.carUpgrades[car.id] ?? {}),
  };
  const effective = getEffectiveCarStats(car, upgradeLevels);
  const canAffordCar = progress.coins >= car.price;

  const statRows: { key: UpgradeStatKey; label: string; valueLabel: string; pct: number }[] = [
    {
      key: 'engine',
      label: 'Engine',
      valueLabel: `${effective.topSpeed} km/h`,
      pct: Math.min(100, Math.round((effective.topSpeed / 440) * 100)),
    },
    {
      key: 'turbo',
      label: 'Turbo',
      valueLabel: `${effective.acceleration}`,
      pct: effective.acceleration,
    },
    {
      key: 'tires',
      label: 'Tires',
      valueLabel: `${effective.tireGrip}`,
      pct: effective.tireGrip,
    },
    {
      key: 'handling',
      label: 'Handling',
      valueLabel: `${effective.handling}`,
      pct: effective.handling,
    },
    {
      key: 'brakes',
      label: 'Brakes',
      valueLabel: `${effective.braking}`,
      pct: effective.braking,
    },
    {
      key: 'armor',
      label: 'Armor',
      valueLabel: `${Math.round(effective.damageResistance * 100)}%`,
      pct: Math.round((effective.damageResistance / 0.55) * 100),
    },
    {
      key: 'nitro',
      label: 'Nitro',
      valueLabel: `${effective.nitroCapacity}s`,
      pct: Math.min(100, Math.round((effective.nitroCapacity / 11) * 100)),
    },
    {
      key: 'repair',
      label: 'Repair Eff.',
      valueLabel: `${Math.round(effective.repairEfficiency * 100)}%`,
      pct: Math.min(100, Math.round((effective.repairEfficiency / 1.7) * 100)),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-5 pointer-events-none"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Top Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#090d16]/90 border border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold text-white leading-tight">
                {car.name}
              </span>
              <span
                className={`rounded border px-2 py-0.5 font-display text-[10px] font-bold uppercase ${CLASS_BADGE_STYLES[car.carClass]}`}
              >
                {car.carClass}
              </span>
              <span className="text-xs text-amber-400">· {car.rarity}</span>
            </div>
            <div className="text-xs text-slate-400">
              {car.tierLabel} · Drag car to rotate 360°
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setTab('garage')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'garage'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CarIcon className="w-3.5 h-3.5" />
            <span>Showroom</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('upgrades')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'upgrades'
                ? 'bg-cyan-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Upgrades (Lv.10)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            disabled={adLoading}
            onClick={onWatchAdCoins}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1.5 font-display text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60 cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5 text-emerald-300" />
            <span>{adLoading ? 'LOADING AD...' : 'WATCH AD · +500'}</span>
          </button>
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-white/10 px-3 py-1.5 font-mono-num text-sm font-bold text-amber-300">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{progress.coins.toLocaleString()}</span>
          </div>
          <button
            type="button"
            onClick={onDriveNow}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-display font-bold tracking-wider text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>DRIVE</span>
          </button>
        </div>
      </div>

      {/* Bottom Dock */}
      <div className="pointer-events-auto mx-auto w-full max-w-6xl rounded-xl bg-[#090d16]/94 border border-white/12 p-3 sm:p-4 max-h-[calc(100dvh-4.5rem)] overflow-y-auto custom-scroll">
        {tab === 'garage' ? (
          <div className="flex flex-col gap-2.5">
            {/* Category Filter Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scroll">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Car Selector Grid (Shows all cars clearly in a scrollable grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[38vh] overflow-y-auto custom-scroll p-1 pr-2">
              {filteredCars.map((item) => {
                const unlocked = progress.unlockedCars.includes(item.id);
                const equipped = progress.equippedCar === item.id;
                const selected = item.id === car.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setConfirmBuyId(null);
                      onSelectPreviewCar(item.id);
                    }}
                    className={`rounded-lg border p-2.5 text-left transition-colors cursor-pointer flex flex-col justify-between ${
                      selected
                        ? 'bg-slate-800 border-amber-400 text-white shadow-md'
                        : 'bg-slate-900/85 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className="font-display text-xs sm:text-sm font-bold truncate">
                          {item.name}
                        </span>
                        {!unlocked && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        {equipped && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mb-1.5">
                        {item.tierLabel}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1.5 text-[10px] sm:text-[11px] font-mono-num pt-1 border-t border-white/10">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-display text-[9px] font-bold uppercase ${CLASS_BADGE_STYLES[item.carClass]}`}
                      >
                        {item.carClass}
                      </span>
                      <span className={unlocked ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-bold'}>
                        {unlocked
                          ? equipped
                            ? 'Equipped'
                            : 'Owned'
                          : `${item.price.toLocaleString()}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Unique Car Ability Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/85 border border-white/10 px-3 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-display text-xs font-bold text-white">
                  {car.ability.name}
                </span>
                <span className="text-[11px] text-slate-300 truncate">{car.ability.description}</span>
              </div>
              <span className="font-mono-num text-[10px] font-bold text-amber-300 shrink-0">
                {car.ability.badge}
              </span>
            </div>

            {/* Specs + Paint + Decals + Action Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center pt-2 border-t border-white/10">
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-3 gap-y-1.5">
                {statRows.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300">
                      <span>{s.label}</span>
                      <span className="font-mono-num font-semibold text-white">
                        {s.valueLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 transition-all duration-200"
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">Paint</div>
                    <div className="flex items-center gap-1.5">
                      {car.paletteOptions.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => onChangeColor(car.id, hex)}
                          aria-label={`Select color ${hex}`}
                          className={`h-5 w-5 rounded-full border-2 transition-transform cursor-pointer ${
                            activeColor === hex
                              ? 'border-white scale-110'
                              : 'border-white/25 hover:scale-105'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">Decal</div>
                    <div className="flex items-center gap-1">
                      {DECALS.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => onChangeDecal(car.id, d.id)}
                          className={`rounded px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                            activeDecal === d.id
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {!isUnlocked ? (
                    confirmBuyId === car.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onUnlockCar(car.id);
                            setConfirmBuyId(null);
                          }}
                          className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-display font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                        >
                          CONFIRM ({car.price.toLocaleString()})
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmBuyId(null)}
                          className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAffordCar}
                        onClick={() => setConfirmBuyId(car.id)}
                        className={`rounded-lg px-5 py-2.5 text-xs font-display font-bold tracking-wider transition-colors ${
                          canAffordCar
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                            : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed'
                        }`}
                      >
                        {canAffordCar
                          ? `UNLOCK · ${car.price.toLocaleString()}`
                          : `NEED ${(car.price - progress.coins).toLocaleString()} MORE`}
                      </button>
                    )
                  ) : isEquipped ? (
                    <div className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-5 py-2.5 text-xs font-display font-bold tracking-wider text-emerald-300">
                      EQUIPPED
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEquipCar(car.id)}
                      className="rounded-lg bg-cyan-400 px-5 py-2.5 text-xs font-display font-bold tracking-wider text-slate-950 hover:bg-cyan-300 transition-colors cursor-pointer"
                    >
                      EQUIP CAR
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {!isUnlocked ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3">
                <div className="text-sm text-slate-300">
                  Unlock <span className="font-semibold text-white">{car.name}</span> in the Showroom before installing performance upgrades.
                </div>
                <button
                  type="button"
                  onClick={() => setTab('garage')}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 cursor-pointer"
                >
                  Go to Showroom
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {STAT_ORDER.map((statKey) => {
                  const meta = UPGRADE_LABELS[statKey];
                  const lvl = upgradeLevels[statKey] ?? 0;
                  const maxed = lvl >= UPGRADE_MAX_LEVEL;
                  const cost = maxed ? 0 : getUpgradeCost(car.price, lvl);
                  const canAfford = !maxed && progress.coins >= cost;
                  const currentStat = statRows.find((s) => s.key === statKey);

                  return (
                    <div
                      key={statKey}
                      className="flex items-center justify-between gap-2.5 rounded-lg bg-slate-900/90 border border-white/10 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-white truncate">
                            {meta.name}
                          </span>
                          <span className="font-mono-num text-[11px] text-cyan-300">
                            {currentStat?.valueLabel}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-0.5">
                          {Array.from({ length: UPGRADE_MAX_LEVEL }).map((_, idx) => (
                            <span
                              key={idx}
                              className={`h-1.5 flex-1 rounded-xs ${
                                idx < lvl ? 'bg-cyan-400' : 'bg-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="mt-0.5 text-[10px] font-mono-num text-slate-400">
                          Lv.{lvl}/{UPGRADE_MAX_LEVEL}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={maxed || !canAfford}
                        onClick={() => onUpgradeStat(car.id, statKey)}
                        className={`shrink-0 rounded-md px-2.5 py-1.5 font-mono-num text-xs font-bold transition-colors ${
                          maxed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 cursor-default'
                            : canAfford
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed'
                        }`}
                      >
                        {maxed ? 'MAX' : `${cost.toLocaleString()}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
