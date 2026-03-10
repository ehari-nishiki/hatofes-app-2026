# Hatofes デザインシステム

このドキュメントはHatofesアプリのUI/UXデザインルールを定義します。新しいページ・コンポーネント作成時は必ずこのルールに従ってください。

## カラーシステム

### 基本原則
- **CSS変数を使用する**。Tailwindのハードコード色（`text-red-400`, `bg-green-500`等）は使用禁止。
- テーマ切替（ダーク/ライト）対応のため、必ず `var(--color-*)` 経由で色を指定する。

### テーマカラー（Tailwindクラス）

| 用途 | Tailwindクラス | 説明 |
|------|---------------|------|
| 背景（メイン） | `bg-hatofes-bg` | ページ背景 |
| 背景（セカンダリ） | `bg-hatofes-dark` | カード内の入力欄、リスト背景 |
| 背景（カード） | `.card` クラス使用 | カードコンテナ |
| テキスト（メイン） | `text-hatofes-white` | メインテキスト |
| テキスト（セカンダリ） | `text-hatofes-gray-light` | サブテキスト、日付 |
| テキスト（ミュート） | `text-hatofes-gray` | 非アクティブ、プレースホルダー |
| ボーダー | `border-hatofes-gray` | 区切り線、入力欄ボーダー |
| アクセント（黄色） | `text-hatofes-accent-yellow` / `bg-hatofes-accent-yellow` | 主要アクション、強調 |
| アクセント（オレンジ） | `text-hatofes-accent-orange` / `bg-hatofes-accent-orange` | 通知バッジ、アラート |
| グラデーション | `text-gradient` | ポイント表示、重要な数値 |

### ステータスカラー（CSS変数）

```css
/* index.css で定義済み。Tailwind直書き禁止 */
--color-status-success: /* 成功: 緑系 */
--color-status-error: /* エラー: 赤系 */
--color-status-warning: /* 警告: 黄系 */
--color-status-info: /* 情報: 青系 */
```

| 用途 | Tailwindクラス | 使用場面 |
|------|---------------|---------|
| 成功 | `text-status-success` / `bg-status-success/20` | 完了、受取済み、ライブ中 |
| エラー | `text-status-error` / `bg-status-error/20` | 失敗、削除、エラー |
| 警告 | `text-status-warning` / `bg-status-warning/20` | 注意、保留 |
| 情報 | `text-status-info` / `bg-status-info/20` | 情報、ヘルプ |

### レアリティカラー（ガチャ専用）

| レアリティ | テキスト | 背景 |
|-----------|---------|------|
| common | `text-hatofes-gray` | `bg-hatofes-gray/20 border-hatofes-gray/50` |
| uncommon | `text-status-success` | `bg-status-success/20 border-status-success/50` |
| rare | `text-status-info` | `bg-status-info/20 border-status-info/50` |
| epic | `text-purple-400` | `bg-purple-400/20 border-purple-400/50` |
| legendary | `text-hatofes-accent-yellow` | `bg-hatofes-accent-yellow/20 border-hatofes-accent-yellow/50` |

> 例外: `purple-400` はエピックレアリティ専用として許容。CSS変数 `--color-rarity-epic` として定義。

### 機能アクセントカラー（CSS変数）

| 機能 | 色 | CSS変数 | 使用場面 |
|------|---|---------|---------|
| ラジオ | 赤 | `--color-feature-radio` | ラジオバナー、ライブ表示 |
| テトリス | シアン | `--color-feature-tetris` | テトリスバナー |
| Q&A | 紫 | `--color-feature-qa` | 三役Q&Aバナー |
| スタンプラリー | エメラルド | `--color-feature-stamp` | スタンプラリー |
| タイムアタック | ピンク | `--color-feature-challenge` | クラス対抗 |

---

## ボタン

### 3種類のみ使用する

| 種類 | 使い方 | クラス/コンポーネント |
|------|-------|---------------------|
| **プライマリ** | 主要アクション（1画面に1つ） | `<AnimatedButton variant="gradient">` |
| **セカンダリ** | 副次アクション、戻るボタン | `.btn-sub` クラス |
| **テキスト** | 軽微なアクション、リンク的ボタン | `text-hatofes-accent-yellow text-sm hover:underline` |

### ボタンルール

1. **形状は全て `rounded-full`**。`rounded-lg` ボタンは禁止（入力欄は `rounded-lg`）。
2. **色のインライン指定禁止**。`bg-red-600`, `bg-green-500` 等のボタンは作らない。
3. **危険アクション**は `btn-sub` + `text-status-error` の組み合わせ。
4. **ローディング中**は `<AnimatedButton loading={true}>` を使用。
5. **サイズ**: `sm` / `md` / `lg` の3段階。デフォルトは `md`。

### 禁止パターン

```tsx
// NG: インラインでカラーを指定
<button className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2">

// OK: btn-sub + ステータスカラー
<button className="btn-sub text-status-error border-status-error/50">
```

---

## カード

### 基本ルール

1. `.card` クラスを必ず使用する。
2. **パディングの上書き禁止**。`.card` のデフォルト `padding: 1rem` を使う。
3. カード内の追加パディングが必要なら、内側に `<div>` を追加する。
4. **ホバー効果**: `hover:ring-1 hover:ring-hatofes-accent-yellow transition-all` （リンクカードのみ）。

### カードバリエーション

| バリエーション | クラス | 使用場面 |
|---------------|-------|---------|
| 通常 | `.card` | 一般的なコンテンツ |
| 強調 | `.card card-glow` | ポイント表示など目立たせたい |
| 機能バナー | `.card border-{feature-color}/30` | ガチャ、テトリス等のバナー |
| アラート | `.card bg-gradient-to-r from-{color}/10` | ログインボーナス等 |

---

## タイポグラフィ

### フォント

| 用途 | クラス | 説明 |
|------|-------|------|
| 数値・英字 | `font-display` | DIN 2014。ポイント、レベル、ランキング数値 |
| 日本語テキスト | （デフォルト） | Hiragino Kaku Gothic ProN |
| 等幅 | `font-mono` | ユーザーID、コード表示のみ |

### テキストサイズ

| 用途 | クラス |
|------|-------|
| ページタイトル | `text-xl font-bold text-hatofes-white` |
| セクションタイトル | `text-lg font-bold text-hatofes-white` |
| カード内タイトル | `text-sm font-bold text-hatofes-white` |
| 本文 | `text-sm text-hatofes-white` |
| サブテキスト | `text-xs text-hatofes-gray` |
| ポイント数値 | `text-gradient font-bold font-display` |

---

## レイアウト

### ページ構造

```tsx
<div className="min-h-screen bg-hatofes-bg pb-8">
  <AppHeader username={...} grade={...} classNumber={...} />
  <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
    {/* コンテンツ */}
  </main>
</div>
```

### スペーシング

| 用途 | 値 |
|------|---|
| ページ内セクション間 | `space-y-6` |
| カード内要素間 | `space-y-4` |
| リストアイテム間 | `space-y-2` |
| グリッド間 | `gap-3` |
| カード内パディング | `1rem`（`.card`デフォルト） |
| ページ横パディング | `px-4` |
| ページ上パディング | `py-6` |

---

## アイコン

### ルール

1. **SVGアイコンを使用**。`src/components/ui/Icon.tsx` のコンポーネントを使う。
2. **絵文字は装飾的な場面のみ許容**:
   - バッジアイコン（🔥, 👑, 🎰 等）
   - ゲームUI内の装飾
   - リアクションボタン
3. **機能を示すアイコンは必ずSVG**: ナビゲーション矢印、メニュー、ベル、設定歯車等。

---

## 戻るボタン

### 統一パターン

```tsx
{/* ページ上部の戻るボタン */}
<div className="flex items-center gap-3 mb-6">
  <Link to="/home" className="p-2 -ml-2 text-hatofes-gray hover:text-hatofes-white transition-colors">
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  </Link>
  <h1 className="text-xl font-bold text-hatofes-white">ページタイトル</h1>
</div>
```

### 下部の戻るボタン

```tsx
<Link to="/home" className="block mt-6">
  <div className="btn-sub w-full py-3 text-center">ホームに戻る</div>
</Link>
```

---

## ローディング状態

### 統一パターン

| 場面 | 使用コンポーネント |
|------|-----------------|
| ページ全体 | `<PageLoader loading={true}>` |
| セクション内 | `<div className="flex justify-center py-4"><Spinner size="md" /></div>` |
| ボタン内 | `<AnimatedButton loading={true}>` |
| リスト | `<SkeletonCard count={n} />` |
| テキストのみ | 使用禁止。必ずSpinnerを使う。 |

---

## セクションヘッダー

### 統一パターン

```tsx
<div className="flex justify-between items-center mb-4">
  <div className="flex items-center gap-2">
    <IconComponent size={20} />
    <h2 className="font-bold text-hatofes-white">セクション名</h2>
  </div>
  {badgeCount > 0 && <span className="notification-badge">{badgeCount}</span>}
</div>
```

---

## 入力フィールド

### 統一スタイル

```tsx
<input
  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-3 text-hatofes-white placeholder-hatofes-gray"
/>
```

- 形状: `rounded-lg`（ボタンと区別するため）
- 背景: `bg-hatofes-dark`
- ボーダー: `border border-hatofes-gray`
- フォーカス: `focus:border-hatofes-accent-yellow focus:outline-none`

---

## 禁止事項チェックリスト

- [ ] `bg-red-*`, `bg-green-*`, `bg-blue-*` 等のハードコード色を使っていないか
- [ ] ボタンに `rounded-lg` を使っていないか（`rounded-full` のみ）
- [ ] `.card` のパディングを外部から上書きしていないか
- [ ] 機能アイコンに絵文字を使っていないか
- [ ] ローディングに文字のみ表示していないか
- [ ] 戻るボタンのスタイルが統一されているか
- [ ] `font-display` が数値表示に適用されているか
- [ ] ページ構造が `min-h-screen > AppHeader > main.max-w-lg` になっているか
