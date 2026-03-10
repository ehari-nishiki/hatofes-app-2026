import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import type { EventCategory, FestivalEvent } from '@/types/firestore'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

type EventWithId = FestivalEvent & { id: string }

const CATEGORY_LABELS: Record<EventCategory, string> = {
  stage: 'ステージ',
  exhibition: '展示',
  food: '模擬店',
  game: 'ゲーム',
  ceremony: '式典',
  other: 'その他',
}

export default function EventSchedulePage() {
  const { userData } = useAuth()
  const [events, setEvents] = useState<EventWithId[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all')
  const [selectedDate, setSelectedDate] = useState<string | 'all'>('all')

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsQuery = query(collection(db, 'events'), orderBy('startTime', 'asc'))
        const snapshot = await getDocs(eventsQuery)
        setEvents(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as EventWithId)))
      } catch (error) {
        console.error('Error fetching events:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const dates = useMemo(() => {
    const dateSet = new Set<string>()
    events.forEach((event) => {
      dateSet.add(event.startTime.toDate().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }))
    })
    return [...dateSet]
  }, [events])

  const filteredEvents = useMemo(() => events.filter((event) => {
    if (selectedCategory !== 'all' && event.category !== selectedCategory) return false
    if (selectedDate !== 'all') {
      const eventDate = event.startTime.toDate().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
      if (eventDate !== selectedDate) return false
    }
    return true
  }), [events, selectedCategory, selectedDate])

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EventWithId[]> = {}
    filteredEvents.forEach((event) => {
      const date = event.startTime.toDate().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(event)
    })
    return grouped
  }, [filteredEvents])

  const isEventNow = (event: EventWithId) => {
    const now = new Date()
    return now >= event.startTime.toDate() && now <= event.endTime.toDate()
  }

  const isEventSoon = (event: EventWithId) => {
    const diff = event.startTime.toDate().getTime() - Date.now()
    return diff > 0 && diff <= 30 * 60 * 1000
  }

  const formatTime = (date: Date) => date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

  if (loading || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      <PageHero
        eyebrow="Festival Agenda"
        title="Event Schedule"
        description="日付やカテゴリで絞り込みながら、注目企画と現在進行中のイベントを確認できます。"
        aside={<PageBackLink />}
      />

      <div className="grid gap-4 xl:grid-cols-[0.74fr_1.26fr]">
        <div className="space-y-4">
          <PageSection>
            <PageSectionTitle eyebrow="Filter" title="条件" />
            <div className="flex flex-wrap gap-2">
              <FilterChip active={selectedDate === 'all'} onClick={() => setSelectedDate('all')}>全日程</FilterChip>
              {dates.map((date) => (
                <FilterChip key={date} active={selectedDate === date} onClick={() => setSelectedDate(date)}>{date}</FilterChip>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>すべて</FilterChip>
              {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((category) => (
                <FilterChip key={category} active={selectedCategory === category} onClick={() => setSelectedCategory(category)}>
                  {CATEGORY_LABELS[category]}
                </FilterChip>
              ))}
            </div>
          </PageSection>

          <PageSection>
            <PageSectionTitle eyebrow="Summary" title="件数" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <PageMetric label="Filtered" value={filteredEvents.length.toString()} />
              <PageMetric label="Dates" value={Object.keys(eventsByDate).length.toString()} tone="soft" />
            </div>
          </PageSection>
        </div>

        <PageSection>
          <PageSectionTitle eyebrow="Timeline" title="イベント一覧" />
          {Object.keys(eventsByDate).length === 0 ? (
            <PageEmptyState title="イベントが登録されていません" />
          ) : (
            <div className="space-y-5">
              {Object.entries(eventsByDate).map(([date, dateEvents]) => (
                <div key={date}>
                  <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/34">{date}</p>
                  <div className="space-y-2">
                    {dateEvents.map((event) => {
                      const isNow = isEventNow(event)
                      const isSoon = isEventSoon(event)
                      return (
                        <div key={event.id} className={`rounded-[1.1rem] p-4 ${isNow ? 'bg-[#d9e4dc] text-[#11161a]' : 'bg-[#0f1418] text-white'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-[11px] ${isNow ? 'bg-[#11161a] text-white' : 'bg-white/[0.08] text-white/64'}`}>
                                  {CATEGORY_LABELS[event.category]}
                                </span>
                                {event.isHighlight ? <span className="rounded-full bg-[#f7d37c] px-2.5 py-1 text-[11px] font-semibold text-[#11161a]">注目</span> : null}
                                {isSoon && !isNow ? <span className="rounded-full bg-[#2d2818] px-2.5 py-1 text-[11px] text-[#f7d37c]">SOON</span> : null}
                              </div>
                              <h3 className="mt-3 text-sm font-semibold">{event.title}</h3>
                            </div>
                            {isNow ? <span className="rounded-full bg-[#11161a] px-2.5 py-1 text-[11px] font-semibold text-white">NOW</span> : null}
                          </div>
                          <p className={`mt-3 text-xs ${isNow ? 'text-[#11161a]/58' : 'text-white/42'}`}>
                            {formatTime(event.startTime.toDate())} - {formatTime(event.endTime.toDate())} / {event.location}
                          </p>
                          {event.description ? <p className={`mt-2 text-sm ${isNow ? 'text-[#11161a]/72' : 'text-white/62'}`}>{event.description}</p> : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PageSection>
      </div>
    </UserPageShell>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-white text-[#11161a]' : 'bg-[#0f1418] text-white/64 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
