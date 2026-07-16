import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

const outDir = join(process.cwd(), `.tmp-test-build-${process.pid}`);
execFileSync(
  "npx",
  [
    "tsc",
    "--outDir",
    outDir,
    "--noEmit",
    "false",
    "--declaration",
    "false",
  ],
  { stdio: "inherit" },
);

const { normalizeActionRequest } = await import(
  `file://${join(outDir, "src/tools/github-actions/index.js")}`
);

const PDF_BYTES = Buffer.from("%PDF-1.4\n% test pdf\n", "utf8");
const PDF_BASE64 = PDF_BYTES.toString("base64");

async function withTempFile(name, bytes = PDF_BYTES) {
  const dir = await mkdtemp(join(tmpdir(), "runtime-mcp-pdf-"));
  const path = join(dir, name);
  await writeFile(path, bytes);
  return { dir, path };
}

test("normalizes a single uploaded PDF path", async () => {
  const { dir, path } = await withTempFile("single upload.pdf");
  try {
    const request = await normalizeActionRequest({ files: [path], timeoutSeconds: 60, options: {} });
    assert.equal(request.files.length, 1);
    assert.equal(request.files[0].name, "single upload.pdf".replaceAll(" ", "_"));
    assert.equal(request.files[0].mimeType, "application/pdf");
    assert.equal(request.files[0].base64, PDF_BASE64);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("normalizes multiple uploaded PDFs", async () => {
  const one = await withTempFile("one.pdf");
  const two = await withTempFile("two.pdf", Buffer.from("%PDF-1.4\nsecond\n"));
  try {
    const request = await normalizeActionRequest({ files: [one.path, { path: two.path }], timeoutSeconds: 60, options: {} });
    assert.deepEqual(request.files.map((file) => file.name), ["one.pdf", "two.pdf"]);
    assert.equal(request.files[1].base64, Buffer.from("%PDF-1.4\nsecond\n").toString("base64"));
  } finally {
    await rm(one.dir, { recursive: true, force: true });
    await rm(two.dir, { recursive: true, force: true });
  }
});

test("preserves mixed proxied path and existing base64 inputs", async () => {
  const { dir, path } = await withTempFile("proxied.pdf");
  try {
    const request = await normalizeActionRequest({
      files: [
        { path },
        { name: "local.pdf", mimeType: "application/pdf", base64: PDF_BASE64, sizeBytes: PDF_BYTES.byteLength },
      ],
      timeoutSeconds: 60,
      options: {},
    });
    assert.equal(request.files[0].base64, PDF_BASE64);
    assert.equal(request.files[1].name, "local.pdf");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reports the expected file formats for invalid file references", async () => {
  await assert.rejects(
    normalizeActionRequest({ files: [{ file_id: "file_abc" }], timeoutSeconds: 60, options: {} }),
    /Unsupported file reference/,
  );
});

test("normalizes platform-specific path separators in filenames", async () => {
  const request = await normalizeActionRequest({
    files: [{ name: win32.join("C:\\", "mnt", "data", "scan one.pdf"), mimeType: "application/pdf", base64: PDF_BASE64 }],
    timeoutSeconds: 60,
    options: {},
  });
  assert.equal(request.files[0].name, "scan_one.pdf");
});

test.after(async () => {
  await rm(outDir, { recursive: true, force: true });
});

test("registers stable ChatGPT-facing PDF tool names", async () => {
  const { registerGitHubActionsTools } = await import(
    `file://${join(outDir, "src/tools/github-actions/index.js")}`
  );
  const registry = {};
  registerGitHubActionsTools(registry);
  const expected = [
    "upload_pdf",
    "render_pdf",
    "ocr_pdf",
    "split_pdf",
    "merge_pdfs",
    "rotate_pdf",
    "crop_pdf",
    "searchable_pdf",
    "pdf_metadata",
    "pdf_to_images",
    "images_to_pdf",
  ];
  assert.deepEqual(Object.keys(registry), expected);
  for (const name of expected) {
    assert.equal(typeof registry[name].description, "string");
    assert.ok(registry[name].description.length > 20);
    assert.ok(registry[name].inputSchema);
    assert.ok(registry[name].outputSchema);
  }
});

test("upload_pdf normalizes a ChatGPT input_file PDF", async () => {
  const { normalizePdfUpload } = await import(
    `file://${join(outDir, "src/tools/github-actions/index.js")}`
  );
  const uploaded = await normalizePdfUpload({
    file: {
      type: "input_file",
      id: "file_123",
      filename: "chatgpt.pdf",
      mime_type: "application/pdf",
      data: PDF_BASE64,
      size: PDF_BYTES.byteLength,
    },
  });
  assert.equal(uploaded.id, "file_123");
  assert.equal(uploaded.filename, "chatgpt.pdf");
  assert.equal(uploaded.mimeType, "application/pdf");
  assert.equal(uploaded.base64, PDF_BASE64);
  assert.equal(uploaded.source, "input_file");
});

test("rejects invalid MIME for PDF upload", async () => {
  const { normalizePdfUpload } = await import(
    `file://${join(outDir, "src/tools/github-actions/index.js")}`
  );
  await assert.rejects(
    normalizePdfUpload({ file: { filename: "not.pdf", mime_type: "text/plain", data: PDF_BASE64 } }),
    /must be one of: application\/pdf/,
  );
});

test("rejects corrupt PDF bytes", async () => {
  const { normalizePdfUpload } = await import(
    `file://${join(outDir, "src/tools/github-actions/index.js")}`
  );
  await assert.rejects(
    normalizePdfUpload({ file: { filename: "bad.pdf", mime_type: "application/pdf", data: Buffer.from("nope").toString("base64") } }),
    /not a valid PDF/,
  );
});
