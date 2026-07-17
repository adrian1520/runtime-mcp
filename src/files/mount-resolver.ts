/**
 * Mount Path Resolver
 *
 * Handles rewriting paths from proxied mounts (e.g., /mnt/data) to normalized file objects.
 * This layer bridges the gap between mount-based file access and the UploadedFile model.
 *
 * Problem: "File arg rewrite paths are required when proxied mounts are present"
 * Solution: Resolve mount paths through a configured mount map that transforms:
 *   /mnt/data/Lubicz.pdf -> { mount: "data", path: "Lubicz.pdf" } -> normalized UploadedFile
 */

export type MountConfig = {
  /** Mount point path (e.g., "/mnt/data") */
  mountPath: string;
  /** Logical mount name (e.g., "data") */
  name: string;
  /** Whether this mount is read-only */
  readOnly?: boolean;
  /** Optional rewrite rules (regex -> replacement) */
  rewriteRules?: Array<{ pattern: RegExp; replacement: string }>;
};

export type MountResolution = {
  /** Whether the path matches a configured mount */
  matched: boolean;
  /** Name of the mount that matched */
  mount?: string;
  /** Normalized relative path within the mount */
  relativePath?: string;
  /** Full mount point path */
  mountPath?: string;
  /** Rewritten path after applying mount rules */
  rewrittenPath?: string;
};

/**
 * Mount resolver: maps proxied paths to mount configurations
 */
export class MountPathResolver {
  private mounts: Map<string, MountConfig> = new Map();
  private sortedMounts: MountConfig[] = [];

  constructor(mounts: MountConfig[] = []) {
    for (const mount of mounts) {
      this.registerMount(mount);
    }
  }

  /**
   * Register a mount configuration
   */
  registerMount(config: MountConfig): void {
    this.mounts.set(config.name, config);
    // Sort by mount path length (descending) to match longest paths first
    this.sortedMounts = Array.from(this.mounts.values()).sort(
      (a, b) => b.mountPath.length - a.mountPath.length,
    );
  }

  /**
   * Resolve a file path against registered mounts
   * Returns mount metadata and rewritten path
   */
  resolve(filePath: string): MountResolution {
    const normalized = filePath.replace(/\\/g, "/");

    for (const mount of this.sortedMounts) {
      const mountPath = mount.mountPath.replace(/\\/g, "/");
      const normalizedMount = mountPath.endsWith("/")
        ? mountPath
        : `${mountPath}/`;

      if (normalized.startsWith(normalizedMount)) {
        const relativePath = normalized.slice(normalizedMount.length);
        let rewrittenPath = relativePath;

        // Apply rewrite rules
        if (mount.rewriteRules) {
          for (const rule of mount.rewriteRules) {
            rewrittenPath = rewrittenPath.replace(
              rule.pattern,
              rule.replacement,
            );
          }
        }

        return {
          matched: true,
          mount: mount.name,
          relativePath,
          mountPath: mount.mountPath,
          rewrittenPath,
        };
      }
    }

    return { matched: false };
  }

  /**
   * Check if a path is from a known mount
   */
  isMounted(filePath: string): boolean {
    return this.resolve(filePath).matched;
  }

  /**
   * Get mount configuration by name
   */
  getMount(name: string): MountConfig | undefined {
    return this.mounts.get(name);
  }

  /**
   * List all registered mounts
   */
  listMounts(): MountConfig[] {
    return Array.from(this.mounts.values());
  }
}

/**
 * Default mounts for common scenarios
 */
export function createDefaultMountResolver(): MountPathResolver {
  return new MountPathResolver([
    {
      mountPath: "/mnt/data",
      name: "data",
      readOnly: false,
      rewriteRules: [
        // Normalize whitespace in filenames
        { pattern: /\s+/g, replacement: "_" },
      ],
    },
    {
      mountPath: "/mnt/documents",
      name: "documents",
      readOnly: false,
    },
    {
      mountPath: "/mnt/uploads",
      name: "uploads",
      readOnly: false,
    },
    {
      mountPath: "/data",
      name: "local-data",
      readOnly: false,
    },
  ]);
}
