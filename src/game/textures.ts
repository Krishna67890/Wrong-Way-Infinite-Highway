import * as THREE from 'three';
import { WorldDefinition } from './types';

export const LANE_COUNT = 6;
export const LANE_WIDTH = 3.5;
export const ROAD_WIDTH = LANE_COUNT * LANE_WIDTH; // 21.0 units
export const SEGMENT_LENGTH = 40;

export function getLaneCenterX(laneIndex: number): number {
  return (laneIndex - (LANE_COUNT - 1) / 2) * LANE_WIDTH;
}

export function createHighwayAsphaltTexture(
  world: WorldDefinition,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const width = 1024;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base asphalt fill
  ctx.fillStyle = world.roadColor;
  ctx.fillRect(0, 0, width, height);

  // Subtle asphalt grain + tire wear tracks along each of the 6 lanes
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const shade = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)';
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, 2, 2);
  }

  const lanePx = width / LANE_COUNT;

  // Subtle darker tire track streaks inside every lane
  for (let l = 0; l < LANE_COUNT; l++) {
    const cx = (l + 0.5) * lanePx;
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(cx - lanePx * 0.24, 0, lanePx * 0.14, height);
    ctx.fillRect(cx + lanePx * 0.1, 0, lanePx * 0.14, height);
  }

  // Wet sheen reflection streaks for neon city & rainy highway
  if (world.id === 'rainy_highway' || world.id === 'neon_city') {
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.04)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.06)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Outer edge safety lines (solid amber/red/yellow)
  ctx.fillStyle = world.edgeLineColor;
  ctx.fillRect(10, 0, 12, height);
  ctx.fillRect(width - 22, 0, 12, height);

  // 5 internal lane dividers creating 6 crystal-clear lanes
  for (let d = 1; d < LANE_COUNT; d++) {
    const x = d * lanePx;
    if (d === 3) {
      // Center double-dashed/solid median divider to emphasize wrong-way highway split
      ctx.fillStyle = world.edgeLineColor;
      for (let y = 20; y < height; y += 128) {
        ctx.fillRect(x - 10, y, 7, 74);
        ctx.fillRect(x + 3, y, 7, 74);
      }
    } else {
      ctx.fillStyle = world.laneLineColor;
      for (let y = 24; y < height; y += 128) {
        ctx.fillRect(x - 5, y, 10, 68);
      }
    }
  }

  // Subtle oncoming traffic directional arrows painted on the lanes (pointing down/+Z toward player)
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let l = 0; l < LANE_COUNT; l++) {
    const cx = (l + 0.5) * lanePx;
    const ay = l % 2 === 0 ? 256 : 768;
    ctx.beginPath();
    ctx.moveTo(cx, ay + 48);
    ctx.lineTo(cx - 20, ay + 12);
    ctx.lineTo(cx - 7, ay + 12);
    ctx.lineTo(cx - 7, ay - 34);
    ctx.lineTo(cx + 7, ay - 34);
    ctx.lineTo(cx + 7, ay + 12);
    ctx.lineTo(cx + 20, ay + 12);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createShowroomFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c0f17';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  const rad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.48);
  rad.addColorStop(0, 'rgba(30, 41, 59, 0.65)');
  rad.addColorStop(0.6, 'rgba(15, 23, 42, 0.35)');
  rad.addColorStop(1, 'rgba(8, 10, 15, 1)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, size, size);

  // Turntable rings
  [180, 260, 340, 420].forEach((r, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = idx === 1 ? 'rgba(245, 158, 11, 0.45)' : 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = idx === 1 ? 3 : 1.5;
    ctx.stroke();
  });

  // Radial tick marks around turntable
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.lineWidth = 2;
  for (let a = 0; a < 36; a++) {
    const ang = (a / 36) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * 248, cy + Math.sin(ang) * 248);
    ctx.lineTo(cx + Math.cos(ang) * 260, cy + Math.sin(ang) * 260);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}
