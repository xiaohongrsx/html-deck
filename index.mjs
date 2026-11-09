/* ============================================================================
   index.mjs — 当成库用时的入口
     import {buildDeck, checkDeck, exportDeck, scaffold} from "html-deck";
   ========================================================================== */
export {buildDeck} from "./src/build.mjs";
export {checkDeck} from "./src/check.mjs";
export {exportDeck} from "./src/export.mjs";
export {scaffold} from "./src/scaffold.mjs";
export {startBrowser, findChrome, connect} from "./src/chrome.mjs";
export {code, highlight, escapeHtml} from "./src/build-lib.mjs";
