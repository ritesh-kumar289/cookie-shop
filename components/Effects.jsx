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
      Bloom and Noise are kept for the cinematic look.
      Vignette darkness reduced from 0.85 to 0.38 — the original 0.85 caused a
      jarring "dark overlay flash" when the EffectComposer mounted after Suspense
      resolved (initial render had no effects → suddenly very dark vignette).
    */
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.75}
        intensity={0.18}
        mipmapBlur
      />
      <Vignette
        eskil={false}
        offset={0.22}
        darkness={0.38}
      />
      <Noise opacity={0.022} />
    </EffectComposer>
  );
}
