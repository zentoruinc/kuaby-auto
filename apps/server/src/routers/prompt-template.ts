import { z } from "zod";
import { router, protectedProcedure } from "../lib/trpc";
import { PromptTemplateService } from "../services/prompt-template-service";

const promptTemplateService = new PromptTemplateService();

export const promptTemplateRouter = router({
  /**
   * Get all templates for a prompt type
   */
  getAllTemplates: protectedProcedure
    .input(
      z.object({
        promptType: z.string().default("ad_copy"),
      })
    )
    .query(async ({ input }) => {
      return await promptTemplateService.getAllTemplates(input.promptType);
    }),

  /**
   * Get default template for a platform
   */
  getDefaultTemplate: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["facebook", "google", "tiktok"]),
        promptType: z.string().default("ad_copy"),
      })
    )
    .query(async ({ input }) => {
      return await promptTemplateService.getDefaultTemplate(
        input.platform,
        input.promptType
      );
    }),

  /**
   * Get user's custom templates for a platform
   */
  getUserTemplates: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["facebook", "google", "tiktok"]).optional(),
        promptType: z.string().default("ad_copy"),
      })
    )
    .query(async ({ input, ctx }) => {
      return await promptTemplateService.getUserTemplates(
        ctx.session.user.id,
        input.platform,
        input.promptType
      );
    }),

  /**
   * Create a new prompt template
   */
  createTemplate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Template name is required"),
        platform: z.string(),
        systemPrompt: z.string().min(1, "System prompt is required"),
        sections: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            content: z.string(),
            editable: z.boolean(),
            required: z.boolean(),
            order: z.number(),
          })
        ),
        promptType: z.string().default("ad_copy"),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await promptTemplateService.createTemplate(
        ctx.session.user.id,
        input.name,
        input.platform,
        input.sections,
        input.systemPrompt,
        input.promptType,
        input.isDefault
      );
    }),

  /**
   * Update a prompt template
   */
  updateTemplate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Template name is required"),
        platform: z.string(),
        systemPrompt: z.string().min(1, "System prompt is required"),
        sections: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            content: z.string(),
            editable: z.boolean(),
            required: z.boolean(),
            order: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await promptTemplateService.updateTemplate(
        input.id,
        ctx.session.user.id,
        input.name,
        input.platform,
        input.sections,
        input.systemPrompt
      );
    }),

  /**
   * Delete a prompt template
   */
  deleteTemplate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await promptTemplateService.deleteTemplate(
        input.id,
        ctx.session.user.id
      );
    }),

  /**
   * Build prompt preview from template
   */
  buildPromptPreview: protectedProcedure
    .input(
      z.object({
        templateId: z.string().optional(),
        platform: z.enum(["facebook", "google", "tiktok"]),
        sections: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              content: z.string(),
              editable: z.boolean(),
              required: z.boolean(),
              order: z.number(),
            })
          )
          .optional(),
        systemPrompt: z.string().optional(),
        context: z.object({
          projectName: z.string(),
          assetInterpretations: z.array(z.string()),
          landingPageContent: z.array(z.string()),
          variationCount: z.number(),
          variationType: z.string().optional(),
        }),
      })
    )
    .query(async ({ input, ctx }) => {
      let template;

      if (input.templateId) {
        // Get existing template (implementation needed)
        template = await promptTemplateService.getDefaultTemplate(
          input.platform
        );
      } else if (input.sections && input.systemPrompt) {
        // Use provided template data
        template = {
          id: "preview",
          userId: ctx.session.user.id,
          name: "Preview",
          promptType: "ad_copy",
          isDefault: false,
          template: {
            platform: input.platform,
            systemPrompt: input.systemPrompt,
            sections: input.sections,
          },
        };
      } else {
        // Use default template
        template = await promptTemplateService.getDefaultTemplate(
          input.platform
        );
      }

      if (!template) {
        throw new Error("No template found");
      }

      return promptTemplateService.buildPromptFromTemplate(
        template,
        input.context
      );
    }),
});
