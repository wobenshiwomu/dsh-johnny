/**
 * dsh-johnny — 万事通强尼：没收到钱就装傻，钱到位全说。
 *
 * 一个"付费问答"活报剧插件（联动 dsh-pet 大肥鱼）：
 *  - `/johnny` 进强尼模式；
 *  - 模式里客户端半区在捕获层拦下用户的每一条发送：「发钱」= 掉钱；
 *    其他内容 = "点单"——POST /dsh-johnny/ask，宿主把问题与强尼的
 *    搪塞台词（「有可能知道，有可能不知道。」）用 surfaceOp:'append'
 *    写进会话（回合外追加，不惊动模型、零 token）；
 *  - 把钱拖到肥鱼身上：客户端点播 dsh-pet 动画 + 投喂气泡文案，再调用
 *    POST /dsh-johnny/redeem——宿主把"被扣下的问题"连同【鱼已收钱】标记
 *    用 agent.followup 投给一轮真回答，真答案作为消息进入对话上下文
 *    （气泡是收据，上下文是本体）。
 *
 * 机制基础（rc.2 实测）：
 *  - 回合外追加走 `session.append(type, message, { surfaceOp: 'append' })`
 *    （dsh-tide 同款，E2E 实测"不需要 surfaceOp marker"会报错的口径）。
 *  - 解锁走 `ctx.sessionController.resolveAgent(sid)` → `agent.followup(createUserMessage…)`
 *    → `ctx.sessions.flush(session)`（dsh-tide 已跑通的范式；对冷会话也会 resume）。
 *  - 为什么不让模型"演强尼"：真机实测模型会把"装傻要钱"人设判为操纵性/注入而拒绝
 *    出演（无论怎么换框）。因此装傻台词走本插件的确定性台词池——不发模型、
 *    效果稳定；只有付钱后的真回答才过一次模型（那是正常请求，无合规摩擦）。
 *
 * @module dsh-johnny
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import Schema from '@deepseek-ai/schemastery'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands/brand'

export const name = 'dsh-johnny'
// webServer 不放进顶层 inject：headless 等没有 web 服务的几何下，
// 强依赖会让插件卡 pending（dsh-bite 实测教训）。路由就绪后再挂。
export const inject = ['commands']

export const Config = Schema.object({
  bubbleText: Schema.string().default('TOKEN 的味道……不错……').description('钱被吃掉后，肥鱼气泡里的文案'),
  bubbleMeme: Schema.string().default('').description('可选：气泡配图（dsh-pet 表情包名，如「吃饱饱摸肚子」；留空=不带图）'),
  eatAnim: Schema.string().default('余额-钱袋满溢').description('钱被吃掉时点播的动画名（dsh-pet 动画池）'),
  petId: Schema.string().default('main').description('dsh-pet 的宠物 id'),
  petBase: Schema.string().default('/dsh-pet-7340').description('dsh-pet 接口前缀（客户端同源调用）'),
  moneyWords: Schema.array(Schema.string()).default(['发钱', '给钱', '付钱', '交钱', '小费']).description('输入框召唤钱的词表（发送时被拦下，不发给模型、不花 token）'),
  askBubbleText: Schema.string().default('有可能知道，有可能不知道。').description('扣下问题时，肥鱼气泡里飘的内容（留空=不冒泡）'),
  askAnim: Schema.string().default('工作状态-思考冒泡').description('扣下问题时点播的动画（留空=不动）'),
  storageDir: Schema.string().default('').description('状态存储目录（默认 $DSH_HOME/storages/dsh-johnny）'),
})

export const SOURCE_KIND = 'dsh-johnny'
export const ROUTE_PREFIX = '/dsh-johnny'
/** 强尼的招牌搪塞（每问一次就这一句——他每次都说同一句，就是笑点）。 */
export const COY_LINE = '〔强尼〕有可能知道，有可能不知道。'
const STATE_VERSION = 1
const KEEP_MS = 14 * 24 * 3600 * 1000

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 移除 undefined 字段：会话日志要求无损 JSON。 */
function cleanMeta(meta) {
  const out = {}
  for (const [key, value] of Object.entries(meta ?? {})) {
    if (value !== undefined) out[key] = value
  }
  return out
}

/** johnny 注入消息的 source（question=被扣的问题 / reply=搪塞台词 / paid=收钱解锁）。 */
function johnnySource(subtype, meta) {
  return { kind: SOURCE_KIND, subtype, johnny: cleanMeta(meta) }
}

/** 解锁指令：把"被扣下的问题"捎上，让模型正常回答（无任何角色扮演要求）。 */
function buildPaidText(question) {
  return [
    '〔鱼已收钱〕游戏里钱到位了——表演结束，出戏。',
    '请如实、完整地回答这个问题（要能脱离本次对话单独看懂）：',
    '',
    question,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// 主体
// ---------------------------------------------------------------------------

export function createJohnny({ ctx, config, deps = {} }) {
  const fsImpl = deps.fs ?? fs
  const env = deps.env ?? process.env
  const homeDir = deps.homeDir ?? os.homedir()

  const storageDir = config.storageDir !== '' && config.storageDir !== undefined
    ? config.storageDir
    : path.join(env.DSH_HOME ?? path.join(homeDir, '.dsh'), 'storages', 'dsh-johnny')
  const stateFile = path.join(storageDir, 'state.json')

  /** 懒注入的服务：sessions / sessionController（ask 追加与 redeem 解锁用）。 */
  let svc = {}

  /** sessionId → { enabledAt }：处于强尼模式的会话。 */
  const enabled = new Map()
  /** sessionId → lastSeenAt：用于"最近活跃会话"兜底挑选。 */
  const activity = new Map()
  /** sessionId → { text, at }：被强尼扣下、等待赎身的问题。 */
  const pending = new Map()

  // —— 状态持久化（跨重启可读；tmp + rename 原子替换） ——

  function loadState() {
    try {
      const data = JSON.parse(fsImpl.readFileSync(stateFile, 'utf8'))
      const sessions = data?.sessions && typeof data.sessions === 'object' ? data.sessions : {}
      const nowMs = Date.now()
      const entries = Object.entries(sessions)
        .filter(([, v]) => typeof v?.enabledAt === 'number' && nowMs - v.enabledAt < KEEP_MS)
        .sort((a, b) => b[1].enabledAt - a[1].enabledAt)
        .slice(0, 100)
      for (const [sid, v] of entries) enabled.set(sid, { enabledAt: v.enabledAt })
    } catch {
      /* 无状态或已损坏：从零开始 */
    }
  }

  function saveState() {
    try {
      fsImpl.mkdirSync(storageDir, { recursive: true })
      const sessions = {}
      for (const [sid, v] of enabled) sessions[sid] = { enabledAt: v.enabledAt }
      const tmp = `${stateFile}.tmp`
      fsImpl.writeFileSync(tmp, JSON.stringify({ version: STATE_VERSION, sessions }, null, 2))
      fsImpl.renameSync(tmp, stateFile)
      return true
    } catch (error) {
      ctx.logger.warn(`[dsh-johnny] 状态落盘失败: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  function setEnabled(sid, on) {
    if (on) {
      enabled.set(sid, { enabledAt: Date.now() })
    } else {
      enabled.delete(sid)
      pending.delete(sid)
    }
    saveState()
  }

  function isEnabled(sid) {
    return typeof sid === 'string' && enabled.has(sid)
  }

  /**
   * 挑一个目标会话：给了 id 就严格用它（不在模式 → null）；
   * 没给就取"最近活跃的已启用会话"。
   */
  function pickSession(preferred) {
    if (typeof preferred === 'string' && preferred !== '') return enabled.has(preferred) ? preferred : null
    let best = null
    let bestScore = -Infinity
    for (const [sid, info] of enabled) {
      const score = Math.max(activity.get(sid) ?? 0, info.enabledAt ?? 0)
      if (score > bestScore) {
        best = sid
        bestScore = score
      }
    }
    return best
  }

  // —— 回合外追加（surfaceOp:'append'，dsh-tide 同款） ——

  function appendJohnny(session, subtype, text, meta) {
    try {
      session.append(
        'user/message',
        createUserMessage({ content: [{ type: 'text', text }], source: johnnySource(subtype, meta) }),
        { surfaceOp: 'append' },
      )
      return true
    } catch (error) {
      ctx.logger.warn(`[dsh-johnny] 追加失败(${subtype}): ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  // —— 点单（ask）：扣下问题 + 搪塞台词，双双写进会话（不惊动模型） ——

  async function ask(preferredSession, text) {
    const sid = pickSession(preferredSession)
    if (sid === null) return { ok: false, code: 'not-in-mode' }
    const question = String(text ?? '').trim()
    if (question === '') return { ok: false, code: 'empty' }
    if (svc.sessionController === undefined) return { ok: false, code: 'no-controller' }
    let resolved
    try {
      resolved = await svc.sessionController.resolveAgent(sid)
    } catch (error) {
      ctx.logger.warn(`[dsh-johnny] ask resolveAgent 失败: ${error instanceof Error ? error.message : String(error)}`)
      return { ok: false, code: 'resolve-failed' }
    }
    const session = resolved?.agent?.session
    if (session === undefined) return { ok: false, code: 'resolve-failed' }
    const at = Date.now()
    const qOk = appendJohnny(session, 'question', question, { at })
    const rOk = appendJohnny(session, 'reply', COY_LINE, { at })
    if (!qOk && !rOk) return { ok: false, code: 'append-failed' }
    pending.set(sid, { text: question, at })
    activity.set(sid, Date.now())
    ctx.logger.info(`[dsh-johnny] 扣下一条问题 session=${sid}`)
    return { ok: true, sessionId: sid, bubble: config.askBubbleText ?? '', anim: config.askAnim ?? '' }
  }

  // —— 解锁（redeem）：把被扣的问题捎给一轮真回答 ——

  async function redeem(preferredSession) {
    const sid = pickSession(preferredSession)
    if (sid === null) return { ok: false, code: 'not-in-mode' }
    const pend = pending.get(sid)
    if (pend === undefined) return { ok: false, code: 'no-question' }
    if (svc.sessionController === undefined) return { ok: false, code: 'no-controller' }
    let resolved
    try {
      resolved = await svc.sessionController.resolveAgent(sid)
    } catch (error) {
      ctx.logger.warn(`[dsh-johnny] resolveAgent 失败: ${error instanceof Error ? error.message : String(error)}`)
      return { ok: false, code: 'resolve-failed' }
    }
    const agent = resolved?.agent
    if (agent === undefined) return { ok: false, code: 'resolve-failed' }
    try {
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: buildPaidText(pend.text) }],
        source: johnnySource('paid', { at: Date.now(), sessionId: sid }),
      }))
      if (svc.sessions !== undefined && typeof svc.sessions.flush === 'function') {
        await svc.sessions.flush(agent.session)
      }
      pending.delete(sid)
      activity.set(sid, Date.now())
      ctx.logger.info(`[dsh-johnny] 已收钱，解锁真话 session=${sid}`)
      return { ok: true, sessionId: sid }
    } catch (error) {
      ctx.logger.warn(`[dsh-johnny] followup 失败: ${error instanceof Error ? error.message : String(error)}`)
      return { ok: false, code: 'followup-failed' }
    }
  }

  // —— HTTP 路由（客户端半区同源调用；本机 localhost，无鉴权，同 dsh-pet 惯例） ——

  function sendJson(res, statusCode, payload) {
    try {
      res.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(JSON.stringify(payload))
    } catch {
      try {
        res.writeHead(500)
        res.end()
      } catch {
        /* 连接已断 */
      }
    }
  }

  function readBody(req, limit = 65536) {
    return new Promise((resolve, reject) => {
      let size = 0
      const chunks = []
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > limit) {
          reject(new Error('body too large'))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  }

  function statusPayload() {
    return {
      ok: true,
      active: enabled.size > 0,
      sessions: [...enabled.keys()],
      words: Array.isArray(config.moneyWords) && config.moneyWords.length > 0 ? config.moneyWords : ['发钱'],
      pet: {
        base: config.petBase,
        id: config.petId,
        anim: config.eatAnim,
        bubble: config.bubbleText,
        meme: config.bubbleMeme,
      },
    }
  }

  async function routeHandler(req, res) {
    try {
      const url = new URL(req.url ?? ROUTE_PREFIX, 'http://localhost')
      const route = url.pathname

      if (route === `${ROUTE_PREFIX}/status` && req.method === 'GET') {
        return sendJson(res, 200, statusPayload())
      }

      if (route === `${ROUTE_PREFIX}/ask` && req.method === 'POST') {
        let body
        try {
          body = JSON.parse((await readBody(req)) || '{}')
        } catch {
          return sendJson(res, 400, { ok: false, code: 'bad-json' })
        }
        const result = await ask(
          typeof body?.sessionId === 'string' ? body.sessionId : undefined,
          typeof body?.text === 'string' ? body.text : '',
        )
        return sendJson(res, 200, result)
      }

      if (route === `${ROUTE_PREFIX}/redeem` && req.method === 'POST') {
        let body
        try {
          body = JSON.parse((await readBody(req)) || '{}')
        } catch {
          return sendJson(res, 400, { ok: false, code: 'bad-json' })
        }
        const result = await redeem(typeof body?.sessionId === 'string' ? body.sessionId : undefined)
        return sendJson(res, 200, result)
      }

      if (route === `${ROUTE_PREFIX}/off` && req.method === 'POST') {
        let body
        try {
          body = JSON.parse((await readBody(req)) || '{}')
        } catch {
          return sendJson(res, 400, { ok: false, code: 'bad-json' })
        }
        const preferred = typeof body?.sessionId === 'string' ? body.sessionId : undefined
        const sid = typeof preferred === 'string' && preferred !== '' && enabled.has(preferred)
          ? preferred
          : pickSession(undefined)
        if (sid === null) return sendJson(res, 200, { ok: true, disabled: false })
        setEnabled(sid, false)
        ctx.logger.info(`[dsh-johnny] 快速收摊 session=${sid}`)
        return sendJson(res, 200, { ok: true, sessionId: sid, disabled: true })
      }

      if (route === `${ROUTE_PREFIX}/health` && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, name: SOURCE_KIND, enabledSessions: enabled.size, pending: pending.size })
      }

      return sendJson(res, 404, { ok: false, code: 'not-found' })
    } catch (error) {
      ctx.logger.warn(`[dsh-johnny] 路由失败: ${error instanceof Error ? error.message : String(error)}`)
      return sendJson(res, 500, { ok: false, code: 'internal' })
    }
  }

  // —— 斜杠命令 ——

  function cmdJohnny(invocation) {
    const session = invocation?.agent?.session
    const sid = session?.id
    if (typeof sid !== 'string' || sid === '') {
      return { kind: 'error', text: 'johnny：没有活跃会话，这摊摆不了。' }
    }
    if (enabled.has(sid)) {
      setEnabled(sid, false)
      return { kind: 'success', text: '强尼：行吧，收摊了——强尼模式已退出，他恢复正常说话了。' }
    }
    setEnabled(sid, true)
    activity.set(sid, Date.now())
    return {
      kind: 'success',
      text: [
        '强尼：出摊了。你问吧——丑话说前头：我这人，认钱。',
        '（模式里你的话都会被扣下，他只回你一句「有可能知道，有可能不知道」。想让他全说：桌面=鼠标左左·右右，手机=摇一摇，或输入框打「发钱」——再把钱拖给肥鱼。退出=再敲一次 /johnny。）',
      ].join('\n'),
    }
  }

  // —— 装配 ——

  function start() {
    loadState()

    // HTTP 路由 —— webServer 可选：headless 等几何下不存在，跳过即可
    try {
      ctx.inject(['webServer'], (scoped) => {
        scoped.effect(() => {
          const dispose = scoped.webServer.register({
            kind: 'prefix',
            path: ROUTE_PREFIX,
            handler: routeHandler,
          })
          return dispose
        }, 'dsh-johnny: routes')
      })
    } catch (error) {
      ctx.logger.warn(`[dsh-johnny] 路由注册失败（无 web 服务时忽略）: ${error instanceof Error ? error.message : String(error)}`)
    }

    // 斜杠命令
    ctx.effect(function* () {
      yield ctx.commands.register({
        definitionId: CommandDefinitionId('dsh-johnny/johnny'),
        name: 'johnny',
        description: 'johnny：切换强尼模式（没收到钱只装傻，钱到位全说）',
        handler: cmdJohnny,
      })
    }, 'dsh-johnny: commands')

    // 懒注入服务（ask 追加与 redeem 解锁用）
    try {
      ctx.inject(['sessions', 'sessionController'], (scoped) => {
        svc = {
          sessions: scoped.sessions,
          sessionController: scoped.sessionController,
        }
      })
    } catch (error) {
      ctx.logger.warn(`[dsh-johnny] 服务注入失败: ${error instanceof Error ? error.message : String(error)}`)
    }

    ctx.effect(() => {
      const words = Array.isArray(config.moneyWords) ? config.moneyWords.join('/') : '?'
      const banner = `[dsh-johnny] 已加载（模式会话 ${enabled.size}，宠物 ${config.petId}@${config.petBase}，词表 ${words}）`
      ctx.logger.info(banner)
      console.log(banner)
      return () => ctx.logger.info('[dsh-johnny] 已卸载')
    })
  }

  return {
    start,
    // 测试与调试入口
    _enabled: enabled,
    _isEnabled: isEnabled,
    _setEnabled: setEnabled,
    _activity: activity,
    _pending: pending,
    _cmdJohnny: cmdJohnny,
    _ask: ask,
    _redeem: redeem,
    _route: routeHandler,
    _status: statusPayload,
    _loadState: loadState,
    _saveState: saveState,
    _pickSession: pickSession,
    _storageDir: storageDir,
  }
}

export function apply(ctx, config) {
  const rt = createJohnny({ ctx, config })
  rt.start()
  return rt
}
