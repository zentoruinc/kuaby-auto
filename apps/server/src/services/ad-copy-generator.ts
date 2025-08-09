import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import {
  adCopyGeneration,
  adCopyProject,
  adCopyAsset,
  assetInterpretationCache,
} from "../db/schema/ad-copy";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface AdCopyVariation {
  variationNumber: number;
  headline: string;
  body: string;
  callToAction: string;
}

export interface AdCopyGenerationResult {
  projectId: string;
  variations: AdCopyVariation[];
  success: boolean;
  error?: string;
  metadata: {
    model: string;
    temperature: number;
    totalTokens: number;
    processingTime: number;
    contextUsed: {
      assetInterpretations: number;
      landingPageContent: number;
      systemPrompt: boolean;
    };
  };
}

export interface GenerationContext {
  assetInterpretations: string[];
  landingPageContent: string[];
  systemPrompt: string;
  projectName: string;
  variationCount: number;
}

export class AdCopyGenerator {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY environment variable is required");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });
  }

  /**
   * Generate ad copy variations based on context
   */
  async generateAdCopy(
    context: GenerationContext
  ): Promise<AdCopyGenerationResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(context);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();

      // Parse the generated ad copy variations
      const variations = this.parseGeneratedContent(
        generatedText,
        context.variationCount
      );

      const processingTime = Date.now() - startTime;

      return {
        projectId: "", // Will be set by caller
        variations,
        success: true,
        metadata: {
          model: "gemini-1.5-flash",
          temperature: 0.8,
          totalTokens: this.estimateTokens(prompt + generatedText),
          processingTime,
          contextUsed: {
            assetInterpretations: context.assetInterpretations.length,
            landingPageContent: context.landingPageContent.length,
            systemPrompt: !!context.systemPrompt,
          },
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        projectId: "",
        variations: [],
        success: false,
        error: `Ad copy generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          model: "gemini-1.5-flash",
          temperature: 0.8,
          totalTokens: 0,
          processingTime,
          contextUsed: {
            assetInterpretations: context.assetInterpretations.length,
            landingPageContent: context.landingPageContent.length,
            systemPrompt: !!context.systemPrompt,
          },
        },
      };
    }
  }

  /**
   * Build the prompt for ad copy generation
   */
  private buildPrompt(context: GenerationContext): string {
    let prompt = `${context.systemPrompt}\n\n`;

    prompt += `PROJECT: ${context.projectName}\n\n`;

    prompt += `TASK: Generate ${context.variationCount} unique and compelling ad copy variations based on the provided context.\n\n`;

    // Add asset interpretations
    if (context.assetInterpretations.length > 0) {
      prompt += `VISUAL/AUDIO ASSETS CONTEXT:\n`;
      context.assetInterpretations.forEach((interpretation, index) => {
        prompt += `Asset ${index + 1}: ${interpretation}\n`;
      });
      prompt += `\n`;
    }

    // Add landing page content
    if (context.landingPageContent.length > 0) {
      prompt += `LANDING PAGE CONTENT:\n`;
      context.landingPageContent.forEach((content, index) => {
        prompt += `Page ${index + 1}: ${content.substring(0, 1000)}${content.length > 1000 ? "..." : ""}\n`;
      });
      prompt += `\n`;
    }

    prompt += `REQUIREMENTS:
1. Create ${context.variationCount} distinct ad copy variations
2. Each variation should have:
   - A compelling HEADLINE (max 60 characters)
   - Engaging BODY text (max 150 characters)
   - A strong CALL-TO-ACTION (max 30 characters)
3. Use the asset and landing page context to inform your copy
4. Make each variation unique in tone, approach, or focus
5. Ensure all copy is persuasive and conversion-focused
6. Keep within character limits for each component

OUTPUT FORMAT:
Please format your response exactly as follows:

VARIATION 1:
HEADLINE: [Your headline here]
BODY: [Your body text here]
CTA: [Your call-to-action here]

VARIATION 2:
HEADLINE: [Your headline here]
BODY: [Your body text here]
CTA: [Your call-to-action here]

[Continue for all ${context.variationCount} variations]

Generate the ad copy variations now:`;

    return prompt;
  }

  /**
   * Parse the generated content into structured variations
   */
  private parseGeneratedContent(
    generatedText: string,
    expectedCount: number
  ): AdCopyVariation[] {
    const variations: AdCopyVariation[] = [];

    // Split by variation markers
    const variationBlocks = generatedText.split(/VARIATION \d+:/i).slice(1);

    for (let i = 0; i < Math.min(variationBlocks.length, expectedCount); i++) {
      const block = variationBlocks[i].trim();

      // Extract headline, body, and CTA using regex
      const headlineMatch = block.match(/HEADLINE:\s*(.+?)(?=\n|BODY:|$)/i);
      const bodyMatch = block.match(/BODY:\s*(.+?)(?=\n|CTA:|$)/i);
      const ctaMatch = block.match(/CTA:\s*(.+?)(?=\n|VARIATION|$)/i);

      const headline = headlineMatch
        ? headlineMatch[1].trim()
        : `Headline ${i + 1}`;
      const body = bodyMatch ? bodyMatch[1].trim() : `Body text ${i + 1}`;
      const callToAction = ctaMatch ? ctaMatch[1].trim() : `CTA ${i + 1}`;

      variations.push({
        variationNumber: i + 1,
        headline: this.truncateText(headline, 60),
        body: this.truncateText(body, 150),
        callToAction: this.truncateText(callToAction, 30),
      });
    }

    // If we didn't get enough variations, create fallback ones
    while (variations.length < expectedCount) {
      const num = variations.length + 1;
      variations.push({
        variationNumber: num,
        headline: `Compelling Headline ${num}`,
        body: `Engaging body text that drives action and converts visitors into customers ${num}`,
        callToAction: `Act Now ${num}`,
      });
    }

    return variations;
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Save generated ad copy variations to database
   */
  async saveGeneratedAdCopy(
    projectId: string,
    variations: AdCopyVariation[],
    context: GenerationContext,
    metadata: any
  ): Promise<void> {
    const now = new Date();

    for (const variation of variations) {
      const id = nanoid();

      await db.insert(adCopyGeneration).values({
        id,
        projectId,
        variationNumber: variation.variationNumber,
        headline: variation.headline,
        body: variation.body,
        callToAction: variation.callToAction,
        context: {
          assetInterpretations: context.assetInterpretations,
          landingPageContent: context.landingPageContent,
          systemPrompt: context.systemPrompt,
        },
        generationMetadata: metadata,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Generate and save ad copy for a project
   */
  async generateForProject(
    projectId: string,
    userId: string
  ): Promise<AdCopyGenerationResult> {
    try {
      // Get project details
      const project = await db
        .select()
        .from(adCopyProject)
        .where(
          and(eq(adCopyProject.id, projectId), eq(adCopyProject.userId, userId))
        )
        .limit(1);

      if (!project[0]) {
        throw new Error("Project not found");
      }

      // Build context from various sources
      const context: GenerationContext = {
        assetInterpretations: [], // Will be populated from cache
        landingPageContent: [], // Will be populated from cache
        systemPrompt: project[0].systemPrompt,
        projectName: project[0].name,
        variationCount: project[0].variationCount,
      };

      // Get asset interpretations from cache
      const assets = await db
        .select()
        .from(adCopyAsset)
        .where(eq(adCopyAsset.projectId, projectId));

      // Fetch cached interpretations for each asset
      if (assets.length > 0) {
        const interpretationPromises = assets.map(async (asset) => {
          try {
            const cached = await db
              .select()
              .from(assetInterpretationCache)
              .where(
                eq(assetInterpretationCache.dropboxFileId, asset.dropboxFileId)
              )
              .limit(1);

            if (cached[0]) {
              return `${asset.fileName}: ${cached[0].interpretation}`;
            } else {
              return `${asset.fileName}: Asset interpretation not available (not processed yet)`;
            }
          } catch (error) {
            return `${asset.fileName}: Error loading interpretation`;
          }
        });

        const interpretations = await Promise.all(interpretationPromises);
        context.assetInterpretations.push(...interpretations);
      } else {
        context.assetInterpretations.push(
          "No assets selected for this project"
        );
      }

      // Scrape landing page content
      if (project[0].landingPageUrls.length > 0) {
        console.log(
          `[generateForProject] Scraping ${project[0].landingPageUrls.length} landing pages`
        );

        const scrapingPromises = project[0].landingPageUrls.map(async (url) => {
          try {
            const { WebScraperService } = await import("./web-scraper");
            const scrapedContent = await WebScraperService.scrapeContent(url);

            if (scrapedContent.success && scrapedContent.content) {
              console.log(
                `[generateForProject] Successfully scraped ${url}: ${scrapedContent.content.length} chars`
              );
              return `Landing page (${url}):\nTitle: ${scrapedContent.title}\nContent: ${scrapedContent.content}`;
            } else {
              console.warn(
                `[generateForProject] Failed to scrape ${url}: ${scrapedContent.error}`
              );
              return `Landing page (${url}): Failed to scrape content - ${scrapedContent.error}`;
            }
          } catch (error) {
            console.error(`[generateForProject] Error scraping ${url}:`, error);
            return `Landing page (${url}): Error during scraping`;
          }
        });

        const scrapedResults = await Promise.all(scrapingPromises);
        context.landingPageContent.push(...scrapedResults);
      } else {
        context.landingPageContent.push("No landing page URLs provided");
      }

      // Generate ad copy
      const result = await this.generateAdCopy(context);
      result.projectId = projectId;

      // Save to database if successful
      if (result.success) {
        await this.saveGeneratedAdCopy(
          projectId,
          result.variations,
          context,
          result.metadata
        );
      }

      return result;
    } catch (error) {
      return {
        projectId,
        variations: [],
        success: false,
        error: `Project ad copy generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          model: "gemini-1.5-flash",
          temperature: 0.8,
          totalTokens: 0,
          processingTime: 0,
          contextUsed: {
            assetInterpretations: 0,
            landingPageContent: 0,
            systemPrompt: false,
          },
        },
      };
    }
  }
}
