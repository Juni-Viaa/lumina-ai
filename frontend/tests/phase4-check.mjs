import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// 1. Verify message entrance keyframes and utility in globals.css
const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
assert.match(css, /@keyframes messageEnter/, "globals.css missing messageEnter keyframes");
assert.match(css, /\.animate-message-enter/, "globals.css missing .animate-message-enter class");

// 2. Verify page.tsx includes starter prompts, keyboard shortcuts, and live region
const pageCode = fs.readFileSync(path.join(root, "app", "(app)", "page.tsx"), "utf8");
assert.match(pageCode, /aria-live="polite"/, "page.tsx missing aria-live polite region for screen readers");
assert.match(pageCode, /handleGlobalKeyDown/, "page.tsx missing global keyboard shortcut listener");
assert.match(pageCode, /starterPrompts/, "page.tsx missing starterPrompts on welcome screen");
assert.match(pageCode, /animate-message-enter/, "page.tsx should apply entrance animation to chat bubbles");

console.log("Phase 4 check passed: Chat interaction polish and animations verified.");
