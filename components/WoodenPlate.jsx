/**
 * WoodenPlate.jsx
 *
 * Real wooden plate from the Historic Environment Scotland GLB model.
 * Appears during the opening "flat cookie on plate" scene and slides
 * away as the cookie stands up and begins to roll.
 *
 *  p = 0.00 – 0.28  : plate rests at origin below cookie, very slow Y rotation
 *  p = 0.28 – 0.48  : plate slides down + back (exits camera) while cookie rolls
 *  p = 0.48+        : hidden
 */

import { useRef, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

function lerp(a, b, t) { return a + (b - a) * t; }

function ss(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// Resting Y position — sits below the flat cookie whose centre is at -0.35
export const PLATE_REST_Y = -0.58;

// Exit target for plate-away animation
const EXIT_POS = new THREE.Vector3(0, -5.5, -2.5);

export default function WoodenPlate({ scrollProgress }) {
  const groupRef = useRef();
  const rotRef   = useRef(0);
  const { scene } = useGLTF('/models/wooden_plate.glb');

  // Clone, normalise scale and centre — same pattern as Cookie.jsx
  const clonedScene = useMemo(() => {
    const c = scene.clone(true);
    c.updateMatrixWorld(true);

    // Step 1: measure raw bounding box
    const box1    = new THREE.Box3().setFromObject(c);
    const sizeVec = new THREE.Vector3();
    box1.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);

    // Step 2: normalise to 1 world-unit at largest dimension
    if (maxDim > 0) {
      c.scale.setScalar(1 / maxDim);
      c.updateMatrixWorld(true);
    }

    // Step 3: centre on origin using post-scale bbox
    const box2   = new THREE.Box3().setFromObject(c);
    const centre = new THREE.Vector3();
    box2.getCenter(centre);
    c.position.sub(centre);

    // Step 4: material fixes
    c.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.receiveShadow = true;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          m.side       = THREE.DoubleSide;
          m.depthWrite = true;
          m.depthTest  = true;
          // Keep transparency if the material already uses it (e.g. glass on some models)
          if (!m.transparent) {
            m.transparent = false;
            m.opacity     = 1;
          }
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

    if (p >= 0.50) {
      grp.visible = false;
      return;
    }

    grp.visible = true;

    // Scale: plate diameter = 2.2 world-units so the cookie (1.4 units wide) sits
    // comfortably on the plate without the plate dominating the frame
    grp.scale.setScalar(2.2);

    if (p < 0.28) {
      // Resting below cookie — very gentle Y rotation to show depth
      rotRef.current += delta * 0.18;
      grp.position.set(0, PLATE_REST_Y, 0);
      grp.rotation.set(0, rotRef.current, 0);
    } else {
      // Slide away: ease-in squared so it accelerates convincingly
      const t     = ss((p - 0.28) / 0.20); // 0→1 over p=0.28-0.48
      const eased = t * t;

      grp.position.set(
        0,
        lerp(PLATE_REST_Y, EXIT_POS.y, eased),
        lerp(0, EXIT_POS.z, eased),
      );
      // Tilt forward as it drops
      grp.rotation.set(lerp(0, -Math.PI * 0.3, eased), rotRef.current, 0);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload('/models/wooden_plate.glb');

