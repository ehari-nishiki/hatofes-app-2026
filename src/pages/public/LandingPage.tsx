import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { animate, stagger } from 'animejs'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'

const quickStats = [
  { label: 'POINT ACTIONS', value: '06+' },
  { label: 'APP FEATURES', value: '10' },
  { label: 'BETA STATUS', value: 'ON' },
]

const programCards = [
  {
    title: 'Daily Point Loop',
    tag: 'BASIC',
    text: 'ログインボーナス、通知、アンケート回答でポイントを獲得。準備期間中も参加の手応えが残ります。',
  },
  {
    title: 'Class Ranking',
    tag: 'BATTLE',
    text: '個人だけでなくクラス順位にも反映。学年内の空気感まで巻き込んだ競争をつくります。',
  },
  {
    title: 'Festival Extras',
    tag: 'EVENT',
    text: 'ガチャ、テトリス、ラジオ、Q&A などの企画を段階的に公開。鳩祭の導線をアプリ側から補強します。',
  },
]

const featureGroups = [
  {
    title: '基本機能',
    items: ['ログイン / 認証', 'プロフィール設定', '通知確認', 'ポイント履歴', 'レベル表示'],
  },
  {
    title: '競争と参加',
    items: ['個人ランキング', 'クラスランキング', 'アンケート回答', 'ログインボーナス', 'ミッション参加'],
  },
  {
    title: '企画コンテンツ',
    items: ['ガチャ', 'テトリス', 'ラジオ', '三役Q&A', 'スタンプラリー予定'],
  },
]

const timelineItems = [
  { time: 'STEP 01', title: 'ログインして参加開始', text: 'βテスト期間中は Google アカウントでログインし、プロフィールを設定します。' },
  { time: 'STEP 02', title: '日々のアクションで加点', text: '通知確認、アンケート回答、企画参加など、短い行動がそのまま得点になります。' },
  { time: 'STEP 03', title: '個人とクラスの順位が動く', text: '積み上がったポイントはランキングへ反映。クラス全体の勢いも可視化されます。' },
  { time: 'STEP 04', title: '当日の企画へ接続', text: '配信、ラジオ、ゲーム系企画などの入口としても機能し、当日の回遊を支えます。' },
]

const betaNotes = [
  'βテスト期間中のポイントや一部データは、本番開始時に初期化される可能性があります。',
  '学校アカウント（@g.nagano-c.ed.jp）は承認申請中のため、現在は通常の Google アカウントで検証しています。',
  '表示崩れ、ログイン不具合、使いづらさなどは情報部門で回収し、順次改善します。',
]

const supportBlocks = [
  {
    title: '運営体制',
    text: '第70期 鳩祭実行委員会 情報係が設計・開発・運営を担当しています。',
  },
  {
    title: 'フィードバック歓迎',
    text: '不具合報告だけでなく、「こう並んでいた方が見やすい」というUI面の意見も歓迎です。',
  },
  {
    title: '公開まで更新継続',
    text: '機能追加だけでなく、文言や導線も調整対象です。β期間中は構成が変わる前提で運用しています。',
  },
]

const flowSideNotes = [
  { label: 'POINTS', value: 'ログイン / 回答 / 企画参加で加点' },
  { label: 'RANKING', value: '個人 + クラスの2軸で可視化' },
  { label: 'CONTENTS', value: 'ゲーム・配信・企画導線を集約' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { currentUser, userData, loading, userDataChecked } = useAuth()
  const rootRef = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (loading || !userDataChecked) return
    if (currentUser && userData) {
      navigate('/home', { replace: true })
    }
  }, [currentUser, userData, loading, userDataChecked, navigate])

  useEffect(() => {
    if (hasAnimated.current || !rootRef.current) return
    hasAnimated.current = true

    animate('.lp-hero-item', {
      opacity: [0, 1],
      translateY: [36, 0],
      duration: 900,
      delay: stagger(120, { start: 150 }),
      ease: 'outQuart',
    })

    animate('.lp-orbit', {
      rotate: '1turn',
      duration: 24000,
      loop: true,
      ease: 'linear',
    })

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          animate(entry.target.querySelectorAll('.lp-reveal'), {
            opacity: [0, 1],
            translateY: [28, 0],
            duration: 750,
            delay: stagger(90),
            ease: 'outQuart',
          })
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.15 }
    )

    rootRef.current.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((node) => {
      observer.observe(node)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="min-h-screen flex flex-col bg-hatofes-bg overflow-hidden">
      <Header />

      <main className="flex-1">
        <section className="relative border-b border-hatofes-gray-lighter/20">
          <div className="absolute inset-0 pointer-events-none aurora-container">
            <div className="aurora-effect opacity-80" />
            <div className="aurora-blob aurora-blob-1" />
            <div className="aurora-blob aurora-blob-3" />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-4 pt-10 pb-12 md:pt-14 md:pb-16">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] items-start">
              <div className="space-y-6">
                <div className="lp-hero-item inline-flex items-center gap-2 rounded-full border border-hatofes-accent-yellow/30 bg-hatofes-accent-yellow/10 px-4 py-2 text-xs font-display tracking-[0.25em] text-hatofes-accent-yellow">
                  HATO FES APP 2026
                </div>

                <div className="lp-hero-item">
                  <p className="text-xs font-display tracking-[0.35em] text-hatofes-gray-light mb-3">第70期 鳩祭公式アプリ</p>
                  <h1 className="font-display text-5xl leading-[0.88] md:text-7xl text-gradient">
                    70th
                    <br />
                    Hato
                    <br />
                    Festival
                  </h1>
                </div>

                <div className="lp-hero-item max-w-2xl">
                  <p className="text-lg text-hatofes-white leading-relaxed">
                    準備期間の参加、当日の回遊、クラスの熱量。
                    鳩祭に関わる動きをひとつの画面に集約するための、実行委員会公式アプリです。
                  </p>
                </div>

                <div className="lp-hero-item grid gap-3 sm:grid-cols-3">
                  {quickStats.map((item) => (
                    <div key={item.label} className="card lp-panel bg-hatofes-dark/80">
                      <p className="text-[11px] font-display tracking-[0.2em] text-hatofes-gray mb-3">{item.label}</p>
                      <p className="font-display text-3xl text-gradient">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="lp-hero-item flex flex-col gap-3 sm:flex-row">
                  <Link to="/login" className="btn-main px-8 py-3 text-base text-center">
                    Log in
                  </Link>
                  <Link to="/about" className="btn-sub px-8 py-3 text-base text-center">
                    Read Concept
                  </Link>
                </div>
              </div>

              <div className="lp-hero-item">
                <div className="relative card card-aurora lp-panel min-h-[360px] overflow-hidden p-6 md:p-7">
                  <div className="absolute inset-0 opacity-30">
                    <div className="lp-orbit absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-hatofes-accent-yellow/20" />
                    <div className="lp-orbit absolute left-1/2 top-1/2 h-[14rem] w-[14rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-hatofes-accent-orange/20" />
                  </div>

                  <div className="relative z-10 flex h-full flex-col gap-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-display tracking-[0.25em] text-hatofes-gray-light">LIVE STATUS</p>
                        <p className="mt-3 text-3xl font-display leading-none text-hatofes-white">BETA / OPEN</p>
                      </div>
                      <div className="rounded-full border border-hatofes-accent-yellow/30 bg-hatofes-accent-yellow/10 px-3 py-1 text-xs font-display tracking-[0.18em] text-hatofes-accent-yellow">
                        TESTING
                      </div>
                    </div>

                      <div className="lp-subpanel rounded-2xl bg-hatofes-bg/70 p-5">
                        <p className="text-xs font-display tracking-[0.22em] text-hatofes-gray">WHAT'S INSIDE</p>
                        <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
                        <div className="lp-chip bg-hatofes-dark/90 px-4 py-3 text-hatofes-white">Points</div>
                        <div className="lp-chip bg-hatofes-dark/90 px-4 py-3 text-hatofes-white">Ranking</div>
                        <div className="lp-chip bg-hatofes-dark/90 px-4 py-3 text-hatofes-white">Survey</div>
                        <div className="lp-chip bg-hatofes-dark/90 px-4 py-3 text-hatofes-white">Live Events</div>
                      </div>
                      <div className="lp-chip mt-4 bg-gradient-to-br from-hatofes-accent-yellow/10 to-hatofes-accent-orange/10 px-4 py-4">
                        <p className="text-sm leading-relaxed text-hatofes-white">
                          毎日の参加がスコアになり、企画への接続がそのまま体験導線になります。
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-4 pt-1">
                      <span className="text-xs font-display tracking-[0.2em] text-hatofes-gray">INFORMATION DIVISION</span>
                      <span className="text-xs text-right text-hatofes-gray-light">for 70th Hato Fes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section data-reveal-group className="border-b border-hatofes-gray-lighter/20 py-12 md:py-14">
          <div className="max-w-6xl mx-auto px-4">
            <div className="lp-reveal flex flex-col gap-3 mb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-display tracking-[0.28em] text-hatofes-gray-light">APP FUNCTIONS</p>
              </div>
              <p className="text-sm text-hatofes-gray max-w-xl">現時点で使える機能と、文化祭向けに用意している企画群をひと目で把握できるように整理しました。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {featureGroups.map((group) => (
                <article key={group.title} className="lp-reveal card lp-panel p-5">
                  <h3 className="font-display text-xl text-hatofes-white mb-4">{group.title}</h3>
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-hatofes-gray-light">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-hatofes-accent-yellow" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section data-reveal-group className="border-b border-hatofes-gray-lighter/20 py-12 md:py-14">
          <div className="max-w-6xl mx-auto px-4">
            <div className="lp-reveal flex flex-col gap-3 mb-8 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-display tracking-[0.28em] text-hatofes-gray-light">PROGRAM</p>
                <h2 className="mt-2 text-3xl md:text-4xl font-display text-hatofes-white">Core Contents</h2>
              </div>
              <p className="text-sm text-hatofes-gray max-w-xl">日常的な利用と、文化祭ならではの企画を分けて設計。アプリ単体で終わらず、現場の動きにつなげます。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {programCards.map((card) => (
                <article key={card.title} className="lp-reveal card card-aurora lp-panel p-6">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-display tracking-[0.22em] text-hatofes-gray">{card.tag}</span>
                    <span className="h-2 w-2 rounded-full bg-hatofes-accent-yellow" />
                  </div>
                  <h3 className="font-display text-2xl text-hatofes-white mb-3">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-hatofes-gray-light">{card.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section data-reveal-group className="border-b border-hatofes-gray-lighter/20 py-12 md:py-14">
          <div className="max-w-6xl mx-auto px-4 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="lp-reveal">
              <p className="text-xs font-display tracking-[0.28em] text-hatofes-gray-light">HOW IT WORKS</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-display text-gradient">Participation Flow</h2>
              <p className="mt-4 text-hatofes-gray-light leading-relaxed">
                アプリ導入から当日導線までを 4 ステップで整理。初見でも役割が伝わる構成にしています。
              </p>
              <div className="mt-5 grid gap-3">
                {flowSideNotes.map((note) => (
                  <div key={note.label} className="lp-reveal card lp-panel bg-hatofes-dark/80 p-4">
                    <p className="text-xs font-display tracking-[0.2em] text-hatofes-accent-yellow mb-2">{note.label}</p>
                    <p className="text-sm text-hatofes-gray-light leading-relaxed">{note.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {timelineItems.map((item) => (
                <div key={item.time} className="lp-reveal card lp-panel flex gap-4 p-5">
                  <div className="min-w-20">
                    <p className="text-xs font-display tracking-[0.18em] text-hatofes-accent-yellow">{item.time}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-hatofes-white mb-2">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-hatofes-gray-light">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section data-reveal-group className="relative border-b border-hatofes-gray-lighter/20 py-12 md:py-14 aurora-container">
          <div className="aurora-blob aurora-blob-2" />
          <div className="max-w-6xl mx-auto px-4 relative z-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="lp-reveal card card-aurora lp-panel p-6 md:p-8">
              <p className="text-xs font-display tracking-[0.28em] text-hatofes-accent-yellow mb-4">BETA NOTES</p>
              <h2 className="text-3xl font-display text-hatofes-white mb-6">Testing With Real Feedback</h2>
              <div className="space-y-4">
                {betaNotes.map((note) => (
                  <div key={note} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-hatofes-accent-yellow" />
                    <p className="text-sm leading-relaxed text-hatofes-gray-light">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {supportBlocks.map((block) => (
                <article key={block.title} className="lp-reveal card lp-panel p-5">
                  <h3 className="font-display text-xl text-hatofes-white mb-2">{block.title}</h3>
                  <p className="text-sm leading-relaxed text-hatofes-gray-light">{block.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section data-reveal-group className="py-12 md:py-14">
          <div className="max-w-4xl mx-auto px-4">
            <div className="lp-reveal card lp-panel overflow-hidden p-0">
              <div className="grid md:grid-cols-[1.1fr_0.9fr]">
                <div className="p-6 md:p-8">
                  <p className="text-xs font-display tracking-[0.28em] text-hatofes-gray-light mb-3">CONTACT / ENTRY</p>
                  <h2 className="text-3xl md:text-4xl font-display text-hatofes-white mb-4">鳩祭の入口を、もっとわかりやすく。</h2>
                  <p className="text-hatofes-gray-light leading-relaxed mb-6">
                    アプリの使い勝手も、文化祭体験の一部です。まずはログインして、今の構成を触ってみてください。
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link to="/login" className="btn-main px-7 py-3 text-center">Log in</Link>
                    <Link to="/QandA" className="btn-sub px-7 py-3 text-center">Q & A</Link>
                  </div>
                </div>
                <div className="bg-hatofes-dark/80 p-6 md:p-8 border-t md:border-t-0 md:border-l border-hatofes-gray-lighter/20">
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-display tracking-[0.2em] text-hatofes-gray mb-1">OPERATED BY</p>
                      <p className="text-hatofes-white">第70期 鳩祭実行委員会 情報部門</p>
                    </div>
                    <div>
                      <p className="text-xs font-display tracking-[0.2em] text-hatofes-gray mb-1">BETA SUPPORT</p>
                      <p className="text-hatofes-white">不具合報告・改善提案を随時受付中</p>
                    </div>
                    <div>
                      <p className="text-xs font-display tracking-[0.2em] text-hatofes-gray mb-1">PUBLIC PAGES</p>
                      <div className="flex flex-wrap gap-2">
                        <Link to="/about" className="btn-sub px-4 py-2 text-xs">About</Link>
                        <Link to="/QandA" className="btn-sub px-4 py-2 text-xs">Q & A</Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
