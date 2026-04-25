/**
 * Cookie.jsx
 *
 * Single cookie model — drives the cinematic scroll story:
 *
 *  Scene 1  (0.00 – 0.12)  FLAT ON PLATE   : cookie lies face-up on wooden plate
 *  Scene 2  (0.12 – 0.28)  RISING          : cookie stands up like a wheel
 *  Scene 3  (0.28 – 0.44)  WHEEL ROLL      : cookie rolls as wheel, plate exits
 *  Scene 4  (0.44 – 0.76)  THE ROLL        : S-curve + two cinematic sub-scenes
 *  Scene 5  (0.76 – 0.87)  IMPACT          : arrives at plate, bounces, fades out
 *  Scene 6  (0.87 – 1.00)  SHOWCASE        : invisible (plate takes over)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useGLTF, PresentationControls } from '@react-three/drei';
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

// ── Circular arc path (Scene 4): center → left arc → front → right arc → center ─
// The arc starts and ends at (0,0,0) so it is perfectly continuous with the
// cookie's resting position at the end of Scene 3 — no teleport.
// Control points pull left-forward then right-forward, giving a symmetric
// "horseshoe" sweep that reads as entering from the left, circling in front of
// the camera, then exiting to the right before returning to the plate.
const ROLL_CURVE = new THREE.CubicBezierCurve3(
  new THREE.Vector3( 0.0,  0,  0.0),  // start: continuous with scene3 end
  new THREE.Vector3(-2.0,  0,  1.8),  // pull left-forward (left arc half)
  new THREE.Vector3( 2.0,  0,  1.8),  // pull right-forward (right arc half)
  new THREE.Vector3( 0.0,  0,  0.0)   // return to center — ready for impact
);

// Pre-compute curve length once
const ROLL_CURVE_LENGTH = ROLL_CURVE.getLength();

// ── Keyframe tables ───────────────────────────────────────────────────────────

// ── Scale keyframes ────────────────────────────────────────────────────────────
const KF_SCALE = [
  { p: 0.00, v: 1.4  }, // cookie on plate — fits nicely inside the dish
  { p: 0.12, v: 1.4  }, // holds flat
  { p: 0.28, v: 1.6  }, // grows slightly as it stands up
  { p: 0.44, v: 0.75 }, // arc start — small so it never looms large near camera
  { p: 0.76, v: 0.70 }, // end of arc — keep consistent size
  { p: 1.00, v: 0.70 },
];

// rotX keyframes — NEW ORDER: flat first, then upright, then roll
//   p=0.00 → 0     : cookie lies FLAT on the plate (face-up)
//   p=0.12 → 0     : holds flat
//   p=0.28 → π/2   : stands upright (like a wheel / disc trophy)
//   p=0.44 → π/2   : stays upright for S-curve roll
//   — impact / rest keyframes unchanged —
const KF_ROT_X = [
  { p: 0.00, v: 0           }, // flat on plate
  { p: 0.12, v: 0           }, // holds flat
  { p: 0.28, v: Math.PI / 2 }, // stands upright
  { p: 0.44, v: Math.PI / 2 }, // upright — roll start
  { p: 0.80, v: Math.PI / 4 }, // partly laid by impact
  { p: 0.87, v: 0           },
  { p: 1.00, v: 0           },
];

// Y base position keyframes
//   Scene 1 (p 0–0.12): cookie rests on plate surface (PLATE_REST_Y + half-thickness)
//   Scene 2 (p 0.12–0.28): cookie rises as it stands up
//   Scene 3–4: rolls at moderate height
const KF_POS_Y_BASE = [
  { p: 0.00, v: -0.35 }, // resting on plate (plate centre at -0.58, top at -0.53)
  { p: 0.12, v: -0.35 }, // holds on plate
  { p: 0.28, v:  0.15 }, // risen to wheel height
  { p: 0.44, v:  0.20 }, // pre-roll elevation
  { p: 0.76, v:  0    },
  { p: 1.00, v:  0    },
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

export default function Cookie({ scrollProgress, mouseRef, presentationEnabled }) {
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
  //
  // CRITICAL ORDER — wrong order was the primary cause of the split/crescent bug:
  //   1. Normalise scale FIRST  (`scale.setScalar(1/maxDim)`)
  //   2. Call `updateMatrixWorld(true)` so world matrices reflect the new scale
  //   3. THEN compute the bounding-box centre and subtract it from c.position
  //
  // Subtracting the pre-scale centre (previous code) left the geometric centre
  // offset from the group origin by  centre * (1 - 1/maxDim), which caused the
  // cookie to render partially outside the viewport (crescent / split artefact).
  //
  // Additional fixes applied to every mesh:
  //   • DoubleSide   — prevents invisible interior faces on near-plane clip
  //   • alphaTest=0  — do NOT discard pixels based on texture alpha; the texture's
  //                    alpha map was creating invisible "holes" in the cookie body
  //   • alphaMap=null — remove any separate alpha mask from the GLB material
  //   • depthWrite   — correct depth ordering
  //   • transparent=true — preserved so per-frame opacity animation still works
  const clonedScene = useMemo(() => {
    const c = scene.clone(true);
    c.updateMatrixWorld(true);

    // ── Step 1: measure raw size ──────────────────────────────────────────
    const box1    = new THREE.Box3().setFromObject(c);
    const sizeVec = new THREE.Vector3();
    box1.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);

    // ── Step 2: apply normalisation scale (model = 1 world-unit wide at scale=1)
    if (maxDim > 0) {
      c.scale.setScalar(1 / maxDim);
      c.updateMatrixWorld(true); // recompute AFTER scale — required for step 3
    }

    // ── Step 3: centre using post-scale bbox ──────────────────────────────
    // centre is now in the scaled coordinate system; subtracting it puts the
    // geometric centre exactly at the group's local origin.
    const box2   = new THREE.Box3().setFromObject(c);
    const centre = new THREE.Vector3();
    box2.getCenter(centre);
    c.position.sub(centre);

    // ── Step 4: per-mesh material & culling fixes ─────────────────────────
    //
    // WHY transparent: false
    // ──────────────────────
    // THREE.js MeshStandardMaterial uses the alpha channel of the base-color
    // texture (m.map) as a per-pixel opacity mask whenever transparent:true is
    // set — regardless of alphaTest or alphaMap.  The cookie GLB's base-color
    // texture has alpha-cutout "bite marks" baked in; with transparent:true those
    // pixels render as fully transparent holes.  Setting transparent:false (and
    // opacity:1) forces opaque rendering so the cookie is always 100% solid.
    // Appear/disappear is handled by grp.visible (see useFrame below).
    c.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow    = true;
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          m.side        = THREE.DoubleSide; // no invisible back-faces on near-clip
          m.depthWrite  = true;
          m.depthTest   = true;
          m.transparent = false;            // CRITICAL: prevents texture-alpha holes
          m.opacity     = 1;               // always fully opaque
          m.alphaTest   = 0;
          m.alphaMap    = null;
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

    // ── Visibility ────────────────────────────────────────────────────────
    grp.visible = p < 0.75;

    // ── Scale ─────────────────────────────────────────────────────────────
    const sc = kf(KF_SCALE, p);
    grp.scale.setScalar(sc);

    // ── Rotation X (tilt) ─────────────────────────────────────────────────
    grp.rotation.x = kf(KF_ROT_X, p);

    // ── Rotation Y ────────────────────────────────────────────────────────
    if (p < 0.12) {
      // Scene 1 FLAT: very slow lazy Y spin (face-up cookie, barely rotating)
      grp.rotation.y += delta * 0.28;
    } else if (p < 0.28) {
      // Scene 2 RISING: build momentum as cookie stands up
      grp.rotation.y += delta * 0.75;
    } else if (p < 0.44) {
      // Scene 3 WHEEL: fast wheel spin in place while plate exits
      grp.rotation.y += delta * 2.4;
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
      // Scenes 1-3: stationary at origin (no path movement), gentle float + mouse parallax
      const floatY = p < 0.28
        ? Math.sin(t * 1.0) * 0.05
        : 0;
      grp.position.set(0, kf(KF_POS_Y_BASE, p) + floatY, 0);
      grp.rotation.z = 0;
      tiltRef.current = lerp(tiltRef.current, 0, 0.06);

      // Micro wobble in scenes 1–2 (flat + rising)
      if (p < 0.28) {
        grp.rotation.z = Math.sin(t * 2.2) * 0.018;
      }

      // ── Face-the-cursor (look-at / cursor-tracking effect) ───────────────
      const mx = mouseRef ? mouseRef.current.x : _mouse.x;
      const my = mouseRef ? mouseRef.current.y : _mouse.y;
      const MAX_FACE_Y = p < 0.12 ? 0.18 : 0.14;
      const MAX_FACE_X = p < 0.12 ? 0.08 : 0.06;
      const newFaceY = lerp(mouseXRef.current, mx * MAX_FACE_Y, 0.06);
      const newFaceX = lerp(mouseYRef.current, -my * MAX_FACE_X, 0.06);
      grp.rotation.y += newFaceY - mouseXRef.current;
      grp.rotation.x += newFaceX - mouseYRef.current;
      mouseXRef.current = newFaceY;
      mouseYRef.current = newFaceX;

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
      {/*
        PresentationControls wraps only the inner primitive group.
        - enabled: only active during scene 1 (hero landing) so drag-rotate
          does not conflict with scroll-driven GSAP animation later.
        - snap: spring-eased return to centre on pointer-up, ensuring the
          model is back at zero delta-rotation by the time the scroll
          animation takes over.
        - global={false}: only activates on pointer events on the mesh itself
          (not the whole canvas), preventing scroll-wheel interception.
        - Mouse-cursor parallax (above) still runs independently via useFrame.
      */}
      <PresentationControls
        global={false}
        enabled={!!presentationEnabled}
        snap={{ mass: 1, tension: 250, friction: 32 }}
        polar={[-Math.PI / 5, Math.PI / 5]}
        azimuth={[-Math.PI / 3, Math.PI / 3]}
        speed={1.4}
      >
        <primitive object={clonedScene} />
      </PresentationControls>
    </group>
  );
}

useGLTF.preload('/models/cookie.glb');
