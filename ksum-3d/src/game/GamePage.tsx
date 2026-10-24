/*
 * /play: the multiplayer parking game in the digital twin. Before you join,
 * the camera circles the site behind the login card; once in, the physics
 * world starts and you play from the road east of the towers.
 */
import './game.css'
import { Loader } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { LITE } from '../config/quality'
import { Scene } from '../scene/Scene'
import { useSceneStore } from '../store/useSceneStore'
import { GameHud } from './GameHud'
import { GamePhone } from './GamePhone'
import { bindInput } from './input'
import { Login } from './Login'
import { FullMap } from './MapView'
import { disconnect } from './net'
import { Play } from './Play'
import { handles, live, useGame } from './store'

// dev only: lets a test script read positions and state while it presses keys
if (import.meta.env.DEV) Object.assign(window, { __game: { live, useGame, handles } })

/** Slow orbit over the towers while the login card is up. */
function Orbit() {
  useFrame(({ camera, clock }) => {
    const a = clock.elapsedTime * 0.05
    camera.position.set(-40 + Math.cos(a) * 90, 45, 30 + Math.sin(a) * 90)
    camera.lookAt(-40, 4, 25)
  })
  return null
}

export default function GamePage() {
  const status = useGame((s) => s.status)
  const playing = status === 'playing' || status === 'offline'
  useEffect(() => bindInput(), [])
  useEffect(() => { useSceneStore.getState().setMode('autodock') }, [])
  useEffect(() => () => disconnect(), [])

  return (
    <div className="gm">
      <Canvas
        shadows={LITE ? false : 'percentage'}
        dpr={LITE ? 1 : [1, 1.5]}
        camera={{ position: [-120, 60, 140], fov: 60, near: 0.1, far: 3000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: LITE }}
      >
        <Suspense fallback={null}>
          <Scene film parking={!playing} />
          {playing ? (
            <Physics gravity={[0, -9.81, 0]}>
              <Play />
            </Physics>
          ) : <Orbit />}
        </Suspense>
      </Canvas>
      {!playing && <Login />}
      {playing && (
        <>
          <GameHud />
          <FullMap />
          <GamePhone />
        </>
      )}
      {status === 'offline' && (
        <div className="gm-offline" role="alert">Lost the game server. <button type="button" onClick={() => location.reload()}>Rejoin</button></div>
      )}
      <Loader />
    </div>
  )
}
