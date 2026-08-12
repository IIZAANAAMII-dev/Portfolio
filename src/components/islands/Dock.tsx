'use client';

/** Ponton : quelques planches et deux pilotis, orienté vers la mer. */
export function Dock({ angle, reach }: { angle: number; reach: number }) {
  const planks = 6;
  return (
    <group rotation-y={-angle}>
      {Array.from({ length: planks }, (_, i) => {
        const x = reach - 3.6 + (i / (planks - 1)) * 5.2;
        return (
          <mesh key={i} position={[x, 0.9, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.14, 2.1]} />
            <meshStandardMaterial color="#8a6b4d" roughness={1} flatShading />
          </mesh>
        );
      })}
      {[-0.85, 0.85].map((z) => (
        <mesh key={z} position={[reach + 1.4, 0.2, z]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 2.4, 5]} />
          <meshStandardMaterial color="#6b5238" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}
