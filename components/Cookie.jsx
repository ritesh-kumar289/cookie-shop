/**
 * Cookie.jsx
 *
 * Single cookie model — drives the cinematic scroll story:
 *
 *  Scene 1  (0.00 – 0.15)  THE REVEAL      : fade in, top-down, gentle float
 *  Scene 2  (0.15 – 0.30)  DISCOVERY ORBIT : counter-rotation while camera orbits
 *  Scene 3  (0.30 – 0.44)  TRANSFORMATION  : cookie tilts upright (rotX → π/2)
 *  Scene 4  (0.44 – 0.76)  THE ROLL        : S-curve + two cinematic sub-scenes
 *  Scene 5  (0.76 – 0.87)  IMPACT          : arrives at plate, bounces, fades out
 *  Scene 6  (0.87 – 1.00)  SHOWCASE        : invisible (plate takes over)
 */

import { useRef, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── DRACO decoder (CDN) ───────────────────────────────────────────────────────
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Smoothstep easing */
function ss(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * Map a global progress p into a local [0,1] t for the window [a, b].
 * Returns 0 before a, 1 after b, smoothstepped in between.
 */
function localT(p, a, b) {
  return ss((p - a) / (b - a));
}

/** Linear interpolation */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Interpolate a value at progress p across a sorted array of {p, v} keyframes.
 * Smoothstep easing between each pair of keyframes.
 */
function kf(frames, progress) {
  if (progress <= frames[0].p) return frames[0].v;
  const last = frames[frames.length - 1];
  if (progress >= last.p) return last.v;
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (progress >= a.p && progress <= b.p) {
      return lerp(a.v, b.v, ss((progress - a.p) / (b.p - a.p)));
    }
  }
  return last.v;
}

// ── S-curve path (full roll: Scene 4 through 4B) ─────────────────────────────
// Bezier control points for the rolling S-curve in the XZ plane.
const ROLL_CURVE = new THREE.CubicBezierCurve3(
  new THREE.Vector3( 0,    0,  0),
  new THREE.Vector3( 1.2,  0,  1.4),
  new THREE.Vector3(-1.2,  0,  2.8),
  new THREE.Vector3( 0,    0,  4.2)
);

// Pre-compute curve length once
const ROLL_CURVE_LENGTH = ROLL_CURVE.getLength();

// ── Keyframe tables ───────────────────────────────────────────────────────────

const KF_OPACITY = [
  { p: 0.00, v: 0 },
  { p: 0.06, v: 1 },   // fade in during scene 1
  { p: 0.72, v: 1 },
  { p: 0.82, v: 0 },   // fade out as plate takes over
  { p: 1.00, v: 0 },
];

// ── Scale: reduced to ~25% of previous ────────────────────────────────────────
const KF_SCALE = [
  { p: 0.00, v: 8.5 },
  { p: 0.15, v: 8.5 },
  { p: 0.30, v: 8.0 },
  { p: 0.44, v: 7.5 },
  { p: 0.76, v: 7.0 },
  { p: 1.00, v: 7.0 },
];

// rotX: flat (0) → upright (π/2) during scene 3
const KF_ROT_X = [
  { p: 0.00, v: 0           },
  { p: 0.30, v: 0           },
  { p: 0.44, v: Math.PI / 2 }, // fully upright (Scene 3 end)
  { p: 0.80, v: Math.PI / 4 }, // partly laid by impact
  { p: 0.87, v: 0           },
  { p: 1.00, v: 0           },
];

// Y float base position
const KF_POS_Y_BASE = [
  { p: 0.00, v: 0   },
  { p: 0.30, v: 0   },
  { p: 0.44, v: 0.2 },
  { p: 0.76, v: 0   },
  { p: 1.00, v: 0   },
];

// ── Cookie apparent radius at scale=1 in world-space units ──────────────────
// The cookie GLB model has a radius of ~0.1 world units at scale 1.
// At scale 8.5: apparent_radius = 0.1 * 8.5 = 0.85 world units.
// For physically correct rolling: rotation_z = arcLen / apparent_radius_world
const COOKIE_RADIUS_AT_SCALE_1 = 0.1;

// Scroll-direction lean sensitivity (rad per unit of normalised scroll delta)
const TILT_SENSITIVITY = 35;

// ─────────────────────────────────────────────────────────────────────────────

export default function Cookie({ scrollProgress }) {
  const groupRef = useRef();
  const { scene } = useGLTF('/models/cookie.glb');
  const timeRef = useRef(0);
  const prevScrollProgressRef = useRef(0);
  const tiltRef = useRef(0); // accumulated scroll-direction tilt (Z)

  // Clone the scene once (memoized) so re-renders don't leak Three.js objects
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    const p   = scrollProgress.current;
    const t   = timeRef.current;
    const grp = groupRef.current;

    // Scroll delta — clamped to prevent sudden jumps
    const MAX_SCROLL_DELTA = 0.04;
    const rawDeltaP = p - prevScrollProgressRef.current;
    const deltaP = Math.min(MAX_SCROLL_DELTA, Math.max(-MAX_SCROLL_DELTA, rawDeltaP));
    prevScrollProgressRef.current = p;

    // ── Opacity ───────────────────────────────────────────────────────────
    const opacity = kf(KF_OPACITY, p);
    grp.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m.transparent !== true) m.transparent = true;
          if (Math.abs(m.opacity - opacity) > 0.001) m.opacity = opacity;
        });
      }
    });

    // ── Scale ─────────────────────────────────────────────────────────────
    const sc = kf(KF_SCALE, p);
    grp.scale.setScalar(sc);

    // ── Rotation X (tilt) ─────────────────────────────────────────────────
    grp.rotation.x = kf(KF_ROT_X, p);

    // ── Rotation Y ────────────────────────────────────────────────────────
    if (p < 0.15) {
      // Scene 1: scroll-synced spin (1 full revolution per scene)
      grp.rotation.y += deltaP * (Math.PI * 2 / 0.15);
    } else if (p < 0.30) {
      grp.rotation.y += delta * 0.18; // Scene 2: gentle orbit
    } else if (p < 0.44) {
      grp.rotation.y += delta * 0.14; // Scene 3: slow down
    }
    // Scene 4+: rotation.y driven by roll tangent below

    // ── Scene 4: ROLL along S-curve (0.44 → 0.76) ────────────────────────
    if (p >= 0.44 && p < 0.76) {
      const rollT   = localT(p, 0.44, 0.76);
      const point   = ROLL_CURVE.getPointAt(rollT);
      const tangent = ROLL_CURVE.getTangentAt(rollT);

      // Position follows curve
      grp.position.set(point.x, kf(KF_POS_Y_BASE, p), point.z);

      // Physically-based rolling rotation:
      // rotation = distance_traveled / wheel_radius_world
      const arcLen          = rollT * ROLL_CURVE_LENGTH;
      const apparentRadius  = COOKIE_RADIUS_AT_SCALE_1 * sc;
      grp.rotation.z        = -(arcLen / apparentRadius);

      // Face direction of travel
      const angle = Math.atan2(tangent.x, tangent.z);
      grp.rotation.y = angle;

      // Micro bounce — more subtle at reduced scale
      const bounce = Math.abs(Math.sin(rollT * Math.PI * 5)) * 0.12;
      grp.position.y += bounce;

      // Subtle scroll-direction lean (tilt)
      const targetTilt = -deltaP * TILT_SENSITIVITY;
      tiltRef.current = lerp(tiltRef.current, targetTilt, 0.08);
      grp.rotation.x += tiltRef.current * 0.4;

    } else if (p < 0.44) {
      // Scenes 1-3: stationary at origin, gentle float
      const floatY = p < 0.30
        ? Math.sin(t * 1.0) * 0.08
        : 0;
      grp.position.set(0, kf(KF_POS_Y_BASE, p) + floatY, 0);
      grp.rotation.z = 0;
      tiltRef.current = lerp(tiltRef.current, 0, 0.06);

      // Micro wobble in scenes 1–2
      if (p < 0.30) {
        grp.rotation.z = Math.sin(t * 2.2) * 0.025;
      }

    } else {
      // Scenes 5-6: cookie rests at plate origin then fades out
      grp.position.set(0, 0, 0);
      if (p >= 0.76 && p < 0.84) {
        const bounceT = localT(p, 0.76, 0.84);
        const settle  = Math.exp(-bounceT * 5) * Math.abs(Math.sin(bounceT * Math.PI * 3)) * 0.3;
        grp.position.y = settle;
      }
      grp.rotation.z = 0;
      tiltRef.current = lerp(tiltRef.current, 0, 0.08);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload('/models/cookie.glb');
