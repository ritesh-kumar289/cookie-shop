import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Camera keyframes (progress → position + lookAt) ─────────────────────────
const KEYFRAMES = [
  { p: 0.00, pos: [0,   4,   0.1], target: [0, 0, 0] }, // Scene 1: top-down
  { p: 0.15, pos: [3,   2.2, 3  ], target: [0, 0, 0] }, // Scene 2: orbit
  { p: 0.30, pos: [2,   1,   4  ], target: [0, 0, 0] }, // Scene 3: angled
  { p: 0.45, pos: [0,   0.5, 5  ], target: [0, 0, 0] }, // Scene 4: eye-level
  { p: 0.65, pos: [-1,  1,   4  ], target: [0, 0, 0] }, // Scene 5: follow
  { p: 0.80, pos: [2,   3,   2  ], target: [0, 0, 0] }, // Scene 6: hero shot
  { p: 1.00, pos: [0.5, 0.5, 2  ], target: [0, 0, 0] }, // Scene 6: macro
];

function smoothstep(t) {
  return t * t * (3 - 2 * t);
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

// Reusable vectors (avoid per-frame allocation)
const _targetPos   = new THREE.Vector3();
const _lookTarget  = new THREE.Vector3();

export default function CameraRig({ scrollProgress }) {
  const { camera } = useThree();
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const p = scrollProgress.current;
    const { pos, target } = lerpKeyframes(p);

    // ── Parallax "moving down" feel ───────────────────────────────────────
    // The camera subtly descends as scroll progresses (max −0.5 units over
    // the full journey) so the viewer feels like they are moving deeper into
    // the scene. We also zoom the FOV in slightly for a cinematic push effect.
    const parallaxY = -p * 0.5;
    camera.fov = 45 - p * 6;  // 45° → 39° over the full scroll
    camera.updateProjectionMatrix(); // must be called after changing fov

    _targetPos.set(pos[0], pos[1] + parallaxY, pos[2]);
    _lookTarget.set(target[0], target[1], target[2]);

    // Smooth camera position (lerp factor 0.05 ≈ cinematic lag)
    camera.position.lerp(_targetPos, 0.05);

    // Smooth lookAt
    currentLookAt.current.lerp(_lookTarget, 0.05);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
