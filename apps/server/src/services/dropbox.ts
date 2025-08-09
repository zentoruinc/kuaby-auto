import { db } from "../db";
import { integration } from "../db/schema/integrations";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import * as path from "path";
import { nanoid } from "nanoid";

export interface DropboxFile {
  id: string;
  name: string;
  path_lower: string;
  size: number;
  client_modified: string;
  server_modified: string;
  content_hash: string;
  is_downloadable: boolean;
  media_info?: {
    metadata?: {
      dimensions?: {
        height: number;
        width: number;
      };
      duration?: number;
    };
  };
}

export interface DropboxListResponse {
  entries: DropboxFile[];
  cursor?: string;
  has_more: boolean;
}

export class DropboxService {
  private async getActiveIntegration(userId: string) {
    const integrations = await db
      .select()
      .from(integration)
      .where(
        and(
          eq(integration.userId, userId),
          eq(integration.provider, "dropbox"),
          eq(integration.isActive, true)
        )
      )
      .limit(1);

    if (!integrations[0]) {
      throw new Error("No active Dropbox integration found");
    }

    return integrations[0];
  }

  private async refreshTokenIfNeeded(integrationRecord: any) {
    // Check if token is expired or will expire in the next 5 minutes
    const now = new Date();
    const expiresAt = integrationRecord.tokenExpiresAt;

    if (
      !expiresAt ||
      new Date(expiresAt).getTime() - now.getTime() < 5 * 60 * 1000
    ) {
      // Token is expired or will expire soon, refresh it
      if (!integrationRecord.refreshToken) {
        throw new Error("No refresh token available");
      }

      const tokenResponse = await fetch(
        "https://api.dropboxapi.com/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: integrationRecord.refreshToken,
            client_id: process.env.DROPBOX_CLIENT_ID || "",
            client_secret: process.env.DROPBOX_CLIENT_SECRET || "",
          }),
        }
      );

      if (!tokenResponse.ok) {
        throw new Error("Failed to refresh Dropbox token");
      }

      const tokenData = await tokenResponse.json();

      // Update the integration with new token
      await db
        .update(integration)
        .set({
          accessToken: tokenData.access_token,
          tokenExpiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
          updatedAt: new Date(),
        })
        .where(eq(integration.id, integrationRecord.id));

      return tokenData.access_token;
    }

    return integrationRecord.accessToken;
  }

  async listFiles(
    userId: string,
    folderPath: string = "",
    recursive: boolean = true
  ): Promise<DropboxFile[]> {
    const integrationRecord = await this.getActiveIntegration(userId);
    const accessToken = await this.refreshTokenIfNeeded(integrationRecord);

    const allFiles: DropboxFile[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const url = cursor
        ? "https://api.dropboxapi.com/2/files/list_folder/continue"
        : "https://api.dropboxapi.com/2/files/list_folder";

      const body = cursor
        ? { cursor }
        : {
            path: folderPath || "",
            recursive,
            include_media_info: true,
            include_deleted: false,
            include_has_explicit_shared_members: false,
          };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Failed to list Dropbox files: ${response.status}`);
      }

      const data: DropboxListResponse = await response.json();

      // Filter for images and videos only
      const mediaFiles = data.entries.filter((file) => {
        const ext = path.extname(file.name).toLowerCase();
        const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
        const videoExts = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
        return imageExts.includes(ext) || videoExts.includes(ext);
      });

      allFiles.push(...mediaFiles);
      cursor = data.cursor;
      hasMore = data.has_more;
    }

    return allFiles;
  }

  async downloadFile(
    userId: string,
    dropboxPath: string
  ): Promise<{ buffer: Buffer; tempPath: string }> {
    const integrationRecord = await this.getActiveIntegration(userId);
    const accessToken = await this.refreshTokenIfNeeded(integrationRecord);

    const response = await fetch(
      "https://content.dropboxapi.com/2/files/download",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Dropbox-API-Arg": JSON.stringify({ path: dropboxPath }),
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to download file from Dropbox: ${response.status}`
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate unique temp file path
    const fileExt = path.extname(dropboxPath);
    const tempFileName = `${nanoid()}${fileExt}`;
    const tempPath = path.join(tempDir, tempFileName);

    // Write buffer to temp file
    fs.writeFileSync(tempPath, buffer);

    return { buffer, tempPath };
  }

  async getFileMetadata(
    userId: string,
    dropboxPath: string
  ): Promise<DropboxFile> {
    const integrationRecord = await this.getActiveIntegration(userId);
    const accessToken = await this.refreshTokenIfNeeded(integrationRecord);

    const response = await fetch(
      "https://api.dropboxapi.com/2/files/get_metadata",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: dropboxPath,
          include_media_info: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.status}`);
    }

    return await response.json();
  }

  getFileType(fileName: string): "image" | "video" | "unknown" {
    const ext = path.extname(fileName).toLowerCase();
    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
    const videoExts = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];

    if (imageExts.includes(ext)) return "image";
    if (videoExts.includes(ext)) return "video";
    return "unknown";
  }

  getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".mkv": "video/x-matroska",
      ".webm": "video/webm",
      ".m4v": "video/x-m4v",
    };

    return mimeTypes[ext] || "application/octet-stream";
  }
}
