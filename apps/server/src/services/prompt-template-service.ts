import { db } from "../db";
import { promptTemplate } from "../db/schema/ad-copy";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  AdPlatform,
  PromptTemplate,
  PromptSection,
} from "./ad-copy-generator";

export class PromptTemplateService {
  /**
   * Get default prompt template for a platform and prompt type
   */
  async getDefaultTemplate(
    platform: AdPlatform,
    promptType: string = "ad_copy"
  ): Promise<PromptTemplate | null> {
    const templates = await db
      .select()
      .from(promptTemplate)
      .where(
        and(
          eq(promptTemplate.promptType, promptType),
          eq(promptTemplate.isDefault, "true")
        )
      );

    // Filter by platform in the template JSON
    const platformTemplate = templates.find(
      (t) => t.template.platform === platform
    );

    if (!platformTemplate) {
      return this.createDefaultTemplate(platform, promptType);
    }

    return this.mapToPromptTemplate(platformTemplate);
  }

  /**
   * Get user's custom templates for a platform and prompt type
   */
  async getUserTemplates(
    userId: string,
    platform?: AdPlatform,
    promptType: string = "ad_copy"
  ): Promise<PromptTemplate[]> {
    const templates = await db
      .select()
      .from(promptTemplate)
      .where(
        and(
          eq(promptTemplate.userId, userId),
          eq(promptTemplate.promptType, promptType)
        )
      );

    // Filter by platform if specified
    if (platform) {
      return templates
        .filter((t) => t.template.platform === platform)
        .map(this.mapToPromptTemplate);
    }

    return templates.map(this.mapToPromptTemplate);
  }

  /**
   * Get all templates for a prompt type (for admin/listing purposes)
   */
  async getAllTemplates(
    promptType: string = "ad_copy"
  ): Promise<PromptTemplate[]> {
    const templates = await db
      .select()
      .from(promptTemplate)
      .where(eq(promptTemplate.promptType, promptType));

    return templates.map(this.mapToPromptTemplate);
  }

  /**
   * Create a new prompt template
   */
  async createTemplate(
    userId: string,
    name: string,
    platform: string,
    sections: PromptSection[],
    systemPrompt: string,
    promptType: string = "ad_copy",
    isDefault: boolean = false
  ): Promise<PromptTemplate> {
    const id = nanoid();
    const now = new Date();

    await db.insert(promptTemplate).values({
      id,
      userId,
      name,
      promptType,
      isDefault: isDefault ? "true" : "false",
      template: {
        platform,
        systemPrompt,
        sections,
      },
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      userId,
      name,
      promptType,
      isDefault,
      template: {
        platform,
        systemPrompt,
        sections,
      },
    };
  }

  /**
   * Update an existing prompt template
   */
  async updateTemplate(
    templateId: string,
    userId: string,
    name: string,
    platform: string,
    sections: PromptSection[],
    systemPrompt: string
  ): Promise<PromptTemplate> {
    const now = new Date();

    // Check if template exists and user has permission
    const existingTemplate = await db
      .select()
      .from(promptTemplate)
      .where(eq(promptTemplate.id, templateId))
      .limit(1);

    if (existingTemplate.length === 0) {
      throw new Error("Template not found");
    }

    if (existingTemplate[0].userId !== userId) {
      throw new Error("You don't have permission to update this template");
    }

    // Update the template
    await db
      .update(promptTemplate)
      .set({
        name,
        template: {
          platform,
          systemPrompt,
          sections,
        },
        updatedAt: now,
      })
      .where(eq(promptTemplate.id, templateId));

    return {
      id: templateId,
      userId,
      name,
      promptType: existingTemplate[0].promptType,
      isDefault: existingTemplate[0].isDefault === "true",
      template: {
        platform,
        systemPrompt,
        sections,
      },
      createdAt: existingTemplate[0].createdAt,
      updatedAt: now,
    };
  }

  /**
   * Delete a prompt template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    // Check if template exists and user has permission
    const existingTemplate = await db
      .select()
      .from(promptTemplate)
      .where(eq(promptTemplate.id, templateId))
      .limit(1);

    if (existingTemplate.length === 0) {
      throw new Error("Template not found");
    }

    if (existingTemplate[0].userId !== userId) {
      throw new Error("You don't have permission to delete this template");
    }

    if (existingTemplate[0].isDefault === "true") {
      throw new Error("Cannot delete default templates");
    }

    // Delete the template
    await db.delete(promptTemplate).where(eq(promptTemplate.id, templateId));
  }

  /**
   * Build final prompt from template and context
   */
  buildPromptFromTemplate(
    template: PromptTemplate,
    context: {
      projectName: string;
      assetInterpretations: string[];
      landingPageContent: string[];
      variationCount: number;
      variationType?: string;
    }
  ): string {
    let finalPrompt = template.template.systemPrompt + "\n\n";

    // Sort sections by order
    const sortedSections = [...template.template.sections].sort(
      (a, b) => a.order - b.order
    );

    for (const section of sortedSections) {
      let sectionContent = section.content;

      // Replace placeholders with actual values
      sectionContent = sectionContent
        .replace(/\{projectName\}/g, context.projectName)
        .replace(/\{variationCount\}/g, context.variationCount.toString())
        .replace(/\{variationType\}/g, context.variationType || "benefits");

      // Handle asset interpretations
      if (sectionContent.includes("{assetInterpretations}")) {
        if (context.assetInterpretations.length > 0) {
          const assetText = context.assetInterpretations
            .map(
              (interpretation, index) => `Asset ${index + 1}: ${interpretation}`
            )
            .join("\n");
          sectionContent = sectionContent.replace(
            /\{assetInterpretations\}/g,
            assetText
          );
        } else {
          sectionContent = sectionContent.replace(
            /\{assetInterpretations\}/g,
            "No assets provided."
          );
        }
      }

      // Handle landing page content
      if (sectionContent.includes("{landingPageContent}")) {
        if (context.landingPageContent.length > 0) {
          const pageText = context.landingPageContent
            .map((content, index) => `Page ${index + 1}: ${content}`)
            .join("\n");
          sectionContent = sectionContent.replace(
            /\{landingPageContent\}/g,
            pageText
          );
        } else {
          sectionContent = sectionContent.replace(
            /\{landingPageContent\}/g,
            "No landing page content provided."
          );
        }
      }

      finalPrompt += sectionContent + "\n\n";
    }

    return finalPrompt.trim();
  }

  /**
   * Create default template for platform
   */
  private async createDefaultTemplate(
    platform: AdPlatform,
    promptType: string = "ad_copy"
  ): Promise<PromptTemplate> {
    const sections: PromptSection[] = [];

    if (platform === "facebook") {
      sections.push(
        {
          id: "intro",
          name: "Introduction",
          content: `You are an experienced ad copywriter with extensive expertise in direct response copywriting. You produce persuasive, engaging Facebook ad copy that drives clicks, conversions, and overall campaign success.

PROJECT: {projectName}

TASK: Create Facebook ad copy following this EXACT structure:
1. Primary Text (main paragraph)
2. Headline (featuring free offering)

VARIATION TYPE: {variationType}`,
          editable: true,
          required: true,
          order: 1,
        },
        {
          id: "rules",
          name: "Formatting Rules",
          content: `STRICT FORMATTING RULES:
- Do NOT include dates, times, bold, italic, underline, or hyperlink formats
- Do NOT use em dashes
- Do NOT start Primary Text with a headline - go directly into the main paragraph
- Use emojis ONLY in bullet points within Primary Text
- Craft headlines that prominently feature the free offering (e.g., 'Free Online Summit: xxx', 'Free Webinar: xxx', 'Free eBook: xxx')`,
          editable: true,
          required: true,
          order: 2,
        },
        {
          id: "structure",
          name: "Primary Text Structure",
          content: `PRIMARY TEXT STRUCTURE:
1. Start with a hook considering myths, goals, fears, or frustrations of the target audience
2. Include compelling story or narrative (if available from context)
3. Add emoji bullet list highlighting benefits/outcomes the audience will experience
4. End with call-to-action paired with social proof or scarcity component`,
          editable: true,
          required: true,
          order: 3,
        },
        {
          id: "assets",
          name: "Asset Context",
          content: `VISUAL/AUDIO ASSETS CONTEXT:
{assetInterpretations}`,
          editable: false,
          required: false,
          order: 4,
        },
        {
          id: "landing_pages",
          name: "Landing Page Content",
          content: `LANDING PAGE CONTENT:
{landingPageContent}`,
          editable: false,
          required: false,
          order: 5,
        },
        {
          id: "output_format",
          name: "Output Format",
          content: `OUTPUT FORMAT:
PRIMARY_TEXT: [Your primary text here - no headline, direct into main paragraph with hook, story, emoji bullets, and CTA with social proof/scarcity]

HEADLINE: [Your headline featuring free offering]

Generate the Facebook ad copy now:`,
          editable: true,
          required: true,
          order: 6,
        }
      );
    }

    return this.createTemplate(
      "system", // System user ID for default templates
      `Default ${platform.charAt(0).toUpperCase() + platform.slice(1)} Template`,
      platform,
      sections,
      "You are an expert ad copywriter specialized in creating high-converting ad copy.",
      promptType,
      true
    );
  }

  /**
   * Map database record to PromptTemplate interface
   */
  private mapToPromptTemplate(record: any): PromptTemplate {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      promptType: record.promptType,
      isDefault: record.isDefault === "true",
      template: record.template,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
