/**
 * CookieLoader.jsx
 *
 * Full-screen loading overlay shown while 3D assets (cookie.glb) download.
 * Displays:
 *   • a small 3D cookie model spinning on its Z-axis (wheel rotation)
 *   • a percentage counter above the cookie
 *
 * Uses @react-three/drei's useProgress — it hooks into THREE.DefaultLoadingManager
 * and gives live 0–100 % progress for all useGLTF / useTexture loads on the page.
 *
 * The overlay stays visible for at least MIN_SHOW_MS even if assets are cached,
 * then fades out gracefully.
 */

import { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';

// Minimum time (ms) the loader is displayed — prevents a flash on fast/cached loads
const MIN_SHOW_MS  = 1200;
// Hard maximum (ms) before the loader force-dismisses itself (safety net)
const MAX_SHOW_MS  = 6000;
// Fade-out transition duration (ms) — must match CSS transition
const FADE_MS      = 700;

// ── Spinning cookie mesh ───────────────────────────────────────────────────────

function SpinningCookie() {
  const { scene } = useGLTF('/models/cookie.glb');
  const groupRef   = useRef();

  // Clone + normalise (same logic as Cookie.jsx so the mesh renders correctly)
  const clonedScene = useMemo(() => {
    const c = scene.clone(true);
    c.updateMatrixWorld(true);

    const box1 = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    box1.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
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
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          m.side        = THREE.DoubleSide;
          m.transparent = false;
          m.opacity     = 1;
          m.alphaTest   = 0;
          m.alphaMap    = null;
          m.needsUpdate = true;
        });
      }
    });

    return c;
  }, [scene]);

  // Cookie stands UPRIGHT (rotation.x = π/2) — same as Cookie.jsx Scene 1 hero.
  // Y-axis rotation on an upright cookie = wheel rolling in place (not a coin flip).
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x = Math.PI / 2; // always upright, like Scene 1
      groupRef.current.rotation.y += delta * 2.6; // wheel-rolling spin
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

// ── Loader overlay ─────────────────────────────────────────────────────────────

export default function CookieLoader() {
  const { progress, active } = useProgress();
  const [fadingOut, setFadingOut] = useState(false);
  const [hidden,    setHidden]    = useState(false);
  const mountTimeRef = useRef(Date.now());
  const dismissedRef = useRef(false);

  function dismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFadingOut(true);
    setTimeout(() => setHidden(true), FADE_MS);
  }

  // Dismiss when loading completes (respecting MIN_SHOW_MS)
  useEffect(() => {
    if (progress < 100 || active) return;
    const elapsed   = Date.now() - mountTimeRef.current;
    const remaining = Math.max(0, MIN_SHOW_MS - elapsed);
    const t = setTimeout(dismiss, remaining);
    return () => clearTimeout(t);
  }, [progress, active]);

  // Hard cap: dismiss after MAX_SHOW_MS regardless (handles cached / no-asset pages)
  useEffect(() => {
    const t = setTimeout(dismiss, MAX_SHOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (hidden) return null;

  return (
    <div className={`cookie-loader${fadingOut ? ' cookie-loader--out' : ''}`}>
      {/* Percentage above the spinning cookie */}
      <p className="cookie-loader-pct">{Math.round(progress)}%</p>

      {/* Small Three.js canvas — spinning cookie wheel */}
      <div className="cookie-loader-canvas">
        <Canvas
          frameloop="always"
          gl={{ antialias: true, alpha: true }}
          camera={{ fov: 45, near: 0.1, far: 20, position: [0, 0.2, 2.2] }}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          {/* No <color attach="background"> — canvas is transparent so
              the cookie floats on the cream loader overlay with no visible
              canvas boundary or ring */}
          <ambientLight intensity={2.2} />
          <directionalLight position={[3, 4, 3]} intensity={2.8} castShadow={false} />
          <Suspense fallback={null}>
            <SpinningCookie />
          </Suspense>
        </Canvas>
      </div>

      {/* Subtle brand tagline */}
      <p className="cookie-loader-label">Loading Crunch Bites…</p>
    </div>
  );
}
