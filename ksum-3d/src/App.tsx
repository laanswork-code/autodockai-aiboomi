import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import { VIEWS } from './config/site'
import { Scene } from './scene/Scene'
import { Hud } from './ui/Hud'

const START = VIEWS.overview

export default function App() {
  return (
    <div className="app">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        camera={{ position: [...START.pos], fov: 38, near: 0.5, far: 3000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <Hud />
      <Loader />
    </div>
  )
}
