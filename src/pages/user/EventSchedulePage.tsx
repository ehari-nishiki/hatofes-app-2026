import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import AppHeader from '@/components/layout/AppHeader'
import { Spinner } from '@/components/ui/Spinner'
import type { FestivalEvent, EventCategory } from '@/types/firestore'

type EventWithId = FestivalEvent & { id: string }

const CATEGORY_LABELS: Record<EventCategory, string> = {
  stage: 'ステージ',
  exhibition: '展示',
  food: '模擬店',
  game: 'ゲーム',
  ceremony: '式典',
  other: 'その他',
}

const CATEGORY_COLORS: Record<EventCategory, string> = {
  stage: 'bg-purple-500',
  exhibition: 'bg-blue-500',
  food: 'bg-orange-500',
  game: 'bg-green-500',
  ceremony: 'bg-yellow-500',
  other: 'bg-gray-500',
}

export default function EventSchedulePage() {
  const { userData } = useAuth()
  const [events, setEvents] = useState<EventWithId[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all')
  const [selectedDate, setSelectedDate] = useState<string | 'all'>('all')

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsQuery = query(
          collection(db, 'events'),
          orderBy('startTime', 'asc')
        )
        const snapshot = await getDocs(eventsQuery)
        const eventList: EventWithId[] = []
        snapshot.forEach((doc) => {
          eventList.push({ id: doc.id, ...doc.data() } as EventWithId)
        })
        setEvents(eventList)
      } catch (error) {
        console.error('Error fetching events:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  // Get unique dates
  const dates = useMemo(() => {
    const dateSet = new Set<string>()
    events.forEach((event) => {
      const date = event.startTime.toDate().toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
      dateSet.add(date)
    })
    return [...dateSet]
  }, [events])

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (selectedCategory !== 'all' && event.category !== selectedCategory) return false
      if (selectedDate !== 'all') {
        const eventDate = event.startTime.toDate().toLocaleDateString('ja-JP', {
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        })
        if (eventDate !== selectedDate) return false
      }
      return true
    })
  }, [events, selectedCategory, selectedDate])

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EventWithId[]> = {}
    filteredEvents.forEach((event) => {
      const date = event.startTime.toDate().toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(event)
    })
    return grouped
  }, [filteredEvents])

  // Check if event is currently happening
  const isEventNow = (event: EventWithId) => {
    const now = new Date()
    const start = event.startTime.toDate()
    const end = event.endTime.toDate()
    return now >= start && now <= end
  }

  // Check if event is upcoming (within 30 minutes)
  const isEventSoon = (event: EventWithId) => {
    const now = new Date()
    const start = event.startTime.toDate()
    const diff = start.getTime() - now.getTime()
    return diff > 0 && diff <= 30 * 60 * 1000
  }

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hatofes-bg pb-20">
      <AppHeader
        username={userData?.username || ''}
        grade={userData?.grade}
        classNumber={userData?.class}
      />

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/home" className="p-2 -ml-2 text-hatofes-gray hover:text-hatofes-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-hatofes-white font-display">イベントスケジュール</h1>
        </div>

        {/* Date filter */}
        {dates.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedDate('all')}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                selectedDate === 'all'
                  ? 'bg-hatofes-accent-yellow text-black'
                  : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
              }`}
            >
              全日程
            </button>
            {dates.map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  selectedDate === date
                    ? 'bg-hatofes-accent-yellow text-black'
                    : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
                }`}
              >
                {date}
              </button>
            ))}
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-hatofes-accent-orange text-white'
                : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
            }`}
          >
            すべて
          </button>
          {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors flex items-center gap-1 ${
                selectedCategory === category
                  ? 'bg-hatofes-accent-orange text-white'
                  : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[category]}`} />
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>

        {/* Event list */}
        {Object.keys(eventsByDate).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-hatofes-gray">イベントが登録されていません</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(eventsByDate).map(([date, dateEvents]) => (
              <div key={date}>
                <h2 className="text-sm font-bold text-hatofes-gray mb-3 sticky top-0 bg-hatofes-bg py-2">
                  {date}
                </h2>
                <div className="space-y-3">
                  {dateEvents.map((event) => {
                    const isNow = isEventNow(event)
                    const isSoon = isEventSoon(event)

                    return (
                      <div
                        key={event.id}
                        className={`card relative overflow-hidden transition-all ${
                          isNow
                            ? 'ring-2 ring-red-500 animate-pulse-border-red'
                            : isSoon
                            ? 'ring-1 ring-yellow-500'
                            : ''
                        }`}
                      >
                        {/* Status badge */}
                        {isNow && (
                          <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded-bl-lg font-bold">
                            NOW
                          </div>
                        )}
                        {isSoon && !isNow && (
                          <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs px-2 py-1 rounded-bl-lg font-bold">
                            SOON
                          </div>
                        )}

                        {/* Category indicator */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${CATEGORY_COLORS[event.category]}`} />

                        <div className="pl-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-hatofes-dark text-hatofes-gray">
                                  {CATEGORY_LABELS[event.category]}
                                </span>
                                {event.isHighlight && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow">
                                    注目
                                  </span>
                                )}
                              </div>
                              <h3 className="font-bold text-hatofes-white">{event.title}</h3>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-sm text-hatofes-gray">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatTime(event.startTime.toDate())} - {formatTime(event.endTime.toDate())}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {event.location}
                            </span>
                          </div>

                          {event.description && (
                            <p className="text-xs text-hatofes-gray mt-2">{event.description}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Add animation styles
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes pulse-border-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
  }
  .animate-pulse-border-red {
    animation: pulse-border-red 2s ease-in-out infinite;
  }
`
if (!document.querySelector('#event-schedule-styles')) {
  styleSheet.id = 'event-schedule-styles'
  document.head.appendChild(styleSheet)
}
