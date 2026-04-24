import {
  EffectComposer,
  DepthOfField,
  Bloom,
  Vignette,
  Noise,
} from '@react-three/postprocessing';

export default function Effects() {
  return (
    <EffectComposer>
      <DepthOfField
        focusDistance={0.01}
        focalLength={0.025}
        bokehScale={2.5}
      />
      <Bloom
        luminanceThreshold={0.88}
        intensity={0.25}
        mipmapBlur
      />
      <Vignette
        eskil={false}
        offset={0.12}
        darkness={1.05}
      />
      <Noise opacity={0.028} />
    </EffectComposer>
  );
}
