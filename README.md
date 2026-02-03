# 鳩祭アプリ (Hatofes App)

学校文化祭「鳩祭」のポイント管理システム

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Firebase プロジェクトの設定

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成
2. Authentication で Google プロバイダーを有効化
3. Firestore Database を作成
4. プロジェクト設定から Web アプリの構成情報を取得

### 3. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成し、Firebase の設定を記入:

```bash
cp .env.example .env.local
```

`.env.local` を編集:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hatofes-ecc25
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 4. Firebase CLI のインストールとログイン

```bash
npm install -g firebase-tools
firebase login
firebase use hatofes-ecc25
```

### 5. Firestore セキュリティルールとインデックスのデプロイ

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 6. テストデータの投入（オプション）

```bash
npm run seed
```

これにより以下が作成されます：
- クラスドキュメント (1-A ~ 3-H)
- テストユーザー 3名 (student, teacher, admin)
- サンプルポイント履歴
- テストアンケート 2件

**注意**: テストユーザーは Firestore に作成されますが、Firebase Authentication には手動で作成する必要があります。

### 7. 開発サーバーの起動

```bash
npm run dev
```

## 📁 プロジェクト構造

```
src/
├── components/       # 再利用可能なコンポーネント
│   ├── auth/         # 認証関連コンポーネント
│   ├── dev/          # 開発ツール（本番ビルドには含まれない）
│   ├── layout/       # レイアウトコンポーネント
│   └── ui/           # UI コンポーネント
├── contexts/         # React Context (AuthContext)
├── hooks/            # カスタムフック
├── lib/              # ユーティリティ関数
│   ├── firebase.ts   # Firebase 初期化
│   ├── pointService.ts  # ポイント管理ロジック
│   └── classUtils.ts    # クラス関連ユーティリティ
├── pages/            # ページコンポーネント
│   ├── auth/         # 認証ページ
│   ├── public/       # 公開ページ
│   └── user/         # ユーザーページ
├── scripts/          # スクリプト
│   ├── seedFirestore.ts      # テストデータ投入
│   └── createAdminAccount.ts # 管理者作成
└── types/            # TypeScript 型定義
```

## 🔑 認証

- **ドメイン制限**: `@g.nagano-c.ed.jp` のみ許可
- **ロール**:
  - `student`: 生徒
  - `teacher`: 教員
  - `staff`: 職員
  - `admin`: 管理者

## 💰 ポイントシステム

### ポイント獲得方法

1. **ログインボーナス** (10pt/日)
2. **アンケート回答** (各アンケートで設定されたポイント)
3. **管理者による手動付与**
4. **文化祭当日のゲーム結果** (予定)

### ポイント履歴

- すべてのポイント獲得は `pointHistory` コレクションに記録
- リアルタイム更新に対応
- ページネーション機能 (20件ずつ)

## 🎯 実装済み機能

### Phase 1: Firebase 基盤構築 ✅
- Firebase 初期化
- Google 認証
- Firestore セキュリティルール
- ルート保護 (ProtectedRoute, AdminRoute)

### Phase 2: ユーザー登録とデータ保存 ✅
- ユーザー登録フロー
- Firestore へのデータ保存
- ユーザーネーム自動生成（食材3単語）

### Phase 3: コアポイントシステム ✅
- ログインボーナス（1日1回）
- ポイント履歴の取得と表示
- リアルタイム更新
- クラスポイント集計

## 🚧 未実装機能

### Phase 4: アンケートシステム
- アンケート一覧・回答ページ
- アンケート送信処理
- ポイント付与

### Phase 5: 管理者機能
- 管理者ダッシュボード
- アンケート作成・管理
- ユーザー管理
- ポイント手動付与

## 🛠️ スクリプト

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview

# テストデータ投入
npm run seed

# 管理者作成（要実装）
npm run create-admin <email>
```

## 🔐 セキュリティ

### Firestore セキュリティルール

- ドメイン制限: `@g.nagano-c.ed.jp` のみアクセス可能
- ユーザーは自分のデータのみ読み書き可能
- ポイント履歴は作成後変更不可
- アンケートは admin/staff のみ書き込み可能

### 推奨事項

- `.env.local` は絶対に Git にコミットしない
- Firebase Console でセキュリティアラートを監視
- 本番環境では別途 Firebase プロジェクトを使用

## 📊 データベース構造

### users
```typescript
{
  email: string
  username: string
  grade?: number        // 1-3 (students only)
  class?: string        // A-H (students only)
  studentNumber?: number
  role: 'student' | 'teacher' | 'staff' | 'admin'
  totalPoints: number
  createdAt: Timestamp
  lastLoginDate: string // YYYY-MM-DD
}
```

### pointHistory
```typescript
{
  userId: string
  points: number
  reason: 'login_bonus' | 'survey' | 'admin_grant' | 'game_result'
  details: string
  grantedBy?: string
  createdAt: Timestamp
}
```

### classes
```typescript
{
  grade: number
  className: string
  totalPoints: number
  memberCount: number
}
```

### surveys
```typescript
{
  title: string
  description: string
  questions: Question[]
  points: number
  startDate: Timestamp
  endDate: Timestamp
  status: 'active' | 'closed'
  createdBy: string
}
```

## 🐛 トラブルシューティング

### Firebase の初期化エラー

`.env.local` に正しい Firebase 設定が記入されているか確認してください。

### 認証エラー

1. Firebase Console で Google 認証が有効になっているか確認
2. 承認済みドメインに `localhost` が含まれているか確認

### Firestore エラー

1. セキュリティルールがデプロイされているか確認: `firebase deploy --only firestore:rules`
2. インデックスが作成されているか確認: `firebase deploy --only firestore:indexes`

## 📝 開発メモ

### 開発モードの機能

- **アカウントスイッチャー**: 右下のボタンからテストアカウントを切り替え可能（現在はモック）
- 本番ビルドには含まれません

### タイムゾーン

- すべての日付処理は JST (Asia/Tokyo) を使用
- ログインボーナスの日付判定は `YYYY-MM-DD` 形式の文字列で比較

## 📄 ライセンス

This project is private and proprietary.
