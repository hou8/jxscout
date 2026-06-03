# JXScout AST 漏洞挖掘特征评分算法文档

本文档定义了 JXScout 从 AST 提取的静态信息特征（AnalyzerMatch）的测试优先级评分算法。本算法完全从**漏洞赏金挖掘（Bug Bounty）实战**角度设计，旨在精准筛选出极具挖掘价值的高危特征，抑制无价值的噪音数据。

## 1. 评分算法概述

### 1.1 评估维度与分值语义
*   **评估维度**：单条 `AnalyzerMatch` 级别。即每收到一条 AST 分析结果，根据其 `analyzerName`、`tags` 和 `value` 综合计算。
*   **分值语义**：0 - 10 分（支持 0.5 步长）。分数代表**后续安全测试的优先级权重**，分数越高表示该特征越值得优先投入人工或自动化测试资源。

### 1.2 计算模型
采用 **「基础分 + 标签调整分 + 内容匹配调整分」** 模式。
*   **基础分**：每种 `analyzerName` 拥有一个固定的初始挖掘价值分数。
*   **短路机制**：对于某些确定性极高的发现（如明显的凭据泄露，且排除明显的测试伪造数据），直接赋予满分（10.0 分）并跳过后续计算。
*   **标签调整分**：基于 `tags` 的存在进行加分或减分。如果一条数据命中多个 tag 的调整规则，**取所有命中规则中的最高分作为标签调整分**（不叠加）。
*   **内容匹配调整分**：基于 `value` 命中高危词典（如 `admin`、`token`）进行额外加分。
*   **最低分与阈值控制**：对于低价值/噪声数据（如静态图片资源）允许减分至 0 分（保留数据但不优先展示）；最终总分强制限制（Clamp）在 `[0.0, 10.0]` 范围内。

---

## 2. 静态分析特征分类与分值设计

本章节详细定义所有 19 种分析器的基础分和调整逻辑。**所有的匹配规则和字典均已穷举，不存在模棱两可的定义。**

### 2.1 凭证密钥类 (Secrets)
*   **常规基础分**：8.0
*   **短路规则**：如果 `analyzerName == "secrets"`，且 `value` 匹配 `HIGH_CONFIDENCE_SECRETS` 字典中的正则表达式，**并且**不匹配 `FALSE_POSITIVE_SECRETS_KEYWORDS` 字典，直接返回 **10.0 分**。
*   **标签调整 (取最高)**：
    *   `secret-type-*` 模式标签存在时不做额外调整（信息已体现在基础分和短路规则中）

### 2.2 路径与域名类 (Endpoints, Hostname, GraphQL)
*   **Endpoints (`endpoints`)**
    *   **基础分**：3.5
    *   **标签调整 (取最高)**：
        *   `cmd-injection-parameter` -> +5.0 (极具价值的命令注入参数)
        *   `ssrf-parameter` -> +4.5 (极具价值的 SSRF 参数)
        *   `jsonp-parameter` -> +3.0
        *   `api` -> +2.0
        *   `is-url` -> +1.0 (完整 URL 比纯路径略有价值，可能暴露内部服务地址)
        *   `query` -> +1.5
        *   `is-path-only` -> +0.0 (纯路径，不额外调整)
        *   `is-url-only` -> -1.0 (仅含域名无路径，信息量有限)
        *   `is-extension` 且后缀命中 `STATIC_EXTENSIONS` -> -3.5 (纯静态资源降级处理)
*   **Hostname (`hostname`)**
    *   **基础分**：3.0
    *   **标签调整**：`hostname-string` -> +0.0 (信息性标签，不额外调整)
*   **GraphQL (`graphql`)**
    *   **基础分**：5.5
    *   **标签调整 (取最高)**：
        *   `graphql-mutation` -> +2.5 (Mutation 可直接修改服务端数据，在 Bug Bounty 中是首要测试目标：IDOR/权限绕过/批量操作)
        *   `graphql-query` -> +1.0
        *   `graphql-other` -> +0.0 (如 subscription 等，信息量有限)
    *   **内容匹配**：`value` 命中 `GRAPHQL_SENSITIVE_KEYWORDS` 词典时额外 +2.0（GraphQL 查询中包含敏感操作名/字段名意味着直接触及权限、认证或敏感数据边界）

### 2.3 客户端安全风险类 (Client-Side Vulnerabilities)
在 Bug Bounty 中，DOM XSS 挖掘极具性价比。本节同时关注 **Source（用户可控输入点）** 和 **Sink（危险执行点）** 的评分。

*   **DOM Sinks (`dom-sinks`)**
    *   **基础分**：5.5
    *   **标签调整 (取最高)**：
        *   `dangerouslySetInnerHTML-jsx` / `dangerouslySetInnerHTML-object` -> +2.5
        *   `dom-sink-document.write` / `dom-sink-insertAdjacentHTML` -> +2.5
        *   `inner-html` -> +2.0
        *   `dom-sink-jQuery.html` / `dom-sink-jQuery.append` / `dom-sink-jQuery.prepend` / `dom-sink-jQuery.wrap` / `dom-sink-jQuery.wrapAll` / `dom-sink-jQuery.replaceAll` / `dom-sink-jQuery.insertAfter` / `dom-sink-jQuery.insertBefore` -> +2.0
*   **动态执行 (`eval`)**
    *   **基础分**：6.0
    *   **标签调整 (取最高)**：
        *   `eval` / `eval-type-Function` / `eval-type-execScript` / `eval-type-globalEval` -> +2.5
        *   `eval-type-setTimeout` / `eval-type-setInterval` -> +1.5 (注意：实战中定时器传入字符串同样是 XSS Sink，故依然加分)
*   **开放重定向 (`location`)**
    *   **基础分**：5.0
    *   **标签调整 (取最高)**：
        *   `location-assignment` -> +3.0 (直接赋值 location 是高危重定向 Sink)
        *   `location-read` -> +2.0 (读取 `location.search`/`location.hash` 等是 DOM XSS 的经典 Source，发现 Source 意味着可寻找对应 Sink 构成完整攻击链)
        *   `property-href` / `property-search` / `property-hash` / `property-pathname` -> +0.0 (属性细节为信息性标签)
*   **窗口弹出 (`window-open`)**
    *   **基础分**：3.0
*   **Web Messaging (`web-messaging`)**
    *   **基础分**：5.5
    *   **标签调整 (取最高)**：
        *   `onmessage` -> +3.0 (接收端未校验 Origin 极易导致严重问题)
        *   `postMessage` -> +1.5
*   **事件监听 (`add-event-listener`)**
    *   **基础分**：1.5
    *   **标签调整 (取最高)**：
        *   `event-type-message` -> +3.0 (等同于 `onmessage`，是跨域消息接收的 Sink)
        *   `event-type-hashchange` -> +2.5 (hash 变更常被用作 DOM XSS 的 Source 触发器)
        *   `event-listener` -> +0.0 (通用事件监听标签，不额外调整)
*   **Hash 变更 (`onhashchange`)**
    *   **基础分**：4.0

### 2.4 数据操控与存储类 (Storage)
*   **Cookie (`cookie`)**
    *   **基础分**：4.5
    *   **标签调整 (取最高)**：
        *   `cookie-assignment` -> +2.5 (写入 Cookie 可能导致 Session Fixation 或客户端投毒)
        *   `cookie-read` -> +1.0 (读取 Cookie 通常意味着数据被用于客户端逻辑，可能作为 Source)
*   **Web Storage (`web-storage`)**
    *   **基础分**：2.5
    *   **标签调整 (取最高)**：
        *   `property-setitem` -> +2.0 (向 Storage 写入数据可能暴露敏感信息存储，且若存入用户可控数据后再取出插入 DOM 可构成存储型 DOM XSS)
        *   `property-getitem` -> +1.5 (读取 Storage 作为 DOM XSS Source)
        *   `local-storage` -> +0.5 (localStorage 持久化数据风险略高于 sessionStorage)
        *   `session-storage` -> +0.0
    *   **内容匹配**：`value` 命中 `STORAGE_SENSITIVE_KEYWORDS` 词典时额外 +2.0（存储键名包含会话/凭证相关词表明正在持久化敏感数据）
*   **Window Name (`window-name`)**
    *   **基础分**：4.0
    *   **标签调整 (取最高)**：
        *   `window-name-read` -> +2.0 (作为跨域数据载体容易被用于 DOM XSS Source)
        *   `window-name-assignment` -> +1.0 (写入 window.name 表明数据被主动传递)
*   **URL 参数解析 (`url-search-params`)**
    *   **基础分**：3.5 (URLSearchParams 实例化是 DOM XSS Source 的明确信号：开发者正在从 URL 中提取用户可控参数)
*   **文档域修改 (`document-domain`)**
    *   **基础分**：5.5 (注：现代浏览器已逐步弃用 `document.domain` 放松同源策略，Chrome 115+ 默认禁用。但在 Bug Bounty 中仍需关注旧版浏览器兼容场景和遗留代码)
    *   **标签调整 (取最高)**：
        *   `domain-assignment` -> +2.5 (主动修改域边界是严重的安全行为)
        *   `domain-read` -> +0.5 (读取当前域信息，通常用于条件判断)

### 2.5 网络请求与加密类 (Network / Regex / Crypto)
*   **HTTP 请求 (`http-requests`)**
    *   **基础分**：4.0
    *   **标签调整 (取最高)**：
        *   `fetch-call` -> +1.0 (直接的 fetch 调用标记，可进一步结合 URL 分析)
        *   `fetch-options` -> +0.5 (请求配置对象，如含 credentials/headers 等安全相关配置)
*   **正则表达式 (`regex`)**
    *   **基础分**：1.5
    *   **标签调整 (取最高)**：
        *   `regex-match` -> +0.0 (正则执行是常规操作)
*   **加密与算法 (`crypto`)**
    *   **基础分**：3.0
    *   **标签调整 (取最高)**：
        *   `crypto-type-crypto` -> +2.5 (直接使用加密库意味着处理敏感数据：密钥管理、加解密流程可能存在实现缺陷)
        *   `crypto-type-hash` -> +1.5 (使用哈希常见于密码处理、签名验证——可测试弱哈希算法如 MD5/SHA1)
        *   `crypto-type-encoding` -> +1.0 (btoa/atob 编码常被误用为"加密"来混淆敏感数据传输，在 Bug Bounty 中发现 Base64 编码的敏感操作常意味着可解码获取原始数据)

---

## 3. 全局高危内容词典 (Dictionaries)

为了消除评分系统的不确定性，以下所有的字典和正则均全量列出，不使用"等"做模糊指代。

### 3.1 极高确信度凭证正则集 (HIGH_CONFIDENCE_SECRETS)
用于 `secrets` 发现的短路满分判定：
*   AWS Access Key: `(?i)(AKIA[0-9A-Z]{16})`
*   GitHub Token: `(?i)(ghp_[0-9a-zA-Z]{36})`
*   GitLab Token: `(?i)(glpat-[0-9a-zA-Z\-]{20})`
*   Slack Token: `(?i)(xox[baprs]-[0-9a-zA-Z]{10,48})`
*   Stripe Key: `(?i)(sk_live_[0-9a-zA-Z]{24}|rk_live_[0-9a-zA-Z]{24})`
*   JWT Token (常见结构): `(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})`
*   RSA/SSH 私钥头: `(-----BEGIN PRIVATE KEY-----|-----BEGIN RSA PRIVATE KEY-----|-----BEGIN OPENSSH PRIVATE KEY-----)`

### 3.2 凭证假阳性排除词典 (FALSE_POSITIVE_SECRETS_KEYWORDS)
若 `secrets` 的 `value` 包含以下任意字符串（忽略大小写），则取消短路满分逻辑（退回基础评分流程）：
*   `"example"`
*   `"test"`
*   `"mock"`
*   `"dummy"`
*   `"fake"`
*   `"placeholder"`
*   `"your_"`
*   `"insert_"`
*   `"12345"`
*   `"xxxx"`

### 3.3 高危关键词词典 (HIGH_RISK_KEYWORDS)
用于 `endpoints`, `hostname`, `http-requests` 的内容匹配（命中后额外加分），忽略大小写匹配：
*   管理与内部：`"admin"`, `"internal"`, `"corp"`, `"dashboard"`, `"manage"`, `"system"`
*   安全与权限：`"secret"`, `"token"`, `"password"`, `"auth"`, `"login"`, `"register"`, `"credential"`
*   环境与测试：`"debug"`, `"test"`, `"staging"`, `"dev"`, `"beta"`, `"sandbox"`, `"env"`
*   接口与操作：`"api"`, `"graphql"`, `"shell"`, `"cmd"`, `"exec"`, `"upload"`, `"download"`, `"dump"`, `"export"`, `"backup"`, `"metrics"`, `"health"`, `"status"`, `"v1"`, `"v2"`, `"v3"`

### 3.4 纯静态资源后缀词典 (STATIC_EXTENSIONS)
用于 `endpoints` 发现时削减无价值噪音（注意：不包含 `.js`，因为 JS 路径在 Bug Bounty 中可能是极其关键的资产线索）：
*   `".css"`, `".less"`, `".scss"`
*   `".png"`, `".jpg"`, `".jpeg"`, `".gif"`, `".svg"`, `".ico"`, `".webp"`
*   `".woff"`, `".woff2"`, `".ttf"`, `".eot"`
*   `".pdf"`, `".doc"`, `".docx"`, `".xls"`, `".xlsx"`, `".ppt"`, `".pptx"`, `".csv"`
*   `".zip"`, `".tar"`, `".gz"`, `".rar"`, `".7z"`
*   `".mp3"`, `".mp4"`, `".avi"`, `".mov"`, `".wmv"`, `".flv"`, `".webm"`, `".mkv"`

### 3.5 GraphQL 敏感操作词典 (GRAPHQL_SENSITIVE_KEYWORDS)
用于 `graphql` 的 `value` 内容匹配。GraphQL 的 value 是查询/变更语句文本，以下关键词命中表示操作直接涉及权限边界或敏感数据，忽略大小写匹配：
*   权限与认证：`"admin"`, `"auth"`, `"login"`, `"logout"`, `"register"`, `"signup"`, `"password"`, `"resetPassword"`, `"changePassword"`, `"token"`, `"session"`, `"credential"`, `"verify"`, `"otp"`
*   角色与访问控制：`"role"`, `"permission"`, `"privilege"`, `"grant"`, `"revoke"`, `"ban"`, `"suspend"`, `"invite"`
*   危险操作：`"delete"`, `"remove"`, `"destroy"`, `"drop"`, `"purge"`, `"update"`, `"modify"`, `"create"`, `"insert"`, `"upload"`, `"import"`, `"export"`
*   敏感数据字段：`"email"`, `"phone"`, `"address"`, `"payment"`, `"billing"`, `"credit"`, `"card"`, `"ssn"`, `"secret"`, `"key"`, `"config"`, `"setting"`, `"internal"`

### 3.6 Storage 敏感键名词典 (STORAGE_SENSITIVE_KEYWORDS)
用于 `web-storage` 的 `value` 内容匹配。Web Storage 的 value 是 API 调用代码（如 `localStorage.setItem("jwt", val)`），以下关键词命中存储键名表示正在持久化敏感数据，忽略大小写匹配：
*   会话与凭证：`"token"`, `"jwt"`, `"session"`, `"auth"`, `"access_token"`, `"refresh_token"`, `"id_token"`, `"bearer"`
*   用户身份：`"user"`, `"admin"`, `"role"`, `"permission"`, `"credential"`, `"password"`, `"login"`
*   密钥与配置：`"secret"`, `"key"`, `"api_key"`, `"apikey"`, `"private"`, `"config"`

---

## 4. 算法伪代码 (Pseudo-code)

此伪代码是系统落地的严格参考，采用语言无关逻辑编写，所有状态明确无含糊。

```text
// 定义基础配置表
AnalyzerConfig = {
    "secrets": { base: 8.0 },
    "endpoints": { base: 3.5 },
    "hostname": { base: 3.0 },
    "graphql": { base: 5.5 },
    "dom-sinks": { base: 5.5 },
    "eval": { base: 6.0 },
    "location": { base: 5.0 },
    "window-open": { base: 3.0 },
    "web-messaging": { base: 5.5 },
    "add-event-listener": { base: 1.5 },
    "onhashchange": { base: 4.0 },
    "cookie": { base: 4.5 },
    "web-storage": { base: 2.5 },
    "window-name": { base: 4.0 },
    "url-search-params": { base: 3.5 },
    "document-domain": { base: 5.5 },
    "http-requests": { base: 4.0 },
    "regex": { base: 1.5 },
    "crypto": { base: 3.0 }
}

// 评分函数主体
FUNCTION CalculateScore(match: AnalyzerMatch) RETURNS Float:

    // 1. 短路判定 (确信度极高的敏感信息直接给满分)
    IF match.analyzerName == "secrets":
        IF 匹配正则列表(match.value, HIGH_CONFIDENCE_SECRETS) == TRUE:
            IF 包含字符串列表(match.value, FALSE_POSITIVE_SECRETS_KEYWORDS) == FALSE:
                RETURN 10.0

    // 2. 获取基础分
    baseScore = 1.0  // 默认兜底分
    IF AnalyzerConfig 包含 match.analyzerName:
        baseScore = AnalyzerConfig[match.analyzerName].base

    // 3. 计算标签调整分 (多标签命中时取最高值)
    tagAdjustment = 0.0
    adjustments = [0.0] // 初始化包含 0，防止全无匹配时出错

    IF match.analyzerName == "endpoints":
        IF match.tags 包含 "cmd-injection-parameter": adjustments.add(5.0)
        IF match.tags 包含 "ssrf-parameter": adjustments.add(4.5)
        IF match.tags 包含 "jsonp-parameter": adjustments.add(3.0)
        IF match.tags 包含 "api": adjustments.add(2.0)
        IF match.tags 包含 "is-url": adjustments.add(1.0)
        IF match.tags 包含 "query": adjustments.add(1.5)
        IF match.tags 包含 "is-url-only": adjustments.add(-1.0)
        IF match.tags 包含 "is-extension":
            // 如果文件后缀包含在纯静态资源黑名单中，给予严厉减分
            IF 后缀匹配(match.value, STATIC_EXTENSIONS) == TRUE:
                adjustments.add(-3.5)
    
    ELSE IF match.analyzerName == "graphql":
        IF match.tags 包含 "graphql-mutation": adjustments.add(2.5)
        IF match.tags 包含 "graphql-query": adjustments.add(1.0)
    
    ELSE IF match.analyzerName == "dom-sinks":
        IF match.tags 包含 "dangerouslySetInnerHTML-jsx" OR match.tags 包含 "dangerouslySetInnerHTML-object": adjustments.add(2.5)
        IF match.tags 包含 "dom-sink-document.write" OR match.tags 包含 "dom-sink-insertAdjacentHTML": adjustments.add(2.5)
        IF match.tags 包含 "inner-html": adjustments.add(2.0)
        IF match.tags 包含 "dom-sink-jQuery.html" OR match.tags 包含 "dom-sink-jQuery.append" OR match.tags 包含 "dom-sink-jQuery.prepend" OR match.tags 包含 "dom-sink-jQuery.wrap" OR match.tags 包含 "dom-sink-jQuery.wrapAll" OR match.tags 包含 "dom-sink-jQuery.replaceAll" OR match.tags 包含 "dom-sink-jQuery.insertAfter" OR match.tags 包含 "dom-sink-jQuery.insertBefore": adjustments.add(2.0)
        
    ELSE IF match.analyzerName == "eval":
        IF match.tags 包含 "eval" OR match.tags 包含 "eval-type-Function" OR match.tags 包含 "eval-type-execScript" OR match.tags 包含 "eval-type-globalEval": adjustments.add(2.5)
        IF match.tags 包含 "eval-type-setTimeout" OR match.tags 包含 "eval-type-setInterval": adjustments.add(1.5)
        
    ELSE IF match.analyzerName == "location":
        IF match.tags 包含 "location-assignment": adjustments.add(3.0)
        IF match.tags 包含 "location-read": adjustments.add(2.0)
        
    ELSE IF match.analyzerName == "web-messaging":
        IF match.tags 包含 "onmessage": adjustments.add(3.0)
        IF match.tags 包含 "postMessage": adjustments.add(1.5)

    ELSE IF match.analyzerName == "add-event-listener":
        IF match.tags 包含 "event-type-message": adjustments.add(3.0)
        IF match.tags 包含 "event-type-hashchange": adjustments.add(2.5)
        
    ELSE IF match.analyzerName == "cookie":
        IF match.tags 包含 "cookie-assignment": adjustments.add(2.5)
        IF match.tags 包含 "cookie-read": adjustments.add(1.0)

    ELSE IF match.analyzerName == "web-storage":
        IF match.tags 包含 "property-setitem": adjustments.add(2.0)
        IF match.tags 包含 "property-getitem": adjustments.add(1.5)
        IF match.tags 包含 "local-storage": adjustments.add(0.5)

    ELSE IF match.analyzerName == "window-name":
        IF match.tags 包含 "window-name-read": adjustments.add(2.0)
        IF match.tags 包含 "window-name-assignment": adjustments.add(1.0)
        
    ELSE IF match.analyzerName == "document-domain":
        IF match.tags 包含 "domain-assignment": adjustments.add(2.5)
        IF match.tags 包含 "domain-read": adjustments.add(0.5)
        
    ELSE IF match.analyzerName == "http-requests":
        IF match.tags 包含 "fetch-call": adjustments.add(1.0)
        IF match.tags 包含 "fetch-options": adjustments.add(0.5)
        
    ELSE IF match.analyzerName == "regex":
        // 仅保留 regex-match，无额外加分标签

    ELSE IF match.analyzerName == "crypto":
        IF match.tags 包含 "crypto-type-crypto": adjustments.add(2.5)
        IF match.tags 包含 "crypto-type-hash": adjustments.add(1.5)
        IF match.tags 包含 "crypto-type-encoding": adjustments.add(1.0)

    // 取最大的调整值
    tagAdjustment = max(adjustments)

    // 4. 计算内容匹配调整分 (高价值词典奖励)
    valueAdjustment = 0.0
    IF match.analyzerName IN ["endpoints", "hostname", "http-requests"]:
        IF 包含任意子串(match.value, HIGH_RISK_KEYWORDS) == TRUE:
            IF match.analyzerName == "hostname":
                valueAdjustment = 3.0
            ELSE:
                valueAdjustment = 2.5

    ELSE IF match.analyzerName == "graphql":
        IF 包含任意子串(match.value, GRAPHQL_SENSITIVE_KEYWORDS) == TRUE:
            valueAdjustment = 2.0

    ELSE IF match.analyzerName == "web-storage":
        IF 包含任意子串(match.value, STORAGE_SENSITIVE_KEYWORDS) == TRUE:
            valueAdjustment = 2.0

    // 5. 综合计算与限制范围
    finalScore = baseScore + tagAdjustment + valueAdjustment
    
    // Clamp to [0.0, 10.0]
    IF finalScore > 10.0:
        finalScore = 10.0
    IF finalScore < 0.0:
        finalScore = 0.0

    // 步长约束 (精度至 0.5)
    finalScore = Math.round(finalScore * 2.0) / 2.0
    
    RETURN finalScore
```
