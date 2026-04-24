/**
 * CookiesPlate.jsx
 *
 * Multiple cookies on a cork board plate — appears at the end of the roll
 * (Scene 5 "IMPACT") and stays through Scene 6 "THE SHOWCASE".
 *
 *  0.00 – 0.65  invisible (opacity 0)
 *  0.65 – 0.75  fade in (single cookie rolls in and "lands")
 *  0.75 – 1.00  fully visible, gentle slow rotation, hero showcase
 *
 * Camera at this stage (see CameraRig.jsx):
 *   0.80 → [2, 3, 2]   angled hero shot
 *   1.00 → [0.5, 0.5, 2] macro close-up
 */

import { useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

// ── DRACO decoder (CDN) ───────────────────────────────────────────────────────
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

// ── Helpers ───────────────────────────────────────────────────────────────────
function ss(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
function localT(p, a, b) {
  return ss((p - a) / (b - a));
}

// ── Impact shake params ───────────────────────────────────────────────────────
// A brief position/rotation jolt at the moment the cookie "hits" the plate.
const IMPACT_PROGRESS = 0.66;  // scroll progress value of the impact moment
const SHAKE_WIN = 0.04;   // window over which shake decays

// ─────────────────────────────────────────────────────────────────────────────

export default function CookiesPlate({ scrollProgress }) {
  const groupRef    = useRef();
  const prevPRef    = useRef(0);
  const shakeRef    = useRef(0);   // shake intensity 0-1
  const { scene }   = useGLTF('/models/cookies.glb');

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const p   = scrollProgress.current;
    const grp = groupRef.current;

    // ── Opacity ───────────────────────────────────────────────────────────
    let opacity = 0;
    if (p >= 0.65 && p < 0.75) {
      opacity = localT(p, 0.65, 0.75);
    } else if (p >= 0.75) {
      opacity = 1;
    }

    grp.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m.transparent !== true) m.transparent = true;
          if (Math.abs(m.opacity - opacity) > 0.001) m.opacity = opacity;
        });
      }
    });

    // ── Scale: 20× larger so the plate of cookies is clearly visible ─────────
    grp.scale.setScalar(20);

    // ── Showcase slow rotation (only when fully visible) ──────────────────
    if (p >= 0.75) {
      grp.rotation.y += delta * 0.12;
    }

    // ── Impact camera shake (triggered once when crossing IMPACT_PROGRESS) ───────
    const prevP = prevPRef.current;
    const crossedForward  = prevP < IMPACT_PROGRESS && p >= IMPACT_PROGRESS;
    const crossedBackward = prevP >= IMPACT_PROGRESS && p < IMPACT_PROGRESS;

    if (crossedForward || crossedBackward) {
      shakeRef.current = 1.0;  // reset shake intensity
    }
    prevPRef.current = p;

    // Decay and apply shake to group position
    if (shakeRef.current > 0.001) {
      shakeRef.current = Math.max(0, shakeRef.current - delta / SHAKE_WIN);
      const s   = shakeRef.current;
      const amp = s * 0.06;
      grp.position.set(
        (Math.random() - 0.5) * amp,
        Math.abs(Math.random()) * amp * 0.5,
        (Math.random() - 0.5) * amp * 0.3
      );
    } else {
      // Slight settle bounce after impact lands
      if (p >= 0.65 && p < 0.80) {
        const settleT = localT(p, 0.65, 0.80);
        const settle  = Math.exp(-settleT * 5) * Math.abs(Math.sin(settleT * Math.PI * 2.5)) * 0.05;
        grp.position.set(0, settle, 0);
      } else {
        grp.position.set(0, 0, 0);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/models/cookies.glb');
