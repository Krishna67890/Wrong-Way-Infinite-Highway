import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audioEngine } from './audio';
import {
  getCarById,
  getEffectiveCarStats,
  getModeById,
  getWorldById,
  WORLDS,
} from './data';
import {
  buildCoinModel,
  buildPlayerCarModel,
  buildPowerUpModel,
  buildRepairPickupModel,
  buildTrafficVehicleModel,
  PlayerCarRig,
  TrafficVehicleRig,
} from './models';
import {
  createContactShadowTexture,
  createShowroomFloorTexture,
  getLaneCenterX,
  LANE_COUNT,
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
  StuntRampType,
  TrafficVehicleType,
  WorldId,
} from './types';
import { buildHighwayEnvironment, HighwayEnvironmentRig } from './worldBuilder';

export type EngineViewMode = 'highway_attract' | 'gameplay' | 'paused' | 'showroom';

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

interface PooledTraffic {
  active: boolean;
  type: TrafficVehicleType;
  rig: TrafficVehicleRig;
  lane: number;
  targetLane: number;
  x: number;
  z: number;
  speedUnits: number;
  nearMissed: boolean;
  smashed: boolean;
  smashVx: number;
  smashSpin: number;
  laneShiftAttempted: boolean;
  signalTimer: number;
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
  private resizeObserver: ResizeObserver | null = null;

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

  private nextBiomeTransitionM = 1200;

  // Object Pools (Traffic, Coins, Repairs, PowerUps & Particles)
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
  private smashes = 0;
  private stuntJumps = 0;
  private maxCombo = 0;
  private maxSpeedKmh = 0;
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

  private tutorialStep = -1; // 0: steer, 1: nitro, 2: near miss / stunt ramp, -1: done

  private trafficSpawnTimer = 0;
  private coinSpawnTimer = 0;
  private pickupSpawnTimer = 0;
  private smokeEmitTimer = 0;
  private hudEmitAccum = 0;
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
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);

    this.lastTimestamp = performance.now();
    this.scheduleNextTick();
  }

  private initPools(): void {
    const trafficTypes: TrafficVehicleType[] = [
      'sedan',
      'suv',
      'sports',
      'van',
      'police',
      'sedan',
      'supercar',
      'ambulance',
      'truck',
      'motorbike',
      'sedan',
      'bus',
      'suv',
      'fire_truck',
      'sports',
      'limousine',
      'van',
      'sedan',
      'police',
      'suv',
      'motorbike',
      'sports',
      'supercar',
      'ambulance',
      'sedan',
      'van',
      'truck',
      'suv',
      'sports',
      'bus',
      'police',
      'sedan',
      'fire_truck',
      'motorbike',
    ];
    for (const type of trafficTypes) {
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
        speedUnits: 20,
        nearMissed: false,
        smashed: false,
        smashVx: 0,
        smashSpin: 0,
        laneShiftAttempted: false,
        signalTimer: 0,
      });
    }

    for (let i = 0; i < 80; i++) {
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
    if (this.highwayRig) {
      for (const seg of this.highwayRig.segments) {
        seg.rampTriggered = false;
        seg.hoopTriggered = false;
      }
    }

    this.nextBiomeTransitionM = 1200;

    this.targetLane = 2;
    this.playerX = getLaneCenterX(2);
    this.prevPlayerX = this.playerX;
    this.playerRoll = 0;
    this.playerYaw = 0;
    this.playerY = 0;
    this.playerYVel = 0;
    this.playerPitch = 0;

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
    this.smashes = 0;
    this.stuntJumps = 0;
    this.maxCombo = 0;
    this.maxSpeedKmh = 0;
    this.repairsCollected = 0;

    this.damageCooldown = 1.2;
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

    this.trafficSpawnTimer = 0.4;
    this.coinSpawnTimer = 0.55;
    this.pickupSpawnTimer = 4.2;
    this.smokeEmitTimer = 0;
    this.notifications = [];

    if (this.playerRig) {
      this.playerRig.group.position.set(this.playerX, 0, 0);
      this.playerRig.group.rotation.set(0, 0, 0);
      this.playerRig.group.visible = true;
      this.playerRig.damageOverlays.forEach((d) => (d.visible = false));
    }

    this.setViewMode('gameplay');
    // Immediately populate initial oncoming traffic waves ahead so wrong-way driving starts right away
    this.spawnFairTrafficWave(-155, 2);
    this.spawnFairTrafficWave(-245, -1);
    this.emitHud();
  }

  public finishCurrentRun(): void {
    this.nitroActive = false;
    this.braking = false;
    audioEngine.stopEngine();
    this.finishRunAndReport();
  }

  public reviveRun(): void {
    this.revivedThisRun = true;
    this.crashPendingSummary = false;
    this.crashSlowMoTimer = 0;
    this.notifications = [];
    this.health = 65;
    this.damageCooldown = 2.6;
    this.shieldRemaining = Math.max(this.shieldRemaining, 2.8);
    if (this.timeRemainingSec !== null && this.timeRemainingSec <= 0) {
      this.timeRemainingSec = 22;
    }
    // Clear nearby oncoming vehicles so reviving never causes an instant double-crash
    for (const v of this.trafficPool) {
      if (v.active && v.z > -95 && v.z < 28) {
        v.active = false;
        v.rig.group.visible = false;
      }
    }
    if (this.playerRig) {
      this.playerRig.group.rotation.set(0, 0, 0);
      this.playerRig.group.visible = true;
      this.playerRig.damageOverlays.forEach((d, idx) => (d.visible = idx === 0));
    }
    this.setViewMode('gameplay');
    this.pushNotification('REVIVED · +65 HP & CLEAR ROAD', 'cyan');
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
      this.nitroActive = true;
      this.magnetRemaining = Math.max(this.magnetRemaining, ab.durationSec);
    } else if (ab.id === 'quad_overdrive' || ab.id === 'fire_chief_ghost') {
      this.nitroAmount = 1.0;
      this.nitroActive = true;
      if (ab.id === 'quad_overdrive') {
        this.shieldRemaining = Math.max(this.shieldRemaining, ab.durationSec);
      }
    } else if (ab.id === 'phantom_blink') {
      this.magnetRemaining = Math.max(this.magnetRemaining, ab.durationSec);
    } else if (ab.id === 'emp_pulse' || ab.id === 'police_emp') {
      this.nitroAmount = 1.0;
      this.nitroActive = true;
      this.magnetRemaining = Math.max(this.magnetRemaining, ab.durationSec);
    } else if (ab.id === 'shockwave_ram') {
      this.score += 450;
      this.magnetRemaining = Math.max(this.magnetRemaining, ab.durationSec);
    } else if (ab.id === 'fire_shield') {
      this.health = Math.min(this.maxHealth, this.health + 10);
      this.shieldRemaining = Math.max(this.shieldRemaining, ab.durationSec);
    } else if (ab.id === 'vip_convoy') {
      this.shieldRemaining = Math.max(this.shieldRemaining, ab.durationSec);
    }

    this.pushNotification(`${ab.name.toUpperCase()} ACTIVATED!`, 'cyan');
    this.emitHud();
  }

  private hideAllPoolItems(): void {
    for (const v of this.trafficPool) {
      v.active = false;
      v.rig.group.visible = false;
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
    for (let i = 80; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        p.active = true;
        p.kind = 'smoke';
        p.x = x + (Math.random() - 0.5) * 0.45;
        p.y = y;
        p.z = z;
        p.vx = (Math.random() - 0.5) * 1.4;
        p.vy = 1.6 + Math.random() * 1.8;
        p.vz = 4 + Math.random() * 4;
        p.life = 0;
        p.maxLife = 0.65 + Math.random() * 0.4;
        return;
      }
    }
  }

  private pushNotification(
    text: string,
    tone: HudNotification['tone'],
    durationSec = 1.8,
  ): void {
    this.notifications = [
      ...this.notifications.slice(-2),
      { id: this.notifCounter++, text, tone, durationSec },
    ];
    this.emitHud();
  }

  private updateNotifications(dt: number): void {
    if (this.notifications.length === 0) return;
    let expired = false;
    this.notifications = this.notifications.filter((n) => {
      n.durationSec -= dt;
      if (n.durationSec <= 0) {
        expired = true;
        return false;
      }
      return true;
    });
    if (expired) {
      this.emitHud();
    }
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
    const aspect = this.camera.aspect || 1.5;
    const portraitBoost = aspect < 1.0 ? Math.min(1, (1.0 - aspect) / 0.55) : 0;
    const pullBack = 7.2 + portraitBoost * 4.4;
    const showroomY = 2.35 + portraitBoost * 0.55;
    const showroomFov = 46 + portraitBoost * 10;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, 0, 6, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, showroomY, 6, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, pullBack, 6, dt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, showroomFov, 6, dt);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, aspect < 0.85 ? -0.35 : 0.45, 0);
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
      this.playerRig.group.position.y = 0;
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

    const aspect = this.camera.aspect || 1.5;
    const portraitBoost = aspect < 1.0 ? Math.min(1, (1.0 - aspect) / 0.55) : 0;
    const camX = Math.sin(this.attractTime * 0.3) * 2.5;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camX, 3, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 4.4 + portraitBoost * 0.8, 3, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 9.5 + portraitBoost * 2.4, 3, dt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 60 + portraitBoost * 12, 4, dt);
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
        seg.rampTriggered = false;
        seg.hoopTriggered = false;
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
    this.updateNotifications(dt);
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
    const phaseSpeedBoost =
      (abId === 'phase_ghost' || abId === 'fire_shield' || abId === 'time_warp') &&
      this.abilityActiveRemaining > 0;

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
    if (phaseSpeedBoost) targetSpeed *= 1.15;

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
    }

    // Seamless biome transition every 1,200m in Endless mode
    if (this.activeModeId === 'endless' && this.distanceM >= this.nextBiomeTransitionM) {
      this.nextBiomeTransitionM += 1200;
      const curIdx = WORLDS.findIndex((w) => w.id === this.activeWorldId);
      const nextWorld = WORLDS[(curIdx + 1) % WORLDS.length];
      this.rebuildWorld(nextWorld.id);
      this.pushNotification(`ENTERING ${nextWorld.name.toUpperCase()}`, 'cyan');
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
        this.pushNotification('WRONG-WAY CONTRACT COMPLETE · +900 COINS', 'emerald');
        audioEngine.playUnlock();
      } else if (
        this.activeModeId === 'stunt_challenge' &&
        modeDef.targetDistanceM &&
        modeDef.targetStuntJumps &&
        this.distanceM >= modeDef.targetDistanceM &&
        this.stuntJumps >= modeDef.targetStuntJumps
      ) {
        this.modeBonusClaimed = true;
        this.pushNotification('STUNT CONTRACT COMPLETE · +800 COINS', 'emerald');
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

    // Interactive Stunt Ramp & Hoop Detection
    if (this.highwayRig) {
      for (const seg of this.highwayRig.segments) {
        if (seg.hasRamp && !seg.rampTriggered && this.playerY <= 0.35) {
          const rampZ = seg.zStart + seg.rampZLocal;
          const rType = seg.rampType ?? 'standard';
          const alignWindow =
            rType === 'dual_ramp'
              ? 3.6
              : abId === 'steady_grip'
                ? 2.3
                : 1.85;
          if (Math.abs(rampZ) < 2.8 && Math.abs(this.playerX - seg.rampX) < alignWindow) {
            seg.rampTriggered = true;
            let launchVel =
              rType === 'super_launch'
                ? 14.2
                : rType === 'dual_ramp'
                  ? 11.2
                  : 9.8;
            if (abId === 'tactical_armor') launchVel += 1.8;
            if (this.nitroActive) launchVel += 3.6;

            this.playerYVel = launchVel;
            this.playerY = 0.08;
            this.triggerStuntJump(rType);
          }
        }
        if (seg.hasHoop && !seg.hoopTriggered && this.playerY > 0.6) {
          const hoopZ = seg.zStart + seg.hoopZLocal;
          if (Math.abs(hoopZ) < 2.8 && Math.abs(this.playerX - seg.hoopX) < 2.8) {
            seg.hoopTriggered = true;
            const hoopScore = seg.rampType === 'super_launch' ? 1200 : 600;
            this.score += hoopScore;
            this.spawnSparks(this.playerX, this.playerY + 0.8, 0, 28);
            audioEngine.playUnlock();
            this.triggerHaptic([20, 20, 35]);
            this.pushNotification(
              seg.rampType === 'super_launch'
                ? 'SUPER HOOP RING CLEAR! +1,200 SCORE'
                : 'AIRBORNE HOOP CLEAR! +600 SCORE',
              'emerald',
            );
          }
        }
      }
    }

    // Stunt Airborne Gravity Physics & Jump Tilt Dynamics
    if (this.playerY > 0 || this.playerYVel > 0) {
      this.playerYVel -= 21 * dt;
      this.playerY += this.playerYVel * dt;
      const targetPitch = THREE.MathUtils.clamp(this.playerYVel * 0.035, -0.28, 0.42);
      this.playerPitch = THREE.MathUtils.damp(this.playerPitch, targetPitch, 12, dt);
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.playerYVel = 0;
        this.playerPitch = 0;
        this.spawnSparks(this.playerX, 0.15, 0, 16);
      }
    }

    const ghostPhaseActive =
      this.abilityActiveRemaining > 0 &&
      (abId === 'phase_ghost' ||
        abId === 'phantom_blink' ||
        abId === 'sovereign_zenith' ||
        abId === 'fire_chief_ghost');

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

      if (this.playerRig.policeBarLights.length === 2) {
        const flash = Math.floor(performance.now() / 130) % 2 === 0;
        this.playerRig.policeBarLights[0].visible = flash;
        this.playerRig.policeBarLights[1].visible = !flash;
      }

      const wheelSpin = moveDz * 2.4;
      for (const w of this.playerRig.wheels) {
        w.rotation.x -= wheelSpin;
      }
    }

    if (this.health < 50 && this.playerRig) {
      this.smokeEmitTimer -= dt;
      if (this.smokeEmitTimer <= 0) {
        this.smokeEmitTimer = this.health < 25 ? 0.06 : 0.14;
        this.spawnSmoke(
          this.playerX + this.playerRig.smokeAnchor.x,
          this.playerY + this.playerRig.smokeAnchor.y,
          this.playerRig.smokeAnchor.z,
        );
      }
    }

    this.headlightSpot.position.set(this.playerX, 1.15 + this.playerY, -2.0);
    this.headlightSpot.target.position.set(this.playerX, 0.2, -38);
    this.headlightSpot.intensity = worldDef.isNight ? 6.5 : 1.8;

    this.scrollRoadSegments(moveDz);
    this.updateWeatherAndSpeedLines(dt, this.speedUnits, this.nitroActive);

    const diffInterval = Math.max(0.55, 1.38 - Math.min(0.68, this.distanceM * 0.00018));
    this.trafficSpawnTimer -= dt;
    if (this.trafficSpawnTimer <= 0) {
      this.trafficSpawnTimer = (diffInterval + Math.random() * 0.45) / modeDef.trafficDensityScale;
      this.spawnFairTrafficWave(-315);
    }

    this.coinSpawnTimer -= dt;
    if (this.coinSpawnTimer <= 0) {
      this.coinSpawnTimer = Math.max(0.45, 1.2 / modeDef.coinSpawnScale);
      this.spawnCoinArc();
    }

    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0) {
      this.pickupSpawnTimer = 5.0 + Math.random() * 4.2;
      this.spawnRepairOrPowerUp();
    }

    const baseRepairMult =
      abId === 'aero_downforce'
        ? carStats.repairEfficiency * 1.35
        : abId === 'medic_siren'
          ? carStats.repairEfficiency * 1.15
          : carStats.repairEfficiency;

    this.updateTraffic(dt, moveDz, speedKmh, ghostPhaseActive);
    this.updateCoins(dt, moveDz, worldDef.coinMultiplier * modeDef.coinMultiplier);
    this.updateRepairs(dt, moveDz, baseRepairMult);
    this.updatePowerUps(dt, moveDz, baseRepairMult);
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

  private isLaneOccupiedNear(lane: number, zCenter: number, minGap = 24): boolean {
    const lx = getLaneCenterX(lane);
    for (const v of this.trafficPool) {
      if (v.active && !v.smashed && Math.abs(v.x - lx) < 2.2 && Math.abs(v.z - zCenter) < minGap) {
        return true;
      }
    }
    return false;
  }

  private spawnFairTrafficWave(zBase = -315, excludedLane = -1): void {
    const modeDef = getModeById(this.activeModeId);
    const maxCars =
      this.distanceM > 1400
        ? 4
        : this.distanceM > 450
          ? 3
          : 2;
    const rawCount = 1 + Math.floor(Math.random() * maxCars);
    const desiredCount = Math.min(
      4,
      Math.max(1, Math.round(rawCount * Math.min(1.4, modeDef.trafficDensityScale))),
    );

    // Shuffle all 6 lanes; always leave at least 2 open escape lanes
    const lanes = [0, 1, 2, 3, 4, 5];
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = lanes[i];
      lanes[i] = lanes[j];
      lanes[j] = tmp;
    }

    let spawned = 0;
    for (const lane of lanes) {
      if (spawned >= desiredCount) break;
      if (lane === excludedLane) continue;
      const laneX = getLaneCenterX(lane);
      const zPos = zBase - Math.random() * 14;
      if (this.isLaneOccupiedNear(lane, zPos, 26)) continue;

      const inactiveList = this.trafficPool.filter((t) => !t.active);
      if (inactiveList.length === 0) break;
      const slot = inactiveList[Math.floor(Math.random() * inactiveList.length)];

      slot.active = true;
      slot.lane = lane;
      slot.targetLane = lane;
      slot.x = laneX;
      slot.z = zPos;
      slot.nearMissed = false;
      slot.smashed = false;
      slot.smashVx = 0;
      slot.smashSpin = 0;
      slot.laneShiftAttempted = false;
      slot.signalTimer = 0;

      const baseTrafficSpeed =
        slot.type === 'bus' || slot.type === 'truck' || slot.type === 'fire_truck'
          ? 17 + Math.random() * 5
          : slot.type === 'supercar' || slot.type === 'sports' || slot.type === 'police'
            ? 26 + Math.random() * 10
            : 21 + Math.random() * 7;
      slot.speedUnits = baseTrafficSpeed + Math.min(8, this.distanceM * 0.0018);

      slot.rig.group.position.set(slot.x, 0, slot.z);
      slot.rig.group.rotation.set(0, 0, 0);
      slot.rig.signalLeft.visible = false;
      slot.rig.signalRight.visible = false;
      slot.rig.group.visible = true;
      spawned++;
    }
  }

  private updateTraffic(
    dt: number,
    playerDz: number,
    speedKmh: number,
    ghostPhaseActive: boolean,
  ): void {
    const carDef = getCarById(this.activeCarId);
    const carStats = this.getCurrentCarStats();
    const abId = carDef.ability.id;
    const playerHalfW = this.playerRig?.halfWidth ?? 0.9;
    const playerHalfL = this.playerRig?.halfLength ?? 2.2;
    const slowFactor = this.slowMoRemaining > 0 ? 0.52 : 1.0;
    const canSmash =
      this.shieldRemaining > 0 ||
      (this.abilityActiveRemaining > 0 &&
        (abId === 'fire_shield' ||
          abId === 'shockwave_ram' ||
          abId === 'vip_convoy' ||
          abId === 'quad_overdrive'));
    const flashOn = Math.floor(performance.now() / 135) % 2 === 0;

    for (const v of this.trafficPool) {
      if (!v.active) continue;

      if (v.smashed) {
        v.x += v.smashVx * dt;
        v.z += playerDz * 0.55 - 24 * dt;
        v.rig.group.position.x = v.x;
        v.rig.group.position.y = Math.max(0, v.rig.group.position.y + 4.5 * dt);
        v.rig.group.position.z = v.z;
        v.rig.group.rotation.y += v.smashSpin * dt;
        v.rig.group.rotation.z += v.smashSpin * 0.4 * dt;
        if (v.z > 25 || Math.abs(v.x) > 28) {
          v.active = false;
          v.rig.group.visible = false;
        }
        continue;
      }

      v.z += playerDz + v.speedUnits * dt * slowFactor;

      // Occasional signaled lane change on higher distance runs (only cars/SUVs)
      if (
        !v.laneShiftAttempted &&
        this.distanceM > 700 &&
        v.z > -145 &&
        v.z < -75 &&
        v.type !== 'bus' &&
        v.type !== 'truck' &&
        v.type !== 'fire_truck' &&
        v.type !== 'limousine' &&
        Math.random() < 0.015
      ) {
        v.laneShiftAttempted = true;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const candidateLane = v.lane + dir;
        if (
          candidateLane >= 0 &&
          candidateLane < LANE_COUNT &&
          !this.isLaneOccupiedNear(candidateLane, v.z, 28)
        ) {
          v.targetLane = candidateLane;
          v.signalTimer = 0.6;
        }
      }

      if (v.signalTimer > 0) {
        v.signalTimer -= dt;
        const blink = Math.floor(v.signalTimer * 10) % 2 === 0;
        v.rig.signalLeft.visible = v.targetLane < v.lane && blink;
        v.rig.signalRight.visible = v.targetLane > v.lane && blink;
      } else if (v.targetLane !== v.lane) {
        v.rig.signalLeft.visible = false;
        v.rig.signalRight.visible = false;
        const destX = getLaneCenterX(v.targetLane);
        v.x = THREE.MathUtils.damp(v.x, destX, 5.5, dt);
        if (Math.abs(v.x - destX) < 0.08) {
          v.lane = v.targetLane;
        }
      }

      v.rig.group.position.set(v.x, 0, v.z);
      for (const w of v.rig.wheels) {
        w.rotation.x += v.speedUnits * dt * 2.2;
      }
      if (v.rig.emergencyLights.length === 2) {
        v.rig.emergencyLights[0].visible = flashOn;
        v.rig.emergencyLights[1].visible = !flashOn;
      }

      // Collision / Jump-Over / Smash / Ghost Check
      const dx = Math.abs(v.x - this.playerX);
      const dz = Math.abs(v.z);
      const hitW = v.rig.halfWidth + playerHalfW - 0.16;
      const hitL = v.rig.halfLength + playerHalfL - 0.25;

      if (dx < hitW && dz < hitL) {
        if (this.playerY > v.rig.heightClearance) {
          if (!v.nearMissed) {
            v.nearMissed = true;
            this.nearMisses += 1;
            this.score += 500;
            this.pushNotification('OVER-TRAFFIC STUNT! +500 SCORE', 'cyan');
            audioEngine.playNearMiss(this.comboCount + 1);
          }
        } else if (ghostPhaseActive) {
          // Phasing cleanly through oncoming vehicle
          if (!v.nearMissed) {
            v.nearMissed = true;
            this.nearMisses += 1;
            this.score += 300;
            this.pushNotification('SIREN PHASE PASS! +300 SCORE', 'cyan');
          }
        } else if (canSmash) {
          v.smashed = true;
          v.nearMissed = true;
          v.smashVx = (v.x >= this.playerX ? 1 : -1) * (14 + Math.random() * 8);
          v.smashSpin = (v.x >= this.playerX ? -1 : 1) * 7.5;
          this.smashes += 1;
          this.score += 650;
          this.cameraShake = Math.max(this.cameraShake, 0.45);
          this.spawnSparks((this.playerX + v.x) * 0.5, 0.9, v.z * 0.5, 22);
          audioEngine.playCrash('medium');
          this.triggerHaptic([18, 18]);
          this.pushNotification('TRAFFIC SMASH! +650 SCORE', 'amber');
        } else if (this.damageCooldown <= 0) {
          const isHeavy = v.type === 'bus' || v.type === 'truck' || v.type === 'fire_truck';
          const baseDmg =
            speedKmh < 165 || v.type === 'motorbike'
              ? 10
              : speedKmh < 245 && !isHeavy
                ? 20
                : 35;
          const tacticalMult = abId === 'tactical_armor' ? 0.75 : 1.0;
          const dmg = Math.max(4, Math.round(baseDmg * (1 - carStats.damageResistance) * tacticalMult));

          this.health = Math.max(0, this.health - dmg);
          this.damageCooldown = 1.35;
          this.damageFlash = 1.0;
          this.cameraShake = 1.0;
          this.hitstopTimer = 0.055;
          this.speedUnits = Math.max(24, this.speedUnits * 0.62);
          this.noDamageRunDist = 0;
          this.crashesTaken += 1;
          this.comboCount = 0;
          this.comboTimer = 0;

          if (this.playerRig) {
            const ov = this.playerRig.damageOverlays;
            if (ov[0]) ov[0].visible = this.health < 75;
            if (ov[1]) ov[1].visible = this.health < 50;
            if (ov[2]) ov[2].visible = this.health < 25;
          }

          this.spawnSparks((this.playerX + v.x) * 0.5, 0.85, -1.2, 28);
          audioEngine.playCrash(baseDmg >= 35 ? 'heavy' : baseDmg >= 20 ? 'medium' : 'small');
          this.triggerHaptic([35, 30, 65]);
          this.pushNotification(`CRASH IMPACT · -${dmg} HP`, 'rose');

          if (this.health <= 0) {
            this.triggerCrashGameOver();
            return;
          }
        }
      } else if (!v.nearMissed && v.z > 2.2 && v.z < 10.5) {
        if (dx < hitW + 1.85) {
          v.nearMissed = true;
          this.nearMisses += 1;
          this.comboCount = Math.min(5, this.comboCount + 1);
          this.comboTimer = 4.5;
          if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

          let bonusScore = 150 * this.comboCount;
          if (abId === 'quick_snap') bonusScore = Math.round(bonusScore * 1.25);
          this.score += bonusScore;
          audioEngine.playNearMiss(this.comboCount);
          this.triggerHaptic(14);
          this.pushNotification(
            this.comboCount > 1
              ? `NEAR MISS x${this.comboCount} · +${bonusScore} SCORE`
              : `NEAR MISS · +${bonusScore} SCORE`,
            'amber',
          );

          if (this.tutorialStep === 2) {
            this.tutorialStep = -1;
            this.callbacks.onTutorialComplete();
          }
        }
      }

      if (v.z > 22) {
        v.active = false;
        v.rig.group.visible = false;
      }
    }
  }

  private triggerStuntJump(rampType: StuntRampType = 'standard'): void {
    this.stuntJumps += 1;
    this.comboCount = Math.min(5, this.comboCount + 1);
    this.comboTimer = 4.8;
    if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

    const abId = getCarById(this.activeCarId).ability.id;
    let bonusScore = 300 * this.comboCount;

    if (rampType === 'super_launch') {
      bonusScore = Math.round(bonusScore * 2.5);
    } else if (rampType === 'dual_ramp') {
      bonusScore = Math.round(bonusScore * 1.6);
    }

    if (abId === 'quick_snap') bonusScore = Math.round(bonusScore * 1.25);
    if (abId === 'steady_grip') bonusScore = Math.round(bonusScore * 1.3);
    if (abId === 'track_precision' && this.comboCount >= 2) {
      bonusScore *= 2;
    }
    if (abId === 'slipstream') {
      this.nitroAmount = Math.min(1, this.nitroAmount + 0.18);
    }

    this.score += bonusScore;
    this.spawnSparks(this.playerX, 0.4, 0, rampType === 'super_launch' ? 32 : 20);

    if (this.tutorialStep === 2) {
      this.tutorialStep = -1;
      this.callbacks.onTutorialComplete();
    }

    audioEngine.playPowerUp('nitro');
    this.triggerHaptic(rampType === 'super_launch' ? [40, 30, 50] : 24);

    if (rampType === 'super_launch') {
      this.pushNotification(
        `SUPER MEGA LAUNCH x${this.comboCount} · +${bonusScore} SCORE`,
        'cyan',
      );
    } else if (rampType === 'dual_ramp') {
      this.pushNotification(
        `DUAL RAMP CAR JUMP x${this.comboCount} · +${bonusScore} SCORE`,
        'emerald',
      );
    } else {
      this.pushNotification(
        this.comboCount > 1
          ? `HIGHWAY JUMP RAMP x${this.comboCount} · +${bonusScore} SCORE`
          : `STUNT RAMP LAUNCH · +${bonusScore} SCORE`,
        'amber',
      );
    }
  }

  private spawnCoinArc(): void {
    let lane = Math.floor(Math.random() * LANE_COUNT);
    const zBase = -320 - Math.random() * 40;
    for (let attempt = 0; attempt < LANE_COUNT; attempt++) {
      const candidate = (lane + attempt) % LANE_COUNT;
      if (!this.isLaneOccupiedNear(candidate, zBase, 14)) {
        lane = candidate;
        break;
      }
    }
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const zPos = zBase - i * 4.5;
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
    let lane = Math.floor(Math.random() * LANE_COUNT);
    const zPos = -335 - Math.random() * 30;
    for (let attempt = 0; attempt < LANE_COUNT; attempt++) {
      const candidate = (lane + attempt) % LANE_COUNT;
      if (!this.isLaneOccupiedNear(candidate, zPos, 16)) {
        lane = candidate;
        break;
      }
    }

    const repairChance = this.health < 75 ? 0.38 : 0.24;
    if (Math.random() < repairChance) {
      const roll = Math.random();
      let desiredTier: RepairPickupTier = 'small';
      if (roll > 0.94) desiredTier = 'legendary';
      else if (roll > 0.78) desiredTier = 'large';
      else if (roll > 0.48) desiredTier = 'medium';

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
      const desiredTypes: PowerUpType[] = ['nitro', 'magnet', 'shield', 'slow_mo', 'emergency_repair'];
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

      if (Math.abs(c.x - this.playerX) < 1.8 && Math.abs(c.z) < 2.7) {
        c.active = false;
        c.mesh.visible = false;
        const val = Math.max(1, Math.round(5 * coinMultiplier * coinAbilityMult));
        this.runCoins += val;
        this.score += 20;
        this.spawnSparks(c.x, 0.95, c.z, 6);
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
        this.score += 250;
        audioEngine.playRepair(r.tier);
        this.triggerHaptic([20, 20, 40]);
        this.pushNotification(`REPAIR KIT · +${finalHeal} HP & +250 SCORE`, 'emerald');
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
      this.score += 150;
      this.pushNotification('CHRONO FLOW · +150 PTS', 'cyan');
    } else if (type === 'emergency_repair') {
      const heal = Math.round(30 * repairEfficiency);
      this.health = Math.min(this.maxHealth, this.health + heal);
      this.repairsCollected += 1;
      this.score += 300;
      this.pushNotification(`EMERGENCY REPAIR · +${heal} HP & +300 SCORE`, 'emerald');
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
    const aspect = this.camera.aspect || 1.5;
    const portraitBoost = aspect < 1.0 ? Math.min(1, (1.0 - aspect) / 0.55) : 0;
    const targetY =
      (preset === 'low' ? 2.45 : preset === 'high' ? 6.6 : 4.1) +
      portraitBoost * 0.75 +
      this.playerY * 0.55;
    const targetZ =
      (preset === 'low' ? 6.4 : preset === 'high' ? 11.4 : 8.4) + portraitBoost * 2.6;
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
      const baseFov =
        (this.nitroActive
          ? 78
          : 62 + THREE.MathUtils.clamp((this.speedUnits * 3.6 - 160) / 200, 0, 1) * 11) +
        portraitBoost * 14;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, baseFov, 5.5, dt);
      this.camera.updateProjectionMatrix();
    }

    _tmpVec.set(this.playerX * 0.85, 1.05 + this.playerY * 0.45, lookAheadZ);
    this.camera.lookAt(_tmpVec);
  }

  private triggerCrashGameOver(): void {
    if (this.crashPendingSummary) return;
    this.crashPendingSummary = true;
    this.crashSlowMoTimer = 0.65;
    this.notifications = [];
    this.nitroActive = false;
    this.braking = false;
    audioEngine.stopEngine();
    audioEngine.playGameOver();
    this.emitHud();
  }

  private finishRunAndReport(): void {
    this.crashPendingSummary = false;
    this.notifications = [];
    const modeDef = getModeById(this.activeModeId);
    const dist = Math.round(this.distanceM);
    const modeBonus =
      this.activeModeId === 'traffic_challenge' && this.modeBonusClaimed
        ? 900
        : this.activeModeId === 'stunt_challenge' && this.modeBonusClaimed
          ? 800
          : this.activeModeId === 'time_trial' && this.modeBonusClaimed
            ? 650
            : 0;
    const xpEarned = Math.round(
      (dist * 0.08 + this.stuntJumps * 22 + this.nearMisses * 14 + this.smashes * 18) *
        modeDef.xpMultiplier,
    );

    const summary: RunSummary = {
      distance: dist,
      score: Math.round(this.score),
      coinsEarned: this.runCoins,
      nearMisses: this.nearMisses,
      stuntJumps: this.stuntJumps,
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
      bossEscaped: false,
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

    let modeProgressLabel: string | null = null;
    if (this.activeModeId === 'traffic_challenge') {
      modeProgressLabel = `${Math.min(Math.round(this.distanceM), modeDef.targetDistanceM ?? 1500)}m / ${modeDef.targetDistanceM}m · ${Math.min(this.nearMisses, modeDef.targetNearMisses ?? 15)}/${modeDef.targetNearMisses} Near Miss`;
    } else if (this.activeModeId === 'stunt_challenge') {
      modeProgressLabel = `${Math.min(Math.round(this.distanceM), modeDef.targetDistanceM ?? 1500)}m / ${modeDef.targetDistanceM}m · ${Math.min(this.stuntJumps, modeDef.targetStuntJumps ?? 6)}/${modeDef.targetStuntJumps} Stunts`;
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
      active: false,
      bossName: '',
      bossType: 'black_hypercar',
      remainingSec: 0,
      totalSec: 60,
      warningText: null,
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
      comboTimerRatio: Math.max(0, this.comboTimer / 4.5),
      nearMisses: this.nearMisses,
      stuntJumps: this.stuntJumps,
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);

    this.highwayRig?.dispose();
    if (this.playerRig) this.disposeObject3D(this.playerRig.group);
    if (this.showroomCarRig) this.disposeObject3D(this.showroomCarRig.group);
    this.disposeObject3D(this.showroomGroup);
    for (const v of this.trafficPool) this.disposeObject3D(v.rig.group);
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
