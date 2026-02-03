# 鳩祭アプリ 引き継ぎ資料

## プロジェクト概要

学校の文化祭「鳩祭」を盛り上げるためのポイント管理システム。

- **GitHub**: https://github.com/ehari-nishiki/hatofes-app-2026
- **Firebase Project**: `hatofes-app`
- **本番URL**: https://hatofes-app.web.app
- **カスタムドメイン**: app.hatofes.com（未設定）

## 技術スタック

- **フロントエンド**: React + Vite + TypeScript + Tailwind CSS
- **バックエンド**: Firebase (Authentication, Firestore, Hosting, Cloud Functions)
- **フォント**: Adobe Fonts (din-2014, hiragino-kaku-gothic-pron)

## 現在の状態

### 完了している機能

1. **認証システム**
   - Google認証（Firebase Authentication）
   - ドメイン制限（@g.nagano-c.ed.jp）
   - 開発用: `ebi.sandwich.finland@gmail.com` も許可

2. **ユーザー登録フロー**
   - 学年・クラス・名簿番号の選択
   - 3つの単語からユーザーネーム自動生成
   - Firestoreへのユーザードキュメント作成

3. **ポイントシステム**
   - ログインボーナス（1日1回10pt）
   - Cloud Functions経由でのポイント付与
   - ポイント履歴の表示

4. **管理者パネル** (`/admin`)
   - ダッシュボード（統計表示）
   - ポイント付与機能
   - アンケート作成・管理
   - 通知送信機能

5. **アカウントスイッチ機能**
   - `ebi.sandwich.finland@gmail.com` のみ使用可能
   - ロール変更（student/teacher/staff/admin）

### 未完了・要対応

1. **Firebase デプロイ**
   - Cloud Functions: `firebase deploy --only functions`
   - Firestore ルール: `firebase deploy --only firestore:rules`
   - Hosting: `firebase deploy --only hosting`

2. **カスタムドメイン設定**
   - Firebase Console で `app.hatofes.com` を追加
   - CloudFlare で CNAME レコード設定

3. **本番環境のドメイン制限**
   - 開発完了後、以下のファイルから開発用メールアドレスを削除:
     - `src/contexts/AuthContext.tsx`
     - `src/pages/auth/GoogleAuthPage.tsx`
     - `functions/src/index.ts`
     - `firestore.rules`

4. **hatofes-ecc25 プロジェクトの整理**
   - 古いプロジェクト（hatofes-ecc25）が `hatofes.com` に接続されている
   - 必要に応じて整理

## ディレクトリ構成

```
hatofes-app/
├── src/
│   ├── components/      # 再利用可能なコンポーネント
│   │   ├── auth/        # 認証関連（ProtectedRoute, AdminRoute）
│   │   ├── dev/         # 開発ツール（AccountSwitcher）
│   │   ├── layout/      # レイアウト（Header, Footer, AppHeader）
│   │   └── ui/          # UI部品
│   ├── contexts/        # React Context（AuthContext）
│   ├── hooks/           # カスタムフック
│   ├── lib/             # ユーティリティ（firebase.ts, pointService.ts）
│   ├── pages/           # ページコンポーネント
│   │   ├── admin/       # 管理者ページ
│   │   ├── auth/        # 認証ページ
│   │   ├── public/      # 公開ページ
│   │   └── user/        # ユーザーページ
│   ├── styles/          # グローバルスタイル
│   └── types/           # TypeScript型定義
├── functions/           # Cloud Functions
│   └── src/index.ts     # Functions実装
├── firestore.rules      # Firestoreセキュリティルール
├── firebase.json        # Firebase設定
└── .env                 # 環境変数（Git管理外）
```

## Cloud Functions

| 関数名 | 説明 |
|--------|------|
| `awardLoginBonus` | ログインボーナス付与（1日1回） |
| `grantPoints` | 管理者によるポイント付与 |
| `submitSurveyResponse` | アンケート回答＋ポイント付与 |
| `updateUserRole` | ユーザーロール変更（admin限定） |

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
firebase deploy
```

## 注意事項

1. **デプロイ時の確認**
   - 必ず正しいプロジェクト（`hatofes-app`）を使用していることを確認
   - `firebase use` でプロジェクトを確認

2. **環境変数**
   - `.env` ファイルは Git 管理外
   - `.env.example` を参考に設定

3. **セキュリティ**
   - 本番デプロイ前に開発用メールアドレスを削除
   - Firestore ルールのテストを実施

## 連絡先

開発に関する質問は、プロジェクトの担当者まで。
