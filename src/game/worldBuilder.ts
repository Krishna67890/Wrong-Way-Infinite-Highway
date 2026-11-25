import * as THREE from 'three';
import {
  createHighwayAsphaltTexture,
  getLaneCenterX,
  LANE_COUNT,
  ROAD_WIDTH,
  SEGMENT_LENGTH,
} from './textures';
import { StuntRampType, WorldDefinition } from './types';

export interface RoadSegmentPoolItem {
  group: THREE.Group;
  zStart: number;
  hasRamp: boolean;
  rampType: StuntRampType;
  rampX: number;
  rampZLocal: number;
  rampTriggered: boolean;
  hasHoop: boolean;
  hoopX: number;
  hoopZLocal: number;
  hoopTriggered: boolean;
}

export interface HighwayEnvironmentRig {
  root: THREE.Group;
  segments: RoadSegmentPoolItem[];
  asphaltTexture: THREE.CanvasTexture;
  weatherPoints: THREE.Points | null;
  weatherVelocities: Float32Array | null;
  speedLines: THREE.LineSegments;
  speedPositions: Float32Array;
  dispose: () => void;
}

function buildTreeProp(isSnow: boolean, isPalm: boolean): THREE.Group {
  const g = new THREE.Group();
  if (isPalm) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.3, 6.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x78553a, roughness: 0.9 }),
    );
    trunk.position.y = 3.1;
    trunk.rotation.z = (Math.random() - 0.5) * 0.14;
    g.add(trunk);

    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.72,
    });
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 2.4), frondMat);
      frond.position.y = 6.1;
      frond.rotation.y = (i / 6) * Math.PI * 2;
      frond.rotation.x = 0.35;
      g.add(frond);
    }
    return g;
  }

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.36, 2.4, 7),
    new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.9 }),
  );
  trunk.position.y = 1.2;
  g.add(trunk);

  const foliageColor = isSnow ? 0xdbeafe : 0x166534;
  const coneMat = new THREE.MeshStandardMaterial({
    color: foliageColor,
    roughness: 0.8,
  });
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.75, 3.4, 7), coneMat);
  c1.position.y = 3.4;
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.8, 7), coneMat);
  c2.position.y = 5.1;
  g.add(c1, c2);
  return g;
}

function buildCityTower(accentHex: string, cyberMode = false): THREE.Group {
  const g = new THREE.Group();
  const h = 15 + Math.random() * 25;
  const w = 5 + Math.random() * 4.5;
  const d = 5 + Math.random() * 4.5;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: cyberMode ? 0x13092b : 0x0f172a,
      roughness: 0.42,
      metalness: 0.55,
    }),
  );
  body.position.y = h * 0.5;
  g.add(body);

  const stripColor =
    Math.random() > 0.45 ? new THREE.Color(accentHex) : new THREE.Color(cyberMode ? 0x22d3ee : 0xf43f5e);
  const stripMat = new THREE.MeshBasicMaterial({ color: stripColor });
  for (let y = 4; y < h - 1.5; y += 3.6) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.28, d + 0.14), stripMat);
    band.position.y = y;
    g.add(band);
  }
  return g;
}

function buildOverheadGantry(glowHex: string, cyber: boolean): THREE.Group {
  const g = new THREE.Group();
  const span = ROAD_WIDTH + 3.2;
  const mat = new THREE.MeshStandardMaterial({
    color: cyber ? 0x1e1b4b : 0x334155,
    metalness: 0.75,
    roughness: 0.35,
  });
  for (const sx of [-span * 0.5, span * 0.5]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.8, 0.45), mat);
    leg.position.set(sx, 3.9, 0);
    g.add(leg);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(span + 0.5, 0.55, 0.6), mat);
  cross.position.set(0, 7.6, 0);
  g.add(cross);

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 1.4, 0.2),
    new THREE.MeshBasicMaterial({ color: cyber ? new THREE.Color(glowHex) : 0x065f46 }),
  );
  sign.position.set(0, 7.6, 0.35);
  g.add(sign);

  if (cyber) {
    const neonBar = new THREE.Mesh(
      new THREE.BoxGeometry(span, 0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(glowHex) }),
    );
    neonBar.position.set(0, 7.25, 0);
    g.add(neonBar);
  }
  return g;
}

function buildStuntRamp(glowHex: string, rampType: StuntRampType = 'standard'): THREE.Group {
  const g = new THREE.Group();

  if (rampType === 'super_launch') {
    // Mega Super Launch Ramp (Cyan / Rose Glow, Higher Incline, Dual Side Rails & Chevrons)
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.25,
      metalness: 0.85,
    });
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 5.2), baseMat);
    ramp.position.set(0, 0.48, 0);
    ramp.rotation.x = -0.28;
    g.add(ramp);

    const glowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.08, 5.1),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
    );
    glowStrip.position.set(0, 0.72, 0);
    glowStrip.rotation.x = -0.28;
    g.add(glowStrip);

    for (let c = -1.6; c <= 1.6; c += 1.6) {
      const chevron = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.09, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
      );
      chevron.position.set(0, 0.75 + c * 0.1, c);
      chevron.rotation.x = -0.28;
      g.add(chevron);
    }

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.35, 5.3),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
      );
      rail.position.set(side * 1.62, 0.82, 0);
      rail.rotation.x = -0.28;
      g.add(rail);
    }
  } else if (rampType === 'dual_ramp') {
    // Wide Double-Lane Ramp (Emerald / Cyan, Spans 2 Lanes)
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      roughness: 0.4,
      metalness: 0.6,
    });
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.45, 4.8), baseMat);
    ramp.position.set(0, 0.4, 0);
    ramp.rotation.x = -0.22;
    g.add(ramp);

    const glowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.08, 4.7),
      new THREE.MeshBasicMaterial({ color: 0x10b981 }),
    );
    glowStrip.position.set(0, 0.62, 0);
    glowStrip.rotation.x = -0.22;
    g.add(glowStrip);

    const centerStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.1, 4.7),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
    );
    centerStrip.position.set(0, 0.64, 0);
    centerStrip.rotation.x = -0.22;
    g.add(centerStrip);
  } else {
    // Standard Amber Highway Launch Ramp
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.45,
    });
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.42, 4.8), mat);
    ramp.position.set(0, 0.38, 0);
    ramp.rotation.x = -0.22;
    g.add(ramp);

    const glowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.08, 4.7),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(glowHex) }),
    );
    glowStrip.position.set(0, 0.6, 0);
    glowStrip.rotation.x = -0.22;
    g.add(glowStrip);
  }

  return g;
}

function buildSuspensionBridgeArch(glowHex: string): THREE.Group {
  const g = new THREE.Group();
  const span = ROAD_WIDTH + 5.0;
  const mat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  for (const sx of [-span * 0.5, span * 0.5]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 12.0, 0.8), mat);
    pylon.position.set(sx, 6.0, 0);
    g.add(pylon);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 1.0, 0.8, 1.0), mat);
  beam.position.set(0, 11.6, 0);
  g.add(beam);

  const neon = new THREE.Mesh(
    new THREE.BoxGeometry(span, 0.2, 0.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(glowHex) }),
  );
  neon.position.set(0, 11.2, 0);
  g.add(neon);
  return g;
}

function buildStuntHoop(glowHex: string): THREE.Group {
  const g = new THREE.Group();
  const ringGeo = new THREE.TorusGeometry(2.75, 0.2, 8, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(glowHex) });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, 3.6, 0);
  g.add(ring);
  return g;
}

function buildDesertMesa(): THREE.Group {
  const g = new THREE.Group();
  const h = 5 + Math.random() * 11;
  const rBottom = 4.5 + Math.random() * 4.5;
  const mesa = new THREE.Mesh(
    new THREE.CylinderGeometry(rBottom * 0.55, rBottom, h, 7),
    new THREE.MeshStandardMaterial({
      color: Math.random() > 0.5 ? 0xb45309 : 0x9a3412,
      roughness: 0.92,
    }),
  );
  mesa.position.y = h * 0.5;
  g.add(mesa);
  return g;
}

function buildCactus(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 3.1, 7), mat);
  stem.position.y = 1.55;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.3, 6), mat);
  arm.position.set(0.45, 1.9, 0);
  arm.rotation.z = -Math.PI / 3;
  g.add(stem, arm);
  return g;
}

function buildMountainPeak(isSnow: boolean): THREE.Group {
  const g = new THREE.Group();
  const h = 11 + Math.random() * 16;
  const r = 6 + Math.random() * 6;
  const rock = new THREE.Mesh(
    new THREE.ConeGeometry(r, h, 6),
    new THREE.MeshStandardMaterial({
      color: isSnow ? 0x64748b : 0x475569,
      roughness: 0.9,
      flatShading: true,
    }),
  );
  rock.position.y = h * 0.5;
  g.add(rock);

  if (isSnow) {
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.42, h * 0.42, 6),
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.75,
        flatShading: true,
      }),
    );
    cap.position.y = h * 0.78;
    g.add(cap);
  }
  return g;
}

function buildStreetLamp(glowHex: string, isNight: boolean): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.75,
    roughness: 0.35,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 7.2, 6), poleMat);
  pole.position.y = 3.6;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.14), poleMat);
  arm.position.set(1.1, 7.1, 0);
  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.12, 0.32),
    new THREE.MeshBasicMaterial({
      color: isNight ? new THREE.Color(glowHex) : 0xfffbeb,
    }),
  );
  bulb.position.set(2.0, 6.98, 0);
  g.add(pole, arm, bulb);
  return g;
}

export function buildHighwayEnvironment(
  world: WorldDefinition,
  segmentCount: number,
  maxAnisotropy: number,
  graphics: 'low' | 'medium' | 'high',
): HighwayEnvironmentRig {
  const root = new THREE.Group();
  const segments: RoadSegmentPoolItem[] = [];
  const asphaltTexture = createHighwayAsphaltTexture(world, maxAnisotropy);

  const roadMat = new THREE.MeshStandardMaterial({
    map: asphaltTexture,
    roughness:
      world.id === 'rainy_highway' || world.id === 'neon_city' || world.id === 'cyber_highway'
        ? 0.25
        : 0.78,
    metalness: world.id === 'rainy_highway' ? 0.35 : 0.08,
  });

  const groundColor =
    world.propTheme === 'coastal'
      ? 0x0284c7
      : new THREE.Color(world.shoulderColor).getHex();

  const terrainMat = new THREE.MeshStandardMaterial({
    color: groundColor,
    roughness: world.propTheme === 'coastal' ? 0.22 : 0.92,
    metalness: world.propTheme === 'coastal' ? 0.35 : 0.04,
  });

  const barrierMat = new THREE.MeshStandardMaterial({
    color: world.isNight ? 0x334155 : 0x94a3b8,
    roughness: 0.6,
    metalness: 0.25,
  });

  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH);
  roadGeo.rotateX(-Math.PI / 2);

  const terrainGeo = new THREE.PlaneGeometry(240, SEGMENT_LENGTH);
  terrainGeo.rotateX(-Math.PI / 2);

  const barrierGeo = new THREE.BoxGeometry(0.55, 0.85, SEGMENT_LENGTH);

  const propDensity = graphics === 'low' ? 2 : graphics === 'medium' ? 3 : 4;

  for (let i = 0; i < segmentCount; i++) {
    const segGroup = new THREE.Group();
    const zPos = -i * SEGMENT_LENGTH;
    segGroup.position.z = zPos;

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.y = -0.06;
    terrain.receiveShadow = true;
    segGroup.add(terrain);

    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.y = 0.0;
    road.receiveShadow = true;
    segGroup.add(road);

    for (const side of [-1, 1]) {
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(side * (ROAD_WIDTH * 0.5 + 0.5), 0.42, 0);
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      segGroup.add(barrier);
    }

    if (world.isNight || world.propTheme === 'city' || world.propTheme === 'rain' || world.propTheme === 'cyber') {
      const lampL = buildStreetLamp(world.accentGlow, world.isNight);
      lampL.position.set(-(ROAD_WIDTH * 0.5 + 1.2), 0, -SEGMENT_LENGTH * 0.25);
      segGroup.add(lampL);

      const lampR = buildStreetLamp(world.accentGlow, world.isNight);
      lampR.rotation.y = Math.PI;
      lampR.position.set(ROAD_WIDTH * 0.5 + 1.2, 0, SEGMENT_LENGTH * 0.25);
      segGroup.add(lampR);
    }

    // Overhead highway bridges / gantries
    if (i % 3 === 0) {
      const gantry = buildOverheadGantry(world.accentGlow, world.propTheme === 'cyber');
      segGroup.add(gantry);
    }
    if (i % 6 === 2) {
      const bridge = buildSuspensionBridgeArch(world.accentGlow);
      segGroup.add(bridge);
    }

    // Interactive Stunt Ramps & Airborne Hoops (In-Lane & Shoulder placement)
    let hasRamp = false;
    let rampType: StuntRampType = 'standard';
    let rampX = 0;
    const rampZLocal = -SEGMENT_LENGTH * 0.15;
    let hasHoop = false;
    let hoopX = 0;
    const hoopZLocal = -SEGMENT_LENGTH * 0.42;

    if (i > 1 && (i % 2 === 1 || i % 3 === 1)) {
      hasRamp = true;
      const rVal = ((i * 17) % 100) / 100;
      if (rVal < 0.28) {
        rampType = 'super_launch';
      } else if (rVal < 0.55) {
        rampType = 'dual_ramp';
      } else {
        rampType = 'standard';
      }

      // 75% placement in active highway driving lanes (0..5), 25% on shoulders
      const inLane = i % 4 !== 0;
      if (inLane) {
        const laneIdx = (i * 2 + 1) % LANE_COUNT;
        rampX = getLaneCenterX(laneIdx);
      } else {
        const sideSign = i % 2 === 0 ? 1 : -1;
        rampX = sideSign * (ROAD_WIDTH * 0.5 + 0.9);
      }

      const ramp = buildStuntRamp(world.accentGlow, rampType);
      ramp.position.set(rampX, 0, rampZLocal);
      segGroup.add(ramp);

      if (i % 2 === 1 || rampType === 'super_launch') {
        hasHoop = true;
        hoopX = rampX;
        const hoopY = rampType === 'super_launch' ? 5.2 : 3.6;
        const hoopGlow = rampType === 'super_launch' ? '#f43f5e' : world.accentGlow;
        const hoop = buildStuntHoop(hoopGlow);
        hoop.position.set(hoopX, hoopY, hoopZLocal);
        segGroup.add(hoop);
      }
    }

    for (let p = 0; p < propDensity; p++) {
      for (const side of [-1, 1]) {
        const zOff = (p / propDensity - 0.5) * SEGMENT_LENGTH + (Math.random() - 0.5) * 4;
        const xOff = side * (ROAD_WIDTH * 0.5 + 4.5 + Math.random() * 18);

        let prop: THREE.Group;
        if (world.propTheme === 'city' || world.propTheme === 'rain') {
          prop = buildCityTower(world.accentGlow, false);
        } else if (world.propTheme === 'cyber') {
          prop = buildCityTower(world.accentGlow, true);
        } else if (world.propTheme === 'desert' || world.propTheme === 'sunset') {
          prop = Math.random() > 0.45 ? buildDesertMesa() : buildCactus();
        } else if (world.propTheme === 'forest') {
          prop = buildTreeProp(false, false);
        } else if (world.propTheme === 'snow') {
          prop = Math.random() > 0.35 ? buildTreeProp(true, false) : buildMountainPeak(true);
        } else {
          prop = side < 0 ? buildTreeProp(false, true) : buildMountainPeak(false);
        }

        prop.position.set(xOff, -0.05, zOff);
        segGroup.add(prop);
      }
    }

    root.add(segGroup);
    segments.push({
      group: segGroup,
      zStart: zPos,
      hasRamp,
      rampType,
      rampX,
      rampZLocal,
      rampTriggered: false,
      hasHoop,
      hoopX,
      hoopZLocal,
      hoopTriggered: false,
    });
  }

  let weatherPoints: THREE.Points | null = null;
  let weatherVelocities: Float32Array | null = null;
  if (world.weather === 'rain' || world.weather === 'snow' || world.weather === 'dust') {
    const count = graphics === 'low' ? 180 : graphics === 'medium' ? 340 : 520;
    const pos = new Float32Array(count * 3);
    weatherVelocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 44;
      pos[i * 3 + 1] = 0.5 + Math.random() * 16;
      pos[i * 3 + 2] = -Math.random() * 85 + 15;
      weatherVelocities[i] = 0.8 + Math.random() * 0.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: world.weather === 'snow' ? 0xf8fafc : world.weather === 'dust' ? 0xfdba74 : 0xbae6fd,
      size: world.weather === 'snow' ? 0.24 : world.weather === 'dust' ? 0.2 : 0.16,
      transparent: true,
      opacity: world.weather === 'rain' ? 0.65 : 0.72,
    });
    weatherPoints = new THREE.Points(geo, mat);
    weatherPoints.frustumCulled = false;
    root.add(weatherPoints);
  }

  const lineCount = 36;
  const speedPositions = new Float32Array(lineCount * 6);
  for (let i = 0; i < lineCount; i++) {
    const x = (Math.random() > 0.5 ? 1 : -1) * (4.5 + Math.random() * 9);
    const y = 0.6 + Math.random() * 4.5;
    const z = -Math.random() * 70;
    speedPositions[i * 6] = x;
    speedPositions[i * 6 + 1] = y;
    speedPositions[i * 6 + 2] = z;
    speedPositions[i * 6 + 3] = x;
    speedPositions[i * 6 + 4] = y;
    speedPositions[i * 6 + 5] = z - 4.5;
  }
  const speedGeo = new THREE.BufferGeometry();
  speedGeo.setAttribute('position', new THREE.BufferAttribute(speedPositions, 3));
  const speedMat = new THREE.LineBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.0,
  });
  const speedLines = new THREE.LineSegments(speedGeo, speedMat);
  speedLines.frustumCulled = false;
  root.add(speedLines);

  const dispose = () => {
    asphaltTexture.dispose();
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints || (obj as THREE.LineSegments).isLineSegments) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mt) => mt.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
  };

  return {
    root,
    segments,
    asphaltTexture,
    weatherPoints,
    weatherVelocities,
    speedLines,
    speedPositions,
    dispose,
  };
}
