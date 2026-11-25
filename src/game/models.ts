import * as THREE from 'three';
import {
  BossType,
  CarBodyStyle,
  DecalStyle,
  PowerUpType,
  RepairPickupTier,
  TrafficVehicleType,
} from './types';

export interface PlayerCarRig {
  group: THREE.Group;
  bodyMaterials: THREE.MeshPhysicalMaterial[];
  wheels: THREE.Object3D[];
  nitroFlames: THREE.Group;
  shieldMesh: THREE.Mesh;
  damageOverlays: THREE.Mesh[];
  brakeLights: THREE.Mesh[];
  headlights: THREE.Mesh[];
  policeBarLights: THREE.Mesh[];
  abilityAuraMesh: THREE.Mesh;
  smokeAnchor: THREE.Vector3;
  halfWidth: number;
  halfLength: number;
}

export interface TrafficVehicleRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  signalLeft: THREE.Mesh;
  signalRight: THREE.Mesh;
  emergencyLights: THREE.Mesh[];
  halfWidth: number;
  halfLength: number;
  heightClearance: number;
}

export interface BossVehicleRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  beaconLeft: THREE.Mesh;
  beaconRight: THREE.Mesh;
  halfWidth: number;
  halfLength: number;
}

const _sharedWheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 16);
_sharedWheelGeo.rotateZ(Math.PI / 2);
_sharedWheelGeo.userData.shared = true;

const _sharedRimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10);
_sharedRimGeo.rotateZ(Math.PI / 2);
_sharedRimGeo.userData.shared = true;

const _tireMat = new THREE.MeshStandardMaterial({
  color: 0x16181d,
  roughness: 0.85,
  metalness: 0.08,
});
_tireMat.userData.shared = true;

const _rimMat = new THREE.MeshStandardMaterial({
  color: 0xd1d5db,
  roughness: 0.22,
  metalness: 0.9,
});
_rimMat.userData.shared = true;

const _darkTrimMat = new THREE.MeshStandardMaterial({
  color: 0x111318,
  roughness: 0.72,
  metalness: 0.15,
});
_darkTrimMat.userData.shared = true;

const _carbonMat = new THREE.MeshStandardMaterial({
  color: 0x181b22,
  roughness: 0.38,
  metalness: 0.45,
});
_carbonMat.userData.shared = true;

const _chromeMat = new THREE.MeshStandardMaterial({
  color: 0xe5e7eb,
  roughness: 0.12,
  metalness: 0.95,
});
_chromeMat.userData.shared = true;

const _glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x0b1322,
  roughness: 0.08,
  metalness: 0.15,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
});
_glassMat.userData.shared = true;

const _taillightMat = new THREE.MeshStandardMaterial({
  color: 0xff1e42,
  emissive: 0xef4444,
  emissiveIntensity: 2.0,
  roughness: 0.2,
});
_taillightMat.userData.shared = true;

function buildWheelPair(
  xOffset: number,
  y: number,
  z: number,
  radiusScale = 1,
): THREE.Object3D[] {
  const created: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const wheelGroup = new THREE.Group();
    const tire = new THREE.Mesh(_sharedWheelGeo, _tireMat);
    const rim = new THREE.Mesh(_sharedRimGeo, _rimMat);
    tire.castShadow = true;
    wheelGroup.add(tire, rim);
    wheelGroup.scale.setScalar(radiusScale);
    wheelGroup.position.set(side * xOffset, y, z);
    created.push(wheelGroup);
  }
  return created;
}

export function buildPlayerCarModel(
  style: CarBodyStyle,
  paintHex: string,
  accentHex: string,
  shadowTex: THREE.CanvasTexture,
  decal: DecalStyle = 'clean',
  underglowHex?: string,
): PlayerCarRig {
  const group = new THREE.Group();
  const bodyMaterials: THREE.MeshPhysicalMaterial[] = [];
  const wheels: THREE.Object3D[] = [];
  const damageOverlays: THREE.Mesh[] = [];
  const brakeLights: THREE.Mesh[] = [];
  const headlights: THREE.Mesh[] = [];
  const policeBarLights: THREE.Mesh[] = [];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    metalness: style === 'cyber' ? 0.65 : 0.78,
    roughness: style === 'cyber' ? 0.28 : 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  bodyMaterials.push(paintMat);

  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    metalness: 0.65,
    roughness: 0.28,
    emissive: style === 'cyber' || decal === 'neon_trim' ? new THREE.Color(accentHex) : 0x000000,
    emissiveIntensity: style === 'cyber' || decal === 'neon_trim' ? 0.85 : 0,
  });

  const cfgMap: Record<
    CarBodyStyle,
    { w: number; l: number; h: number; cabL: number; cabH: number; spoiler: boolean; wide: number; grille: boolean }
  > = {
    hatchback: { w: 1.84, l: 4.1, h: 0.52, cabL: 2.0, cabH: 0.48, spoiler: false, wide: 0, grille: false },
    coupe: { w: 1.9, l: 4.35, h: 0.48, cabL: 1.9, cabH: 0.44, spoiler: true, wide: 0.04, grille: false },
    gt: { w: 1.96, l: 4.5, h: 0.48, cabL: 1.85, cabH: 0.42, spoiler: true, wide: 0.08, grille: false },
    turbo: { w: 1.98, l: 4.55, h: 0.46, cabL: 1.88, cabH: 0.4, spoiler: true, wide: 0.08, grille: false },
    angular_super: { w: 2.08, l: 4.68, h: 0.38, cabL: 1.65, cabH: 0.34, spoiler: true, wide: 0.14, grille: false },
    berlinetta: { w: 2.04, l: 4.62, h: 0.4, cabL: 1.72, cabH: 0.36, spoiler: true, wide: 0.1, grille: false },
    aero_super: { w: 2.06, l: 4.66, h: 0.39, cabL: 1.75, cabH: 0.35, spoiler: true, wide: 0.12, grille: false },
    luxury_sedan: { w: 2.02, l: 5.05, h: 0.56, cabL: 2.35, cabH: 0.48, spoiler: false, wide: 0.02, grille: true },
    w16_hyper: { w: 2.12, l: 4.78, h: 0.41, cabL: 1.72, cabH: 0.35, spoiler: true, wide: 0.14, grille: true },
    nordic_hyper: { w: 2.1, l: 4.82, h: 0.37, cabL: 1.65, cabH: 0.33, spoiler: true, wide: 0.14, grille: false },
    limousine: { w: 2.06, l: 6.85, h: 0.56, cabL: 4.15, cabH: 0.5, spoiler: false, wide: 0.02, grille: true },
    police: { w: 2.0, l: 4.75, h: 0.52, cabL: 2.05, cabH: 0.44, spoiler: true, wide: 0.06, grille: true },
    suv_police: { w: 2.12, l: 4.95, h: 0.68, cabL: 2.65, cabH: 0.52, spoiler: false, wide: 0.06, grille: true },
    cyber: { w: 2.08, l: 4.7, h: 0.4, cabL: 1.78, cabH: 0.34, spoiler: true, wide: 0.12, grille: false },
    legendary: { w: 2.14, l: 4.88, h: 0.38, cabL: 1.75, cabH: 0.34, spoiler: true, wide: 0.15, grille: false },
    van: { w: 2.08, l: 5.25, h: 0.92, cabL: 3.3, cabH: 0.58, spoiler: false, wide: 0.04, grille: true },
    truck: { w: 2.26, l: 6.4, h: 1.15, cabL: 4.4, cabH: 0.72, spoiler: false, wide: 0.06, grille: true },
  };
  const cfg = cfgMap[style] ?? cfgMap.coupe;

  const isEmergencyPolice = style === 'police' || style === 'suv_police';
  const isAmbulance = style === 'van' && accentHex.toLowerCase() === '#ef4444';
  const isFireTruck = style === 'truck';

  // Ground contact shadow
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(cfg.w * 1.4, cfg.l * 1.15),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.82,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  group.add(shadowPlane);

  // 1. Lower Aero Underbody
  const underbody = new THREE.Mesh(
    new THREE.BoxGeometry(cfg.w + cfg.wide * 0.5, 0.2, cfg.l + 0.12),
    _darkTrimMat,
  );
  underbody.position.y = 0.32;
  underbody.castShadow = true;
  group.add(underbody);

  // 2. Main Body Hull
  const mainBody = new THREE.Mesh(
    new THREE.BoxGeometry(cfg.w, cfg.h, cfg.l),
    paintMat,
  );
  mainBody.position.y = 0.36 + cfg.h * 0.5;
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  group.add(mainBody);

  // Police Interceptor white doors contrast panel
  if (isEmergencyPolice) {
    const whiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 0.35,
      roughness: 0.22,
      clearcoat: 0.9,
    });
    const doors = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w + 0.04, cfg.h * 0.88, cfg.cabL * 0.92),
      whiteMat,
    );
    doors.position.set(0, 0.36 + cfg.h * 0.5, 0.05);
    group.add(doors);
  }

  // 3. Front Aero Splitter / Bull Bar
  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(cfg.w + cfg.wide * 0.8, isFireTruck || isEmergencyPolice ? 0.2 : 0.09, 0.46),
    isEmergencyPolice || isFireTruck ? _chromeMat : accentMat,
  );
  splitter.position.set(0, 0.28, -cfg.l * 0.5 - 0.06);
  group.add(splitter);

  // Optional Chrome Grille
  if (cfg.grille) {
    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w * 0.44, cfg.h * 0.55, 0.14),
      _chromeMat,
    );
    grille.position.set(0, 0.48 + (isFireTruck ? 0.14 : 0), -cfg.l * 0.5 - 0.02);
    group.add(grille);
  }

  // Hood styling + Decal support
  if (decal === 'carbon_hood') {
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w * 0.72, 0.05, cfg.l * 0.3),
      _carbonMat,
    );
    hood.position.set(0, 0.38 + cfg.h, -cfg.l * 0.28);
    group.add(hood);
  } else if (decal === 'stripes') {
    for (const sx of [-0.22, 0.22]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.05, cfg.l * 0.96),
        accentMat,
      );
      stripe.position.set(sx, 0.38 + cfg.h, 0);
      group.add(stripe);
    }
  } else if (style !== 'van' && !isFireTruck) {
    const hoodVent = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w * 0.42, 0.055, cfg.l * 0.28),
      style === 'legendary' ? accentMat : _carbonMat,
    );
    hoodVent.position.set(0, 0.38 + cfg.h, -cfg.l * 0.24);
    group.add(hoodVent);
  }

  // 4. Glass Canopy & Roof Cap (plus Van / Fire Truck emergency silhouettes)
  if (style === 'van' || isFireTruck) {
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w * 0.86, cfg.cabH * 0.76, 0.22),
      _glassMat,
    );
    windshield.position.set(0, 0.36 + cfg.h + cfg.cabH * 0.28, -cfg.l * 0.44);
    group.add(windshield);

    const upperBox = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w * 0.96, cfg.cabH, cfg.cabL),
      paintMat,
    );
    upperBox.position.set(0, 0.36 + cfg.h + cfg.cabH * 0.45, 0.32);
    upperBox.castShadow = true;
    group.add(upperBox);

    // Side accent stripes for Ambulance / SWAT Van / Fire Brigade
    for (const sx of [-1, 1]) {
      const sideBand = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.22, cfg.l * 0.86),
        accentMat,
      );
      sideBand.position.set(sx * (cfg.w * 0.5 + 0.02), 0.36 + cfg.h * 0.62, 0.1);
      group.add(sideBand);

      if (isAmbulance) {
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.48), accentMat);
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.16), accentMat);
        crossH.position.set(sx * (cfg.w * 0.5 + 0.03), 0.36 + cfg.h + cfg.cabH * 0.46, 0.55);
        crossV.position.set(sx * (cfg.w * 0.5 + 0.03), 0.36 + cfg.h + cfg.cabH * 0.46, 0.55);
        group.add(crossH, crossV);
      }
    }

    if (isAmbulance) {
      const roofCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.2), accentMat);
      const roofCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.62), accentMat);
      roofCrossH.position.set(0, 0.4 + cfg.h + cfg.cabH, 0.65);
      roofCrossV.position.set(0, 0.4 + cfg.h + cfg.cabH, 0.65);
      group.add(roofCrossH, roofCrossV);
    }

    if (isFireTruck) {
      // Fire Brigade Aluminum Ladder Rack + Water Cannon on Roof
      for (const lx of [-0.35, 0.35]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.12, cfg.cabL * 0.88),
          _chromeMat,
        );
        rail.position.set(lx, 0.44 + cfg.h + cfg.cabH, 0.35);
        group.add(rail);
      }
      for (let rz = -1.1; rz <= 1.7; rz += 0.45) {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.06), _chromeMat);
        rung.position.set(0, 0.44 + cfg.h + cfg.cabH, rz);
        group.add(rung);
      }
      const cannonBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 10), _chromeMat);
      cannonBase.position.set(0, 0.52 + cfg.h + cfg.cabH, -0.5);
      group.add(cannonBase);
    }
  } else {
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w * 0.78, cfg.cabH, cfg.cabL),
      _glassMat,
    );
    cabin.position.set(0, 0.36 + cfg.h + cfg.cabH * 0.45, style === 'limousine' ? 0.05 : 0.15);
    cabin.castShadow = true;
    group.add(cabin);

    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w * 0.72, 0.07, cfg.cabL * 0.68),
      isEmergencyPolice ? _chromeMat : paintMat,
    );
    roofCap.position.set(0, 0.36 + cfg.h + cfg.cabH * 0.9, style === 'limousine' ? 0.05 : 0.2);
    group.add(roofCap);
  }

  // Limousine B/C Pillar Dividers
  if (style === 'limousine') {
    for (const pz of [-1.0, 0.05, 1.1]) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w * 0.8, cfg.cabH * 0.92, 0.16),
        paintMat,
      );
      pillar.position.set(0, 0.36 + cfg.h + cfg.cabH * 0.45, pz);
      group.add(pillar);
    }
  }

  // Emergency Roof Lightbar (Police, Rescue Van, Ambulance, Fire Brigade)
  if (isEmergencyPolice || style === 'van' || isFireTruck) {
    const barY = 0.42 + cfg.h + cfg.cabH;
    const barZ = isEmergencyPolice ? 0.1 : -cfg.l * 0.28;
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.09, 0.28), _darkTrimMat);
    barBase.position.set(0, barY, barZ);
    group.add(barBase);

    const leftColor = 0xef4444;
    const rightColor = isFireTruck ? 0xfacc15 : 0x3b82f6;
    const redLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.14, 0.24),
      new THREE.MeshBasicMaterial({ color: leftColor }),
    );
    redLamp.position.set(-0.35, barY + 0.06, barZ);
    const blueLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.14, 0.24),
      new THREE.MeshBasicMaterial({ color: rightColor }),
    );
    blueLamp.position.set(0.35, barY + 0.06, barZ);
    group.add(redLamp, blueLamp);
    policeBarLights.push(redLamp, blueLamp);
  }

  // Side Intake Scoops for Supercars & Hypercars
  if (style === 'w16_hyper' || style === 'nordic_hyper' || style === 'angular_super' || style === 'legendary') {
    for (const sx of [-1, 1]) {
      const intake = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.32, 1.35),
        style === 'w16_hyper' ? _chromeMat : accentMat,
      );
      intake.position.set(sx * (cfg.w * 0.5 + 0.04), 0.52, 0.35);
      group.add(intake);
    }
  }

  // 5. Rear Diffuser + Exhausts
  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(cfg.w * 0.88, 0.22, 0.26),
    _darkTrimMat,
  );
  diffuser.position.set(0, 0.34, cfg.l * 0.5 - 0.05);
  group.add(diffuser);

  const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.22, 10);
  exhaustGeo.rotateX(Math.PI / 2);
  const isQuadExhaust =
    style === 'w16_hyper' ||
    style === 'nordic_hyper' ||
    style === 'legendary' ||
    style === 'angular_super';
  const exOffsets = isQuadExhaust ? [-0.56, -0.34, 0.34, 0.56] : [-0.48, 0.48];
  for (const sx of exOffsets) {
    const ex = new THREE.Mesh(exhaustGeo, _rimMat);
    ex.position.set(sx, 0.32, cfg.l * 0.5 + 0.06);
    group.add(ex);
  }

  // Optional Underglow Strip
  if (underglowHex) {
    const ugMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(underglowHex),
      transparent: true,
      opacity: 0.72,
    });
    for (const sx of [-cfg.w * 0.48, cfg.w * 0.48]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, cfg.l * 0.72), ugMat);
      strip.position.set(sx, 0.22, 0);
      group.add(strip);
    }
  }

  // 6. Rear Aero Wing / Spoiler
  if (cfg.spoiler) {
    const isHighWing =
      style === 'aero_super' ||
      style === 'nordic_hyper' ||
      style === 'angular_super' ||
      style === 'legendary';
    const wingY = 0.38 + cfg.h + (isHighWing ? 0.38 : 0.22);
    const wingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w + 0.14, 0.07, 0.36),
      style === 'legendary' || decal === 'neon_trim' ? accentMat : _carbonMat,
    );
    wingBlade.position.set(0, wingY, cfg.l * 0.44);
    wingBlade.castShadow = true;
    group.add(wingBlade);

    for (const px of [-cfg.w * 0.32, cfg.w * 0.32]) {
      const pylon = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, wingY - (0.36 + cfg.h), 0.18),
        _darkTrimMat,
      );
      pylon.position.set(px, (wingY + 0.36 + cfg.h) * 0.5, cfg.l * 0.44);
      group.add(pylon);
    }
  }

  // 7. Side Skirts / Neon Trim
  if (cfg.wide > 0.04 || decal === 'neon_trim') {
    for (const sx of [-1, 1]) {
      const flare = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.06, cfg.wide), 0.18, cfg.l * 0.74),
        decal === 'neon_trim' || style === 'cyber' ? accentMat : paintMat,
      );
      flare.position.set(sx * (cfg.w * 0.5 + cfg.wide * 0.35), 0.38, 0);
      group.add(flare);
    }
  }

  // 8. Headlights (front -Z) & Taillights (rear +Z)
  for (const sx of [-cfg.w * 0.33, cfg.w * 0.33]) {
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    });
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.12), hlMat);
    hl.position.set(sx, 0.48, -cfg.l * 0.5);
    group.add(hl);
    headlights.push(hl);

    const tlMat = _taillightMat.clone();
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.1), tlMat);
    tl.position.set(sx, 0.52, cfg.l * 0.5);
    group.add(tl);
    brakeLights.push(tl);
  }

  // 9. Spinning Wheels
  const wheelX = cfg.w * 0.5 + cfg.wide * 0.42;
  const frontZ = -cfg.l * 0.33;
  const rearZ = cfg.l * 0.33;
  const wScale = isFireTruck ? 1.16 : style === 'van' || style === 'suv_police' ? 1.06 : 1;
  const wList = [
    ...buildWheelPair(wheelX, 0.36 * wScale, frontZ, wScale),
    ...buildWheelPair(wheelX, 0.36 * wScale, rearZ, wScale * 1.03),
    ...(isFireTruck ? buildWheelPair(wheelX, 0.36 * wScale, 0.35, wScale * 1.03) : []),
  ];
  wList.forEach((w) => {
    group.add(w);
    wheels.push(w);
  });

  // 10. Nitro Flame Cones
  const nitroFlames = new THREE.Group();
  const flameGeo = new THREE.ConeGeometry(0.15, 1.2, 10);
  flameGeo.rotateX(Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });
  for (const sx of [-0.48, 0.48]) {
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(sx, 0.32, cfg.l * 0.5 + 0.65);
    nitroFlames.add(flame);
  }
  nitroFlames.visible = false;
  group.add(nitroFlames);

  // 11. Shield Bubble
  const shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.9, 18, 14),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.24,
      wireframe: true,
    }),
  );
  shieldMesh.scale.set(0.65, 0.55, cfg.l / 4.2);
  shieldMesh.position.y = 0.75;
  shieldMesh.visible = false;
  group.add(shieldMesh);

  // 12. Visual Damage Scratch Overlays
  const scratchMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.95,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const scratchPositions: [number, number, number, number, number, number][] = [
    [cfg.w * 0.49, 0.58, -0.6, 0.06, 0.18, 1.2],
    [-cfg.w * 0.49, 0.55, 0.3, 0.06, 0.2, 1.4],
    [0, 0.39 + cfg.h, -cfg.l * 0.34, cfg.w * 0.55, 0.05, 0.8],
  ];
  for (const [x, y, z, sx, sy, sz] of scratchPositions) {
    const sc = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), scratchMat);
    sc.position.set(x, y, z);
    sc.visible = false;
    group.add(sc);
    damageOverlays.push(sc);
  }

  // 13. Signature Ability Aura Ring
  const abilityAuraMesh = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(cfg.w, cfg.l) * 0.52, 0.065, 8, 28),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(underglowHex ?? accentHex),
      transparent: true,
      opacity: 0.85,
    }),
  );
  abilityAuraMesh.rotation.x = Math.PI / 2;
  abilityAuraMesh.position.y = 0.22;
  abilityAuraMesh.visible = false;
  group.add(abilityAuraMesh);

  return {
    group,
    bodyMaterials,
    wheels,
    nitroFlames,
    shieldMesh,
    damageOverlays,
    brakeLights,
    headlights,
    policeBarLights,
    abilityAuraMesh,
    smokeAnchor: new THREE.Vector3(0, 0.65 + cfg.h * 0.4, -cfg.l * 0.34),
    halfWidth: (cfg.w + cfg.wide * 0.8) * 0.44,
    halfLength: cfg.l * 0.45,
  };
}

const TRAFFIC_PALETTE = [
  0xe2e8f0, 0x3b82f6, 0xef4444, 0xf59e0b, 0x10b981, 0x64748b, 0x8b5cf6, 0x06b6d4,
];

export function buildTrafficVehicleModel(
  type: TrafficVehicleType,
  shadowTex: THREE.CanvasTexture,
): TrafficVehicleRig {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const emergencyLights: THREE.Mesh[] = [];
  const colorHex = TRAFFIC_PALETTE[Math.floor(Math.random() * TRAFFIC_PALETTE.length)];

  const paintMat = new THREE.MeshStandardMaterial({
    color:
      type === 'bus'
        ? 0xf59e0b
        : type === 'truck'
          ? 0xdbeafe
          : type === 'limousine'
            ? 0x0f172a
            : type === 'police'
              ? 0x0f172a
              : type === 'ambulance'
                ? 0xf8fafc
                : type === 'fire_truck'
                  ? 0xdc2626
                  : colorHex,
    roughness: 0.32,
    metalness: 0.55,
  });

  let w = 1.9;
  let l = 4.3;
  let h = 0.55;
  let heightClearance = 1.5;

  if (type === 'suv') {
    w = 2.02;
    l = 4.65;
    h = 0.72;
    heightClearance = 1.7;
  } else if (type === 'sports') {
    w = 1.94;
    l = 4.4;
    h = 0.45;
    heightClearance = 1.3;
  } else if (type === 'supercar') {
    w = 2.06;
    l = 4.6;
    h = 0.4;
    heightClearance = 1.25;
  } else if (type === 'bus') {
    w = 2.35;
    l = 9.2;
    h = 2.15;
    heightClearance = 2.9;
  } else if (type === 'truck') {
    w = 2.4;
    l = 9.6;
    h = 2.35;
    heightClearance = 3.1;
  } else if (type === 'van') {
    w = 2.06;
    l = 5.2;
    h = 1.25;
    heightClearance = 2.0;
  } else if (type === 'motorbike') {
    w = 0.78;
    l = 2.25;
    h = 0.68;
    heightClearance = 1.45;
  } else if (type === 'limousine') {
    w = 2.04;
    l = 6.9;
    h = 0.56;
    heightClearance = 1.5;
  } else if (type === 'police') {
    w = 1.98;
    l = 4.7;
    h = 0.52;
    heightClearance = 1.55;
  } else if (type === 'ambulance') {
    w = 2.08;
    l = 5.25;
    h = 1.35;
    heightClearance = 2.1;
  } else if (type === 'fire_truck') {
    w = 2.26;
    l = 6.8;
    h = 1.85;
    heightClearance = 2.65;
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.32, l * 1.12),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  if (type === 'motorbike') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 1.9), paintMat);
    chassis.position.y = 0.58;
    chassis.castShadow = true;
    group.add(chassis);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.42), _glassMat);
    windshield.position.set(0, 0.92, 0.52);
    group.add(windshield);

    const riderTorso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.45), _darkTrimMat);
    riderTorso.position.set(0, 1.08, -0.05);
    group.add(riderTorso);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), paintMat);
    helmet.position.set(0, 1.48, 0.06);
    group.add(helmet);

    for (const wz of [-0.72, 0.72]) {
      const wheel = new THREE.Mesh(_sharedWheelGeo, _tireMat);
      wheel.scale.set(0.65, 0.9, 0.9);
      wheel.position.set(0, 0.34, wz);
      group.add(wheel);
      wheels.push(wheel);
    }
  } else if (type === 'truck') {
    const trailer = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, l * 0.68),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65, metalness: 0.1 }),
    );
    trailer.position.set(0, 0.5 + h * 0.5, -l * 0.14);
    trailer.castShadow = true;
    group.add(trailer);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.74, l * 0.24), paintMat);
    cab.position.set(0, 0.42 + h * 0.37, l * 0.36);
    cab.castShadow = true;
    group.add(cab);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.55, 0.2), _glassMat);
    glass.position.set(0, 1.55, l * 0.47);
    group.add(glass);

    [l * 0.34, -l * 0.1, -l * 0.38].forEach((wz) => {
      buildWheelPair(w * 0.48, 0.42, wz, 1.18).forEach((wh) => {
        group.add(wh);
        wheels.push(wh);
      });
    });
  } else if (type === 'bus') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), paintMat);
    body.position.y = 0.4 + h * 0.5;
    body.castShadow = true;
    group.add(body);

    const windowBand = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.04, 0.72, l * 0.86),
      _glassMat,
    );
    windowBand.position.set(0, 1.72, 0.25);
    group.add(windowBand);

    [l * 0.34, -l * 0.32].forEach((wz) => {
      buildWheelPair(w * 0.48, 0.42, wz, 1.16).forEach((wh) => {
        group.add(wh);
        wheels.push(wh);
      });
    });
  } else if (type === 'fire_truck') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), paintMat);
    body.position.y = 0.4 + h * 0.5;
    body.castShadow = true;
    group.add(body);

    const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.52, 0.22), _glassMat);
    win.position.set(0, 1.62, l * 0.48);
    group.add(win);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.05, 0.22, l * 0.92),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 }),
    );
    stripe.position.set(0, 1.05, 0);
    group.add(stripe);

    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, l * 0.72), _chromeMat);
    ladder.position.set(0, 0.48 + h, -0.35);
    group.add(ladder);

    const rLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.14, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    );
    const yLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.14, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    );
    rLamp.position.set(-0.38, 0.56 + h, l * 0.32);
    yLamp.position.set(0.38, 0.56 + h, l * 0.32);
    group.add(rLamp, yLamp);
    emergencyLights.push(rLamp, yLamp);

    [l * 0.34, -0.1, -l * 0.36].forEach((wz) => {
      buildWheelPair(w * 0.48, 0.42, wz, 1.15).forEach((wh) => {
        group.add(wh);
        wheels.push(wh);
      });
    });
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), paintMat);
    base.position.y = 0.34 + h * 0.5;
    base.castShadow = true;
    group.add(base);

    if (type !== 'van' && type !== 'ambulance') {
      const cabH = type === 'suv' ? 0.54 : type === 'supercar' ? 0.34 : 0.44;
      const cabL = type === 'limousine' ? l * 0.62 : type === 'suv' ? l * 0.58 : l * 0.46;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, cabH, cabL), _glassMat);
      cabin.position.set(0, 0.34 + h + cabH * 0.45, -0.1);
      cabin.castShadow = true;
      group.add(cabin);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.07, cabL * 0.7), paintMat);
      roof.position.set(0, 0.34 + h + cabH * 0.9, -0.12);
      group.add(roof);

      if (type === 'police') {
        const doorPanel = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.04, h * 0.85, cabL * 0.85),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
        );
        doorPanel.position.set(0, 0.34 + h * 0.5, -0.05);
        group.add(doorPanel);

        const rLamp = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.14, 0.24),
          new THREE.MeshBasicMaterial({ color: 0xef4444 }),
        );
        const bLamp = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.14, 0.24),
          new THREE.MeshBasicMaterial({ color: 0x3b82f6 }),
        );
        rLamp.position.set(-0.34, 0.44 + h + cabH, -0.1);
        bLamp.position.set(0.34, 0.44 + h + cabH, -0.1);
        group.add(rLamp, bLamp);
        emergencyLights.push(rLamp, bLamp);
      }
    } else {
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.46, 0.2), _glassMat);
      win.position.set(0, 1.22, l * 0.48);
      group.add(win);

      if (type === 'ambulance') {
        const medRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
        const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.2, l * 0.88), medRed);
        band.position.set(0, 0.82, 0);
        group.add(band);

        const rLamp = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.14, 0.22),
          new THREE.MeshBasicMaterial({ color: 0xef4444 }),
        );
        const bLamp = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.14, 0.22),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
        );
        rLamp.position.set(-0.34, 0.42 + h, l * 0.34);
        bLamp.position.set(0.34, 0.42 + h, l * 0.34);
        group.add(rLamp, bLamp);
        emergencyLights.push(rLamp, bLamp);
      }
    }

    if (type === 'supercar' || type === 'sports') {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.07, 0.3), _darkTrimMat);
      wing.position.set(0, 0.55 + h, -l * 0.44);
      group.add(wing);
    }

    [l * 0.32, -l * 0.32].forEach((wz) => {
      buildWheelPair(w * 0.49, 0.36, wz, 1).forEach((wh) => {
        group.add(wh);
        wheels.push(wh);
      });
    });
  }

  // Headlights facing player (+Z)
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.2,
  });
  if (type === 'motorbike') {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.1), hlMat);
    hl.position.set(0, 0.76, l * 0.48);
    group.add(hl);
  } else {
    for (const sx of [-w * 0.34, w * 0.34]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.1), hlMat);
      hl.position.set(sx, 0.58, l * 0.5);
      group.add(hl);
    }
  }

  const sigMatL = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const sigMatR = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const signalLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.16), sigMatL);
  const signalRight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.16), sigMatR);
  signalLeft.position.set(-w * 0.47, 0.68, l * 0.49);
  signalRight.position.set(w * 0.47, 0.68, l * 0.49);
  signalLeft.visible = false;
  signalRight.visible = false;
  group.add(signalLeft, signalRight);

  return {
    group,
    wheels,
    signalLeft,
    signalRight,
    emergencyLights,
    halfWidth: w * 0.44,
    halfLength: l * 0.45,
    heightClearance,
  };
}

export function buildBossCarModel(
  bossType: BossType,
  shadowTex: THREE.CanvasTexture,
): BossVehicleRig {
  const colorMap: Record<BossType, { body: number; accent: number }> = {
    black_hypercar: { body: 0x09090b, accent: 0xef4444 },
    police_interceptor: { body: 0x0f172a, accent: 0x38bdf8 },
    highway_hunter: { body: 0x7f1d1d, accent: 0xf59e0b },
    cyber_beast: { body: 0x4c1d95, accent: 0xec4899 },
  };
  const cfg = colorMap[bossType];
  const rig = buildPlayerCarModel(
    bossType === 'police_interceptor' ? 'police' : 'legendary',
    `#${cfg.body.toString(16).padStart(6, '0')}`,
    `#${cfg.accent.toString(16).padStart(6, '0')}`,
    shadowTex,
    'neon_trim',
  );

  const beaconLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.16, 0.25),
    new THREE.MeshBasicMaterial({ color: 0xef4444 }),
  );
  const beaconRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.16, 0.25),
    new THREE.MeshBasicMaterial({ color: bossType === 'police_interceptor' ? 0x3b82f6 : 0xf59e0b }),
  );
  beaconLeft.position.set(-0.45, 1.32, 0.3);
  beaconRight.position.set(0.45, 1.32, 0.3);
  rig.group.add(beaconLeft, beaconRight);

  return {
    group: rig.group,
    wheels: rig.wheels,
    beaconLeft,
    beaconRight,
    halfWidth: rig.halfWidth,
    halfLength: rig.halfLength,
  };
}

export function buildCoinModel(): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.14, 18),
    new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.8,
    }),
  );
  disc.rotation.x = Math.PI / 2;
  g.add(disc);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.05, 8, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
    }),
  );
  innerRing.position.z = 0.07;
  g.add(innerRing);
  g.position.y = 0.95;
  return g;
}

export function buildRepairPickupModel(tier: RepairPickupTier): THREE.Group {
  const g = new THREE.Group();
  const colorMap: Record<RepairPickupTier, number> = {
    small: 0x10b981,
    medium: 0x06b6d4,
    large: 0xf59e0b,
    legendary: 0xfef08a,
  };
  const col = colorMap[tier];

  const mat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: tier === 'legendary' ? 1.4 : 0.95,
    roughness: 0.2,
    metalness: 0.35,
  });

  const barH = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.28), mat);
  const barV = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.28), mat);
  g.add(barH, barV);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.06, 10, 24),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.78 }),
  );
  g.add(ring);

  if (tier === 'legendary' || tier === 'large') {
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }),
    );
    outerRing.rotation.x = Math.PI / 3;
    g.add(outerRing);
  }

  g.position.y = 1.1;
  return g;
}

export function buildPowerUpModel(type: PowerUpType): THREE.Group {
  const g = new THREE.Group();
  const colorMap: Record<PowerUpType, number> = {
    nitro: 0x38bdf8,
    magnet: 0xf43f5e,
    shield: 0x22d3ee,
    slow_mo: 0xa855f7,
    emergency_repair: 0x34d399,
  };
  const col = colorMap[type];

  const coreMat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: 1.15,
    roughness: 0.18,
    metalness: 0.55,
  });

  const core =
    type === 'shield'
      ? new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), coreMat)
      : type === 'slow_mo'
        ? new THREE.Mesh(new THREE.TorusKnotGeometry(0.36, 0.11, 40, 8), coreMat)
        : type === 'magnet'
          ? new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.14, 10, 18, Math.PI * 1.25), coreMat)
          : new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.92, 6), coreMat);

  g.add(core);

  const cage = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.055, 8, 22),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 }),
  );
  cage.rotation.x = Math.PI / 2;
  g.add(cage);

  g.position.y = 1.15;
  return g;
}
