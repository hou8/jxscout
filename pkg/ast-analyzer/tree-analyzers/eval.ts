import { Node } from "acorn";
import { Analyzer, AnalyzerMatch, AnalyzerParams } from "../types";
import { Visitor } from "../walker";

export const EVAL_ANALYZER_NAME = "eval";

const evalAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[]
): Visitor => {
  return {
    CallExpression(node, ancestors) {
      if (!node.loc) {
        return;
      }

      let isEvalLike = false;
      let evalType = "";

      if (node.callee.type === "Identifier") {
        const name = node.callee.name;
        if (["eval", "setTimeout", "setInterval", "Function", "execScript", "executeScript"].includes(name) && node.arguments.length >= 1) {
          isEvalLike = true;
          evalType = name;
        }
      } else if (node.callee.type === "MemberExpression") {
        const callee = node.callee;
        if (
          callee.object.type === "Identifier" &&
          (callee.object.name === "$" || callee.object.name === "jQuery") &&
          callee.property.type === "Identifier" &&
          callee.property.name === "globalEval" &&
          node.arguments.length >= 1
        ) {
          isEvalLike = true;
          evalType = "globalEval";
        }
      }

      if (isEvalLike) {
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: EVAL_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          tags: {
            eval: true,
            [`eval-type-${evalType.toLowerCase()}`]: true,
          },
        };
        matchesReturn.push(match);
      }
    },
  };
};

export { evalAnalyzerBuilder };
