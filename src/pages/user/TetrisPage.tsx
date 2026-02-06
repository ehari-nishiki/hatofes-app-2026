import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import app from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import { TetrisScore } from '@/types/firestore'

const fns = getFunctions(app)
const db = getFirestore(app)
const submitTetrisScoreFn = httpsCallable<
  { linesCleared: number; score: number },
  { success: boolean; pointsAwarded: number; totalToday: number; maxToday: number; message?: string }
>(fns, 'submitTetrisScore')

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
  const fieldRef     = useRef<HTMLCanvasElement>(null)
  const nextRef      = useRef<HTMLCanvasElement>(null)
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)
  const flashRef     = useRef<{ rows: number[]; time: number } | null>(null)
  const flashRafRef  = useRef<number | null>(null)

  const G = useRef({
    field: Array.from({ length: FH }, () => Array(FW).fill(BG)) as string[][],
    shape: null as TShape | null,
    rot: 0, x: 0, y: 0,
    next: null as TShape | null,
    score: 0, lines: 0, level: 1, speed: 650,
    ended: false, paused: false,
    timer: null as ReturnType<typeof setTimeout> | null,
    bag: [] as TShape[],
    bagIndex: 0,
  })

  const [ui, setUi]             = useState({ score: 0, lines: 0, level: 1, ended: false, paused: false })
  const [reward, setReward]     = useState<number | null>(null)
  const [showReward, setShowReward] = useState(false)
  const [rulesOpen, setRulesOpen]   = useState(false)
  const [rankingOpen, setRankingOpen]   = useState(false)
  const [tetrisResult, setTetrisResult] = useState<{ totalToday: number; maxToday: number; message?: string } | null>(null)
  const [rankings, setRankings] = useState<TetrisScore[]>([])

  const loopRef = useRef<() => void>(() => {})

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
    drawNext()
  }

  const lockAndClear = () => {
    const { shape, rot, x, y } = G.current; if (!shape) return
    let over = false
    for (const [bx, by] of pos(shape, rot, x, y)) {
      if (by < 0) { over = true; continue }
      if (bx >= 0 && bx < FW && by < FH) G.current.field[by][bx] = shape.color
    }
    if (over) { G.current.ended = true; setUi(p => ({ ...p, ended: true })); return }

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
      G.current.speed  = Math.max(100, 700 - G.current.level * 50)
      const pts = [0, 25, 100, 400, 1600]
      G.current.score += (pts[cleared] || 0) * G.current.level
      setUi(p => ({ ...p, score: G.current.score, lines: G.current.lines, level: G.current.level }))
    }
  }

  const doRotate = () => {
    const { shape, rot, x, y } = G.current
    if (!shape || G.current.ended || G.current.paused) return
    const nr = (rot + 1) % 4
    for (const k of [0, BS, -BS, BS * 2, -BS * 2])
      if (!hit(shape, nr, x + k, y)) { G.current.rot = nr; G.current.x = x + k; draw(); return }
  }
  const doLeft = () => {
    const { shape, rot, x, y } = G.current
    if (!shape || G.current.ended || G.current.paused) return
    if (!hit(shape, rot, x - BS, y)) { G.current.x -= BS; draw() }
  }
  const doRight = () => {
    const { shape, rot, x, y } = G.current
    if (!shape || G.current.ended || G.current.paused) return
    if (!hit(shape, rot, x + BS, y)) { G.current.x += BS; draw() }
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

  /* ── fetch rankings ── */
  const fetchRankings = async () => {
    try {
      const rankingsQuery = query(
        collection(db, 'tetrisScores'),
        orderBy('highScore', 'desc'),
        limit(10)
      )
      const snapshot = await getDocs(rankingsQuery)
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TetrisScore))
      setRankings(data)
    } catch (err) {
      console.error('ランキング取得エラー:', err)
    }
  }

  /* ── start / reset ── */
  const startGame = () => {
    if (G.current.timer) clearTimeout(G.current.timer)
    if (flashRafRef.current) cancelAnimationFrame(flashRafRef.current)
    flashRef.current = null; flashRafRef.current = null
    G.current.field  = Array.from({ length: FH }, () => Array(FW).fill(BG))
    G.current.score  = 0; G.current.lines = 0; G.current.level = 1
    G.current.speed  = 650; G.current.ended = false; G.current.paused = false
    G.current.bag = createBag(); G.current.bagIndex = 0
    const bagState = { bag: G.current.bag, index: G.current.bagIndex }
    G.current.next = pickFrom7Bag(bagState)
    G.current.bag = bagState.bag; G.current.bagIndex = bagState.index
    spawn(); draw(); drawNext()
    setUi({ score: 0, lines: 0, level: 1, ended: false, paused: false })
    setReward(null); setShowReward(false); setTetrisResult(null); submittedRef.current = false
    G.current.timer = setTimeout(() => loopRef.current(), G.current.speed)
  }

  /* ── mount ── */
  useEffect(() => {
    G.current.bag = createBag(); G.current.bagIndex = 0
    const bagState = { bag: G.current.bag, index: G.current.bagIndex }
    G.current.next = pickFrom7Bag(bagState)
    G.current.bag = bagState.bag; G.current.bagIndex = bagState.index
    spawn(); draw(); drawNext()
    G.current.timer = setTimeout(() => loopRef.current(), G.current.speed)
    fetchRankings()
    return () => {
      if (G.current.timer) clearTimeout(G.current.timer)
      if (holdTimerRef.current) clearInterval(holdTimerRef.current)
      if (flashRafRef.current) cancelAnimationFrame(flashRafRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* keyboard */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); doRotate(); break
        case 'ArrowLeft':  e.preventDefault(); doLeft();   break
        case 'ArrowRight': e.preventDefault(); doRight();  break
        case 'ArrowDown':  e.preventDefault(); doDown();   break
        case ' ':          e.preventDefault(); doHard();   break
        case 'p': case 'P': e.preventDefault(); doPause(); break
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* submit on game over */
  useEffect(() => {
    if (!ui.ended || submittedRef.current) return
    submittedRef.current = true
    submitTetrisScoreFn({ linesCleared: G.current.lines, score: G.current.score })
      .then(r => {
        setReward(r.data.pointsAwarded)
        setTetrisResult({ totalToday: r.data.totalToday, maxToday: r.data.maxToday, message: r.data.message })
        if (r.data.pointsAwarded > 0) setShowReward(true)
        // ランキングを更新
        fetchRankings()
      })
      .catch(() => { setReward(0); setTetrisResult(null) })
  }, [ui.ended])

  /* touch hold */
  const startHold = (fn: () => void) => { fn(); holdTimerRef.current = setInterval(fn, 80) }
  const stopHold  = () => { if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null } }

  /* ── render ── */
  if (!userData) return <div className="min-h-screen bg-hatofes-bg flex items-center justify-center text-hatofes-white">読み込み中...</div>

  const isStudent = userData.role === 'student'

  return (
    <div className="min-h-screen bg-hatofes-bg pb-8">
      <AppHeader username={userData.username} grade={userData.grade} classNumber={userData.class} />

      {showReward && reward !== null && reward > 0 && (
        <PointRewardModal isOpen={showReward} points={reward} reason="テトリスで獲得" onClose={() => setShowReward(false)} />
      )}

      <main className="max-w-lg mx-auto px-4 py-4">

        {/* page header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-hatofes-white flex items-center gap-2">
            <span>🧱</span> テトリス
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setRankingOpen(!rankingOpen)}
              className="text-xs text-hatofes-accent-orange flex items-center gap-1 px-2.5 py-1 rounded-lg border border-hatofes-accent-orange/30 hover:border-hatofes-accent-orange/60 transition-colors"
            >
              🏆 ランキング {rankingOpen ? '▲' : '▼'}
            </button>
            <button
              onClick={() => setRulesOpen(!rulesOpen)}
              className="text-xs text-hatofes-accent-yellow flex items-center gap-1 px-2.5 py-1 rounded-lg border border-hatofes-accent-yellow/30 hover:border-hatofes-accent-yellow/60 transition-colors"
            >
              ルール & 操作 {rulesOpen ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* ── ranking accordion ── */}
        {rankingOpen && (
          <section className="card mb-3 text-sm">
            <h3 className="font-bold text-hatofes-white mb-3 flex items-center gap-2"><span>🏆</span> ハイスコアランキング TOP10</h3>
            {rankings.length === 0 ? (
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
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-6 text-center">
                          {medal ? (
                            <span className="text-lg">{medal}</span>
                          ) : (
                            <span className="text-hatofes-gray font-bold text-sm">{idx + 1}</span>
                          )}
                        </div>
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

        {/* ── rules accordion ── */}
        {rulesOpen && (
          <section className="card mb-3 text-sm space-y-4">

            <div>
              <h3 className="font-bold text-hatofes-white mb-1.5 flex items-center gap-1.5"><span>🎮</span> 遊び方</h3>
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
              <h3 className="font-bold text-hatofes-white mb-2 flex items-center gap-1.5"><span>⌨️</span> 操作方法</h3>
              <div className="bg-hatofes-dark rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {[
                    ['◀ ▶', '左右移動'],
                    ['↻',   '回転'],
                    ['▼',   'ゆっくり下へ'],
                    ['⬇',   '急落下（スペース）'],
                    ['P',   'ポーズ / 再開'],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold text-hatofes-white ${key === '⬇' ? 'px-1.5 py-0.5 bg-hatofes-accent-orange/40' : 'w-6 h-5 bg-hatofes-gray/25'}`}>{key}</span>
                      <span className="text-hatofes-gray">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-hatofes-gray/50 text-xs pt-1 border-t border-hatofes-gray/20">
                  タッチ操作は画面下のボタンで行える
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-hatofes-white mb-2 flex items-center gap-1.5"><span>📊</span> スコア計算</h3>
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
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-hatofes-white mb-2 flex items-center gap-1.5"><span>🏆</span> 鳩ポイント報酬</h3>
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
                ※ 列数カウントは毎日0時にリセットされます
              </p>
            </div>
          </section>
        )}

        {/* ── stats bar ── */}
        <div className="card mb-2 py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-5">
              {([
                ['スコア', ui.score.toLocaleString(), 'text-hatofes-white'],
                ['ライン', String(ui.lines),          'text-hatofes-white'],
                ['レベル', String(ui.level),          'text-hatofes-accent-yellow'],
              ] as const).map(([label, val, cls]) => (
                <div key={label}>
                  <p className="text-xs text-hatofes-gray leading-tight">{label}</p>
                  <p className={`font-display font-bold text-sm ${cls}`}>{val}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-hatofes-gray">次</p>
              <div className="tetris-next-box">
                <canvas ref={nextRef} width={BS * 4} height={BS * 4} style={{ width: 66, height: 66 }} className="block" />
              </div>
            </div>
          </div>
        </div>

        {/* ── field ── */}
        <div className="flex justify-center">
          <div className="tetris-field-wrap">
            <canvas ref={fieldRef} width={FW * BS} height={FH * BS} className="block tetris-field-canvas" />
          </div>
        </div>

        {/* ── game over card ── */}
        {ui.ended && (
          <div className="card mt-3 text-center border border-red-500/25 bg-red-500/5">
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
            <button onClick={startGame} className="btn-main px-8 py-2">もう一度プレイ</button>
          </div>
        )}

        {/* ── touch controls ── */}
        <div className="mt-4 flex justify-center" style={{ touchAction: 'none' }}>
          <div className="tetris-pad">
            <button className="tetris-btn"
              onPointerDown={e => { e.preventDefault(); startHold(doLeft) }}  onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>◀</button>
            <button className="tetris-btn"
              onPointerDown={e => { e.preventDefault(); startHold(doDown) }}  onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>▼</button>
            <button className="tetris-btn"
              onPointerDown={e => { e.preventDefault(); startHold(doRight) }} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>▶</button>
            <button className="tetris-btn tetris-btn--rot"
              onPointerDown={e => { e.preventDefault(); doRotate() }}>↻</button>
            <button className="tetris-btn tetris-btn--hard"
              onPointerDown={e => { e.preventDefault(); doHard() }}>⬇</button>
            <button className="tetris-btn tetris-btn--pause"
              onPointerDown={e => { e.preventDefault(); doPause() }}>{ui.paused ? '再開' : 'ポーズ'}</button>
          </div>
        </div>

        {/* back */}
        <Link to="/home" className="block mt-5">
          <div className="btn-sub w-full py-3 text-center">ホームに戻る</div>
        </Link>
      </main>

      {/* ── scoped styles ── */}
      <style>{`
        /* animated gradient border */
        .tetris-field-wrap {
          padding: 3px;
          border-radius: 8px;
          background: linear-gradient(135deg, #3a7bd5, #bf5fff, #00d4ff, #ff9f43);
          background-size: 300% 300%;
          animation: tetris-border 5s ease infinite;
          box-shadow: 0 0 10px rgba(100,100,255,0.22);
        }
        @keyframes tetris-border {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .tetris-field-canvas { border-radius: 5px; display: block; }

        /* next preview box */
        .tetris-next-box {
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 6px;
          overflow: hidden;
          background: #141428;
        }

        /* touch pad layout */
        .tetris-pad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 228px;
        }

        /* base button */
        .tetris-btn {
          background: linear-gradient(160deg, #26263a 0%, #1a1a2a 100%);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 15px 0;
          color: #ddd;
          font-size: 21px;
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
          cursor: pointer;
          box-shadow: 0 3px 6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
          transition: transform 0.07s, box-shadow 0.07s;
        }
        .tetris-btn:active {
          transform: scale(0.90) translateY(2px);
          box-shadow: 0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
        }

        /* rotate – cyan accent */
        .tetris-btn--rot {
          color: #00d4ff;
          border-color: rgba(0,212,255,0.22);
          box-shadow: 0 3px 6px rgba(0,0,0,0.35), 0 0 8px rgba(0,212,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08);
        }

        /* hard drop – gradient fire */
        .tetris-btn--hard {
          background: linear-gradient(135deg, #FF4E00 0%, #FFC300 100%);
          border-color: transparent;
          color: #fff;
          font-weight: 700;
          font-size: 23px;
          box-shadow: 0 3px 10px rgba(255,78,0,0.4), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .tetris-btn--hard:active {
          background: linear-gradient(135deg, #e64500 0%, #e6b000 100%);
          box-shadow: 0 1px 4px rgba(255,78,0,0.3);
        }

        /* pause – subtle */
        .tetris-btn--pause {
          font-size: 11px;
          color: #999;
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  )
}
