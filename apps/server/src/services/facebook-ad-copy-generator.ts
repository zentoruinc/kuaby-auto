import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  FacebookAdContent,
  VariationType,
  GenerationContext,
  AdCopyVariation,
} from "./ad-copy-generator";

export class FacebookAdCopyGenerator {
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
   * Generate Facebook ad copy variations following the custom GPT structure
   */
  async generateFacebookAdCopy(
    context: GenerationContext
  ): Promise<AdCopyVariation[]> {
    const variations: AdCopyVariation[] = [];
    const variationTypes: VariationType[] = [
      "benefits",
      "pain_agitation",
      "storytelling",
    ];

    for (let i = 0; i < context.variationCount; i++) {
      const variationType = variationTypes[i % variationTypes.length];
      const prompt = this.buildFacebookPrompt(context, variationType, i + 1);

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

    return variations;
  }

  /**
   * Build Facebook-specific prompt following custom GPT instructions
   */
  private buildFacebookPrompt(
    context: GenerationContext,
    variationType: VariationType,
    variationNumber: number
  ): string {
    let prompt = `You are an experienced ad copywriter with extensive expertise in direct response copywriting. You produce persuasive, engaging Facebook ad copy that drives clicks, conversions, and overall campaign success.

PROJECT: ${context.projectName}

TASK: Create Facebook ad copy following this EXACT structure:
1. Primary Text (main paragraph)
2. Headline (featuring free offering)

VARIATION TYPE: ${this.getVariationTypeDescription(variationType)}

STRICT FORMATTING RULES:
- Do NOT include dates, times, bold, italic, underline, or hyperlink formats
- Do NOT use em dashes
- Do NOT start Primary Text with a headline - go directly into the main paragraph
- Use emojis ONLY in bullet points within Primary Text
- Craft headlines that prominently feature the free offering (e.g., 'Free Online Summit: xxx', 'Free Webinar: xxx', 'Free eBook: xxx')

PRIMARY TEXT STRUCTURE:
1. Start with a hook considering myths, goals, fears, or frustrations of the target audience
2. Include compelling story or narrative (if available from context)
3. Add emoji bullet list highlighting benefits/outcomes the audience will experience
4. End with call-to-action paired with social proof or scarcity component

`;

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
        prompt += `Page ${index + 1}: ${content}\n`;
      });
      prompt += `\n`;
    }

    prompt += `OUTPUT FORMAT:
PRIMARY_TEXT: [Your primary text here - no headline, direct into main paragraph with hook, story, emoji bullets, and CTA with social proof/scarcity]

HEADLINE: [Your headline featuring free offering]

Generate the Facebook ad copy now:`;

    return prompt;
  }

  /**
   * Get description for each variation type
   */
  private getVariationTypeDescription(variationType: VariationType): string {
    switch (variationType) {
      case "benefits":
        return "Focus on the benefits and outcomes of the offer with future pacing sentiment. Emphasize what the audience will achieve and how their life will improve.";
      case "pain_agitation":
        return "Focus on the pain of the audience and further agitate that pain. Highlight their current struggles and frustrations before presenting the solution.";
      case "storytelling":
        return "Utilize a storytelling angle by scanning available stories and testimonials. Create a compelling narrative that the target audience can relate to.";
      default:
        return "Create compelling ad copy that resonates with the target audience.";
    }
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
