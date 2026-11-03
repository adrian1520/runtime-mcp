import { z } from "zod";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_DOWNLOAD_REDIRECTS = 3;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 15_000;

export type UploadedFileOptions = {
  /** Exact allowlisted HTTPS hostnames; wildcards are not supported. */
  allowedDownloadHosts?: string | string[];
  downloadTimeoutMs?: number;
};

export type UploadedFileSource =
  "base64" | "path" | "url" | "mcp_file" | "input_file";

export type UploadedFile = {
  id: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  size: number;
  source: UploadedFileSource;
};

export class FileValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "FileValidationError";
  }
}

export const fileReferenceSchema = z.union([
  z.string().min(1),
  z
    .object({
      id: z.string().optional(),
      file_id: z.string().optional(),
      fileId: z.string().optional(),
      name: z.string().optional(),
      filename: z.string().optional(),
      mimeType: z.string().optional(),
      mime_type: z.string().optional(),
      type: z.string().optional(),
      base64: z.string().optional(),
      data: z.string().optional(),
      bytes: z.unknown().optional(),
      size: z.number().int().min(0).optional(),
      sizeBytes: z.number().int().min(0).optional(),
      path: z.string().optional(),
      filePath: z.string().optional(),
      uri: z.string().optional(),
      url: z.string().optional(),
      download_url: z.string().optional(),
      downloadUrl: z.string().optional(),
    })
    .passthrough(),
]);

export type FileReference = z.infer<typeof fileReferenceSchema>;

export const fileReferenceJsonSchema = {
  anyOf: [
    {
      type: "object",
      properties: {
        name: { type: "string" },
        filename: { type: "string" },
        mimeType: { type: "string" },
        mime_type: { type: "string" },
        base64: { type: "string", description: "Base64-encoded file bytes." },
        data: { type: "string", description: "Base64-encoded file bytes." },
        sizeBytes: { type: "integer" },
        download_url: { type: "string" },
        url: { type: "string" },
        path: { type: "string" },
        file_id: { type: "string" },
        type: {
          type: "string",
          description: "May be input_file for ChatGPT file inputs.",
        },
      },
      additionalProperties: true,
    },
    {
      type: "string",
      description: "Readable local path, file:// URI, or HTTPS download URL.",
    },
  ],
} as const;

function safeFileName(input: string | undefined, fallback: string): string {
  const normalized =
    (input || fallback).replace(/\\/g, "/").split("/").filter(Boolean).pop() ??
    fallback;
  const stripped = normalized.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160);
  return stripped || fallback;
}

function inferMimeType(name: string, explicit?: string): string {
  if (explicit) return explicit;
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/pdf";
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean))
    throw new FileValidationError(
      "INVALID_BASE64",
      "File content must be base64 encoded",
    );
  if (clean.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4) {
    throw new FileValidationError(
      "FILE_TOO_LARGE",
      `Base64 file content exceeds ${MAX_UPLOAD_BYTES} bytes`,
      413,
    );
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function readLocalFile(path: string): Promise<Uint8Array> {
  try {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (
      specifier: string,
    ) => Promise<{ readFile: (path: string) => Promise<Uint8Array> }>;
    const fs = await dynamicImport("node:fs/promises");
    return await fs.readFile(path);
  } catch {
    throw new FileValidationError(
      "FILE_REFERENCE_UNREADABLE",
      `Unable to read file path ${path}. Pass an uploaded file with base64/data bytes or an accessible download_url.`,
    );
  }
}

function allowedHostsOf(value: string | string[] | undefined): Set<string> {
  const entries = Array.isArray(value) ? value : (value ?? "").split(",");
  return new Set(
    entries
      .map((entry) => entry.trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean),
  );
}

function validateDownloadUrl(url: URL, allowedHosts: Set<string>): void {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port !== "" && url.port !== "443")
  ) {
    throw new FileValidationError(
      "INVALID_DOWNLOAD_URL",
      "Remote file downloads require HTTPS without credentials or a custom port",
    );
  }

  if (
    hostname.includes(":") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new FileValidationError(
      "REMOTE_HOST_NOT_ALLOWED",
      "Remote file host is not permitted",
      403,
    );
  }

  if (!allowedHosts.has(hostname)) {
    throw new FileValidationError(
      "REMOTE_HOST_NOT_ALLOWED",
      "Remote file host is not allowlisted: " + hostname,
      403,
    );
  }
}

async function readResponseBytes(response: Response): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    await response.body?.cancel();
    throw new FileValidationError(
      "FILE_TOO_LARGE",
      "Remote file exceeds " + MAX_UPLOAD_BYTES + " bytes",
      413,
    );
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new FileValidationError(
        "FILE_TOO_LARGE",
        "Remote file exceeds " + MAX_UPLOAD_BYTES + " bytes",
        413,
      );
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      if (!chunk) continue;

      total += chunk.byteLength;
      if (total > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new FileValidationError(
          "FILE_TOO_LARGE",
          "Remote file exceeds " + MAX_UPLOAD_BYTES + " bytes",
          413,
        );
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readRemoteFile(
  input: string,
  options: UploadedFileOptions,
): Promise<Uint8Array> {
  const allowedHosts = allowedHostsOf(options.allowedDownloadHosts);
  if (allowedHosts.size === 0) {
    throw new FileValidationError(
      "REMOTE_DOWNLOAD_DISABLED",
      "HTTPS downloads are disabled until FILE_DOWNLOAD_ALLOWED_HOSTS is configured",
      403,
    );
  }

  const timeoutMs = Math.max(
    1_000,
    Math.min(options.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS, 60_000),
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new FileValidationError("INVALID_DOWNLOAD_URL", "Invalid download URL");
    }

    for (let redirect = 0; redirect <= MAX_DOWNLOAD_REDIRECTS; redirect += 1) {
      validateDownloadUrl(url, allowedHosts);
      const response = await fetch(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirect === MAX_DOWNLOAD_REDIRECTS) {
          throw new FileValidationError(
            "TOO_MANY_REDIRECTS",
            "Remote file download exceeded the redirect limit",
          );
        }
        url = new URL(location, url);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new FileValidationError(
          "FILE_REFERENCE_UNREADABLE",
          "Unable to download remote file: HTTP " + response.status,
          502,
        );
      }

      return await readResponseBytes(response);
    }

    throw new FileValidationError(
      "TOO_MANY_REDIRECTS",
      "Remote file download exceeded the redirect limit",
    );
  } catch (error) {
    if (error instanceof FileValidationError) throw error;
    if (controller.signal.aborted) {
      throw new FileValidationError(
        "DOWNLOAD_TIMEOUT",
        "Remote file download timed out after " + timeoutMs + " ms",
        504,
      );
    }
    throw new FileValidationError(
      "FILE_REFERENCE_UNREADABLE",
      "Unable to download remote file: " +
        (error instanceof Error ? error.message : String(error)),
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function referenceOf(file: Exclude<FileReference, string>): string | undefined {
  return (
    file.path ??
    file.filePath ??
    file.uri ??
    file.download_url ??
    file.downloadUrl ??
    file.url
  );
}

function idOf(file: FileReference, index: number): string {
  if (typeof file === "object")
    return file.id ?? file.file_id ?? file.fileId ?? `uploaded-${index + 1}`;
  return `uploaded-${index + 1}`;
}

export async function normalizeUploadedFile(
  file: FileReference,
  index = 0,
  options: UploadedFileOptions = {},
): Promise<UploadedFile> {
  const obj = typeof file === "object" ? file : undefined;
  const initialRef =
    typeof file === "string" ? file : obj ? referenceOf(obj) : undefined;
  const name = safeFileName(
    obj?.filename ?? obj?.name ?? initialRef,
    `input-${index + 1}.pdf`,
  );
  const mimeType = inferMimeType(name, obj?.mimeType ?? obj?.mime_type);
  let bytes: Uint8Array;
  let source: UploadedFileSource = "base64";

  const inline = obj?.base64 ?? obj?.data;
  if (inline) {
    bytes = base64ToBytes(inline);
    source =
      obj?.type === "input_file"
        ? "input_file"
        : obj?.file_id || obj?.fileId
          ? "mcp_file"
          : "base64";
  } else {
    const ref = typeof file === "string" ? file : referenceOf(file);
    if (!ref)
      throw new FileValidationError(
        "FILE_REFERENCE_UNSUPPORTED",
        "Unsupported file reference. Provide a ChatGPT input_file/MCP file object with base64 data, a readable path, file:// URI, or an HTTPS download_url.",
      );
    if (/^https?:\/\//i.test(ref)) {
      bytes = await readRemoteFile(ref, options);
      source = "url";
    } else {
      bytes = await readLocalFile(
        ref.startsWith("file://") ? new URL(ref).pathname : ref,
      );
      source = "path";
    }
  }

  validateUploadedFile({
    filename: name,
    mimeType,
    bytes,
    declaredSize: obj?.sizeBytes ?? obj?.size,
  });
  return {
    id: idOf(file, index),
    filename: name,
    mimeType,
    bytes,
    size: bytes.byteLength,
    source,
  };
}

export function validateUploadedFile(
  input: {
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
    declaredSize?: number | undefined;
  },
  allowedMimeTypes = ["application/pdf"],
): void {
  if (input.bytes.byteLength === 0)
    throw new FileValidationError("EMPTY_FILE", `${input.filename} is empty`);
  if (
    input.bytes.byteLength > MAX_UPLOAD_BYTES ||
    (input.declaredSize ?? 0) > MAX_UPLOAD_BYTES
  )
    throw new FileValidationError(
      "FILE_TOO_LARGE",
      `${input.filename} exceeds ${MAX_UPLOAD_BYTES} bytes`,
    );
  if (!allowedMimeTypes.includes(input.mimeType))
    throw new FileValidationError(
      "INVALID_MIME_TYPE",
      `${input.filename} must be one of: ${allowedMimeTypes.join(", ")}`,
    );
  if (input.mimeType === "application/pdf") {
    const header = new TextDecoder().decode(input.bytes.subarray(0, 5));
    if (header !== "%PDF-")
      throw new FileValidationError(
        "INVALID_PDF",
        `${input.filename} is not a valid PDF file`,
      );
  }
}
