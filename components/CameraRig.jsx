import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Camera keyframes ────────────────────────────────────────────────────────
// New timeline (matches Cookie.jsx / CookiesPlate.jsx):
//  0.00  Scene 1 : top-down reveal
//  0.15  Scene 2 : orbit angle
//  0.30  Scene 3 : angled close
//  0.44  Scene 4 : eye-level roll start
//  0.56  Scene 4A: gentle orbit — cookie slows, anticipation builds
//  0.68  Scene 4B: cookie rolls toward camera — slight zoom, dramatic
//  0.76  Scene 5 : impact follow
//  0.87  Scene 6 : begin cinematic zoom-out hero reveal
//  1.00  Scene 6 : full plate, camera zoomed out + panned right
const KEYFRAMES = [
  { p: 0.00, pos: [0,    0.5,  4.0 ], target: [0, 0.3, 0] },  // front view — hero reveal
  { p: 0.15, pos: [2.8,  2.0,  2.8 ], target: [0, 0,   0] },  // orbit start
  { p: 0.30, pos: [1.8,  0.9,  3.5 ], target: [0, 0,   0] },  // angled
  { p: 0.44, pos: [0,    0.4,  4.5 ], target: [0, 0,   0] },  // eye-level
  { p: 0.56, pos: [-2.2, 1.2,  4.8 ], target: [0, 0,   2] },  // Scene 4A: orbit
  { p: 0.68, pos: [0,    0.2,  5.5 ], target: [0, 0,   3] },  // Scene 4B: toward cam
  { p: 0.76, pos: [-1.0, 0.8,  4.2 ], target: [0, 0,   0] },  // impact follow
  { p: 0.87, pos: [1.5,  1.8,  3.5 ], target: [0, 0,   0] },  // hero begin
  { p: 1.00, pos: [3.0,  2.8,  4.0 ], target: [0, 0,   0] },  // zoom out + pan right
];

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
// Two oscillators at inharmonic frequencies blend to create organic camera drift.
const HANDHELD_FREQ_X_LOW  = 0.37;  // Hz – primary horizontal sway
const HANDHELD_FREQ_X_HIGH = 0.71;  // Hz – secondary horizontal shimmer
const HANDHELD_AMP_X_LOW   = 0.006; // world units amplitude (primary)
const HANDHELD_AMP_X_HIGH  = 0.003; // world units amplitude (secondary)
const HANDHELD_FREQ_Y_LOW  = 0.43;  // Hz – primary vertical drift
const HANDHELD_FREQ_Y_HIGH = 0.89;  // Hz – secondary vertical shimmer
const HANDHELD_AMP_Y_LOW   = 0.005; // world units amplitude (primary)
const HANDHELD_AMP_Y_HIGH  = 0.002; // world units amplitude (secondary)

// Reusable vectors (avoid per-frame allocation)
const _targetPos  = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

export default function CameraRig({ scrollProgress, mouseRef }) {
  const { camera } = useThree();
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const timeRef = useRef(0);
  // Smoothed mouse offsets for camera lag (different lerp speed than cookie)
  const camMouseX = useRef(0);
  const camMouseY = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    const p = scrollProgress.current;
    const { pos, target } = lerpKeyframes(p);

    // ── FOV: gently narrows toward final reveal ────────────────────────────
    // Opens slightly wider for the zoom-out in the final scene
    let fov = 45;
    if (p < 0.87) {
      fov = 45 - p * 5;         // 45° → ~40° through roll
    } else {
      const finalT = (p - 0.87) / 0.13;
      fov = 40 + finalT * 8;    // 40° → 48° for cinematic zoom-out reveal
    }
    camera.fov = fov;
    camera.updateProjectionMatrix();

    // ── Subtle parallax Y drift ────────────────────────────────────────────
    const parallaxY = -p * 0.3;

    // ── Subtle handheld micro-movement ────────────────────────────────────
    const microX = Math.sin(t * HANDHELD_FREQ_X_LOW)  * HANDHELD_AMP_X_LOW
                 + Math.sin(t * HANDHELD_FREQ_X_HIGH) * HANDHELD_AMP_X_HIGH;
    const microY = Math.cos(t * HANDHELD_FREQ_Y_LOW)  * HANDHELD_AMP_Y_LOW
                 + Math.cos(t * HANDHELD_FREQ_Y_HIGH) * HANDHELD_AMP_Y_HIGH;

    // ── Mouse parallax on camera (subtle shift, only in idle/early scenes) ─
    if (mouseRef && p < 0.44) {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      camMouseX.current += (mx * 0.04 - camMouseX.current) * 0.03;
      camMouseY.current += (my * 0.03 - camMouseY.current) * 0.03;
    } else {
      camMouseX.current *= 0.96;
      camMouseY.current *= 0.96;
    }

    _targetPos.set(
      pos[0] + microX + camMouseX.current,
      pos[1] + parallaxY + microY + camMouseY.current,
      pos[2]
    );
    _lookTarget.set(target[0], target[1], target[2]);

    // Smooth camera position (lerp factor 0.04 = cinematic lag)
    camera.position.lerp(_targetPos, 0.04);

    // Smooth lookAt
    currentLookAt.current.lerp(_lookTarget, 0.04);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
