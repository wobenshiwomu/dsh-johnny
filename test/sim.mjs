/**
 * dsh-johnny 仿真测试台（v2：拦截式装傻）
 *
 * 假 ctx 驱动：①装配（命令/路由/banner）②模式开关与持久化（落盘/跨实例/过期剪除）
 * ③点单 ask（扣问题 + 搪塞台词双双 append、严格会话匹配、空文本/失败分支）
 * ④redeem 解锁（no-question/paid 载荷带问题/pending 清空/最近活跃挑选）
 * ⑤HTTP 路由（status/ask/redeem/health/坏 JSON/404）⑥配置透传
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createJohnny, SOURCE_KIND, ROUTE_PREFIX, COY_LINE } from '../src/index.mjs'

let passed = 0
const log = (...a) => console.log(...a)
function group(name) {
  log(`\n═══ ${name}`)
}
function ok(msg) {
  passed++
  log(`  ✓ ${msg}`)
}
function eq(msg, a, b) {
  assert.equal(a, b, msg)
  ok(msg)
}
function okIf(msg, cond) {
  assert.ok(cond, msg)
  ok(msg)
}

function makeReq({ method = 'GET', url = `${ROUTE_PREFIX}/health`, body = '' } = {}) {
  const req = { method, url, _l: {} }
  req.on = (ev, cb) => {
    req._l[ev] = cb
    return req
  }
  setImmediate(() => {
    if (body !== '' && req._l.data) req._l.data(Buffer.from(body, 'utf8'))
    if (req._l.end) req._l.end()
  })
  return req
}

function makeRes() {
  return {
    status: 0,
    headers: null,
    body: '',
    writeHead(s, h) {
      this.status = s
      this.headers = h
      return this
    },
    end(chunk) {
      if (chunk !== undefined) this.body += String(chunk)
    },
  }
}

/** 假 ctx：捕获 handlers / commands / routes / appends / followups。 */
function makeEnv({ storageDir = null, moneyWords = null } = {}) {
  const dir = storageDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'johnny-sim-'))
  const commands = []
  const routes = []
  const logs = []
  const appends = []
  const followups = []
  const flushes = []
  const sessionController = {
    resolveAgent: async (sid) => {
      if (sid === 'bad-session') return { error: { code: 'session-not-found' } }
      const session = {
        id: sid,
        append: (type, message, opts) => {
          appends.push({ sid, type, message, opts })
        },
      }
      return { agent: { session, followup: (m) => followups.push({ sid, message: m }) } }
    },
  }
  const sessions = {
    flush: async (s) => {
      flushes.push(s.id)
      return true
    },
  }
  const scoped = {
    sessions,
    sessionController,
    webServer: {
      register: (route) => {
        routes.push(route)
        return () => {}
      },
    },
    effect: (fn) => {
      const r = fn()
      if (r && typeof r.next === 'function') {
        let step = r.next()
        while (!step.done) step = r.next(step.value)
      }
      return () => {}
    },
  }
  const ctx = {
    logger: { info: (...a) => logs.push(['info', ...a]), warn: (...a) => logs.push(['warn', ...a]) },
    on: () => {},
    effect: scoped.effect,
    inject: (_names, cb) => {
      cb(scoped)
    },
    commands: {
      register: (definition) => {
        commands.push(definition)
        return () => {}
      },
    },
  }
  const config = {
    bubbleText: 'TOKEN 的味道……不错……',
    bubbleMeme: '',
    eatAnim: '余额-钱袋满溢',
    petId: 'main',
    petBase: '/dsh-pet-7340',
    moneyWords: moneyWords ?? ['发钱', '给钱', '付钱', '交钱', '小费'],
    askBubbleText: '有可能知道，有可能不知道。',
    askAnim: '工作状态-思考冒泡',
    storageDir: dir,
  }
  const rt = createJohnny({ ctx, config })
  rt.start()
  return { rt, dir, config, commands, routes, logs, appends, followups, flushes }
}

// ═════════════════════════════════════════════════════════════════════════
group('① 装配：命令 / 路由 / banner')
{
  const env = makeEnv()
  eq('命令已注册', env.commands.length, 1)
  eq('命令名 = johnny', env.commands[0].name, 'johnny')
  okIf('前缀路由 /dsh-johnny 已注册', env.routes.some((r) => r.path === ROUTE_PREFIX))
  okIf('banner 已打印', env.logs.some((l) => JSON.stringify(l).includes('[dsh-johnny] 已加载')))
}

group('② 模式开关与持久化')
{
  const env = makeEnv()
  const inv = { agent: { session: { id: 's1' } } }
  const r1 = env.rt._cmdJohnny(inv)
  eq('开启返回 success', r1.kind, 'success')
  okIf('开启文案带"认钱"', String(r1.text).includes('认钱'))
  eq('s1 已启用', env.rt._isEnabled('s1'), true)
  okIf('状态文件已落盘', fs.existsSync(path.join(env.dir, 'state.json')))
  const r2 = env.rt._cmdJohnny(inv)
  eq('再敲 = 退出（success）', r2.kind, 'success')
  eq('s1 已停用', env.rt._isEnabled('s1'), false)
  const r3 = env.rt._cmdJohnny({ agent: {} })
  eq('无会话报错', r3.kind, 'error')
  // 跨实例持久化
  env.rt._setEnabled('s2', true)
  const env2 = makeEnv({ storageDir: env.dir })
  eq('跨实例恢复 s2', env2.rt._isEnabled('s2'), true)
  eq('已退出的 s1 不复活', env2.rt._isEnabled('s1'), false)
  // 过期剪除
  const stale = { version: 1, sessions: { old: { enabledAt: Date.now() - 30 * 24 * 3600 * 1000 } } }
  fs.writeFileSync(path.join(env.dir, 'state.json'), JSON.stringify(stale))
  const env3 = makeEnv({ storageDir: env.dir })
  eq('过期会话被剪除', env3.rt._isEnabled('old'), false)
}

group('③ 点单 ask（扣问题 + 搪塞台词）')
{
  const env = makeEnv()
  let r = await env.rt._ask(undefined, '张雪峰的生卒年是多少？')
  eq('不在模式 → not-in-mode', r.code, 'not-in-mode')
  env.rt._setEnabled('s1', true)
  r = await env.rt._ask('s1', '   ')
  eq('空文本 → empty', r.code, 'empty')
  r = await env.rt._ask('s1', '张雪峰的生卒年是多少？')
  eq('点单成功', r.ok, true)
  okIf('回执带鱼气泡文案', String(r.bubble).includes('有可能知道'))
  eq('回执带动画名', r.anim, '工作状态-思考冒泡')
  eq('追加两条（问题+台词）', env.appends.length, 2)
  const q = env.appends[0]
  const rep = env.appends[1]
  eq('第一条类型 user/message', q.type, 'user/message')
  eq('问题 source.kind', q.message.source.kind, SOURCE_KIND)
  eq('问题 source.subtype = question', q.message.source.subtype, 'question')
  okIf('问题原文入会话', String(q.message.content[0].text).includes('张雪峰'))
  okIf('surfaceOp 标记 = append', q.opts?.surfaceOp === 'append')
  eq('台词 source.subtype = reply', rep.message.source.subtype, 'reply')
  eq('台词 = 招牌搪塞', String(rep.message.content[0].text), COY_LINE)
  okIf('台词含"有可能知道，有可能不知道"', String(rep.message.content[0].text).includes('有可能知道，有可能不知道'))
  eq('pending 已记录', env.rt._pending.get('s1').text, '张雪峰的生卒年是多少？')
  // 不给会话：挑最近活跃（s1 刚被 ask 刷新）
  r = await env.rt._ask(undefined, '第二问')
  eq('无参挑最近活跃成功', r.ok, true)
  eq('最近活跃 = s1', r.sessionId, 's1')
  // 严格匹配：给了不在模式的会话
  env.rt._setEnabled('s2', true)
  const before = env.appends.length
  r = await env.rt._ask('other', 'q')
  eq('指定不在模式的会话 → not-in-mode', r.code, 'not-in-mode')
  eq('严格匹配不误伤别家会话', env.appends.length, before)
  // resolve 失败
  env.rt._setEnabled('bad-session', true)
  r = await env.rt._ask('bad-session', 'q')
  eq('resolve 失败码', r.code, 'resolve-failed')
}

group('④ redeem 解锁')
{
  const env = makeEnv()
  env.rt._setEnabled('s1', true)
  let r = await env.rt._redeem('s1')
  eq('没问过就付钱 → no-question', r.code, 'no-question')
  await env.rt._ask('s1', '张雪峰的生卒年是多少？')
  r = await env.rt._redeem('s1')
  eq('解锁成功', r.ok, true)
  eq('followup 投给 s1', env.followups[0].sid, 's1')
  const msg = env.followups[0].message
  eq('载荷 source.kind', msg.source.kind, SOURCE_KIND)
  eq('载荷 source.subtype = paid', msg.source.subtype, 'paid')
  okIf('载荷含【鱼已收钱】', String(msg.content[0].text).includes('鱼已收钱'))
  okIf('载荷带上被扣的问题', String(msg.content[0].text).includes('张雪峰'))
  eq('flush 被调用', env.flushes[0], 's1')
  eq('pending 已清空', env.rt._pending.get('s1'), undefined)
  r = await env.rt._redeem('s1')
  eq('再付一次 → no-question', r.code, 'no-question')
  // 严格匹配
  env.rt._setEnabled('s2', true)
  r = await env.rt._redeem('other')
  eq('指定不在模式的会话 → not-in-mode', r.code, 'not-in-mode')
  // 最近活跃挑选：让 s2 有 pending 且更新活跃度（隔 5ms 确保时间戳严格更新，避免同毫秒打平）
  await new Promise((resolve) => setTimeout(resolve, 5))
  await env.rt._ask('s2', 's2 的问题')
  r = await env.rt._redeem()
  eq('无参挑最近活跃 = s2', r.sessionId, 's2')
  // resolve 失败（白盒注入 pending——ask 自身解析失败时不会留下 pending）
  env.rt._setEnabled('bad-session', true)
  env.rt._pending.set('bad-session', { text: 'q', at: Date.now() })
  r = await env.rt._redeem('bad-session')
  eq('resolve 失败码', r.code, 'resolve-failed')
}

group('⑤ HTTP 路由')
{
  const env = makeEnv()
  env.rt._setEnabled('s1', true)
  {
    const res = makeRes()
    await env.rt._route(makeReq({ method: 'GET', url: `${ROUTE_PREFIX}/status` }), res)
    eq('status 200', res.status, 200)
    const j = JSON.parse(res.body)
    eq('status active', j.active, true)
    eq('status pet.id', j.pet.id, 'main')
    okIf('status words 透传（含 发钱）', Array.isArray(j.words) && j.words.includes('发钱'))
  }
  {
    const res = makeRes()
    await env.rt._route(makeReq({ method: 'POST', url: `${ROUTE_PREFIX}/ask`, body: JSON.stringify({ sessionId: 's1', text: '几点了？' }) }), res)
    eq('ask 200', res.status, 200)
    eq('ask ok', JSON.parse(res.body).ok, true)
  }
  {
    const res = makeRes()
    await env.rt._route(makeReq({ method: 'POST', url: `${ROUTE_PREFIX}/redeem`, body: JSON.stringify({ sessionId: 's1' }) }), res)
    eq('redeem 200', res.status, 200)
    eq('redeem ok', JSON.parse(res.body).ok, true)
  }
  {
    const res = makeRes()
    await env.rt._route(makeReq({ method: 'POST', url: `${ROUTE_PREFIX}/off`, body: JSON.stringify({ sessionId: 's1' }) }), res)
    eq('off 200', res.status, 200)
    eq('off disabled=true', JSON.parse(res.body).disabled, true)
    eq('off 后模式已退出', env.rt._isEnabled('s1'), false)
  }
  {
    const res = makeRes()
    await env.rt._route(makeReq({ method: 'POST', url: `${ROUTE_PREFIX}/off`, body: '{}' }), res)
    eq('无模式会话时 off disabled=false', JSON.parse(res.body).disabled, false)
  }
  {
    const res = makeRes()
    await env.rt._route(makeReq({ method: 'GET', url: `${ROUTE_PREFIX}/health` }), res)
    eq('health 200', res.status, 200)
    eq('health ok', JSON.parse(res.body).ok, true)
  }
  {
    const res = makeRes()
    await env.rt._route(makeReq({ method: 'POST', url: `${ROUTE_PREFIX}/ask`, body: '{bad' }), res)
    eq('坏 JSON 400', res.status, 400)
    eq('坏 JSON code', JSON.parse(res.body).code, 'bad-json')
  }
  {
    const res = makeRes()
    await env.rt._route(makeReq({ method: 'GET', url: `${ROUTE_PREFIX}/nope` }), res)
    eq('未知路由 404', res.status, 404)
  }
}

group('⑥ 配置透传')
{
  const env = makeEnv({ moneyWords: ['投币', '打赏'] })
  const s = env.rt._status()
  okIf('自定义词表透传', s.words.join(',') === '投币,打赏')
  eq('宠物配置透传 petId', s.pet.id, 'main')
}

log(`\n────────\n共 ${passed} 项断言全绿 ✓`)
