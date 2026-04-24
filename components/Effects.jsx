import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from '@react-three/postprocessing';

export default function Effects({ scrollProgress }) {
  return (
    /*
      DepthOfField is intentionally removed — the CoC depth mask was creating a
      hard horizontal split through the cookie mesh at certain scroll positions.
      Bloom, Vignette and Noise are kept for the cinematic look.
    */
    <EffectComposer>
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
