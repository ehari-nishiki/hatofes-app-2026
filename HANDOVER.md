# 鳩祭アプリ 引き継ぎ資料

**最終更新**: 2026-02-03
**Firebase Project**: hatofes-ecc25
**本番URL**: https://hatofes-app.web.app
**カスタムドメイン**: app.hatofes.com (CloudFlare管理)
**GitHub**: https://github.com/ehari-nishiki/hatofes-app-2026

---

## 技術スタック

- **フロントエンド**: React + Vite + TypeScript + Tailwind CSS
- **バックエンド**: Firebase (Authentication, Firestore, Hosting, Cloud Functions)
- **フォント**: Adobe Fonts (din-2014, hiragino-kaku-gothic-pron)
- **ソースファイル数**: 44件 / 約6,500行

---

## ディレクトリ構成

```
hatofes-app/
├── functions/
│   └── src/
│       └── index.ts          # Cloud Functions (4つの関数)
├── src/
│   ├── App.tsx               # ルート定義
│   ├── main.tsx              # エントリポイント
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AdminRoute.tsx        # admin/staff限定ルート
│   │   │   └── ProtectedRoute.tsx    # 認証済みのみ
│   │   ├── dev/
│   │   │   └── AccountSwitcher.tsx   # 開発用ロール切り替え（許可メールのみ）
│   │   ├── layout/
│   │   │   ├── AppHeader.tsx         # アプリ内ヘッダー
│   │   │   ├── Footer.tsx
│   │   │   └── Header.tsx            # ランディングページ用
│   │   └── ui/
│   │       ├── PointRewardModal.tsx  # ポイント獲得モーダル
│   │       ├── ProgressBar.tsx       # 登録フロー用プログレスバー
│   │       └── SelectionGrid.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx           # 認証コンテキスト・リアルタイムユーザーデータ
│   ├── hooks/
│   │   ├── useClassPoints.ts
│   │   ├── usePointHistory.ts       # ポイント履歴の取得
│   │   └── useRegistration.ts       # 登録ステップフローの管理
│   ├── lib/
│   │   ├── firebase.ts              # Firebase初期化
│   │   ├── pointService.ts          # ポイント関連（Cloud Functions呼び出し）
│   │   ├── surveyService.ts         # アンケート関連サービス
│   │   ├── seedDemoData.ts          # デモデータ投入ロジック
│   │   └── classUtils.ts
│   ├── mocks/
│   │   ├── mockData.ts
│   │   └── wordLists.ts             # ユーザーネーム生成用単語リスト
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx       # 管理ダッシュボード
│   │   │   ├── AdminPointsPage.tsx      # ポイント付与
│   │   │   ├── AdminSurveysPage.tsx     # アンケート管理
│   │   │   ├── AdminNotificationsPage.tsx # 通知送信
│   │   │   └── AdminUsersPage.tsx       # ユーザー管理
│   │   ├── auth/
│   │   │   ├── GoogleAuthPage.tsx       # Google認証ハンドラー
│   │   │   └── RegisterPage.tsx         # ステップ式登録
│   │   ├── public/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── AboutPage.tsx
│   │   │   └── LoginPage.tsx
│   │   └── user/
│   │       ├── HomePage.tsx             # ホーム（通知・タスク・ミッション・ポイント）
│   │       ├── NotificationsPage.tsx    # 通知一覧＋詳細ページ
│   │       ├── TasksPage.tsx            # タスク一覧
│   │       ├── MissionsPage.tsx         # ミッション一覧
│   │       ├── SurveyDetailPage.tsx     # アンケート回答
│   │       ├── RankingPage.tsx          # ランキング（個人・クラス）
│   │       ├── PointPage.tsx            # ポイント履歴
│   │       └── ProfilePage.tsx          # プロフィール
│   ├── scripts/                     # 管理用スクリプト
│   ├── styles/
│   │   └── index.css                # グローバルスタイル・カスタムクラス
│   └── types/
│       ├── auth.ts                  # 登録フロー型定義
│       └── firestore.ts             # Firestoreドキュメント型定義
├── firestore.rules                  # セキュリティルール
├── firebase.json                    # Firebase設定
├── CLAUDE.md                        # 開発ガイド
└── HANDOVER.md                      # この引き継ぎ資料
```

---

## ルーティング一覧

### 公開ページ（認証不要）

| パス | ページ |
|------|--------|
| `/` | ランディングページ |
| `/about` | アバウト |
| `/login` | ログイン画面 |
| `/auth/google` | Google認証ハンドラー |
| `/register` | 新規登録（ステップフロー） |

### ユーザーページ（`ProtectedRoute`で保護）

| パス | ページ |
|------|--------|
| `/home` | ホーム |
| `/notifications` | 通知一覧 |
| `/notifications/:notificationId` | 通知詳細 |
| `/tasks` | タスク一覧 |
| `/tasks/:surveyId` | アンケート回答 |
| `/missions` | ミッション一覧 |
| `/missions/:surveyId` | アンケート回答 |
| `/surveys` | `/tasks` と同一 |
| `/ranking` | ランキング（個人・クラス） |
| `/point` | ポイント履歴 |
| `/profile` | プロフィール |

### 管理者ページ（`AdminRoute`で保護：admin / staff のみ）

| パス | ページ |
|------|--------|
| `/admin` | ダッシュボード |
| `/admin/points` | ポイント付与 |
| `/admin/surveys` | アンケート管理（タスク/ミッション分類） |
| `/admin/notifications` | 通知送信 |
| `/admin/users` | ユーザー管理 |

---

## 認証フロー

```
未認証
  → /login → Google認証ボタン
    → /auth/google（GoogleAuthProvider で認証実行）
      → 認証完了後、Firestore users/{uid} の有無を確認
        ├── ドキュメント存在 → /home へ
        └── ドキュメント未存在 → /register へ（ステップフロー）
              → 学年・クラス・名簿番号・ユーザーネーム選択
              → Firestore に users/{uid} を作成
              → /home へ
```

- **リアルタイム同期**: `AuthContext` は `onSnapshot` でユーザーデータを常に監視。ポイント変動は自動で画面反映。
- **開発ツール**: `AccountSwitcher` は許可メールのみに表示され、ロールを即座に切り替えられる。

---

## Firestoreデータモデル

### users/{userId}
```
email: string
grade?: number          # 1-3（教員・スタッフは省略可）
class?: string          # A-H
studentNumber?: number
username: string        # 自動生成（形容詞+色+動物）
role: 'student' | 'teacher' | 'staff' | 'admin'
totalPoints: number
createdAt: Timestamp
lastLoginDate: string   # YYYY-MM-DD (JST)
```

### pointHistory/{historyId}
```
userId: string
points: number
reason: 'login_bonus' | 'survey' | 'admin_grant' | 'game_result'
details: string
grantedBy?: string
createdAt: Timestamp
```

### surveys/{surveyId}
```
title: string
description: string
questions: Question[]   # { id, type, question, required, options? }
points: number
category: 'task' | 'mission'   # タスク=全員対象、ミッション=任意参加
status: 'active' | 'closed'
startDate: Timestamp
endDate: Timestamp
createdBy: string
createdAt: Timestamp
```

### surveyResponses/{responseId}
```
surveyId: string
userId: string
answers: { questionId: string, value: string | number }[]
submittedAt: Timestamp
pointsAwarded: number
```

### notifications/{notificationId}
```
title: string
message: string
targetUsers: string[]   # 空配列 = 全員
targetRoles: string[]   # 対象ロール
createdBy: string
createdAt: Timestamp
readBy: string[]        # 既読ユーザーUID配列
```

### classes/{classId}  (例: "1-A")
```
grade: number
className: string
totalPoints: number
memberCount: number
```

### news/{newsId}  (未使用中)
```
title: string
content: string
category: 'general' | 'event' | 'announcement'
publishedAt: Timestamp
createdBy: string
isPinned: boolean
```

---

## Cloud Functions (`functions/src/index.ts`)

全関数はトランザクションを使い、ポイント付与・履歴作成・クラスポイント更新を**一括で原子的に実行**する。

| 関数名 | 用途 | 現在の利用状況 |
|--------|------|--------------|
| `awardLoginBonus` | ログインボーナス付与（1日1回・10pt） | `pointService.ts` から呼び出し中 |
| `grantPoints` | 管理者ポイント付与 | **現在は未使用**（AdminPointsPageが直接書き込み中→要修正） |
| `submitSurveyResponse` | アンケート回答・ポイント付与 | **現在は未使用**（surveyServiceが直接書き込み中→要修正） |
| `updateUserRole` | ロール変更（admin限定） | **現在は未使用**（AdminUsersPageが直接書き込み中） |

---

## Firestoreセキュリティルール の概要

| コレクション | Read | Write |
|-------------|------|-------|
| `users` | 認証済み全員 | 自己のみ + admin/staff |
| `pointHistory` | 自己のみ + admin/staff | **クライアントから書き込み不可（Cloud Functions のみ）** |
| `surveys` | 認証済み全員 | admin/staff のみ |
| `surveyResponses` | 自己のみ + admin/staff | **クライアントから書き込み不可（Cloud Functions のみ）** |
| `notifications` | 認証済み全員 | admin/staff のみ（readBy更新は認証済み全員） |
| `classes` | 認証済み全員 | admin/staff のみ（create は全員） |
| `news` | 認証済み全員 | admin/staff のみ |

---

## 実装済み機能

### ユーザー側
- [x] Google認証ログイン
- [x] ステップ式新規登録（学年・クラス・名簿番号・ユーザーネーム生成）
- [x] ホーム画面（ポイント表示・通知・タスク・ミッション・ランキングリンク）
- [x] ログインボーナス（ホーム画面で毎日タップで受け取り・10pt）
- [x] 通知一覧・通知詳細・既読機能・未読件数バッジ
- [x] タスク一覧（全員対象・未完了/完了分類・未読件数バッジ）
- [x] ミッション一覧（任意参加・未完了/完了分類・未読件数バッジ）
- [x] アンケート回答ページ（選択式・テキスト・5段階評価・必須バリデーション）
- [x] ポイント獲得モーダル（回答完了時・ログインボーナス時）
- [x] ポイント履歴
- [x] ランキング（個人ランキング TOP50・クラスランキング・自己順位ハイライト）
- [x] プロフィール・ログアウト

### 管理者側
- [x] ダッシュボード（統計・クイックアクション・デモデータ投入ボタン）
- [x] ポイント付与（ユーザー検索・付与実行）
- [x] アンケート管理（タスク/ミッション分類・質問の追加/削除・選択肢の追加/削除・公開/終了・カテゴリバッジ表示）
- [x] 通知送信（対象ロール指定・送信済み一覧）
- [x] ユーザー管理（一覧・検索・ロールフィルタ・ロール変更・統計表示）

---

## デモデータの投入方法

1. admin ロールのアカウントでログイン
2. `/admin`（管理者パネル）へ移動
3. 「デモデータを追加」ボタンをタップ
4. 通知5件・タスク2件・ミッション3件が追加される（既存データがある場合は重複しない）

デモデータの定義は `src/lib/seedDemoData.ts` にある。

---

## ✅ 対応完了事項

以下は対応済み。

### 1. Cloud Functions への切り替え（完了）

- `surveyService.ts` の `submitSurveyResponse()` → Cloud Functions 呼び出しに変更済み
- `AdminPointsPage.tsx` の `handleGrantPoints()` → Cloud Functions 呼び出しに変更済み

### 2. ドメイン制限の本番切り替え（完了）

以下4箇所で本番用設定に変更済み：
- `src/contexts/AuthContext.tsx` - `@g.nagano-c.ed.jp` のみ
- `src/lib/firebase.ts` - `hd: 'g.nagano-c.ed.jp'` 設定済み
- `firestore.rules` - 開発用メール削除済み
- `functions/src/index.ts` - 開発用メール削除済み

### 3. AppHeaderのログアウト修正（完了）

`AuthContext` の `signOut()` を使って正しくFirebaseからログアウトするように修正済み。

### 4. Firestoreルールの通知 readBy 更新許可（完了）

生徒側が自分のUIDを `readBy` に追加できるルールを追加済み。

### 5. その他の修正（完了）

- ホーム画面リロード時の `/register` 遷移問題を修正（`userDataChecked` フラグ追加）
- 通知一覧のリアルタイム更新対応（既読状態が戻っても反映される）
- デモデータ追加ボタンを管理者ダッシュボードから削除
- ホーム画面下部のメニューボックスを削除
- アンケート作成モーダルの背景を濃くして視認性向上
- Firestore複合インデックスを追加（surveys: status + category + createdAt）
- プロフィールページにユーザーID表示を追加

---

## ⚠️ デプロイ前の確認事項

### 1. Cloud Functionsのデプロイ

```bash
cd functions && npm run build
firebase deploy --only functions
```

### 2. Firestoreインデックスのデプロイ

```bash
firebase deploy --only firestore:indexes
```

### 3. Firestoreルールのデプロイ

```bash
firebase deploy --only firestore:rules
```

---

## 未実装・今後の課題

| 優先度 | 機能 | 概要 |
|--------|------|------|
| 中 | ニュース機能 | `news` コレクションは定義済みだが、表示ページが未実装 |
| 中 | 通知のプッシュ通知 | Firebase Cloud Messaging (FCM) の導入 |
| 低 | 文化祭当日のゲーム機能 | `game_result` によるポイント付与 |
| 低 | アンケート回答者一覧 | 管理者側で回答者を閲覧 |

---

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Cloud Functions ビルド
cd functions && npm run build

# Firebase エミュレータ起動
firebase emulators:start

# デプロイ
firebase deploy                          # 全件
firebase deploy --only hosting           # Hostingのみ
firebase deploy --only functions         # Cloud Functionsのみ
firebase deploy --only firestore:rules   # Firestoreルールのみ
```

---

## 環境変数

`.env` ファイルは Git 管理外。`.env.example` を参考に設定。Firebase の設定値は Firebase Console > プロジェクト設定 で確認可能。
