import assert from "node:assert";

// Isolated inline parsing logic matching Markdown.tsx
const INLINE_SOURCE =
    /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[([^\]]+)\]\(([^)\s]+)\))/.source;

function parseInline(text, keyPrefix = "k") {
    const nodes = [];
    let lastIndex = 0;
    let match;
    let idx = 0;
    const pattern = new RegExp(INLINE_SOURCE, "g");

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push({ type: "text", val: text.slice(lastIndex, match.index) });
        }
        const [full, code, bold, italic, , linkText, linkHref] = match;
        const key = `${keyPrefix}-m${idx++}`;
        if (code) {
            nodes.push({ type: "code", val: code.slice(1, -1) });
        } else if (bold) {
            nodes.push({ type: "bold", children: parseInline(bold.slice(2, -2), key) });
        } else if (italic) {
            nodes.push({ type: "italic", children: parseInline(italic.slice(1, -1), key) });
        } else if (linkHref) {
            nodes.push({ type: "link", text: linkText, href: linkHref });
        } else {
            nodes.push({ type: "raw", val: full });
        }
        lastIndex = match.index + full.length;
    }

    if (lastIndex < text.length) {
        nodes.push({ type: "text", val: text.slice(lastIndex) });
    }
    return nodes;
}

// 1. Bug case that previously caused 200,000 iterations & OOM:
// real assistant output from conversation 124 containing **bold**.
const realAssistantOutput =
    "Sertifikat akreditasi untuk Program Studi Teknik Informatika pada Program Diploma-III Politeknik Negeri Batam ditandatangani oleh Prof. T. Basaruddin selaku Direktur Dewan Eksekutif BAN-PT **(Sertifikat_IF_2020-2025.pdf, hal. 1)**.";
const nodes1 = parseInline(realAssistantOutput);
assert.strictEqual(nodes1.length, 3);
assert.strictEqual(nodes1[1].type, "bold");
assert.strictEqual(nodes1[1].children[0].val, "(Sertifikat_IF_2020-2025.pdf, hal. 1)");

// 2. Simple italic
const italicOutput = "Halo *miring* dunia.";
const nodes2 = parseInline(italicOutput);
assert.strictEqual(nodes2[1].type, "italic");
assert.strictEqual(nodes2[1].children[0].val, "miring");

// 3. Simple code
const codeOutput = "Teks `kode` di sini.";
const nodes3 = parseInline(codeOutput);
assert.strictEqual(nodes3[1].type, "code");
assert.strictEqual(nodes3[1].val, "kode");

console.log("markdown-inline-check PASSED");
