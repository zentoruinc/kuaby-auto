import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  FacebookAdContent,
  VariationType,
  GenerationContext,
  AdCopyVariation,
} from "./ad-copy-generator";
import { PromptTemplateService } from "./prompt-template-service";

export class FacebookAdCopyGenerator {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private promptTemplateService: PromptTemplateService;

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
    this.promptTemplateService = new PromptTemplateService();
  }

  /**
   * Generate Facebook ad copy variations following the custom GPT structure
   */
  async generateFacebookAdCopy(context: GenerationContext): Promise<{
    variations: AdCopyVariation[];
    finalPrompt: string;
  }> {
    const variations: AdCopyVariation[] = [];
    const variationTypes: VariationType[] = [
      "benefits",
      "pain_agitation",
      "storytelling",
    ];

    // Get the prompt template for Facebook
    const template =
      await this.promptTemplateService.getDefaultTemplate("facebook");
    if (!template) {
      throw new Error("No Facebook prompt template found");
    }

    // Build the final prompt using the template
    const finalPrompt = this.promptTemplateService.buildPromptFromTemplate(
      template,
      {
        projectName: context.projectName,
        assetInterpretations: context.assetInterpretations,
        landingPageContent: context.landingPageContent,
        variationCount: context.variationCount,
        variationType: variationTypes[0],
      }
    );

    for (let i = 0; i < context.variationCount; i++) {
      const variationType = variationTypes[i % variationTypes.length];

      // Build prompt for this specific variation type
      const prompt = this.promptTemplateService.buildPromptFromTemplate(
        template,
        {
          projectName: context.projectName,
          assetInterpretations: context.assetInterpretations,
          landingPageContent: context.landingPageContent,
          variationCount: 1, // Generate one at a time
          variationType,
        }
      );

      try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const generatedText = response.text();

        const facebookContent = this.parseFacebookContent(generatedText);

        variations.push({
          variationNumber: i + 1,
          platform: "facebook",
          variationType,
          content: {
            facebook: facebookContent,
          },
        });
      } catch (error) {
        console.error(`Failed to generate variation ${i + 1}:`, error);
        // Create fallback content
        variations.push({
          variationNumber: i + 1,
          platform: "facebook",
          variationType,
          content: {
            facebook: {
              primaryText: `Compelling primary text for ${variationType} approach ${i + 1}`,
              headline: `Free Offer: Transform Your Results ${i + 1}`,
            },
          },
        });
      }
    }

    return {
      variations,
      finalPrompt,
    };
  }

  /**
   * Parse the generated Facebook content
   */
  private parseFacebookContent(generatedText: string): FacebookAdContent {
    // Extract Primary Text
    const primaryTextMatch = generatedText.match(
      /PRIMARY_TEXT:\s*([\s\S]*?)(?=\n\s*HEADLINE:|$)/i
    );
    const primaryText = primaryTextMatch
      ? primaryTextMatch[1].trim()
      : "Compelling primary text that drives engagement and conversions.";

    // Extract Headline
    const headlineMatch = generatedText.match(/HEADLINE:\s*(.+?)(?=\n|$)/i);
    const headline = headlineMatch
      ? headlineMatch[1].trim()
      : "Free Offer: Transform Your Results Today";

    return {
      primaryText: this.cleanText(primaryText),
      headline: this.cleanText(headline),
    };
  }

  /**
   * Clean text by removing unwanted formatting
   */
  private cleanText(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold
      .replace(/\*(.*?)\*/g, "$1") // Remove italic
      .replace(/___(.*?)___/g, "$1") // Remove underline
      .replace(/__(.*?)__/g, "$1") // Remove underline
      .replace(/—/g, "-") // Replace em dash with regular dash
      .replace(/–/g, "-") // Replace en dash with regular dash
      .trim();
  }
}
