# dsh-johnny

> DeepSeek Harness 插件：**万事通强尼 —— 没收到钱就装傻，钱到位全说。**

给你喜欢的桌宠（dsh-pet 大肥鱼）配一个"付费问答"小剧场：`/johnny` 出摊后，你说什么他都打太极（「有可能知道，有可能不知道。」）；想要真话，得**敲钱**、再把钱**喂给肥鱼**——鱼啃一口，真答案落进对话。

致敬《白头神探》前身剧《Police Squad!》里的擦鞋线人 Johnny——那位"什么都知道、但钱到位才肯说"的万事通。

## 三步玩起来

1. **出摊**：对话里输入 `/johnny`（再敲一次收摊；屏幕角落会出现「强尼模式」徽标 + 红色 ×，**点 × 秒退**）
2. **敲钱**（三通道任选）：
   - 桌面：鼠标 **左左·右右**
   - 手机：**摇一摇**
   - 或输入框打「**发钱**」发送（被拦下，不发给模型、不花 token）
3. **喂鱼**：把钱拖到肥鱼身上 → 鱼播动画 + 气泡「TOKEN 的味道……不错……」→ **真答案出现在对话里**

模式里你发的每句话都会被"扣下"：问题记进会话，强尼只回那一句招牌搪塞（鱼会同步动一下、冒泡帮腔）。**装傻环节零模型调用、零 token。**

## 安装

```sh
dsh plugin --profile web add 'https://codeload.github.com/wobenshiwomu/dsh-johnny/tar.gz/v0.1.0'
```

或在图形界面：侧栏「插件」→ 添加插件 → 填上面这条 URL。装完重启 DSH 生效。
URL 末段的 `v0.1.0` 是版本标签；升级时换成本仓库的新版本标签重装即可。

**建议搭配 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（大肥鱼桌宠）**——"喂鱼"环节靠它的 `/dsh-pet-7340` 接口。没有鱼也能玩：出摊 / 装傻 / 敲钱 / 红叉都好使，只有最后喂鱼那步会提示"鱼没反应"。

## 配置项（全部可选）

在 profile 用户层 `cordis.patch.yml` 覆盖：

```yaml
- id: dsh-johnny
  config:
    bubbleText: 'TOKEN 的味道……不错……'   # 喂钱后鱼气泡文案
    bubbleMeme: ''                          # 可选气泡配图（dsh-pet 表情包名，如 吃饱饱摸肚子）
    eatAnim: '余额-钱袋满溢'                 # 喂钱时鱼播的动画
    askBubbleText: '有可能知道，有可能不知道。'  # 扣下时鱼气泡文案（留空=不冒泡）
    askAnim: '工作状态-思考冒泡'              # 扣下时鱼播的动画（留空=不动）
    # petId: main                           # 联动的宠物 id
    # petBase: /dsh-pet-7340                # dsh-pet 接口前缀
    # moneyWords: [发钱, 给钱, 付钱, 交钱, 小费]  # 输入框召钱词表
    # storageDir: ''                        # 状态存储目录（默认 $DSH_HOME/storages/dsh-johnny）
```

## 原理（一段话）

模式里客户端在捕获层拦下你的发送；「点单」经 HTTP 进宿主后，用 `session.append(…, { surfaceOp: 'append' })` 把问题与搪塞台词写进会话（**不惊动模型、零 token**）；喂钱触发 `resolveAgent → agent.followup`，把被扣的问题包进「鱼已收钱」消息——只有这一轮"真回答"过一次模型。鱼的反应（动画 + 气泡）由客户端同源调用 dsh-pet 接口完成。

> 小注：最初想让模型亲自"演"强尼，真机实测模型会把"装傻要钱"判为操纵性/注入而拒绝出演；改成"拦截式台词池"后反而更稳、更省、更好笑——他每次都说同一句，就是笑点。

## 测试

- `node test/sim.mjs`：**66 项断言**（模式开关与持久化 / 点单扣话 / 解锁载荷 / HTTP 路由 / 配置透传）
- 真机 E2E：扣下时零模型调用（assistant 计数不变）→ 喂钱 → 模型答出暗号（TOKEN-99），全链路贯通

## 已知问题

- Android/Termux 上使用 dsh-pet 需要先让它能正常加载：其静态 import 的 `@electron-internal/extract-zip` 没有安卓预编译，会在插件加载期抛错；可用 `pnpm patch` 换成懒桩绕过（该模块只在桌面模式用到）。修复建议（改成使用时动态 import）已同步给 dsh-pet 仓库。
- dsh-pet 的"桌面模式"（Electron 透明窗）在安卓不可用，属上游限制；Web 模式不受影响。

## License

MIT
