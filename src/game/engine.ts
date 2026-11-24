import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audioEngine } from './audio';
import {
  getBossById,
  getCarById,
  getEffectiveCarStats,
  getModeById,
  getWorldById,
  WORLDS,
} from './data';
import {
  buildBossCarModel,
  buildCoinModel,
  buildPlayerCarModel,
  buildPowerUpModel,
  buildRepairPickupModel,
  buildTrafficVehicleModel,
  BossVehicleRig,
  PlayerCarRig,
  TrafficVehicleRig,
} from './models';
import {
  createContactShadowTexture,
  createShowroomFloorTexture,
  getLaneCenterX,
  LANE_COUNT,
  LANE_WIDTH,
  SEGMENT_LENGTH,
} from './textures';
import {
  BossHudState,
  BossType,
  CameraPreset,
  CarId,
  DecalStyle,
  GameModeId,
  GameSettings,
  HudNotification,
  LiveHudSnapshot,
  PowerUpType,
  RepairPickupTier,
  RunSummary,
  TrafficVehicleType,
  WorldId,
} from './types';
import { buildHighwayEnvironment, HighwayEnvironmentRig } from './worldBuilder';

export type EngineViewMode = 'highway_attract' | 'gameplay' | 'paused' | 'showroom';

interface PooledTraffic {
  active: boolean;
  type: TrafficVehicleType;
  rig: TrafficVehicleRig;
  lane: number;
  targetLane: number;
  x: number;
  z: number;
  speed: number;
  nearMissed: boolean;
  collided: boolean;
  laneChangeTimer: number;
  telegraphingDir: -1 | 0 | 1;
}

interface PooledCoin {
  active: boolean;
  mesh: THREE.Group;
  x: number;
  z: number;
}

interface PooledRepair {
  active: boolean;
  tier: RepairPickupTier;
  mesh: THREE.Group;
  x: number;
  z: number;
}

interface PooledPowerUp {
  active: boolean;
  type: PowerUpType;
  mesh: THREE.Group;
  x: number;
  z: number;
}

interface ParticleItem {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  kind: 'spark' | 'smoke';
}

const SEGMENT_COUNT = 14;
const TRAFFIC_TYPES: TrafficVehicleType[] = [
  'sedan',
  'suv',
  'sports',
  'supercar',
  'bus',
  'truck',
  'van',
  'motorbike',
  'limousine',
];

const _tmpVec = new THREE.Vector3();

export interface EngineCallbacks {
  onHudUpdate: (snapshot: LiveHudSnapshot) => void;
  onGameOver: (summary: RunSummary) => void;
  onTutorialComplete: () => void;
}

export class WrongWayEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;
  private frameId = 0;
  private lastTimestamp = 0;
  private disposed = false;

  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private headlightSpot: THREE.SpotLight;

  private shadowTex: THREE.CanvasTexture;
  private showroomFloorTex: THREE.CanvasTexture;

  private highwayRig: HighwayEnvironmentRig | null = null;
  private showroomGroup: THREE.Group;
  private showroomCarRig: PlayerCarRig | null = null;
  private showroomAngle = 0.55;
  private showroomDragging = false;
  private showroomLastX = 0;

  private playerRig: PlayerCarRig | null = null;
  private activeCarId: CarId = 'starter';
  private activeCarColor = '#e11d48';
  private activeCarDecal: DecalStyle = 'clean';
  private activeWorldId: WorldId = 'neon_city';
  private activeModeId: GameModeId = 'endless';
  private settings: GameSettings;

  // Boss State
  private bossRig: BossVehicleRig | null = null;
  private activeBossType: BossType = 'black_hypercar';
  private bossActive = false;
  private bossTimer = 0;
  private bossTotalDuration = 60;
  private bossLane = 3;
  private bossX = getLaneCenterX(3);
  private bossZ = -22;
  private bossMoveCooldown = 2.0;
  private bossHitCooldown = 0;
  private bossWarningText: string | null = null;
  private bossEscapedThisRun = false;
  private nextEndlessBossM = 9999999;
  private nextBiomeTransitionM = 1200;

  // Object Pools
  private trafficPool: PooledTraffic[] = [];
  private coinPool: PooledCoin[] = [];
  private repairPool: PooledRepair[] = [];
  private powerUpPool: PooledPowerUp[] = [];
  private particlePool: ParticleItem[] = [];
  private sparkPoints: THREE.Points;
  private sparkPositions: Float32Array;
  private smokePoints: THREE.Points;
  private smokePositions: Float32Array;

  // Simulation State
  private viewMode: EngineViewMode = 'highway_attract';
  private targetLane = 2;
  private playerX = getLaneCenterX(2);
  private prevPlayerX = getLaneCenterX(2);
  private playerRoll = 0;
  private playerYaw = 0;
  private playerY = 0;
  private playerYVel = 0;
  private playerPitch = 0;
  private stuntCooldown = 0;
  private tiltCooldown = 0;

  private health = 100;
  private maxHealth = 100;
  private speedUnits = 38;
  private distanceM = 0;
  private score = 0;
  private runCoins = 0;
  private nitroAmount = 1;
  private nitroActive = false;
  private braking = false;
  private nitroUses = 0;
  private nitroSecondsUsed = 0;
  private survivalSeconds = 0;

  private noDamageRunDist = 0;
  private maxNoDamageDist = 0;
  private crashesTaken = 0;

  private comboCount = 0;
  private comboTimer = 0;
  private nearMisses = 0;
  private maxCombo = 0;
  private maxSpeedKmh = 0;
  private smashes = 0;
  private repairsCollected = 0;

  private damageCooldown = 0;
  private damageFlash = 0;
  private hitstopTimer = 0;
  private cameraShake = 0;
  private crashSlowMoTimer = 0;
  private crashPendingSummary = false;
  private revivedThisRun = false;
  private modeBonusClaimed = false;

  private magnetRemaining = 0;
  private shieldRemaining = 0;
  private slowMoRemaining = 0;
  private abilityActiveRemaining = 0;
  private abilityCooldownRemaining = 0;
  private titaniumRegenTimer = 0;

  private timeRemainingSec: number | null = null;
  private nextCheckpointM = 450;

  private tutorialStep = -1; // 0: steer, 1: nitro, 2: dodge/near-miss, -1: done

  private spawnTimer = 0;
  private coinSpawnTimer = 0;
  private pickupSpawnTimer = 0;
  private hudEmitAccum = 0;
  private smokeEmitAccum = 0;
  private attractTime = 0;

  private notifications: HudNotification[] = [];
  private notifCounter = 1;
  private carUpgradeLevels: Record<string, Record<string, number>> = {};

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.settings = initialSettings;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && initialSettings.graphics !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.applyGraphicsQuality(initialSettings.graphics);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(64, w / h, 0.1, 480);
    this.camera.position.set(0, 5.2, 11);

    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e1b4b, 1.0);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfffbeb, 1.5);
    this.keyLight.position.set(22, 42, 18);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 140;
    this.keyLight.shadow.camera.left = -28;
    this.keyLight.shadow.camera.right = 28;
    this.keyLight.shadow.camera.top = 28;
    this.keyLight.shadow.camera.bottom = -28;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    this.rimLight.position.set(-18, 16, -24);
    this.scene.add(this.rimLight);

    this.headlightSpot = new THREE.SpotLight(0xe0f2fe, 4.5, 95, Math.PI / 5, 0.45, 1.2);
    this.headlightSpot.position.set(0, 1.1, 0);
    this.scene.add(this.headlightSpot);
    this.scene.add(this.headlightSpot.target);

    this.shadowTex = createContactShadowTexture();
    this.showroomFloorTex = createShowroomFloorTexture(this.maxAnisotropy);

    this.showroomGroup = new THREE.Group();
    const turntable = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.9, 0.28, 48),
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        metalness: 0.7,
        roughness: 0.25,
      }),
    );
    turntable.position.y = -0.14;
    turntable.receiveShadow = true;
    this.showroomGroup.add(turntable);

    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshStandardMaterial({
        map: this.showroomFloorTex,
        roughness: 0.35,
        metalness: 0.45,
      }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.27;
    floorMesh.receiveShadow = true;
    this.showroomGroup.add(floorMesh);
    this.showroomGroup.visible = false;
    this.scene.add(this.showroomGroup);

    const maxParticles = 140;
    for (let i = 0; i < maxParticles; i++) {
      this.particlePool.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        kind: i < 80 ? 'spark' : 'smoke',
      });
    }
    this.sparkPositions = new Float32Array(80 * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkPoints = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({
        color: 0xfbbf24,
        size: 0.34,
        transparent: true,
        opacity: 0.95,
      }),
    );
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    this.smokePositions = new Float32Array(60 * 3);
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));
    this.smokePoints = new THREE.Points(
      smokeGeo,
      new THREE.PointsMaterial({
        color: 0x334155,
        size: 0.68,
        transparent: true,
        opacity: 0.68,
      }),
    );
    this.smokePoints.frustumCulled = false;
    this.scene.add(this.smokePoints);

    this.initPools();

    this.rebuildWorld(this.activeWorldId);
    this.rebuildPlayerCar(this.activeCarId, this.activeCarColor, this.activeCarDecal);
    this.setShowroomCar(this.activeCarId, this.activeCarColor, this.activeCarDecal);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);

    this.lastTimestamp = performance.now();
    this.scheduleNextTick();
  }

  private initPools(): void {
    for (let i = 0; i < 46; i++) {
      const type = TRAFFIC_TYPES[i % TRAFFIC_TYPES.length];
      const rig = buildTrafficVehicleModel(type, this.shadowTex);
      rig.group.visible = false;
      this.scene.add(rig.group);
      this.trafficPool.push({
        active: false,
        type,
        rig,
        lane: 0,
        targetLane: 0,
        x: 0,
        z: -500,
        speed: 25,
        nearMissed: false,
        collided: false,
        laneChangeTimer: 0,
        telegraphingDir: 0,
      });
    }

    for (let i = 0; i < 70; i++) {
      const mesh = buildCoinModel();
      mesh.visible = false;
      this.scene.add(mesh);
      this.coinPool.push({ active: false, mesh, x: 0, z: -500 });
    }

    const tiers: RepairPickupTier[] = [
      'small',
      'small',
      'small',
      'medium',
      'medium',
      'large',
      'large',
      'legendary',
    ];
    for (const tier of tiers) {
      const mesh = buildRepairPickupModel(tier);
      mesh.visible = false;
      this.scene.add(mesh);
      this.repairPool.push({ active: false, tier, mesh, x: 0, z: -500 });
    }

    const powerTypes: PowerUpType[] = [
      'nitro',
      'magnet',
      'shield',
      'slow_mo',
      'emergency_repair',
      'nitro',
      'magnet',
      'shield',
      'slow_mo',
      'emergency_repair',
    ];
    for (const type of powerTypes) {
      const mesh = buildPowerUpModel(type);
      mesh.visible = false;
      this.scene.add(mesh);
      this.powerUpPool.push({ active: false, type, mesh, x: 0, z: -500 });
    }
  }

  private triggerHaptic(pattern: number | number[]): void {
    if (!this.settings.vibration) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore browser vibration restrictions
      }
    }
  }

  private applyGraphicsQuality(quality: GameSettings['graphics']): void {
    const maxPr = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, maxPr));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  public updateSettings(
    settings: GameSettings,
    upgradeLevels: Record<string, Record<string, number>>,
  ): void {
    const gfxChanged = this.settings.graphics !== settings.graphics;
    this.settings = settings;
    this.carUpgradeLevels = upgradeLevels;
    if (gfxChanged) {
      this.applyGraphicsQuality(settings.graphics);
      this.rebuildWorld(this.activeWorldId);
    }
  }

  public rebuildWorld(worldId: WorldId): void {
    this.activeWorldId = worldId;
    const world = getWorldById(worldId);

    if (this.highwayRig) {
      this.scene.remove(this.highwayRig.root);
      this.highwayRig.dispose();
    }

    this.highwayRig = buildHighwayEnvironment(
      world,
      SEGMENT_COUNT,
      this.maxAnisotropy,
      this.settings.graphics,
    );
    this.highwayRig.root.visible = this.viewMode !== 'showroom';
    this.scene.add(this.highwayRig.root);

    this.scene.background = new THREE.Color(world.skyHorizon);
    this.scene.fog = new THREE.FogExp2(world.fogColor, world.fogDensity);
    this.hemiLight.color.set(world.ambientSky);
    this.hemiLight.groundColor.set(world.ambientGround);
    this.hemiLight.intensity = world.isNight ? 0.9 : 1.15;
    this.keyLight.color.set(world.sunColor);
    this.keyLight.intensity = world.sunIntensity;
    this.rimLight.color.set(world.accentGlow);
    this.headlightSpot.intensity = world.isNight ? 6.5 : 1.8;
  }

  private disposeObject3D(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        if (obj.geometry && !obj.geometry.userData?.shared) {
          obj.geometry.dispose();
        }
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (mat && !mat.userData?.shared) {
            mat.dispose();
          }
        }
      }
    });
  }

  public rebuildPlayerCar(
    carId: CarId,
    colorHex: string,
    decal: DecalStyle = 'clean',
  ): void {
    this.activeCarId = carId;
    this.activeCarColor = colorHex;
    this.activeCarDecal = decal;
    const car = getCarById(carId);
    if (this.playerRig) {
      this.scene.remove(this.playerRig.group);
      this.disposeObject3D(this.playerRig.group);
    }
    this.playerRig = buildPlayerCarModel(
      car.bodyStyle,
      colorHex,
      car.accentColor,
      this.shadowTex,
      decal,
      car.underglowColor,
    );
    this.playerRig.group.position.set(this.playerX, 0, 0);
    this.playerRig.group.visible = this.viewMode !== 'showroom';
    this.scene.add(this.playerRig.group);
  }

  public setShowroomCar(
    carId: CarId,
    colorHex: string,
    decal: DecalStyle = 'clean',
  ): void {
    const car = getCarById(carId);
    if (this.showroomCarRig) {
      this.showroomGroup.remove(this.showroomCarRig.group);
      this.disposeObject3D(this.showroomCarRig.group);
    }
    this.showroomCarRig = buildPlayerCarModel(
      car.bodyStyle,
      colorHex,
      car.accentColor,
      this.shadowTex,
      decal,
      car.underglowColor,
    );
    this.showroomCarRig.group.position.set(0, 0, 0);
    this.showroomGroup.add(this.showroomCarRig.group);
  }

  public setViewMode(mode: EngineViewMode): void {
    this.viewMode = mode;
    const isShowroom = mode === 'showroom';
    this.showroomGroup.visible = isShowroom;
    if (this.highwayRig) this.highwayRig.root.visible = !isShowroom;
    if (this.playerRig) this.playerRig.group.visible = !isShowroom;
    if (this.bossRig) this.bossRig.group.visible = !isShowroom && this.bossActive;

    if (isShowroom) {
      this.scene.background = new THREE.Color('#090d16');
      this.scene.fog = new THREE.FogExp2('#090d16', 0.025);
      this.hideAllPoolItems();
      audioEngine.stopEngine();
    } else {
      const world = getWorldById(this.activeWorldId);
      this.scene.background = new THREE.Color(world.skyHorizon);
      this.scene.fog = new THREE.FogExp2(world.fogColor, world.fogDensity);
      if (mode === 'paused') {
        audioEngine.stopEngine();
      } else if (mode === 'gameplay') {
        audioEngine.startEngine(getCarById(this.activeCarId).audio);
      }
    }
  }

  private spawnBoss(bossType: BossType): void {
    this.activeBossType = bossType;
    if (this.bossRig) {
      this.scene.remove(this.bossRig.group);
      this.disposeObject3D(this.bossRig.group);
    }
    this.bossRig = buildBossCarModel(bossType, this.shadowTex);
    this.bossLane = Math.floor(Math.random() * LANE_COUNT);
    this.bossX = getLaneCenterX(this.bossLane);
    this.bossZ = -26;
    this.bossRig.group.position.set(this.bossX, 0, this.bossZ);
    this.bossRig.group.visible = true;
    this.scene.add(this.bossRig.group);

    this.bossActive = true;
    this.bossTotalDuration = 60;
    this.bossTimer = 60;
    this.bossMoveCooldown = 2.5;
    this.bossHitCooldown = 0;
    this.bossWarningText = null;
    const bossMeta = getBossById(bossType);
    this.pushNotification(`BOSS PURSUIT · ${bossMeta.name.toUpperCase()}`, 'rose');
    this.triggerHaptic([50, 40, 80]);
  }

  public startNewRun(params: {
    carId: CarId;
    colorHex: string;
    decal: DecalStyle;
    worldId: WorldId;
    modeId: GameModeId;
    bossType: BossType;
    tutorialNeeded: boolean;
    upgradeLevels: Record<string, Record<string, number>>;
  }): void {
    this.carUpgradeLevels = params.upgradeLevels;
    this.activeModeId = params.modeId;
    if (params.worldId !== this.activeWorldId) {
      this.rebuildWorld(params.worldId);
    }
    if (
      params.carId !== this.activeCarId ||
      params.colorHex !== this.activeCarColor ||
      params.decal !== this.activeCarDecal
    ) {
      this.rebuildPlayerCar(params.carId, params.colorHex, params.decal);
    }

    this.hideAllPoolItems();
    this.clearParticles();

    if (this.bossRig) {
      this.bossRig.group.visible = false;
    }
    this.bossActive = false;
    this.bossEscapedThisRun = false;
    this.nextEndlessBossM = 9999999;
    this.nextBiomeTransitionM = 1200;

    this.targetLane = 2;
    this.playerX = getLaneCenterX(2);
    this.prevPlayerX = this.playerX;
    this.playerRoll = 0;
    this.playerYaw = 0;
    this.playerY = 0;
    this.playerYVel = 0;
    this.playerPitch = 0;
    this.stuntCooldown = 0;

    this.health = 100;
    this.maxHealth = 100;
    this.speedUnits = 34;
    this.distanceM = 0;
    this.score = 0;
    this.runCoins = 0;
    this.nitroAmount = 1.0;
    this.nitroActive = false;
    this.braking = false;
    this.nitroUses = 0;
    this.nitroSecondsUsed = 0;
    this.survivalSeconds = 0;
    this.noDamageRunDist = 0;
    this.maxNoDamageDist = 0;
    this.crashesTaken = 0;

    this.comboCount = 0;
    this.comboTimer = 0;
    this.nearMisses = 0;
    this.maxCombo = 0;
    this.maxSpeedKmh = 0;
    this.smashes = 0;
    this.repairsCollected = 0;

    this.damageCooldown = 0;
    this.damageFlash = 0;
    this.hitstopTimer = 0;
    this.cameraShake = 0;
    this.crashSlowMoTimer = 0;
    this.crashPendingSummary = false;
    this.revivedThisRun = false;
    this.modeBonusClaimed = false;

    this.magnetRemaining = 0;
    this.shieldRemaining = 0;
    this.slowMoRemaining = 0;
    this.abilityActiveRemaining = 0;
    this.abilityCooldownRemaining = 0;
    this.titaniumRegenTimer = 0;

    const modeDef = getModeById(params.modeId);
    this.timeRemainingSec = modeDef.timeLimitSec ?? null;
    this.nextCheckpointM = 450;

    this.tutorialStep = params.tutorialNeeded ? 0 : -1;

    this.spawnTimer = 0.45;
    this.coinSpawnTimer = 0.6;
    this.pickupSpawnTimer = 4.5;
    this.notifications = [];

    if (this.playerRig) {
      this.playerRig.group.position.set(this.playerX, 0, 0);
      this.playerRig.group.rotation.set(0, 0, 0);
      this.playerRig.group.visible = true;
      this.playerRig.damageOverlays.forEach((d) => (d.visible = false));
    }

    this.setViewMode('gameplay');

    if (params.modeId === 'boss_escape') {
      this.spawnBoss(params.bossType);
    } else {
      this.pushNotification(`WRONG WAY · ${modeDef.name.toUpperCase()}`, 'amber');
    }
    this.emitHud();
  }

  public reviveRun(): void {
    this.revivedThisRun = true;
    this.crashPendingSummary = false;
    this.crashSlowMoTimer = 0;
    this.health = 65;
    this.damageCooldown = 2.6;
    this.shieldRemaining = Math.max(this.shieldRemaining, 2.8);
    if (this.timeRemainingSec !== null && this.timeRemainingSec <= 0) {
      this.timeRemainingSec = 22;
    }
    for (const t of this.trafficPool) {
      if (t.active && t.z > -115) {
        t.active = false;
        t.rig.group.visible = false;
      }
    }
    if (this.playerRig) {
      this.playerRig.group.rotation.set(0, 0, 0);
      this.playerRig.group.visible = true;
    }
    this.setViewMode('gameplay');
    this.pushNotification('REVIVED · +65 HP & SHIELD', 'cyan');
    audioEngine.playPowerUp('shield');
    this.emitHud();
  }

  public moveLane(dir: -1 | 1): void {
    if (this.viewMode !== 'gameplay' || this.crashPendingSummary) return;
    const next = Math.max(0, Math.min(LANE_COUNT - 1, this.targetLane + dir));
    if (next !== this.targetLane) {
      this.targetLane = next;
      audioEngine.playLaneShift();
      this.triggerHaptic(12);
      if (this.tutorialStep === 0) {
        this.tutorialStep = 1;
      }
    }
  }

  public applyTiltSteer(gammaDeg: number): void {
    if (!this.settings.tiltSteering || this.viewMode !== 'gameplay' || this.crashPendingSummary) {
      return;
    }
    if (this.tiltCooldown > 0) return;
    const threshold = 11 / Math.max(0.5, this.settings.tiltSensitivity);
    if (gammaDeg > threshold) {
      this.moveLane(1);
      this.tiltCooldown = 0.28;
    } else if (gammaDeg < -threshold) {
      this.moveLane(-1);
      this.tiltCooldown = 0.28;
    }
  }

  public setNitro(active: boolean): void {
    if (this.viewMode !== 'gameplay' || this.crashPendingSummary) {
      this.nitroActive = false;
      return;
    }
    if (active && !this.nitroActive && this.nitroAmount > 0.14) {
      this.nitroActive = true;
      this.nitroUses += 1;
      const abilityId = getCarById(this.activeCarId).ability.id;
      if (abilityId === 'overboost' && this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + 4);
        this.pushNotification('OVERBOOST · +4 HP', 'emerald');
      }
      audioEngine.playNitroStart();
      this.triggerHaptic(22);
      if (this.tutorialStep === 1) {
        this.tutorialStep = 2;
      }
    } else if (!active) {
      this.nitroActive = false;
    }
  }

  public setBraking(active: boolean): void {
    if (this.viewMode !== 'gameplay' || this.crashPendingSummary) {
      this.braking = false;
      return;
    }
    this.braking = active;
  }

  public triggerAbility(): void {
    if (this.viewMode !== 'gameplay' || this.crashPendingSummary) return;
    const car = getCarById(this.activeCarId);
    const ab = car.ability;
    if (ab.mode !== 'active') return;
    if (this.abilityActiveRemaining > 0 || this.abilityCooldownRemaining > 0) return;

    this.abilityActiveRemaining = ab.durationSec;
    this.abilityCooldownRemaining = ab.cooldownSec;
    audioEngine.playPowerUp(ab.id === 'time_warp' || ab.id === 'emp_pulse' ? 'slow_mo' : 'shield');
    this.triggerHaptic([24, 24, 48]);

    if (ab.id === 'sovereign_zenith') {
      this.health = Math.min(this.maxHealth, this.health + 20);
      this.nitroAmount = 1.0;
      this.magnetRemaining = Math.max(this.magnetRemaining, ab.durationSec);
    } else if (ab.id === 'quad_overdrive') {
      this.nitroAmount = 1.0;
      this.nitroActive = true;
      this.shieldRemaining = Math.max(this.shieldRemaining, ab.durationSec);
    } else if (ab.id === 'phantom_blink') {
      this.magnetRemaining = Math.max(this.magnetRemaining, ab.durationSec);
    }

    this.pushNotification(`${ab.name.toUpperCase()} ACTIVATED!`, 'cyan');
    this.emitHud();
  }

  private hideAllPoolItems(): void {
    for (const t of this.trafficPool) {
      t.active = false;
      t.rig.group.visible = false;
    }
    for (const c of this.coinPool) {
      c.active = false;
      c.mesh.visible = false;
    }
    for (const r of this.repairPool) {
      r.active = false;
      r.mesh.visible = false;
    }
    for (const p of this.powerUpPool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  private clearParticles(): void {
    for (const p of this.particlePool) {
      p.active = false;
    }
    this.sparkPositions.fill(-9999);
    this.smokePositions.fill(-9999);
    this.sparkPoints.geometry.attributes.position.needsUpdate = true;
    this.smokePoints.geometry.attributes.position.needsUpdate = true;
  }

  private spawnSparks(x: number, y: number, z: number, count: number): void {
    let spawned = 0;
    for (let i = 0; i < 80 && spawned < count; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        p.active = true;
        p.kind = 'spark';
        p.x = x + (Math.random() - 0.5) * 0.8;
        p.y = y + Math.random() * 0.5;
        p.z = z + (Math.random() - 0.5) * 0.8;
        p.vx = (Math.random() - 0.5) * 18;
        p.vy = 3 + Math.random() * 10;
        p.vz = (Math.random() - 0.5) * 18;
        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.35;
        spawned++;
      }
    }
  }

  private spawnSmoke(x: number, y: number, z: number): void {
    for (let i = 80; i < 140; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        p.active = true;
        p.kind = 'smoke';
        p.x = x + (Math.random() - 0.5) * 0.45;
        p.y = y;
        p.z = z;
        p.vx = (Math.random() - 0.5) * 1.6;
        p.vy = 2.2 + Math.random() * 1.8;
        p.vz = 7 + Math.random() * 5;
        p.life = 0;
        p.maxLife = 0.65 + Math.random() * 0.4;
        break;
      }
    }
  }

  private pushNotification(text: string, tone: HudNotification['tone']): void {
    this.notifications = [
      ...this.notifications.slice(-2),
      { id: this.notifCounter++, text, tone },
    ];
  }

  private getCurrentCarStats() {
    const car = getCarById(this.activeCarId);
    const lvls = this.carUpgradeLevels[this.activeCarId];
    return getEffectiveCarStats(car, lvls);
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick();
      });
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as Partial<WebGL2RenderingContext> | null;
    if (!gl || typeof gl.fenceSync !== 'function' || typeof gl.getSyncParameter !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE!, 0);
    gl.flush?.();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter!(sync, gl.SYNC_STATUS!);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync?.(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.viewMode === 'showroom') {
      this.updateShowroom(dt);
    } else if (this.viewMode === 'highway_attract') {
      this.updateAttractHighway(dt);
    } else if (this.viewMode === 'gameplay') {
      this.updateGameplay(dt);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  }

  private updateShowroom(dt: number): void {
    if (!this.showroomDragging) {
      this.showroomAngle += dt * 0.45;
    }
    if (this.showroomCarRig) {
      this.showroomCarRig.group.rotation.y = this.showroomAngle;
    }
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, 0, 6, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 2.4, 6, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 7.2, 6, dt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 46, 6, dt);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0.65, 0);
  }

  private updateAttractHighway(dt: number): void {
    this.attractTime += dt;
    const cruiseSpeed = 28;
    this.scrollRoadSegments(cruiseSpeed * dt);
    this.updateWeatherAndSpeedLines(dt, cruiseSpeed, false);

    if (this.playerRig) {
      const swayX = Math.sin(this.attractTime * 0.45) * 3.5;
      this.playerRig.group.position.x = THREE.MathUtils.damp(
        this.playerRig.group.position.x,
        swayX,
        4,
        dt,
      );
      this.playerRig.group.rotation.set(0, 0, -Math.cos(this.attractTime * 0.45) * 0.03);
      for (const w of this.playerRig.wheels) {
        w.rotation.x -= dt * 18;
      }
      if (this.playerRig.policeBarLights.length === 2) {
        const flash = Math.floor(this.attractTime * 8) % 2 === 0;
        this.playerRig.policeBarLights[0].visible = flash;
        this.playerRig.policeBarLights[1].visible = !flash;
      }
    }

    const camX = Math.sin(this.attractTime * 0.3) * 2.5;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camX, 3, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 4.4, 3, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 9.5, 3, dt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 60, 4, dt);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 1.0, -18);
  }

  private scrollRoadSegments(dz: number): void {
    if (!this.highwayRig) return;
    const totalLength = SEGMENT_COUNT * SEGMENT_LENGTH;
    for (const seg of this.highwayRig.segments) {
      seg.zStart += dz;
      if (seg.zStart > SEGMENT_LENGTH * 1.5) {
        seg.zStart -= totalLength;
      }
      seg.group.position.z = seg.zStart;
    }
  }

  private updateWeatherAndSpeedLines(
    dt: number,
    playerSpeed: number,
    nitroOn: boolean,
  ): void {
    if (!this.highwayRig) return;
    const { weatherPoints, weatherVelocities, speedLines, speedPositions } = this.highwayRig;

    if (weatherPoints && weatherVelocities) {
      const world = getWorldById(this.activeWorldId);
      const posAttr = weatherPoints.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const count = weatherVelocities.length;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const v = weatherVelocities[i];
        arr[idx + 2] += (playerSpeed * 0.9 + 12) * dt * v;
        if (world.weather === 'rain') {
          arr[idx + 1] -= 26 * dt * v;
        } else if (world.weather === 'snow') {
          arr[idx + 1] -= 4.5 * dt * v;
          arr[idx] += Math.sin(this.attractTime * 2 + i) * 1.4 * dt;
        } else {
          arr[idx] += 4.5 * dt * v;
        }
        if (arr[idx + 2] > 16 || arr[idx + 1] < 0) {
          arr[idx] = (Math.random() - 0.5) * 44;
          arr[idx + 1] = 14 + Math.random() * 4;
          arr[idx + 2] = -75 - Math.random() * 15;
        }
      }
      posAttr.needsUpdate = true;
    }

    const speedKmh = playerSpeed * 3.6;
    const targetOpacity = nitroOn
      ? 0.55
      : THREE.MathUtils.clamp((speedKmh - 190) / 140, 0, 0.35);
    const mat = speedLines.material as THREE.LineBasicMaterial;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 6, dt);

    if (mat.opacity > 0.02) {
      const posAttr = speedLines.geometry.attributes.position as THREE.BufferAttribute;
      const lineMove = playerSpeed * 1.65 * dt;
      for (let i = 0; i < 36; i++) {
        const k = i * 6;
        speedPositions[k + 2] += lineMove;
        speedPositions[k + 5] += lineMove;
        if (speedPositions[k + 2] > 14) {
          const z = -65 - Math.random() * 25;
          const x = (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 8.5);
          const y = 0.6 + Math.random() * 4.5;
          speedPositions[k] = x;
          speedPositions[k + 1] = y;
          speedPositions[k + 2] = z;
          speedPositions[k + 3] = x;
          speedPositions[k + 4] = y;
          speedPositions[k + 5] = z - (nitroOn ? 6.5 : 4.0);
        }
      }
      posAttr.needsUpdate = true;
    }
  }

  private updateGameplay(dt: number): void {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt * 0.25);
      return;
    }

    if (this.crashPendingSummary) {
      this.crashSlowMoTimer -= dt;
      const slowDt = dt * 0.28;
      this.scrollRoadSegments(this.speedUnits * slowDt * 0.45);
      this.updateParticles(dt);
      if (this.playerRig) {
        this.playerRig.group.rotation.y += dt * 3.6;
        this.playerRig.group.rotation.z = Math.sin(this.crashSlowMoTimer * 18) * 0.12;
      }
      this.cameraShake = Math.max(this.cameraShake - dt * 1.4, 0);
      this.updateFollowCamera(dt, false);

      if (this.crashSlowMoTimer <= 0) {
        this.finishRunAndReport();
      }
      return;
    }

    const carStats = this.getCurrentCarStats();
    const modeDef = getModeById(this.activeModeId);
    const worldDef = getWorldById(this.activeWorldId);

    this.survivalSeconds += dt;
    if (this.tiltCooldown > 0) this.tiltCooldown = Math.max(0, this.tiltCooldown - dt);
    if (this.damageCooldown > 0) this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    if (this.cameraShake > 0) this.cameraShake = Math.max(0, this.cameraShake - dt * 3.0);
    if (this.magnetRemaining > 0) this.magnetRemaining = Math.max(0, this.magnetRemaining - dt);
    if (this.shieldRemaining > 0) this.shieldRemaining = Math.max(0, this.shieldRemaining - dt);
    if (this.slowMoRemaining > 0) this.slowMoRemaining = Math.max(0, this.slowMoRemaining - dt);
    if (this.abilityActiveRemaining > 0) {
      this.abilityActiveRemaining = Math.max(0, this.abilityActiveRemaining - dt);
    } else if (this.abilityCooldownRemaining > 0) {
      this.abilityCooldownRemaining = Math.max(0, this.abilityCooldownRemaining - dt);
    }

    const activeCarDef = getCarById(this.activeCarId);
    const abId = activeCarDef.ability.id;

    if (abId === 'titanium_armor' && this.speedUnits * 3.6 >= 200 && this.health < this.maxHealth) {
      this.titaniumRegenTimer += dt;
      if (this.titaniumRegenTimer >= 5.0) {
        this.titaniumRegenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
      }
    } else {
      this.titaniumRegenTimer = 0;
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt * (abId === 'apex_magnet' ? 0.72 : 1.0);
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }

    if (this.timeRemainingSec !== null) {
      this.timeRemainingSec = Math.max(0, this.timeRemainingSec - dt);
      if (this.timeRemainingSec <= 0) {
        this.triggerCrashGameOver();
        return;
      }
    }

    const overdriveActive = abId === 'quad_overdrive' && this.abilityActiveRemaining > 0;
    const zenithActive = abId === 'sovereign_zenith' && this.abilityActiveRemaining > 0;
    if (this.nitroActive) {
      if (!overdriveActive) {
        this.nitroAmount -= (dt * (zenithActive ? 0.45 : 1.0)) / carStats.nitroCapacity;
      }
      this.nitroSecondsUsed += dt;
      if (this.nitroAmount <= 0) {
        this.nitroAmount = 0;
        this.nitroActive = false;
      }
    } else {
      this.nitroAmount = Math.min(1, this.nitroAmount + dt * (0.065 + carStats.nitroCapacity * 0.008));
    }

    const difficultyBoostUnits = Math.min(18, this.distanceM * 0.0032);
    const baseMaxUnits = carStats.topSpeed / 3.6 + difficultyBoostUnits;
    let targetSpeed = baseMaxUnits;
    if (overdriveActive) targetSpeed *= 1.42;
    else if (this.nitroActive) targetSpeed *= abId === 'overboost' ? 1.44 : 1.32;
    else if (this.braking) targetSpeed *= 0.56;

    const accelRate = (this.braking ? carStats.braking : carStats.acceleration) * 0.045;
    this.speedUnits = THREE.MathUtils.damp(this.speedUnits, targetSpeed, accelRate, dt);

    const speedKmh = Math.round(this.speedUnits * 3.6);
    if (speedKmh > this.maxSpeedKmh) this.maxSpeedKmh = speedKmh;

    const moveDz = this.speedUnits * dt;
    const prevM = Math.floor(this.distanceM);
    this.distanceM += moveDz;
    this.noDamageRunDist += moveDz;
    if (this.noDamageRunDist > this.maxNoDamageDist) {
      this.maxNoDamageDist = Math.round(this.noDamageRunDist);
    }

    const curM = Math.floor(this.distanceM);
    if (curM > prevM) {
      const gainedM = curM - prevM;
      this.score += gainedM * (1 + this.comboCount * 0.25);
      if (Math.floor(curM / 25) > Math.floor(prevM / 25)) {
        this.runCoins += abId === 'vip_convoy' ? 2 : 1;
      }
    }

    // Seamless biome transition every 1,200m in Endless mode
    if (this.activeModeId === 'endless' && this.distanceM >= this.nextBiomeTransitionM) {
      this.nextBiomeTransitionM += 1200;
      const curIdx = WORLDS.findIndex((w) => w.id === this.activeWorldId);
      const nextWorld = WORLDS[(curIdx + 1) % WORLDS.length];
      this.rebuildWorld(nextWorld.id);
      this.pushNotification(`ENTERING ${nextWorld.name.toUpperCase()}`, 'cyan');
    }

    // Trigger periodic Boss Chase event in Endless mode every 1,400m
    if (this.activeModeId === 'endless' && !this.bossActive && this.distanceM >= this.nextEndlessBossM) {
      this.nextEndlessBossM += 1600;
      const bossTypes: BossType[] = [
        'black_hypercar',
        'police_interceptor',
        'highway_hunter',
        'cyber_beast',
      ];
      this.spawnBoss(bossTypes[Math.floor(Math.random() * bossTypes.length)]);
    }

    if (this.timeRemainingSec !== null && this.distanceM >= this.nextCheckpointM) {
      this.timeRemainingSec += 14;
      this.nextCheckpointM += 450;
      this.pushNotification('CHECKPOINT · +14s BONUS', 'cyan');
      audioEngine.playPowerUp('nitro');
    }

    if (!this.modeBonusClaimed) {
      if (
        this.activeModeId === 'traffic_challenge' &&
        modeDef.targetDistanceM &&
        modeDef.targetNearMisses &&
        this.distanceM >= modeDef.targetDistanceM &&
        this.nearMisses >= modeDef.targetNearMisses
      ) {
        this.modeBonusClaimed = true;
        this.pushNotification('CHALLENGE COMPLETE · +800 COINS', 'emerald');
        audioEngine.playUnlock();
      } else if (
        this.activeModeId === 'time_trial' &&
        modeDef.targetDistanceM &&
        this.distanceM >= modeDef.targetDistanceM
      ) {
        this.modeBonusClaimed = true;
        this.pushNotification('TARGET DISTANCE REACHED · +650 COINS', 'emerald');
        audioEngine.playUnlock();
      }
    }

    // Smooth Lane Transition scaled by Tires + Handling
    this.prevPlayerX = this.playerX;
    const desiredX = getLaneCenterX(this.targetLane);
    const aeroBonus = abId === 'aero_downforce' && speedKmh >= 250 ? 4.0 : 0;
    const laneSnapLambda = 7.5 + ((carStats.tireGrip + carStats.handling) / 200) * 10.5 + aeroBonus;
    this.playerX = THREE.MathUtils.damp(this.playerX, desiredX, laneSnapLambda, dt);
    const vx = (this.playerX - this.prevPlayerX) / Math.max(dt, 0.001);
    this.playerRoll = THREE.MathUtils.damp(this.playerRoll, -vx * 0.011, 14, dt);
    this.playerYaw = THREE.MathUtils.damp(this.playerYaw, -vx * 0.014, 14, dt);

    // Stunt Jump & Gravity Physics
    if (this.playerY > 0) {
      this.playerYVel -= 24 * dt;
      this.playerY += this.playerYVel * dt;
      this.playerPitch += dt * 3.5;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.playerYVel = 0;
        this.playerPitch = 0;
        this.pushNotification('STUNT LANDING PERFECT! +500 PTS', 'amber');
        this.runCoins += 25;
        this.score += 500;
        audioEngine.playPowerUp('nitro');
      }
    } else {
      if (this.stuntCooldown > 0) {
        this.stuntCooldown -= dt;
      } else {
        if (Math.floor(this.distanceM) % 85 < 3 && Math.abs(this.playerX) > 1.6) {
          this.playerYVel = 9.8 + (this.nitroActive ? 4.5 : 0);
          this.playerY = 0.01;
          this.stuntCooldown = 3.0;
          this.pushNotification('MEGA STUNT RAMP JUMP! +750 PTS', 'cyan');
          this.score += 750;
          this.runCoins += 35;
          audioEngine.playPowerUp('nitro');
        }
      }
    }

    const ghostPhaseActive =
      this.abilityActiveRemaining > 0 &&
      (abId === 'phase_ghost' || abId === 'phantom_blink' || abId === 'sovereign_zenith');

    if (this.playerRig) {
      this.playerRig.group.position.x = this.playerX;
      this.playerRig.group.position.y = this.playerY;
      this.playerRig.group.rotation.x = this.playerPitch;
      this.playerRig.group.rotation.z = this.playerRoll;
      this.playerRig.group.rotation.y = this.playerYaw;
      this.playerRig.group.visible =
        ghostPhaseActive
          ? Math.floor(performance.now() / 65) % 2 === 0
          : this.damageCooldown <= 0 || Math.floor(this.damageCooldown * 18) % 2 === 0;
      this.playerRig.nitroFlames.visible = this.nitroActive || overdriveActive;
      if (this.nitroActive || overdriveActive) {
        const flicker = 0.85 + Math.random() * 0.45;
        this.playerRig.nitroFlames.scale.set(1, 1, flicker);
      }
      this.playerRig.shieldMesh.visible = this.shieldRemaining > 0;
      if (this.shieldRemaining > 0) {
        this.playerRig.shieldMesh.rotation.y += dt * 2.5;
      }

      this.playerRig.abilityAuraMesh.visible = this.abilityActiveRemaining > 0;
      if (this.abilityActiveRemaining > 0) {
        this.playerRig.abilityAuraMesh.rotation.z += dt * 3.8;
        const pulse = 1.0 + Math.sin(performance.now() * 0.012) * 0.08;
        this.playerRig.abilityAuraMesh.scale.set(pulse, pulse, 1);
      }

      for (const bl of this.playerRig.brakeLights) {
        const mat = bl.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = this.braking ? 5.5 : 2.0;
      }

      // 4-Stage Visual Damage: 100-75 normal, 74-50 minor, 49-25 warning+smoke, 24-1 critical+broken lights
      this.playerRig.damageOverlays[0].visible = this.health <= 74;
      this.playerRig.damageOverlays[1].visible = this.health <= 49;
      this.playerRig.damageOverlays[2].visible = this.health <= 24;

      // Flickering / dimmed broken headlights below 25 HP
      const lightIntensity =
        this.health <= 24 ? (Math.random() > 0.35 ? 0.6 : 0.1) : this.health <= 49 ? 1.4 : 2.2;
      for (const hl of this.playerRig.headlights) {
        (hl.material as THREE.MeshStandardMaterial).emissiveIntensity = lightIntensity;
      }

      if (this.playerRig.policeBarLights.length === 2) {
        const flash = Math.floor(performance.now() / 130) % 2 === 0;
        this.playerRig.policeBarLights[0].visible = flash;
        this.playerRig.policeBarLights[1].visible = !flash;
      }

      const wheelSpin = moveDz * 2.4;
      for (const w of this.playerRig.wheels) {
        w.rotation.x -= wheelSpin;
      }

      // Increasing smoke at Warning (<50 HP) & Critical (<25 HP)
      if (this.health <= 49) {
        this.smokeEmitAccum += dt;
        const rate = this.health <= 24 ? 0.032 : 0.085;
        if (this.smokeEmitAccum >= rate) {
          this.smokeEmitAccum = 0;
          this.spawnSmoke(
            this.playerX + this.playerRig.smokeAnchor.x,
            this.playerRig.smokeAnchor.y,
            this.playerRig.smokeAnchor.z,
          );
        }
      }
    }

    this.headlightSpot.position.set(this.playerX, 1.15, -2.0);
    this.headlightSpot.target.position.set(this.playerX, 0.2, -38);
    this.headlightSpot.intensity =
      (worldDef.isNight ? 6.5 : 1.8) * (this.health <= 24 ? 0.45 : 1.0);

    this.scrollRoadSegments(moveDz);
    this.updateWeatherAndSpeedLines(dt, this.speedUnits, this.nitroActive);

    // Update Boss Chase if active
    if (this.bossActive) {
      this.updateBossChase(dt, moveDz, carStats.damageResistance);
    }

    const difficultyDensity = 1 + Math.min(0.85, this.distanceM / 3500);
    const spawnInterval =
      Math.max(0.42, 1.18 / (difficultyDensity * modeDef.trafficDensityScale));
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnInterval * (0.8 + Math.random() * 0.45);
      this.spawnFairTrafficWave(difficultyDensity);
    }

    this.coinSpawnTimer -= dt;
    if (this.coinSpawnTimer <= 0) {
      this.coinSpawnTimer = Math.max(0.55, 1.45 / modeDef.coinSpawnScale);
      this.spawnCoinArc();
    }

    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0) {
      this.pickupSpawnTimer = 5.2 + Math.random() * 4.5;
      this.spawnRepairOrPowerUp();
    }

    const empOrWarpSlow =
      this.abilityActiveRemaining > 0 && (abId === 'emp_pulse' || abId === 'time_warp');
    const slowScale = this.slowMoRemaining > 0 ? 0.48 : empOrWarpSlow ? 0.42 : 1.0;
    const effectiveRepairMult =
      abId === 'aero_downforce' ? carStats.repairEfficiency * 1.35 : carStats.repairEfficiency;
    this.updateTraffic(dt, moveDz, slowScale, carStats.damageResistance);
    this.updateCoins(dt, moveDz, worldDef.coinMultiplier * modeDef.coinMultiplier);
    this.updateRepairs(dt, moveDz, effectiveRepairMult);
    this.updatePowerUps(dt, moveDz, effectiveRepairMult);
    this.updateParticles(dt);

    audioEngine.updateEngine(
      getCarById(this.activeCarId).audio,
      this.speedUnits / (carStats.topSpeed / 3.6),
      this.nitroActive,
      this.braking,
      this.health / 100,
    );

    this.updateFollowCamera(dt, true);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateBossChase(dt: number, moveDz: number, damageResistance: number): void {
    if (!this.bossRig) return;
    this.bossTimer -= dt;
    if (this.bossHitCooldown > 0) this.bossHitCooldown = Math.max(0, this.bossHitCooldown - dt);

    // Boss weaves ahead at z ~ -16..-24, occasionally closing in to block
    this.bossMoveCooldown -= dt;
    if (this.bossMoveCooldown <= 0.8 && this.bossMoveCooldown > 0) {
      this.bossWarningText = 'BOSS SWERVING!';
    }
    if (this.bossMoveCooldown <= 0) {
      this.bossMoveCooldown = 2.4 + Math.random() * 1.4;
      this.bossWarningText = null;
      // Pick lane near player or adjacent open lane
      const shift = Math.random() > 0.35 ? Math.sign(this.playerX - this.bossX) || 1 : (Math.random() > 0.5 ? 1 : -1);
      this.bossLane = Math.max(0, Math.min(LANE_COUNT - 1, this.bossLane + shift));
    }

    const targetBossX = getLaneCenterX(this.bossLane);
    this.bossX = THREE.MathUtils.damp(this.bossX, targetBossX, 4.5, dt);

    // Nitro pushes the boss farther ahead
    const desiredBossZ = this.nitroActive ? -32 : -15 - Math.sin(performance.now() * 0.002) * 4;
    this.bossZ = THREE.MathUtils.damp(this.bossZ, desiredBossZ, 2.5, dt);

    this.bossRig.group.position.set(this.bossX, 0, this.bossZ);
    for (const w of this.bossRig.wheels) {
      w.rotation.x -= moveDz * 2.4;
    }

    const blink = Math.floor(performance.now() / 120) % 2 === 0;
    this.bossRig.beaconLeft.visible = blink;
    this.bossRig.beaconRight.visible = !blink;

    // Boss collision check
    if (this.bossHitCooldown <= 0) {
      const dx = Math.abs(this.bossX - this.playerX);
      const dz = Math.abs(this.bossZ);
      if (dx < 1.85 && dz < 4.4) {
        this.bossHitCooldown = 1.6;
        if (this.shieldRemaining > 0) {
          this.shieldRemaining = 0;
          this.spawnSparks(this.bossX, 0.9, this.bossZ, 26);
          audioEngine.playShieldBreak();
          this.pushNotification('SHIELD DEFLECTED BOSS RAM', 'cyan');
        } else {
          const dmg = Math.max(10, Math.round(25 * (1 - damageResistance)));
          this.applyDamageToPlayer(dmg, 'heavy', 'BOSS IMPACT');
        }
      }
    }

    if (this.bossTimer <= 0) {
      this.bossActive = false;
      this.bossEscapedThisRun = true;
      this.bossRig.group.visible = false;
      this.bossWarningText = null;
      const bossMeta = getBossById(this.activeBossType);
      this.runCoins += bossMeta.rewardCoins;
      this.modeBonusClaimed = true;
      audioEngine.playUnlock();
      this.triggerHaptic([40, 40, 100]);
      this.pushNotification(`ESCAPED BOSS · +${bossMeta.rewardCoins} COINS!`, 'emerald');
    }
  }

  private isLaneClearAtZ(lane: number, zMin: number, zMax: number): boolean {
    for (const t of this.trafficPool) {
      if (!t.active) continue;
      if (t.lane === lane || t.targetLane === lane) {
        if (t.z + t.rig.halfLength + 12 >= zMin && t.z - t.rig.halfLength - 12 <= zMax) {
          return false;
        }
      }
    }
    return true;
  }

  private spawnFairTrafficWave(difficultyScale: number): void {
    return;
  }
      slot.rig.signalLeft.visible = false;
      slot.rig.signalRight.visible = false;

      const typeSpeed =
        slot.type === 'supercar' || slot.type === 'sports'
          ? 36 + Math.random() * 10
          : slot.type === 'motorbike'
            ? 38 + Math.random() * 12
            : slot.type === 'truck' || slot.type === 'bus' || slot.type === 'limousine'
              ? 21 + Math.random() * 6
              : 26 + Math.random() * 9;
      slot.speed = typeSpeed * (0.9 + difficultyScale * 0.14);

      slot.laneChangeTimer =
        this.distanceM > 320 && Math.random() < 0.28 ? 1.8 + Math.random() * 2.0 : -1;

      slot.rig.group.position.set(slot.x, 0, slot.z);
      slot.rig.group.rotation.set(0, 0, 0);
      slot.rig.group.visible = true;
      spawned++;
    }
  }

  private findInactiveTraffic(): PooledTraffic | null {
    const start = Math.floor(Math.random() * this.trafficPool.length);
    for (let i = 0; i < this.trafficPool.length; i++) {
      const item = this.trafficPool[(start + i) % this.trafficPool.length];
      if (!item.active) return item;
    }
    return null;
  }

  private spawnCoinArc(): void {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const zBase = -320 - Math.random() * 40;
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const zPos = zBase - i * 4.5;
      if (!this.isLaneClearAtZ(lane, zPos - 5, zPos + 5)) continue;
      const coin = this.coinPool.find((c) => !c.active);
      if (!coin) break;
      coin.active = true;
      coin.x = getLaneCenterX(lane);
      coin.z = zPos;
      coin.mesh.position.set(coin.x, 0.95, coin.z);
      coin.mesh.visible = true;
    }
  }

  private spawnRepairOrPowerUp(): void {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const zPos = -335 - Math.random() * 30;
    if (!this.isLaneClearAtZ(lane, zPos - 14, zPos + 14)) return;

    const repairChance = this.health < 45 ? 0.52 : 0.34;
    if (Math.random() < repairChance) {
      const roll = Math.random();
      let desiredTier: RepairPickupTier = 'small';
      if (roll > 0.96) desiredTier = 'legendary';
      else if (roll > 0.83) desiredTier = 'large';
      else if (roll > 0.55) desiredTier = 'medium';

      const slot =
        this.repairPool.find((r) => !r.active && r.tier === desiredTier) ??
        this.repairPool.find((r) => !r.active);
      if (!slot) return;
      slot.active = true;
      slot.x = getLaneCenterX(lane);
      slot.z = zPos;
      slot.mesh.position.set(slot.x, 1.1, slot.z);
      slot.mesh.visible = true;
    } else {
      const desiredTypes: PowerUpType[] = this.bossActive
        ? ['nitro', 'shield', 'nitro', 'slow_mo', 'emergency_repair']
        : ['nitro', 'magnet', 'shield', 'slow_mo', 'emergency_repair'];
      const pick = desiredTypes[Math.floor(Math.random() * desiredTypes.length)];
      const slot =
        this.powerUpPool.find((p) => !p.active && p.type === pick) ??
        this.powerUpPool.find((p) => !p.active);
      if (!slot) return;
      slot.active = true;
      slot.x = getLaneCenterX(lane);
      slot.z = zPos;
      slot.mesh.position.set(slot.x, 1.15, slot.z);
      slot.mesh.visible = true;
    }
  }

  private updateTraffic(
    dt: number,
    playerDz: number,
    slowScale: number,
    damageResistance: number,
  ): void {
    for (const t of this.trafficPool) {
      t.active = false;
      t.rig.group.visible = false;
    }
  }

      const wheelRot = t.speed * slowScale * dt * 2.1;
      for (const w of t.rig.wheels) {
        w.rotation.x += wheelRot;
      }

      if (t.laneChangeTimer > 0 && t.z < -45 && t.z > -220) {
        t.laneChangeTimer -= dt * slowScale;
        if (t.laneChangeTimer <= 1.0 && t.telegraphingDir === 0) {
          const tryDir = Math.random() > 0.5 ? 1 : -1;
          const nextL = t.lane + tryDir;
          if (
            nextL >= 0 &&
            nextL < LANE_COUNT &&
            this.isLaneClearAtZ(nextL, t.z - 22, t.z + 22)
          ) {
            t.telegraphingDir = tryDir as -1 | 1;
          } else {
            t.laneChangeTimer = -1;
          }
        }
        if (t.telegraphingDir !== 0) {
          const blink = Math.floor(performance.now() / 130) % 2 === 0;
          t.rig.signalLeft.visible = t.telegraphingDir < 0 && blink;
          t.rig.signalRight.visible = t.telegraphingDir > 0 && blink;
        }
        if (t.laneChangeTimer <= 0 && t.telegraphingDir !== 0) {
          t.targetLane = Math.max(0, Math.min(LANE_COUNT - 1, t.lane + t.telegraphingDir));
          t.lane = t.targetLane;
          t.telegraphingDir = 0;
          t.rig.signalLeft.visible = false;
          t.rig.signalRight.visible = false;
        }
      }

      const targetX = getLaneCenterX(t.targetLane);
      t.x = THREE.MathUtils.damp(t.x, targetX, 6.5, dt * slowScale);
      t.rig.group.position.set(t.x, 0, t.z);

      if (!t.collided) {
        const dx = Math.abs(t.x - this.playerX);
        const dz = Math.abs(t.z);
        const abId = getCarById(this.activeCarId).ability.id;
        const nearMissCorridor = abId === 'steady_grip' ? LANE_WIDTH * 1.35 : LANE_WIDTH * 1.18;
        if (dx < pHalfW + t.rig.halfWidth && dz < pHalfL + t.rig.halfLength) {
          t.collided = true;
          this.handleTrafficCollision(t, dx, damageResistance);
        } else if (!t.nearMissed && t.z > pHalfL + t.rig.halfLength + 0.5) {
          if (dx < nearMissCorridor) {
            t.nearMissed = true;
            this.triggerNearMiss();
          }
        }
      }

      if (t.z > 28) {
        t.active = false;
        t.rig.group.visible = false;
      }
    }
  }

  private applyDamageToPlayer(
    finalDamage: number,
    severity: 'small' | 'medium' | 'heavy',
    label: string,
  ): void {
    this.health = Math.max(0, this.health - finalDamage);
    this.damageCooldown = 1.15;
    this.damageFlash = 1.0;
    this.noDamageRunDist = 0;
    this.crashesTaken += 1;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.nitroActive = false;

    const abId = getCarById(this.activeCarId).ability.id;
    const rawSpeedDrop = severity === 'heavy' ? 0.55 : severity === 'medium' ? 0.72 : 0.86;
    const speedKeep = abId === 'titanium_armor' ? 1 - (1 - rawSpeedDrop) * 0.5 : rawSpeedDrop;
    this.speedUnits *= speedKeep;
    this.cameraShake = severity === 'heavy' ? 1.15 : severity === 'medium' ? 0.7 : 0.35;
    this.hitstopTimer = severity === 'heavy' ? 0.055 : 0.03;

    audioEngine.playCrash(severity);
    this.triggerHaptic(severity === 'heavy' ? [60, 30, 90] : severity === 'medium' ? 45 : 25);
    this.pushNotification(`${label} · -${finalDamage} HP`, 'rose');

    if (this.health <= 0) {
      this.triggerCrashGameOver();
    } else {
      this.emitHud();
    }
  }

  private handleTrafficCollision(
    t: PooledTraffic,
    lateralOverlapDist: number,
    damageResistance: number,
  ): void {
    const abId = getCarById(this.activeCarId).ability.id;
    const ghostPhaseActive =
      this.abilityActiveRemaining > 0 &&
      (abId === 'phase_ghost' || abId === 'phantom_blink' || abId === 'sovereign_zenith');
    if (ghostPhaseActive) {
      this.score += 100;
      this.triggerNearMiss();
      return;
    }

    const ramBarrierActive =
      this.abilityActiveRemaining > 0 && (abId === 'shockwave_ram' || abId === 'vip_convoy');
    if (ramBarrierActive) {
      this.smashes += 1;
      const ramCoins = abId === 'shockwave_ram' ? 60 : 45;
      this.runCoins += ramCoins;
      this.score += 300;
      this.spawnSparks(t.x, 0.85, t.z, 32);
      t.active = false;
      t.rig.group.visible = false;
      this.cameraShake = 0.45;
      audioEngine.playShieldBreak();
      this.triggerHaptic(32);
      this.pushNotification(`ABILITY SMASH · +${ramCoins} COINS`, 'amber');
      this.emitHud();
      return;
    }

    if (this.shieldRemaining > 0) {
      this.shieldRemaining = 0;
      this.smashes += 1;
      this.runCoins += 40;
      this.score += 250;
      this.spawnSparks(t.x, 0.85, t.z, 32);
      t.active = false;
      t.rig.group.visible = false;
      this.cameraShake = 0.55;
      this.hitstopTimer = 0.04;
      audioEngine.playShieldBreak();
      this.triggerHaptic(35);
      this.pushNotification('SHIELD SMASH · +40 COINS', 'cyan');
      this.emitHud();
      return;
    }

    if (this.damageCooldown > 0) {
      t.active = false;
      t.rig.group.visible = false;
      this.spawnSparks(t.x, 0.7, t.z, 14);
      return;
    }

    const speedKmh = this.speedUnits * 3.6;
    let baseDamage = 20;
    let severity: 'small' | 'medium' | 'heavy' = 'medium';
    let label = 'COLLISION';

    const isHeavyVehicle = t.type === 'truck' || t.type === 'bus' || t.type === 'limousine';
    if (lateralOverlapDist > 1.05 && !this.nitroActive && !isHeavyVehicle) {
      baseDamage = 10;
      severity = 'small';
      label = 'MINOR SCRAPE';
    } else if ((speedKmh >= 300 || (isHeavyVehicle && speedKmh >= 220)) && lateralOverlapDist < 0.55) {
      baseDamage = 50;
      severity = 'heavy';
      label = 'SEVERE CRASH';
    } else if (speedKmh >= 245 || this.nitroActive || lateralOverlapDist < 0.45) {
      baseDamage = 35;
      severity = 'heavy';
      label = 'HIGH-SPEED CRASH';
    }

    const finalDamage = Math.max(5, Math.round(baseDamage * (1 - damageResistance)));
    this.spawnSparks((this.playerX + t.x) * 0.5, 0.85, t.z * 0.5, severity === 'heavy' ? 36 : 20);
    t.active = false;
    t.rig.group.visible = false;

    this.applyDamageToPlayer(finalDamage, severity, label);
  }

  private triggerNearMiss(): void {
    this.nearMisses += 1;
    this.comboCount = Math.min(5, this.comboCount + 1);
    this.comboTimer = 4.0;
    if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

    const abId = getCarById(this.activeCarId).ability.id;
    let bonusCoins = 5 * this.comboCount;
    let bonusScore = 50 * this.comboCount;
    if (abId === 'quick_snap') bonusCoins = Math.round(bonusCoins * 1.25);
    if (abId === 'track_precision' && this.comboCount >= 2) {
      bonusCoins *= 2;
      bonusScore *= 2;
    }
    if (abId === 'slipstream') {
      this.nitroAmount = Math.min(1, this.nitroAmount + 0.14);
    }

    this.runCoins += bonusCoins;
    this.score += bonusScore;

    if (this.tutorialStep === 2) {
      this.tutorialStep = -1;
      this.callbacks.onTutorialComplete();
    }

    audioEngine.playNearMiss(this.comboCount);
    this.triggerHaptic(18);
    this.pushNotification(
      this.comboCount > 1
        ? `NEAR MISS x${this.comboCount} · +${bonusCoins} COINS`
        : `NEAR MISS · +${bonusCoins} COINS`,
      'amber',
    );
  }

  private updateCoins(dt: number, playerDz: number, coinMultiplier: number): void {
    const abId = getCarById(this.activeCarId).ability.id;
    const magnetOn = this.magnetRemaining > 0;
    const apexAura = abId === 'apex_magnet';
    const coinAbilityMult =
      abId === 'vip_convoy'
        ? 1.35
        : abId === 'phantom_blink' && this.abilityActiveRemaining > 0
          ? 2.0
          : 1.0;

    for (const c of this.coinPool) {
      if (!c.active) continue;
      c.z += playerDz;
      c.mesh.rotation.y += dt * 4.2;

      if (magnetOn && c.z > -44 && c.z < 5) {
        c.x = THREE.MathUtils.damp(c.x, this.playerX, 11, dt);
        c.z = THREE.MathUtils.damp(c.z, 0, 7, dt);
      } else if (apexAura && c.z > -22 && c.z < 4 && Math.abs(c.x - this.playerX) < 3.6) {
        c.x = THREE.MathUtils.damp(c.x, this.playerX, 9, dt);
      }

      c.mesh.position.set(c.x, 0.95 + Math.sin(performance.now() * 0.005 + c.z) * 0.12, c.z);

      if (Math.abs(c.x - this.playerX) < 1.7 && Math.abs(c.z) < 2.6) {
        c.active = false;
        c.mesh.visible = false;
        const val = Math.max(1, Math.round(5 * coinMultiplier * coinAbilityMult));
        this.runCoins += val;
        this.score += 20;
        audioEngine.playCoin(this.comboCount + 1);
      } else if (c.z > 20) {
        c.active = false;
        c.mesh.visible = false;
      }
    }
  }

  private updateRepairs(dt: number, playerDz: number, repairEfficiency: number): void {
    for (const r of this.repairPool) {
      if (!r.active) continue;
      r.z += playerDz;
      r.mesh.rotation.y += dt * 2.8;
      r.mesh.position.set(r.x, 1.15 + Math.sin(performance.now() * 0.004) * 0.16, r.z);

      if (Math.abs(r.x - this.playerX) < 1.9 && Math.abs(r.z) < 2.7) {
        r.active = false;
        r.mesh.visible = false;
        this.repairsCollected += 1;
        const baseHeal =
          r.tier === 'legendary' ? 100 : r.tier === 'large' ? 50 : r.tier === 'medium' ? 25 : 10;
        const finalHeal = r.tier === 'legendary' ? 100 : Math.round(baseHeal * repairEfficiency);
        this.health = Math.min(this.maxHealth, this.health + finalHeal);
        audioEngine.playRepair(r.tier);
        this.triggerHaptic([20, 20, 40]);
        this.pushNotification(
          r.tier === 'legendary'
            ? 'LEGENDARY REPAIR · FULL 100% HP'
            : `REPAIR KIT · +${finalHeal} HP`,
          'emerald',
        );
        this.emitHud();
      } else if (r.z > 20) {
        r.active = false;
        r.mesh.visible = false;
      }
    }
  }

  private updatePowerUps(dt: number, playerDz: number, repairEfficiency: number): void {
    for (const p of this.powerUpPool) {
      if (!p.active) continue;
      p.z += playerDz;
      p.mesh.rotation.y += dt * 3.1;
      p.mesh.position.set(p.x, 1.2 + Math.cos(performance.now() * 0.004) * 0.16, p.z);

      if (Math.abs(p.x - this.playerX) < 1.9 && Math.abs(p.z) < 2.7) {
        p.active = false;
        p.mesh.visible = false;
        this.activatePowerUp(p.type, repairEfficiency);
      } else if (p.z > 20) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  private activatePowerUp(type: PowerUpType, repairEfficiency: number): void {
    audioEngine.playPowerUp(type);
    this.triggerHaptic(24);
    if (type === 'nitro') {
      this.nitroAmount = 1.0;
      this.nitroActive = true;
      this.nitroUses += 1;
      audioEngine.playNitroStart();
      this.pushNotification('NITRO SURGE · FULL TANK', 'cyan');
    } else if (type === 'magnet') {
      this.magnetRemaining = 8.5;
      this.pushNotification('COIN MAGNET · 8.5s', 'amber');
    } else if (type === 'shield') {
      this.shieldRemaining = 10.0;
      this.pushNotification('ENERGY SHIELD · 10s', 'cyan');
    } else if (type === 'slow_mo') {
      this.slowMoRemaining = 6.5;
      this.pushNotification('SLOW MOTION · TRAFFIC DAMPENED', 'cyan');
    } else if (type === 'emergency_repair') {
      const heal = Math.round(30 * repairEfficiency);
      this.health = Math.min(this.maxHealth, this.health + heal);
      this.damageCooldown = Math.max(this.damageCooldown, 2.0);
      this.repairsCollected += 1;
      this.pushNotification(`EMERGENCY REPAIR · +${heal} HP`, 'emerald');
    }
    this.emitHud();
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.kind === 'spark') p.vy -= 22 * dt;
        }
      }

      if (i < 80) {
        const k = i * 3;
        if (p.active) {
          this.sparkPositions[k] = p.x;
          this.sparkPositions[k + 1] = p.y;
          this.sparkPositions[k + 2] = p.z;
        } else {
          this.sparkPositions[k] = -9999;
          this.sparkPositions[k + 1] = -9999;
          this.sparkPositions[k + 2] = -9999;
        }
      } else {
        const k = (i - 80) * 3;
        if (p.active) {
          this.smokePositions[k] = p.x;
          this.smokePositions[k + 1] = p.y;
          this.smokePositions[k + 2] = p.z;
        } else {
          this.smokePositions[k] = -9999;
          this.smokePositions[k + 1] = -9999;
          this.smokePositions[k + 2] = -9999;
        }
      }
    }
    this.sparkPoints.geometry.attributes.position.needsUpdate = true;
    this.smokePoints.geometry.attributes.position.needsUpdate = true;
  }

  private updateFollowCamera(dt: number, applySpeedFov: boolean): void {
    const preset: CameraPreset = this.settings.cameraPreset;
    const targetY = preset === 'low' ? 2.45 : preset === 'high' ? 6.6 : 4.1;
    const targetZ = preset === 'low' ? 6.4 : preset === 'high' ? 11.4 : 8.4;
    const lookAheadZ = preset === 'low' ? -22 : -18;

    const shakeX = (Math.random() - 0.5) * this.cameraShake * 0.9;
    const shakeY = (Math.random() - 0.5) * this.cameraShake * 0.65;

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      this.playerX * 0.76 + shakeX,
      8.5,
      dt,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      targetY + shakeY,
      8.5,
      dt,
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      targetZ,
      8.5,
      dt,
    );

    if (applySpeedFov) {
      const desiredFov = this.nitroActive
        ? 78
        : 62 + THREE.MathUtils.clamp((this.speedUnits * 3.6 - 160) / 200, 0, 1) * 11;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, 5.5, dt);
      this.camera.updateProjectionMatrix();
    }

    _tmpVec.set(this.playerX * 0.85, 1.05, lookAheadZ);
    this.camera.lookAt(_tmpVec);
  }

  private triggerCrashGameOver(): void {
    if (this.crashPendingSummary) return;
    this.crashPendingSummary = true;
    this.crashSlowMoTimer = 0.95;
    this.nitroActive = false;
    this.braking = false;
    if (this.playerRig) {
      this.playerRig.group.visible = true;
    }
    audioEngine.stopEngine();
    audioEngine.playGameOver();
    this.emitHud();
  }

  private finishRunAndReport(): void {
    this.crashPendingSummary = false;
    const modeDef = getModeById(this.activeModeId);
    const dist = Math.round(this.distanceM);
    const modeBonus =
      this.activeModeId === 'traffic_challenge' && this.modeBonusClaimed
        ? 800
        : this.activeModeId === 'time_trial' && this.modeBonusClaimed
          ? 650
          : 0;
    const xpEarned = Math.round(
      (dist * 0.08 + this.nearMisses * 14 + this.smashes * 18 + (this.bossEscapedThisRun ? 450 : 0)) *
        modeDef.xpMultiplier,
    );

    const summary: RunSummary = {
      distance: dist,
      score: Math.round(this.score),
      coinsEarned: this.runCoins,
      nearMisses: this.nearMisses,
      maxCombo: this.maxCombo,
      maxSpeedKmh: this.maxSpeedKmh,
      xpEarned,
      smashes: this.smashes,
      repairsCollected: this.repairsCollected,
      nitroUses: this.nitroUses,
      nitroSeconds: this.nitroSecondsUsed,
      survivalSeconds: this.survivalSeconds,
      maxNoDamageDistance: this.maxNoDamageDist,
      crashesTaken: this.crashesTaken,
      bossEscaped: this.bossEscapedThisRun,
      isNewBestDistance: false,
      isNewHighScore: false,
      modeCompleted: this.modeBonusClaimed,
      modeBonusCoins: modeBonus,
      worldId: this.activeWorldId,
      modeId: this.activeModeId,
      carId: this.activeCarId,
    };
    this.callbacks.onGameOver(summary);
  }

  private emitHud(): void {
    const modeDef = getModeById(this.activeModeId);
    const worldDef = getWorldById(this.activeWorldId);
    const bossMeta = getBossById(this.activeBossType);

    let modeProgressLabel: string | null = null;
    if (this.activeModeId === 'traffic_challenge') {
      modeProgressLabel = `${Math.min(Math.round(this.distanceM), modeDef.targetDistanceM ?? 1500)}m / ${modeDef.targetDistanceM}m · ${Math.min(this.nearMisses, modeDef.targetNearMisses ?? 15)}/${modeDef.targetNearMisses} Near Miss`;
    } else if (this.activeModeId === 'time_trial') {
      modeProgressLabel = `Target: ${Math.min(Math.round(this.distanceM), modeDef.targetDistanceM ?? 1800)}m / ${modeDef.targetDistanceM}m`;
    } else if (this.activeModeId === 'coin_rush') {
      modeProgressLabel = '2x Highway Coins Active';
    }

    const healthStage: LiveHudSnapshot['healthStage'] =
      this.health >= 75
        ? 'normal'
        : this.health >= 50
          ? 'minor'
          : this.health >= 25
            ? 'warning'
            : 'critical';

    const boss: BossHudState = {
      active: this.bossActive,
      bossName: bossMeta.name,
      bossType: this.activeBossType,
      remainingSec: Math.max(0, Math.ceil(this.bossTimer)),
      totalSec: this.bossTotalDuration,
      warningText: this.bossWarningText,
    };

    const carDef = getCarById(this.activeCarId);
    const ab = carDef.ability;

    this.callbacks.onHudUpdate({
      health: this.health,
      maxHealth: this.maxHealth,
      healthStage,
      speedKmh: Math.round(this.speedUnits * 3.6),
      distanceM: Math.round(this.distanceM),
      score: Math.round(this.score),
      runCoins: this.runCoins,
      nitroRatio: this.nitroAmount,
      nitroActive: this.nitroActive,
      braking: this.braking,
      comboCount: this.comboCount,
      comboTimerRatio: Math.max(0, this.comboTimer / 4.0),
      nearMisses: this.nearMisses,
      timeRemainingSec:
        this.timeRemainingSec !== null ? Math.ceil(this.timeRemainingSec) : null,
      modeProgressLabel,
      worldLabel: worldDef.name,
      damageFlash: this.damageFlash,
      lowHealthWarning: this.health > 0 && this.health <= 24,
      activePowerUps: {
        magnetRemaining: this.magnetRemaining,
        magnetDuration: 8.5,
        shieldRemaining: this.shieldRemaining,
        shieldDuration: 10.0,
        slowMoRemaining: this.slowMoRemaining,
        slowMoDuration: 6.5,
      },
      ability: {
        id: ab.id,
        name: ab.name,
        mode: ab.mode,
        activeRemaining: this.abilityActiveRemaining,
        durationSec: ab.durationSec,
        cooldownRemaining: this.abilityCooldownRemaining,
        cooldownSec: ab.cooldownSec,
        ready: ab.mode === 'active' && this.abilityActiveRemaining <= 0 && this.abilityCooldownRemaining <= 0,
        accentHex: ab.accentHex,
      },
      boss,
      tutorialStep: this.tutorialStep,
      canRevive: !this.revivedThisRun,
      notifications: this.notifications,
    });
  }

  private handleResize = (): void => {
    if (this.disposed || !this.renderer || !this.camera || !this.container) return;
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.viewMode !== 'showroom') return;
    this.showroomDragging = true;
    this.showroomLastX = e.clientX;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.showroomDragging || this.viewMode !== 'showroom') return;
    const dx = e.clientX - this.showroomLastX;
    this.showroomLastX = e.clientX;
    this.showroomAngle += dx * 0.012;
  };

  private handlePointerUp = (): void => {
    this.showroomDragging = false;
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    audioEngine.stopEngine();
    audioEngine.stopMusic();

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);

    this.highwayRig?.dispose();
    if (this.playerRig) this.disposeObject3D(this.playerRig.group);
    if (this.showroomCarRig) this.disposeObject3D(this.showroomCarRig.group);
    if (this.bossRig) this.disposeObject3D(this.bossRig.group);
    this.disposeObject3D(this.showroomGroup);
    for (const t of this.trafficPool) this.disposeObject3D(t.rig.group);
    for (const c of this.coinPool) this.disposeObject3D(c.mesh);
    for (const r of this.repairPool) this.disposeObject3D(r.mesh);
    for (const p of this.powerUpPool) this.disposeObject3D(p.mesh);

    this.scene.environment?.dispose();
    this.shadowTex.dispose();
    this.showroomFloorTex.dispose();
    this.sparkPoints.geometry.dispose();
    (this.sparkPoints.material as THREE.Material).dispose();
    this.smokePoints.geometry.dispose();
    (this.smokePoints.material as THREE.Material).dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
