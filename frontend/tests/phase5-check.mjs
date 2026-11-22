import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// 1. Verify login page uses next/image and glass-card
const loginPath = path.join(root, "app", "(auth)", "login", "page.tsx");
const loginCode = fs.readFileSync(loginPath, "utf8");
assert.match(loginCode, /import Image from "next\/image"/, "login page should use next/image");
assert.ok(!loginCode.includes("<img"), "login page should not use raw <img> elements");
assert.match(loginCode, /glass-card/, "login page should use glass-card");

// 2. Verify register page uses next/image and glass-card
const registerPath = path.join(root, "app", "(auth)", "register", "page.tsx");
const registerCode = fs.readFileSync(registerPath, "utf8");
assert.match(registerCode, /import Image from "next\/image"/, "register page should use next/image");
assert.ok(!registerCode.includes("<img"), "register page should not use raw <img> elements");
assert.match(registerCode, /glass-card/, "register page should use glass-card");

// 3. Verify UploadClient has no unused router
const uploadPath = path.join(root, "app", "(app)", "upload", "UploadClient.tsx");
const uploadCode = fs.readFileSync(uploadPath, "utf8");
assert.ok(!uploadCode.includes("const router = useRouter()"), "UploadClient should not define unused router");

console.log("Phase 5 check passed: Auth and upload glassmorphism polish verified.");
