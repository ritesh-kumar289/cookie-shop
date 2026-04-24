import { ContactShadows, Environment } from '@react-three/drei';

export default function Lighting() {
  return (
    <>
      {/* Ambient fill — warm cream */}
      <ambientLight intensity={0.45} color="#F4E9DA" />

      {/* Key light — warm golden bakery top-left */}
      <directionalLight
        position={[4, 10, 6]}
        color="#E8C07A"
        intensity={2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />

      {/* Fill light — soft cream from opposite side */}
      <directionalLight
        position={[-4, 5, -3]}
        color="#FBE8CC"
        intensity={1.0}
      />

      {/* Rim light — deep caramel from behind */}
      <pointLight
        position={[-2, 3, -4]}
        color="#C87941"
        intensity={2.0}
        distance={18}
        decay={2}
      />

      {/* Under-fill — very subtle warm bounce */}
      <pointLight
        position={[0, -2, 2]}
        color="#F1C27D"
        intensity={0.5}
        distance={10}
        decay={2}
      />

      {/* Ground contact shadow */}
      <ContactShadows
        position={[0, -1.5, 0]}
        opacity={0.35}
        scale={40}
        blur={4}
        far={16}
        color="#5A2E1F"
      />

      {/* Warm HDRI environment — sunset for golden reflections */}
      <Environment preset="sunset" background={false} />
    </>
  );
}
