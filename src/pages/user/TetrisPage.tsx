import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'

const fns = getFunctions(app)
const submitTetrisScoreFn = httpsCallable<
  { linesCleared: number },
  { success: boolean; pointsAwarded: number }
>(fns, 'submitTetrisScore')

/* ── Tetris engine constants ── */
const BS = 20, FW = 10, FH = 21, BG = '#202020'

interface TShape { rot: number[][][]; color: string }

const SHAPES: TShape[] = [
  { rot:[[[0,-1],[1,-1],[-1,0],[0,0]],[[0,-1],[0,0],[1,0],[1,1]],[[0,0],[1,0],[-1,1],[0,1]],[[-1,-1],[-1,0],[0,0],[0,1]]],color:'#3cb300'},
  { rot:[[[-1,-1],[0,-1],[0,0],[1,0]],[[1,-1],[0,0],[1,0],[0,1]],[[-1,0],[0,0],[0,1],[1,1]],[[0,-1],[0,0],[-1,0],[-1,1]]],color:'#e55050'},
  { rot:[[[-1,0],[0,0],[1,0],[2,0]],[[1,-1],[1,0],[1,1],[1,2]],[[-1,1],[0,1],[1,1],[2,1]],[[0,-1],[0,0],[0,1],[0,2]]],color:'#88b0e0'},
  { rot:[[[0,-1],[1,-1],[0,0],[1,0]],[[0,-1],[1,-1],[0,0],[1,0]],[[0,-1],[1,-1],[0,0],[1,0]],[[0,-1],[1,-1],[0,0],[1,0]]],color:'#fcca00'},
  { rot:[[[-1,-1],[-1,0],[0,0],[1,0]],[[1,-1],[0,-1],[0,0],[0,1]],[[-1,0],[0,0],[1,0],[1,1]],[[0,-1],[0,0],[0,1],[-1,1]]],color:'#1066de'},
  { rot:[[[1,-1],[-1,0],[0,0],[1,0]],[[0,-1],[0,0],[0,1],[1,1]],[[-1,0],[0,0],[1,0],[-1,1]],[[-1,-1],[0,-1],[0,0],[0,1]]],color:'#e07835'},
  { rot:[[[0,-1],[-1,0],[0,0],[1,0]],[[0,-1],[0,0],[1,0],[0,1]],[[-1,0],[0,0],[1,0],[0,1]],[[0,-1],[-1,0],[0,0],[0,1]]],color:'#705090'},
]

const pick = () => SHAPES[Math.floor(Math.random() * SHAPES.length)]

export default function TetrisPage() {
  const { userData } = useAuth()
  const fieldRef = useRef<HTMLCanvasElement>(null)
  const nextRef  = useRef<HTMLCanvasElement>(null)
  const holdRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)

  /* all mutable game state — read/written imperatively, no re-renders */
  const G = useRef({
    field: Array.from({ length: FH }, () => Array(FW).fill(BG)) as string[][],
    shape: null as TShape | null,
    rot: 0, x: 0, y: 0,
    next: null as TShape | null,
    score: 0, lines: 0, level: 1, speed: 650,
    ended: false, paused: false,
    timer: null as ReturnType<typeof setTimeout> | null,
  })

  const [ui, setUi] = useState({ score: 0, lines: 0, level: 1, ended: false, paused: false })
  const [reward, setReward] = useState<number | null>(null)

  /* loopRef: stable reference so setTimeout always invokes latest logic */
  const loopRef = useRef<() => void>(() => {})

  /* ── helpers ── */
  const pos = (s: TShape, r: number, px: number, py: number): [number,number][] =>
    s.rot[r].map(([dx,dy]): [number,number] => [
      Math.floor((px + dx*BS)/BS),
      Math.floor((py + dy*BS)/BS),
    ])

  const hit = (s: TShape, r: number, px: number, py: number): boolean => {
    for (const [bx,by] of pos(s, r, px, py)) {
      if (bx<0 || bx>=FW || by>=FH) return true
      if (by>=0 && G.current.field[by][bx]!==BG) return true
    }
    return false
  }

  const ghostY = (): number => {
    const {shape,rot,x,y} = G.current
    if (!shape) return 0
    let ty = y
    while (!hit(shape, rot, x, ty+BS)) ty += BS
    return ty
  }

  /* ── drawing ── */
  const draw = () => {
    const cv = fieldRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    const {field,shape,rot,x,y} = G.current

    for (let r=0; r<FH; r++)
      for (let c=0; c<FW; c++) {
        ctx.fillStyle = field[r][c]
        ctx.fillRect(c*BS, r*BS, BS, BS)
        if (field[r][c]!==BG) {
          ctx.strokeStyle=BG; ctx.lineWidth=1
          ctx.strokeRect(c*BS, r*BS, BS, BS)
        }
      }
    if (!shape) return

    // ghost
    const gy = ghostY()
    for (const [bx,by] of pos(shape,rot,x,gy)) if (by>=0) {
      ctx.fillStyle='rgba(255,255,255,0.08)'
      ctx.fillRect(bx*BS,by*BS,BS,BS)
      ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1
      ctx.strokeRect(bx*BS,by*BS,BS,BS)
    }
    // current
    for (const [bx,by] of pos(shape,rot,x,y)) if (by>=0) {
      ctx.fillStyle=shape.color
      ctx.fillRect(bx*BS,by*BS,BS,BS)
      ctx.strokeStyle=BG; ctx.lineWidth=1
      ctx.strokeRect(bx*BS,by*BS,BS,BS)
    }
  }

  const drawNext = () => {
    const cv = nextRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    ctx.fillStyle=BG; ctx.fillRect(0,0,BS*4,BS*4)
    const {next} = G.current; if (!next) return
    const ox=BS*1.5, oy=BS*2
    for (const [dx,dy] of next.rot[0]) {
      ctx.fillStyle=next.color
      ctx.fillRect(ox+dx*BS, oy+dy*BS, BS, BS)
      ctx.strokeStyle=BG; ctx.lineWidth=1
      ctx.strokeRect(ox+dx*BS, oy+dy*BS, BS, BS)
    }
  }

  const overlay = (text: string, color: string, sub?: string) => {
    const cv = fieldRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    ctx.fillStyle='rgba(0,0,0,0.82)'
    ctx.fillRect(0,0,FW*BS,FH*BS)
    ctx.textAlign='center'
    ctx.fillStyle=color; ctx.font='bold 18px sans-serif'
    ctx.fillText(text, FW*BS/2, FH*BS/2 - (sub?20:0))
    if (sub) { ctx.fillStyle='#aaa'; ctx.font='14px sans-serif'; ctx.fillText(sub, FW*BS/2, FH*BS/2+10) }
  }

  /* ── game actions ── */
  const spawn = () => {
    G.current.shape = G.current.next
    G.current.next  = pick()
    G.current.rot   = 0
    G.current.x     = (FW/2-1)*BS
    G.current.y     = -BS
    drawNext()
  }

  const lockAndClear = () => {
    const {shape,rot,x,y} = G.current; if (!shape) return
    let over = false
    for (const [bx,by] of pos(shape,rot,x,y)) {
      if (by<0) { over=true; continue }
      if (bx>=0 && bx<FW && by<FH) G.current.field[by][bx]=shape.color
    }
    if (over) { G.current.ended=true; setUi(p=>({...p,ended:true})); return }

    let cleared=0
    for (let r=FH-1; r>=0; r--) {
      if (G.current.field[r].every(c=>c!==BG)) {
        G.current.field.splice(r,1)
        G.current.field.unshift(Array(FW).fill(BG))
        cleared++; r++
      }
    }
    if (cleared>0) {
      G.current.lines += cleared
      G.current.level  = Math.floor(G.current.lines/10)+1
      G.current.speed  = Math.max(100, 700-G.current.level*50)
      const pts=[0,25,100,400,1600]
      G.current.score += (pts[cleared]||0)*(G.current.level+1)
      setUi(p=>({...p, score:G.current.score, lines:G.current.lines, level:G.current.level}))
    }
  }

  const doRotate = () => {
    const {shape,rot,x,y}=G.current
    if (!shape||G.current.ended||G.current.paused) return
    const nr=(rot+1)%4
    for (const k of [0,BS,-BS,BS*2,-BS*2])
      if (!hit(shape,nr,x+k,y)) { G.current.rot=nr; G.current.x=x+k; draw(); return }
  }
  const doLeft = () => {
    const {shape,rot,x,y}=G.current
    if (!shape||G.current.ended||G.current.paused) return
    if (!hit(shape,rot,x-BS,y)) { G.current.x-=BS; draw() }
  }
  const doRight = () => {
    const {shape,rot,x,y}=G.current
    if (!shape||G.current.ended||G.current.paused) return
    if (!hit(shape,rot,x+BS,y)) { G.current.x+=BS; draw() }
  }
  const doDown = () => {
    const {shape,rot,x,y}=G.current
    if (!shape||G.current.ended||G.current.paused) return
    if (!hit(shape,rot,x,y+BS)) G.current.y+=BS
    else { lockAndClear(); if (!G.current.ended) spawn() }
    draw()
  }
  const doHard = () => {
    if (!G.current.shape||G.current.ended||G.current.paused) return
    G.current.y = ghostY()
    lockAndClear()
    if (!G.current.ended) spawn()
    draw()
  }
  const doPause = () => {
    if (G.current.ended) return
    G.current.paused = !G.current.paused
    setUi(p=>({...p,paused:G.current.paused}))
    if (G.current.paused) overlay('ポーズ中','#FFC300')
    else draw()
  }

  /* ── game loop ── */
  loopRef.current = () => {
    if (G.current.ended) { overlay('ゲームオーバー','#e55050',`${G.current.lines}ライン / ${G.current.score.toLocaleString()}スコア`); return }
    if (!G.current.paused) {
      const {shape,rot,x,y}=G.current
      if (shape) {
        if (!hit(shape,rot,x,y+BS)) G.current.y+=BS
        else { lockAndClear(); if (!G.current.ended) spawn() }
        draw()
      }
    }
    G.current.timer = setTimeout(()=>loopRef.current(), G.current.speed)
  }

  /* ── start / reset ── */
  const startGame = () => {
    if (G.current.timer) clearTimeout(G.current.timer)
    G.current.field = Array.from({length:FH},()=>Array(FW).fill(BG))
    G.current.score=0; G.current.lines=0; G.current.level=1
    G.current.speed=650; G.current.ended=false; G.current.paused=false
    G.current.next = pick()
    spawn(); draw(); drawNext()
    setUi({score:0,lines:0,level:1,ended:false,paused:false})
    setReward(null); submittedRef.current=false
    G.current.timer = setTimeout(()=>loopRef.current(), G.current.speed)
  }

  /* ── mount ── */
  useEffect(() => {
    G.current.next = pick()
    spawn(); draw(); drawNext()
    G.current.timer = setTimeout(()=>loopRef.current(), G.current.speed)
    return () => {
      if (G.current.timer) clearTimeout(G.current.timer)
      if (holdRef.current) clearInterval(holdRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* keyboard */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      switch(e.key) {
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
    submitTetrisScoreFn({ linesCleared: G.current.lines })
      .then(r => setReward(r.data.pointsAwarded))
      .catch(() => setReward(0))
  }, [ui.ended])

  /* touch hold helpers */
  const startHold = (fn: ()=>void) => { fn(); holdRef.current=setInterval(fn,80) }
  const stopHold  = () => { if(holdRef.current){clearInterval(holdRef.current);holdRef.current=null} }

  /* ── render ── */
  if (!userData) return <div className="min-h-screen bg-hatofes-bg flex items-center justify-center text-hatofes-white">読み込み中...</div>

  if (userData.role !== 'student') {
    return (
      <div className="min-h-screen bg-hatofes-bg">
        <AppHeader username={userData.username} grade={userData.grade} classNumber={userData.class} />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className="text-hatofes-gray mb-4">生徒ロールのみ利用可能です</p>
          <Link to="/home" className="btn-sub inline-block px-6 py-2">ホームに戻る</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hatofes-bg pb-8">
      <AppHeader username={userData.username} grade={userData.grade} classNumber={userData.class} />
      <main className="max-w-lg mx-auto px-4 py-4">
        {/* stats */}
        <div className="card mb-3 flex items-center justify-between">
          <div className="flex gap-4">
            {[['スコア',ui.score.toLocaleString()],['ライン',String(ui.lines)],['レベル',String(ui.level)]].map(([label,val])=>(
              <div key={label}><p className="text-xs text-hatofes-gray">{label}</p><p className="font-display font-bold text-hatofes-white">{val}</p></div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-hatofes-gray">次</p>
            <canvas ref={nextRef} width={BS*4} height={BS*4} style={{width:BS*3,height:BS*3}} className="border border-hatofes-gray rounded" />
          </div>
        </div>

        {/* field */}
        <div className="flex justify-center">
          <canvas ref={fieldRef} width={FW*BS} height={FH*BS} className="border border-hatofes-gray rounded" style={{maxWidth:'100%'}} />
        </div>

        {/* game over card */}
        {ui.ended && (
          <div className="card mt-3 text-center">
            <p className="text-hatofes-white font-bold text-lg mb-1">ゲームオーバー</p>
            <p className="text-hatofes-gray text-sm mb-2">{ui.lines} ライン  /  {ui.score.toLocaleString()} スコア</p>
            {reward !== null && (
              <p className={`font-display font-bold text-lg mb-2 ${reward>0?'text-hatofes-accent-yellow':'text-hatofes-gray'}`}>
                {reward>0 ? `+${reward} pt 獲得！` : 'ポイント付与なし（0ライン）'}
              </p>
            )}
            {reward === null && <p className="text-hatofes-gray text-sm mb-2">スコア送信中...</p>}
            <button onClick={startGame} className="btn-main px-8 py-2">もう一度プレイ</button>
          </div>
        )}

        {/* touch controls */}
        <div className="mt-4 flex justify-center" style={{touchAction:'none'}}>
          <div className="grid grid-cols-3 gap-2" style={{width:220}}>
            <button className="bg-hatofes-dark border border-hatofes-gray rounded-xl py-4 text-hatofes-white text-2xl select-none active:bg-hatofes-gray-lighter"
              onPointerDown={e=>{e.preventDefault();startHold(doLeft)}}  onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>◀</button>
            <button className="bg-hatofes-dark border border-hatofes-gray rounded-xl py-4 text-hatofes-white text-2xl select-none active:bg-hatofes-gray-lighter"
              onPointerDown={e=>{e.preventDefault();startHold(doDown)}}   onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>▼</button>
            <button className="bg-hatofes-dark border border-hatofes-gray rounded-xl py-4 text-hatofes-white text-2xl select-none active:bg-hatofes-gray-lighter"
              onPointerDown={e=>{e.preventDefault();startHold(doRight)}}  onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>▶</button>
            <button className="bg-hatofes-dark border border-hatofes-gray rounded-xl py-4 text-hatofes-white text-xl select-none active:bg-hatofes-gray-lighter"
              onPointerDown={e=>{e.preventDefault();doRotate()}}>↻</button>
            <button className="rounded-xl py-4 text-white font-bold text-xl select-none active:opacity-70"
              style={{background:'linear-gradient(135deg,#FFC300,#FF4E00)'}}
              onPointerDown={e=>{e.preventDefault();doHard()}}>⬇</button>
            <button className="bg-hatofes-dark border border-hatofes-gray rounded-xl py-4 text-hatofes-gray text-sm select-none active:bg-hatofes-gray-lighter"
              onPointerDown={e=>{e.preventDefault();doPause()}}>{ui.paused?'再開':'ポーズ'}</button>
          </div>
        </div>

        <p className="text-center text-xs text-hatofes-gray mt-4">1ライン＝1ポイント（最大5pt/ゲーム）・生徒ロールのみ対象</p>

        <Link to="/home" className="block mt-4">
          <div className="btn-sub w-full py-3 text-center">ホームに戻る</div>
        </Link>
      </main>
    </div>
  )
}
