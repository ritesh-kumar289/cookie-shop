/**
 * WoodenPlate.jsx
 *
 * Procedural wooden-plate 3D object built from Three.js primitives —
 * no external GLB required.  Appears during the opening "flat cookie on plate"
 * scene and slides away as the cookie stands up and begins to roll.
 *
 *  p = 0.00 – 0.28  : plate rests at origin below cookie, very slow Y rotation
 *  p = 0.28 – 0.48  : plate slides down + back (exits camera) while cookie rolls
 *  p = 0.48+        : hidden
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function lerp(a, b, t) { return a + (b - a) * t; }

function ss(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// Plate geometry dimensions
const PLATE_R     = 1.55;   // outer radius of the dish surface
const PLATE_H     = 0.10;   // disc height
const RIM_R       = 0.09;   // torus tube radius (lip around the edge)
const INNER_R     = 1.30;   // inner flat area radius (slightly recessed)
const INNER_DEPTH = 0.04;   // how far the inner dish is recessed

// Resting Y position — sits below the flat cookie whose centre is at -0.35
export const PLATE_REST_Y = -0.58;

// Reusable exit target vector
const EXIT_POS = new THREE.Vector3(0, -5.5, -2.5);

export default function WoodenPlate({ scrollProgress }) {
  const groupRef = useRef();
  const rotRef   = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const p   = scrollProgress.current;
    const grp = groupRef.current;

    if (p >= 0.50) {
      grp.visible = false;
      return;
    }

    grp.visible = true;

    if (p < 0.28) {
      // Resting in place — very gentle Y spin to show it's a 3D object
      rotRef.current += delta * 0.18;
      grp.position.set(0, PLATE_REST_Y, 0);
      grp.rotation.y = rotRef.current;
    } else {
      // Slide away: ease-in acceleration so it feels "pulled"
      const t = ss((p - 0.28) / 0.20); // 0 → 1 over p=0.28-0.48
      const eased = t * t;             // extra acceleration

      grp.position.set(
        0,
        lerp(PLATE_REST_Y, EXIT_POS.y, eased),
        lerp(0, EXIT_POS.z, eased),
      );
      // Tilt forward as it drops — dramatic exit
      grp.rotation.x = lerp(0, -Math.PI * 0.3, eased);
      grp.rotation.y = rotRef.current;
    }
  });

  // Warm wood tones — no external texture, just PBR parameters
  const woodDark  = '#6B3A1F';
  const woodMid   = '#8B5726';
  const woodLight = '#A0683A';

  return (
    <group ref={groupRef}>
      {/* ── Main disc body ─────────────────────────────────────────────── */}
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[PLATE_R, PLATE_R, PLATE_H, 64, 1]} />
        <meshStandardMaterial color={woodMid} roughness={0.88} metalness={0.02} />
      </mesh>

      {/* ── Inner recessed dish surface (slightly higher, smaller radius) ── */}
      <mesh receiveShadow position={[0, PLATE_H / 2 + INNER_DEPTH / 2, 0]}>
        <cylinderGeometry args={[INNER_R, INNER_R, INNER_DEPTH, 64, 1]} />
        <meshStandardMaterial color={woodLight} roughness={0.82} metalness={0.01} />
      </mesh>

      {/* ── Outer rim torus (the lip) ───────────────────────────────────── */}
      <mesh position={[0, PLATE_H / 2, 0]}>
        <torusGeometry args={[PLATE_R, RIM_R, 10, 64]} />
        <meshStandardMaterial color={woodDark} roughness={0.92} metalness={0.02} />
      </mesh>

      {/* ── Subtle concentric ring detail (wood grain illusion) ────────── */}
      {[0.55, 0.85, 1.10, 1.35].map((r, i) => (
        <mesh key={i} position={[0, PLATE_H / 2 + INNER_DEPTH + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r, r + 0.015, 64]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? woodDark : woodMid}
            roughness={0.9}
            metalness={0.0}
            side={THREE.FrontSide}
          />
        </mesh>
      ))}
    </group>
  );
}
