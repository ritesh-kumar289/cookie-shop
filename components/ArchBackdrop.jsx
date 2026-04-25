/**
 * ArchBackdrop.jsx
 *
 * A set of concentric arch frames rendered in the Three.js scene, positioned
 * behind the cookie during scene 1.  Gives the "product on display podium"
 * look from the design reference.
 *
 * Geometry: THREE.ShapeGeometry built from a THREE.Shape (arch = rectangle
 * with semicircle cap) with a inner-boundary hole, giving a ring frame.
 * The shape lives in the XY plane, so the arch faces the +Z camera.
 */

import { useMemo, useRef } from 'react';
import { useFrame }        from '@react-three/fiber';
import * as THREE          from 'three';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a single arch-ring geometry.
 * The arch is open at the bottom (columns + semicircle top only).
 *
 * @param {number} outerR - outer half-width (= outer arch radius)
 * @param {number} innerR - inner half-width (= inner arch radius / window opening)
 * @param {number} colH   - column height below the arch centre
 */
function makeArchRing(outerR, innerR, colH) {
  const shape = new THREE.Shape();
  // Outer boundary: left column → arch → right column → close bottom
  shape.moveTo(-outerR, -colH);
  shape.lineTo(-outerR, 0);
  shape.absarc(0, 0, outerR, Math.PI, 0, false); // counterclockwise → upward arch
  shape.lineTo(outerR, -colH);
  shape.lineTo(-outerR, -colH);

  // Inner hole (window opening)
  const hole = new THREE.Path();
  hole.moveTo(-innerR, -colH - 0.01); // extend slightly past outer bottom
  hole.lineTo(-innerR, 0);
  hole.absarc(0, 0, innerR, Math.PI, 0, false);
  hole.lineTo(innerR, -colH - 0.01);
  hole.lineTo(-innerR, -colH - 0.01);
  shape.holes.push(hole);

  return new THREE.ShapeGeometry(shape, 64);
}

/**
 * Build a solid arch panel (the back-fill inside the innermost ring).
 */
function makeArchPanel(r, colH) {
  const shape = new THREE.Shape();
  shape.moveTo(-r, -colH);
  shape.lineTo(-r, 0);
  shape.absarc(0, 0, r, Math.PI, 0, false);
  shape.lineTo(r, -colH);
  shape.lineTo(-r, -colH);
  return new THREE.ShapeGeometry(shape, 64);
}

// ── Ring definitions ──────────────────────────────────────────────────────────
// Three concentric rings from outermost (darkest) to innermost (lightest).
const RINGS = [
  { outerR: 1.45, innerR: 1.28, color: '#D5BF95' }, // outermost
  { outerR: 1.28, innerR: 1.12, color: '#DEC9A2' }, // middle
  { outerR: 1.12, innerR: 0.97, color: '#E8D8B0' }, // inner
];
const COL_H     = 1.9;   // column height below arch centre
const PANEL_COL = 1.9;   // back-fill panel height (same as column)

// ── ArchBackdrop component ────────────────────────────────────────────────────

export default function ArchBackdrop({ scrollProgress }) {
  const groupRef = useRef();

  // Build geometries and materials once
  const { ringGeoms, ringMats, panelGeom, panelMat } = useMemo(() => {
    const rg = RINGS.map(({ outerR, innerR }) => makeArchRing(outerR, innerR, COL_H));
    const rm = RINGS.map(({ color }) =>
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    const pg = makeArchPanel(0.97, PANEL_COL);
    const pm = new THREE.MeshBasicMaterial({ color: '#F0E3C0', side: THREE.DoubleSide });
    return { ringGeoms: rg, ringMats: rm, panelGeom: pg, panelMat: pm };
  }, []);

  // All materials collected for opacity updates
  const allMats = useMemo(() => [...ringMats, panelMat], [ringMats, panelMat]);

  useFrame(() => {
    if (!groupRef.current) return;
    const p = scrollProgress.current;

    // Visible during scene 1; fades out as scene 2 begins
    let vis;
    if (p <= 0.16)      vis = 1;
    else if (p <= 0.26) vis = 1 - (p - 0.16) / 0.10;
    else                vis = 0;

    groupRef.current.visible = vis > 0.005;

    if (vis < 0.999) {
      allMats.forEach((m) => {
        if (!m.transparent) { m.transparent = true; m.needsUpdate = true; }
        m.opacity = vis;
      });
    } else {
      allMats.forEach((m) => {
        if (m.transparent) { m.transparent = false; m.needsUpdate = true; }
        m.opacity = 1;
      });
    }
  });

  return (
    // Position: centred behind the cookie (z = -1.2), slightly elevated (y = 0.2)
    // so the arch top clears the top of the standing cookie.
    <group ref={groupRef} position={[0, 0.2, -1.2]}>
      {/* Back-fill panel (innermost, rendered first / furthest back) */}
      <mesh geometry={panelGeom} material={panelMat} />

      {/* Concentric arch rings, each slightly in front of the previous */}
      {RINGS.map((_, i) => (
        <mesh
          key={i}
          geometry={ringGeoms[i]}
          material={ringMats[i]}
          position={[0, 0, 0.02 * (i + 1)]}
        />
      ))}
    </group>
  );
}
