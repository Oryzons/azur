import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, Resize, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { RibHighlightPart } from './ribBoatPresets';
import { CHECK_FLOW_BOAT_MODEL_URL } from './ribBoatModelConfig';

const ACCENT = '#38bdf8';

type Props = Readonly<{
  highlight: RibHighlightPart;
}>;

type Hotspot = {
  position: [number, number, number];
  label: string;
};

const HOTSPOTS: Record<Exclude<RibHighlightPart, 'none'>, Hotspot> = {
  tubes: { position: [1.35, 0.55, 0], label: 'Flanc' },
  bow: { position: [0, 0.65, 1.55], label: 'Proue' },
  stern: { position: [0, 0.55, -1.45], label: 'Arrière' },
  console: { position: [0, 0.95, -0.35], label: 'Console' },
  engine: { position: [0, 0.45, -1.75], label: 'Moteur' },
  deck: { position: [0, 0.75, 0.15], label: 'Pont' },
};

function PhotoHotspot(props: Readonly<{ hotspot: Hotspot }>) {
  const ring = useRef<THREE.Mesh>(null);
  const arrow = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 3.2) * 0.12;
    if (ring.current) {
      ring.current.scale.setScalar(pulse);
      ring.current.rotation.z = t * 0.8;
    }
    if (arrow.current) {
      arrow.current.position.y = props.hotspot.position[1] + 0.35 + Math.sin(t * 2.6) * 0.06;
    }
  });

  return (
    <group position={props.hotspot.position}>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.3, 40]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={arrow} position={[0, 0.35, 0]}>
        <coneGeometry args={[0.08, 0.18, 4]} />
        <meshBasicMaterial color={ACCENT} />
      </mesh>
      <pointLight color={ACCENT} intensity={1.8} distance={2.2} decay={2} />
    </group>
  );
}

export function RibBoatModel({ highlight }: Props) {
  const { scene } = useGLTF(CHECK_FLOW_BOAT_MODEL_URL);
  const model = useMemo(() => scene.clone(true), [scene]);
  const hotspot = highlight !== 'none' ? HOTSPOTS[highlight] : null;

  return (
    <group>
      <Center bottom>
        <group rotation={[0, Math.PI / 2, 0]}>
          <Resize scale={3.6}>
            <primitive object={model} />
          </Resize>
        </group>
      </Center>
      {hotspot ? <PhotoHotspot hotspot={hotspot} /> : null}
    </group>
  );
}

useGLTF.preload(CHECK_FLOW_BOAT_MODEL_URL);
