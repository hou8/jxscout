import { Node } from "acorn";
import { Analyzer, AnalyzerMatch, AnalyzerParams } from "../types";
import { Visitor } from "../walker";

export const CRYPTO_ANALYZER_NAME = "crypto";

const CRYPTO_FUNCTIONS = new Set([
  "CryptoJS.AES",
  "CryptoJS.DES",
  "CryptoJS.TripleDES",
  "CryptoJS.RC4",
  "CryptoJS.Rabbit",
  "CryptoJS.MD5",
  "CryptoJS.SHA1",
  "CryptoJS.SHA256",
  "CryptoJS.SHA512",
  "CryptoJS.HmacSHA256",
  "CryptoJS.HmacSHA512",
  "CryptoJS.enc",
  "JSEncrypt",
  "forge.pki",
  "forge.cipher",
  "forge.md",
  "forge.hmac",
  "sjcl.encrypt",
  "sjcl.decrypt",
  "crypto.subtle",
  "SubtleCrypto",
  "nacl.secretbox",
  "nacl.box",
  "tweetnacl"
]);

const ENCODING_FUNCTIONS = new Set([
  "btoa",
  "atob",
  "Base64.encode",
  "Base64.decode",
  "base64.b64encode",
  "base64.b64decode",
  "encodeURIComponent",
  "decodeURIComponent",
  "escape",
  "unescape",
  "TextEncoder",
  "TextDecoder"
]);

const HASH_FUNCTIONS = new Set([
  "md5",
  "sha1",
  "sha256",
  "sha512",
  "$.md5",
  "CRC32",
  "bcrypt",
  "pbkdf2",
  "scrypt",
  "KJUR"
]);

function getMemberExpressionString(node: Node): string | null {
  if (node.type === "Identifier") {
    return node.name;
  }
  if (node.type === "MemberExpression") {
    const memberNode = node as any;
    const objectStr = getMemberExpressionString(memberNode.object);
    if (!objectStr) return null;
    if (memberNode.property.type === "Identifier") {
      return `${objectStr}.${memberNode.property.name}`;
    }
  }
  return null;
}

const cryptoAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[]
): Visitor => {
  const addMatch = (node: Node, type: string, name: string) => {
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: CRYPTO_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc!.start,
      end: node.loc!.end,
      tags: {
        crypto: true,
        [`crypto-type-${type}`]: true,
        [`crypto-func-${name.toLowerCase().replace(/\./g, "-")}`]: true,
      },
    };
    matchesReturn.push(match);
  };

  return {
    Identifier(node, ancestors) {
      if (!node.loc) return;
      
      // Skip if it is part of a MemberExpression that we will process as a whole
      const isPartOfMemberExpr = ancestors.some(a => a.type === "MemberExpression");
      if (isPartOfMemberExpr) return;

      const name = node.name;
      if (CRYPTO_FUNCTIONS.has(name)) {
        addMatch(node, "crypto", name);
      } else if (ENCODING_FUNCTIONS.has(name)) {
        addMatch(node, "encoding", name);
      } else if (HASH_FUNCTIONS.has(name)) {
        addMatch(node, "hash", name);
      }
    },

    MemberExpression(node, ancestors) {
      if (!node.loc) return;

      // Skip if this MemberExpression is nested inside another MemberExpression to avoid double matching
      const isNestedInMember = ancestors.some(
        a => a.type === "MemberExpression" && a !== node
      );
      if (isNestedInMember) return;

      const name = getMemberExpressionString(node);
      if (!name) return;

      if (CRYPTO_FUNCTIONS.has(name)) {
        addMatch(node, "crypto", name);
      } else if (ENCODING_FUNCTIONS.has(name)) {
        addMatch(node, "encoding", name);
      } else if (HASH_FUNCTIONS.has(name)) {
        addMatch(node, "hash", name);
      }
    }
  };
};

export { cryptoAnalyzerBuilder };
