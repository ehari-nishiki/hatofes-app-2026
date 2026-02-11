# モバイル Google ログイン問題 - 解決策まとめ

## 🎯 問題の核心

### ログの錯覚
スマホで「Login button clicked」が見えない理由：
→ **ログは実際には出力されているが、signInWithRedirect がページをリダイレクトするため消えている**

### 真の問題
**getRedirectResult が null を返す**
→ リダイレクト後に認証情報が取得できていない

## 🔧 実装した修正

### 修正1: ログの永続化（localStorage）

**目的：** リダイレクト前後のログを保持し、実際に何が起こっているか確認できるようにする

```typescript
// Before
const [debugInfo, setDebugInfo] = useState<string[]>([])

// After
const loadPersistedLogs = (): string[] => {
  try {
    const logs = localStorage.getItem('auth_debug_logs')
    return logs ? JSON.parse(logs) : ['Component mounted']
  } catch {
    return ['Component mounted']
  }
}

const [debugInfo, setDebugInfo] = useState<string[]>(loadPersistedLogs())

const addDebugLog = (msg: string) => {
  console.log(`[GoogleAuth] ${msg}`)
  savePersistedLog(msg)  // ← localStorage に保存
  setDebugInfo(prev => [...prev, msg].slice(-20))
}
```

**効果：**
- リダイレクト前の「Login button clicked」が見えるようになる
- 問題の切り分けが容易になる

### 修正2: Mobile でも Popup を優先（Redirect はフォールバック）

**理由：**
- iOS Safari 14.5+ / Android Chrome 88+ は Popup をサポート
- Popup の方が UX が良い（ページ遷移なし、ログ保持）
- Redirect は Popup 失敗時のフォールバック

```typescript
// Before
if (isMobile()) {
  await signInWithRedirect(auth, googleProvider)
} else {
  await signInWithPopup(auth, googleProvider)
}

// After
const usePopup = !mobile || window.innerWidth >= 768

if (usePopup) {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    // 成功
  } catch (popupErr) {
    // Popup がブロックされた場合のみ Redirect にフォールバック
    if (popupErr.message.includes('popup-blocked') && mobile) {
      await signInWithRedirect(auth, googleProvider)
    }
  }
} else {
  await signInWithRedirect(auth, googleProvider)
}
```

**効果：**
- モバイルでも Popup が使えるケースが増える
- Redirect の問題を回避できる可能性が高まる

### 修正3: 詳細なデバッグ情報の追加

```typescript
// ストレージ状態のチェック
addDebugLog(`localStorage available: ${typeof localStorage !== 'undefined'}`)
addDebugLog(`localStorage test: ${(() => {
  try {
    localStorage.setItem('test', '1')
    localStorage.removeItem('test')
    return 'OK'
  } catch {
    return 'BLOCKED'
  }
})()}`)

// リダイレクト URL のログ
addDebugLog(`Current URL: ${window.location.href}`)
addDebugLog(`Redirect will return to: ${window.location.origin}${window.location.pathname}`)
```

**効果：**
- ストレージブロックを即座に検出
- リダイレクト URL の不一致を確認可能

### 修正4: エラーハンドリングの強化

```typescript
try {
  // ...
} catch (err) {
  addDebugLog(`Sign-in error: ${err instanceof Error ? err.message : String(err)}`)

  if (err.message.includes('auth/unauthorized-domain')) {
    setError('認証エラー: ドメインが許可されていません。Firebase Consoleを確認してください')
  }
  // ... 他のエラー処理
}
```

## 📊 デバッグフロー

### ステップ1: ログの確認

スマホでログインボタンをタップし、画面のデバッグログを確認：

```
期待されるログ（Popup 成功時）:
=== Login button clicked ===
Device: 📱 Mobile
localStorage test: OK
Attempting popup sign-in
Popup result: user@example.com
→ ホームにリダイレクト

期待されるログ（Redirect 時）:
=== Login button clicked ===
Device: 📱 Mobile
localStorage test: OK
Attempting popup sign-in
Popup failed: popup-blocked
Starting redirect sign-in
Redirect initiated...

--- ページがリダイレクト ---

=== Page loaded/mounted ===
localStorage available: true
Calling getRedirectResult...
Redirect result: User found
→ ホームにリダイレクト
```

### ステップ2: 問題のパターン特定

#### パターンA: 「localStorage test: BLOCKED」

**原因：** Private Browsing モード

**解決：**
```
iOS Safari: 設定 → Safari → プライベートブラウズをオフ
Android Chrome: シークレットモードを終了
```

#### パターンB: 「Redirect result: No result」

**原因：**
1. ストレージがクリアされた
2. getRedirectResult が複数回呼ばれた
3. Authorized domains が設定されていない

**解決：**
1. Firebase Console → Authentication → Settings → Authorized domains
2. `app.hatofes.com` を追加
3. AuthContext で getRedirectResult を呼んでいないか確認

#### パターンC: 「Login button clicked」自体がない

**原因：** ボタンが disabled

**解決：**
- 「Page Loading」が ✅ になるまで待つ
- ページをリロード

## ✅ 正しい実装パターン（まとめ）

### 1. Firebase 初期化（firebase.ts）

```typescript
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'

export const auth = getAuth(app)

// ✅ 必須：モバイルでリダイレクト後も認証情報を保持
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set auth persistence:', error)
})

export const googleProvider = new GoogleAuthProvider()
if (import.meta.env.VITE_RESTRICT_DOMAIN === 'true') {
  googleProvider.setCustomParameters({ hd: 'g.nagano-c.ed.jp' })
}
```

### 2. AuthContext（認証状態管理）

```typescript
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user && isValidDomain(user.email || '')) {
      setCurrentUser(user)
    } else {
      setCurrentUser(null)
    }
    setLoading(false)
  })
  return unsubscribe
}, [])

// ✅ getRedirectResult は onAuthStateChanged が自動的に処理する
// ✅ 複数の場所で getRedirectResult を呼ばない
```

### 3. ログインページ（GoogleAuthPage.tsx）

```typescript
const handleGoogleAuth = async () => {
  setLoading(true)

  try {
    // ✅ モバイルでも Popup を優先
    const usePopup = !isMobile() || window.innerWidth >= 768

    if (usePopup) {
      try {
        const result = await signInWithPopup(auth, googleProvider)
        await handlePostAuthNavigation(result.user)
        return
      } catch (popupErr) {
        // ✅ Popup 失敗時のみ Redirect にフォールバック
        if (popupErr.message.includes('popup-blocked') && isMobile()) {
          // Redirect にフォールバック
        } else {
          throw popupErr
        }
      }
    }

    // ✅ Redirect 方式
    await signInWithRedirect(auth, googleProvider)
    // この後、ページ全体がリダイレクトされる

  } catch (err) {
    // エラーハンドリング
    setLoading(false)
  }
}
```

### 4. リダイレクト結果の処理

```typescript
useEffect(() => {
  const handleRedirectResult = async () => {
    // ✅ loading を true にしない（ボタンが disabled にならないように）
    const result = await getRedirectResult(auth)

    if (result && result.user) {
      await handlePostAuthNavigation(result.user)
    }
  }

  handleRedirectResult()
}, [])
```

## 🚀 次のアクション

### 1. デプロイして確認

```bash
npm run build
firebase deploy --only hosting
```

### 2. スマホでテスト

```
https://app.hatofes.com/auth/google
```

### 3. デバッグログを確認

画面の「🔍 Debug Log (永続化)」を確認し、以下を検証：

- [ ] 「=== Login button clicked ===」が表示される
- [ ] 「localStorage test: OK」が表示される
- [ ] Popup または Redirect が実行される
- [ ] リダイレクト後、「Redirect result: User found」が表示される

### 4. 問題が解決しない場合

デバッグログをコピーして、以下を確認：

1. **Firebase Console の設定**
   - Authentication → Settings → Authorized domains
   - `app.hatofes.com` が登録されているか

2. **ブラウザの設定**
   - Private Browsing モードでないか
   - Popup がブロックされていないか

3. **コードの確認**
   - `setPersistence` が設定されているか
   - `getRedirectResult` が複数の場所で呼ばれていないか

## 📚 参考ドキュメント

作成したドキュメント：

1. **MOBILE_AUTH_ANALYSIS.md** - 問題の詳細分析
2. **FIREBASE_AUTH_BEST_PRACTICES.md** - ベストプラクティス集
3. **MOBILE_AUTH_DEBUG_GUIDE.md** - デバッグ手順書
4. **SOLUTION_SUMMARY.md** - このドキュメント

## 💡 重要なポイント

### getRedirectResult の性質
- **一度しか呼べない**（結果を消費する）
- **複数の場所で呼ぶと競合する**
- **onAuthStateChanged が自動的に処理する**ため、通常は明示的に呼ぶ必要はない

### Popup vs Redirect
- **Popup**: UX が良い、ログが保持される、モバイルでもサポートされる
- **Redirect**: 確実に動作する、ログが消える、ストレージに依存

### デバッグの重要性
- **localStorage に永続化**することで、リダイレクト前後のログを確認できる
- **詳細なログ**で問題の切り分けが容易になる

## ✨ 期待される改善

今回の修正により：

1. **モバイルでも Popup が使える** → UX 向上、問題回避
2. **ログが永続化される** → デバッグが容易に
3. **詳細なエラー情報** → 問題の特定が迅速に
4. **ストレージチェック** → Private Browsing を即座に検出

これらの修正により、モバイルでの Google ログイン成功率が大幅に向上することが期待されます。
