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

import { useRef, useMemo, useEffect } from 'react';
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

// ── Scale keyframes ────────────────────────────────────────────────────────────
// Model is normalised to 1 world-unit wide in the useMemo below, so these
// values represent the cookie's real diameter in world units.
const KF_SCALE = [
  { p: 0.00, v: 1.5 },
  { p: 0.15, v: 1.5 },
  { p: 0.30, v: 1.4 },
  { p: 0.44, v: 1.3 },
  { p: 0.76, v: 1.2 },
  { p: 1.00, v: 1.2 },
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

// ── Cookie radius for rolling physics ────────────────────────────────────────
// After bounding-box normalisation the model is 1 world-unit at its largest
// dimension, so the disc radius ≈ 0.5 world units at group scale = 1.
// apparentRadius_world = COOKIE_RADIUS_AT_SCALE_1 * groupScale
const COOKIE_RADIUS_AT_SCALE_1 = 0.5;

// Scroll-direction lean sensitivity (rad per unit of normalised scroll delta)
const TILT_SENSITIVITY = 35;

// ── Mouse parallax state (module-level, shared across renders) ────────────────
// Stores normalised device cursor coordinates in [-1, +1].
// NOTE: This is a module-level fallback only; the preferred path uses the
// mouseRef prop passed from index.jsx → Scene.jsx → Cookie.jsx.
const _mouse = { x: 0, y: 0 };

// ─────────────────────────────────────────────────────────────────────────────

export default function Cookie({ scrollProgress, mouseRef }) {
  const groupRef = useRef();
  const { scene } = useGLTF('/models/cookie.glb');
  const timeRef = useRef(0);
  const prevScrollProgressRef = useRef(0);
  const tiltRef = useRef(0); // accumulated scroll-direction tilt (Z)
  // Smoothed mouse influence refs (lerped per-frame to avoid jitter)
  const mouseXRef = useRef(0);
  const mouseYRef = useRef(0);

  // ── Mouse tracking for parallax (fallback if no mouseRef prop) ───────────
  useEffect(() => {
    if (mouseRef) return; // parent handles it via mouseRef prop
    const onMove = (e) => {
      _mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      _mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [mouseRef]);

  // Clone the scene once (memoized).
  // 1. Compute bounding box → shift pivot to geometric center so the cookie
  //    always rotates about its own center, never off-axis.
  // 2. Normalise scale so the cookie is exactly 1 world-unit at its largest
  //    dimension when group scale = 1.  KF_SCALE then directly controls size.
  // 3. Force DoubleSide rendering so interior faces are visible when the
  //    camera clips through the mesh (prevents the "split cookie" artefact).
  // 4. Disable frustum culling so the cookie is never dropped mid-frame.
  const clonedScene = useMemo(() => {
    const c = scene.clone();

    // ── Bounding-box centering ────────────────────────────────────────────
    const box    = new THREE.Box3().setFromObject(c);
    const center = new THREE.Vector3();
    const sizeVec = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(sizeVec);
    // Shift the root group so bbox centre is at local origin
    c.position.sub(center);
    // Normalise so maxDim = 1 world unit at scale 1
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    if (maxDim > 0) c.scale.multiplyScalar(1 / maxDim);

    // ── Per-mesh fixes ────────────────────────────────────────────────────
    c.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          m.side       = THREE.DoubleSide; // no invisible interior on clip
          m.depthWrite = true;
          m.transparent = true; // opacity controlled per-frame
          m.needsUpdate = true;
        });
      }
    });

    return c;
  }, [scene]);

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
      // Scenes 1-3: stationary at origin, gentle float + mouse parallax
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

      // Smooth mouse-parallax influence — subtle rotation toward cursor
      const mx = mouseRef ? mouseRef.current.x : _mouse.x;
      const my = mouseRef ? mouseRef.current.y : _mouse.y;
      mouseXRef.current = lerp(mouseXRef.current, mx, 0.04);
      mouseYRef.current = lerp(mouseYRef.current, my, 0.04);
      // Apply only when cookie is stable (scenes 1-3); mix with existing rotY
      grp.rotation.y += mouseXRef.current * 0.06;
      grp.rotation.x += mouseYRef.current * 0.04;

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
