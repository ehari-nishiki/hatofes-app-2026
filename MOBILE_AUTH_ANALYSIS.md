# モバイル認証失敗の原因分析

## 1. ログから読み取れる事実

### PCのログ（成功）
```
[GoogleAuth] Login button clicked
[GoogleAuth] Device: Desktop
[GoogleAuth] Starting popup sign-in
[GoogleAuth] Popup result: ebi.sandwich.finland@gmail.com
```

### スマホのログ（失敗）
```
[GoogleAuth] Auto-redirect check: authLoading=true
[GoogleAuth] Auth state: Not logged in
[GoogleAuth] No redirect result
[GoogleAuth] No user found - login required
```

### スマホで「Login button clicked」が見えない理由

**signInWithRedirect はページ全体をリダイレクトするため、console ログは消える**

つまり：
1. ユーザーがボタンクリック
2. 「Login button clicked」がconsoleに出力（されている可能性が高い）
3. **signInWithRedirect が実行され、ページ全体が Google にリダイレクト**
4. **→ console がクリアされ、ログは消失**
5. 何らかの理由で元のページに戻ってくる
6. 新しいページロードで useEffect が実行され、getRedirectResult が呼ばれる
7. 「No redirect result」が出力される

## 2. 真の問題：getRedirectResult が null を返す理由

スマホのログで「No redirect result」が出ている = **リダイレクト後に認証情報が取得できていない**

### 考えられる原因

#### A. ストレージの問題（最も可能性が高い）
- モバイルブラウザの Private Browsing / Incognito モード
- サードパーティ Cookie のブロック
- ストレージのクリア設定

#### B. リダイレクト URL の不一致
- Firebase Console の Authorized domains に app.hatofes.com が登録されていても、**正確な URL パス**が問題になることがある
- 例：`https://app.hatofes.com/auth/google` でリダイレクトを開始したのに、`https://app.hatofes.com/` に戻ってくるなど

#### C. Auth State の初期化タイミング問題
```typescript:src/pages/auth/GoogleAuthPage.tsx
useEffect(() => {
  const handleRedirectResult = async () => {
    setLoading(true)  // ← ここで loading を true に
    const result = await getRedirectResult(auth)
    // ...
  }
  handleRedirectResult()
}, [])
```

このコードには以下の問題があります：

1. **useEffect が実行される前に AuthContext が auth state を確認**してしまう可能性
2. **getRedirectResult の複数回呼び出し**のリスク
3. **loading 状態の競合**

## 3. 「PC版サイトとして表示」で動作する理由

User-Agent が変わることで `isMobile()` が false を返し、**signInWithPopup** が使われる。

```typescript:src/pages/auth/GoogleAuthPage.tsx
const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}
```

Popup 方式では：
- ページ全体がリダイレクトされない
- 認証情報が currentWindow に残る
- ストレージの問題が発生しにくい

## 4. コードの問題点（アンチパターン）

### ❌ 問題1：getRedirectResult の呼び出しタイミング

```typescript
// GoogleAuthPage.tsx: line 84-151
useEffect(() => {
  const handleRedirectResult = async () => {
    setLoading(true)  // ボタンを disabled にしてしまう
    const result = await getRedirectResult(auth)
    // ...
  }
  handleRedirectResult()
}, [])
```

**問題点：**
- AuthContext の onAuthStateChanged と競合する可能性
- loading を true にすることでボタンが一時的に disabled になる
- getRedirectResult は一度しか呼べない（結果を消費する）

### ❌ 問題2：Auto-redirect ロジックの競合

```typescript
// GoogleAuthPage.tsx: line 62-81
useEffect(() => {
  if (authLoading || !userDataChecked || processingAuthRef.current) {
    return
  }
  if (currentUser) {
    navigate('/home', { replace: true })
  }
}, [currentUser, userData, authLoading, userDataChecked, navigate, addDebugLog])
```

**問題点：**
- リダイレクト処理中に currentUser が更新されると、このロジックが発火
- handlePostAuthNavigation と二重でナビゲーションが実行される可能性

### ❌ 問題3：debugInfo が永続化されていない

```typescript
const [debugInfo, setDebugInfo] = useState<string[]>(['Component mounted'])
```

**問題点：**
- signInWithRedirect でページがリロードされると、debugInfo は失われる
- リダイレクト前のログ（「Login button clicked」など）が見えない
- デバッグが困難

## 5. iOS Safari / Android Chrome 特有の問題

### iOS Safari
- ITP (Intelligent Tracking Prevention) により、サードパーティ Cookie がブロックされる
- 7日間のストレージ制限
- Private Relay による IP アドレスの変更

### Android Chrome
- Enhanced Safe Browsing によるブロック
- Data Saver モードでのリダイレクト制限
- サードパーティ Cookie のデフォルトブロック（Chrome 115+）

## 6. 修正方針

### ✅ 必須の修正

1. **getRedirectResult を適切なタイミングで呼ぶ**
   - AuthContext の初期化と統合する
   - または、GoogleAuthPage 専用のガード条件を設ける

2. **loading 状態の管理を改善**
   - 初期状態で loading を true にしない
   - redirect 処理中は別の状態フラグを使う

3. **デバッグログを localStorage に保存**
   - リダイレクト前後でログを保持
   - 実際に何が起こっているか確認できるようにする

4. **ストレージのパーミッション確認**
   - localStorage / sessionStorage が使えるかチェック
   - 使えない場合はユーザーにエラー表示

### ✅ 推奨の修正

1. **Mobile でも Popup をデフォルトにする**
   - iOS Safari 14.5+ / Android Chrome 88+ は Popup をサポート
   - Redirect は Popup が失敗した場合のみ使う

2. **OAuth リダイレクト URI を明示的に指定**
   ```typescript
   googleProvider.setCustomParameters({
     redirect_uri: window.location.origin + '/auth/google'
   });
   ```

3. **エラーハンドリングの強化**
   - getRedirectResult のエラーを詳細にログ
   - Firebase Console のログも確認

## 7. 次のステップ

1. **localStorage に debugInfo を保存してリダイレクト前後のログを確認**
2. **Mobile でも Popup を試す（Fallback として Redirect を残す）**
3. **getRedirectResult を AuthContext に移動**
4. **Firebase Console の Authentication → Settings → Authorized domains を再確認**
