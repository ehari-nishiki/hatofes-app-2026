import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-hatofes-bg">
      <Header />

      {/* Content */}
      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gradient">About</h1>

          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-hatofes-white">鳩祭アプリとは？</h2>
            <p className="text-hatofes-gray-light leading-relaxed">
              鳩祭アプリは、第70期鳩祭をより楽しくするためのポイント管理システムです。
              ログインやアンケート回答でポイントを獲得し、個人やクラスでランキングを競うことができます。
            </p>
          </section>

          <section className="mb-8">
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
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-hatofes-white">利用対象</h2>
            <p className="text-hatofes-gray-light leading-relaxed">
              本アプリは学校のGoogleアカウント（@g.nagano-c.ed.jp）を持つ生徒・教職員が利用できます。
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
