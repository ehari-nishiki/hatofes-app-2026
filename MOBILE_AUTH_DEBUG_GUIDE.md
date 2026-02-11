# モバイル認証デバッグガイド

## 🔍 問題の切り分け手順

### ステップ1: 永続化されたログを確認する

今回の修正で、ログが localStorage に保存されるようになりました。

1. スマホでログインページを開く
2. 「Login」ボタンをタップ
3. Google ログイン画面が表示されるか確認
   - **表示される** → ステップ2へ
   - **表示されない** → 問題Aへ
4. Google でログインする
5. 元のページに戻ってくる
6. デバッグログを確認

**確認すべきログ：**
```
=== Login button clicked ===
Device: Mobile
User agent: [ユーザーエージェント]
localStorage test: OK / BLOCKED
Attempting popup sign-in
Popup failed: [エラーメッセージ]
Starting redirect sign-in
Redirect initiated...

--- ここでページがリダイレクトされる ---

=== Page loaded/mounted ===
localStorage available: true
Calling getRedirectResult...
Redirect result: User found / No result
```

### ステップ2: ログのパターンから問題を特定

#### パターンA: 「Login button clicked」がない

**原因：**
- ボタンが disabled になっている
- onClick イベントが発火していない
- JavaScript エラーが発生している

**確認：**
```javascript
// ブラウザのコンソールを開いて確認
console.log('Button disabled:', document.querySelector('button').disabled)
```

**解決策：**
- ページをリロード
- `Page Loading` が ✅ になっているか確認
- JavaScript エラーがないか確認

#### パターンB: 「localStorage test: BLOCKED」

**原因：**
- Private Browsing モード
- ストレージがブロックされている

**解決策：**
```
iOS Safari: 設定 → Safari → プライベートブラウズをオフ
Android Chrome: シークレットモードを終了
```

#### パターンC: 「Popup failed: popup-blocked」

**原因：**
- ブラウザが Popup をブロックしている

**期待される動作：**
- 自動的に Redirect にフォールバックする
- 「Starting redirect sign-in」ログが出る

**解決策：**
- ブラウザの設定で Popup を許可
- または Redirect 方式を使う（自動的にフォールバックされる）

#### パターンD: 「Starting redirect sign-in」の後、何も起こらない

**原因：**
- リダイレクトが失敗している
- Authorized domains が設定されていない

**確認：**
1. Firebase Console を開く
2. Authentication → Settings → Authorized domains
3. `app.hatofes.com` が登録されているか確認

**解決策：**
```
Firebase Console で以下を追加：
- app.hatofes.com
- localhost (開発用)
```

#### パターンE: 「Redirect result: No result」

**原因：**
- リダイレクト後に認証情報が取得できていない
- ストレージがクリアされた
- getRedirectResult が複数回呼ばれた

**詳細確認：**
```
デバッグログで以下を確認：
- localStorage available: true/false
- Auth persistence: Configured/Not configured
```

**解決策：**
1. ストレージの確認
```javascript
// ブラウザのコンソールで実行
localStorage.getItem('firebase:authUser:...')
```

2. Firebase の Persistence 設定確認
```typescript
// firebase.ts
setPersistence(auth, browserLocalPersistence)
```

3. getRedirectResult の重複呼び出しチェック
```typescript
// AuthContext と GoogleAuthPage の両方で呼んでいないか確認
```

## 🧪 検証手順

### 手順1: ローカル環境で確認

```bash
# 開発サーバーを起動
npm run dev

# スマホから localhost にアクセス（同じWiFi必須）
# PC の IP アドレスを確認
ipconfig getifaddr en0  # Mac
ipconfig  # Windows

# スマホのブラウザで開く
http://[PC_IP]:5173
```

**注意：**
- localhost では Google ログインが動作しない場合がある
- Firebase Console の Authorized domains に `[PC_IP]:5173` を追加

### 手順2: 本番環境で確認

```bash
# ビルド
npm run build

# Firebase にデプロイ
firebase deploy --only hosting

# スマホで開く
https://app.hatofes.com/auth/google
```

### 手順3: デバッグモードで確認

**iOS Safari でリモートデバッグ：**
1. iPhone の設定 → Safari → 詳細 → Web インスペクタをオン
2. Mac で Safari を開く
3. 開発 → [iPhone名] → [ページ] を選択
4. コンソールでログを確認

**Android Chrome でリモートデバッグ：**
1. Android の設定 → 開発者向けオプション → USB デバッグをオン
2. PC と USB で接続
3. Chrome で `chrome://inspect` を開く
4. デバイスを選択してコンソールを確認

## 🛠️ よくある問題と解決策

### 問題1: モバイルでボタンをタップしても何も起こらない

**原因候補：**
1. ボタンが disabled
2. loading 状態が true のまま
3. JavaScript エラー
4. タッチイベントの問題

**解決策：**
```typescript
// System State を確認
Page Loading: 🟡 ← これが 🟡 のままならボタンは disabled

// ログを確認
=== Login button clicked === ← これが出ていないなら onClick が発火していない

// リロードして再試行
```

### 問題2: Google ログイン画面が一瞬表示されてすぐ閉じる

**原因：**
- Popup がブロックされている
- 自動的に Redirect にフォールバックしている

**期待される動作：**
```
Attempting popup sign-in
Popup failed: popup-blocked
Starting redirect sign-in
Redirect initiated...
```

**解決策：**
- これは正常な動作（Redirect にフォールバック）
- Google ログイン画面に移動するはず

### 問題3: Google ログイン後、元のページに戻ってこない

**原因：**
- リダイレクト URL が間違っている
- Authorized domains が設定されていない

**確認：**
```
デバッグログ:
Redirect will return to: https://app.hatofes.com/auth/google

Firebase Console:
Authentication → Settings → Authorized domains
- app.hatofes.com ✅
```

**解決策：**
1. Firebase Console で Authorized domains を追加
2. googleProvider の設定を確認
```typescript
googleProvider.setCustomParameters({
  redirect_uri: window.location.origin + '/auth/google'
})
```

### 問題4: Google ログイン後、「No redirect result」が表示される

**原因：**
- ストレージがクリアされた
- getRedirectResult が複数回呼ばれた
- Auth state が正しく保存されていない

**解決策：**

1. **ストレージを確認**
```javascript
// ブラウザコンソールで実行
console.log('localStorage available:', typeof localStorage !== 'undefined')
try {
  localStorage.setItem('test', '1')
  localStorage.removeItem('test')
  console.log('localStorage write: OK')
} catch (e) {
  console.error('localStorage write: BLOCKED', e)
}
```

2. **Firebase Persistence を確認**
```typescript
// firebase.ts
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set auth persistence:', error)
})
```

3. **getRedirectResult の重複呼び出しを確認**
```bash
# コード内を検索
grep -r "getRedirectResult" src/
```

出力：
```
src/pages/auth/GoogleAuthPage.tsx: const result = await getRedirectResult(auth)
```

複数の場所で呼んでいたら、1箇所にまとめる。

### 問題5: 「PC版サイトとして表示」でしか動作しない

**原因：**
- User-Agent の判定が正しく動作している証拠
- モバイル判定時の処理（Redirect）に問題がある

**今回の修正：**
- モバイルでも Popup を優先するように変更
- Popup が失敗した場合のみ Redirect にフォールバック

**検証：**
```
デバッグログで確認：
Device: 📱 Mobile
Attempting popup sign-in
```

モバイルでも「Attempting popup sign-in」が出ていれば修正が適用されている。

## 📊 デバッグチェックリスト

### 初期確認
- [ ] Firebase Console の Authorized domains に `app.hatofes.com` が登録されている
- [ ] `setPersistence(auth, browserLocalPersistence)` が設定されている
- [ ] モバイルブラウザが Private Browsing モードでない
- [ ] JavaScript エラーがない

### ログ確認
- [ ] 「=== Login button clicked ===」が表示される
- [ ] 「localStorage test: OK」が表示される
- [ ] 「Attempting popup sign-in」または「Starting redirect sign-in」が表示される
- [ ] リダイレクト後、「=== Page loaded/mounted ===」が表示される
- [ ] 「Redirect result: User found」が表示される

### 動作確認
- [ ] ボタンをタップするとすぐに反応する
- [ ] Google ログイン画面が表示される
- [ ] ログイン後、元のページに戻ってくる
- [ ] ホームページにリダイレクトされる

## 🚀 修正後のテスト手順

### 1. デプロイ

```bash
# ビルド
npm run build

# デプロイ
firebase deploy --only hosting

# デプロイ完了を確認
# Hosting URL: https://hatofes-ecc25.web.app
```

### 2. スマホでアクセス

```
https://app.hatofes.com/auth/google
```

### 3. デバッグログを確認

画面に表示される「🔍 Debug Log (永続化)」を確認。

### 4. ログインボタンをタップ

以下のいずれかが起こるはず：
- Popup が開く → ログイン → ホームに移動 ✅
- Popup が失敗 → Google ログイン画面に移動 → ログイン → 元のページに戻る → ホームに移動 ✅

### 5. エラーが発生した場合

デバッグログをコピーして、問題を特定：

```
デバッグログのコピー方法：
1. 画面を長押し
2. テキストを選択
3. コピー
```

ログから問題を特定（上記のパターンA〜Eを参照）。

### 6. ログをクリア

次のテストのために「Clear」ボタンをタップしてログをクリア。

## 📝 トラブルシューティングレポート

問題が解決しない場合、以下の情報を収集：

```markdown
## 環境情報
- デバイス: iPhone 14 / Pixel 7 など
- OS: iOS 17.2 / Android 14 など
- ブラウザ: Safari / Chrome
- バージョン: [ブラウザのバージョン]
- モード: 通常 / Private Browsing / Incognito

## 再現手順
1. [具体的な手順]
2. [...]

## デバッグログ
```
[ここにデバッグログを貼り付け]
```

## 期待される動作
[...]

## 実際の動作
[...]

## スクリーンショット
[画面キャプチャ]
```

このレポートを基に、さらに詳細な調査を行うことができます。
