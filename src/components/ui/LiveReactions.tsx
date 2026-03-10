import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { hapticLight } from '@/lib/haptics'

const REACTION_EMOJIS = ['❤️', '🔥', '👏', '😂', '🎵']

interface FloatingEmoji {
  id: number
  emoji: string
  x: number
  startTime: number
}

interface LiveReactionsProps {
  configDocPath?: string // Firestore doc path to store reaction counts (e.g., 'config/radio')
  isLive: boolean
}

export function LiveReactions({ configDocPath = 'config/radio', isLive }: LiveReactionsProps) {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const nextId = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Subscribe to reaction counts
  useEffect(() => {
    if (!isLive || !configDocPath) return
    const unsubscribe = onSnapshot(doc(db, configDocPath), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        setReactionCounts(data.reactions || {})
      }
    })
    return () => unsubscribe()
  }, [isLive, configDocPath])

  // Clean up old emojis
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setFloatingEmojis(prev => prev.filter(e => now - e.startTime < 3000))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const handleReaction = useCallback(async (emoji: string) => {
    hapticLight()

    // Add floating emoji
    const id = nextId.current++
    const x = 10 + Math.random() * 80
    setFloatingEmojis(prev => [...prev, { id, emoji, x, startTime: Date.now() }])

    // Update Firestore counter (fire-and-forget)
    if (configDocPath) {
      try {
        await updateDoc(doc(db, configDocPath), {
          [`reactions.${emoji}`]: (reactionCounts[emoji] || 0) + 1,
        })
      } catch {
        // Ignore errors for reactions
      }
    }
  }, [configDocPath, reactionCounts])

  if (!isLive) return null

  return (
    <div className="relative">
      {/* Floating emojis container */}
      <div ref={containerRef} className="absolute bottom-full left-0 right-0 h-48 pointer-events-none overflow-hidden">
        {floatingEmojis.map((fe) => (
          <div
            key={fe.id}
            className="absolute text-2xl animate-float-up"
            style={{
              left: `${fe.x}%`,
              bottom: 0,
            }}
          >
            {fe.emoji}
          </div>
        ))}
      </div>

      {/* Reaction buttons */}
      <div className="flex gap-2 justify-center py-3">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className="w-10 h-10 rounded-full bg-hatofes-dark/80 border border-hatofes-gray/50 flex items-center justify-center text-lg hover:scale-110 active:scale-95 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
