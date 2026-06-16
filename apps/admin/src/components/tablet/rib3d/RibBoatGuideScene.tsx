import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { CheckFlowGuideKind } from '@/lib/checkFlowPhotoGuide';
import { RIB_CAMERA_PRESETS } from './ribBoatPresets';
import { RibBoatModel } from './RibBoatModel';

function AnimatedCamera({ kind }: Readonly<{ kind: CheckFlowGuideKind }>) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const lookCurrent = useRef(new THREE.Vector3(0, 0.3, 0));
  const fovTarget = useRef(38);

  useEffect(() => {
    const preset = RIB_CAMERA_PRESETS[kind];
    targetPos.current.set(...preset.position);
    targetLook.current.set(...preset.lookAt);
    fovTarget.current = preset.fov;
  }, [kind]);

  useFrame((_, delta) => {
    const t = Math.min(1, delta * 2.8);
    camera.position.lerp(targetPos.current, t);
    lookCurrent.current.lerp(targetLook.current, t);
    camera.lookAt(lookCurrent.current);
    if ('fov' in camera && typeof camera.fov === 'number') {
      camera.fov = THREE.MathUtils.lerp(camera.fov, fovTarget.current, t);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function Water() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = -0.02 + Math.sin(clock.elapsedTime * 0.8) * 0.02;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#7dd3fc" transparent opacity={0.55} roughness={0.15} metalness={0.05} />
    </mesh>
  );
}

function SceneContent({ kind }: Readonly<{ kind: CheckFlowGuideKind }>) {
  const preset = RIB_CAMERA_PRESETS[kind];
  return (
    <>
      <color attach="background" args={['#0c4a6e']} />
      <fog attach="fog" args={['#0c4a6e', 14, 28]} />
      <Environment preset="city" />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 6, -3]} intensity={0.45} color="#bae6fd" />
      <AnimatedCamera kind={kind} />
      <RibBoatModel highlight={preset.highlight} />
      <Water />
      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={12} blur={2.5} far={5} color="#0f172a" />
    </>
  );
}

type Props = Readonly<{
  kind: CheckFlowGuideKind;
  compact?: boolean;
}>;

export function RibBoatGuideScene({ kind, compact }: Props) {
  const preset = RIB_CAMERA_PRESETS[kind];

  return (
    <div
      className={[
        'cf-rib-scene relative overflow-hidden rounded-3xl',
        compact ? 'h-32' : 'h-56 sm:h-64',
      ].join(' ')}
      aria-hidden
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        camera={{ position: preset.position, fov: preset.fov, near: 0.1, far: 50 }}
      >
        <Suspense fallback={null}>
          <SceneContent kind={kind} />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c4a6e]/80 via-transparent to-[#0c4a6e]/20" />

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90 ring-1 ring-white/25 backdrop-blur-md">
          {preset.shotLabel}
        </span>
        <span className="cf-rib-camera-badge flex h-8 w-8 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-md">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 8h11M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 4.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z" />
            <rect x="4" y="8" width="16" height="11" rx="2" />
          </svg>
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3 pt-8">
        <p className="text-center text-sm font-semibold text-white drop-shadow-md">{preset.viewHint}</p>
        <div className="mx-auto mt-2 h-1 w-24 overflow-hidden rounded-full bg-white/20">
          <div className="cf-rib-scan h-full w-1/2 rounded-full bg-sky-300/90" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-5 rounded-2xl border border-white/20 cf-rib-frame" />
      <p className="pointer-events-none absolute bottom-1 right-2 text-[9px] text-white/35">
        Quaternius · CC0
      </p>
    </div>
  );
}
