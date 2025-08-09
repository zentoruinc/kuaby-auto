import { db } from "../db";
import { assetInterpretationCache } from "../db/schema/ad-copy";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface AssetInterpretation {
  id: string;
  dropboxFileId: string;
  fileType: "image" | "video";
  interpretation: string;
  processingMethod: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export class AssetInterpretationService {
  /**
   * Get cached interpretation for a file
   */
  static async getCachedInterpretation(
    dropboxFileId: string
  ): Promise<AssetInterpretation | null> {
    const cached = await db
      .select()
      .from(assetInterpretationCache)
      .where(eq(assetInterpretationCache.dropboxFileId, dropboxFileId))
      .limit(1);

    if (!cached[0]) return null;

    return {
      id: cached[0].id,
      dropboxFileId: cached[0].dropboxFileId,
      fileType: cached[0].fileType as "image" | "video",
      interpretation: cached[0].interpretation,
      processingMethod: cached[0].processingMethod,
      metadata: cached[0].metadata || {},
      createdAt: cached[0].createdAt.toISOString(),
      updatedAt: cached[0].updatedAt.toISOString(),
    };
  }

  /**
   * Cache an interpretation result
   */
  static async cacheInterpretation(
    dropboxFileId: string,
    fileType: "image" | "video",
    interpretation: string,
    processingMethod: string,
    metadata: Record<string, any> = {}
  ): Promise<AssetInterpretation> {
    const now = new Date();
    const id = nanoid();

    // Check if already exists and update, otherwise insert
    const existing = await this.getCachedInterpretation(dropboxFileId);

    if (existing) {
      await db
        .update(assetInterpretationCache)
        .set({
          interpretation,
          processingMethod,
          metadata,
          updatedAt: now,
        })
        .where(eq(assetInterpretationCache.dropboxFileId, dropboxFileId));

      return {
        ...existing,
        interpretation,
        processingMethod,
        metadata,
        updatedAt: now.toISOString(),
      };
    } else {
      await db.insert(assetInterpretationCache).values({
        id,
        dropboxFileId,
        fileType,
        interpretation,
        processingMethod,
        metadata,
        createdAt: now,
        updatedAt: now,
      });

      return {
        id,
        dropboxFileId,
        fileType,
        interpretation,
        processingMethod,
        metadata,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    }
  }

  /**
   * Check if interpretation exists and is recent (within 30 days)
   */
  static async isInterpretationFresh(
    dropboxFileId: string,
    maxAgeInDays: number = 30
  ): Promise<boolean> {
    const cached = await this.getCachedInterpretation(dropboxFileId);

    if (!cached) return false;

    const cacheDate = new Date(cached.updatedAt);
    const now = new Date();
    const ageInDays =
      (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60 * 24);

    return ageInDays <= maxAgeInDays;
  }

  /**
   * Get multiple cached interpretations
   */
  static async getCachedInterpretations(
    dropboxFileIds: string[]
  ): Promise<AssetInterpretation[]> {
    if (dropboxFileIds.length === 0) return [];

    const cached = await db
      .select()
      .from(assetInterpretationCache)
      .where(
        // Use SQL IN operator for multiple IDs
        sql`${assetInterpretationCache.dropboxFileId} IN (${dropboxFileIds.map((id) => `'${id}'`).join(",")})`
      );

    return cached.map((item) => ({
      id: item.id,
      dropboxFileId: item.dropboxFileId,
      fileType: item.fileType as "image" | "video",
      interpretation: item.interpretation,
      processingMethod: item.processingMethod,
      metadata: item.metadata || {},
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  /**
   * Delete cached interpretation
   */
  static async deleteCachedInterpretation(
    dropboxFileId: string
  ): Promise<boolean> {
    const result = await db
      .delete(assetInterpretationCache)
      .where(eq(assetInterpretationCache.dropboxFileId, dropboxFileId));

    return (result.rowCount || 0) > 0;
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    totalCached: number;
    imageCount: number;
    videoCount: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    const allEntries = await db.select().from(assetInterpretationCache);

    const imageCount = allEntries.filter(
      (entry) => entry.fileType === "image"
    ).length;
    const videoCount = allEntries.filter(
      (entry) => entry.fileType === "video"
    ).length;

    const dates = allEntries.map((entry) => new Date(entry.createdAt));
    const oldestEntry =
      dates.length > 0
        ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString()
        : null;
    const newestEntry =
      dates.length > 0
        ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString()
        : null;

    return {
      totalCached: allEntries.length,
      imageCount,
      videoCount,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Clean up old cache entries
   */
  static async cleanupOldEntries(maxAgeInDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

    const result = await db
      .delete(assetInterpretationCache)
      .where(
        sql`${assetInterpretationCache.updatedAt} < ${cutoffDate.toISOString()}`
      );

    return result.rowCount || 0;
  }
}
