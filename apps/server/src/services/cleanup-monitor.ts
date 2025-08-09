import fs from "fs";
import path from "path";
import { Storage } from "@google-cloud/storage";

export interface CleanupReport {
  timestamp: Date;
  tempFiles: {
    found: string[];
    cleaned: string[];
    failed: string[];
  };
  gcsFiles: {
    found: string[];
    cleaned: string[];
    failed: string[];
  };
  summary: {
    totalTempFiles: number;
    totalGcsFiles: number;
    cleanupSuccess: boolean;
  };
}

export class CleanupMonitor {
  private storageClient: Storage;
  private bucketName: string;
  private tempDir: string;

  constructor() {
    // Initialize Google Cloud Storage client
    const credentialsConfig = this.getGoogleCloudCredentials();
    this.storageClient = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      ...credentialsConfig,
    });

    this.bucketName =
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET || "kuaby-audio-temp";
    this.tempDir = path.join(process.cwd(), "temp");
  }

  /**
   * Get Google Cloud credentials (same as GoogleSpeechService)
   */
  private getGoogleCloudCredentials() {
    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON);
        return { credentials };
      } catch (error) {
        console.error("Failed to parse GOOGLE_CLOUD_KEY_JSON:", error);
        throw new Error(
          "Invalid JSON in GOOGLE_CLOUD_KEY_JSON environment variable"
        );
      }
    }

    if (process.env.GOOGLE_CLOUD_KEY_FILE) {
      return { keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE };
    }

    throw new Error(
      "Either GOOGLE_CLOUD_KEY_JSON or GOOGLE_CLOUD_KEY_FILE must be set"
    );
  }

  /**
   * Scan for orphaned temporary files
   */
  async scanTempFiles(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return [];
      }

      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const orphanedFiles: string[] = [];

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);

        // Consider files older than 1 hour as orphaned
        const ageInHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);

        if (ageInHours > 1) {
          orphanedFiles.push(filePath);
        }
      }

      return orphanedFiles;
    } catch (error) {
      console.error("[CleanupMonitor] Error scanning temp files:", error);
      return [];
    }
  }

  /**
   * Scan for orphaned GCS files
   */
  async scanGcsFiles(): Promise<string[]> {
    try {
      const [files] = await this.storageClient
        .bucket(this.bucketName)
        .getFiles();
      const now = Date.now();
      const orphanedFiles: string[] = [];

      for (const file of files) {
        const [metadata] = await file.getMetadata();

        if (!metadata.timeCreated) {
          console.warn(
            `[CleanupMonitor] File ${file.name} has no timeCreated metadata, skipping`
          );
          continue;
        }

        const createdTime = new Date(metadata.timeCreated).getTime();

        // Consider files older than 1 hour as orphaned
        const ageInHours = (now - createdTime) / (1000 * 60 * 60);

        if (ageInHours > 1) {
          orphanedFiles.push(`gs://${this.bucketName}/${file.name}`);
        }
      }

      return orphanedFiles;
    } catch (error) {
      console.error("[CleanupMonitor] Error scanning GCS files:", error);
      return [];
    }
  }

  /**
   * Clean up orphaned temporary files
   */
  async cleanupTempFiles(
    files: string[]
  ): Promise<{ cleaned: string[]; failed: string[] }> {
    const cleaned: string[] = [];
    const failed: string[] = [];

    for (const filePath of files) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          cleaned.push(filePath);
          console.log(
            `[CleanupMonitor] Cleaned orphaned temp file: ${filePath}`
          );
        }
      } catch (error) {
        failed.push(filePath);
        console.error(
          `[CleanupMonitor] Failed to clean temp file ${filePath}:`,
          error
        );
      }
    }

    return { cleaned, failed };
  }

  /**
   * Clean up orphaned GCS files
   */
  async cleanupGcsFiles(
    files: string[]
  ): Promise<{ cleaned: string[]; failed: string[] }> {
    const cleaned: string[] = [];
    const failed: string[] = [];

    for (const gcsUri of files) {
      try {
        const fileName = gcsUri.replace(`gs://${this.bucketName}/`, "");
        await this.storageClient
          .bucket(this.bucketName)
          .file(fileName)
          .delete();
        cleaned.push(gcsUri);
        console.log(`[CleanupMonitor] Cleaned orphaned GCS file: ${gcsUri}`);
      } catch (error) {
        failed.push(gcsUri);
        console.error(
          `[CleanupMonitor] Failed to clean GCS file ${gcsUri}:`,
          error
        );
      }
    }

    return { cleaned, failed };
  }

  /**
   * Perform comprehensive cleanup and return report
   */
  async performCleanup(): Promise<CleanupReport> {
    console.log("[CleanupMonitor] Starting comprehensive cleanup...");

    const timestamp = new Date();

    // Scan for orphaned files
    const tempFiles = await this.scanTempFiles();
    const gcsFiles = await this.scanGcsFiles();

    console.log(
      `[CleanupMonitor] Found ${tempFiles.length} orphaned temp files`
    );
    console.log(`[CleanupMonitor] Found ${gcsFiles.length} orphaned GCS files`);

    // Clean up files
    const tempCleanup = await this.cleanupTempFiles(tempFiles);
    const gcsCleanup = await this.cleanupGcsFiles(gcsFiles);

    const report: CleanupReport = {
      timestamp,
      tempFiles: {
        found: tempFiles,
        cleaned: tempCleanup.cleaned,
        failed: tempCleanup.failed,
      },
      gcsFiles: {
        found: gcsFiles,
        cleaned: gcsCleanup.cleaned,
        failed: gcsCleanup.failed,
      },
      summary: {
        totalTempFiles: tempFiles.length,
        totalGcsFiles: gcsFiles.length,
        cleanupSuccess:
          tempCleanup.failed.length === 0 && gcsCleanup.failed.length === 0,
      },
    };

    console.log(`[CleanupMonitor] Cleanup completed:`, {
      tempFiles: `${tempCleanup.cleaned.length}/${tempFiles.length} cleaned`,
      gcsFiles: `${gcsCleanup.cleaned.length}/${gcsFiles.length} cleaned`,
      success: report.summary.cleanupSuccess,
    });

    return report;
  }

  /**
   * Schedule periodic cleanup (call this from a cron job or similar)
   */
  static async scheduleCleanup(): Promise<void> {
    try {
      const monitor = new CleanupMonitor();
      await monitor.performCleanup();
    } catch (error) {
      console.error("[CleanupMonitor] Scheduled cleanup failed:", error);
    }
  }
}
