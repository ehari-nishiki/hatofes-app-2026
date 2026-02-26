import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Rarity to color mapping
const RARITY_COLORS: Record<string, string> = {
  common: '#9CA3AF',      // Gray
  uncommon: '#22C55E',    // Green
  rare: '#3B82F6',        // Blue
  epic: '#A855F7',        // Purple
  legendary: '#F59E0B',   // Gold
}

interface FeatherProps {
  position: [number, number, number]
  color: string
  delay: number
}

// Individual feather with falling animation
function Feather({ position, color, delay }: FeatherProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [visible, setVisible] = useState(false)
  const startTime = useRef(Date.now() + delay)
  const velocity = useRef({ x: (Math.random() - 0.5) * 0.02, y: -0.02, rotX: Math.random() * 0.05, rotZ: Math.random() * 0.05 })

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  useFrame(() => {
    if (meshRef.current && visible) {
      const elapsed = (Date.now() - startTime.current) / 1000

      // Gentle floating fall with slight drift
      meshRef.current.position.y -= velocity.current.y + Math.sin(elapsed * 2) * 0.002
      meshRef.current.position.x += velocity.current.x + Math.sin(elapsed * 3) * 0.005
      meshRef.current.rotation.x += velocity.current.rotX
      meshRef.current.rotation.z += velocity.current.rotZ

      // Reset if fallen too far
      if (meshRef.current.position.y < -5) {
        meshRef.current.position.y = 5
      }
    }
  })

  if (!visible) return null

  return (
    <mesh ref={meshRef} position={position}>
      {/* Feather shape: elongated ellipse */}
      <planeGeometry args={[0.15, 0.5, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        side={THREE.DoubleSide}
        transparent
        opacity={0.9}
      />
    </mesh>
  )
}

interface DoveProps {
  onComplete: () => void
}

// Dove that flies across
function Dove({ onComplete }: DoveProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [completed, setCompleted] = useState(false)
  const startTime = useRef(Date.now())

  useFrame(() => {
    if (groupRef.current && !completed) {
      const elapsed = (Date.now() - startTime.current) / 1000

      // Fast fly from right to left
      const progress = elapsed * 3 // Speed factor
      groupRef.current.position.x = 8 - progress * 4
      groupRef.current.position.y = Math.sin(progress * 2) * 0.5

      // Wing flapping
      const wingAngle = Math.sin(elapsed * 30) * 0.3
      const children = groupRef.current.children
      if (children[1]) (children[1] as THREE.Mesh).rotation.z = wingAngle
      if (children[2]) (children[2] as THREE.Mesh).rotation.z = -wingAngle

      // Complete when off screen
      if (groupRef.current.position.x < -8) {
        setCompleted(true)
        onComplete()
      }
    }
  })

  return (
    <group ref={groupRef} position={[8, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFDD" emissiveIntensity={0.5} />
      </mesh>
      {/* Left Wing */}
      <mesh position={[0, 0.1, 0.3]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.4]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFDD" emissiveIntensity={0.3} />
      </mesh>
      {/* Right Wing */}
      <mesh position={[0, 0.1, -0.3]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.4]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFDD" emissiveIntensity={0.3} />
      </mesh>
      {/* Glow */}
      <pointLight color="#FFFFAA" intensity={2} distance={3} />
    </group>
  )
}

interface GachaAnimationProps {
  featherCount: number
  rarities: string[]
  onComplete: () => void
}

function GachaScene({ featherCount, rarities, onComplete }: GachaAnimationProps) {
  const [doveComplete, setDoveComplete] = useState(false)
  const [showFeathers, setShowFeathers] = useState(false)

  const handleDoveComplete = () => {
    setDoveComplete(true)
    setShowFeathers(true)
    // Call onComplete after feathers have fallen
    setTimeout(onComplete, 2000)
  }

  const feathers = useMemo(() => {
    return Array.from({ length: featherCount }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 6,
        3 + Math.random() * 2,
        (Math.random() - 0.5) * 2
      ] as [number, number, number],
      color: RARITY_COLORS[rarities[i] || 'common'] || RARITY_COLORS.common,
      delay: i * 100 // Stagger feather appearance
    }))
  }, [featherCount, rarities])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />

      {!doveComplete && <Dove onComplete={handleDoveComplete} />}

      {showFeathers && feathers.map((feather, i) => (
        <Feather
          key={i}
          position={feather.position}
          color={feather.color}
          delay={feather.delay}
        />
      ))}
    </>
  )
}

interface GachaAnimationContainerProps {
  show: boolean
  featherCount: number
  rarities: string[]
  onComplete: () => void
}

export function GachaAnimation({ show, featherCount, rarities, onComplete }: GachaAnimationContainerProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="w-full h-full max-w-lg max-h-[600px]">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <GachaScene
            featherCount={featherCount}
            rarities={rarities}
            onComplete={onComplete}
          />
        </Canvas>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-hatofes-gray text-sm animate-pulse">
        ...
      </div>
    </div>
  )
}
