import { Node } from "acorn";
import { Analyzer, AnalyzerMatch, AnalyzerParams } from "../types";
import { Visitor } from "../walker";

export const HOSTNAME_ANALYZER_NAME = "hostname";

// Regex pattern to match hostnames
// Matches:
// - Domain names with subdomains (e.g. sub.example.com)
// - Allows only letters, numbers, hyphens, and dots
// - Each label must start and end with a letter or number
// - Labels cannot start or end with hyphens
const HOSTNAME_REGEX = new RegExp(
  `^(?!.*\\.(css|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|otf|mp4|webm|mp3|wav|vue|js|ts|jsx|tsx|html)$)[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*\\.[a-zA-Z]{2,4}$`,
  "i"
);

const EXCLUDED_HOSTNAMES = new Set([
  "www.w3.org",
  "element-plus.org",
  "vuejs.org",
]);

const hostnameAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[]
): Visitor => {
  return {
    Literal(node, ancestors) {
      if (!node.loc || typeof node.value !== "string") {
        return;
      }

      // Check if the string literal matches the hostname pattern
      if (HOSTNAME_REGEX.test(node.value)) {
        let parsedUrl: URL | null = null;

        try {
          parsedUrl = new URL(`https://${node.value}`);
        } catch {
          return;
        }

        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: HOSTNAME_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          tags: {
            "hostname-string": true,
          },
          extra: {
            hostname: parsedUrl.hostname,
          },
        };

        if (
          EXCLUDED_HOSTNAMES.has(parsedUrl.hostname) ||
          node.value.startsWith("react.")
        ) {
          return;
        }

        matchesReturn.push(match);
      }
    },
  };
};

export { hostnameAnalyzerBuilder };
