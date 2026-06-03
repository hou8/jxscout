import fs from "fs";
import { ParseResult, parseSync } from "oxc-parser";
import { ancestors as traverse } from "./walker";
import { AnalyzerParams, AnalyzerMatch } from "./types";
import { graphqlAnalyzerBuilder } from "./tree-analyzers/graphql";
import { secretsAnalyzerBuilder } from "./tree-analyzers/secrets";
import { addEventListenerAnalyzerBuilder } from "./tree-analyzers/add-event-listener";
import { cookieAnalyzerBuilder } from "./tree-analyzers/cookie";
import { documentDomainAnalyzerBuilder } from "./tree-analyzers/document-domain";
import { evalAnalyzerBuilder } from "./tree-analyzers/eval";
import { fetchOptionsAnalyzerBuilder } from "./tree-analyzers/fetch-options";
import { fetchAnalyzerBuilder } from "./tree-analyzers/fetch";
import { hostnameAnalyzerBuilder } from "./tree-analyzers/hostname";
import { innerHtmlAnalyzerBuilder } from "./tree-analyzers/inner-html";
import { localStorageAnalyzerBuilder } from "./tree-analyzers/local-storage";
import { locationAnalyzerBuilder } from "./tree-analyzers/location";
import { onhashchangeAnalyzerBuilder } from "./tree-analyzers/onhashchange";
import { onmessageAnalyzerBuilder } from "./tree-analyzers/onmessage";
import { postmessageAnalyzerBuilder } from "./tree-analyzers/postmessage";
import { regexMatchAnalyzerBuilder } from "./tree-analyzers/regex-match";
import { sessionStorageAnalyzerBuilder } from "./tree-analyzers/session-storage";
import { urlSearchParamsAnalyzerBuilder } from "./tree-analyzers/url-search-params";
import { robustPathsAnalyzerBuilder } from "./tree-analyzers/robust-paths";
import { windowNameAnalyzerBuilder } from "./tree-analyzers/window-name";
import { windowOpenAnalyzerBuilder } from "./tree-analyzers/window-open";
import { dangerousHtmlAnalyzerBuilder } from "./tree-analyzers/react-dangerously-set-inner-html";
import { cryptoAnalyzerBuilder } from "./tree-analyzers/crypto";

export function parseFile(filePath: string): AnalyzerParams {
  const fileContent = fs.readFileSync(filePath, "utf-8");

  let extension: "jsx" | "tsx" = "jsx";
  if (!["ts"].includes(extension)) {
    extension = "tsx";
  }

  let parsed: ParseResult;
  try {
    parsed = parseSync(filePath, fileContent, {
      sourceType: "module",
      astType: "ts",
      lang: extension,
    });
  } catch (error) {
    parsed = parseSync(filePath, fileContent, {
      sourceType: "module",
      astType: "ts",
      lang: extension,
    });
  }

  return { ast: parsed.program, source: fileContent, filePath };
}

export type AnalyzerType =
  | "emails"
  | "postmessage"
  | "message-listener"
  | "regex-match"
  | "hash-change"
  | "regex"
  | "dom-xss"
  | "graphql"
  | "urls"
  | "jquery-dom-xss"
  | "open-redirection"
  | "cookie-manipulation"
  | "javascript-injection"
  | "document-domain-manipulation"
  | "websocket-url-poisoning"
  | "link-manipulation"
  | "ajax-request-header-manipulation"
  | "local-file-path-manipulation"
  | "html5-storage-manipulation"
  | "xpath-injection"
  | "dom-data-manipulation"
  | "common-sources"
  | "secrets"
  | "pii"
  | "extensions"
  | "add-event-listener"
  | "cookie"
  | "document-domain"
  | "eval"
  | "fetch-options"
  | "fetch"
  | "hostname"
  | "inner-html"
  | "local-storage"
  | "session-storage"
  | "location"
  | "onhashchange"
  | "onmessage"
  | "url-search-params"
  | "paths"
  | "robust-paths"
  | "window-name"
  | "window-open"
  | "dangerous-html"
  | "crypto"
  | "dom-sinks"
  | "http-requests"
  | "endpoints"
  | "web-messaging"
  | "web-storage";

const OLD_TO_NEW_MAP: Record<string, string> = {
  // DOM Sinks
  "inner-html": "dom-sinks",
  "dangerous-html": "dom-sinks",
  
  // HTTP Requests
  "fetch": "http-requests",
  "fetch-options": "http-requests",
  
  // Endpoints
  "robust-paths": "endpoints",
  
  // Regex
  "regex-match": "regex",
  
  // Web Messaging
  "postmessage": "web-messaging",
  "onmessage": "web-messaging",
  
  // Web Storage
  "local-storage": "web-storage",
  "session-storage": "web-storage"
};

export function analyzeFile(
  filePath: string,
  analyzersToRun?: AnalyzerType[]
): AnalyzerMatch[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Error: File not found: ${filePath}`);
  }

  const results: AnalyzerMatch[] = [];
  const args = parseFile(filePath);

  const createAnalyzer = <T extends { [key: string]: any }>(
    type: AnalyzerType,
    builder: (args: AnalyzerParams, results: AnalyzerMatch[]) => T
  ): T | null => {
    if (analyzersToRun) {
      const mappedRunList = analyzersToRun.map(t => OLD_TO_NEW_MAP[t] || t);
      if (!mappedRunList.includes(type)) {
        return null;
      }
    }
    return builder(args, results);
  };

  const postMessageAnalyzer = createAnalyzer(
    "web-messaging",
    postmessageAnalyzerBuilder
  );
  const graphqlAnalyzer = createAnalyzer("graphql", graphqlAnalyzerBuilder);
  const secretsAnalyzer = createAnalyzer("secrets", secretsAnalyzerBuilder);
  const addEventListenerAnalyzer = createAnalyzer(
    "add-event-listener",
    addEventListenerAnalyzerBuilder
  );
  const cookieAnalyzer = createAnalyzer("cookie", cookieAnalyzerBuilder);
  const documentDomainAnalyzer = createAnalyzer(
    "document-domain",
    documentDomainAnalyzerBuilder
  );
  const evalAnalyzer = createAnalyzer("eval", evalAnalyzerBuilder);
  const fetchOptionsAnalyzer = createAnalyzer(
    "http-requests",
    fetchOptionsAnalyzerBuilder
  );
  const fetchAnalyzer = createAnalyzer("http-requests", fetchAnalyzerBuilder);
  const hostnameAnalyzer = createAnalyzer("hostname", hostnameAnalyzerBuilder);
  const innerHtmlAnalyzer = createAnalyzer(
    "dom-sinks",
    innerHtmlAnalyzerBuilder
  );
  const localStorageAnalyzer = createAnalyzer(
    "web-storage",
    localStorageAnalyzerBuilder
  );
  const sessionStorageAnalyzer = createAnalyzer(
    "web-storage",
    sessionStorageAnalyzerBuilder
  );
  const locationAnalyzer = createAnalyzer("location", locationAnalyzerBuilder);
  const onhashchangeAnalyzer = createAnalyzer(
    "onhashchange",
    onhashchangeAnalyzerBuilder
  );
  const onmessageAnalyzer = createAnalyzer(
    "web-messaging",
    onmessageAnalyzerBuilder
  );
  const regexMatchAnalyzer = createAnalyzer(
    "regex",
    regexMatchAnalyzerBuilder
  );

  const urlSearchParamsAnalyzer = createAnalyzer(
    "url-search-params",
    urlSearchParamsAnalyzerBuilder
  );
  const robustPathsAnalyzer = createAnalyzer(
    "endpoints",
    robustPathsAnalyzerBuilder
  );
  const windowNameAnalyzer = createAnalyzer(
    "window-name",
    windowNameAnalyzerBuilder
  );
  const windowOpenAnalyzer = createAnalyzer(
    "window-open",
    windowOpenAnalyzerBuilder
  );
  const dangerousHtmlAnalyzer = createAnalyzer(
    "dom-sinks",
    dangerousHtmlAnalyzerBuilder
  );
  const cryptoAnalyzer = createAnalyzer("crypto", cryptoAnalyzerBuilder);

  traverse(args.source, args.ast, {
    Literal(node, ancestors) {
      graphqlAnalyzer?.Literal?.(node, ancestors);
      secretsAnalyzer?.Literal?.(node, ancestors);
      hostnameAnalyzer?.Literal?.(node, ancestors);
      robustPathsAnalyzer?.Literal?.(node, ancestors);
    },
    NewExpression(node, ancestors) {
      urlSearchParamsAnalyzer?.NewExpression?.(node, ancestors);
    },
    TemplateLiteral(node, ancestors) {
      robustPathsAnalyzer?.TemplateLiteral?.(node, ancestors);
      graphqlAnalyzer?.TemplateLiteral?.(node, ancestors);
    },
    CallExpression(node, ancestors) {
      postMessageAnalyzer?.CallExpression?.(node, ancestors);
      addEventListenerAnalyzer?.CallExpression?.(node, ancestors);
      cookieAnalyzer?.CallExpression?.(node, ancestors);
      documentDomainAnalyzer?.CallExpression?.(node, ancestors);
      evalAnalyzer?.CallExpression?.(node, ancestors);
      fetchOptionsAnalyzer?.CallExpression?.(node, ancestors);
      fetchAnalyzer?.CallExpression?.(node, ancestors);
      hostnameAnalyzer?.CallExpression?.(node, ancestors);
      innerHtmlAnalyzer?.CallExpression?.(node, ancestors);
      localStorageAnalyzer?.CallExpression?.(node, ancestors);
      sessionStorageAnalyzer?.CallExpression?.(node, ancestors);
      locationAnalyzer?.CallExpression?.(node, ancestors);
      onhashchangeAnalyzer?.CallExpression?.(node, ancestors);
      onmessageAnalyzer?.CallExpression?.(node, ancestors);
      regexMatchAnalyzer?.CallExpression?.(node, ancestors);
      windowOpenAnalyzer?.CallExpression?.(node, ancestors);
      robustPathsAnalyzer?.CallExpression?.(node, ancestors);
    },
    AssignmentExpression(node, ancestors) {
      postMessageAnalyzer?.AssignmentExpression?.(node, ancestors);
      addEventListenerAnalyzer?.AssignmentExpression?.(node, ancestors);
      cookieAnalyzer?.AssignmentExpression?.(node, ancestors);
      documentDomainAnalyzer?.AssignmentExpression?.(node, ancestors);
      fetchOptionsAnalyzer?.AssignmentExpression?.(node, ancestors);
      fetchAnalyzer?.AssignmentExpression?.(node, ancestors);
      hostnameAnalyzer?.AssignmentExpression?.(node, ancestors);
      innerHtmlAnalyzer?.AssignmentExpression?.(node, ancestors);
      localStorageAnalyzer?.AssignmentExpression?.(node, ancestors);
      sessionStorageAnalyzer?.AssignmentExpression?.(node, ancestors);
      locationAnalyzer?.AssignmentExpression?.(node, ancestors);
      onhashchangeAnalyzer?.AssignmentExpression?.(node, ancestors);
      onmessageAnalyzer?.AssignmentExpression?.(node, ancestors);
      windowNameAnalyzer?.AssignmentExpression?.(node, ancestors);
    },
    MemberExpression(node, ancestors) {
      postMessageAnalyzer?.MemberExpression?.(node, ancestors);
      addEventListenerAnalyzer?.MemberExpression?.(node, ancestors);
      cookieAnalyzer?.MemberExpression?.(node, ancestors);
      documentDomainAnalyzer?.MemberExpression?.(node, ancestors);
      fetchOptionsAnalyzer?.MemberExpression?.(node, ancestors);
      fetchAnalyzer?.MemberExpression?.(node, ancestors);
      hostnameAnalyzer?.MemberExpression?.(node, ancestors);
      innerHtmlAnalyzer?.MemberExpression?.(node, ancestors);
      localStorageAnalyzer?.MemberExpression?.(node, ancestors);
      sessionStorageAnalyzer?.MemberExpression?.(node, ancestors);
      locationAnalyzer?.MemberExpression?.(node, ancestors);
      windowNameAnalyzer?.MemberExpression?.(node, ancestors);
      cryptoAnalyzer?.MemberExpression?.(node, ancestors);
    },
    Identifier(node, ancestors) {
      cryptoAnalyzer?.Identifier?.(node, ancestors);
    },
    VariableDeclarator(node, ancestors) {
      documentDomainAnalyzer?.VariableDeclarator?.(node, ancestors);
    },
    ObjectExpression(node, ancestors) {
      fetchOptionsAnalyzer?.ObjectExpression?.(node, ancestors);
      dangerousHtmlAnalyzer?.ObjectExpression?.(node, ancestors);
    },
    JSXElement(node, ancestors) {
      dangerousHtmlAnalyzer?.JSXElement?.(node, ancestors);
    },
    BinaryExpression(node, ancestors) {
      robustPathsAnalyzer?.BinaryExpression?.(node, ancestors);
    },
  });

  return results;
}
