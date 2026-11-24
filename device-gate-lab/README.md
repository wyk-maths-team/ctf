# Device Gate Lab

> 一个 20 分钟能打完的 Web 安全入门靶场。
> 三道关，分别对应**客户端不可信**、**协议逆向**、**前端凭据泄露**三个真实存在的经典问题。
> 零依赖，`node server.js` 就能跑。

[![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-0-success)](package.json)

---

## 这是什么

很多网站会做这样的"防护"：

- 桌面浏览器不让看，只有手机能访问
- 静态资源放在随机命名的目录里
- API 请求要带一个密钥

这个靶场把这类做法**按真实方式实现了一遍**，三关分别让你体验：

| 关 | 主题 | 核心问题 |
|---|---|---|
| 1 | 设备指纹网关 | 判断逻辑跑在**客户端**，那它就不是安全边界 |
| 2 | WebSocket 协议 | 错误信息太诚实，等于把协议规范送给攻击者 |
| 3 | 前端凭据 | 前端要用的密钥，不叫密钥 |

**每一关都有一个 `FLAG{}`，拿满三个算通关。**

---

## 快速开始

```bash
git clone <这个仓库>
cd device-gate-lab
node server.js
```

或者：

```bash
npm start
```

看到这行就成了：

```
  靶场已启动  http://127.0.0.1:8080/
```

然后打开 **http://127.0.0.1:8080/**

你会看到 **404**。

**这是故意的。真正的入口自己找。**

> 换端口：`PORT=3000 node server.js`（Windows PowerShell：`$env:PORT=3000; node server.js`）

---

## 三关

### 第 1 关：设备指纹网关

打开 `/static/` 会**白屏**。

想办法让它显示出来，页面里会给你 `FLAG{stage1_...}`。

破解点：`public/mgate.js` 里判断你的设备是不是手机。它检查四样东西。

### 第 2 关：WebSocket 协议

第 1 关过后，页面会自己去连一个 WebSocket，然后被服务器踢掉。

服务器会告诉你**缺什么**。

还原出正确的握手和消息格式，服务器会主动推 `FLAG{stage2_...}` 给你。

### 第 3 关：前端凭据

```bash
curl "http://127.0.0.1:8080/api/tg-cs/session/health"
```

```json
{"code":400,"message":"访问未授权"}
```

让它变成 `code: 200`，响应里就有 `FLAG{stage3_...}`。

**别猜请求头名。页面自己正在用正确的凭据发这个请求——去看它怎么发的。**

---

## 规则

### 允许

- ✅ 读页面源码（F12）
- ✅ 下载并分析 JS 文件
- ✅ curl / PowerShell / Python / 任何工具随便发请求
- ✅ 改浏览器设置、装插件、用 CDP
- ✅ 无限次重试
- ✅ 卡住了看 `WALKTHROUGH.md`（剧透警告）

### 不允许

- ❌ 修改服务端代码来"通关"（那就没意义了）
- ❌ 暴力猜密钥（这一关不考这个）
- ❌ 把服务打挂

---

## 提示

卡住了再看，分三级。

<details>
<summary><b>第 1 关 · 提示 1</b>（很轻）</summary>

先看 `/static/` 的 HTML 里那段内联 `<style>`。

它写了一个条件：**满足什么，页面才可见。**
</details>

<details>
<summary><b>第 1 关 · 提示 2</b>（中等）</summary>

可见条件是 `<html>` 上有 `wa-ok` 这个 class。

谁会加这个 class？去读 `/kv5Mjg/mgate.js`。**这个文件没有混淆，直接能读。**

它返回 `false` 就拦你，返回 `true` 就放行。
</details>

<details>
<summary><b>第 1 关 · 提示 3</b>（接近答案）</summary>

`mgate.js` 里 `check()` 函数查了四样：

1. `navigator.userAgent` 有没有移动端关键词
2. `navigator.platform` 是不是桌面（`Win32` 就死）
3. `navigator.maxTouchPoints` 是不是 > 1
4. **WebGL 渲染器型号** —— `Intel` / `NVIDIA` / `D3D11` 这类桌面显卡就死

前三个用 `Object.defineProperty` 覆盖。

第四个要打补丁：`WebGLRenderingContext.prototype.getParameter`，参数 `37445` 返回厂商、`37446` 返回型号。

注意：光改 `navigator` 还不够，`/api/allocate` 服务端也会看 **User-Agent 请求头**（不是你 JS 里改的那个）。用 DevTools 的设备模拟（`Ctrl+Shift+M`）或 curl 的 `-A` 参数。
</details>

<details>
<summary><b>第 2 关 · 提示 1</b></summary>

服务器关闭时给的代码是 `4002`，原因是 `wa.v1 required`。

`4000-4999` 是 WebSocket 留给应用自定义的关闭码区间。

关键词：**子协议（subprotocol）**。
</details>

<details>
<summary><b>第 2 关 · 提示 2</b></summary>

`new WebSocket(url, protocols)` —— 第二个参数就是子协议。

连上之后还要"说对格式"。去 `public/app.js` 里找 `__buildFrame` 函数，那是消息信封的构造器。
</details>

<details>
<summary><b>第 2 关 · 提示 3</b></summary>

信封长这样：

```json
{"v":1, "type":"<命令名>", "request_id":"...", "session_id":null, "sent_at":"...", "payload":{}}
```

**最容易踩的坑：`type` 里放的不是 `"call"` 或 `"command"`，而是方法名本身。**

已注册的命令叫 `session.poll`，而且它要求 `session_id` 非空。
</details>

<details>
<summary><b>第 3 关 · 提示 1</b></summary>

F12 → Network → 刷新页面 → 找 `session/health` 这条 → 点开 → 看 **Request Headers**。
</details>

<details>
<summary><b>第 3 关 · 提示 2</b></summary>

有个 `X-Api-Key` 请求头，值就明文躺在里面。

为什么它一定在浏览器能拿到的地方？因为**前端要用它**。
</details>

<details>
<summary><b>第 3 关 · 提示 3</b></summary>

在 `public/app.js` 里搜 `API_KEY`。

```javascript
var API_KEY = 'lab_...';
fetch('/api/tg-cs/session/health', { headers: { 'X-Api-Key': API_KEY } })
```

任何打开这个网站的人都能看到它。然后：

```bash
curl -H "X-Api-Key: <你找到的值>" "http://127.0.0.1:8080/api/tg-cs/session/health"
```
</details>

---

## 通关之后，想想这几个问题

1. 第 1 关的绕过手法，为什么在真实系统里**不算漏洞**？
2. 第 3 关的 key，正确的做法应该是什么？
3. 第 2 关如果服务器只返回 `close 4002`，什么提示都不给，攻击成本会高多少？
4. 这三关里，哪一关**无法**从客户端绕过？为什么？

---

## 文件结构

```
device-gate-lab/
├── server.js              HTTP 服务 + WebSocket 服务端（无依赖手写）
├── public/
│   ├── static.html        SPA 外壳（白屏机关在这一层）
│   ├── mgate.js           设备指纹网关 ← 第 1 关
│   └── app.js             业务逻辑 + 硬编码密钥 ← 第 3 关
├── WALKTHROUGH.md         完整解法（剧透）
└── README.md
```

---

## 技术说明

- **零依赖**：只用 `http` / `fs` / `path` / `crypto`
- **WebSocket 手写实现**：服务端约 70 行，包含握手、帧编解码、子协议协商、自定义关闭码。想学 WebSocket 协议的话这个文件可以直接读
- Node 版本：>= 16

---

## 免责声明

这是一个**纯本地**的练习环境，所有内容为教学目的虚构。
不要把这些技术用在任何未授权的真实系统上——那是另一回事。

---

## License

MIT
