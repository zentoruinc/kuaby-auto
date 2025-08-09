import { z } from "zod";
import { protectedProcedure, router } from "../lib/trpc";
import { 
  adCopyProject, 
  adCopyAsset, 
  adCopyGeneration, 
  assetInterpretationCache,
  landingPageCache 
} from "../db/schema/ad-copy";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { nanoid } from "nanoid";

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
        landingPageUrls: z.array(z.string().url()).min(1, "At least one landing page URL is required"),
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
        systemPrompt: input.systemPrompt || "You are an expert ad copywriter. Create compelling, persuasive ad copy that drives conversions. Focus on benefits, use emotional triggers, and include clear calls-to-action.",
        variationCount: input.variationCount,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      // Associate assets with the project
      if (input.assetIds.length > 0) {
        const assetUpdates = input.assetIds.map(assetId => 
          db.update(adCopyAsset)
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
    // This will be implemented to fetch from Dropbox integration
    // For now, return empty array
    return [];
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

  // Generate ad copy for a project
  generateAdCopy: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Update project status to processing
      await db
        .update(adCopyProject)
        .set({ 
          status: "processing",
          updatedAt: new Date() 
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
