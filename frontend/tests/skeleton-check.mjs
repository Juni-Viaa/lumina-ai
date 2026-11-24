import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check Skeleton.tsx exists and contains the expected components and accessibility attributes
const skeletonFilePath = path.join(__dirname, "..", "components", "ui", "Skeleton.tsx");
assert.ok(fs.existsSync(skeletonFilePath), "Skeleton.tsx must exist");

const skeletonContent = fs.readFileSync(skeletonFilePath, "utf8");
assert.ok(skeletonContent.includes("SkeletonChatBubble"), "Must export SkeletonChatBubble");
assert.ok(skeletonContent.includes("SkeletonCard"), "Must export SkeletonCard");
assert.ok(skeletonContent.includes("SkeletonTableRow"), "Must export SkeletonTableRow");
assert.ok(skeletonContent.includes("SkeletonSidebarItem"), "Must export SkeletonSidebarItem");
assert.ok(skeletonContent.includes('role="status"'), "Must include role='status' for accessibility");
assert.ok(skeletonContent.includes('aria-label='), "Must include aria-label for screen readers");
assert.ok(skeletonContent.includes('aria-busy="true"'), "Must mark aria-busy as true");
assert.ok(skeletonContent.includes("skeleton-shimmer"), "Must utilize skeleton-shimmer CSS class");

// Check globals.css defines skeleton-shimmer and prefers-reduced-motion
const globalsCssPath = path.join(__dirname, "..", "app", "globals.css");
const globalsCss = fs.readFileSync(globalsCssPath, "utf8");
assert.ok(globalsCss.includes("@keyframes skeletonShimmer"), "Must have skeletonShimmer keyframes");
assert.ok(globalsCss.includes(".skeleton-shimmer"), "Must have .skeleton-shimmer class");
assert.ok(globalsCss.includes("prefers-reduced-motion"), "Must support prefers-reduced-motion");

console.log("skeleton-check PASSED");
