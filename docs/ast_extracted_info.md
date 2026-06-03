# JXScout AST 静态分析特征与提取信息规范文档

本文档整理了 JXScout AST 分析器（AST Analyzer）提取出的各类安全特征与静态信息的分类规范。

为了提升系统的模块化程度与职责清晰度，我们对早期的分析器命名（`analyzerName`）进行了重组与合并（例如合并了 DOM XSS 相关、HTTP 请求相关、正则与 Web 跨域消息相关的项）。重构后共有 19 个职责分明的静态分析器。

---

## 架构演进与重组对照表

在本次设计调整中，有如下核心分析器进行了功能合并与重命名：

| 变更类型 | 原分析器名 (Old Name) | 新分析器名 (New Name) | 重组理由 (Rationale) |
| :--- | :--- | :--- | :--- |
| **合并与重命名** | `inner-html`<br>`dangerouslySetInnerHTML` | **`dom-sinks`** | 统一管理所有向 DOM 写入 HTML 的危险 Sink 点（包括 JS 原生、jQuery 与 React 特有属性）。 |
| **合并与重命名** | `fetch`<br>`fetch-options` | **`http-requests`** | 统一归纳网络通信请求的特征，包括请求方法、配置对象及 API 调用。 |
| **重命名** | `robust-paths` | **`endpoints`** | 移除偏学术/实现的命名，直接体现其提取“路由端点”与“静态路径”的业务本质。 |
| **重命名** | `regex-match` | **`regex`** | 仅保留正则表达式的执行与匹配分析，弃用无审计意义的纯正则声明（regex-pattern）提取。 |
| **合并** | `postmessage`<br>`onmessage` | **`web-messaging`** | 统合 HTML5 跨域 Web Messaging 消息发送与接收监听。 |
| **合并** | `local-storage`<br>`session-storage` | **`web-storage`** | 合并 HTML5 的 Web Storage 机制，通过子标签区分 Local 与 Session。 |

---

## JXScout AST 重组后特征规范表

| 分类目录 (Category) | 信息子类 / 特征名称 | 类型枚举值 (analyzerName) | 标签值 (Tags) | AST 匹配特征 (AST Node Details) | 代码示例值 (Example Code) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. 敏感信息与凭证密钥 (Secrets)** | 云服务凭证、API 密钥、私钥证书、Webhook 机器人等 | `secrets` | `secret`<br>`secret-type-*` | 字符串字面量（`Literal`），且非 MIME/颜色噪声，通过 `SECRET_PATTERNS` 正则库校验。 | - AWS API Key: `AKIAIOSFODNN7EXAMPLE`<br>- 阿里云 AK: `LTAI4Fxxxxxxxxxxxxxx`<br>- 飞书 Webhook: `https://open.feishu.cn/open-apis/bot/v2/hook/xxx` |
| **2. API 路径与域名识别 (Endpoints)** | 普通路径 (Path) 与 API 路径 | `endpoints` | `is-path-only`<br>`api` (包含 `api/`) | `Literal` 字符串、`TemplateLiteral` 或字符串拼接表达式，且符合有效路径格式。 | `"/api/v1/users"`<br>`"/dashboard/profile"` |
| | 完整 URL 地址 | `endpoints` | `is-url`<br>`is-url-only` (仅域名) | 包含协议的 URL 路径，或仅含域名的 URL。 | `"https://api.example.com/v1/data"`<br>`"//example.com"` |
| | 注入风险敏感参数 | `endpoints` | `query`<br>`ssrf-parameter`<br>`cmd-injection-parameter`<br>`jsonp-parameter` | 路径/URL 的 Query 参数中包含 `url`/`src` 等 SSRF 关键键，或 `cmd`/`exec` 等命令注入键，或 `callback` 等 JSONP 键。 | `"/redirect?url=http://attacker.com"`<br>`"/shell?cmd=whoami"`<br>`"/jsonp?callback=myfunc"` |
| | 文件后缀与 MIME 类型 | `endpoints` | `is-extension`<br>`extension-${ext}` | 字符串符合预定义的文件扩展名或 MIME 类型。 | `"/static/bundle.js"` (打 `extension-js` 标)<br>`"application/json"` (打 `mime-type` 标) |
| | 字符串主机名 | `hostname` | `hostname-string` | 独立的字符串字面量符合域名规则（排除了特定的 JS/TS 扩展名及静态资源域名）。 | `"api.github.com"` |
| | GraphQL 请求操作 | `graphql` | `graphql`<br>`graphql-query`<br>`graphql-mutation`<br>`graphql-other` | 字面量或模板字符串包含 GraphQL 特征词（`query`/`mutation` 等），且花括号对称。 | ``query GetUser { user(id: 1) { name } }`` |
| **3. DOM XSS 与客户端安全风险 (Client-Side Vulnerabilities)** | 危险 DOM 写入 (DOM Sinks) | `dom-sinks` | `inner-html`<br>`dom-sink-${method}`<br>`dangerouslySetInnerHTML-jsx`<br>`dangerouslySetInnerHTML-object` | 赋值给 `innerHTML`/`outerHTML`/`srcDoc`；调用 `document.write`/`insertAdjacentHTML` 等；调用 jQuery 的 `html`/`append` 等；或使用 React 的 `dangerouslySetInnerHTML`。 | - `element.innerHTML = userInput`<br>- `document.write(userInput)`<br>- `<div dangerouslySetInnerHTML={{__html: userInput}} />` |
| | 动态脚本执行 (Eval-like) | `eval` | `eval`<br>`eval-type-${func}` | 调用 `eval`、`Function`、`execScript`、`setTimeout`/`setInterval`（参数为字符串）或 jQuery 的 `globalEval`。 | `eval(userInput)`<br>`setTimeout(userInput, 1000)` |
| | 客户端开放重定向 | `location` | `location`<br>`location-assignment`<br>`location-read`<br>`property-${prop}` | 对 `location` 或 `window.location` 属性（如 `href`, `search`）的读写，或调用 `location.replace` 等。 | `location.href = redirectUrl`<br>`window.location.replace(url)` |
| | 窗口弹出 / 新建窗口 | `window-open` | `window-open` | 对 `window.open` 的调用。 | `window.open(url, "_blank")` |
| | 跨域 Message 通信 | `web-messaging` | `postMessage`<br>`onmessage` | 调用 `postMessage` 方法发送数据，或对 `onmessage` 属性赋值监听接收。 | - `targetWindow.postMessage(msg, "*")`<br>- `window.onmessage = handle` |
| | 事件监听 (Event Listener) | `add-event-listener` | `event-listener`<br>`event-type-${type}` | 对 `addEventListener` 的调用，提取事件类型（**已排除浏览器标准事件，仅关注未知/自定义事件及动态事件**）。 | `window.addEventListener("custom-auth-success", handle)` |
| | Hash 变更监听 | `onhashchange` | `onhashchange` | 对 `onhashchange` 属性的赋值，或调用 `addEventListener("hashchange", ...)`。 | `window.onhashchange = handleHash` |
| **4. 数据操控与浏览器存储 (Storage)** | Cookie 读写 | `cookie` | `cookie`<br>`cookie-assignment`<br>`cookie-read` | 对 `document.cookie` 的赋值（写）或引用（读）。 | `document.cookie = "session=xyz"` |
| | HTML5 浏览器本地存储 | `web-storage` | `local-storage`<br>`session-storage`<br>`property-getitem`<br>`property-setitem` | 调用 `localStorage` 或 `sessionStorage` 的 `getItem`/`setItem` 方法。 | - `localStorage.setItem("key", val)` (带 `local-storage` 标)<br>- `sessionStorage.getItem("key")` (带 `session-storage` 标) |
| | window.name 状态通道 | `window-name` | `window-name-assignment`<br>`window-name-read` | 对 `window.name` 属性的读取或赋值。 | `window.name = data` |
| | URL 查询参数解析 | `url-search-params` | `url-search-params` | 实例化 `URLSearchParams` 构造函数。 | `new URLSearchParams(location.search)` |
| | 安全域跨域边界修改 | `document-domain` | `domain-assignment`<br>`domain-read` | 对 `document.domain` 属性的读取或赋值。 | `document.domain = "example.com"` |
| **5. 网络交互与正则模式 (Network / Regex)** | HTTP 请求交互 | `http-requests` | `fetch-call`<br>`fetch-options` | 调用 `fetch(...)` 或使用了包含请求配置参数的对象。 | - `fetch("/api/users")`<br>- `{ method: "POST", headers: { ... } }` |
| | 正则表达式执行与匹配 | `regex` | `regex-match` | 调用 `match`、`test`、`exec` 进行正则表达式匹配执行。 | `regex.test(str)` (带 `regex-match` 标) |
| **6. 加密、哈希与编码函数 (Crypto & Encoding)** | 加密、哈希与编码相关算法 | `crypto` | `crypto`<br>`crypto-type-crypto`<br>`crypto-type-hash`<br>`crypto-type-encoding`<br>`crypto-func-*` | 标识符或成员表达式符合预定义的常见加密库（CryptoJS, forge, SubtleCrypto）、哈希（md5, sha256 等）或编码（btoa, Base64）关键字。 | - `CryptoJS.AES.encrypt(msg, key)` (打 `crypto-type-crypto` 标)<br>- `md5(password)` (打 `crypto-type-hash` 标)<br>- `btoa(str)` (打 `crypto-type-encoding` 标) |

---

## 典型分析器输出样例

以下是重组后的 `AnalyzerMatch` 的标准 JSON 结构样例，例如一个属于 `dom-sinks` 分析器捕获到的 React `dangerouslySetInnerHTML` 命中结构：

```json
{
  "filePath": "/home/user/project/src/components/MyComponent.tsx",
  "analyzerName": "dom-sinks",
  "value": "dangerouslySetInnerHTML={{__html: props.content}}",
  "start": {
    "line": 15,
    "column": 10
  },
  "end": {
    "line": 15,
    "column": 60
  },
  "tags": {
    "inner-html": true,
    "dangerouslySetInnerHTML-jsx": true
  },
  "extra": {}
}
```
