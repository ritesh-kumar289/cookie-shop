import { ContactShadows, Environment } from '@react-three/drei';

export default function Lighting() {
  return (
    <>
      {/* Ambient fill */}
      <ambientLight intensity={0.3} />

      {/* Key light — warm golden */}
      <directionalLight
        position={[5, 8, 5]}
        color="#D8A45A"
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />

      {/* Fill light — soft cream */}
      <directionalLight
        position={[-3, 4, -3]}
        color="#F4E9DA"
        intensity={0.8}
      />

      {/* Rim light — caramel */}
      <pointLight
        position={[2, 2, 2]}
        color="#B8742A"
        intensity={1.5}
        distance={14}
        decay={2}
      />

      {/* Ground contact shadow — scale expanded for the larger model footprint */}
      <ContactShadows
        position={[0, -2, 0]}
        opacity={0.45}
        scale={50}
        blur={3.5}
        far={20}
        color="#2B1A12"
      />

      {/* Warm HDRI environment */}
      <Environment preset="sunset" />
    </>
  );
}
