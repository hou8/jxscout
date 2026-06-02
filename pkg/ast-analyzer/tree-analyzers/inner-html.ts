import { Node, MemberExpression } from "acorn";
import { Analyzer, AnalyzerMatch, AnalyzerParams } from "../types";
import { Visitor } from "../walker";

export const INNER_HTML_ANALYZER_NAME = "inner-html";

const DANGEROUS_ASSIGNMENTS = ["innerHTML", "outerHTML", "srcDoc"];
const DANGEROUS_CALLS = ["write", "writeln", "insertAdjacentHTML", "createContextualFragment", "setInnerHTML"];
const JQUERY_DANGEROUS_CALLS = ["html", "append", "prepend", "after", "before"];

const innerHtmlAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[]
): Visitor => {
  return {
    AssignmentExpression(node, ancestors) {
      if (!node.loc) {
        return;
      }

      // Check if this is an innerHTML/outerHTML/srcDoc assignment
      if (
        node.left.type === "MemberExpression" &&
        node.left.property.type === "Identifier" &&
        DANGEROUS_ASSIGNMENTS.includes(node.left.property.name)
      ) {
        const propName = node.left.property.name;
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: INNER_HTML_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          tags: {
            "inner-html": true,
            [`dom-sink-${propName.toLowerCase()}`]: true,
          },
        };

        matchesReturn.push(match);
      }
    },

    CallExpression(node, ancestors) {
      if (!node.loc) {
        return;
      }

      let isDangerousCall = false;
      let callName = "";

      // 1. Direct Calls or Member Calls like document.write(...)
      if (node.callee.type === "MemberExpression") {
        const callee = node.callee as MemberExpression;
        if (callee.property.type === "Identifier") {
          const propName = callee.property.name;
          
          // Check for document.write or insertAdjacentHTML, etc.
          if (DANGEROUS_CALLS.includes(propName)) {
            isDangerousCall = true;
            callName = propName;
          }
          // Check for jQuery methods $.html(), jQuery.append() or $('#el').html()
          else if (JQUERY_DANGEROUS_CALLS.includes(propName)) {
            // Check if object is $ or jQuery or a CallExpression (like $(...))
            const obj = callee.object;
            const isJQueryObj = 
              (obj.type === "Identifier" && (obj.name === "$" || obj.name === "jQuery")) ||
              (obj.type === "CallExpression" && obj.callee.type === "Identifier" && (obj.callee.name === "$" || obj.callee.name === "jQuery"));
            
            if (isJQueryObj) {
              isDangerousCall = true;
              callName = `jquery-${propName}`;
            }
          }
        }
      } else if (node.callee.type === "Identifier") {
        // e.g. write(...) if write is in scope, or directly setInnerHTML(...)
        const name = node.callee.name;
        if (DANGEROUS_CALLS.includes(name)) {
          isDangerousCall = true;
          callName = name;
        }
      }

      if (isDangerousCall) {
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: INNER_HTML_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          tags: {
            "inner-html": true,
            [`dom-sink-${callName.toLowerCase()}`]: true,
          },
        };

        matchesReturn.push(match);
      }
    }
  };
};

export { innerHtmlAnalyzerBuilder };
