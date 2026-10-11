// dsh-johnny — 浏览器半区：钱、三通道召唤、拖拽喂鱼、模式提示。
//
// 三个通道（都只在"强尼模式开启"时生效——宿主 /dsh-johnny/status 轮询）：
//   ① 桌面暗号：鼠标「左左·右右」（两下左键两下右键，1.5s 窗口；暗号进行中接管右键菜单）
//   ② 手机：摇一摇（devicemotion 能量阈值，900ms 内两次命中；安卓连敲会触发双击缩放所以不用敲击）
//   ③ 输入框：强尼模式里在捕获层拦下每一条发送——「发钱」= 掉钱；其他内容 = 交给宿主"点单"
//      （宿主扣下问题 + 追加搪塞台词；只有付钱后的真回答才过一次模型）
//
// 钱拖到肥鱼身上（.dsh-pet-hit 的 getBoundingClientRect 判定）→
//   客户端同源调用 dsh-pet 的 /anim + /broadcast（鱼啃一口 + 说"TOKEN 的味道……"）→
//   POST /dsh-johnny/redeem 让宿主解锁真回答（真答案作为消息进入对话上下文）。
import { useEffect, useRef, useState } from 'react'

const ROUTE = '/dsh-johnny'
const MONEY_W = 92
const MONEY_H = 62
const FALLBACK = {
  words: ['发钱', '给钱', '付钱', '交钱', '小费'],
  pet: { base: '/dsh-pet-7340', id: 'main', anim: '余额-钱袋满溢', bubble: 'TOKEN 的味道……不错……', meme: '' },
}
const status = { active: false, words: FALLBACK.words, pet: FALLBACK.pet }
let uid = 0

/** 会话槽桥捕获到的最新输入面（供全局监听器使用）。 */
const composer = { sessionId: null, actions: null }

function isMoneyWord(text) {
  const t = String(text ?? '').replace(/[\s!！。.~～、，,]+$/u, '').trim()
  if (t === '') return false
  return status.words.includes(t)
}

/** 命中肥鱼：返回命中的矩形（含一点容差），未命中返回 null。 */
function fishHitAt(x, y) {
  const pad = 16
  const els = document.querySelectorAll('.dsh-pet-hit')
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) continue
    if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return r
  }
  return null
}

/** 清空输入框：优先用会话槽给的 inputActions.setDraft，兜底 execCommand。 */
function clearComposer(inputEl) {
  try {
    if (composer.actions !== null && typeof composer.actions.setDraft === 'function') {
      composer.actions.setDraft('')
      return
    }
  } catch {
    /* 兜底继续 */
  }
  try {
    inputEl.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(inputEl)
    sel.removeAllRanges()
    sel.addRange(range)
    document.execCommand('delete', false, null)
    sel.removeAllRanges()
  } catch {
    /* 清不掉就算了，钱至少出来了 */
  }
}

async function petCall(url, payload) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return r.json()
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ── 会话槽桥（无渲染）：捕获当前会话的 inputActions + sessionId ─────────────
function ComposerBridge(props) {
  useEffect(() => {
    const sid = props?.johnnySessionId ?? props?.sessionId
    if (typeof sid === 'string' && sid !== '') composer.sessionId = sid
    if (props?.inputActions) composer.actions = props.inputActions
  })
  return null
}

// ── 钱道具（自绘：一捆扎着纸带的钞票） ─────────────────────────────────────
function MoneySVG() {
  return (
    <svg viewBox="0 0 96 64" width="92" height="62" aria-hidden="true">
      <g transform="rotate(-8 48 32)">
        <rect x="12" y="20" width="72" height="32" rx="4" fill="#8fbe6d" stroke="#5c8a45" strokeWidth="1.5" />
      </g>
      <g transform="rotate(7 48 32)">
        <rect x="12" y="16" width="72" height="32" rx="4" fill="#9dcb7a" stroke="#5c8a45" strokeWidth="1.5" />
      </g>
      <rect x="12" y="12" width="72" height="36" rx="4" fill="#abd98a" stroke="#4e7d3a" strokeWidth="1.8" />
      <circle cx="48" cy="30" r="9.5" fill="none" stroke="#4e7d3a" strokeWidth="1.6" opacity="0.85" />
      <text x="48" y="34.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#3f6a2e" fontFamily="serif">¥</text>
      <circle cx="19" cy="19" r="2.2" fill="#4e7d3a" opacity="0.5" />
      <circle cx="77" cy="19" r="2.2" fill="#4e7d3a" opacity="0.5" />
      <circle cx="19" cy="41" r="2.2" fill="#4e7d3a" opacity="0.5" />
      <circle cx="77" cy="41" r="2.2" fill="#4e7d3a" opacity="0.5" />
      <rect x="35" y="10" width="26" height="40" rx="3" fill="#c98b4b" stroke="#9a6531" strokeWidth="1.4" />
      <rect x="40.5" y="10" width="2.6" height="40" fill="#b57a3d" opacity="0.75" />
      <rect x="53" y="10" width="2.6" height="40" fill="#b57a3d" opacity="0.75" />
    </svg>
  )
}

// ── 主浮层：钱 / 提示 / 模式徽标 / 三通道监听 ────────────────────────────────
function JohnnyOverlay() {
  const [items, setItems] = useState([])
  const [modeActive, setModeActive] = useState(false)
  const [toastText, setToastText] = useState('')
  const toastTimer = useRef(0)
  const hintShown = useRef(false)
  const seqRef = useRef([])
  const seqAt = useRef(0)
  const shakeRef = useRef({ prev: 0, hits: [], coolUntil: 0 })
  const posRef = useRef(new Map())

  const showToast = (text, ms = 2800) => {
    setToastText(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastText(''), ms)
  }

  const quitJohnny = async () => {
    try {
      const r = await fetch(`${ROUTE}/off`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(composer.sessionId !== null ? { sessionId: composer.sessionId } : {}),
      })
      const j = await r.json()
      if (j?.ok === true && j.disabled === true) {
        status.active = false
        setModeActive(false)
        showToast('强尼：行吧，收摊了。')
        return
      }
      if (j?.ok === true) showToast('强尼本来就没出摊。')
      else showToast(`收摊失败（${j?.code ?? '未知'}）。`)
    } catch {
      showToast('收摊失败：连不上宿主。')
    }
  }

  const updateItem = (id, patch) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it
      const next = { ...it, ...patch }
      if (typeof next.x === 'number' && typeof next.y === 'number') posRef.current.set(id, { x: next.x, y: next.y })
      return next
    }))
  }

  const removeItem = (id) => {
    posRef.current.delete(id)
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const spawnMoney = (cx, cy) => {
    setItems((prev) => {
      if (prev.length >= 4) return prev
      const x = Math.min(Math.max(8, cx - MONEY_W / 2), (window.innerWidth || 360) - MONEY_W - 8)
      const y = Math.min(Math.max(8, cy - MONEY_H / 2), (window.innerHeight || 640) - MONEY_H - 8)
      const id = ++uid
      posRef.current.set(id, { x, y })
      return [...prev, { id, x, y, phase: 'idle', over: false }]
    })
    if (!hintShown.current) {
      hintShown.current = true
      showToast('钱到手——把它拖到肥鱼身上。')
    }
  }

  const handleDrop = async (id, cx, cy) => {
    let hit = null
    try {
      hit = fishHitAt(cx, cy)
    } catch {
      hit = null
    }
    if (hit === null) {
      updateItem(id, { over: false })
      return
    }
    const back = posRef.current.get(id) ?? { x: cx, y: cy }
    const tx = Math.min(Math.max(0, hit.left + hit.width / 2 - MONEY_W / 2), (window.innerWidth || 360) - MONEY_W)
    const ty = Math.min(Math.max(0, hit.top + hit.height / 2 - MONEY_H / 2), (window.innerHeight || 640) - MONEY_H)
    updateItem(id, { phase: 'flying', over: false, x: tx, y: ty })

    // 先解锁（因果干净：没付成，鱼不动），成功后鱼才开吃
    let redeem = null
    try {
      const r = await fetch(`${ROUTE}/redeem`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(composer.sessionId !== null ? { sessionId: composer.sessionId } : {}),
      })
      redeem = await r.json()
    } catch {
      redeem = null
    }
    if (redeem === null || redeem.ok !== true) {
      updateItem(id, { phase: 'returning', x: back.x, y: back.y })
      setTimeout(() => updateItem(id, { phase: 'idle', over: false }), 520)
      if (redeem === null) showToast('交付失败：连不上宿主路由。')
      else if (redeem.code === 'not-in-mode') showToast('鱼只跟强尼做买卖——先输入 /johnny 进模式。')
      else showToast(`交付失败（${redeem.code ?? '未知'}）。`)
      return
    }

    // 鱼啃一口 + 说台词（同源调 dsh-pet；配图失败自动降级为纯文本）
    const pet = status.pet
    let petOk = false
    try {
      await petCall(`${pet.base}/anim?pet=${encodeURIComponent(pet.id)}`, { name: pet.anim })
      let j = await petCall(
        `${pet.base}/broadcast?pet=${encodeURIComponent(pet.id)}`,
        pet.meme ? { text: pet.bubble, image: pet.meme } : { text: pet.bubble },
      )
      if (j && j.ok === false && pet.meme) {
        j = await petCall(`${pet.base}/broadcast?pet=${encodeURIComponent(pet.id)}`, { text: pet.bubble })
      }
      petOk = !(j && j.ok === false)
    } catch {
      petOk = false
    }
    if (!petOk) showToast('鱼没吃到（接口没通），但账已付——真话马上到。')
    await sleep(260)
    removeItem(id)
  }

  const onPointerDown = (e, item) => {
    if (item.phase !== 'idle') return
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget
    const sx = e.clientX
    const sy = e.clientY
    const ox = item.x
    const oy = item.y
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* 指针捕获失败也能拖 */
    }
    const move = (ev) => {
      const nx = ox + (ev.clientX - sx)
      const ny = oy + (ev.clientY - sy)
      let over = false
      try {
        over = fishHitAt(ev.clientX, ev.clientY) !== null
      } catch {
        over = false
      }
      updateItem(item.id, { x: nx, y: ny, over })
    }
    const up = (ev) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      void handleDrop(item.id, ev.clientX ?? item.x + MONEY_W / 2, ev.clientY ?? item.y + MONEY_H / 2)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  // —— 状态轮询（宿主 status：是否处于强尼模式 + 词表 + 鱼配置） ——
  useEffect(() => {
    let alive = true
    const refresh = async () => {
      try {
        const r = await fetch(`${ROUTE}/status`)
        const j = await r.json()
        if (!alive || j?.ok !== true) return
        status.active = j.active === true
        if (Array.isArray(j.words) && j.words.length > 0) status.words = j.words
        if (j.pet && typeof j.pet === 'object') status.pet = { ...status.pet, ...j.pet }
        setModeActive(status.active)
      } catch {
        /* 宿主还没起来：保持现状 */
      }
    }
    void refresh()
    const t = setInterval(refresh, 4000)
    window.addEventListener('focus', refresh)
    return () => {
      alive = false
      clearInterval(t)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  // —— 通道一：桌面暗号（左左·右右） ——
  useEffect(() => {
    const onDown = (e) => {
      if (!status.active) return
      const now = performance.now()
      if (now - seqAt.current > 1500) seqRef.current = []
      seqAt.current = now
      const seq = seqRef.current
      seq.push(e.button)
      while (seq.length > 4) seq.shift()
      if (seq.length === 4 && seq[0] === 0 && seq[1] === 0 && seq[2] === 2 && seq[3] === 2) {
        seqRef.current = []
        spawnMoney(e.clientX, e.clientY)
      }
    }
    const onMenu = (e) => {
      if (!status.active) return
      const seq = seqRef.current
      // 暗号进行中（左左已敲、正敲右键）→ 接管右键菜单，别让它打断
      if (seq.length >= 3 && seq[0] === 0 && seq[1] === 0 && seq[2] === 2) e.preventDefault()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('contextmenu', onMenu, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('contextmenu', onMenu, true)
    }
  }, [])

  // —— 通道二：摇一摇 ——
  useEffect(() => {
    const onMotion = (e) => {
      if (!status.active) return
      const a = e.accelerationIncludingGravity
      if (!a) return
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2)
      const st = shakeRef.current
      const now = performance.now()
      if (now < st.coolUntil) {
        st.prev = mag
        return
      }
      const delta = Math.abs(mag - st.prev)
      st.prev = mag
      if (delta > 16) {
        st.hits = st.hits.filter((t) => now - t < 900)
        st.hits.push(now)
        if (st.hits.length >= 2) {
          st.hits = []
          st.coolUntil = now + 1800
          spawnMoney((window.innerWidth || 360) / 2, (window.innerHeight || 640) * 0.6)
        }
      }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [])

  // —— 通道三：输入框拦截（Enter 与发送按钮两条路，捕获层；仅强尼模式生效） ——
  useEffect(() => {
    const restoreDraft = (text) => {
      try {
        if (composer.actions !== null && typeof composer.actions.setDraft === 'function') composer.actions.setDraft(text)
      } catch {
        /* 恢复失败就算了 */
      }
    }
    const askJohnny = async (text) => {
      try {
        const r = await fetch(`${ROUTE}/ask`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(composer.sessionId !== null ? { sessionId: composer.sessionId, text } : { text }),
        })
        const j = await r.json()
        if (j?.ok === true) {
          // 扣下时给鱼一点反应：动一下 + 气泡飘一句（失败静默，不挡流程）
          const pet = status.pet
          if (typeof j.anim === 'string' && j.anim !== '') {
            petCall(`${pet.base}/anim?pet=${encodeURIComponent(pet.id)}`, { name: j.anim }).catch(() => {})
          }
          if (typeof j.bubble === 'string' && j.bubble !== '') {
            petCall(`${pet.base}/broadcast?pet=${encodeURIComponent(pet.id)}`, { text: j.bubble }).catch(() => {})
          }
          return
        }
        restoreDraft(text)
        if (j?.code === 'not-in-mode') showToast('这个会话不在强尼模式——先输入 /johnny。')
        else showToast(`强尼没收下（${j?.code ?? '未知'}）。`)
      } catch {
        restoreDraft(text)
        showToast('发不出去：连不上宿主。')
      }
    }
    const intercept = (inputEl) => {
      const t = String(inputEl.textContent ?? '').trim()
      if (t === '' || t.startsWith('/')) return false
      clearComposer(inputEl)
      if (isMoneyWord(t)) {
        spawnMoney((window.innerWidth || 360) / 2, (window.innerHeight || 640) * 0.62)
      } else {
        void askJohnny(t)
      }
      return true
    }
    const onKey = (e) => {
      if (!status.active) return
      if (e.key !== 'Enter' || e.shiftKey || e.repeat || e.isComposing || e.keyCode === 229) return
      const t = e.target
      const inputEl = t && t.closest ? t.closest('[data-composer-input]') : null
      if (inputEl === null || inputEl === undefined) return
      if (intercept(inputEl)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      }
    }
    const onClick = (e) => {
      if (!status.active) return
      const t = e.target
      const card = t && t.closest ? t.closest('[data-composer-card]') : null
      if (card === null || card === undefined) return
      const btn = t.closest('button')
      if (btn === null || btn === undefined) return
      const label = String(btn.getAttribute('aria-label') ?? '').toLowerCase()
      const isSend = label.includes('发送') || label.includes('send') || label.includes('queue') || label.includes('steer')
      if (!isSend) return
      const inputEl = card.querySelector('[data-composer-input]')
      if (inputEl === null) return
      if (intercept(inputEl)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      }
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  return (
    <div className="dsh-johnny-layer">
      {modeActive ? (
        <div className="dsh-johnny-chipgroup">
          <button
            type="button"
            className="dsh-johnny-chip"
            title="强尼模式已开启"
            onClick={() => showToast('敲钱三式：桌面=鼠标左左·右右；手机=摇一摇；或输入「发钱」。钱拖给肥鱼。')}
          >
            强尼模式
          </button>
          <button type="button" className="dsh-johnny-quit" title="退出强尼模式" onClick={quitJohnny}>
            ×
          </button>
        </div>
      ) : null}
      {items.map((it) => (
        <div
          key={it.id}
          className={
            'dsh-johnny-money'
            + (it.phase === 'flying' ? ' is-flying' : '')
            + (it.phase === 'returning' ? ' is-returning' : '')
            + (it.over ? ' is-over' : '')
          }
          style={{ transform: `translate3d(${it.x}px, ${it.y}px, 0)` }}
          onPointerDown={(e) => onPointerDown(e, it)}
        >
          <MoneySVG />
        </div>
      ))}
      {toastText !== '' ? <div className="dsh-johnny-toast">{toastText}</div> : null}
    </div>
  )
}

// ── 样式（注入一次） ─────────────────────────────────────────────────────
const CSS = `
.dsh-johnny-layer{position:fixed;inset:0;pointer-events:none;z-index:12000}
.dsh-johnny-money{position:absolute;left:0;top:0;width:92px;height:62px;pointer-events:auto;touch-action:none;
  cursor:grab;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 10px rgba(0,0,0,.28));will-change:transform}
.dsh-johnny-money.is-over{filter:drop-shadow(0 8px 14px rgba(0,0,0,.32)) drop-shadow(0 0 12px rgba(255,200,60,.9))}
.dsh-johnny-money.is-flying{pointer-events:none;transition:transform .45s cubic-bezier(.5,-.2,.7,1.2),opacity .45s ease;opacity:.15}
.dsh-johnny-money.is-returning{transition:transform .5s ease}
.dsh-johnny-chipgroup{position:fixed;left:12px;bottom:14px;display:flex;align-items:center;gap:6px;pointer-events:auto}
.dsh-johnny-chip{height:26px;padding:0 10px;border-radius:13px;border:1px solid rgba(200,150,40,.55);
  background:rgba(255,246,220,.92);color:#8a5a12;font-size:12px;cursor:pointer}
.dsh-johnny-quit{width:22px;height:22px;padding:0;border-radius:50%;border:1px solid rgba(209,36,47,.65);
  background:rgba(209,36,47,.94);color:#fff;font-size:14px;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center}
.dsh-johnny-toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);max-width:86vw;padding:8px 14px;
  border-radius:10px;background:rgba(28,32,40,.92);color:#fff;font-size:13px;pointer-events:none;white-space:pre-wrap}
`

// ── 插件体 ───────────────────────────────────────────────────────────────
const inject = ['slots']

async function apply(ctx) {
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.id = 'dsh-johnny-style'
    tag.dataset.plugin = 'dsh-johnny'
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => tag.remove()
  }, 'dsh-johnny: styles')

  // 主浮层（钱 / 提示 / 徽标 / 三通道监听）
  ctx.slots.inject('shell.overlay', () => {
    const dispose = ctx.slots.register({ name: 'shell.overlay', id: 'johnny', order: 900 }, JohnnyOverlay)
    return () => dispose()
  })

  // 会话桥：捕获输入面动作（清空输入框用）与当前会话 id
  ctx.slots.inject('conversation.input.dock', () => {
    const dispose = ctx.slots.register(
      {
        name: 'conversation.input.dock',
        id: 'johnny-bridge',
        order: 90,
        inject: (sessionId) => ({ johnnySessionId: sessionId }),
      },
      ComposerBridge,
    )
    return () => dispose()
  })
}

export { apply, inject }
