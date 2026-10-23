import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import { LITE } from './config/quality'
import { VIEWS } from './config/site'
import { Scene } from './scene/Scene'
import { Hud } from './ui/Hud'

const START = VIEWS.overview

export default function App() {
  return (
    <div className="app">
      <Canvas
        shadows={LITE ? false : 'percentage'}
        dpr={LITE ? 1 : [1, 1.5]}
        // software WebGL renders slowly enough to starve the page's network callbacks, so only redraw on change
        frameloop={LITE ? 'demand' : 'always'}
        camera={{ position: [...START.pos], fov: 38, near: 0.5, far: 3000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: LITE }}
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
