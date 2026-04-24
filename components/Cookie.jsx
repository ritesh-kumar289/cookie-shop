/**
 * Cookie.jsx
 *
 * Single cookie model — drives the entire 6-scene scroll story:
 *
 *  Scene 1  (0.00 – 0.15)  THE REVEAL      : fade in from black, top-down, gentle float
 *  Scene 2  (0.15 – 0.30)  DISCOVERY ORBIT : counter-rotation while camera orbits
 *  Scene 3  (0.30 – 0.45)  TRANSFORMATION  : cookie tilts upright (rotX → π/2)
 *  Scene 4  (0.45 – 0.65)  THE ROLL        : rolls along S-curve path, rotZ synced to distance
 *  Scene 5  (0.65 – 0.80)  IMPACT          : arrives at plate origin, bounces, fades out
 *  Scene 6  (0.80 – 1.00)  SHOWCASE        : invisible (plate takes over)
 */

import { useRef } from 'react';
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

// ── S-curve path (Scene 4 roll) ───────────────────────────────────────────────
// Bezier control points for the rolling S-curve in the XZ plane.
const ROLL_CURVE = new THREE.CubicBezierCurve3(
  new THREE.Vector3( 0,   0,  0),   // start (upright at scene 3 end)
  new THREE.Vector3( 1.5, 0,  1.5), // cp1
  new THREE.Vector3(-1.5, 0,  3),   // cp2
  new THREE.Vector3( 0,   0,  4.5)  // end (plate)
);

// Pre-compute curve length once
const ROLL_CURVE_LENGTH = ROLL_CURVE.getLength();

// ── Keyframe tables ───────────────────────────────────────────────────────────

const KF_OPACITY = [
  { p: 0.00, v: 0   },
  { p: 0.06, v: 1   },  // fade in during scene 1
  { p: 0.62, v: 1   },
  { p: 0.72, v: 0   },  // fade out as plate takes over
  { p: 1.00, v: 0   },
];

const KF_SCALE = [
  { p: 0.00, v: 1.3 },
  { p: 0.15, v: 1.3 },
  { p: 0.30, v: 1.2 },
  { p: 0.45, v: 1.1 },
  { p: 0.65, v: 1.0 },
  { p: 1.00, v: 1.0 },
];

// rotX: flat (0) → upright (π/2) during scene 3, then lay back during roll
const KF_ROT_X = [
  { p: 0.00, v: 0         },
  { p: 0.30, v: 0         },
  { p: 0.45, v: Math.PI / 2 },  // fully upright (Scene 3 end)
  { p: 0.65, v: Math.PI / 4 },  // partly laid by impact
  { p: 0.72, v: 0         },
  { p: 1.00, v: 0         },
];

// Y float (scene 1 breathing) — driven by time, not scroll; see useFrame
const KF_POS_Y_BASE = [
  { p: 0.00, v: 0    },
  { p: 0.30, v: 0    },
  { p: 0.45, v: 0.15 },  // slight lift when going upright
  { p: 0.65, v: 0    },
  { p: 1.00, v: 0    },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function Cookie({ scrollProgress }) {
  const groupRef = useRef();
  const { scene } = useGLTF('/models/cookie.glb');
  const timeRef   = useRef(0);
  const rollYRef  = useRef(0); // accumulated roll rotation-Z (scene 4)

  // Clone the scene so multiple mounts don't share geometry/material state
  const clonedScene = scene.clone();

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    const p   = scrollProgress.current;
    const t   = timeRef.current;
    const grp = groupRef.current;

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

    // ── Rotation Y (continuous spin, speed varies by scene) ───────────────
    let spinSpeed = 0;
    if (p < 0.15)       spinSpeed = 0.55;  // Scene 1: slow elegant spin
    else if (p < 0.30)  spinSpeed = 0.3;   // Scene 2: counter-orbit
    else if (p < 0.45)  spinSpeed = 0.15;  // Scene 3: slowing
    else if (p < 0.65)  spinSpeed = 0;     // Scene 4: rolling controls rotation
    grp.rotation.y += delta * spinSpeed;

    // Scene 2: slight counter-rotation while camera orbits
    if (p >= 0.15 && p < 0.30) {
      grp.rotation.y -= delta * 0.12;
    }

    // ── Scene 4: ROLL along S-curve ───────────────────────────────────────
    if (p >= 0.45 && p < 0.65) {
      const rollT   = localT(p, 0.45, 0.65);
      const point   = ROLL_CURVE.getPointAt(rollT);
      const tangent = ROLL_CURVE.getTangentAt(rollT);

      // Position follows curve
      grp.position.set(point.x, kf(KF_POS_Y_BASE, p), point.z);

      // Rotation Z: roll angle proportional to arc length travelled
      const arcLen       = rollT * ROLL_CURVE_LENGTH;
      grp.rotation.z     = -(arcLen * 2.2); // 2.2 rad per unit = ~one full turn per ~3 units

      // Face direction of travel (yaw toward tangent)
      const angle = Math.atan2(tangent.x, tangent.z);
      grp.rotation.y = angle;

      // Tiny vertical bounce (sinusoidal over roll progress)
      const bounce = Math.abs(Math.sin(rollT * Math.PI * 4)) * 0.04;
      grp.position.y += bounce;

    } else if (p < 0.45) {
      // Scenes 1-3: stationary at origin, gentle float
      const floatY = p < 0.30
        ? Math.sin(t * 1.2) * 0.04   // scene 1-2: breathing float
        : 0;
      grp.position.set(0, kf(KF_POS_Y_BASE, p) + floatY, 0);
      grp.rotation.z = 0;

    } else {
      // Scenes 5-6: cookie rests at plate origin (then fades out)
      grp.position.set(0, 0, 0);
      // Scene 5 bounce: small settle after impact
      if (p >= 0.65 && p < 0.72) {
        const bounceT  = localT(p, 0.65, 0.72);
        const settle   = Math.exp(-bounceT * 6) * Math.abs(Math.sin(bounceT * Math.PI * 3)) * 0.12;
        grp.position.y = settle;
      }
      grp.rotation.z = 0;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload('/models/cookie.glb');
