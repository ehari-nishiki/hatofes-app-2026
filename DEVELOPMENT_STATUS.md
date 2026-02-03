# 鳩祭アプリ 開発状況サマリー

## プロジェクト概要
- **名称**: 鳩祭アプリ (Hatofes App)
- **目的**: 学校文化祭のポイント管理・ゲーミフィケーション
- **対象ユーザー**: 1500人（ピーク4000人）
- **開発期間**: 2ヶ月
- **ドメイン**: app.hatofes.com (CloudFlare)

## 技術スタック
- **フロントエンド**: React + Vite + TypeScript
- **スタイリング**: Tailwind CSS（モバイルファースト）
- **バックエンド**: Firebase (project: hatofes-ecc25)
  - Authentication (Google認証、g.nagano-c.ed.jp限定)
  - Firestore (データベース)
  - Hosting
- **フォント**: Adobe Fonts (hiragino-kaku-gothic-pron, din-2014)

## デザインシステム
### カラーパレット
- **背景**: #1a1a1a
- **テキスト**: #ffffff
- **メインカラー**: #FFC300 → #FF4E00 (グラデーション)
- **学年別カラー**:
  - 1年: #FF0000 → #FF7300
  - 2年: #2B01FF → #00D5FF
  - 3年: #00EF44 → #00b05b

### コンポーネント
- **カード**: ドロップシャドウ `0 0 25px 0 rgba(255, 255, 255, 0.3)`
- **ボタン**: 円形（rounded-full）
- **プログレスバー**: グレー背景 + グラデーション進捗

## 完成済み機能

### 認証フロー
1. `/login` - ログイン選択画面
2. `/auth/google` - Googleログイン
3. `/register` - 新規登録フロー
   - 学年選択 (1, 2, 3, 教員)
   - クラス選択 (教員はスキップ)
   - 名簿番号選択 (教員はスキップ)
   - 食材選択 x3 (ユーザーネーム生成)
   - 登録完了

### ユーザーページ
- `/home` - ホーム画面
  - ポイント表示
  - 新着通知一覧
  - ミッション一覧
  - ポイント履歴
- `/point` - ポイント詳細
  - 個人ポイント
  - クラスポイント
  - 順位
  - 履歴
- `/notifications` - 通知一覧
- `/missions` - ミッション一覧
- `/profile` - プロフィール
  - ユーザー情報
  - 統計
  - 設定

### パブリックページ
- `/` - ランディングページ
- `/about` - アバウト
- `/login` - ログイン

## データ構造

### Firestoreコレクション
```
users/{userId}
  - email, username, grade, class, studentNumber
  - role (student/teacher/staff/admin)
  - totalPoints, createdAt, lastLoginDate

pointHistory/{historyId}
  - userId, points, reason, details, date

classes/{classId}
  - grade, className, totalPoints, memberCount

surveys/{surveyId}
  - title, description, questions, points, status

surveyResponses/{responseId}
  - surveyId, userId, answers, pointsAwarded

news/{newsId}
  - title, content, category, publishedAt

notifications/{notificationId}
  - title, message, targetUsers, createdAt
```

## 未実装機能

### 優先度: 高
1. **Firebase実装**
   - Google認証連携
   - Firestoreデータ保存/取得
   - ドメイン制限（@g.nagano-c.ed.jp）
   - 既存ユーザーチェック

2. **ポイント機能**
   - ログインボーナス（1日1回）
   - アンケート回答でポイント付与
   - クラス合計ポイント集計

3. **アンケート機能**
   - アンケート作成
   - 回答画面
   - 結果表示

### 優先度: 中
4. **ランキング機能**
   - 個人ランキング
   - クラスランキング
   - リアルタイム更新

5. **通知機能**
   - プッシュ通知
   - 既読管理

### 優先度: 低
6. **管理者画面**
   - ダッシュボード
   - ユーザー管理
   - ポイント管理
   - アンケート管理
   - ニュース管理

7. **Cloud Functions**
   - クラス合計ポイント集計
   - ランキング更新
   - 通知送信

## 環境設定

### Firebase設定ファイル
- `.firebaserc` - project: hatofes-ecc25
- `firebase.json` - (要作成)

### 環境変数
- Firebase APIキー、プロジェクトID等（要設定）

## 開発コマンド
```bash
npm run dev     # 開発サーバー起動
npm run build   # ビルド
npm run preview # プレビュー
```

## 重要な設計方針
1. **モバイルファースト**: 411px基準
2. **フロントエンドファースト開発**: モックデータ → Firebase段階的統合
3. **教員対応**: クラス・名簿番号スキップ
4. **ユーザーネーム生成**: 食材3単語の組み合わせ

## 次回の作業内容（推奨順）
1. Firebase Authentication実装
2. Firestoreデータ統合
3. ポイントシステム実装
4. アンケート機能実装
5. ランキング機能実装
6. 管理者画面開発
