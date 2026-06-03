# JXScout HTTP API 接口规范文档

本文档详细记录了 JXScout 提供的所有 HTTP API 端点，主要包含**配置管理**与**网络流量数据摄入**两大类。

HTTP 服务默认监听在本地：`http://localhost:3333`（端口可通过启动参数 `-port` 或 TUI 中的 `config port` 命令修改）。

---

## 1. 通用 API 响应格式

所有 API 响应均采用标准的 JSON 包装格式：

### 成功响应示例
```json
{
  "success": true,
  "result": { ... }
}
```

### 失败响应示例
```json
{
  "success": false,
  "error": "错误原因说明"
}
```

---

## 2. 配置管理接口 (Configuration APIs)

用于动态查询与实时更改 JXScout 运行选项（包括项目空间名称、白名单 Scope、黑名单 Scope Exclude）。

### 2.1 获取当前配置 [GET]
获取当前活跃的配置参数。

* **接口路径**：`GET /config`
* **请求头**：`Accept: application/json`
* **回包结果 (`result`) 字段说明**：
  | 字段名 | 类型 | 说明 |
  | :--- | :--- | :--- |
  | `project-name` | `string` | 当前的扫描项目名称（决定了本地数据存放的目录和数据库名）。 |
  | `scope` | `array[string]` | 白名单匹配规则，支持 `*` 通配符。 |
  | `scope-exclude` | `array[string]` | 黑名单排除规则，支持 `*` 通配符。黑名单优先级高于白名单。 |

* **响应示例**：
```json
{
  "success": true,
  "result": {
    "project-name": "default",
    "scope": ["*google*"],
    "scope-exclude": ["*analytics*"]
  }
}
```

---

### 2.2 动态更新配置 [POST]
局部更新 JXScout 配置参数。

* **接口路径**：`POST /config`
* **请求头**：`Content-Type: application/json`
* **请求参数 (JSON Body)**：
  以下所有参数均可选，若不传递某参数则保持原本的配置不变。
  * `project-name` (`string`): 变更项目空间名称（不能传空字符串）。
  * `scope` (`array[string]`): 白名单新规则列表（传入 `[]` 清空）。
  * `scope-exclude` (`array[string]`): 黑名单新规则列表（传入 `[]` 清空）。

* **更新行为与热重载逻辑**：
  * **动态应用（免重启）**：如果只修改了 `scope` 或 `scope-exclude`，系统会在**内存中直接热重载新的 Scope 规则匹配引擎**并保存至 `config.yaml`。此过程不会中断当前的 HTTP 服务。
  * **切换项目（延迟重启）**：如果修改了 `project-name`，系统会把最新合并的配置写入新项目的 `config.yaml`，并在完成本次 HTTP 响应后的 **500 毫秒后自动触发 Restart 流程**，以无缝重载新项目的数据库连接和工作空间。

* **请求示例 (仅更新 Scope 过滤规则)**：
```json
{
  "scope": ["*example.com*"],
  "scope-exclude": ["*metrics*", "*logger*"]
}
```

* **响应示例 (仅更新 Scope)**：
```json
{
  "success": true,
  "result": {
    "project-name": "default",
    "scope": ["*example.com*"],
    "scope-exclude": ["*metrics*", "*logger*"]
  }
}
```

* **请求示例 (切换项目)**：
```json
{
  "project-name": "new-target-project"
}
```

* **响应示例 (切换项目)**：
```json
{
  "success": true,
  "result": {
    "message": "Project name updated. Restarting jxscout...",
    "project-name": "new-target-project"
  }
}
```

---

## 3. 数据摄入接口 (Ingestion APIs)

用于向 JXScout 喂入抓取或代理捕获的 HTTP 流量包，触发静态文件自动提取、美化与安全扫描。

### 3.1 结构化数据摄入 [POST]
摄入结构化的请求与响应报文。

* **接口路径**：`POST /ingest`
* **请求头**：`Content-Type: application/json`
* **请求参数 (JSON Body)**：
  * `request` (`object`): HTTP 请求结构
    * `method` (`string`): 请求方法，如 `"GET"`, `"POST"`.
    * `url` (`string`): 完整的请求 URL（例如：`https://example.com/assets/index.js`）。
    * `headers` (`object`): 键值对形式的 HTTP 请求头。
  * `response` (`object`): HTTP 响应结构
    * `status` (`int`): HTTP 状态码，如 `200`.
    * `headers` (`object`): 键值对形式的 HTTP 响应头。
    * `body` (`string`): 响应主体内容文本（如 JS 文件代码、HTML 页面源码等）。

* **回包状态码**：成功投递将返回 `202 Accepted`。
* **请求示例**：
```json
{
  "request": {
    "method": "GET",
    "url": "https://example.com/js/app.js",
    "headers": {
      "User-Agent": "Mozilla/5.0"
    }
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/javascript"
    },
    "body": "console.log('hello world');"
  }
}
```
* **响应示例**：
```json
{
  "success": true,
  "result": null
}
```

---

### 3.2 Caido 原生流量数据摄入 [POST]
接收 Caido 代理工具导出的原生（Raw）HTTP 报文的字符流进行处理。

* **接口路径**：`POST /caido-ingest`
* **请求头**：`Content-Type: application/json`
* **请求参数 (JSON Body)**：
  * `requestUrl` (`string`): 请求的完整 URL。
  * `request` (`string`): 未经任何解析的**原始 HTTP 请求报文字符串**（包含请求行、首部以及请求体，换行使用 `\r\n` 分割）。
  * `response` (`string`): 未经任何解析的**原始 HTTP 响应报文字符串**（包含状态行、首部以及响应体，换行使用 `\r\n` 分割）。

* **回包状态码**：成功接收解析将返回 `202 Accepted`。
* **请求示例**：
```json
{
  "requestUrl": "https://example.com/main.js",
  "request": "GET /main.js HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Caido\r\n\r\n",
  "response": "HTTP/1.1 200 OK\r\nContent-Type: application/javascript\r\nContent-Length: 26\r\n\r\nconsole.log('Caido Ingest');"
}
```
* **响应示例**：
```json
{
  "success": true,
  "result": null
}
```
