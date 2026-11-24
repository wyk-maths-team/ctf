# WALKTHROUGH · 完整解法

> ⚠️ 剧透。先自己试。

---

## 核心认知：为什么这些防护全都拦不住

在讲具体解法之前，先记住一句话：

> **页面上的一切防护，都跑在页面自己身上。**

这意味着：

- 拦截 `F12` 的是 `keydown` 事件监听器 → **浏览器菜单里的"开发者工具"不经过这个事件**
- 拦截 `Ctrl+U` 的是同一个监听器 → **浏览器地址栏输入 `view-source:` 不经过它**
- `debugger` 循环是 JS → **JS 不跑，它就不存在**
- 清空控制台是 `console.clear()` → **换一个不受控制的上下文就行**

**这是所有前端防护的共同死穴。**

---

## 第 1 关：`FLAG{stage1_view_source_beats_the_block}`

藏的位置：`<head>` 里的 meta 标签

```html
<meta name="x-lab-stage1" content="FLAG{stage1_view_source_beats_the_block}">
```

### 解法 A：地址栏 `view-source:`（最快）

在地址栏手输（**不要用 Ctrl+U**）：

```
view-source:file:///C:/attack/lab2/index.html
```

或者起服务器后：

```
view-source:http://127.0.0.1:8090/
```

**为什么有效**：`view-source:` 是浏览器内部协议，不触发页面的 `keydown` 事件。

### 解法 B：curl（完全不经过浏览器）

```bash
curl http://127.0.0.1:8090/ | findstr "FLAG"
```

**为什么有效**：页面 JS 根本没机会运行。

### 解法 C：用编辑器直接打开

```powershell
notepad C:\attack\lab2\index.html
```

**为什么有效**：这是最粗暴也最彻底的——你根本不在浏览器里。

### 解法 D：浏览器菜单

右键 → 没反应（被拦了）。

但是：**Chrome 右上角三个点 → 更多工具 → 开发者工具**，这条路**不经过页面的任何事件处理器**。

打开后在 Elements 面板里直接看 `<head>`。

> 这一条是本题最重要的认知：**别跟页面按钮较劲，绕到浏览器的原生菜单去。**

---

## 第 2 关：`FLAG{stage2_console_opened}`

藏的位置：`#x1` 元素的 `data-a` 属性，**Base64 编码**

```html
<span id="x1" data-a="RkxBR3tzdGFnMl9jb25zb2xlX29wZW5lZH0="></span>
```

解码后：

```
FLAG{stage2_console_opened}
```

### 第一步：进控制台

F12 被拦。三条路：

**路径 1：浏览器菜单**（推荐）
```
⋮ → 更多工具 → 开发者工具
```

**路径 2：启动参数**
```powershell
chrome.exe --auto-open-devtools-for-tabs file:///C:/attack/lab2/index.html
```
这个参数让 DevTools 在标签页打开时自动弹出，**完全不经过 F12**。

**路径 3：右键 → 检查**
被 `contextmenu` 拦了。但如果先禁用 JS 再右键，就能用。

### 第二步：取值

三种方式都行：

```javascript
// 方式 1：调用页面准备好的函数
__lab_stage2()

// 方式 2：直接解码
atob(document.querySelector('#x1').getAttribute('data-a'))

// 方式 3：既然都到这一步了，直接看源码也行（Stage 1 的解法同样适用）
```

### 关于那个诱饵

```javascript
__lab_decoy
// → "FLAG{y0u_found_the_decoy_keep_looking}"
```

这是假的。**专门给"以为随便一搜就找到"的人准备的。**

### 注意：控制台会被反复清空

页面每 1.5 秒执行 `console.clear()`，还有两处 `debugger` 循环（300ms 和 600ms 各一个）。

**怎么办：**

- 清空只是清显示，**你输出的值已经算出来了**——手快截图/复制
- 或者用 DevTools 的 **Console 设置 → 勾选 "Preserve log"**
- 或者在 Console 里执行后立刻把结果赋给 `window.xxx`，然后从 Elements 面板读
- 或者：**Sources 面板 → Deactivate breakpoints（Ctrl+F8）**，`debugger` 就全失效了

> 最后那条是重点：**DevTools 自己有开关能禁掉 `debugger` 语句**，这是页面控制不了的。

---

## 第 3 关：`FLAG{stage3_network_panel_never_lies}`

藏的位置：`kefu.json`

```json
{
  "ticket": "TCK-2026-1124-7719",
  "department": "facai",
  "agent": "operator_01",
  "status": "waiting_for_visitor",
  "flag": "FLAG{stage3_network_panel_never_lies}",
  "messages": []
}
```

### 解法 A：Network 面板

1. 打开 DevTools（用上面的方法）
2. 切到 **Network** 标签
3. 刷新页面（Ctrl+R 没被拦）
4. 找到 `kefu.json` 请求
5. 点开 → Response 标签

**注意**：用 `file://` 打开时，某些浏览器不记录 fetch 的 XHR 请求。这时改用 `http://` 起服务器。

### 解法 B：直接访问

```
http://127.0.0.1:8090/kefu.json
```

浏览器直接显示这个 JSON。

**为什么有效**：它就是一个静态文件，没有任何保护。

### 解法 C：控制台读变量

```javascript
__lab_data
```

页面 fetch 完成后会把结果挂到 `window.__lab_data` 上。

### 这一关想说明什么

**Network 面板永远说的是真话。**

不管前端怎么撒谎、怎么混淆、怎么拦截，如果你能看到实际发出的请求和收到的响应，你看到的就是全部真相。

这也是为什么真实的安全分析里，**抓包永远优先于读源码**。

---

## 第 4 关：`FLAG{stage4_javascript_disabled_everything_falls}`

藏的位置：`<noscript>` 标签

```html
<noscript>
  <div class="noscript-flag">FLAG{stage4_javascript_disabled_everything_falls}</div>
</noscript>
```

`<noscript>` 里的内容**只有 JS 被禁用时才会渲染**。

### 禁用 JavaScript 的四种方式

**方式 1：Chrome 设置**
```
chrome://settings/content/javascript → 不允许网站使用 JavaScript
```
然后刷新页面。

**方式 2：DevTools 里关**
```
F1（打开 DevTools 设置）→ Preferences → Debugger → Disable JavaScript
```
然后用上面学到的办法刷新——但注意，刷新后 DevTools 可能也被影响，所以**先开好 DevTools 再关 JS**。

**方式 3：启动参数**
```powershell
chrome.exe --disable-javascript file:///C:/attack/lab2/index.html
```

**方式 4：用不支持 JS 的工具**

```bash
curl http://127.0.0.1:8090/
```
curl 里 `<noscript>` 标签还在源码里，但不会被"渲染"——所以这条只能拿到源码层面的内容，看不到渲染效果。

**方式 5：一个 HTML 解析器**

```python
from bs4 import BeautifulSoup
print(BeautifulSoup(open('index.html').read(), 'html.parser').find('noscript'))
```

---

## 四个 FLAG 汇总

```
FLAG{stage1_view_source_beats_the_block}
FLAG{stage2_console_opened}
FLAG{stage3_network_panel_never_lies}
FLAG{stage4_javascript_disabled_everything_falls}
```

诱饵（假的）：
```
FLAG{y0u_found_the_decoy_keep_looking}
```

---

## 思考题参考答案

### Q1：这四种绕过方式，哪一种在真实网站上做不到？

**都能做到。**

这就是问题的核心——这些手法对**任何**网站都有效，因为它们利用的是浏览器本身的机制，不是页面给的漏洞。

唯一的区别是：真实网站的 flag 可能是"服务器返回的敏感数据"，那需要服务端也有缺陷。但**绕过前端防护这一层，永远是可行的**。

### Q2：`debugger` 循环为什么拦不住真正想调试的人？

三个原因：

1. **DevTools 自己能关掉它**（Sources 面板 → Deactivate breakpoints，Ctrl+F8）
2. **禁掉 JS 它就不存在了**
3. **换一个工具链它就不存在了**（curl、Python、CDP）

`debugger` 只能拖慢"不知道自己在干什么的人"，对懂的人只造成几秒麻烦。

而且它有个副作用：**自己也卡**。页面每 300ms 卡一下，正常用户也会觉得卡。

### Q3：如果这是恶意页面，以上哪些手法会真的妨碍安全研究？

| 手法 | 妨碍程度 | 说明 |
|---|---|---|
| 拦 F12 / Ctrl+U | **低** | 浏览器菜单、view-source、curl 全都能绕 |
| `debugger` 循环 | **低** | DevTools 一键关闭 |
| 清空控制台 | **低中** | Preserve log 可解，但会丢失证据 |
| 窗口尺寸检测 + 模糊 | **中** | 会让人误以为页面坏了，浪费排查时间 |
| 禁用选中/复制 | **中** | 取证时没法复制文本，很烦 |
| **截图水印** | **高** | 这个是真的阴——截出来的图带隐形标记，溯源容易 |

**最有效的是最后一条**，因为它不影响功能、不引人注意、但对后续的证据使用有实际影响。

### Q4：为什么"禁用 JavaScript"这一招对所有前端防护都有效？

因为**所有前端防护都是 JavaScript 写的**。

- 键盘拦截 → `addEventListener('keydown')`
- 右键拦截 → `addEventListener('contextmenu')`
- 反调试 → `debugger` / `console` / 定时器
- 内容隐藏 → `display:none` 由 JS 控制

JS 不跑，这些全都不存在。

**这也是为什么真正的安全边界必须在服务端**——服务端不给你数据，你在前端怎么折腾都没用。

---

## 最后一句

这套靶场里所有防护加起来大概 60 行，看起来挺唬人。

但你从打开文件到拿完四个 flag，如果思路对，**用不到 3 分钟**。

**这就是前端防护的真实水平。**
