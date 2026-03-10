import { useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { animate } from 'animejs'

interface PageTransitionProps {
  children: React.ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)
  const prevPathRef = useRef(location.pathname)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const prevPath = prevPathRef.current
    prevPathRef.current = location.pathname

    // Determine direction: going deeper = forward, going shallower = backward
    const prevDepth = prevPath.split('/').filter(Boolean).length
    const currDepth = location.pathname.split('/').filter(Boolean).length
    const isForward = currDepth >= prevDepth

    // Quick slide-in animation
    animate(el, {
      opacity: [0.8, 1],
      translateX: [isForward ? 30 : -30, 0],
      duration: 200,
      ease: 'outQuart',
    })
  }, [location.pathname])

  return (
    <div ref={containerRef}>
      {children}
    </div>
  )
}
