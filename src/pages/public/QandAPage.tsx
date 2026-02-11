import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const QA_ITEMS = [
  {
    question: 'アプリにログインするには何が必要ですか？',
    answer:
      '学校のGoogleアカウント（@g.nagano-c.ed.jp）でログインできます。アプリは生徒・教職員を対象としています。',
  },
  {
    question: '鳩ポイントとは何ですか？',
    answer:
      '鳩祭アプリ内のポイント制度です。ログインボーナスやアンケート回答、文化祭当日のゲーム参加などで獲得できます。個人やクラスでランキングを競います。',
  },
  {
    question: 'ポイントどうやって獲得できますか？',
    answer:
      'ログインボーナス（1日1回・10pt）、アンケートへの回答、管理者による付与、文化祭当日のゲーム参加などがあります。詳細はAboutページをご確認ください。',
  },
  {
    question: 'アンケートに何度も回答できますか？',
    answer:
      'いいえ。各アンケートは1人あたり1回限りです。回答済みの場合は再送信できません。',
  },
  {
    question: 'ガチャガチャに引くためには何が必要ですか？',
    answer:
      'ガチャチケットが必要です。チケットはログインボーナスの獲得時やガチャ結果の報酬などで入手できます。',
  },
  {
    question: 'クラスポイントとは何ですか？',
    answer:
      '同じクラスの生徒が獲得した個人ポイントの合計です。クラス別ランキングで競います。',
  },
  {
    question: 'ユーザーネームを変更できますか？',
    answer:
      'はい。設定ページから食材と料理の組み合わせでユーザーネームを変更できます。ただし変更回数には上限があります。',
  },
  {
    question: '通知の読み既済はどうなっていますか？',
    answer:
      '通知を開いた時点で読み済みとされます。未読の通知には通知バッジが表示されます。',
  },
  {
    question: 'アプリのことで不明点がある場合は？',
    answer:
      '設定ページの「運営への要望」からご意見やご質問をお送りください。',
  },
]

export default function QandAPage() {
  return (
    <div className="min-h-screen flex flex-col bg-hatofes-bg">
      <Header />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gradient">Q &amp; A</h1>

          <div className="space-y-4">
            {QA_ITEMS.map((item, index) => (
              <section key={index} className="border border-hatofes-gray-lighter rounded-lg overflow-hidden">
                <div className="bg-hatofes-dark px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-hatofes-accent-yellow font-bold font-display text-lg flex-shrink-0">Q</span>
                    <h2 className="text-hatofes-white font-medium">{item.question}</h2>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-hatofes-accent-orange font-bold font-display text-lg flex-shrink-0">A</span>
                    <p className="text-hatofes-gray-light leading-relaxed">{item.answer}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
