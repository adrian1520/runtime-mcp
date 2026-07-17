/**
 * Mounted PDF Tool
 * 
 * Extends PDF tool capabilities to handle files from proxied mounts.
 * Resolves mounted paths and normalizes them for OCR and PDF processing.
 * 
 * Usage:
 *   - Call `upload_pdf_mounted` with a path like /mnt/data/Lubicz.pdf
 *   - Returns normalized UploadedFile ready for OCR/PDF tools
 *   - Handles path rewriting and validation transparently
 */

import { z } from "zod";
import type { ToolRegistry } from "../../contracts/tool";
import {
  bytesToBase64,
  validateUploadedFile,
  type UploadedFile,
} from "../../files/uploaded-file.js";
import {
  MountedFileAdapter,
  createDefaultMountedFileAdapter,
  type MountedFileResult,
  mountedFileResultToToolResponse,
} from "../../files/mounted-file-adapter.js";
import {
  MountPathResolver,
  createDefaultMountResolver,
  type MountConfig,
} from "../../files/mount-resolver.js";

type Env = {
  STATE_KV?: KVNamespace;
};

/**
 * Mount resolver singleton (can be customized per environment)
 */
let globalMountAdapter: MountedFileAdapter | null = null;

/**
 * Get or create the global mounted file adapter
 */
function getMountedFileAdapter(): MountedFileAdapter {
  if (!globalMountAdapter) {
    globalMountAdapter = createDefaultMountedFileAdapter();
  }
  return globalMountAdapter;
}

/**
 * Initialize the mounted file adapter with custom mounts
 * Call this during application startup to configure mounts
 */
export function initializeMountedFileAdapter(
  mounts: MountConfig[],
): MountedFileAdapter {
  const adapter = new MountedFileAdapter({
    resolver: new MountPathResolver(mounts),
  });
  globalMountAdapter = adapter;
  return adapter;
}

// Zod schemas for mount-based operations

const mountedPdfUploadSchema = z.object({
  path: z.string().min(1).describe("Mounted file path (e.g., /mnt/data/Lubicz.pdf)"),
  normalizePath: z
    .boolean()
    .optional()
    .default(true)
    .describe("Apply mount rewrite rules to normalize path"),
});

const mountInfoQuerySchema = z.object({
  path: z
    .string()
    .optional()
    .describe("Optional path to resolve against mounts"),
});

type MountedPdfUploadArgs = z.infer<typeof mountedPdfUploadSchema>;
type MountInfoQueryArgs = z.infer<typeof mountInfoQuerySchema>;

/**
 * Normalize a mounted PDF file into an UploadedFile
 * Resolves mount path and handles rewriting
 */
export async function normalizeMountedPdfUpload(
  args: MountedPdfUploadArgs,
): Promise<MountedFileResult> {
  const adapter = getMountedFileAdapter();
  return adapter.normalizeMountedFile(args.path, 0);
}

/**
 * Query mount configuration and resolution
 * Useful for debugging and understanding mount setup
 */
export function queryMountInfo(args: MountInfoQueryArgs) {
  const adapter = getMountedFileAdapter();
  const mounts = adapter.getResolver().listMounts();

  const info = {
    totalMounts: mounts.length,
    mounts: mounts.map((m) => ({
      name: m.name,
      mountPath: m.mountPath,
      readOnly: m.readOnly ?? false,
      hasRewriteRules: !!(m.rewriteRules && m.rewriteRules.length > 0),
    })),
    pathResolution: args.path
      ? adapter.getResolver().resolve(args.path)
      : undefined,
  };

  return info;
}

/**
 * Output schema for mounted PDF upload
 */
const mountedUploadOutputSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    file: {
      type: "object",
      properties: {
        id: { type: "string" },
        filename: { type: "string" },
        mimeType: { type: "string" },
        size: { type: "integer" },
        source: { type: "string" },
        base64: { type: "string" },
      },
      additionalProperties: false,
    },
    resolution: {
      type: "object",
      properties: {
        matched: { type: "boolean" },
        mount: { type: "string" },
        relativePath: { type: "string" },
        rewrittenPath: { type: "string" },
      },
      additionalProperties: false,
    },
    error: { type: "string" },
  },
  required: ["success", "resolution"],
  additionalProperties: false,
} as const;

const mountInfoOutputSchema = {
  type: "object",
  properties: {
    totalMounts: { type: "integer" },
    mounts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          mountPath: { type: "string" },
          readOnly: { type: "boolean" },
          hasRewriteRules: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    pathResolution: {
      type: "object",
      properties: {
        matched: { type: "boolean" },
        mount: { type: "string" },
        relativePath: { type: "string" },
        rewrittenPath: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  required: ["totalMounts", "mounts"],
  additionalProperties: true,
} as const;

/**
 * Register mounted PDF tools
 */
export function registerMountedPdfTools(
  registry: ToolRegistry<Env>,
  customMounts?: MountConfig[],
): void {
  // Initialize with custom mounts if provided
  if (customMounts) {
    initializeMountedFileAdapter(customMounts);
  }

  // Tool: upload_pdf_mounted
  registry.upload_pdf_mounted = {
    description:
      "Upload and normalize a PDF from a proxied mount (e.g., /mnt/data/Lubicz.pdf). " +
      "Handles path rewriting, mount resolution, and returns a normalized base64 PDF ready for OCR or other PDF tools. " +
      "Error code 'FILE_ARG_REWRITE_MOUNT_NOT_FOUND' means the path is not in a configured mount.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to mounted file (e.g., /mnt/data/Lubicz.pdf)",
        },
        normalizePath: {
          type: "boolean",
          description: "Apply mount rewrite rules to normalize path",
        },
      },
      required: ["path"],
      additionalProperties: false,
    } as const,
    outputSchema: mountedUploadOutputSchema,
    validate: (args) => mountedPdfUploadSchema.parse(args),
    execute: async (args) => {
      const result = await normalizeMountedPdfUpload(args);
      return mountedFileResultToToolResponse(result);
    },
  };

  // Tool: mount_info
  // Useful for debugging and verifying mount configuration
  registry.mount_info = {
    description:
      "Query mount configuration and optionally resolve a specific path. " +
      "Useful for debugging: see registered mounts and test path resolution. " +
      "If 'matched' is false, the path needs to be added to a configured mount.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Optional path to resolve against configured mounts",
        },
      },
      additionalProperties: false,
    } as const,
    outputSchema: mountInfoOutputSchema,
    validate: (args) => mountInfoQuerySchema.parse(args),
    execute: (args) => queryMountInfo(args),
  };
}
