import assert from "node:assert/strict";
import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import test from "node:test";

const outDir = join(process.cwd(), ".tmp-security-test-build-" + process.pid);
await mkdir(outDir, { recursive: true });

// Bundle each entrypoint as ESM for Node. This resolves the Worker project's
// bundler-style extensionless imports without changing production sources.
const bundles = [
  ["src/auth/bearer.ts", "bearer.mjs"],
  ["src/files/uploaded-file.ts", "uploaded-file.mjs"],
  ["src/runtime/task-graph.ts", "task-graph.mjs"],
  ["src/runtime/workflow-engine.ts", "workflow-engine.mjs"],
  ["src/runtime/recovery-manager.ts", "recovery-manager.mjs"],
];

for (const [entry, output] of bundles) {
  execFileSync(
    "npx",
    [
      "esbuild",
      entry,
      "--bundle",
      "--platform=node",
      "--format=esm",
      "--outfile=" + join(outDir, output),
    ],
    { stdio: "inherit" },
  );
}

const importBundle = (name) => import(pathToFileURL(join(outDir, name)).href);
const { verifyBearer } = await importBundle("bearer.mjs");
const { normalizeUploadedFile } = await importBundle("uploaded-file.mjs");
const { TaskGraph } = await importBundle("task-graph.mjs");
const { WorkflowEngine } = await importBundle("workflow-engine.mjs");
const { RecoveryManager } = await importBundle("recovery-manager.mjs");

function task(id, dependsOn = [], tool = id) {
  return { id, description: id, tool, input: {}, dependsOn, status: "pending" };
}

test("bearer auth fails closed when API_KEY is missing", () => {
  const request = new Request("https://runtime.example/tools/test");
  const result = verifyBearer(request);
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.code, "AUTH_NOT_CONFIGURED");
});

test("bearer auth permits an explicit development bypass only", () => {
  const request = new Request("https://runtime.example/tools/test");
  assert.deepEqual(verifyBearer(request, undefined, true), { ok: true });
  assert.equal(verifyBearer(request, undefined, false).ok, false);
});

test("bearer auth validates configured credentials", () => {
  const valid = new Request("https://runtime.example/tools/test", {
    headers: { authorization: "Bearer secret-value" },
  });
  const wrong = new Request("https://runtime.example/tools/test", {
    headers: { authorization: "Bearer wrong-value" },
  });
  const malformed = new Request("https://runtime.example/tools/test", {
    headers: { authorization: "Basic secret-value" },
  });
  assert.deepEqual(verifyBearer(valid, "secret-value"), { ok: true });
  assert.equal(verifyBearer(wrong, "secret-value").status, 401);
  assert.equal(verifyBearer(malformed, "secret-value").status, 401);
});

test("remote file downloads require an allowlist and exact host match", async () => {
  await assert.rejects(
    normalizeUploadedFile("https://files.example.com/document.pdf"),
    (error) => error.code === "REMOTE_DOWNLOAD_DISABLED",
  );
  await assert.rejects(
    normalizeUploadedFile("https://not-allowed.example.org/document.pdf", 0, {
      allowedDownloadHosts: "files.example.com",
    }),
    (error) => error.code === "REMOTE_HOST_NOT_ALLOWED",
  );
  await assert.rejects(
    normalizeUploadedFile("http://files.example.com/document.pdf", 0, {
      allowedDownloadHosts: "files.example.com",
    }),
    (error) => error.code === "INVALID_DOWNLOAD_URL",
  );
});

test("remote file redirects are revalidated against the allowlist", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(null, {
      status: 302,
      headers: { location: "https://evil.example.org/file.pdf" },
    });
  };
  try {
    await assert.rejects(
      normalizeUploadedFile("https://files.example.com/document.pdf", 0, {
        allowedDownloadHosts: "files.example.com",
      }),
      (error) => error.code === "REMOTE_HOST_NOT_ALLOWED",
    );
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("remote downloads reject oversized Content-Length before buffering", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(null, {
      status: 200,
      headers: { "content-length": String(25 * 1024 * 1024 + 1) },
    });
  try {
    await assert.rejects(
      normalizeUploadedFile("https://files.example.com/document.pdf", 0, {
        allowedDownloadHosts: "files.example.com",
      }),
      (error) => error.code === "FILE_TOO_LARGE",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("task graph rejects duplicate task ids", () => {
  assert.throws(
    () => new TaskGraph([task("same"), task("same")]),
    /Duplicate task id: same/,
  );
});

test("task graph rejects missing and self dependencies", () => {
  assert.throws(
    () => new TaskGraph([task("child", ["missing"])]),
    /unknown task: missing/,
  );
  assert.throws(
    () => new TaskGraph([task("self", ["self"])]),
    /cannot depend on itself/,
  );
});

test("task graph rejects dependency cycles", () => {
  assert.throws(
    () => new TaskGraph([task("a", ["b"]), task("b", ["a"])]),
    /dependency cycle/,
  );
});

test("task graph schedules only tasks with completed dependencies", () => {
  const graph = new TaskGraph([
    task("root"),
    task("child", ["root"]),
    task("other"),
  ]);
  assert.deepEqual(
    graph.next(new Set(), new Set(["root"])).map((item) => item.id),
    ["other"],
  );
  assert.deepEqual(
    graph.next(new Set(["root"])).map((item) => item.id),
    ["child", "other"],
  );
});

test("workflow engine never marks failed tasks complete and blocks dependents", async () => {
  const tasks = [
    task("root", [], "fail"),
    task("other", [], "succeed"),
    task("child", ["root"], "child"),
  ];
  const calls = [];
  const checkpoints = [];
  const events = [];
  const memory = {
    async put(_env, _requestId, key, value) {
      if (key.endsWith("/checkpoint")) checkpoints.push(value);
    },
  };
  const executor = {
    async runTool(name) {
      calls.push(name);
      if (name === "fail") throw new Error("simulated failure");
      return { ok: true };
    },
  };
  const provenance = {
    async append(_env, _requestId, action, payload) {
      events.push({ action, payload });
    },
  };
  const engine = new WorkflowEngine(
    { build: () => tasks },
    executor,
    memory,
    provenance,
  );

  const result = await engine.run(
    { id: "workflow-failure", objective: "test" },
    { STATE_KV: {} },
    "request-1",
  );

  assert.deepEqual(calls, ["fail", "succeed"]);
  assert.deepEqual(result.completed, ["other"]);
  assert.deepEqual(result.failed, ["root"]);
  assert.deepEqual(result.blocked, ["child"]);
  assert.equal(checkpoints.some((checkpoint) => checkpoint.completed.includes("root")), false);
  assert.ok(checkpoints.some((checkpoint) => checkpoint.failed.includes("root")));
  assert.ok(events.some((event) => event.action === "task_failed" && event.payload.taskId === "root"));
  assert.ok(!events.some((event) => event.action === "task_completed" && event.payload.taskId === "root"));
});

test("workflow engine retries failed tasks during resume", async () => {
  const tasks = [task("root", [], "root-tool"), task("child", ["root"], "child-tool")];
  const calls = [];
  const executor = {
    async runTool(name) {
      calls.push(name);
      return { ok: true };
    },
  };
  const memory = { async put() {} };
  const provenance = { async append() {} };
  const recovery = {
    async resume() {
      return {
        workflowId: "workflow-retry",
        definition: {
          workflowId: "workflow-retry",
          goal: { id: "workflow-retry", objective: "test" },
          tasks,
        },
        checkpoint: { workflowId: "workflow-retry", completed: [], failed: ["root"] },
        completed: [],
        failed: ["root"],
        remaining: ["root", "child"],
      };
    },
  };
  const engine = new WorkflowEngine(
    { build: () => tasks },
    executor,
    memory,
    provenance,
    recovery,
  );

  const result = await engine.resume(
    "workflow-retry",
    { STATE_KV: {} },
    "request-2",
  );
  assert.deepEqual(calls, ["root-tool", "child-tool"]);
  assert.deepEqual(result.completed, ["root", "child"]);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(result.blocked, []);
});

test("recovery reconstructs failures only from legacy checkpoints", async () => {
  const tasks = [task("bad"), task("next", ["bad"])];
  const values = {
    "workflow/legacy/definition": {
      workflowId: "legacy",
      goal: { id: "legacy", objective: "legacy" },
      tasks,
    },
    "workflow/legacy/checkpoint": {
      workflowId: "legacy",
      completed: ["bad"],
    },
    "workflow/legacy/result": {
      results: [{ taskId: "bad", success: false, error: "old failure" }],
    },
  };
  const manager = new RecoveryManager({
    async get(_env, _requestId, key) {
      return values[key] ?? null;
    },
  });

  const state = await manager.resume({ STATE_KV: {} }, "request-3", "legacy");
  assert.deepEqual(state.failed, ["bad"]);
  assert.deepEqual(state.completed, []);
  assert.deepEqual(state.remaining, ["bad", "next"]);
});

test("recovery does not resurrect stale failures for modern checkpoints", async () => {
  const tasks = [task("bad")];
  const values = {
    "workflow/current/definition": {
      workflowId: "current",
      goal: { id: "current", objective: "current" },
      tasks,
    },
    "workflow/current/checkpoint": {
      workflowId: "current",
      completed: ["bad"],
      failed: [],
    },
    "workflow/current/result": {
      results: [{ taskId: "bad", success: false, error: "stale failure" }],
    },
  };
  const manager = new RecoveryManager({
    async get(_env, _requestId, key) {
      return values[key] ?? null;
    },
  });

  const state = await manager.resume({ STATE_KV: {} }, "request-4", "current");
  assert.deepEqual(state.failed, []);
  assert.deepEqual(state.completed, ["bad"]);
});

test("recovery rejects checkpoints containing unknown task ids", async () => {
  const values = {
    "workflow/invalid/definition": {
      workflowId: "invalid",
      goal: { id: "invalid", objective: "invalid" },
      tasks: [task("known")],
    },
    "workflow/invalid/checkpoint": {
      workflowId: "invalid",
      completed: ["not-in-definition"],
    },
    "workflow/invalid/result": null,
  };
  const manager = new RecoveryManager({
    async get(_env, _requestId, key) {
      return values[key] ?? null;
    },
  });
  await assert.rejects(
    manager.resume({ STATE_KV: {} }, "request-5", "invalid"),
    /unknown completed task id/,
  );
});

test.after(async () => {
  await rm(outDir, { recursive: true, force: true });
});
