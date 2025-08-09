import { z } from "zod";
import { protectedProcedure, router } from "../lib/trpc";
import {
  adCopyProject,
  adCopyAsset,
  adCopyGeneration,
  assetInterpretationCache,
  landingPageCache,
} from "../db/schema/ad-copy";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { nanoid } from "nanoid";
import { DropboxService } from "../services/dropbox";
import { AssetInterpretationService } from "../services/asset-interpretation";
import { AssetInterpreter } from "../services/asset-interpreter";
import { WebScraperService } from "../services/web-scraper";
import { AdCopyGenerator } from "../services/ad-copy-generator";
import { CleanupMonitor } from "../services/cleanup-monitor";
import fs from "fs";

export const adCopyRouter = router({
  // Get all projects for the current user
  getProjects: protectedProcedure.query(async ({ ctx }) => {
    return await db
      .select()
      .from(adCopyProject)
      .where(eq(adCopyProject.userId, ctx.session.user.id))
      .orderBy(desc(adCopyProject.createdAt));
  }),

  // Get a specific project with its assets and generations
  getProject: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const project = await db
        .select()
        .from(adCopyProject)
        .where(
          and(
            eq(adCopyProject.id, input.id),
            eq(adCopyProject.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!project[0]) {
        throw new Error("Project not found");
      }

      const assets = await db
        .select()
        .from(adCopyAsset)
        .where(eq(adCopyAsset.projectId, input.id));

      const generations = await db
        .select()
        .from(adCopyGeneration)
        .where(eq(adCopyGeneration.projectId, input.id))
        .orderBy(adCopyGeneration.variationNumber);

      return {
        project: project[0],
        assets,
        generations,
      };
    }),

  // Create a new project (draft)
  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Project name is required"),
        landingPageUrls: z
          .array(z.string().url())
          .min(1, "At least one landing page URL is required"),
        systemPrompt: z.string().optional(),
        variationCount: z.number().min(1).max(10).default(3),
        assetIds: z.array(z.string()).min(1, "At least one asset is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = nanoid();
      const now = new Date();

      // Create the project
      await db.insert(adCopyProject).values({
        id: projectId,
        userId: ctx.session.user.id,
        name: input.name,
        landingPageUrls: input.landingPageUrls,
        systemPrompt:
          input.systemPrompt ||
          "You are an expert ad copywriter. Create compelling, persuasive ad copy that drives conversions. Focus on benefits, use emotional triggers, and include clear calls-to-action.",
        variationCount: input.variationCount,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      // Associate assets with the project
      if (input.assetIds.length > 0) {
        console.log(
          `[createProject] Creating assets for project ${projectId}:`,
          input.assetIds
        );

        // Get the actual asset details from Dropbox
        const dropboxService = new DropboxService();
        const allDropboxFiles = await dropboxService.listFiles(
          ctx.session.user.id
        );

        console.log(
          `[createProject] Found ${allDropboxFiles.length} files from Dropbox`
        );

        // The assetIds from the frontend are actually dropboxFileIds from getAvailableAssets
        const assetInserts = input.assetIds.map(async (dropboxFileId) => {
          const assetId = nanoid();

          // Find the corresponding Dropbox file
          const dropboxFile = allDropboxFiles.find(
            (file) => (file.id || file.path_lower) === dropboxFileId
          );

          if (!dropboxFile) {
            console.warn(
              `[createProject] Could not find Dropbox file for ID: ${dropboxFileId}`
            );
            return;
          }

          console.log(
            `[createProject] Creating asset record for: ${dropboxFile.name}`
          );

          return db.insert(adCopyAsset).values({
            id: assetId,
            projectId,
            dropboxFileId,
            fileName: dropboxFile.name,
            fileType: dropboxService.getFileType(dropboxFile.name),
            mimeType: dropboxService.getMimeType(dropboxFile.name),
            fileSize: dropboxFile.size,
            dropboxPath: dropboxFile.path_lower,
            createdAt: now,
            updatedAt: now,
          });
        });

        const results = await Promise.all(assetInserts);
        const successfulInserts = results.filter(Boolean);
        console.log(
          `[createProject] Created ${successfulInserts.length} asset records out of ${input.assetIds.length} requested`
        );
      }

      return { projectId };
    }),

  // Update project
  updateProject: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        landingPageUrls: z.array(z.string().url()).optional(),
        systemPrompt: z.string().optional(),
        variationCount: z.number().min(1).max(10).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      await db
        .update(adCopyProject)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(adCopyProject.id, id),
            eq(adCopyProject.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  // Delete project
  deleteProject: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(adCopyProject)
        .where(
          and(
            eq(adCopyProject.id, input.id),
            eq(adCopyProject.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  // Get assets for project creation (from user's Dropbox)
  getAvailableAssets: protectedProcedure.query(async ({ ctx }) => {
    try {
      const dropboxService = new DropboxService();
      const files = await dropboxService.listFiles(ctx.session.user.id);

      return files.map((file) => ({
        id: file.id || file.path_lower, // Use path as ID if no ID available
        dropboxFileId: file.id || file.path_lower,
        fileName: file.name,
        fileType: dropboxService.getFileType(file.name),
        mimeType: dropboxService.getMimeType(file.name),
        fileSize: file.size,
        dropboxPath: file.path_lower,
        lastModified: file.server_modified,
        isDownloadable: file.is_downloadable,
        mediaInfo: file.media_info,
      }));
    } catch (error) {
      console.error("Failed to fetch Dropbox assets:", error);
      throw new Error(
        `Failed to fetch Dropbox assets: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }),

  // Add asset to project
  addAsset: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        dropboxFileId: z.string(),
        fileName: z.string(),
        fileType: z.enum(["image", "video"]),
        mimeType: z.string(),
        fileSize: z.number(),
        dropboxPath: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const assetId = nanoid();
      const now = new Date();

      await db.insert(adCopyAsset).values({
        id: assetId,
        projectId: input.projectId,
        dropboxFileId: input.dropboxFileId,
        fileName: input.fileName,
        fileType: input.fileType,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        dropboxPath: input.dropboxPath,
        createdAt: now,
        updatedAt: now,
      });

      return { assetId };
    }),

  // Process assets for interpretation
  processProjectAssets: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(
          `[processProjectAssets] Starting asset processing for project: ${input.projectId}`
        );

        // Get project assets
        const assets = await db
          .select()
          .from(adCopyAsset)
          .where(eq(adCopyAsset.projectId, input.projectId));

        if (assets.length === 0) {
          return {
            success: true,
            message: "No assets to process",
            processedAssets: [],
          };
        }

        console.log(
          `[processProjectAssets] Found ${assets.length} assets to process`
        );

        const dropboxService = new DropboxService();
        const assetInterpreter = new AssetInterpreter();
        const processedAssets = [];

        // Process each asset
        for (const asset of assets) {
          try {
            console.log(
              `[processProjectAssets] Processing asset: ${asset.fileName}`
            );

            // Check if interpretation already exists in cache
            const existingInterpretation = await db
              .select()
              .from(assetInterpretationCache)
              .where(
                eq(assetInterpretationCache.dropboxFileId, asset.dropboxFileId)
              )
              .limit(1);

            if (existingInterpretation[0]) {
              console.log(
                `[processProjectAssets] Asset ${asset.fileName} already processed, skipping`
              );
              processedAssets.push({
                fileName: asset.fileName,
                status: "already_processed",
                interpretation: existingInterpretation[0].interpretation,
              });
              continue;
            }

            // Download file from Dropbox
            let downloadResult;
            try {
              downloadResult = await dropboxService.downloadFile(
                ctx.session.user.id,
                asset.dropboxPath
              );
              console.log(
                `[processProjectAssets] Downloaded ${asset.fileName} to ${downloadResult.tempPath}`
              );
            } catch (error) {
              console.error(
                `[processProjectAssets] Failed to download ${asset.fileName}: ${error instanceof Error ? error.message : "Unknown error"}`
              );
              processedAssets.push({
                fileName: asset.fileName,
                status: "download_failed",
                error: error instanceof Error ? error.message : "Unknown error",
              });
              continue;
            }

            // Process the asset for interpretation
            const interpretationResult = await assetInterpreter.interpretAsset(
              asset.dropboxFileId,
              downloadResult.tempPath,
              asset.fileType as "image" | "video",
              asset.fileName
            );

            // Clean up downloaded file
            try {
              if (fs.existsSync(downloadResult.tempPath)) {
                fs.unlinkSync(downloadResult.tempPath);
              }
            } catch (error) {
              console.warn(
                `[processProjectAssets] Failed to cleanup temp file: ${error}`
              );
            }

            if (interpretationResult.success) {
              console.log(
                `[processProjectAssets] Successfully processed ${asset.fileName}`
              );
              processedAssets.push({
                fileName: asset.fileName,
                status: "success",
                interpretation: interpretationResult.interpretation,
                processingMethod: interpretationResult.processingMethod,
              });
            } else {
              console.error(
                `[processProjectAssets] Failed to interpret ${asset.fileName}: ${interpretationResult.error}`
              );
              processedAssets.push({
                fileName: asset.fileName,
                status: "interpretation_failed",
                error: interpretationResult.error,
              });
            }
          } catch (error) {
            console.error(
              `[processProjectAssets] Error processing asset ${asset.fileName}:`,
              error
            );
            processedAssets.push({
              fileName: asset.fileName,
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        console.log(
          `[processProjectAssets] Completed processing ${processedAssets.length} assets`
        );

        return {
          success: true,
          message: `Processed ${processedAssets.length} assets`,
          processedAssets,
        };
      } catch (error) {
        console.error(`[processProjectAssets] Error:`, error);
        throw new Error(
          `Failed to process assets: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // Process assets for a project (download and cache interpretations)
  processAssets: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get project and its assets
        const project = await db
          .select()
          .from(adCopyProject)
          .where(
            and(
              eq(adCopyProject.id, input.projectId),
              eq(adCopyProject.userId, ctx.session.user.id)
            )
          )
          .limit(1);

        if (!project[0]) {
          throw new Error("Project not found");
        }

        const assets = await db
          .select()
          .from(adCopyAsset)
          .where(eq(adCopyAsset.projectId, input.projectId));

        const dropboxService = new DropboxService();
        const processedAssets = [];

        for (const asset of assets) {
          // Check if interpretation is already cached
          const cached =
            await AssetInterpretationService.getCachedInterpretation(
              asset.dropboxFileId
            );

          if (
            cached &&
            (await AssetInterpretationService.isInterpretationFresh(
              asset.dropboxFileId
            ))
          ) {
            processedAssets.push({
              assetId: asset.id,
              interpretation: cached.interpretation,
              fromCache: true,
            });
            continue;
          }

          // Download file for processing
          const { tempPath } = await dropboxService.downloadFile(
            ctx.session.user.id,
            asset.dropboxPath
          );

          // Update asset with local path
          await db
            .update(adCopyAsset)
            .set({
              localPath: tempPath,
              updatedAt: new Date(),
            })
            .where(eq(adCopyAsset.id, asset.id));

          processedAssets.push({
            assetId: asset.id,
            localPath: tempPath,
            fileType: asset.fileType,
            fromCache: false,
          });
        }

        return {
          success: true,
          processedAssets,
          message: `Processed ${processedAssets.length} assets`,
        };
      } catch (error) {
        console.error("Asset processing failed:", error);
        throw new Error(
          `Asset processing failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // Interpret assets using AI (speech-to-text for videos, vision for images)
  interpretAssets: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get project and its assets
        const project = await db
          .select()
          .from(adCopyProject)
          .where(
            and(
              eq(adCopyProject.id, input.projectId),
              eq(adCopyProject.userId, ctx.session.user.id)
            )
          )
          .limit(1);

        if (!project[0]) {
          throw new Error("Project not found");
        }

        const assets = await db
          .select()
          .from(adCopyAsset)
          .where(eq(adCopyAsset.projectId, input.projectId));

        if (assets.length === 0) {
          return {
            success: true,
            interpretations: [],
            message: "No assets to interpret",
          };
        }

        const assetInterpreter = new AssetInterpreter();

        // Prepare assets for interpretation
        const assetsToInterpret = assets
          .filter((asset) => asset.localPath) // Only process downloaded assets
          .map((asset) => ({
            dropboxFileId: asset.dropboxFileId,
            filePath: asset.localPath!,
            fileType: asset.fileType as "image" | "video",
            fileName: asset.fileName,
          }));

        if (assetsToInterpret.length === 0) {
          throw new Error(
            "No assets have been downloaded yet. Please run processAssets first."
          );
        }

        // Interpret all assets
        const interpretations =
          await assetInterpreter.interpretAssets(assetsToInterpret);

        // Count successful interpretations
        const successCount = interpretations.filter((i) => i.success).length;
        const fromCacheCount = interpretations.filter(
          (i) => i.metadata.fromCache
        ).length;

        return {
          success: true,
          interpretations,
          message: `Interpreted ${successCount}/${interpretations.length} assets (${fromCacheCount} from cache)`,
        };
      } catch (error) {
        console.error("Asset interpretation failed:", error);
        throw new Error(
          `Asset interpretation failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // Scrape landing pages for a project
  scrapeLandingPages: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get project and its landing page URLs
        const project = await db
          .select()
          .from(adCopyProject)
          .where(
            and(
              eq(adCopyProject.id, input.projectId),
              eq(adCopyProject.userId, ctx.session.user.id)
            )
          )
          .limit(1);

        if (!project[0]) {
          throw new Error("Project not found");
        }

        const landingPageUrls = project[0].landingPageUrls;

        if (!landingPageUrls || landingPageUrls.length === 0) {
          return {
            success: true,
            scrapedPages: [],
            message: "No landing page URLs to scrape",
          };
        }

        // Scrape all landing page URLs
        const scrapedPages =
          await WebScraperService.scrapeMultipleUrls(landingPageUrls);

        // Count successful scrapes
        const successCount = scrapedPages.filter((page) => page.success).length;
        const fromCacheCount = scrapedPages.filter(
          (page) => page.metadata.processingTime === 0 // Cached results have 0 processing time
        ).length;

        return {
          success: true,
          scrapedPages,
          message: `Scraped ${successCount}/${scrapedPages.length} landing pages (${fromCacheCount} from cache)`,
        };
      } catch (error) {
        console.error("Landing page scraping failed:", error);
        throw new Error(
          `Landing page scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // Generate ad copy for a project
  generateAdCopy: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Update project status to processing
        await db
          .update(adCopyProject)
          .set({
            status: "processing",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(adCopyProject.id, input.projectId),
              eq(adCopyProject.userId, ctx.session.user.id)
            )
          );

        // Generate ad copy using the AI service
        const adCopyGenerator = new AdCopyGenerator();
        const result = await adCopyGenerator.generateForProject(
          input.projectId,
          ctx.session.user.id
        );

        // Update project status based on result
        const finalStatus = result.success ? "completed" : "failed";
        await db
          .update(adCopyProject)
          .set({
            status: finalStatus,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(adCopyProject.id, input.projectId),
              eq(adCopyProject.userId, ctx.session.user.id)
            )
          );

        if (!result.success) {
          throw new Error(result.error || "Ad copy generation failed");
        }

        return {
          success: true,
          variations: result.variations,
          metadata: result.metadata,
          message: `Generated ${result.variations.length} ad copy variations`,
        };
      } catch (error) {
        // Update project status to failed
        await db
          .update(adCopyProject)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(adCopyProject.id, input.projectId),
              eq(adCopyProject.userId, ctx.session.user.id)
            )
          );

        console.error("Ad copy generation failed:", error);
        throw new Error(
          `Ad copy generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // Manual cleanup endpoint for monitoring and maintenance
  performCleanup: protectedProcedure.mutation(async () => {
    try {
      console.log("[performCleanup] Manual cleanup triggered");
      const monitor = new CleanupMonitor();
      const report = await monitor.performCleanup();

      return {
        success: true,
        message: "Cleanup completed successfully",
        report,
      };
    } catch (error) {
      console.error("[performCleanup] Error:", error);
      throw new Error(
        `Cleanup failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }),
});
