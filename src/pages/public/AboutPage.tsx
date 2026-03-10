import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function AboutPage() {
  const contentRef = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (hasAnimated.current || !contentRef.current) return
    hasAnimated.current = true

    // Title
    animate('.about-title', {
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 800,
      ease: 'outQuart',
    })

    // Sections stagger
    animate('.about-section', {
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 700,
      delay: stagger(150, { start: 300 }),
      ease: 'outQuart',
    })
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-hatofes-bg">
      <Header />

      <main className="flex-1 px-4 py-8" ref={contentRef}>
        <div className="max-w-2xl mx-auto">
          <h1 className="about-title text-3xl font-bold mb-8 text-gradient" style={{ opacity: 0 }}>
            About
          </h1>

          <section className="about-section mb-8" style={{ opacity: 0 }}>
            <h2 className="text-xl font-bold mb-4 text-hatofes-white">鳩祭アプリとは？</h2>
            <p className="text-hatofes-gray-light leading-relaxed">
              鳩祭アプリは、第70期鳩祭をもっと盛り上げるためのポイント管理アプリです。
              ログインやアンケート回答でポイントを貯めて、個人やクラスでランキングを競おう。
              文化祭当日にはゲーム参加でもポイントが獲得できます。
            </p>
          </section>

          <section className="about-section mb-8" style={{ opacity: 0 }}>
            <h2 className="text-xl font-bold mb-4 text-hatofes-white">現在のステータス</h2>
            <div className="card card-aurora p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hatofes-accent-yellow opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-hatofes-accent-yellow" />
                </span>
                <span className="font-display font-bold text-hatofes-accent-yellow tracking-wider">
                  BETA TEST
                </span>
              </div>
              <p className="text-hatofes-gray-light text-sm leading-relaxed">
                現在βテスト中です。一部の機能は未実装・変更される可能性があります。
                βテスト中に獲得したポイントやデータは、本番開始時にリセットされる場合があります。
              </p>
            </div>
          </section>

          <section className="about-section mb-8" style={{ opacity: 0 }}>
            <h2 className="text-xl font-bold mb-4 text-hatofes-white">ポイントの獲得方法</h2>
            <ul className="text-hatofes-gray-light space-y-3">
              <li className="flex items-center gap-3">
                <span className="point-badge">+10pt</span>
                <span>ログインボーナス（1日1回）</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="point-badge">+20pt</span>
                <span>アンケートへの回答</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="point-badge">+??pt</span>
                <span>文化祭当日のゲーム参加</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="point-badge">+??pt</span>
                <span>管理者からの特別付与</span>
              </li>
            </ul>
          </section>

          <section className="about-section mb-8" style={{ opacity: 0 }}>
            <h2 className="text-xl font-bold mb-4 text-hatofes-white">利用対象</h2>
            <p className="text-hatofes-gray-light leading-relaxed mb-3">
              本番では学校のGoogleアカウント（@g.nagano-c.ed.jp）でのログインを予定していますが、
              現在は承認申請中のため、βテスト期間中は通常のGoogleアカウント（@gmail.com）でご利用いただけます。
            </p>
            <div className="card p-4 border border-hatofes-accent-yellow/20 bg-hatofes-accent-yellow/5">
              <p className="text-hatofes-accent-yellow text-sm font-bold mb-1">βテスト期間中のログインについて</p>
              <p className="text-hatofes-gray-light text-sm">
                お持ちのGmail（@gmail.com）アカウントでログインしてください。
                本番リリース時に学校アカウントへ切り替わります。
              </p>
            </div>
          </section>

          <section className="about-section mb-8" style={{ opacity: 0 }}>
            <h2 className="text-xl font-bold mb-4 text-hatofes-white">開発・運営</h2>
            <p className="text-hatofes-gray-light leading-relaxed">
              第70期 鳩祭実行委員会 情報部門が開発・運営しています。
              バグ報告や機能リクエストは情報部門までお寄せください。
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
