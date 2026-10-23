import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { CARS, makeCar, type CarKind } from './carModels'

type CarProps = { kind: CarKind; color: string } & Omit<React.ComponentProps<'group'>, 'children'>

/** A parked car on the ground. */
export function Car({ kind, color, ...props }: CarProps) {
  const { scene } = useGLTF(CARS[kind].url)
  const obj = useMemo(() => makeCar(scene, kind, color), [scene, kind, color])
  return (
    <group {...props}>
      <primitive object={obj} />
    </group>
  )
}

useGLTF.preload(CARS.seal.url)
useGLTF.preload(CARS.atto.url)
