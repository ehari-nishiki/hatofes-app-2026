import { doc, setDoc, Timestamp, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

// Demo notifications
const demoNotifications = [
  {
    id: 'notif-demo-1',
    title: '鳩Tシャツデザインを募集しています！',
    message: '今年の鳩祭オリジナルTシャツのデザインを募集中です！\n\n採用されたデザインには特別ポイントを進呈します。\n締め切りは2月15日です。皆さんの創作をお待ちしています！',
    targetRoles: ['student', 'teacher', 'staff', 'admin'],
    targetUsers: [],
    readBy: [],
    createdAt: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
  },
  {
    id: 'notif-demo-2',
    title: 'アイデア掲示板を使って夢を実現しよう！',
    message: '鳩祭をもっと盛り上げるアイデアを募集中！\n\nアイデア掲示板に投稿して、みんなで素敵な文化祭を作りましょう。\n良いアイデアにはポイントボーナスもあります！',
    targetRoles: ['student', 'teacher', 'staff', 'admin'],
    targetUsers: [],
    readBy: [],
    createdAt: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
  },
  {
    id: 'notif-demo-3',
    title: 'ミサンガ企画について',
    message: '今年も恒例のミサンガ企画を実施します！\n\n友達同士でミサンガを交換して、鳩祭の思い出を作りましょう。\n詳細は後日お知らせします。',
    targetRoles: ['student', 'teacher', 'staff', 'admin'],
    targetUsers: [],
    readBy: [],
    createdAt: Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
  },
  {
    id: 'notif-demo-4',
    title: '文化祭準備期間のスケジュールについて',
    message: '文化祭準備期間中のスケジュールが決定しました。\n\n各クラスの準備時間や共用スペースの利用時間を確認してください。\nスケジュール表はアプリ内で確認できます。',
    targetRoles: ['student', 'teacher', 'staff', 'admin'],
    targetUsers: [],
    readBy: [],
    createdAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
  },
  {
    id: 'notif-demo-5',
    title: 'ポイント制度について',
    message: '鳩祭アプリではポイントを貯めることができます！\n\n【ポイント獲得方法】\n・毎日のログインボーナス\n・アンケートへの回答\n・ミッション達成\n・文化祭当日のゲーム参加\n\n貯めたポイントは特典と交換できます！',
    targetRoles: ['student', 'teacher', 'staff', 'admin'],
    targetUsers: [],
    readBy: [],
    createdAt: Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
  },
]

// Demo tasks (category: 'task')
const demoTasks = [
  {
    id: 'survey-task-1',
    title: '鳩祭理解度クイズに挑戦しよう！',
    description: '鳩祭のルールや歴史についてのクイズです。全問正解でボーナスポイント！',
    category: 'task',
    points: 20,
    status: 'active',
    questions: [
      {
        id: 'q-1',
        type: 'multiple_choice',
        question: '鳩祭は毎年いつ頃開催されますか？',
        options: ['5月', '7月', '9月', '11月'],
        required: true,
      },
      {
        id: 'q-2',
        type: 'multiple_choice',
        question: '鳩祭の名前の由来は？',
        options: ['校章に鳩がいるから', '創立者の名前', '平和の象徴', '校舎の形'],
        required: true,
      },
      {
        id: 'q-3',
        type: 'rating',
        question: '今年の鳩祭への期待度を5段階で教えてください',
        required: true,
      },
    ],
    startDate: Timestamp.now(),
    endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    createdBy: 'system',
    createdAt: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
  },
  {
    id: 'survey-task-2',
    title: 'グッズ投票のアンケートに回答しよう！',
    description: '今年の鳩祭グッズを決める投票です。あなたの一票が反映されます！',
    category: 'task',
    points: 15,
    status: 'active',
    questions: [
      {
        id: 'q-1',
        type: 'multiple_choice',
        question: '欲しい鳩祭グッズはどれですか？',
        options: ['キーホルダー', 'トートバッグ', 'ステッカー', 'クリアファイル'],
        required: true,
      },
      {
        id: 'q-2',
        type: 'multiple_choice',
        question: 'グッズの価格帯はどのくらいがいいですか？',
        options: ['300円以下', '300〜500円', '500〜1000円', '1000円以上'],
        required: true,
      },
      {
        id: 'q-3',
        type: 'text',
        question: 'その他、グッズについての要望があれば教えてください',
        required: false,
      },
    ],
    startDate: Timestamp.now(),
    endDate: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
    createdBy: 'system',
    createdAt: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
  },
]

// Demo missions (category: 'mission')
const demoMissions = [
  {
    id: 'survey-mission-1',
    title: '鳩Tシャツデザインを応募しよう！',
    description: '今年の鳩祭オリジナルTシャツのデザインを考えて応募しよう！採用されると特別ポイント！',
    category: 'mission',
    points: 50,
    status: 'active',
    questions: [
      {
        id: 'q-1',
        type: 'text',
        question: 'デザインのコンセプトを教えてください',
        required: true,
      },
      {
        id: 'q-2',
        type: 'multiple_choice',
        question: 'メインカラーは何色がいいですか？',
        options: ['白', '黒', '青', 'その他'],
        required: true,
      },
      {
        id: 'q-3',
        type: 'text',
        question: 'デザインの説明（詳細）',
        required: false,
      },
    ],
    startDate: Timestamp.now(),
    endDate: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
    createdBy: 'system',
    createdAt: Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
  },
  {
    id: 'survey-mission-2',
    title: 'アイデア掲示板に投稿しよう！',
    description: '鳩祭をもっと盛り上げるアイデアを投稿しよう！面白いアイデアにはボーナスポイント！',
    category: 'mission',
    points: 30,
    status: 'active',
    questions: [
      {
        id: 'q-1',
        type: 'text',
        question: 'あなたのアイデアを教えてください',
        required: true,
      },
      {
        id: 'q-2',
        type: 'multiple_choice',
        question: 'アイデアのカテゴリは？',
        options: ['イベント企画', '装飾・デザイン', '食品・出店', 'その他'],
        required: true,
      },
      {
        id: 'q-3',
        type: 'rating',
        question: '実現可能性はどのくらいだと思いますか？（5が高い）',
        required: true,
      },
    ],
    startDate: Timestamp.now(),
    endDate: Timestamp.fromDate(new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)),
    createdBy: 'system',
    createdAt: Timestamp.fromDate(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)),
  },
  {
    id: 'survey-mission-3',
    title: 'クラス企画の感想を投稿しよう！',
    description: '他クラスの企画を見たら感想を投稿しよう！感想を書くとポイントゲット！',
    category: 'mission',
    points: 20,
    status: 'active',
    questions: [
      {
        id: 'q-1',
        type: 'text',
        question: 'どのクラスの企画を見ましたか？',
        required: true,
      },
      {
        id: 'q-2',
        type: 'rating',
        question: '企画の満足度を5段階で教えてください',
        required: true,
      },
      {
        id: 'q-3',
        type: 'text',
        question: '感想やコメントを自由に書いてください',
        required: true,
      },
    ],
    startDate: Timestamp.now(),
    endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    createdBy: 'system',
    createdAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
  },
]

export async function seedDemoData(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if demo data already exists
    const notifSnap = await getDocs(collection(db, 'notifications'))
    const surveySnap = await getDocs(collection(db, 'surveys'))

    let notificationsAdded = 0
    let surveysAdded = 0

    // Add notifications
    for (const notif of demoNotifications) {
      const exists = notifSnap.docs.some(d => d.id === notif.id)
      if (!exists) {
        await setDoc(doc(db, 'notifications', notif.id), notif)
        notificationsAdded++
      }
    }

    // Add tasks
    for (const task of demoTasks) {
      const exists = surveySnap.docs.some(d => d.id === task.id)
      if (!exists) {
        await setDoc(doc(db, 'surveys', task.id), task)
        surveysAdded++
      }
    }

    // Add missions
    for (const mission of demoMissions) {
      const exists = surveySnap.docs.some(d => d.id === mission.id)
      if (!exists) {
        await setDoc(doc(db, 'surveys', mission.id), mission)
        surveysAdded++
      }
    }

    return {
      success: true,
      message: `デモデータを追加しました（通知: ${notificationsAdded}件、アンケート: ${surveysAdded}件）`,
    }
  } catch (error) {
    console.error('Error seeding demo data:', error)
    return {
      success: false,
      message: 'デモデータの追加に失敗しました',
    }
  }
}
