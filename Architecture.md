# JXScout 系统架构文档

## 1. 系统概述
JXScout 是一款专为安全研究人员设计的工具，旨在帮助分析和发现 JavaScript 代码中的漏洞。它通过与常用代理工具（如 Burp Suite 或 Caido）配合，捕获 HTTP 流量，并将前端静态资源（HTML、JS 等）优化并存储在本地，以便研究人员在代码编辑器（如 VSCode）中进行深度分析。

项目的主入口位于 [main.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/cmd/jxscout/main.go)，其核心的初始化与生命周期管理实现于 [jxscout.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/jxscout/jxscout.go)。

---

## 2. 核心系统架构与代码映射
JXScout 采用模块化（Modular）和事件驱动（Event-Driven）的架构设计，核心系统由以下几个基础组件构成：

### 2.1 事件总线 (Event Bus)
系统内部组件和模块之间通过事件进行异步解耦通信。
*   **内存事件总线 (InMemoryEventBus)**：用于瞬时的、不需要持久化的事件传递。
    *   代码映射：[eventbus.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/core/eventbus/eventbus.go)
*   **数据库事件总线 (DBEventBus)**：基于 SQLite 数据库的事件队列，确保事件处理的可靠性与顺序性。
    *   代码映射：[eventbus.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/core/dbeventbus/eventbus.go)

### 2.2 资产服务 (Asset Service)
负责管理整个系统中静态资产的生命周期，包括保存、查询、缓存淘汰以及关联关系的处理。
*   **核心逻辑**：[service.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/core/asset-service/service.go)
*   **数据库持久化**：[repository.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/core/asset-service/repository.go)
*   **本地文件读写**：[file-service.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/core/asset-service/file-service.go)

### 2.3 资产获取器 (Asset Fetcher)
并发的 HTTP 客户端，用于主动向外部目标网站请求资源（如 Chunk 文件或 Source Maps），内置了速率限制（Rate Limiting）。
*   代码映射：[service.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/core/asset-fetcher/service.go)

### 2.4 作用域检查器 (Scope Checker)
根据用户配置的通配符正则模式过滤请求，防止抓取非目标域名的多余流量。
*   代码映射：[scope-checker.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/jxscout/scope-checker.go)

### 2.5 数据库管理 (Database)
提供 SQLite 数据库的初始化和连接，用于存储资产元数据、AST 分析结果以及事件队列。
*   代码映射：[database.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/core/database/database.go)

### 2.6 通信服务 (HTTP & WebSocket Server)
*   **HTTP API**：提供 REST 接口（如获取资产列表、控制 Overrides 等）。
    *   代码映射：[http.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/jxscout/http.go)
*   **WebSocket 服务**：用于向 VSCode 插件实时推送 AST 分析结果和系统状态。
    *   代码映射：[websocket.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/core/websocket/websocket.go)

---

## 3. 关键业务逻辑与模块映射
所有的扩展功能都封装在 `internal/modules` 目录下，并实现统一的 `Module` 接口：

### 3.1 流量摄入 (Ingestion)
处理代理推送过来的数据包并将其存入系统的核心流程。
*   **通用摄入控制**：[ingestion.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/ingestion/ingestion.go)
*   **HTML 资源解析**（提取其中的内嵌 JS 及关联 JS）：[html-ingestion.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/html-ingestion/html-ingestion.go)
*   **JavaScript 资源摄入**：[js-ingestion.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/js-ingestion/js-ingestion.go)

### 3.2 块发现模块 (Chunk Discoverer)
分析 JS 代码，提取打包工具（Webpack、Vite）定义的异步 Chunk，在后台自动发起下载并补全静态资源。
*   **Go 逻辑包装与并发控制**：[module.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/chunk-discoverer/module.go)
*   **JS 提取执行脚本**（使用 Bun 执行）：[chunk-discoverer.js](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/chunk-discoverer/chunk-discoverer.js)

### 3.3 代码美化 (Beautifier)
当文件被写入磁盘时触发，自动使用 Prettier 对压缩的 JS 代码进行美化。
*   代码映射：[beautifier.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/beautifier/beautifier.go)

### 3.4 源码映射反向解析 (Source Maps Reverse)
检测到 `.map` 文件时，解析映射关系并重构出原始未打包的前端源码。
*   **核心反向逻辑**：[sourcemaps.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/sourcemaps/sourcemaps.go)
*   **解析逻辑**：[parser.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/sourcemaps/parser.go)

### 3.5 AST 语法树分析 (AST Analyzer)
对抓取的 JavaScript 进行静态语法树分析，识别关键接口、路由、API 凭证和敏感函数。
*   **分析控制器与数据写入**：[module.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/ast-analyzer/module.go)
*   **分析格式化转换**：[format.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/ast-analyzer/format.go)
*   **JS AST 解析核心实现**：[ast-analyzer.js](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/ast-analyzer/ast-analyzer.js)

#### 3.5.1 AST 匹配与记录的模式清单
AST 扫描模块会通过以下细分的分析器，匹配并记录代码中的危险或有趣特征：

1.  **敏感信息与凭证密钥 (Secrets)**
    *   代码映射：[secrets.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/secrets.ts)
    *   匹配规则：利用正则表达式库匹配各种服务凭证。不仅包括原有的 AWS 密钥/S3 桶、私钥证书、Stripe、Github/Gitlab Token 等，还**新增扩展了中国本土各大云厂商凭证**（阿里云 Aliyun AK、腾讯云 AK/APIGW Key、华为云 AK、火山引擎、金山云、京东云、百度云、UCloud、青云等）、各类 Webhook 机器人 Token（飞书、钉钉、企业微信）、JDBC 数据库连接串、地图 Key 等。同时引入了对象存储桶 URL（ALIYUN_OSS, TENCENT_COS, HUAWEI_OBS 等）的检测正则，并支持通过排除规则列表过滤纯色、百分比、常见 MIME 等噪声。
2.  **API 路径与域名识别 (Endpoints)**
    *   **接口与硬编码路径**：提取字符串或模板字面量拼接处的 API 路径，标记包含 `/api`、带有 query 或 fragment 的路径。[robust-paths.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/robust-paths.ts)
    *   **注入参数审计**：分析提取路径的 Query 参数中是否包含 SSRF 注入点（如 `url=`, `src=` 等）、命令注入点（如 `cmd=`, `exec=` 等）以及 JSONP 回调参数关键字，并在命中的情况下自动附加 `"ssrf-parameter"`、`"cmd-injection-parameter"` 或 `"jsonp-parameter"` 标签。
    *   **主机名**：匹配字符串字面量中存在的有效域名。[hostname.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/hostname.ts)
    *   **GraphQL 端点**：匹配 GraphQL 接口特征及 Query 代码结构。[graphql.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/graphql.ts)
3.  **DOM XSS 与客户端安全漏洞风险 (Client-Side Vulnerabilities)**
    *   **危险 DOM 写入**：检测对不安全属性的赋值（`innerHTML`、`outerHTML`、`srcDoc`）和函数调用（`document.write`、`document.writeln`、`insertAdjacentHTML`、`createContextualFragment`、`setInnerHTML` 等），以及对 jQuery 对象调用的 DOM 操作（`html`, `append`, `prepend`, `after`, `before` 等）。[inner-html.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/inner-html.ts)
    *   **React 危险 HTML**：匹配 JSX 中的 `dangerouslySetInnerHTML` 属性使用。[react-dangerously-set-inner-html.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/react-dangerously-set-inner-html.ts)
    *   **动态执行 (Eval)**：匹配 `eval()`、`Function()` 构造函数、以及使用字符串传参的 `setTimeout` / `setInterval`，并扩展了对 `execScript`、`executeScript` 以及 jQuery 的 `$.globalEval` 的检测。[eval.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/eval.ts)
    *   **开放重定向 (Open Redirection)**：监测对 `location.href`、`window.location` 赋值以及调用 `location.replace` / `location.assign`、`window.open`。[location.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/location.ts) / [window-open.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/window-open.ts)
    *   **跨域 Message 传输**：匹配 `postMessage()` 的调用（重点审计是否滥用通配符 `*` 目标源）及消息监听器赋值（`addEventListener('message')`, `onmessage`）。[postmessage.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/postmessage.ts) / [add-event-listener.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/add-event-listener.ts) / [onmessage.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/onmessage.ts)
4.  **数据操控与浏览器存储 (Storage)**
    *   **Cookie 操控**：识别对 `document.cookie` 的交互与读写风险。[cookie.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/cookie.ts)
    *   **HTML5 本地存储**：监测 `localStorage` 与 `sessionStorage` 的敏感数据存取。[local-storage.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/local-storage.ts) / [session-storage.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/session-storage.ts)
    *   **特殊数据操作**：监测 `document.domain` 的动态更改，`URLSearchParams` 的实例化，以及 `window.name` 状态通道的存取。[document-domain.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/document-domain.ts) / [url-search-params.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/url-search-params.ts) / [window-name.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/window-name.ts)
5.  **网络交互与正则模式**
    *   **Fetch 请求与其配置**：匹配 `fetch()` 及其接收的 Options 参数（如 headers, credentials）。[fetch.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/fetch.ts) / [fetch-options.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/fetch-options.ts)
    *   **HTTP 方法**：硬编码的 HTTP 请求动词匹配。[http-methods.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/http-methods.ts)
    *   **正则表达式执行**：审计 `RegExp` 初始化以及 `.match()` / `.exec()` / `.test()` 的使用。[regex-pattern.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/regex-pattern.ts) / [regex-match.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/regex-match.ts)
6.  **加密、哈希与编码函数 (Cryptography & Encoding)**
    *   代码映射：[crypto.ts](file:///home/hou8/codebase/edc-mind/vendors/jxscout/pkg/ast-analyzer/tree-analyzers/crypto.ts)
    *   匹配规则：检测各类常见的加密函数库（`CryptoJS.AES` / `CryptoJS.DES` / `CryptoJS.enc` 等 CryptoJS 各模块、`JSEncrypt`、`forge.pki`/`forge.cipher` 等 forge 模块、`sjcl` 模块、`SubtleCrypto`、`tweetnacl`/`nacl` 等）、哈希算法（`md5`、`sha1`、`sha256`、`sha512`、`bcrypt`、`scrypt`、`pbkdf2`、`CRC32`、`KJUR`等）以及编码/解码函数（`btoa`、`atob`、`Base64.encode`、`base64.b64decode`、`encodeURIComponent`、`decodeURIComponent`、`escape`、`unescape` 等）。

### 3.6 规则覆盖 (Overrides)
支持把浏览器对特定 JS 的请求拦截，重定向回本地已修改的文件（仅支持 Caido 代理）。
*   **Caido 客户端对接**：[caido-client.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/overrides/caido-client.go)
*   **模块入口与监听控制**：[module.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/overrides/module.go)

### 3.7 Git 自动提交 (Git Committer)
每隔一段时间自动将捕获的项目静态资产推送到本地的 Git 仓库，方便进行历史版本比对。
*   代码映射：[git-commiter.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/git-committer/git-commiter.go) 与 [git-service.go](file:///home/hou8/codebase/edc-mind/vendors/jxscout/internal/modules/git-committer/git-service.go)

---

## 4. 系统边界与外部交互
JXScout 作为一个中间件工具，其系统边界主要包含以下四个方面：

1. **Proxy Plugins (上游代理系统)**:
   - 依赖外部代理（Burp Suite 或 Caido）的专属插件，将捕获到的网络流量主动推送到 JXScout 的 HTTP 监听端口。
2. **Target Web Servers (目标网络)**:
   - JXScout (`Asset Fetcher`) 会直接向目标 Web 服务器发送后续请求，以补全未在代理流量中出现的资源（如 Source Maps、Chunks）。
3. **Local File System & SQLite (本地存储)**:
   - **File System**: 保存所有下载、美化及还原后的代码文件，按项目组织目录。
   - **SQLite DB**: 作为持久化存储层，保存资产元数据、文件依赖拓扑图、AST 扫描结果等状态。
4. **VSCode Extension (下游客户端)**:
   - 提供定制化前端视图。通过 HTTP API 和 WebSocket 连接 JXScout 核心服务，将 AST 分析结果等以树状图的形式展示给安全研究人员，支持互动和拷贝操作。
