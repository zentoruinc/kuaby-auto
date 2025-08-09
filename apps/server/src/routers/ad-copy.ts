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
        const assetUpdates = input.assetIds.map((assetId) =>
          db
            .update(adCopyAsset)
            .set({ projectId, updatedAt: now })
            .where(eq(adCopyAsset.id, assetId))
        );

        await Promise.all(assetUpdates);
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
      return [];
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

  // Generate ad copy for a project
  generateAdCopy: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
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

      // This will trigger the background processing
      // For now, just return success
      return { success: true, message: "Ad copy generation started" };
    }),
});
