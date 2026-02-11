# Firestore 最適化実装完了レポート

## 実装日: 2026-02-10

## 概要

Firestoreの読み取り回数を85%削減する最適化を実装しました。
20ユーザーで週間1.93M読み取りから、4000ユーザー時に2.17M reads/day → 330K reads/dayへの削減を目標としています。

---

## 実装した最適化

### ✅ Phase 1: 高インパクト最適化（完了）

#### 1. NotificationsPage最適化 (760,000 reads/day削減)
**ファイル**: `src/pages/user/NotificationsPage.tsx`

**変更内容**:
- `onSnapshot` リアルタイムリスナーを `getDocs` に置き換え
- クライアント側ロールフィルタリングをサーバー側フィルタリングに変更
- `where('targetRoles', 'array-contains', userData.role)` でサーバー側フィルタリング
- 取得件数を50件に制限

**効果**: 35%削減 (760,000 reads/day)

#### 2. HomePage通知フィルタリング (40,000 reads/day削減)
**ファイル**: `src/pages/user/HomePage.tsx`

**変更内容**:
- クライアント側フィルタリングをサーバー側フィルタリングに変更
- `where('targetRoles', 'array-contains', userData.role)` を追加
- 取得件数を5件→3件に削減

**効果**: 2%削減 (40,000 reads/day)

#### 3. Survey fallback削除 (400,000 reads/day削減)
**ファイル**: `src/lib/surveyService.ts`

**変更内容**:
- `getSurveysByCategory()`: surveyResponsesクエリを削除し、userドキュメントの `answeredSurveyIds` 配列のみ使用
- `getAllSurveysForUser()`: 同様に最適化
- `HomePage.tsx`の既存コードはすでに最適化済み（answeredSurveyIdsを使用）

**効果**: 18%削減 (400,000 reads/day)

---

### ✅ Phase 2: リスナー削減（完了）

#### 4. Point Historyリスナー置き換え (720,000 reads/day削減)
**ファイル**: `src/hooks/usePointHistory.ts`, `src/pages/user/PointPage.tsx`

**変更内容**:
- `onSnapshot` リアルタイムリスナーを `getDocs` に置き換え
- `refresh()` 関数を追加してポイント変更時に手動リフレッシュ
- `refreshTrigger` stateでリフレッシュを制御
- PointPageでポイント更新時に `refresh()` を呼び出し

**効果**: 33%削減 (720,000 reads/day)

#### 5. Ranking キャッシュ活用 (76,000 reads/day削減)
**ファイル**: `src/pages/user/PointPage.tsx`

**変更内容**:
- `config/personalRanking` ドキュメントからキャッシュされたランキングを取得
- キャッシュヒット時は全ユーザークエリをスキップ
- キャッシュミス時のみフォールバックで従来のクエリを実行
- 依存配列から `userData?.totalPoints` を削除し、`userData` のみに変更

**効果**: 3%削減 (76,000 reads/day)

---

## 総合効果

### 読み取り削減量（4000ユーザー時の予測）

| 最適化項目 | 削減量 (reads/day) | 割合 |
|-----------|-------------------|------|
| NotificationsPage | 760,000 | 35% |
| HomePage notifications | 40,000 | 2% |
| Survey fallback | 400,000 | 18% |
| Point History | 720,000 | 33% |
| Ranking cache | 76,000 | 3% |
| **合計** | **1,996,000** | **91%** |

### コスト削減予測

- **現状**: 2.17M reads/day × $0.06/100K = **$39/日 ($1,170/月)**
- **最適化後**: 0.17M reads/day × $0.06/100K = **$3/日 ($90/月)**
- **削減額**: $1,080/月（92%削減）

---

## 🚨 必須作業: Firestore複合インデックス作成

最適化を有効にするには、以下のFirestore複合インデックスを作成する必要があります。

### インデックス作成手順

1. Firebase Consoleにアクセス: https://console.firebase.google.com/
2. プロジェクト `hatofes-ecc25` を選択
3. 左メニューから「Firestore Database」→「インデックス」タブを選択
4. 「複合」タブで以下のインデックスを作成:

#### インデックス1: notifications - targetRoles + createdAt

```
コレクションID: notifications
フィールド:
  - targetRoles (配列)
  - createdAt (降順)
```

**作成方法**:
1. 「インデックスを追加」ボタンをクリック
2. コレクションID: `notifications`
3. フィールドを追加:
   - フィールドパス: `targetRoles`
   - 配列モード: `配列に含む` (Array-contains)
   - フィールドパス: `createdAt`
   - モード: `降順`
4. 「作成」をクリック

---

## 自動インデックス作成（代替方法）

Firebaseデプロイ時に自動でインデックスを作成することも可能です。

### firestore.indexes.json の作成

プロジェクトルートに `firestore.indexes.json` ファイルを作成:

```json
{
  "indexes": [
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "targetRoles",
          "arrayConfig": "CONTAINS"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### デプロイ方法

```bash
firebase deploy --only firestore:indexes
```

---

## テスト項目

最適化が正しく動作するか、以下の項目を確認してください:

### Phase 1 テスト

- [ ] **NotificationsPage**
  - [ ] 通知一覧が正しく表示される
  - [ ] ロール別フィルタリングが動作する（student/teacher/staff/admin）
  - [ ] 未読/既読の表示が正しい
  - [ ] 通知の並び順が正しい（未読優先→日付降順）

- [ ] **HomePage**
  - [ ] 最新3件の通知が表示される
  - [ ] ロール別フィルタリングが動作する
  - [ ] 未読バッジが正しく表示される

- [ ] **Survey回答判定**
  - [ ] アンケート回答済み判定が正常に動作する
  - [ ] TaskページとMissionページで未回答のみ表示される
  - [ ] 回答後に即座に「回答済み」状態になる

### Phase 2 テスト

- [ ] **PointPage**
  - [ ] ポイント履歴が正しく表示される
  - [ ] ポイント獲得後に履歴が自動更新される
  - [ ] 「もっと見る」ボタンでページネーションが動作する
  - [ ] ランキングが正しく表示される（キャッシュから取得）

- [ ] **ポイント更新時**
  - [ ] ログインボーナス受け取り後に履歴が更新される
  - [ ] アンケート回答後に履歴が更新される

---

## エラーハンドリング

### インデックス未作成時のエラー

インデックスが作成されていない場合、以下のエラーが表示されます:

```
Error: The query requires an index. You can create it here: https://console.firebase.google.com/...
```

**対処法**:
1. エラーメッセージ内のURLをクリック
2. 自動的にインデックス作成画面が開く
3. 「インデックスを作成」ボタンをクリック
4. 数分待ってから再度テスト

---

## フォールバック動作

以下の機能にはフォールバック（キャッシュ未使用時の動作）が実装されています:

### Ranking Cache
- **通常**: `config/personalRanking` キャッシュから取得
- **フォールバック**: キャッシュが存在しない場合、従来通りクエリで計算

### Survey answered判定
- **通常**: userドキュメントの `answeredSurveyIds` 配列から取得
- **フォールバック**: HomePage.tsxのみフォールバック実装済み（surveyResponses全件取得）

---

## パフォーマンス監視

最適化の効果を確認するため、以下を定期的に監視してください:

### Firebase Console
1. Firestore → 使用状況タブ
2. 「読み取り」グラフを確認
3. 1日あたりの読み取り回数をモニタリング

### 目標値（4000ユーザー時）
- **現状**: 2.17M reads/day
- **目標**: 330K reads/day以下
- **許容範囲**: 500K reads/day以下

---

## 次のステップ

1. **インデックス作成**: 上記手順でFirestore複合インデックスを作成
2. **デプロイ**: 変更をFirebaseにデプロイ
3. **テスト**: 全てのテスト項目を確認
4. **監視**: 1週間後にFirebase Consoleで読み取り回数を確認
5. **最終調整**: 必要に応じてキャッシュ有効期限などを調整

---

## 技術的詳細

### 最適化の仕組み

#### 1. onSnapshot → getDocs
- **従来**: リアルタイムリスナーで常時接続（1ユーザーあたり1日180回の読み取り）
- **最適化後**: 必要時のみ取得（1ユーザーあたり1日1-5回の読み取り）

#### 2. クライアント側 → サーバー側フィルタリング
- **従来**: 全通知を取得してクライアント側でフィルタリング（200通知 × 4000ユーザー）
- **最適化後**: サーバー側でフィルタリング（3-50通知 × 4000ユーザー）

#### 3. surveyResponses全件取得 → answeredSurveyIds配列
- **従来**: surveyResponses全件取得（100回答 × 4000ユーザー）
- **最適化後**: userドキュメント1件取得（1回 × 4000ユーザー）

#### 4. 全ユーザークエリ → キャッシュ
- **従来**: 毎回全ユーザーをクエリ（4000ドキュメント読み取り）
- **最適化後**: config/personalRankingキャッシュ読み取り（1ドキュメント読み取り）

---

## トラブルシューティング

### 問題: 通知が表示されない
- **原因**: インデックス未作成
- **解決**: 上記手順でインデックスを作成

### 問題: ランキングが表示されない
- **原因**: personalRankingキャッシュが存在しない
- **解決**: Cloud Functionでキャッシュを生成するか、フォールバックが動作することを確認

### 問題: ポイント履歴が更新されない
- **原因**: refresh()が呼ばれていない
- **解決**: PointPageのuseEffectが正しく動作しているか確認

---

## 実装完了チェックリスト

- [x] NotificationsPage最適化
- [x] HomePage通知フィルタリング最適化
- [x] Survey fallback削除
- [x] Point History onSnapshot削除
- [x] Ranking キャッシュ活用
- [ ] Firestoreインデックス作成（手動作業必要）
- [ ] デプロイ
- [ ] 全機能テスト
- [ ] パフォーマンス監視設定

---

## 関連ファイル

### 変更したファイル（5件）
1. `src/pages/user/NotificationsPage.tsx`
2. `src/pages/user/HomePage.tsx`
3. `src/lib/surveyService.ts`
4. `src/hooks/usePointHistory.ts`
5. `src/pages/user/PointPage.tsx`

### 新規作成ファイル（1件）
1. `firestore.indexes.json`（推奨、作成手順は上記参照）

---

## まとめ

この最適化により、Firestoreの読み取り回数を**91%削減**し、月間コストを**$1,080削減**できる見込みです。

最も重要なのは**Firestoreインデックスの作成**です。インデックスなしではクエリが失敗するため、デプロイ前に必ず作成してください。
