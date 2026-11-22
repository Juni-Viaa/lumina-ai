import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// 1. Verify Sidebar includes theme toggle, accessible props and no 'any' types
const sidebarPath = path.join(root, "components", "Sidebar.tsx");
const sidebarCode = fs.readFileSync(sidebarPath, "utf8");
assert.ok(!sidebarCode.includes(": any"), "Sidebar must not contain explicit 'any' types");
assert.match(sidebarCode, /useTheme/, "Sidebar should integrate useTheme for light/dark toggle");
assert.match(sidebarCode, /aria-expanded=/, "Sidebar account menu should have aria-expanded");

// 2. Verify BottomNav accessibility
const bottomNavPath = path.join(root, "components", "BottomNav.tsx");
const bottomNavCode = fs.readFileSync(bottomNavPath, "utf8");
assert.match(bottomNavCode, /aria-label=/, "BottomNav must have aria-label");
assert.match(bottomNavCode, /aria-current=/, "BottomNav active link must indicate aria-current");

// 3. Verify AppLayout has mobile header and backdrop toggle
const layoutPath = path.join(root, "app", "(app)", "layout.tsx");
const layoutCode = fs.readFileSync(layoutPath, "utf8");
assert.match(layoutCode, /setIsSidebarOpen/, "AppLayout should manage mobile sidebar open/close state");
assert.match(layoutCode, /<header/, "AppLayout should have mobile header");

console.log("Phase 3 check passed: Navigation & Shell Overhaul verified.");
