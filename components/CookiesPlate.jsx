/**
 * CookiesPlate.jsx
 *
 * Multiple cookies on a cork board plate — appears at the end of the roll.
 *
 *  0.00 – 0.76  invisible (opacity 0)
 *  0.76 – 0.87  fade in (single cookie rolls in and "lands")
 *  0.87 – 1.00  fully visible, gentle slow rotation, hero showcase
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
const IMPACT_PROGRESS = 0.77;
const SHAKE_WIN = 0.04;

// ─────────────────────────────────────────────────────────────────────────────

export default function CookiesPlate({ scrollProgress }) {
  const groupRef    = useRef();
  const prevPRef    = useRef(0);
  const shakeRef    = useRef(0);
  const { scene }   = useGLTF('/models/cookies.glb');

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const p   = scrollProgress.current;
    const grp = groupRef.current;

    // ── Opacity ───────────────────────────────────────────────────────────
    let opacity = 0;
    if (p >= 0.76 && p < 0.87) {
      opacity = localT(p, 0.76, 0.87);
    } else if (p >= 0.87) {
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

    // ── Scale ─────────────────────────────────────────────────────────────
    grp.scale.setScalar(20);

    // ── Showcase slow rotation (only when fully visible) ──────────────────
    if (p >= 0.87) {
      grp.rotation.y += delta * 0.08;
    }

    // ── Impact camera shake ───────────────────────────────────────────────
    const prevP = prevPRef.current;
    const crossedForward  = prevP < IMPACT_PROGRESS && p >= IMPACT_PROGRESS;
    const crossedBackward = prevP >= IMPACT_PROGRESS && p < IMPACT_PROGRESS;

    if (crossedForward || crossedBackward) {
      shakeRef.current = 1.0;
    }
    prevPRef.current = p;

    if (shakeRef.current > 0.001) {
      shakeRef.current = Math.max(0, shakeRef.current - delta / SHAKE_WIN);
      const s   = shakeRef.current;
      const amp = s * 0.05;
      grp.position.set(
        (Math.random() - 0.5) * amp,
        Math.abs(Math.random()) * amp * 0.4,
        (Math.random() - 0.5) * amp * 0.25
      );
    } else {
      if (p >= 0.76 && p < 0.90) {
        const settleT = localT(p, 0.76, 0.90);
        const settle  = Math.exp(-settleT * 5) * Math.abs(Math.sin(settleT * Math.PI * 2.5)) * 0.04;
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
