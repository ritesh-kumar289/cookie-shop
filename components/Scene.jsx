import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import Lighting from './Lighting';
import Cookie from './Cookie';
import CookiesPlate from './CookiesPlate';
import CameraRig from './CameraRig';
import Effects from './Effects';

export default function Scene({ scrollProgress }) {
  return (
    <Canvas
      frameloop="always"
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ fov: 45, near: 0.1, far: 100, position: [0, 5, 0.1] }}
      style={{ width: '100%', height: '100%', background: '#0a0704' }}
      shadows
    >
      <Suspense fallback={null}>
        <Lighting />
        <CookiesPlate scrollProgress={scrollProgress} />
        <Cookie scrollProgress={scrollProgress} />
        <CameraRig scrollProgress={scrollProgress} />
        <Effects />
      </Suspense>
    </Canvas>
  );
}
