# Firebase Authentication ベストプラクティス（React + モバイル対応）

## ✅ 正しい実装パターン

### 1. Popup vs Redirect の選択

```typescript
// ❌ 間違った実装
const handleLogin = async () => {
  if (isMobile()) {
    await signInWithRedirect(auth, googleProvider)
  } else {
    await signInWithPopup(auth, googleProvider)
  }
}

// ✅ 正しい実装（モバイルでもまず Popup を試す）
const handleLogin = async () => {
  try {
    // 最新のモバイルブラウザは Popup をサポート
    const result = await signInWithPopup(auth, googleProvider)
    return result
  } catch (error) {
    // Popup がブロックされた場合のみ Redirect にフォールバック
    if (error.code === 'auth/popup-blocked' && isMobile()) {
      await signInWithRedirect(auth, googleProvider)
      // リダイレクト後はページが遷移するため、この後のコードは実行されない
      return
    }
    throw error
  }
}
```

**理由：**
- iOS Safari 14.5+ / Android Chrome 88+ は Popup をサポート
- Popup の方が UX が良い（ページ遷移なし、ログが保持される）
- Redirect は Popup が失敗した場合のフォールバック

### 2. getRedirectResult の正しい呼び出し方

```typescript
// ❌ 間違った実装（コンポーネントで呼ぶ）
useEffect(() => {
  const checkRedirect = async () => {
    setLoading(true)  // ← ボタンが disabled になる
    const result = await getRedirectResult(auth)
    if (result) {
      // 処理...
    }
    setLoading(false)
  }
  checkRedirect()
}, [])

// ✅ 正しい実装（AuthContext で一元管理）
// AuthContext.tsx
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    // onAuthStateChanged は getRedirectResult の結果も自動的に検出する
    setCurrentUser(user)
    setLoading(false)
  })
  return unsubscribe
}, [])

// または、必要な場合のみ個別に呼ぶ
useEffect(() => {
  const checkRedirect = async () => {
    try {
      const result = await getRedirectResult(auth)
      // getRedirectResult は一度しか呼べない（結果を消費する）
      if (result) {
        console.log('Redirect successful:', result.user)
      }
    } catch (error) {
      console.error('Redirect error:', error)
    }
  }

  // ページロード時に一度だけ実行
  checkRedirect()
}, [])
```

**重要：**
- `getRedirectResult` は**一度しか呼べない**（結果を消費する）
- 複数の場所で呼ぶと競合する
- `onAuthStateChanged` は自動的にリダイレクト結果を検出するため、通常は `getRedirectResult` を明示的に呼ぶ必要はない

### 3. ストレージの永続化設定

```typescript
// firebase.ts
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'

export const auth = getAuth(app)

// ✅ 必須：ストレージ永続化を設定（モバイルでリダイレクト後も認証情報を保持）
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set auth persistence:', error)
})
```

**オプション：**
- `browserLocalPersistence`: ブラウザを閉じても保持（デフォルト推奨）
- `browserSessionPersistence`: タブを閉じるまで保持
- `inMemoryPersistence`: ページリロードで消える

### 4. ログの永続化（デバッグ用）

```typescript
// ❌ 間違った実装（useState だけ）
const [debugInfo, setDebugInfo] = useState<string[]>([])

const addLog = (msg: string) => {
  console.log(msg)
  setDebugInfo(prev => [...prev, msg])
}

// リダイレクトが発生すると、debugInfo は失われる

// ✅ 正しい実装（localStorage に永続化）
const loadLogs = () => {
  try {
    const logs = localStorage.getItem('debug_logs')
    return logs ? JSON.parse(logs) : []
  } catch {
    return []
  }
}

const [debugInfo, setDebugInfo] = useState<string[]>(loadLogs())

const addLog = (msg: string) => {
  console.log(msg)
  try {
    const logs = loadLogs()
    const newLogs = [...logs, `${new Date().toISOString()}: ${msg}`].slice(-50)
    localStorage.setItem('debug_logs', JSON.stringify(newLogs))
    setDebugInfo(newLogs)
  } catch (err) {
    console.error('Failed to persist log:', err)
  }
}
```

### 5. エラーハンドリング

```typescript
// ✅ 完全なエラーハンドリング
const handleGoogleAuth = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider)

    // ドメイン制限チェック
    const email = result.user.email || ''
    if (!email.endsWith('@example.com')) {
      await auth.signOut()
      throw new Error('Invalid email domain')
    }

    return result
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('User cancelled login')
      return
    }

    if (error.code === 'auth/popup-blocked') {
      // Redirect にフォールバック
      if (isMobile()) {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      throw new Error('Popup blocked. Please allow popups for this site.')
    }

    if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Domain not authorized. Check Firebase Console.')
    }

    if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Google auth not enabled. Check Firebase Console.')
    }

    throw error
  }
}
```

### 6. UI の状態管理

```typescript
// ❌ 間違った実装（loading が競合する）
const [loading, setLoading] = useState(false)

useEffect(() => {
  setLoading(true)  // ← ボタンが disabled になる
  checkRedirectResult()
}, [])

const handleLogin = () => {
  setLoading(true)  // ← 同じ状態を使っている
  signInWithPopup(...)
}

// ✅ 正しい実装（状態を分離）
const [initializing, setInitializing] = useState(true)  // 初期化中
const [signingIn, setSigningIn] = useState(false)       // ログイン処理中

useEffect(() => {
  setInitializing(true)
  checkRedirectResult()
  setInitializing(false)
}, [])

const handleLogin = () => {
  setSigningIn(true)
  signInWithPopup(...)
  setSigningIn(false)
}

// ボタン
<button disabled={signingIn}>Login</button>
```

## 🚨 よくあるアンチパターン

### 1. useEffect で loading を true にする

```typescript
// ❌ これをやると、初回レンダリング時にボタンが disabled になる
useEffect(() => {
  setLoading(true)
  // ... 処理 ...
  setLoading(false)
}, [])

<button disabled={loading}>Login</button>
```

### 2. getRedirectResult を複数の場所で呼ぶ

```typescript
// ❌ getRedirectResult は一度しか呼べない
// AuthContext.tsx
useEffect(() => {
  getRedirectResult(auth)  // ← 1回目
}, [])

// GoogleAuthPage.tsx
useEffect(() => {
  getRedirectResult(auth)  // ← 2回目（結果は null になる）
}, [])
```

### 3. モバイルで常に Redirect を使う

```typescript
// ❌ 最新のモバイルブラウザは Popup をサポート
if (isMobile()) {
  await signInWithRedirect(auth, googleProvider)
} else {
  await signInWithPopup(auth, googleProvider)
}

// ✅ まず Popup を試す
try {
  await signInWithPopup(auth, googleProvider)
} catch {
  if (isMobile()) {
    await signInWithRedirect(auth, googleProvider)
  }
}
```

### 4. リダイレクト URL を明示的に指定しない

```typescript
// ❌ リダイレクト URL がデフォルト（現在の URL）になる
await signInWithRedirect(auth, googleProvider)

// ✅ 明示的に指定（推奨）
// Firebase Console の Authorized redirect URIs に登録された URL を使う
googleProvider.setCustomParameters({
  redirect_uri: `${window.location.origin}/auth/google`
})
await signInWithRedirect(auth, googleProvider)
```

## 📱 iOS Safari / Android Chrome の注意点

### iOS Safari

1. **ITP (Intelligent Tracking Prevention)**
   - サードパーティ Cookie が自動的にブロックされる
   - 7日間のストレージ制限
   - → `browserLocalPersistence` を使う

2. **Private Browsing モード**
   - localStorage が使えない
   - → try-catch で検出し、ユーザーに通知

3. **Popup ブロック**
   - ユーザーアクション（タップ）から直接呼ばないとブロックされる
   - → async 処理の後に Popup を開くとブロックされる

```typescript
// ❌ 間違い（async 処理の後に Popup を開く）
const handleLogin = async () => {
  await someAsyncOperation()  // ← この間に「ユーザーアクション」が切れる
  await signInWithPopup(auth, googleProvider)  // ← ブロックされる
}

// ✅ 正しい（ユーザーアクションから直接 Popup を開く）
const handleLogin = async () => {
  await signInWithPopup(auth, googleProvider)  // ← すぐに開く
}
```

### Android Chrome

1. **Enhanced Safe Browsing**
   - 怪しいリダイレクトをブロック
   - → Firebase Console の Authorized domains を正しく設定

2. **サードパーティ Cookie のブロック（Chrome 115+）**
   - デフォルトでブロック
   - → First-party context（同じドメイン）で認証する

3. **Data Saver モード**
   - リダイレクトが制限されることがある
   - → Popup 方式を優先

## 🔧 トラブルシューティング

### 問題：モバイルで getRedirectResult が null を返す

**原因候補：**
1. ストレージがブロックされている（Private Browsing）
2. リダイレクト URL が一致しない
3. Authorized domains が設定されていない
4. getRedirectResult が複数回呼ばれている

**解決策：**
```typescript
// ストレージチェック
try {
  localStorage.setItem('test', '1')
  localStorage.removeItem('test')
  console.log('localStorage: OK')
} catch {
  console.error('localStorage: BLOCKED')
  alert('プライベートブラウジングモードを無効にしてください')
}

// リダイレクト URL をログ
console.log('Redirect URL:', window.location.href)

// Firebase Console で確認
// Authentication → Settings → Authorized domains
// に app.hatofes.com を追加
```

### 問題：Popup がブロックされる

**原因：**
- ユーザーアクションから直接呼んでいない
- ブラウザの設定で Popup がブロックされている

**解決策：**
```typescript
// 1. ユーザーアクションから直接呼ぶ
<button onClick={handleLogin}>Login</button>  // ✅

// 2. Popup がブロックされたら Redirect にフォールバック
try {
  await signInWithPopup(auth, googleProvider)
} catch (error) {
  if (error.code === 'auth/popup-blocked') {
    await signInWithRedirect(auth, googleProvider)
  }
}
```

### 問題：ドメインエラー（auth/unauthorized-domain）

**原因：**
- Firebase Console の Authorized domains に登録されていない

**解決策：**
1. Firebase Console を開く
2. Authentication → Settings → Authorized domains
3. `app.hatofes.com` を追加
4. localhost や他のドメインも必要に応じて追加

## 📚 まとめ

### 推奨される実装フロー

```typescript
// 1. firebase.ts でストレージ永続化を設定
setPersistence(auth, browserLocalPersistence)

// 2. AuthContext で onAuthStateChanged を使う（getRedirectResult は不要）
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    setCurrentUser(user)
  })
  return unsubscribe
}, [])

// 3. ログインページで Popup → Redirect のフォールバック
const handleLogin = async () => {
  try {
    await signInWithPopup(auth, googleProvider)
  } catch (error) {
    if (error.code === 'auth/popup-blocked' && isMobile()) {
      await signInWithRedirect(auth, googleProvider)
    }
  }
}

// 4. デバッグログを localStorage に永続化
// 5. エラーハンドリングを徹底
// 6. Firebase Console の設定を確認
```

### チェックリスト

- [ ] `setPersistence(auth, browserLocalPersistence)` を設定
- [ ] `onAuthStateChanged` で認証状態を監視
- [ ] Popup → Redirect のフォールバック実装
- [ ] エラーハンドリング実装
- [ ] デバッグログの永続化
- [ ] Firebase Console の Authorized domains 設定
- [ ] モバイルでの動作確認
- [ ] Private Browsing モードでの動作確認
- [ ] ストレージブロック時のエラー表示
