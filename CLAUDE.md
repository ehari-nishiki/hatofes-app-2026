# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hatofes is a Firebase-based application. The project is in early development stages.

## Technology Stack

- **Backend/Services**: Firebase (project: hatofes-ecc25)
- **Build Tool**: Vite (inferred from gitignore patterns)

## Firebase Configuration

The project is connected to Firebase project `hatofes-ecc25`. Firebase CLI commands can be used for deployment and management.

---

# 鳩祭アプリ開発ガイド

## プロジェクト概要

学校の文化祭「鳩祭」を盛り上げるためのポイント管理システム

- 想定ユーザー: 常時1500人、ピーク時4000人
- 開発期間: 2ヶ月
- 運用期間: 文化祭準備期間から開催まで約2ヶ月
- ドメイン: app.hatofes.com (CloudFlare管理)

## 技術スタック

- **フロントエンド**: React + Vite + TypeScript
- **スタイリング**: Tailwind CSS (モバイルファースト)
- **バックエンド**: Firebase
  - Authentication (Google認証)
  - Firestore (データベース)
  - Hosting (デプロイ先)
- **認証制限**: g.nagano-c.ed.jp ドメインのみ許可

## 開発方針

1. フロントエンドファースト開発
2. モバイルファースト(レスポンシブ対応)
3. モックデータ → Firebase段階的統合
4. Cloud Functionsは後半フェーズで実装

## コア機能

### ユーザー機能

- Google認証(g.nagano-c.ed.jpドメイン限定)
- 新規登録: 学年・クラス・名簿番号入力 → 自動ユーザーネーム生成
- ユーザーロール: student / teacher / staff / admin

### ポイントシステム

- 個人ポイント(鳩ポイント)
- クラス合計ポイント
- ポイント獲得方法:
  - ログインボーナス(1日1回)
  - アンケート回答
  - 管理者による手動付与
  - 文化祭当日のゲーム結果

### その他機能

- アンケートシステム
- ランキング(個人・クラス)
- ニュース配信
- 通知機能

## データベース設計(Firestore)

### users コレクション

```
users/{userId}
  - email: string
  - grade: number (学年: 1-3)
  - class: string (クラス: A-H)
  - studentNumber: number (名簿番号)
  - username: string (自動生成)
  - role: string (student/teacher/staff/admin)
  - totalPoints: number
  - createdAt: timestamp
  - lastLoginDate: string (YYYY-MM-DD)
```

### pointHistory コレクション

```
pointHistory/{historyId}
  - userId: string
  - points: number
  - reason: string (login_bonus/survey/admin_grant/game_result)
  - details: string
  - grantedBy: string (管理者IDなど)
  - createdAt: timestamp
```

### classes コレクション

```
classes/{classId} (例: "1-A", "2-B")
  - grade: number
  - className: string
  - totalPoints: number (集計用)
  - memberCount: number
```

### surveys コレクション

```
surveys/{surveyId}
  - title: string
  - description: string
  - questions: array
  - points: number (完答時の付与ポイント)
  - startDate: timestamp
  - endDate: timestamp
  - status: string (active/closed)
  - createdBy: string
```

### surveyResponses コレクション

```
surveyResponses/{responseId}
  - surveyId: string
  - userId: string
  - answers: array
  - submittedAt: timestamp
  - pointsAwarded: number
```

### news コレクション

```
news/{newsId}
  - title: string
  - content: string
  - category: string
  - publishedAt: timestamp
  - createdBy: string
  - isPinned: boolean
```

### notifications コレクション

```
notifications/{notificationId}
  - title: string
  - message: string
  - targetUsers: array (全員ならempty)
  - targetRoles: array
  - createdAt: timestamp
  - readBy: array (既読ユーザーID)
```

## ルーティング構成

### 公開ページ(認証不要)

- `/` - ランディングページ
- `/about` - アバウト
- `/login` - ログイン画面
- `/QandA` - Q&A

### 認証必須ページ

- `/home` - ユーザーホーム(ポイント表示)
- `/profile` - プロフィール
- `/surveys` - アンケート一覧
- `/surveys/:id` - アンケート回答
- `/ranking` - ランキング
- `/news` - ニュース一覧

### 管理者専用ページ

- `/admin` - ダッシュボード
- `/admin/users` - ユーザー管理
- `/admin/points` - ポイント管理
- `/admin/surveys` - アンケート管理
- `/admin/news` - ニュース管理

## コーディング規約

- TypeScript使用
- 関数コンポーネント
- React Hooks活用
- Tailwind CSS でスタイリング
- ESLint + Prettier

## 命名規則

- コンポーネント: PascalCase (例: LoginPage.tsx)
- 関数: camelCase (例: handleLogin)
- 定数: UPPER_SNAKE_CASE (例: MAX_POINTS)

## ディレクトリ構成

```
src/
├── components/     # 再利用可能なコンポーネント
│   ├── ui/         # 基本UIコンポーネント
│   └── layout/     # レイアウトコンポーネント
├── pages/          # ページコンポーネント
│   ├── public/     # 公開ページ
│   ├── user/       # ユーザーページ
│   └── admin/      # 管理者ページ
├── hooks/          # カスタムフック
├── lib/            # ユーティリティ関数
│   └── firebase.ts # Firebase設定
├── mocks/          # モックデータ
├── types/          # TypeScript型定義
└── styles/         # グローバルスタイル
```

## 特記事項

- ユーザーネーム生成: リストA(形容詞) + リストB(色) + リストC(動物) の組み合わせ
- セキュリティ: Firestoreセキュリティルールで厳密に制御
- パフォーマンス: キャッシュ活用、リアルタイムリスナーは最小限
