# Hatofes App Plan

## Goal

Hatofes を「文化祭前から毎日開きたくなるアプリ」に寄せつつ、文化祭当日に必要な情報と導線も迷わず使える状態にする。

## Status Legend

- `done`: 実装済み
- `in_progress`: 進行中
- `planned`: 未着手

## Priority Legend

- `now`: 直近で進める
- `next`: `now` 完了後に着手
- `later`: 後段で進める

## Workstreams

### 1. UI Unification

| Item | Status | Priority | Owner | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| Home / AppHeader 再設計 | done | now | Codex | - | 新しい画面文法の基準 |
| Point / Ranking / Notifications / Profile / Tasks / Missions 再設計 | done | now | Codex | Home / AppHeader | 主要導線の統一完了 |
| Gacha / Gacha Collection 再設計 | done | now | Codex | Home / AppHeader | 演出は維持しつつ画面骨格を更新 |
| Tetris 再設計 | planned | now | Codex | Home / AppHeader | 小画面最適化を優先 |
| Radio 再設計 | done | next | Codex | Home / AppHeader | ライブ状態とリクエスト導線の整理 |
| Booth / Event 再設計 | done | next | Codex | Home / AppHeader | 検索・絞り込み・状態表示を見直す |
| Level / Settings / その他補助ページの統一 | planned | later | Codex | 主要ページ刷新 | 画面差分を解消する最終段階 |

### 2. Existing Feature Polish

| Item | Status | Priority | Owner | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| B2 ログインストリーク | done | now | App | Home | 既存機能として運用中 |
| D2 触覚フィードバック | done | now | App | - | 主要演出に反映済み |
| B3 通知リアクション | done | now | App | Notifications | 既に通知詳細へ反映済み |
| B1 シェア用カード生成 | done | next | App | Ranking / Level | 画面文法の統一後に見た目を再調整 |
| A1 ランキング演出強化 | planned | next | Codex | Ranking UI | 表彰台・順位変動・比較カード |
| A3 テトリスデイリーチャレンジ | planned | next | Codex | Tetris UI | 日替わり目標とクラス平均表示 |
| A4 ブース口コミ・評価 | in_progress | next | App | Booth UI | Firestore 側は既に一部存在 |
| D1 ページ遷移アニメーション | planned | later | Codex | 主要ページ統一 | UI が固まってから入れる |
| C4 ライブリアクション強化 | in_progress | later | App | Radio UI | コンポーネントはあるので統合を詰める |

### 3. Major Features

| Item | Status | Priority | Owner | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| A2 ガチャ図鑑 | done | now | App | Gacha | UI 更新のみ残る |
| D4 達成バッジシステム | done | now | App | Profile | 表示済み |
| C1 スタンプラリー | done | next | App | Booth UI | 体験面のブラッシュアップ余地あり |
| C2 クラス対抗タイムアタック | done | next | App | Event / Home | 導線と見せ方を改善余地あり |

## Execution Order

1. Gacha / Tetris を新UIに統一
2. Radio / Booth / Event を新UIに統一
3. ランキング演出とテトリスデイリーチャレンジを実装
4. ブース口コミの磨き込み
5. 遷移アニメーションと細部の統一

## Validation

1. 各差分ごとに `npm run build`
2. 節目ごとに `npm run lint`
3. Firebase 依存機能は Emulator または実環境で手動確認
4. モバイル画面幅でレイアウト確認
