import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Camera keyframes ────────────────────────────────────────────────────────
// Timeline aligned to new 6-scene scroll:
//  Scene 1 (0.00-0.12): flat cookie on plate — camera slightly elevated, looking down
//  Scene 2 (0.12-0.28): cookie rises upright
//  Scene 3 (0.28-0.44): cookie wheels in place, plate exits — camera swings to orbit
//  Scenes 4-6 (0.44-1.00): unchanged cinematic roll + impact + showcase
const KEYFRAMES = [
  { p: 0.00, pos: [0,    1.4,  4.2], target: [0, -0.20, 0] }, // bird's-eye: flat cookie on plate
  { p: 0.12, pos: [0,    1.4,  4.2], target: [0, -0.20, 0] }, // holds for flat scene
  { p: 0.28, pos: [0,    0.5,  4.0], target: [0,  0.10, 0] }, // levels up as cookie stands
  { p: 0.44, pos: [2.8,  2.0,  2.8], target: [0,  0,    0] }, // orbit start (was p=0.18)
  { p: 0.54, pos: [1.8,  0.9,  3.5], target: [0,  0,    0] }, // angled
  { p: 0.67, pos: [0,    0.4,  4.5], target: [0,  0,    0] }, // eye-level
  { p: 0.74, pos: [-2.2, 1.2,  4.8], target: [0,  0,    2] }, // gentle orbit
  { p: 0.76, pos: [-1.0, 0.8,  4.2], target: [0,  0,    0] }, // impact follow
  // ── Cinematic plate reveal: zoom IN, swing up, slight rotation ────────────
  { p: 0.84, pos: [0,    0.8,  2.8], target: [0,  0,    0] }, // zoom into front
  { p: 0.92, pos: [0.6,  2.4,  2.0], target: [0,  0,    0] }, // swing to top-45°
  { p: 1.00, pos: [1.8,  2.8,  1.8], target: [0,  0,    0] }, // slight rotation
];

// ─── Cinematic page-load intro ────────────────────────────────────────────────
// Camera starts elevated (bird's-eye) and sweeps down to the hero front view.
// Duration is in seconds. Aborts instantly if the user starts scrolling.
const INTRO_DURATION    = 3.2;
const INTRO_START_POS   = [0, 4.5, 5.5];
const INTRO_START_FOV   = 62;

function smoothstep(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function lerpKeyframes(progress) {
  if (progress <= KEYFRAMES[0].p) {
    return { pos: KEYFRAMES[0].pos, target: KEYFRAMES[0].target };
  }
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  if (progress >= last.p) {
    return { pos: last.pos, target: last.target };
  }

  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[i + 1];
    if (progress >= a.p && progress <= b.p) {
      const t = smoothstep((progress - a.p) / (b.p - a.p));
      return {
        pos: [
          a.pos[0] + (b.pos[0] - a.pos[0]) * t,
          a.pos[1] + (b.pos[1] - a.pos[1]) * t,
          a.pos[2] + (b.pos[2] - a.pos[2]) * t,
        ],
        target: [
          a.target[0] + (b.target[0] - a.target[0]) * t,
          a.target[1] + (b.target[1] - a.target[1]) * t,
          a.target[2] + (b.target[2] - a.target[2]) * t,
        ],
      };
    }
  }

  return { pos: last.pos, target: last.target };
}

// ── Subtle handheld micro-movement parameters ──────────────────────────────────
const HANDHELD_FREQ_X_LOW  = 0.37;
const HANDHELD_FREQ_X_HIGH = 0.71;
const HANDHELD_AMP_X_LOW   = 0.006;
const HANDHELD_AMP_X_HIGH  = 0.003;
const HANDHELD_FREQ_Y_LOW  = 0.43;
const HANDHELD_FREQ_Y_HIGH = 0.89;
const HANDHELD_AMP_Y_LOW   = 0.005;
const HANDHELD_AMP_Y_HIGH  = 0.002;

// Reusable vectors (avoid per-frame allocation)
const _targetPos  = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

export default function CameraRig({ scrollProgress, mouseRef }) {
  const { camera } = useThree();
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const timeRef = useRef(0);
  const camMouseX = useRef(0);
  const camMouseY = useRef(0);
  // Intro animation state
  const introElapsedRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    const p = scrollProgress.current;

    // ── Cinematic intro: abort on first scroll ─────────────────────────────
    if (p >= 0.015) introElapsedRef.current = INTRO_DURATION;
    const introActive = introElapsedRef.current < INTRO_DURATION;
    if (introActive) introElapsedRef.current += delta;

    // ── Determine desired position & FOV ──────────────────────────────────
    let desiredX, desiredY, desiredZ;
    let desiredLookX = 0, desiredLookY = 0.3, desiredLookZ = 0;
    let fov;

    if (introActive) {
      // Sweep from bird's-eye to hero front view
      const introT  = smoothstep(Math.min(1, introElapsedRef.current / INTRO_DURATION));
      const endPos  = KEYFRAMES[0].pos;
      desiredX      = INTRO_START_POS[0] + (endPos[0] - INTRO_START_POS[0]) * introT;
      desiredY      = INTRO_START_POS[1] + (endPos[1] - INTRO_START_POS[1]) * introT;
      desiredZ      = INTRO_START_POS[2] + (endPos[2] - INTRO_START_POS[2]) * introT;
      desiredLookX  = 0; desiredLookY = -0.2 * introT - 0.2 * (1 - introT); desiredLookZ = 0;
      fov           = INTRO_START_FOV + (45 - INTRO_START_FOV) * introT; // 62→45°
    } else {
      const { pos, target } = lerpKeyframes(p);
      [desiredX, desiredY, desiredZ]         = pos;
      [desiredLookX, desiredLookY, desiredLookZ] = target;

      // ── FOV: narrows through early scenes → zoom IN for plate reveal ────
      if (p < 0.76) {
        fov = 45 - p * 5;               // 45° → ~41° through roll
      } else {
        const finalT = (p - 0.76) / 0.24;
        fov = 41 - finalT * 11;         // 41° → 30° — cinematic zoom IN
      }
    }

    camera.fov = fov;
    camera.updateProjectionMatrix();

    // ── Subtle parallax Y drift ────────────────────────────────────────────
    const parallaxY = introActive ? 0 : -p * 0.3;

    // ── Subtle handheld micro-movement ────────────────────────────────────
    const microX = Math.sin(t * HANDHELD_FREQ_X_LOW)  * HANDHELD_AMP_X_LOW
                 + Math.sin(t * HANDHELD_FREQ_X_HIGH) * HANDHELD_AMP_X_HIGH;
    const microY = Math.cos(t * HANDHELD_FREQ_Y_LOW)  * HANDHELD_AMP_Y_LOW
                 + Math.cos(t * HANDHELD_FREQ_Y_HIGH) * HANDHELD_AMP_Y_HIGH;

    // ── Mouse parallax on camera (idle / early scenes) ─────────────────────
    if (mouseRef && p < 0.54) {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      camMouseX.current += (mx * 0.04 - camMouseX.current) * 0.03;
      camMouseY.current += (my * 0.03 - camMouseY.current) * 0.03;
    } else {
      camMouseX.current *= 0.96;
      camMouseY.current *= 0.96;
    }

    _targetPos.set(
      desiredX + microX + camMouseX.current,
      desiredY + parallaxY + microY + camMouseY.current,
      desiredZ
    );
    _lookTarget.set(desiredLookX, desiredLookY, desiredLookZ);

    // Faster lerp during intro for crisper cinematic feel
    const lerpFactor = introActive ? 0.07 : 0.04;
    camera.position.lerp(_targetPos, lerpFactor);
    currentLookAt.current.lerp(_lookTarget, lerpFactor);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
