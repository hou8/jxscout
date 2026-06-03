import { Node } from "acorn";
import { Analyzer, AnalyzerMatch, AnalyzerParams } from "../types";
import { Visitor } from "../walker";

export const ADD_EVENT_LISTENER_ANALYZER_NAME = "add-event-listener";

const STANDARD_EVENTS = new Set([
  // Mouse & Pointer Events
  "click", "dblclick", "mousedown", "mouseenter", "mouseleave", "mousemove",
  "mouseout", "mouseover", "mouseup", "contextmenu", "wheel", "mousewheel",
  "pointerdown", "pointerup", "pointermove", "pointerover", "pointerout",
  "pointerenter", "pointerleave", "pointercancel", "gotpointercapture", "lostpointercapture",

  // Keyboard & Input Events
  "keydown", "keypress", "keyup", "input", "change", "beforeinput",

  // Touch Events
  "touchstart", "touchend", "touchmove", "touchcancel",

  // Form & Focus Events
  "submit", "reset", "focus", "blur", "focusin", "focusout", "invalid", "select", "search",

  // Drag & Drop Events
  "drag", "dragend", "dragenter", "dragleave", "dragover", "dragstart", "drop",

  // Media Events
  "canplay", "canplaythrough", "durationchange", "emptied", "ended", "loadeddata",
  "loadedmetadata", "loadstart", "pause", "play", "playing", "progress", "ratechange",
  "seeked", "seeking", "stalled", "suspend", "timeupdate", "volumechange", "waiting",

  // Window, Document, & Lifecycle Events
  "load", "unload", "beforeunload", "resize", "scroll", "error", "abort",
  "domcontentloaded", "readystatechange", "pageshow", "pagehide", "visibilitychange",
  "online", "offline", "popstate", "storage", "toggle",
  "close", "open", "cancel", "copy", "cut", "paste"
]);

const addEventListenerAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[]
): Visitor => {
  return {
    CallExpression(node, ancestors) {
      if (!node.loc) {
        return;
      }

      // Check if this is an addEventListener call
      const isAddEventListenerCall =
        (node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "addEventListener") ||
        (node.callee.type === "Identifier" &&
          node.callee.name === "addEventListener");

      if (isAddEventListenerCall && node.arguments.length >= 2) {
        const eventType =
          node.arguments[0].type === "Literal"
            ? String(node.arguments[0].value)
            : "dynamic";

        // Ignore standard browser events
        if (eventType !== "dynamic" && STANDARD_EVENTS.has(eventType.toLowerCase())) {
          return;
        }

        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: ADD_EVENT_LISTENER_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          tags: {
            "event-listener": true,
            [`event-type-${eventType}`]: true,
          },
        };

        matchesReturn.push(match);
      }
    },
  };
};

export { addEventListenerAnalyzerBuilder };
