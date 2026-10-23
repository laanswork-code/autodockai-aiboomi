import { CameraControls, Environment, Lightformer, Sky } from '@react-three/drei'
import { Suspense, useEffect, useRef } from 'react'
import { VIEWS } from '../config/site'
import { useSceneStore } from '../store/useSceneStore'
import { Context } from './Context'
import { KtizBuilding } from './KtizBuilding'
import { Parking } from './Parking'
import { Site } from './Site'

const SUN: [number, number, number] = [-90, 120, 140]

function Lighting() {
  return (
    <>
      <Sky sunPosition={SUN} turbidity={6} rayleigh={1.4} mieCoefficient={0.004} />
      {/* humid coastal haze: the ground fades into the sky at the horizon */}
      <fog attach="fog" args={['#cfdbe2', 350, 1600]} />
      <hemisphereLight args={['#dfe9f2', '#7c7a6c', 0.65]} />
      <directionalLight
        position={SUN}
        intensity={2.4}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-near={10}
        shadow-camera-far={500}
      />
      {/* Local reflections for glass and car paint; no network fetch. */}
      <Environment resolution={256}>
        <Lightformer intensity={2} position={[0, 30, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
        <Lightformer intensity={1.2} color="#ffe9c8" position={[-40, 10, 40]} scale={[40, 10, 1]} />
        <Lightformer intensity={0.8} color="#cfe3ff" position={[50, 8, -30]} scale={[40, 10, 1]} />
      </Environment>
    </>
  )
}

/** Moves the camera when a view preset is picked; free orbiting otherwise. */
function CameraRig() {
  const ref = useRef<CameraControls>(null)
  const view = useSceneStore((s) => s.view)
  const nonce = useSceneStore((s) => s.viewNonce)
  useEffect(() => {
    const { pos: p, target: t } = VIEWS[view]
    ref.current?.setLookAt(p[0], p[1], p[2], t[0], t[1], t[2], nonce > 0)
  }, [view, nonce])
  return <CameraControls ref={ref} maxPolarAngle={Math.PI * 0.49} minDistance={4} maxDistance={600} />
}

export function Scene() {
  return (
    <>
      <Lighting />
      <CameraRig />
      <Context />
      <Site />
      <KtizBuilding />
      <Suspense fallback={null}>
        <Parking />
      </Suspense>
    </>
  )
}
