import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Camera keyframes ────────────────────────────────────────────────────────
// Timeline:
//  Scene 1 (0.00-0.04): flat cookie on plate — camera slightly elevated, looking down
//  Scene 2 (0.04-0.28): cookie rises upright
//  Scene 3 (0.28-0.44): cookie wheels in place, plate exits — camera swings to orbit
//  Scene 4 Phase A (0.44-0.76): cinematic arc tracking — left sweep → near-pass zoom → right swing
//  Scene 4 Phase B (0.76-0.88): cookie rolls as wheel RIGHT → LEFT + plate reveal zoom
//  Showcase (0.88-1.00): plate reveal
const KEYFRAMES = [
  { p: 0.00, pos: [0,    1.4,  4.2], target: [0, -0.20, 0] }, // bird's-eye: flat cookie on plate
  { p: 0.04, pos: [0,    1.4,  4.2], target: [0, -0.20, 0] }, // holds for flat scene (shortened)
  { p: 0.28, pos: [0,    0.5,  4.0], target: [0,  0.10, 0] }, // levels up as cookie stands
  { p: 0.44, pos: [0.5,  1.0,  4.5], target: [0,   0.1, 0] }, // arc start — slight lean
  // ── Cinematic arc tracking ─────────────────────────────────────────────────
  { p: 0.50, pos: [-0.6, 1.0,  4.3], target: [-0.4, 0, 0.2] }, // track cookie sweeping left
  { p: 0.57, pos: [0,    0.6,  3.6], target: [0,    0, 0.4] }, // pull forward — cookie near camera
  { p: 0.65, pos: [0.7,  1.0,  4.3], target: [0.5,  0, 0]   }, // track cookie swinging right
  { p: 0.76, pos: [0.8,  0.9,  4.3], target: [0.6, 0.0, 0]  }, // arc end, cookie at right
  // ── Plate reveal zoom ─────────────────────────────────────────────────────
  { p: 0.78, pos: [0,    0.7,  3.2], target: [0,    0,   0]  }, // zoom in — plate emerges behind tyre
  { p: 0.81, pos: [0,    0.8,  4.0], target: [0,    0,   0]  }, // cookie crosses centre
  { p: 0.86, pos: [-0.4, 0.8,  4.0], target: [0,    0,   0]  }, // cookie exits left
  { p: 0.88, pos: [0,    0.8,  3.5], target: [0,    0,   0]  }, // transition to plate
  // ── Cinematic plate reveal: zoom IN, swing up, slight rotation ────────────
  { p: 0.92, pos: [0.6,  2.4,  2.0], target: [0,  0,    0]  }, // swing to top-45°
  { p: 1.00, pos: [1.8,  2.8,  1.8], target: [0,  0,    0]  }, // slight rotation
];

// ─── FOV keyframes ──────────────────────────────────────────────────────────
const FOV_KEYFRAMES = [
  { p: 0.00, v: 45 },
  { p: 0.44, v: 43 }, // pre-arc: standard view
  { p: 0.50, v: 47 }, // slight widen as cookie starts sweeping left
  { p: 0.57, v: 33 }, // dramatic ZOOM IN — cookie passing near camera
  { p: 0.65, v: 47 }, // widen back as cookie swings right
  { p: 0.76, v: 44 }, // arc end — cookie arrives at right
  { p: 0.78, v: 34 }, // zoom in — plate emerges behind rolling tyre
  { p: 0.81, v: 42 }, // cookie passing centre
  { p: 0.88, v: 40 }, // transition to plate
  { p: 1.00, v: 30 }, // cinematic zoom-in for plate showcase
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

function lerpFovKeyframes(p) {
  if (p <= FOV_KEYFRAMES[0].p) return FOV_KEYFRAMES[0].v;
  const last = FOV_KEYFRAMES[FOV_KEYFRAMES.length - 1];
  if (p >= last.p) return last.v;
  for (let i = 0; i < FOV_KEYFRAMES.length - 1; i++) {
    const a = FOV_KEYFRAMES[i];
    const b = FOV_KEYFRAMES[i + 1];
    if (p >= a.p && p <= b.p) {
      return a.v + (b.v - a.v) * smoothstep((p - a.p) / (b.p - a.p));
    }
  }
  return last.v;
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

      // ── FOV driven by keyframe table (includes dramatic zoom-through at arc peak)
      fov = lerpFovKeyframes(p);
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

    // ── Mouse parallax on camera (idle / early scenes only) ───────────────
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
      desiredX + microX + camMouseX.current,
      desiredY + parallaxY + microY + camMouseY.current,
      desiredZ
    );
    _lookTarget.set(desiredLookX, desiredLookY, desiredLookZ);

    // Faster lerp during Scene 4 arc + wheel roll for responsive cinematic tracking
    const lerpFactor = introActive ? 0.07 :
      (p >= 0.44 && p < 0.89) ? 0.12 :
      0.04;
    camera.position.lerp(_targetPos, lerpFactor);
    currentLookAt.current.lerp(_lookTarget, lerpFactor);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
