import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import app from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import { TetrisLoading } from '@/components/ui/TetrisLoading'
import { SkeletonCard } from '@/components/ui/SkeletonLoader'
import { TetrisIcon } from '@/components/ui/Icon'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { TetrisScore } from '@/types/firestore'
import { Toast, useToast } from '@/components/ui/Toast'
import { hapticLineClear } from '@/lib/haptics'

const fns = getFunctions(app)
const db = getFirestore(app)
const submitTetrisScoreFn = httpsCallable<
  { linesCleared: number; score: number },
  { success: boolean; pointsAwarded: number; totalToday: number; maxToday: number; message?: string }
>(fns, 'submitTetrisScore')
const getTodayTetrisStatsFn = httpsCallable<
  object,
  { totalToday: number; maxToday: number }
>(fns, 'getTodayTetrisStats')
const registerTetrisRankingFn = httpsCallable<
  { score: number; linesCleared: number },
  { success: boolean; message?: string }
>(fns, 'registerTetrisRanking')

/* ── constants ── */
const BS = 22, FW = 10, FH = 20, BG = '#141428'

interface TShape { rot: number[][][]; color: string }

const SHAPES: TShape[] = [
  { rot:[[[0,-1],[1,-1],[-1,0],[0,0]],[[0,-1],[0,0],[1,0],[1,1]],[[0,0],[1,0],[-1,1],[0,1]],[[-1,-1],[-1,0],[0,0],[0,1]]],color:'#39d353'}, // S
  { rot:[[[-1,-1],[0,-1],[0,0],[1,0]],[[1,-1],[0,0],[1,0],[0,1]],[[-1,0],[0,0],[0,1],[1,1]],[[0,-1],[0,0],[-1,0],[-1,1]]],color:'#ff4757'}, // Z
  { rot:[[[-1,0],[0,0],[1,0],[2,0]],[[1,-1],[1,0],[1,1],[1,2]],[[-1,1],[0,1],[1,1],[2,1]],[[0,-1],[0,0],[0,1],[0,2]]],color:'#00d4ff'}, // I
  { rot:[[[0,-1],[1,-1],[0,0],[1,0]],[[0,-1],[1,-1],[0,0],[1,0]],[[0,-1],[1,-1],[0,0],[1,0]],[[0,-1],[1,-1],[0,0],[1,0]]],color:'#FFD700'}, // O
  { rot:[[[-1,-1],[-1,0],[0,0],[1,0]],[[1,-1],[0,-1],[0,0],[0,1]],[[-1,0],[0,0],[1,0],[1,1]],[[0,-1],[0,0],[0,1],[-1,1]]],color:'#3a7bd5'}, // J
  { rot:[[[1,-1],[-1,0],[0,0],[1,0]],[[0,-1],[0,0],[0,1],[1,1]],[[-1,0],[0,0],[1,0],[-1,1]],[[-1,-1],[0,-1],[0,0],[0,1]]],color:'#ff9f43'}, // L
  { rot:[[[0,-1],[-1,0],[0,0],[1,0]],[[0,-1],[0,0],[1,0],[0,1]],[[-1,0],[0,0],[1,0],[0,1]],[[0,-1],[-1,0],[0,0],[0,1]]],color:'#bf5fff'}, // T
]

// 7-bag system: shuffle all 7 pieces and distribute them before reshuffling
const createBag = (): TShape[] => {
  const bag = [...SHAPES]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

const pickFrom7Bag = (bagRef: { bag: TShape[]; index: number }): TShape => {
  if (bagRef.index >= bagRef.bag.length) {
    bagRef.bag = createBag()
    bagRef.index = 0
  }
  return bagRef.bag[bagRef.index++]
}

function getJstDateString(nowMs: number) {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

/* ── color helpers ── */
function lighten(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  const m = (c: number) => Math.min(255, Math.round(c + (255 - c) * factor))
  return `rgb(${m(r)},${m(g)},${m(b)})`
}
function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  const m = (c: number) => Math.round(c * (1 - factor))
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

export default function TetrisPage() {
  const { userData, currentUser } = useAuth()
  const { toast, showToast, hideToast } = useToast()
  const fieldRef     = useRef<HTMLCanvasElement>(null)
  const nextRef      = useRef<HTMLCanvasElement>(null)
  const holdRef      = useRef<HTMLCanvasElement>(null)
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)
  const flashRef     = useRef<{ rows: number[]; time: number } | null>(null)
  const flashRafRef  = useRef<number | null>(null)

  const G = useRef({
    field: Array.from({ length: FH }, () => Array(FW).fill(BG)) as string[][],
    shape: null as TShape | null,
    rot: 0, x: 0, y: 0,
    next: null as TShape | null,
    hold: null as TShape | null,
    holdUsed: false, // 1ターンに1回のみホールド可能
    score: 0, lines: 0, level: 1, speed: 650,
    ended: false, paused: false,
    timer: null as ReturnType<typeof setTimeout> | null,
    bag: [] as TShape[],
    bagIndex: 0,
    lastRotationWasTSpinCandidate: false,
    lastClearLabel: '' as '' | 'single' | 'double' | 'triple' | 'tetris' | 'tspin_single' | 'tspin_double' | 'tspin_triple',
  })

  const [ui, setUi]             = useState({ score: 0, lines: 0, level: 1, ended: false, paused: false })
  const [reward, setReward]     = useState<number | null>(null)
  const [showReward, setShowReward] = useState(false)
  const [activeTab, setActiveTab] = useState<'game' | 'ranking' | 'rules'>('game')
  const [tetrisResult, setTetrisResult] = useState<{ totalToday: number; maxToday: number; message?: string } | null>(null)
  const [rankings, setRankings] = useState<TetrisScore[]>([])
  const [rankingsLoading, setRankingsLoading] = useState(true)
  const [, setHoldPiece] = useState<TShape | null>(null)
  const [todayStats, setTodayStats] = useState<{ totalToday: number; maxToday: number } | null>(null)
  const [showRegisterButton, setShowRegisterButton] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [showGameLoading, setShowGameLoading] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)

  const loopRef = useRef<() => void>(() => {})

  useEffect(() => {
    window.localStorage.setItem('hatofes:last-opened-tetris', getJstDateString(Date.now()))
  }, [])

  /* ── grid helpers ── */
  const pos = (s: TShape, r: number, px: number, py: number): [number, number][] =>
    s.rot[r].map(([dx, dy]): [number, number] => [
      Math.floor((px + dx * BS) / BS),
      Math.floor((py + dy * BS) / BS),
    ])

  const hit = (s: TShape, r: number, px: number, py: number): boolean => {
    for (const [bx, by] of pos(s, r, px, py)) {
      if (bx < 0 || bx >= FW || by >= FH) return true
      if (by >= 0 && G.current.field[by][bx] !== BG) return true
    }
    return false
  }

  const isFilledCell = (bx: number, by: number): boolean => {
    if (bx < 0 || bx >= FW || by >= FH) return true
    if (by < 0) return false
    return G.current.field[by][bx] !== BG
  }

  const detectTSpin = (): boolean => {
    const { shape, rot, x, y, lastRotationWasTSpinCandidate } = G.current
    if (!shape || shape.color !== '#bf5fff' || !lastRotationWasTSpinCandidate) return false

    const centerX = Math.floor(x / BS)
    const centerY = Math.floor(y / BS)
    const corners = [
      [centerX - 1, centerY - 1],
      [centerX + 1, centerY - 1],
      [centerX - 1, centerY + 1],
      [centerX + 1, centerY + 1],
    ]

    const filledCorners = corners.filter(([bx, by]) => isFilledCell(bx, by)).length
    return filledCorners >= 3 && rot >= 0
  }

  const ghostY = (): number => {
    const { shape, rot, x, y } = G.current
    if (!shape) return 0
    let ty = y
    while (!hit(shape, rot, x, ty + BS)) ty += BS
    return ty
  }

  /* ── 3D block ── */
  const drawBlock = (ctx: CanvasRenderingContext2D, bx: number, by: number, color: string) => {
    const x = bx * BS, y = by * BS, s = BS - 1
    ctx.fillStyle = darken(color, 0.4);  ctx.fillRect(x + 1, y + 1, s, s)   // shadow
    ctx.fillStyle = color;               ctx.fillRect(x, y, s, s)            // face
    ctx.fillStyle = lighten(color, 0.32); ctx.fillRect(x, y, s, 2); ctx.fillRect(x, y, 2, s)           // highlight
    ctx.fillStyle = darken(color, 0.22);  ctx.fillRect(x, y + s - 2, s, 2); ctx.fillRect(x + s - 2, y, 2, s) // inner shadow
  }

  /* ── draw field ── */
  const draw = () => {
    const cv = fieldRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    const { field, shape, rot, x, y } = G.current
    const W = FW * BS, H = FH * BS

    // bg
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)

    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1
    for (let r = 0; r <= FH; r++) { ctx.beginPath(); ctx.moveTo(0, r * BS); ctx.lineTo(W, r * BS); ctx.stroke() }
    for (let c = 0; c <= FW; c++) { ctx.beginPath(); ctx.moveTo(c * BS, 0); ctx.lineTo(c * BS, H); ctx.stroke() }

    // locked blocks
    for (let r = 0; r < FH; r++)
      for (let c = 0; c < FW; c++)
        if (field[r][c] !== BG) drawBlock(ctx, c, r, field[r][c])

    // line-clear flash
    if (flashRef.current) {
      const alpha = Math.max(0, 1 - (Date.now() - flashRef.current.time) / 200)
      if (alpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.78})`
        for (const row of flashRef.current.rows) ctx.fillRect(0, row * BS, W, BS)
      }
    }

    if (!shape) return

    // ghost
    const gy = ghostY()
    if (gy !== y) {
      ctx.globalAlpha = 0.11; ctx.fillStyle = shape.color
      for (const [bx, by] of pos(shape, rot, x, gy)) if (by >= 0) ctx.fillRect(bx * BS, by * BS, BS - 1, BS - 1)
      ctx.globalAlpha = 0.45; ctx.strokeStyle = shape.color; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3])
      for (const [bx, by] of pos(shape, rot, x, gy)) if (by >= 0) ctx.strokeRect(bx * BS + 0.75, by * BS + 0.75, BS - 2.5, BS - 2.5)
      ctx.setLineDash([]); ctx.globalAlpha = 1
    }

    // current piece
    for (const [bx, by] of pos(shape, rot, x, y)) if (by >= 0) drawBlock(ctx, bx, by, shape.color)
  }

  /* ── draw next preview ── */
  const drawNext = () => {
    const cv = nextRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = cv.width, H = cv.height
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1
    for (let r = 0; r <= 4; r++) { ctx.beginPath(); ctx.moveTo(0, r * BS); ctx.lineTo(W, r * BS); ctx.stroke() }
    for (let c = 0; c <= 4; c++) { ctx.beginPath(); ctx.moveTo(c * BS, 0); ctx.lineTo(c * BS, H); ctx.stroke() }

    const { next } = G.current; if (!next) return
    for (const [dx, dy] of next.rot[0]) {
      const bx = Math.floor(1.5 + dx), by = Math.floor(2 + dy)
      drawBlock(ctx, bx, by, next.color)
    }
  }

  /* ── draw hold preview ── */
  const drawHold = () => {
    const cv = holdRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = cv.width, H = cv.height
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1
    for (let r = 0; r <= 4; r++) { ctx.beginPath(); ctx.moveTo(0, r * BS); ctx.lineTo(W, r * BS); ctx.stroke() }
    for (let c = 0; c <= 4; c++) { ctx.beginPath(); ctx.moveTo(c * BS, 0); ctx.lineTo(c * BS, H); ctx.stroke() }

    const { hold } = G.current; if (!hold) return
    // ホールド使用済みの場合は暗く表示
    ctx.globalAlpha = G.current.holdUsed ? 0.4 : 1
    for (const [dx, dy] of hold.rot[0]) {
      const bx = Math.floor(1.5 + dx), by = Math.floor(2 + dy)
      drawBlock(ctx, bx, by, hold.color)
    }
    ctx.globalAlpha = 1
  }

  /* ── overlay (pause / game over) ── */
  const overlay = (text: string, color: string, sub?: string) => {
    const cv = fieldRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = FW * BS, H = FH * BS, midY = H / 2

    ctx.fillStyle = 'rgba(10,10,30,0.88)'; ctx.fillRect(0, 0, W, H)

    // decorative lines
    const lineAbove = midY - 40, lineBelow = midY + (sub ? 36 : 16)
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.5
    ctx.beginPath(); ctx.moveTo(W * 0.12, lineAbove); ctx.lineTo(W * 0.88, lineAbove); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W * 0.12, lineBelow); ctx.lineTo(W * 0.88, lineBelow); ctx.stroke()
    ctx.globalAlpha = 1

    ctx.textAlign = 'center'
    ctx.fillStyle = color; ctx.font = 'bold 23px sans-serif'
    ctx.fillText(text, W / 2, midY - (sub ? 12 : 0))
    if (sub) { ctx.fillStyle = '#b0b0b0'; ctx.font = '14px sans-serif'; ctx.fillText(sub, W / 2, midY + 16) }
  }

  /* ── flash animation loop ── */
  const runFlash = () => {
    if (!flashRef.current) { flashRafRef.current = null; return }
    draw()
    if (Date.now() - flashRef.current.time < 200) {
      flashRafRef.current = requestAnimationFrame(runFlash)
    } else {
      flashRef.current = null; flashRafRef.current = null; draw()
    }
  }

  /* ── game actions ── */
  const spawn = () => {
    G.current.shape = G.current.next
    const bagState = { bag: G.current.bag, index: G.current.bagIndex }
    G.current.next  = pickFrom7Bag(bagState)
    G.current.bag = bagState.bag
    G.current.bagIndex = bagState.index
    G.current.rot   = 0
    G.current.x     = (FW / 2 - 1) * BS
    G.current.y     = -BS
    G.current.holdUsed = false // ホールドをリセット
    G.current.lastRotationWasTSpinCandidate = false
    drawNext()
    drawHold()
  }

  const lockAndClear = () => {
    const { shape, rot, x, y } = G.current; if (!shape) return
    let over = false
    for (const [bx, by] of pos(shape, rot, x, y)) {
      if (by < 0) { over = true; continue }
      if (bx >= 0 && bx < FW && by < FH) G.current.field[by][bx] = shape.color
    }
    if (over) { G.current.ended = true; setUi(p => ({ ...p, ended: true })); return }

    const isTSpin = detectTSpin()

    // detect cleared rows
    const clearedRows: number[] = []
    for (let r = FH - 1; r >= 0; r--)
      if (G.current.field[r].every(c => c !== BG)) clearedRows.push(r)

    if (clearedRows.length > 0) {
      flashRef.current = { rows: clearedRows, time: Date.now() }
      flashRafRef.current = requestAnimationFrame(runFlash)

      G.current.field = G.current.field.filter((_, i) => !clearedRows.includes(i))
      while (G.current.field.length < FH) G.current.field.unshift(Array(FW).fill(BG))

      const cleared = clearedRows.length
      G.current.lines += cleared
      G.current.level  = Math.floor(G.current.lines / 10) + 1
      // 列を消すごとに速度を速くする（1列ごとに12ms速く、最低100ms）
      G.current.speed  = Math.max(100, 800 - G.current.lines * 12)
      const normalScores = [0, 25, 100, 400, 1600]
      const tSpinScores = [0, 800, 1200, 1600]
      const gainedScore = isTSpin
        ? (tSpinScores[cleared] || normalScores[cleared] || 0) * G.current.level
        : (normalScores[cleared] || 0) * G.current.level
      G.current.score += gainedScore
      G.current.lastClearLabel = isTSpin
        ? (cleared === 1 ? 'tspin_single' : cleared === 2 ? 'tspin_double' : 'tspin_triple')
        : (cleared === 1 ? 'single' : cleared === 2 ? 'double' : cleared === 3 ? 'triple' : 'tetris')
      hapticLineClear(cleared)
      setUi(p => ({ ...p, score: G.current.score, lines: G.current.lines, level: G.current.level }))
    }
    G.current.lastRotationWasTSpinCandidate = false
  }

  const doRotate = () => {
    const { shape, rot, x, y } = G.current
    if (!shape || G.current.ended || G.current.paused) return
    const nr = (rot + 1) % 4
    for (const k of [0, BS, -BS, BS * 2, -BS * 2])
      if (!hit(shape, nr, x + k, y)) { G.current.rot = nr; G.current.x = x + k; G.current.lastRotationWasTSpinCandidate = true; draw(); return }
  }
  // 逆回転（反時計回り）
  const doRotateCCW = () => {
    const { shape, rot, x, y } = G.current
    if (!shape || G.current.ended || G.current.paused) return
    const nr = (rot + 3) % 4 // -1 mod 4 = 3
    for (const k of [0, BS, -BS, BS * 2, -BS * 2])
      if (!hit(shape, nr, x + k, y)) { G.current.rot = nr; G.current.x = x + k; G.current.lastRotationWasTSpinCandidate = true; draw(); return }
  }
  // ホールド
  const doHold = () => {
    if (G.current.ended || G.current.paused || G.current.holdUsed || !G.current.shape) return

    const currentShape = G.current.shape
    const holdShape = G.current.hold

    if (holdShape) {
      // ホールドにあったピースと入れ替え
      G.current.shape = holdShape
    } else {
      // ホールドが空の場合は次のピースを取得
      spawn()
    }
    G.current.hold = currentShape
    G.current.holdUsed = true
    G.current.rot = 0
    G.current.x = (FW / 2 - 1) * BS
    G.current.y = -BS
    G.current.lastRotationWasTSpinCandidate = false
    setHoldPiece(G.current.hold)
    drawHold()
    draw()
    drawNext()
  }
  const doLeft = () => {
    const { shape, rot, x, y } = G.current
    if (!shape || G.current.ended || G.current.paused) return
    if (!hit(shape, rot, x - BS, y)) { G.current.x -= BS; G.current.lastRotationWasTSpinCandidate = false; draw() }
  }
  const doRight = () => {
    const { shape, rot, x, y } = G.current
    if (!shape || G.current.ended || G.current.paused) return
    if (!hit(shape, rot, x + BS, y)) { G.current.x += BS; G.current.lastRotationWasTSpinCandidate = false; draw() }
  }
  const doDown = () => {
    const { shape, rot, x, y } = G.current
    if (!shape || G.current.ended || G.current.paused) return
    if (!hit(shape, rot, x, y + BS)) G.current.y += BS
    else { lockAndClear(); if (!G.current.ended) spawn() }
    draw()
  }
  const doHard = () => {
    if (!G.current.shape || G.current.ended || G.current.paused) return
    G.current.y = ghostY()
    lockAndClear()
    if (!G.current.ended) spawn()
    draw()
  }
  const doPause = () => {
    if (G.current.ended) return
    G.current.paused = !G.current.paused
    setUi(p => ({ ...p, paused: G.current.paused }))
    if (G.current.paused) { overlay('ポーズ中', '#FFC300') } else { draw() }
  }

  /* ── game loop ── */
  loopRef.current = () => {
    if (G.current.ended) {
      overlay('GAME OVER', '#ff4757', `${G.current.lines} ライン  /  ${G.current.score.toLocaleString()} スコア`)
      return
    }
    if (!G.current.paused) {
      const { shape, rot, x, y } = G.current
      if (shape) {
        if (!hit(shape, rot, x, y + BS)) G.current.y += BS
        else { lockAndClear(); if (!G.current.ended) spawn() }
        draw()
      }
    }
    G.current.timer = setTimeout(() => loopRef.current(), G.current.speed)
  }

  /* ── fetch today stats ── */
  const fetchTodayStats = async () => {
    if (!currentUser || userData?.role !== 'student') return
    try {
      const result = await getTodayTetrisStatsFn({})
      setTodayStats(result.data)
    } catch (err) {
      console.error('[Tetris] 今日の統計取得エラー:', err)
      setTodayStats(null)
    }
  }

  /* ── fetch rankings ── */
  const fetchRankings = async () => {
    setRankingsLoading(true)
    try {
      console.log('[Tetris] Fetching rankings...')
      const rankingsQuery = query(
        collection(db, 'tetrisScores'),
        orderBy('highScore', 'desc'),
        limit(10)
      )
      const snapshot = await getDocs(rankingsQuery)
      const data = snapshot.docs.map(doc => {
        const docData = doc.data()
        console.log('[Tetris] Ranking doc:', doc.id, docData)
        return { id: doc.id, ...docData } as TetrisScore
      })
      console.log('[Tetris] Rankings fetched:', data.length, 'records')
      setRankings(data)
    } catch (err) {
      console.error('[Tetris] ランキング取得エラー:', err)
      // エラー詳細をログ出力
      if (err instanceof Error) {
        console.error('[Tetris] Error name:', err.name)
        console.error('[Tetris] Error message:', err.message)
        console.error('[Tetris] Error stack:', err.stack)
      }
      // エラーが発生しても空配列をセット（UIは「データがありません」を表示）
      setRankings([])
    } finally {
      setRankingsLoading(false)
    }
  }

  /* ── register ranking ── */
  const handleRegisterRanking = async () => {
    if (!currentUser || isRegistering) return
    setIsRegistering(true)
    try {
      await registerTetrisRankingFn({ score: G.current.score, linesCleared: G.current.lines })
      setShowRegisterButton(false)
      // ランキング更新
      await fetchRankings()
      showToast('ランキングに登録しました！', 'success')
    } catch (err) {
      console.error('[Tetris] ランキング登録エラー:', err)
      showToast('ランキング登録に失敗しました', 'error')
    } finally {
      setIsRegistering(false)
    }
  }

  /* ── start / reset ── */
  const startGame = () => {
    if (G.current.timer) clearTimeout(G.current.timer)
    if (flashRafRef.current) cancelAnimationFrame(flashRafRef.current)
    flashRef.current = null; flashRafRef.current = null

    // Show loading animation
    setShowGameLoading(true)
    setGameStarted(true)

    setTimeout(() => {
      setShowGameLoading(false)
      G.current.field  = Array.from({ length: FH }, () => Array(FW).fill(BG))
      G.current.score  = 0; G.current.lines = 0; G.current.level = 1
      G.current.speed  = 650; G.current.ended = false; G.current.paused = false
      G.current.hold = null; G.current.holdUsed = false
      G.current.bag = createBag(); G.current.bagIndex = 0
      const bagState = { bag: G.current.bag, index: G.current.bagIndex }
      G.current.next = pickFrom7Bag(bagState)
      G.current.bag = bagState.bag; G.current.bagIndex = bagState.index
      spawn(); draw(); drawNext(); drawHold()
      setHoldPiece(null)
      setUi({ score: 0, lines: 0, level: 1, ended: false, paused: false })
      setReward(null); setShowReward(false); setTetrisResult(null); submittedRef.current = false
      setShowRegisterButton(false)
      G.current.timer = setTimeout(() => loopRef.current(), G.current.speed)
    }, 1500)
  }

  /* ── mount ── */
  useEffect(() => {
    // Fetch rankings and stats on mount (but don't start the game)
    fetchRankings()
    fetchTodayStats()

    const game = G.current
    return () => {
      if (game.timer) clearTimeout(game.timer)
      if (holdTimerRef.current) clearInterval(holdTimerRef.current)
      if (flashRafRef.current) cancelAnimationFrame(flashRafRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* vibration helper */
  const vibrate = (duration: number = 15) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration)
    }
  }

  /* keyboard */
  useEffect(() => {
    const pressedKeys = new Set<string>()
    let lastMoveKey: string | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      // 移動キー（左右）の同時押し対策 - 矢印キーとWASDの両方
      const leftKeys = ['ArrowLeft', 'a', 'A']
      const rightKeys = ['ArrowRight', 'd', 'D']
      const isLeftKey = leftKeys.includes(e.key)
      const isRightKey = rightKeys.includes(e.key)

      if (isLeftKey || isRightKey) {
        // 既に押されている場合（リピート）は無視
        const normalizedKey = isLeftKey ? 'left' : 'right'
        if (pressedKeys.has(normalizedKey)) return
        pressedKeys.add(normalizedKey)
        lastMoveKey = normalizedKey
      }

      switch (e.key) {
        // Arrow keys
        case 'ArrowUp':    e.preventDefault(); doRotate(); break
        case 'ArrowLeft':
        case 'a': case 'A':
          e.preventDefault()
          if (!pressedKeys.has('right') || lastMoveKey === 'left') {
            doLeft()
          }
          break
        case 'ArrowRight':
        case 'd': case 'D':
          e.preventDefault()
          if (!pressedKeys.has('left') || lastMoveKey === 'right') {
            doRight()
          }
          break
        case 'ArrowDown':
        case 's': case 'S':
          e.preventDefault(); doDown(); break
        // Hard drop
        case ' ':
        case 'w': case 'W':
          e.preventDefault(); doHard(); break
        // Rotation
        case 'q': case 'Q': e.preventDefault(); doRotateCCW(); break // 左回転 (CCW)
        case 'e': case 'E': e.preventDefault(); doRotate(); break    // 右回転 (CW)
        // Hold
        case 'r': case 'R': e.preventDefault(); doHold(); break
        // Pause
        case 'p': case 'P': e.preventDefault(); doPause(); break
        // Legacy keys (Z/C for rotation/hold)
        case 'z': case 'Z': e.preventDefault(); doRotateCCW(); break
        case 'c': case 'C': e.preventDefault(); doHold(); break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const leftKeys = ['ArrowLeft', 'a', 'A']
      const rightKeys = ['ArrowRight', 'd', 'D']
      const isLeftKey = leftKeys.includes(e.key)
      const isRightKey = rightKeys.includes(e.key)

      if (isLeftKey) {
        pressedKeys.delete('left')
        if (lastMoveKey === 'left') lastMoveKey = null
      }
      if (isRightKey) {
        pressedKeys.delete('right')
        if (lastMoveKey === 'right') lastMoveKey = null
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* submit on game over (ポイント付与のみ) */
  useEffect(() => {
    if (!ui.ended || submittedRef.current) return
    submittedRef.current = true
    const isStudent = userData?.role === 'student'

    if (isStudent) {
      // 学生はポイント付与
      submitTetrisScoreFn({ linesCleared: G.current.lines, score: G.current.score })
        .then(r => {
          setReward(r.data.pointsAwarded)
          setTetrisResult({ totalToday: r.data.totalToday, maxToday: r.data.maxToday, message: r.data.message })
          if (r.data.pointsAwarded > 0) setShowReward(true)
          // 今日の統計を更新
          fetchTodayStats()
        })
        .catch(() => { setReward(0); setTetrisResult(null) })
    }

    // ランキング登録ボタンを表示
    setShowRegisterButton(true)

    // ゲーム終了後にランキングを更新
    setTimeout(() => {
      fetchRankings()
    }, 1500)
  }, [ui.ended]) // eslint-disable-line react-hooks/exhaustive-deps

  /* touch hold with vibration */
  const startHold = (fn: () => void) => {
    vibrate(12)
    fn()
    holdTimerRef.current = setInterval(() => { vibrate(8); fn() }, 80)
  }
  const stopHold = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }
  const doWithVibrate = (fn: () => void) => {
    vibrate(15)
    fn()
  }

  /* ── render ── */
  if (!userData) return <TetrisLoading message="Loading..." />
  if (showGameLoading) return <TetrisLoading message="Starting game..." />

  const isStudent = userData.role === 'student'

  return (
    <div className="min-h-screen bg-hatofes-bg pb-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <AppHeader username={userData.username} grade={userData.grade} classNumber={userData.class} />

      {showReward && reward !== null && reward > 0 && (
        <PointRewardModal isOpen={showReward} points={reward} reason="テトリスで獲得" onClose={() => setShowReward(false)} />
      )}

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-5">

        {/* page header */}
        <div className="mb-4">
          {!(activeTab === 'game' && gameStarted) ? (
            <div className="mb-3 rounded-2xl border border-white/8 bg-[#141920] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-display tracking-[0.22em] text-white/42">ARCADE MODE</p>
                  <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-hatofes-white">
                    <TetrisIcon size={26} /> テトリス
                  </h1>
                  <p className="mt-2 text-sm text-hatofes-gray-light">
                    行を消してスコアを積み、ランキングと鳩ポイントの両方を狙うゲームモードです。
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <Link
                    to="/home"
                    className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[0.95rem] border border-white/10 bg-black/18 px-4 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
                  >
                    ホームに戻る
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TetrisIcon size={22} />
                <h1 className="text-lg font-bold text-hatofes-white">テトリス</h1>
              </div>
              <Link
                to="/home"
                className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[0.9rem] border border-white/10 bg-black/18 px-3 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                ホームへ
              </Link>
            </div>
          )}
          {/* タブ切り替え */}
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-hatofes-gray/20 bg-hatofes-dark/70 p-1.5">
            <button
              onClick={() => setActiveTab('game')}
              className={`rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                activeTab === 'game'
                  ? 'bg-hatofes-bg text-hatofes-accent-yellow shadow-[0_8px_18px_rgba(0,0,0,0.24)]'
                  : 'text-hatofes-gray hover:text-hatofes-white'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
              ゲーム
            </button>
            <button
              onClick={() => setActiveTab('ranking')}
              className={`rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                activeTab === 'ranking'
                  ? 'bg-hatofes-bg text-hatofes-accent-orange shadow-[0_8px_18px_rgba(0,0,0,0.24)]'
                  : 'text-hatofes-gray hover:text-hatofes-white'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>
              ランキング
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                activeTab === 'rules'
                  ? 'bg-hatofes-bg text-hatofes-accent-yellow shadow-[0_8px_18px_rgba(0,0,0,0.24)]'
                  : 'text-hatofes-gray hover:text-hatofes-white'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
              ルール
            </button>
          </div>
        </div>

        {/* ── ランキングタブ ── */}
        {activeTab === 'ranking' && (
          <section className="card mb-3 text-sm">
            <h3 className="font-bold text-hatofes-white mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-hatofes-accent-yellow" viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>
              ハイスコアランキング TOP10
            </h3>
            {rankingsLoading ? (
              <SkeletonCard count={5} />
            ) : rankings.length === 0 ? (
              <p className="text-hatofes-gray text-center py-4">まだランキングデータがありません</p>
            ) : (
              <div className="space-y-2">
                {rankings.map((r, idx) => {
                  const isCurrentUser = r.userId === currentUser?.uid
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                  const affiliation = r.grade && r.class ? `${r.grade}年${r.class}組` : ''
                  return (
                    <div
                      key={r.id || idx}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                        isCurrentUser
                          ? 'bg-hatofes-accent-yellow/10 border border-hatofes-accent-yellow/30'
                          : 'bg-hatofes-dark/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-5 text-center">
                          {medal ? (
                            <span className="text-base">{medal}</span>
                          ) : (
                            <span className="text-hatofes-gray font-bold text-xs">{idx + 1}</span>
                          )}
                        </div>
                        <UserAvatar name={r.username} imageUrl={r.profileImageUrl} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-bold truncate ${isCurrentUser ? 'text-hatofes-accent-yellow' : 'text-hatofes-white'}`}>
                              {r.username}
                            </p>
                            {isCurrentUser && <span className="text-xs text-hatofes-accent-yellow">(あなた)</span>}
                          </div>
                          {affiliation && <p className="text-xs text-hatofes-gray">{affiliation}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-display font-bold text-hatofes-white">{r.highScore.toLocaleString()}</p>
                        <p className="text-xs text-hatofes-gray">{r.maxLines}列</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ── ルールタブ ── */}
        {activeTab === 'rules' && (
          <section className="card mb-3 text-sm space-y-4">

            <div>
              <h3 className="font-bold text-hatofes-white mb-1.5 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-hatofes-accent-yellow" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                遊び方
              </h3>
              <p className="text-hatofes-gray leading-relaxed">
                上から落ちてくるブロックを左右に移動・回転させて、横の一列を埋めると行が消える。<br />
                上まで詰まったらゲームオーバー。できるだけ多く行を消して高いスコアを狙おう！
              </p>
              <div className="mt-2 px-3 py-2 bg-hatofes-dark/50 rounded-lg">
                <p className="text-xs text-hatofes-accent-yellow font-bold mb-1">✨ 7-bagシステム採用</p>
                <p className="text-xs text-hatofes-gray leading-relaxed">
                  7種類のブロック全てが1回ずつ出現してからシャッフルされます。同じブロックが連続で出にくくなり、より戦略的にプレイできます！
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-hatofes-white mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-hatofes-accent-yellow" viewBox="0 0 24 24" fill="currentColor"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>
                操作方法
              </h3>
              <div className="bg-hatofes-dark rounded-xl p-3 space-y-3">
                <div>
                  <p className="text-xs text-hatofes-accent-yellow font-bold mb-1.5">矢印キー操作</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {[
                      ['◀ ▶', '左右移動'],
                      ['↑',   '時計回り回転'],
                      ['▼',   'ゆっくり下へ'],
                      ['⬇',   '急落下（スペース）'],
                    ].map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold text-hatofes-white ${key === '⬇' ? 'px-1.5 py-0.5 bg-hatofes-accent-orange/40' : 'w-6 h-5 bg-hatofes-gray/25'}`}>{key}</span>
                        <span className="text-hatofes-gray text-xs">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-hatofes-gray/20 pt-2">
                  <p className="text-xs text-hatofes-accent-yellow font-bold mb-1.5">WASD操作</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {[
                      ['A D', '左右移動'],
                      ['W',   '急落下（ハードドロップ）'],
                      ['S',   'ゆっくり下へ'],
                      ['Q E', '左回転 / 右回転'],
                      ['R',   'ホールド'],
                      ['P',   'ポーズ / 再開'],
                    ].map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold text-hatofes-white ${key === 'R' ? 'px-1.5 py-0.5 bg-green-500/40' : key === 'W' ? 'px-1.5 py-0.5 bg-hatofes-accent-orange/40' : 'px-1.5 py-0.5 bg-hatofes-gray/25'}`}>{key}</span>
                        <span className="text-hatofes-gray text-xs">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-hatofes-gray/50 text-xs pt-1 border-t border-hatofes-gray/20">
                  タッチ操作は画面下のボタンで行えます（バイブレーション付き）
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-hatofes-white mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-hatofes-accent-yellow" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
                スコア計算
              </h3>
              <div className="bg-hatofes-dark rounded-xl overflow-hidden">
                <table className="w-full text-center text-sm">
                  <thead>
                    <tr className="bg-hatofes-gray/10">
                      <th className="py-1.5 text-xs font-medium text-hatofes-gray">消し行数</th>
                      <th className="py-1.5 text-xs font-medium text-hatofes-gray">スコア</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['1行',            '25 × レベル'],
                      ['2行',            '100 × レベル'],
                      ['3行',            '400 × レベル'],
                      ['4行 (Tetris!)',  '1600 × レベル'],
                    ].map(([lines, score]) => (
                      <tr key={lines} className="border-t border-hatofes-gray/15">
                        <td className="py-1.5 text-hatofes-white text-xs">{lines}</td>
                        <td className="py-1.5 text-hatofes-accent-yellow text-xs font-bold font-display">{score}</td>
                      </tr>
                    ))}
                    {[
                      ['T-Spin Single', '800 × レベル'],
                      ['T-Spin Double', '1200 × レベル'],
                      ['T-Spin Triple', '1600 × レベル'],
                    ].map(([lines, score]) => (
                      <tr key={lines} className="border-t border-hatofes-gray/15">
                        <td className="py-1.5 text-cyan-300 text-xs">{lines}</td>
                        <td className="py-1.5 text-cyan-300 text-xs font-bold font-display">{score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-hatofes-white mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-hatofes-accent-yellow" viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>
                鳩ポイント報酬
              </h3>
              <div className="bg-hatofes-dark rounded-xl overflow-hidden">
                <table className="w-full text-center text-sm">
                  <thead>
                    <tr className="bg-hatofes-gray/10">
                      <th className="py-1.5 text-xs font-medium text-hatofes-gray">本日の累計消し列数</th>
                      <th className="py-1.5 text-xs font-medium text-hatofes-gray">鳩ポイント</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['1〜10列',   '列数 × 10pt'],
                      ['11〜100列',  '列数 × 1pt'],
                      ['101列以降', 'ポイントなし'],
                    ].map(([lines, pts]) => (
                      <tr key={lines} className="border-t border-hatofes-gray/15">
                        <td className="py-1.5 text-hatofes-white text-xs">{lines}</td>
                        <td className="py-1.5 text-hatofes-accent-yellow text-xs font-bold font-display">{pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-hatofes-gray/50 text-xs mt-1.5">
                ※ 生徒ロールのみ対象<br />
                ※ 鳩ポイントはゲームスコアではなく「その日に消した累計列数」で計算されます<br />
                ※ 列数カウントは毎日0時にリセットされます
              </p>
            </div>
          </section>
        )}

        {/* ── ゲームタブ ── */}
        {activeTab === 'game' && !gameStarted && (
          <div className="card border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-hatofes-dark to-purple-500/10 py-8 shadow-[0_14px_36px_rgba(0,0,0,0.26)]">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="text-center lg:text-left">
                <div className="mb-4 flex justify-center lg:justify-start">
                  <div className="rounded-2xl border border-white/8 bg-[#0f1418] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                    <TetrisIcon size={64} />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-hatofes-white mb-2">テトリス</h2>
                <p className="text-hatofes-gray text-sm leading-relaxed">
                  行を消してスコアを伸ばし、ランキングと鳩ポイントの両方を狙うモードです。
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-left">
                  {[
                    ['MOVE', '← → / A D'],
                    ['ROTATE', 'Q E / ↑'],
                    ['DROP', 'Space / W'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/8 bg-[#0f1418] px-3 py-3">
                      <p className="text-[10px] font-display tracking-[0.18em] text-hatofes-gray">{label}</p>
                      <p className="mt-1 text-xs text-hatofes-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <div className="rounded-2xl border border-white/8 bg-[#0f1418] p-5">
                  <p className="text-xs font-display tracking-[0.2em] text-hatofes-gray">TODAY STATUS</p>
                  {isStudent && todayStats ? (
                    <div className="mt-4">
                      <p className="font-display text-4xl text-hatofes-white">{todayStats.totalToday}</p>
                      <p className="mt-1 text-sm text-hatofes-gray">/ {todayStats.maxToday}列</p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-hatofes-gray">ランキング対象外のロールです</p>
                  )}
                  <button
                    onClick={startGame}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-[1rem] border border-white/10 bg-white px-4 py-4 text-lg font-bold text-[#11161a] shadow-[0_10px_24px_rgba(255,255,255,0.08)] transition-opacity hover:opacity-92"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                    ゲームスタート
                  </button>
                  <p className="text-xs text-hatofes-gray mt-4">
                    操作方法は「ルール」タブで確認できます
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'game' && gameStarted && (
          <>
        <div className="tetris-game-shell rounded-[1.25rem] border border-white/8 bg-[#141920] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
          {/* ── 今日の累計 (学生のみ) ── */}
          {isStudent && todayStats && (
            <div className="mb-3 rounded-2xl border border-hatofes-accent-yellow/15 bg-hatofes-dark/70 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-hatofes-accent-yellow" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
                  <div>
                    <p className="text-xs text-hatofes-gray">本日の累計消した列数</p>
                    <p className="font-display font-bold text-hatofes-white">
                      {todayStats.totalToday} <span className="text-xs text-hatofes-gray">/ {todayStats.maxToday}列</span>
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-hatofes-gray">
                  毎日0時リセット
                </div>
              </div>
            </div>
          )}

          {/* ── stats bar (responsive) ── */}
          <div className="tetris-status-card rounded-2xl border border-white/8 bg-hatofes-dark/72 p-3">
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([
                  ['スコア', ui.score.toLocaleString(), 'text-hatofes-white'],
                  ['ライン', String(ui.lines), 'text-hatofes-white'],
                  ['Lv', String(ui.level), 'text-hatofes-accent-yellow'],
                ] as const).map(([label, val, cls]) => (
                  <div key={label} className="rounded-xl border border-white/6 bg-hatofes-bg/80 px-3 py-3">
                    <p className="text-[10px] sm:text-xs text-hatofes-gray leading-tight">{label}</p>
                    <p className={`mt-1 font-display font-bold text-sm sm:text-lg ${cls}`}>{val}</p>
                  </div>
                ))}
              </div>
              <div className="tetris-preview-row flex items-start justify-center gap-3">
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-[10px] sm:text-xs tracking-[0.18em] text-hatofes-gray">HOLD</p>
                  <div className={`tetris-next-box tetris-preview-small sm:tetris-preview-normal ${G.current.holdUsed ? 'opacity-40' : ''}`}>
                    <canvas ref={holdRef} width={BS * 4} height={BS * 4} className="block tetris-preview-canvas" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-[10px] sm:text-xs tracking-[0.18em] text-hatofes-gray">NEXT</p>
                  <div className="tetris-next-box tetris-preview-small sm:tetris-preview-normal">
                    <canvas ref={nextRef} width={BS * 4} height={BS * 4} className="block tetris-preview-canvas" />
                  </div>
                </div>
              </div>
          </div>

          {/* ── field ── */}
          <div className="mt-3 flex justify-center">
              <div className="tetris-field-wrap relative">
                <canvas ref={fieldRef} width={FW * BS} height={FH * BS} className="block tetris-field-canvas" />
                {ui.ended && (
                  <div className="absolute inset-0 flex items-center justify-center p-4 bg-[rgba(10,10,30,0.82)] backdrop-blur-[2px]">
                    <div className="w-full max-w-[280px] rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-center shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
                      <p className="text-red-400 font-bold text-lg mb-2">GAME OVER</p>
                      <div className="flex justify-center gap-8 mb-2">
                        <div><p className="text-xs text-hatofes-gray">ライン</p><p className="font-display font-bold text-hatofes-white text-lg">{ui.lines}</p></div>
                        <div><p className="text-xs text-hatofes-gray">スコア</p><p className="font-display font-bold text-hatofes-white text-lg">{ui.score.toLocaleString()}</p></div>
                      </div>
                      {isStudent && reward === null && <p className="text-hatofes-gray text-xs mb-2">スコア送信中...</p>}
                      {isStudent && reward !== null && tetrisResult && (
                        <div className="mb-2">
                          <p className="text-hatofes-gray text-xs">
                            本日の累計: <span className="font-bold text-hatofes-white">{tetrisResult.totalToday}列</span> / {tetrisResult.maxToday}列
                          </p>
                          {tetrisResult.message && <p className="text-hatofes-accent-orange text-xs mt-1">{tetrisResult.message}</p>}
                          {reward === 0 && <p className="text-hatofes-gray text-xs mt-1">今回はポイント付与なし</p>}
                        </div>
                      )}
                      {!isStudent && <p className="text-hatofes-gray text-xs mb-2">ポイント付与は生徒ロールのみ対象です</p>}
                      {showRegisterButton && (
                        <div className="mb-3 pt-2 border-t border-hatofes-gray/20">
                          <p className="text-hatofes-gray text-xs mb-2">この記録をランキングに登録しますか？</p>
                          <button
                            onClick={handleRegisterRanking}
                            disabled={isRegistering}
                            className="btn-main px-6 py-2 bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange disabled:opacity-50"
                          >
                            {isRegistering ? '登録中...' : 'ランキングに登録する'}
                          </button>
                        </div>
                      )}
                      <button onClick={startGame} className="btn-main px-8 py-2">もう一度プレイ</button>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>

        {/* ── touch controls ── */}
        <div className="tetris-controls-wrap mt-4 sm:mt-5 flex justify-center px-2" style={{ touchAction: 'none' }}>
          <div className="tetris-pad-v2">
            {/* Row 1: Hold, Pause */}
            <div className="tetris-row-top">
              <button className="tetris-btn tetris-btn--hold"
                onPointerDown={e => { e.preventDefault(); doWithVibrate(doHold) }}>HOLD</button>
              <button className="tetris-btn tetris-btn--pause"
                onPointerDown={e => { e.preventDefault(); doWithVibrate(doPause) }}>{ui.paused ? '再開' : 'P'}</button>
            </div>
            {/* Row 2: Main controls */}
            <div className="tetris-row-main">
              <button className="tetris-btn"
                onPointerDown={e => { e.preventDefault(); startHold(doLeft) }}  onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>◀</button>
              <button className="tetris-btn"
                onPointerDown={e => { e.preventDefault(); startHold(doDown) }}  onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>▼</button>
              <button className="tetris-btn"
                onPointerDown={e => { e.preventDefault(); startHold(doRight) }} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>▶</button>
            </div>
            {/* Row 3: Rotations and Hard drop */}
            <div className="tetris-row-bottom">
              <button className="tetris-btn tetris-btn--rotccw"
                onPointerDown={e => { e.preventDefault(); doWithVibrate(doRotateCCW) }}>↺</button>
              <button className="tetris-btn tetris-btn--hard"
                onPointerDown={e => { e.preventDefault(); doWithVibrate(doHard) }}>⬇</button>
              <button className="tetris-btn tetris-btn--rot"
                onPointerDown={e => { e.preventDefault(); doWithVibrate(doRotate) }}>↻</button>
            </div>
          </div>
        </div>
          </>
        )}
      </main>

      {/* ── scoped styles ── */}
      <style>{`
        /* animated gradient border */
        .tetris-field-wrap {
          padding: 4px;
          border-radius: 18px;
          background: linear-gradient(135deg, #3a7bd5, #bf5fff, #00d4ff, #ff9f43);
          background-size: 300% 300%;
          animation: tetris-border 5s ease infinite;
          box-shadow:
            0 18px 34px rgba(0,0,0,0.28),
            0 0 0 1px rgba(255,255,255,0.08) inset,
            0 0 20px rgba(100,100,255,0.12);
          max-width: 100%;
          overflow: hidden;
        }
        @keyframes tetris-border {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .tetris-field-canvas {
          border-radius: 14px;
          display: block;
          max-width: 100%;
          height: auto;
        }

        /* next/hold preview box */
        .tetris-next-box {
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(20,20,40,0.96), rgba(11,11,24,0.96));
          box-shadow:
            0 8px 18px rgba(0,0,0,0.24),
            inset 0 1px 0 rgba(255,255,255,0.06);
        }

        /* Responsive preview sizes */
        .tetris-preview-small .tetris-preview-canvas {
          width: 40px !important;
          height: 40px !important;
        }
        @media (min-width: 640px) {
          .tetris-preview-normal .tetris-preview-canvas {
            width: 55px !important;
            height: 55px !important;
          }
        }

        @media (max-height: 740px) {
          .tetris-game-shell {
            padding: 10px;
          }
          .tetris-status-card {
            padding: 10px;
          }
          .tetris-preview-row {
            gap: 10px;
          }
          .tetris-field-canvas {
            width: 180px !important;
          }
          .tetris-preview-small .tetris-preview-canvas {
            width: 34px !important;
            height: 34px !important;
          }
          .tetris-controls-wrap {
            margin-top: 10px !important;
          }
          .tetris-pad-v2 {
            max-width: 240px;
            gap: 6px;
          }
          .tetris-btn {
            padding: 10px 0;
            font-size: 16px;
          }
          .tetris-btn--hold,
          .tetris-btn--pause {
            font-size: 10px;
          }
        }

        @media (max-height: 640px) {
          .tetris-field-canvas {
            width: 148px !important;
          }
          .tetris-pad-v2 {
            max-width: 220px;
          }
          .tetris-btn {
            padding: 8px 0;
            font-size: 15px;
            border-radius: 14px;
          }
          .tetris-preview-small .tetris-preview-canvas {
            width: 30px !important;
            height: 30px !important;
          }
        }

        /* touch pad layout v2 - responsive */
        .tetris-pad-v2 {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          max-width: 280px;
        }
        @media (min-width: 360px) {
          .tetris-pad-v2 { gap: 8px; }
        }
        .tetris-row-top {
          display: flex;
          gap: 8px;
          justify-content: space-between;
        }
        .tetris-row-main {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .tetris-row-bottom {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        /* base button - responsive */
        .tetris-btn {
          background: #171c22;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 12px 0;
          color: #f3f4f6;
          font-size: 18px;
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
          cursor: pointer;
          box-shadow:
            0 10px 20px rgba(0,0,0,0.28),
            inset 0 1px 0 rgba(255,255,255,0.05);
          transition: transform 0.07s, box-shadow 0.07s;
        }
        @media (min-width: 360px) {
          .tetris-btn {
            padding: 14px 0;
            font-size: 20px;
            border-radius: 14px;
          }
        }
        @media (min-width: 420px) {
          .tetris-btn {
            padding: 15px 0;
            font-size: 21px;
          }
        }
        .tetris-btn:active {
          transform: scale(0.94) translateY(2px);
          box-shadow: 0 5px 10px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.03);
        }

        /* rotate CW – cyan accent */
        .tetris-btn--rot {
          color: #00d4ff;
          border-color: rgba(0,212,255,0.22);
          box-shadow: 0 8px 18px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        /* rotate CCW – purple accent */
        .tetris-btn--rotccw {
          color: #bf5fff;
          border-color: rgba(191,95,255,0.22);
          box-shadow: 0 8px 18px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        /* hold – green accent */
        .tetris-btn--hold {
          flex: 1;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #4ade80;
          border-color: rgba(74,222,128,0.22);
          box-shadow: 0 8px 18px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        /* hard drop – gradient fire */
        .tetris-btn--hard {
          background: #f3f4f6;
          border-color: rgba(255,255,255,0.32);
          color: #11161a;
          font-weight: 700;
          font-size: 23px;
          box-shadow: 0 10px 22px rgba(0,0,0,0.22);
        }
        .tetris-btn--hard:active {
          background: #e5e7eb;
          box-shadow: 0 4px 10px rgba(0,0,0,0.18);
        }

        /* pause – subtle */
        .tetris-btn--pause {
          flex: 0 0 60px;
          font-size: 14px;
          font-weight: 700;
          color: #999;
          letter-spacing: 0.02em;
        }

        [data-theme="light"] .tetris-game-shell {
          background: var(--color-bg-secondary);
          border-color: var(--color-border-light);
          box-shadow: 0 18px 40px rgba(15,23,42,0.08);
        }

        [data-theme="light"] .tetris-status-card {
          background: var(--color-bg-card);
          border-color: var(--color-border-light);
        }

        [data-theme="light"] .tetris-status-card .text-hatofes-gray {
          color: var(--color-text-secondary) !important;
        }

        [data-theme="light"] .tetris-status-card .text-hatofes-white {
          color: var(--color-text-primary) !important;
        }

        [data-theme="light"] .tetris-status-card > div > div {
          background: var(--color-bg-elevated);
          border-color: var(--color-border-light);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45);
        }

        [data-theme="light"] .tetris-next-box {
          background: var(--color-bg-elevated);
          border-color: var(--color-border-light);
          box-shadow: 0 10px 22px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.5);
        }

        [data-theme="light"] .tetris-btn {
          background: var(--color-bg-card);
          color: var(--color-text-primary);
          border-color: var(--color-border-light);
          box-shadow: 0 10px 20px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.55);
        }

        [data-theme="light"] .tetris-btn--rot {
          color: #0891b2;
          border-color: rgba(8,145,178,0.24);
        }

        [data-theme="light"] .tetris-btn--rotccw {
          color: #9333ea;
          border-color: rgba(147,51,234,0.22);
        }

        [data-theme="light"] .tetris-btn--hold {
          color: #16a34a;
          border-color: rgba(22,163,74,0.22);
        }

        [data-theme="light"] .tetris-btn--pause {
          color: var(--color-text-secondary);
        }
      `}</style>
    </div>
  )
}
