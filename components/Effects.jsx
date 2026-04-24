import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  DepthOfField,
  Bloom,
  Vignette,
  Noise,
} from '@react-three/postprocessing';

// Lerp helper
function lerp(a, b, t) { return a + (b - a) * t; }

// DOF effect ref wrapper — lets us mutate focusDistance per frame
function DynamicDOF({ scrollProgress }) {
  const dofRef = useRef();

  useFrame(() => {
    if (!dofRef.current) return;
    const p = scrollProgress.current;

    // Focus pulls closer as camera approaches cookie during roll
    // Scene 1-3: focus on mid distance
    // Scene 4 roll: focus tightens on cookie (~0.008)
    // Scene 4A/4B: dramatic pull-in
    // Final: wider focus on plate
    let targetFocus;
    if (p < 0.44) {
      targetFocus = 0.012;
    } else if (p < 0.76) {
      // Roll: focus tightens
      targetFocus = lerp(0.012, 0.006, (p - 0.44) / 0.32);
    } else {
      // Plate reveal: focus relaxes
      targetFocus = lerp(0.006, 0.018, (p - 0.76) / 0.24);
    }

    // Smoothly lerp the actual focus distance
    const current = dofRef.current.focusDistance;
    dofRef.current.focusDistance = lerp(current, targetFocus, 0.04);
  });

  return (
    <DepthOfField
      ref={dofRef}
      focusDistance={0.012}
      focalLength={0.022}
      bokehScale={2.8}
    />
  );
}

export default function Effects({ scrollProgress }) {
  return (
    <EffectComposer>
      <DynamicDOF scrollProgress={scrollProgress} />
      <Bloom
        luminanceThreshold={0.75}
        intensity={0.18}
        mipmapBlur
      />
      <Vignette
        eskil={false}
        offset={0.14}
        darkness={0.85}
      />
      <Noise opacity={0.022} />
    </EffectComposer>
  );
}
