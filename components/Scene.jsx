import { Suspense, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import Lighting from './Lighting';
import Cookie from './Cookie';
import CookiesPlate from './CookiesPlate';
import CameraRig from './CameraRig';
import Effects from './Effects';

// ── Error boundary: catches render/load errors inside the Canvas and prevents
//    them from crashing the entire page (shows the dark background instead).
class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Scene] Canvas render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Silently show nothing – the page UI still works without the 3D scene.
      return null;
    }
    return this.props.children;
  }
}

export default function Scene({ scrollProgress }) {
  return (
    <CanvasErrorBoundary>
      <Canvas
        frameloop="always"
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 5, 0.1] }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        shadows
      >
        <Suspense fallback={null}>
          <Lighting />
          <CookiesPlate scrollProgress={scrollProgress} />
          <Cookie scrollProgress={scrollProgress} />
          <CameraRig scrollProgress={scrollProgress} />
          <Effects scrollProgress={scrollProgress} />
        </Suspense>
      </Canvas>
    </CanvasErrorBoundary>
  );
}
