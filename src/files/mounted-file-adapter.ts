/**
 * Mounted File Adapter
 *
 * Integrates MountPathResolver with UploadedFile normalization.
 * Converts mounted file paths into normalized UploadedFile objects.
 *
 * Flow:
 *   Mounted path (/mnt/data/Lubicz.pdf)
 *   -> MountPathResolver (resolve mount, rewrite path)
 *   -> readLocalFile (fetch bytes)
 *   -> normalizeUploadedFile (create UploadedFile)
 *   -> Backend OCR (ready for processing)
 */

import {
  FileValidationError,
  normalizeUploadedFile,
  validateUploadedFile,
  type FileReference,
  type UploadedFile,
  bytesToBase64,
} from "./uploaded-file.js";
import {
  MountPathResolver,
  createDefaultMountResolver,
  type MountConfig,
  type MountResolution,
} from "./mount-resolver.js";

/**
 * Result of mounted file processing
 */
export type MountedFileResult = {
  /** Whether the file was successfully resolved from a mount */
  success: boolean;
  /** Uploaded file object (if successful) */
  file?: UploadedFile;
  /** Mount resolution details */
  resolution: MountResolution;
  /** Error message (if failed) */
  error?: string;
};

/**
 * Context for mounted file operations
 */
export type MountedFileContext = {
  /** Mount resolver instance */
  resolver: MountPathResolver;
  /** Optional custom path normalizer */
  pathNormalizer?: (path: string) => string;
  /** Whether to throw on mount not found */
  throwOnUnmounted?: boolean;
};

/**
 * Adapter for normalizing mounted files into UploadedFile objects
 */
export class MountedFileAdapter {
  private resolver: MountPathResolver;
  private pathNormalizer: (path: string) => string;
  private throwOnUnmounted: boolean;

  constructor(context: MountedFileContext = {}) {
    this.resolver = context.resolver || createDefaultMountResolver();
    this.pathNormalizer = context.pathNormalizer || ((p: string) => p);
    this.throwOnUnmounted = context.throwOnUnmounted ?? false;
  }

  /**
   * Normalize a mounted file path into an UploadedFile
   *
   * @param filePath - Path to the mounted file (e.g., /mnt/data/Lubicz.pdf)
   * @param index - Index for multi-file operations
   * @returns Promise resolving to MountedFileResult
   */
  async normalizeMountedFile(
    filePath: string,
    index = 0,
  ): Promise<MountedFileResult> {
    const resolution = this.resolver.resolve(filePath);

    if (!resolution.matched) {
      const error =
        `File path ${filePath} does not match any configured mount. ` +
        `Registered mounts: ${this.resolver
          .listMounts()
          .map((m) => m.name)
          .join(", ")}`;

      if (this.throwOnUnmounted) {
        throw new FileValidationError(
          "FILE_ARG_REWRITE_MOUNT_NOT_FOUND",
          error,
        );
      }

      return { success: false, resolution, error };
    }

    try {
      // Read the file from the mounted path
      const bytes = await this.readMountedFile(filePath);

      // Normalize into UploadedFile format
      const fileName =
        resolution.rewrittenPath ||
        resolution.relativePath ||
        "mounted-file.pdf";

      // Apply optional path normalizer (e.g., for custom sanitization)
      const normalizedName = this.pathNormalizer(fileName);

      const file: UploadedFile = {
        id: `mounted-${resolution.mount}-${index + 1}`,
        filename: normalizedName,
        mimeType: this.inferMimeType(normalizedName),
        bytes,
        size: bytes.byteLength,
        source: "path",
      };

      // Validate the resulting file
      validateUploadedFile({
        filename: file.filename,
        mimeType: file.mimeType,
        bytes: file.bytes,
      });

      return { success: true, file, resolution };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        resolution,
        error: `Failed to process mounted file: ${message}`,
      };
    }
  }

  /**
   * Normalize multiple mounted file paths
   */
  async normalizeMountedFiles(
    filePaths: string[],
  ): Promise<MountedFileResult[]> {
    return Promise.all(
      filePaths.map((path, index) => this.normalizeMountedFile(path, index)),
    );
  }

  /**
   * Handle a file reference that might be mounted or inline
   * Falls back to standard normalization if not mounted
   */
  async normalizeFileWithMountFallback(
    file: FileReference,
    index = 0,
  ): Promise<UploadedFile> {
    // If it's a string path, try mount resolution first
    if (typeof file === "string") {
      const resolution = this.resolver.resolve(file);
      if (resolution.matched) {
        const result = await this.normalizeMountedFile(file, index);
        if (result.success && result.file) {
          return result.file;
        }
        // Fall through to standard handling
      }
    }

    // Fallback to standard normalization
    return normalizeUploadedFile(file, index);
  }

  /**
   * Read bytes from a mounted file path
   */
  private async readMountedFile(path: string): Promise<Uint8Array> {
    try {
      const dynamicImport = new Function(
        "specifier",
        "return import(specifier)",
      ) as (
        specifier: string,
      ) => Promise<{ readFile: (path: string) => Promise<Uint8Array> }>;
      const fs = await dynamicImport("node:fs/promises");
      return await fs.readFile(path);
    } catch (error) {
      throw new FileValidationError(
        "FILE_REFERENCE_UNREADABLE",
        `Unable to read mounted file ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Infer MIME type from filename
   */
  private inferMimeType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
    if (lower.endsWith(".webp")) return "image/webp";
    return "application/pdf";
  }

  /**
   * Get the mount resolver instance
   */
  getResolver(): MountPathResolver {
    return this.resolver;
  }

  /**
   * Register a new mount
   */
  registerMount(config: MountConfig): void {
    this.resolver.registerMount(config);
  }
}

/**
 * Helper to convert MountedFileResult to a tool response
 * Useful for exposing mounted file normalization as a tool
 */
export function mountedFileResultToToolResponse(result: MountedFileResult) {
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      resolution: {
        matched: result.resolution.matched,
        mount: result.resolution.mount,
      },
    };
  }

  return {
    success: true,
    file: result.file
      ? {
          id: result.file.id,
          filename: result.file.filename,
          mimeType: result.file.mimeType,
          size: result.file.size,
          source: result.file.source,
          base64: bytesToBase64(result.file.bytes),
        }
      : undefined,
    resolution: {
      matched: result.resolution.matched,
      mount: result.resolution.mount,
      relativePath: result.resolution.relativePath,
      rewrittenPath: result.resolution.rewrittenPath,
    },
  };
}

/**
 * Create a default adapter with standard mounts
 */
export function createDefaultMountedFileAdapter(): MountedFileAdapter {
  return new MountedFileAdapter({
    resolver: createDefaultMountResolver(),
  });
}
