import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// 1. Verify component files exist
const glassCardPath = path.join(root, "components", "ui", "GlassCard.tsx");
const glassButtonPath = path.join(root, "components", "ui", "GlassButton.tsx");
const chatBubblePath = path.join(root, "components", "ui", "ChatBubble.tsx");

assert.ok(fs.existsSync(glassCardPath), "GlassCard.tsx must exist");
assert.ok(fs.existsSync(glassButtonPath), "GlassButton.tsx must exist");
assert.ok(fs.existsSync(chatBubblePath), "ChatBubble.tsx must exist");

// 2. Verify ChatBubble includes accessibility attributes and markdown integration
const chatBubbleCode = fs.readFileSync(chatBubblePath, "utf8");
assert.match(chatBubbleCode, /role="article"/, "ChatBubble should have role='article'");
assert.match(chatBubbleCode, /aria-label=/, "ChatBubble should have aria-label");
assert.match(chatBubbleCode, /Markdown/, "ChatBubble should render Markdown for assistant responses");
assert.match(chatBubbleCode, /navigator\.clipboard/, "ChatBubble should support clipboard copying");

// 3. Verify GlassButton has accessible focus and disabled styles
const glassButtonCode = fs.readFileSync(glassButtonPath, "utf8");
assert.match(glassButtonCode, /focus-visible:ring-2/, "GlassButton needs visible focus indicator");
assert.match(glassButtonCode, /disabled:cursor-not-allowed/, "GlassButton needs disabled styles");

console.log("Phase 2 check passed: Core UI components verified.");
