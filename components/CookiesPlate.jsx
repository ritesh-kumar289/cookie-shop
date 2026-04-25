/**
 * CookiesPlate.jsx
 *
 * Multiple cookies on a cork board plate — appears at the end of the roll.
 *
 *  0.00 – 0.76  invisible (opacity 0)
 *  0.76 – 0.87  fade in (single cookie rolls in and "lands")
 *  0.87 – 1.00  fully visible, gentle slow rotation, hero showcase
 */

import { useRef, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

  // Clone, centre, normalise and fix materials.
  // SAME corrected order as Cookie.jsx: scale first → updateMatrixWorld → centre.
  const clonedScene = useMemo(() => {
    const c = scene.clone(true);
    c.updateMatrixWorld(true);

    const box1    = new THREE.Box3().setFromObject(c);
    const sizeVec = new THREE.Vector3();
    box1.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);

    if (maxDim > 0) {
      c.scale.setScalar(1 / maxDim);
      c.updateMatrixWorld(true);
    }

    const box2   = new THREE.Box3().setFromObject(c);
    const centre = new THREE.Vector3();
    box2.getCenter(centre);
    c.position.sub(centre);

    c.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow    = true;
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          m.side        = THREE.DoubleSide;
          m.depthWrite  = true;
          m.depthTest   = true;
          m.transparent = true;
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
    const p   = scrollProgress.current;
    const grp = groupRef.current;

    // ── Opacity ───────────────────────────────────────────────────────────
    let opacity = 0;
    // The rolling cookie crosses x=0 (screen centre) at roughly p=0.80 during
    // Phase B.  Reveal the plate from p=0.79 so it appears right as the cookie
    // rolls past, matching the original "impact + reveal" feel.
    if (p >= 0.79 && p < 0.88) {
      opacity = localT(p, 0.79, 0.88);
    } else if (p >= 0.88) {
      opacity = 1;
    }

    // Hide entirely when opacity is zero — avoids traversal cost and prevents
    // any ghost pixels while the cookie-to-plate transition is happening.
    grp.visible = opacity > 0.005;
    if (grp.visible) {
      grp.traverse((child) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (m.transparent !== true) m.transparent = true;
            if (Math.abs(m.opacity - opacity) > 0.001) m.opacity = opacity;
          });
        }
      });
    }

    // ── Scale ─────────────────────────────────────────────────────────────
    // After bbox normalisation the model is 1 world-unit wide at scale 1.
    // 1.5 gives a plate that fills the cinematic hero shot nicely.
    grp.scale.setScalar(1.5);

    // ── Showcase slow rotation (only when fully visible) ──────────────────
    if (p >= 0.88) {
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
      if (p >= 0.79 && p < 0.90) {
        const settleT = localT(p, 0.79, 0.90);
        const settle  = Math.exp(-settleT * 5) * Math.abs(Math.sin(settleT * Math.PI * 2.5)) * 0.04;
        grp.position.set(0, settle, 0);
      } else {
        grp.position.set(0, 0, 0);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload('/models/cookies.glb');
